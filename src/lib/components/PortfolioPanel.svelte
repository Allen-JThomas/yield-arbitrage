<script>
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { store } from '../stores/appState.svelte.js';
  import { formatYield, formatCurrency, calculateVolatility, calculatePortfolioCorrelation } from '../data/dataLoader.js';
  import RiskYieldChart from './RiskYieldChart.svelte';

  Chart.register(...registerables);

  let chartCanvas;
  let chart;

  let propertyType = $derived(store.propertyType);
  let allMetros = $derived(store.appData?.metros || []);

  // Portfolio: list of {metro, pt, optIdx}
  let portfolio = $state([]);
  let searchQuery = $state('');
  let showSearch = $state(false);

  // Diversity constraints
  let maxPerState = $state(3);
  let maxPerMetro = $state(1);
  let optimizeObjective = $state('sharpe');

  // Active dropdown for optimal selection
  let activeOptDropdown = $state(null);
  
  // Base mathematical extraction functions for Volatility Matrices
  const getSeries = (m, pt, mode) => {
    const d = m?.[pt];
    if (!d) return [];
    if (mode === 'total') return d.totalYieldSeries?.values || [];
    if (mode === 'rental') return d.rentalYieldSeries?.values || [];
    return d.appreciationYieldSeries?.values || [];
  };

  const getAggSeries = (matrix) => {
    if (matrix.length === 0) return [];
    const minLen = Math.min(...matrix.map(s => s.length));
    if (minLen < 12) return [];
    const agg = [];
    for (let i = 0; i < minLen; i++) {
      let sum = 0;
      matrix.forEach(arr => sum += arr[arr.length - minLen + i]);
      agg.push(sum / matrix.length);
    }
    return agg;
  };

  // Initialize with the exact user-provided portfolio base
  $effect(() => {
    if (allMetros.length > 0 && portfolio.length === 0) {
      const targetCities = [
        "Richmond, IN", "Laredo, TX", "San Luis Obispo", "Rockford, IL", 
        "Beaumont, TX", "Bremerton, WA", "Santa Cruz", "Trenton, NJ", 
        "Ann Arbor, MI", "Lincoln, NE"
      ];
      const defaultMetros = [];
      for (const tName of targetCities) {
        const found = allMetros.find(m => m.regionName.toLowerCase().includes(tName.toLowerCase()));
        if (found) defaultMetros.push(found);
      }
      
      if (defaultMetros.length > 0) {
        portfolio = defaultMetros.map(m => ({ metro: m, pt: 'sf', optIdx: { total: 0, rental: 0, app: 0 } }));
      } else {
        const validMetros = allMetros.filter(m => {
           const y = getMetroYields(m, propertyType);
           if (store.portfolioTarget === 'total') return y.rental != null && y.app != null;
           if (store.portfolioTarget === 'rental') return y.rental != null;
           if (store.portfolioTarget === 'app') return y.app != null;
           return true;
        });
        const shuffled = [...validMetros].sort(() => Math.random() - 0.5);
        portfolio = shuffled.slice(0, 10).map(m => ({ metro: m, pt: propertyType, optIdx: { total: 0, rental: 0, app: 0 } }));
      }
    }
  });

  // Helpers
  function fmt(v) { return formatCurrency(v); }
  function fmtPct(v) { return v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—'; }
  function ptLabel(pt) { return pt === 'sf' ? 'SF' : 'MF'; }

  function getMetroYields(metro, pt) {
    const d = metro?.[pt];
    if (!d) return { rental: null, app: null, total: null, value: 0 };
    const rental = d.currentRentalYield;
    const app = d.currentAppreciationYield;
    return {
      rental,
      app,
      total: d.currentTotalYield ?? (rental != null && app != null ? rental + app : (rental ?? app)),
      value: d.currentValue ?? 0,
    };
  }

  function project(value, rentalYield, appYield) {
    const rows = [];
    let val = value;
    let cumRent = 0, cumApp = 0;
    for (let yr = 0; yr <= 5; yr++) {
      if (yr === 0) {
        rows.push({ year: yr, value: val, cumRent: 0, cumApp: 0, total: 0 });
      } else {
        const rent = val * rentalYield / 100;
        const app = val * appYield / 100;
        val += app;
        cumRent += rent;
        cumApp += app;
        rows.push({ year: yr, value: val, cumRent, cumApp, total: cumRent + cumApp });
      }
    }
    return rows;
  }

  // Build ranked candidates list (top metros with diversity constraint)
  let rankedCandidates = $derived.by(() => {
    if (allMetros.length === 0) return [];
    
    // Create pool considering both SF and MF
    const pool = [];
    for (const m of allMetros) {
       for (const pt of ['sf', 'mf']) {
          const yields = getMetroYields(m, pt);
          if (yields.value > 0) {
             let hasData = store.portfolioTarget === 'rental' ? m[pt].currentRentalYield != null : store.portfolioTarget === 'app' ? m[pt].currentAppreciationYield != null : m[pt].currentTotalYield != null;
             
             // The user explicitly requested to globally disqualify MF from strictly Appreciation tracking
             if (store.portfolioTarget === 'app' && pt === 'mf') hasData = false;

             if (hasData) {
               pool.push({ metro: m, pt, yields });
             }
          }
       }
    }
    
    return pool.sort((a, b) => {
        const valA = store.portfolioTarget === 'rental' ? (a.yields.rental || 0) : store.portfolioTarget === 'app' ? (a.yields.app || 0) : (a.yields.total || 0);
        const valB = store.portfolioTarget === 'rental' ? (b.yields.rental || 0) : store.portfolioTarget === 'app' ? (b.yields.app || 0) : (b.yields.total || 0);
        return valB - valA;
      });
  });

  // Build diversified top-N list respecting maxPerState and maxPerMetro
  let diversifiedCandidates = $derived.by(() => {
    const stateCounts = {};
    const metroCounts = {};
    const result = [];
    for (const c of rankedCandidates) {
      const state = c.metro.stateName || 'Unknown';
      const metroId = c.metro.regionId;
      const sc = stateCounts[state] || 0;
      const mc = metroCounts[metroId] || 0;
      if (sc >= maxPerState) continue;
      if (mc >= maxPerMetro) continue;
      stateCounts[state] = sc + 1;
      metroCounts[metroId] = mc + 1;
      result.push(c);
      if (result.length >= 50) break;
    }
    return result;
  });

  // For each portfolio item, get its optimal options (top 25 diversified)
  function getOptimalOptions(currentMetro) {
    return diversifiedCandidates
      .filter(c => c.metro.regionId !== currentMetro.regionId)
      .slice(0, 25);
  }

  // Portfolio aggregate with greedy diversified assignment
  let portfolioStats = $derived.by(() => {
    if (portfolio.length === 0) return null;
    // Read ranked candidates (full sorted list, no pre-filtering)
    const allCandidates = rankedCandidates;
    // Read constraints to track as dependencies
    const mps = maxPerState;
    const mpm = maxPerMetro;

    let totalValue = 0;
    let weightedRental = 0, weightedApp = 0, weightedTotal = 0;

    // First pass: compute yields for each item + build candidate options
    const itemsRaw = portfolio.map((p, i) => {
      const y = getMetroYields(p.metro, p.pt);
      totalValue += y.value;
      weightedRental += (y.rental || 0) * y.value;
      weightedApp += (y.app || 0) * y.value;
      weightedTotal += (y.total || 0) * y.value;
      // Each item gets the full candidate list minus itself
      const opts = allCandidates
        .filter(c => c.metro.regionId !== p.metro.regionId)
        .slice(0, 50); // broader list for dropdown
      return { ...p, yields: y, opts, selectedOpt: null, defaultOptIdx: 0, index: i };
    });

    // Greedy assignment: assign the best available candidate to each item
    // Track usage counts across the portfolio
    const stateUsed = {};
    const metroUsed = {};

    // Evaluate candidates top-down in exactly the order they appear in the UI table
    const sortedIndices = itemsRaw.map((_, i) => i);

    for (const idx of sortedIndices) {
      const item = itemsRaw[idx];
      // If user manually selected, honor their choice
      const currentOptIdx = item.optIdx[store.portfolioTarget] || 0;
      if (currentOptIdx > 0 && item.opts[currentOptIdx]) {
        item.selectedOpt = item.opts[currentOptIdx];
        const st = item.selectedOpt.metro.stateName || 'Unknown';
        const mid = item.selectedOpt.metro.regionId;
        stateUsed[st] = (stateUsed[st] || 0) + 1;
        metroUsed[mid] = (metroUsed[mid] || 0) + 1;
        continue;
      }

      if (optimizeObjective === 'sharpe') {
        let bestCand = null;
        let maxSharpe = -Infinity;
        let bestDefaultIdx = 0;
        let candsTested = 0;

        for (let oi = 0; oi < item.opts.length; oi++) {
          if (candsTested >= 25) break; // Hard cap performance safety
          
          const cand = item.opts[oi];
          const st = cand.metro.stateName || 'Unknown';
          const mid = cand.metro.regionId;
          if ((stateUsed[st] || 0) >= mps) continue;
          if ((metroUsed[mid] || 0) >= mpm) continue;
          
          candsTested++;
          
          // Construct hypothetical matrix
          const tempMatrix = [];
          for (let k = 0; k < itemsRaw.length; k++) {
            const it = itemsRaw[k];
            if (k === idx) {
               const series = getSeries(cand.metro, cand.pt, store.portfolioTarget);
               if (series && series.length >= 12) tempMatrix.push(series);
            } else {
               const useOpt = it.selectedOpt || it; 
               const series = getSeries(useOpt.metro, useOpt.pt, store.portfolioTarget);
               if (series && series.length >= 12) tempMatrix.push(series);
            }
          }
          
          const tempAgg = getAggSeries(tempMatrix);
          const tempVol = calculateVolatility(tempAgg);
          if (isNaN(tempVol)) continue;
          
          let tempWeightedYield = 0;
          let tempTotalValue = 0;
          for (let k = 0; k < itemsRaw.length; k++) {
            const it = itemsRaw[k];
            const val = it.yields.value;
            tempTotalValue += val;
            let yieldPct = 0;
            if (k === idx) {
              yieldPct = store.portfolioTarget === 'rental' ? (cand.yields.rental || 0) : store.portfolioTarget === 'app' ? (cand.yields.app || 0) : (cand.yields.total || 0);
            } else {
              const useOpt = it.selectedOpt || it;
              yieldPct = store.portfolioTarget === 'rental' ? (useOpt.yields.rental || 0) : store.portfolioTarget === 'app' ? (useOpt.yields.app || 0) : (useOpt.yields.total || 0);
            }
            tempWeightedYield += yieldPct * val;
          }
          const tempPortYield = tempTotalValue > 0 ? tempWeightedYield / tempTotalValue : 0;
          
          const sharpe = tempPortYield / tempVol;
          if (sharpe > maxSharpe) {
             maxSharpe = sharpe;
             bestCand = cand;
             bestDefaultIdx = oi;
          }
        }
        
        if (bestCand) {
           item.selectedOpt = bestCand;
           item.defaultOptIdx = bestDefaultIdx;
           const st = bestCand.metro.stateName || 'Unknown';
           const mid = bestCand.metro.regionId;
           stateUsed[st] = (stateUsed[st] || 0) + 1;
           metroUsed[mid] = (metroUsed[mid] || 0) + 1;
        } else if (item.opts.length > 0) {
           item.selectedOpt = item.opts[0];
           item.defaultOptIdx = 0;
        }
      } else {
        // Auto-assign: find first candidate that respects constraints
        let assigned = false;
        for (let oi = 0; oi < item.opts.length; oi++) {
          const cand = item.opts[oi];
          const st = cand.metro.stateName || 'Unknown';
          const mid = cand.metro.regionId;
          if ((stateUsed[st] || 0) >= mps) continue;
          if ((metroUsed[mid] || 0) >= mpm) continue;
          item.selectedOpt = cand;
          item.defaultOptIdx = oi;
          stateUsed[st] = (stateUsed[st] || 0) + 1;
          metroUsed[mid] = (metroUsed[mid] || 0) + 1;
          assigned = true;
          break;
        }
        if (!assigned && item.opts.length > 0) {
          // Fallback: just pick the best if constraints are too tight
          item.selectedOpt = item.opts[0];
          item.defaultOptIdx = 0;
        }
      }
    }

    const avgRental = totalValue > 0 ? weightedRental / totalValue : 0;
    const avgApp = totalValue > 0 ? weightedApp / totalValue : 0;
    const avgTotal = totalValue > 0 ? weightedTotal / totalValue : 0;

    return { items: itemsRaw, totalValue, avgRental, avgApp, avgTotal };
  });

  let currentProjection = $derived.by(() => {
    if (!portfolioStats) return [];
    const rY = store.portfolioTarget === 'app' ? 0 : portfolioStats.avgRental;
    const aY = store.portfolioTarget === 'rental' ? 0 : portfolioStats.avgApp;
    return project(portfolioStats.totalValue, rY, aY);
  });

  // Optimized stats based on selected optimal per item
  let optimizedStats = $derived.by(() => {
    if (!portfolioStats) return null;
    let totalValue = 0;
    let weightedRental = 0, weightedApp = 0, weightedTotal = 0;

    for (const item of portfolioStats.items) {
      const val = item.yields.value;
      const optY = item.selectedOpt ? item.selectedOpt.yields : item.yields;
      totalValue += val;
      weightedRental += (optY.rental || 0) * val;
      weightedApp += (optY.app || 0) * val;
      weightedTotal += (optY.total || 0) * val;
    }

    const avgRental = totalValue > 0 ? weightedRental / totalValue : 0;
    const avgApp = totalValue > 0 ? weightedApp / totalValue : 0;
    const avgTotal = totalValue > 0 ? weightedTotal / totalValue : 0;

    return { totalValue, avgRental, avgApp, avgTotal };
  });

  let optimizedProjection = $derived.by(() => {
    if (!optimizedStats) return [];
    const rY = store.portfolioTarget === 'app' ? 0 : optimizedStats.avgRental;
    const aY = store.portfolioTarget === 'rental' ? 0 : optimizedStats.avgApp;
    return project(optimizedStats.totalValue, rY, aY);
  });

  // Calculate Mathematical Risk Projections
  let riskData = $derived.by(() => {
    if (!portfolioStats) return null;
    
    const curHoldings = [];
    const optHoldings = [];
    const currMatrix = [];
    const optMatrix = [];



    for (const item of portfolioStats.items) {
       // Current
       const currY = store.portfolioTarget === 'app' ? item.yields.app : store.portfolioTarget === 'rental' ? item.yields.rental : item.yields.total;
       const currS = getSeries(item.metro, item.pt, store.portfolioTarget);
       curHoldings.push({ name: item.metro.regionName, pt: item.pt, yield: currY, risk: calculateVolatility(currS) });
       if (currS && currS.length >= 12) currMatrix.push(currS);

       // Optimized
       const opt = item.selectedOpt;
       if (opt) {
         const optY = store.portfolioTarget === 'app' ? opt.yields.app : store.portfolioTarget === 'rental' ? opt.yields.rental : opt.yields.total;
         const optS = getSeries(opt.metro, opt.pt, store.portfolioTarget);
         optHoldings.push({ name: opt.metro.regionName, pt: opt.pt, yield: optY, risk: calculateVolatility(optS) });
         if (optS && optS.length >= 12) optMatrix.push(optS);
       } else {
         optHoldings.push(curHoldings[curHoldings.length - 1]);
         if (currS && currS.length >= 12) optMatrix.push(currS);
       }
    }

    const currentCorr = calculatePortfolioCorrelation(currMatrix);
    const optimalCorr = calculatePortfolioCorrelation(optMatrix);



    const portfolioYields = {
      current: store.portfolioTarget === 'app' ? portfolioStats.avgApp : store.portfolioTarget === 'rental' ? portfolioStats.avgRental : portfolioStats.avgTotal,
      optimal: store.portfolioTarget === 'app' ? optimizedStats.avgApp : store.portfolioTarget === 'rental' ? optimizedStats.avgRental : optimizedStats.avgTotal,
    };

    const aggMetrics = {
      current: { name: 'Aggregate Portfolio', pt: 'AGG', yield: portfolioYields.current, risk: calculateVolatility(getAggSeries(currMatrix)) },
      optimal: { name: 'Optimized Portfolio', pt: 'AGG', yield: portfolioYields.optimal, risk: calculateVolatility(getAggSeries(optMatrix)) }
    };

    return { curHoldings, optHoldings, correlationData: { current: currentCorr, optimal: optimalCorr }, aggMetrics };
  });

  // Search
  let searchResults = $derived.by(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allMetros
      .filter(m => m.regionName.toLowerCase().includes(q) || m.stateName?.toLowerCase().includes(q))
      .filter(m => !portfolio.some(p => p.metro.regionId === m.regionId))
      .slice(0, 8);
  });

  function addToPortfolio(metro) {
    portfolio = [...portfolio, { metro, pt: propertyType, optIdx: { total: 0, rental: 0, app: 0 } }];
    searchQuery = '';
    showSearch = false;
  }

  function removeFromPortfolio(index) {
    portfolio = portfolio.filter((_, i) => i !== index);
  }

  function togglePt(index) {
    portfolio = portfolio.map((p, i) => i === index ? { ...p, pt: p.pt === 'sf' ? 'mf' : 'sf' } : p);
  }

  function selectOptimal(index, newIdx) {
    portfolio = portfolio.map((p, i) => i === index ? { ...p, optIdx: { ...p.optIdx, [store.portfolioTarget]: newIdx } } : p);
    activeOptDropdown = null;
  }

  // Chart
  function renderChart() {
    if (!chartCanvas || currentProjection.length === 0) return;
    if (chart) chart.destroy();

    const labels = currentProjection.map(r => r.year === 0 ? 'Now' : `Yr ${r.year}`);
    const baseValue = portfolioStats?.totalValue || 0;
    const currentData = currentProjection.map(r => baseValue + r.total);
    const optData = optimizedProjection.map(r => baseValue + r.total);

    chart = new Chart(chartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Current Portfolio',
            data: currentData,
            borderColor: 'rgba(108, 92, 231, 1)',
            backgroundColor: 'rgba(108, 92, 231, 0.1)',
            fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 4,
            pointBackgroundColor: 'rgba(108, 92, 231, 1)',
          },
          {
            label: 'Optimized Portfolio',
            data: optData,
            borderColor: 'rgba(0, 184, 148, 1)',
            backgroundColor: 'rgba(0, 184, 148, 0.1)',
            fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 4,
            pointBackgroundColor: 'rgba(0, 184, 148, 1)',
            borderDash: [6, 3],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#8b93a7', font: { family: "'Inter', sans-serif", size: 12 }, boxWidth: 14, padding: 16, usePointStyle: true } },
          tooltip: {
            backgroundColor: 'rgba(17,21,32,0.95)', titleColor: '#e8eaed', bodyColor: '#8b93a7',
            borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 8, padding: 12,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
          },
        },
        scales: {
          x: { ticks: { color: '#8892a8', font: { size: 12 } }, grid: { display: false }, border: { display: false } },
          y: { ticks: { color: '#8892a8', font: { size: 11 }, callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
        },
      },
    });
  }

  $effect(() => {
    if (chartCanvas && currentProjection.length > 0 && optimizedProjection.length > 0) {
      requestAnimationFrame(() => renderChart());
    }
  });

  onDestroy(() => { if (chart) chart.destroy(); });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="portfolio-view" id="portfolio-view" onclick={() => activeOptDropdown = null}>
  <!-- Chart -->
  <div class="portfolio-chart-area">
    <div class="section-header-flex">
      <h2 class="section-title">5-Year Portfolio Projection</h2>
      <div class="info-wrapper">
        <div class="info-icon">?</div>
        <div class="info-popup" style="width: 340px;">
          <strong>How it works:</strong> Forecasts your portfolio value by compounding historical appreciation and rental yield averages over 5 years.<br><br>
          <strong>Example:</strong> A $100k portfolio growing at 5% appreciation and 6% rental yield will mathematically project steady month over month growth to estimate total future equity.
        </div>
      </div>
    </div>
    <div class="chart-container"><canvas bind:this={chartCanvas}></canvas></div>
  </div>

  <!-- Summary Cards -->
  {#if portfolioStats && optimizedStats}
    <div class="summary-row">
      <div class="summary-card current">
        <div class="sc-badge">Current</div>
        <div class="sc-value">{fmt(portfolioStats.totalValue)}</div>
        <div class="sc-yields">
          {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'rental'}
            <div class="sc-yield"><span>Rental</span><span class="rental-c">{fmtPct(portfolioStats.avgRental)}</span></div>
          {/if}
          {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'app'}
            <div class="sc-yield"><span>Appreciation</span><span class="app-c">{fmtPct(portfolioStats.avgApp)}</span></div>
          {/if}
          {#if store.portfolioTarget === 'total'}
            <div class="sc-yield total"><span>Total</span><span class="total-c">{fmtPct(portfolioStats.avgTotal)}</span></div>
          {/if}
        </div>
        {#if currentProjection[5]}
          <div class="sc-5yr">
            <div class="sc-5yr-row">
              <span>5-Year Gain</span>
              <strong>+{fmt(currentProjection[5].total)}</strong>
            </div>
            <div class="sc-5yr-row total">
              <span>5-Year Total Value</span>
              <strong>{fmt(portfolioStats.totalValue + currentProjection[5].total)}</strong>
            </div>
          </div>
        {/if}
      </div>
      <div class="summary-card optimized">
        <div class="sc-badge opt">Optimized</div>
        <div class="sc-value">{fmt(optimizedStats.totalValue)}</div>
        <div class="sc-yields">
          {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'rental'}
            <div class="sc-yield"><span>Rental</span><span class="rental-c">{fmtPct(optimizedStats.avgRental)}</span></div>
          {/if}
          {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'app'}
            <div class="sc-yield"><span>Appreciation</span><span class="app-c">{fmtPct(optimizedStats.avgApp)}</span></div>
          {/if}
          {#if store.portfolioTarget === 'total'}
            <div class="sc-yield total"><span>Total</span><span class="total-c">{fmtPct(optimizedStats.avgTotal)}</span></div>
          {/if}
        </div>
        {#if optimizedProjection[5]}
          <div class="sc-5yr">
            <div class="sc-5yr-row">
              <span>5-Year Gain</span>
              <strong>+{fmt(optimizedProjection[5].total)}</strong>
            </div>
            <div class="sc-5yr-row total">
              <span>5-Year Total Value</span>
              <strong>{fmt(optimizedStats.totalValue + optimizedProjection[5].total)}</strong>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if riskData}
    <!-- Risk vs Return Analytics Module -->
    <RiskYieldChart 
      currentHoldings={riskData.curHoldings} 
      optimalHoldings={riskData.optHoldings} 
      correlationData={riskData.correlationData} 
      aggMetrics={riskData.aggMetrics}
      targetMode={store.portfolioTarget} 
    />
  {/if}

  <!-- Optimization Settings -->
  <div class="optimize-settings-box">
    <div class="os-header">
      <div class="section-header-flex">
        <h3 class="section-title">Optimization Settings</h3>
        <div class="info-wrapper">
          <div class="info-icon">?</div>
          <div class="info-popup" style="width: 380px;">
            <strong>Maximize Yield:</strong> Optimizes to maximize total yield without taking risk into account.<br>
            <span style="opacity: 0.8;"><em>Example:</em> Swaps a 4% yield property for an 8% yield property to reach the highest possible return.</span><br><br>
            
            <strong>Maximize Sharpe Ratio:</strong> Finds the mix of assets that delivers the highest return per unit of risk by combining them in a way that exploits their correlations to minimize overall volatility.<br>
            <span style="opacity: 0.8;"><em>Example:</em> By mixing properties that do not fluctuate at the same time, your overall portfolio value grows smoothly even if an individual property experiences a downturn.</span>
          </div>
        </div>
      </div>
      <span class="os-hint">Algorithms dynamically reroute suggested replacements based on the selected target</span>
    </div>
    <div class="os-controls">
      <div class="os-group">
        <span class="os-label">Optimize Objective</span>
        <select class="os-select" bind:value={optimizeObjective}>
          <option value="yield">Maximize Yield</option>
          <option value="sharpe">Maximize Sharpe Ratio (Correlation-Aware)</option>
        </select>
      </div>
      <div class="os-divider"></div>
      <div class="os-group">
        <span class="os-label">Max per state</span>
        <input type="number" class="os-input" bind:value={maxPerState} min="1" max="20" step="1" />
      </div>
      <div class="os-group">
        <span class="os-label">Max per metro</span>
        <input type="number" class="os-input" bind:value={maxPerMetro} min="1" max="10" step="1" />
      </div>
    </div>
  </div>

  <!-- Portfolio Table -->
  <div class="portfolio-table-section">
    <div class="table-header">
      <h3 class="section-title">Portfolio Holdings ({portfolio.length})</h3>
      <button class="add-btn" onclick={() => showSearch = !showSearch}>
        {showSearch ? '✕ Close' : '+ Add'}
      </button>
    </div>

    {#if showSearch}
      <div class="search-area">
        <input type="text" class="search-input" placeholder="Search metro areas..." bind:value={searchQuery} />
        {#if searchResults.length > 0}
          <div class="search-results">
            {#each searchResults as metro}
              <button class="search-result-item" onclick={() => addToPortfolio(metro)}>
                <span class="sri-name">{metro.regionName}</span>
                <span class="sri-state">{metro.stateName}</span>
                <span class="sri-yield">
                  {#if store.portfolioTarget === 'total'}
                    {fmtPct(getMetroYields(metro, propertyType).total)}
                  {:else if store.portfolioTarget === 'rental'}
                    {fmtPct(getMetroYields(metro, propertyType).rental)}
                  {:else}
                    {fmtPct(getMetroYields(metro, propertyType).app)}
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="portfolio-table-wrapper">
      <table class="portfolio-table">
        <thead>
          <tr>
            <th class="col-name">Location</th>
            <th>Type</th>
            <th>Value</th>
            {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'rental'}
              <th>Rental</th>
            {/if}
            {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'app'}
              <th>Appr.</th>
            {/if}
            {#if store.portfolioTarget === 'total'}
              <th>Total</th>
            {/if}
            <th class="col-opt">Optimal Replacement</th>
            <th class="col-opt-yield">
              {#if store.portfolioTarget === 'total'}
                Opt. Total
              {:else if store.portfolioTarget === 'rental'}
                Opt. Rental
              {:else}
                Opt. Appr.
              {/if}
            </th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {#if portfolioStats}
            {#each portfolioStats.items as item, i}
              <tr>
                <td class="col-name">
                  <div class="loc-cell">
                    <span class="loc-cell-name">{item.metro.regionName}</span>
                    <span class="loc-cell-state">{item.metro.stateName}</span>
                  </div>
                </td>
                <td>
                  <button class="pt-toggle" onclick={() => togglePt(i)}>
                    {ptLabel(item.pt)}
                  </button>
                </td>
                <td>{fmt(item.yields.value)}</td>
                {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'rental'}
                  <td class="rental-c">{fmtPct(item.yields.rental)}</td>
                {/if}
                {#if store.portfolioTarget === 'total' || store.portfolioTarget === 'app'}
                  <td class="app-c">{fmtPct(item.yields.app)}</td>
                {/if}
                {#if store.portfolioTarget === 'total'}
                  <td class="total-c bold">{fmtPct(item.yields.total)}</td>
                {/if}
                <td class="col-opt">
                  <div class="opt-selector" onclick={(e) => { e.stopPropagation(); activeOptDropdown = activeOptDropdown === i ? null : i; }}>
                    {#if item.selectedOpt}
                      <span class="opt-selected-name">{item.selectedOpt.metro.regionName} <span style="font-size: 0.85em; opacity: 0.7; margin-left: 4px;">({ptLabel(item.selectedOpt.pt)})</span></span>
                      <span class="opt-chevron">▾</span>
                    {:else}
                      <span class="opt-keep">— keep —</span>
                    {/if}
                  </div>
                  {#if activeOptDropdown === i}
                    <div class="opt-dropdown" onclick={(e) => e.stopPropagation()}>
                      <div class="opt-dropdown-header">Top 25 Replacements</div>
                      {#each item.opts as opt, oi}
                        <button
                          class="opt-dropdown-item"
                          class:selected={oi === (item.optIdx[store.portfolioTarget] || 0)}
                          onclick={() => selectOptimal(i, oi)}
                        >
                          <span class="odi-rank">#{oi + 1}</span>
                          <span class="odi-name">{opt.metro.regionName} <span style="font-size: 0.85em; opacity: 0.7; margin-left: 4px;">({ptLabel(opt.pt)})</span></span>
                          <span class="odi-state">{opt.metro.stateName}</span>
                          <span class="odi-yield">
                            {#if store.portfolioTarget === 'total'}
                              {fmtPct(opt.yields.total)}
                            {:else if store.portfolioTarget === 'rental'}
                              {fmtPct(opt.yields.rental)}
                            {:else}
                              {fmtPct(opt.yields.app)}
                            {/if}
                          </span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </td>
                <td class="col-opt-yield">
                  {#if item.selectedOpt}
                    <span class="bold" class:total-c={store.portfolioTarget === 'total'} class:rental-c={store.portfolioTarget === 'rental'} class:app-c={store.portfolioTarget === 'app'}>
                      {#if store.portfolioTarget === 'total'}
                        {fmtPct(item.selectedOpt.yields.total)}
                      {:else if store.portfolioTarget === 'rental'}
                        {fmtPct(item.selectedOpt.yields.rental)}
                      {:else}
                        {fmtPct(item.selectedOpt.yields.app)}
                      {/if}
                    </span>
                  {/if}
                </td>
                <td class="col-action">
                  <button class="remove-btn" onclick={() => removeFromPortfolio(i)}>✕</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .portfolio-view { flex: 1; display: flex; flex-direction: column; gap: 24px; padding: 24px 32px; overflow-y: auto; background: var(--bg-primary); }
  .section-title { font-size: var(--text-base); font-weight: 700; color: var(--text-heading); margin: 0; }

  .portfolio-chart-area { display: flex; flex-direction: column; gap: 12px; }
  .chart-container { height: 260px; background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 16px; }
  .chart-container canvas { width: 100% !important; height: 100% !important; }

  .summary-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .summary-card { background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px 20px; }
  .summary-card.current { border-left: 3px solid rgba(108,92,231,0.6); }
  .summary-card.optimized { border-left: 3px solid rgba(0,184,148,0.6); }
  .sc-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(108,92,231,1); margin-bottom: 4px; }
  .sc-badge.opt { color: rgba(0,184,148,1); }
  .sc-value { font-size: var(--text-xl); font-weight: 700; color: var(--text-heading); }
  .sc-yields { margin-top: 10px; display: flex; flex-direction: column; gap: 3px; }
  .sc-yield { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--text-secondary); }
  .sc-yield.total { font-weight: 600; padding-top: 3px; border-top: 1px solid var(--border-subtle); margin-top: 2px; }
  .sc-5yr { margin-top: 16px; padding: 12px 14px; background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 8px; }
  .sc-5yr-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-secondary); }
  .sc-5yr-row strong { color: var(--text-primary); font-weight: 600; font-size: var(--text-sm); }
  .sc-5yr-row.total { padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05); }
  .current .sc-5yr-row.total strong { color: rgba(108, 92, 231, 1); font-size: var(--text-base); font-weight: 700; }
  .optimized .sc-5yr-row.total strong { color: rgba(0, 184, 148, 1); font-size: var(--text-base); font-weight: 700; }

  .rental-c { color: var(--rental-color); }
  .app-c { color: var(--appreciation-color); }
  .total-c { color: var(--yield-high); }
  .bold { font-weight: 600; }

  /* Optimization Settings box */
  .optimize-settings-box { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
  .os-header { display: flex; align-items: baseline; gap: 12px; }
  .os-hint { font-size: 11px; color: var(--text-muted); font-style: italic; }
  .os-controls { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .os-group { display: flex; align-items: center; gap: 8px; }
  .os-divider { width: 1px; height: 24px; background: var(--border-subtle); }
  .os-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
  .os-input { width: 54px; padding: 6px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-medium); border-radius: var(--radius-sm); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; text-align: center; }
  .os-input:focus { outline: none; border-color: var(--accent-primary); }
  .os-select { padding: 6px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-medium); border-radius: var(--radius-sm); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; outline: none; }
  .os-select:hover { border-color: rgba(255,255,255,0.3); }
  .os-select:focus { border-color: var(--accent-primary); }

  /* Table section */
  .portfolio-table-section { display: flex; flex-direction: column; gap: 12px; }
  .table-header { display: flex; justify-content: space-between; align-items: center; }
  .add-btn { padding: 5px 14px; border: 1px solid var(--border-medium); background: var(--bg-tertiary); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 500; border-radius: var(--radius-full); cursor: pointer; transition: all 150ms; }
  .add-btn:hover { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

  .search-area { position: relative; }
  .search-input { width: 100%; padding: 10px 14px; background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); box-sizing: border-box; }
  .search-input:focus { outline: none; border-color: var(--accent-primary); }
  .search-results { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-md); margin-top: 4px; z-index: 200; max-height: 240px; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  .search-result-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 14px; border: none; background: transparent; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer; text-align: left; transition: background 100ms; }
  .search-result-item:hover { background: var(--bg-hover); }
  .sri-name { flex: 1; color: var(--text-primary); font-weight: 500; }
  .sri-state { font-size: var(--text-xs); color: var(--text-muted); }
  .sri-yield { font-weight: 600; color: var(--yield-high); font-size: var(--text-xs); }

  /* Portfolio table */
  .portfolio-table-wrapper { overflow-x: auto; }
  .portfolio-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); background: var(--bg-secondary); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-subtle); }
  .portfolio-table th { text-align: left; padding: 10px 12px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-subtle); background: var(--bg-tertiary); }
  .portfolio-table td { padding: 10px 12px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.03); font-size: var(--text-sm); vertical-align: middle; }
  .portfolio-table tbody tr:hover { background: var(--bg-hover); }

  .col-name { min-width: 140px; }
  .loc-cell { display: flex; flex-direction: column; gap: 1px; }
  .loc-cell-name { font-weight: 500; color: var(--text-primary); font-size: var(--text-sm); }
  .loc-cell-state { font-size: 10px; color: var(--text-muted); }

  /* PT toggle */
  .pt-toggle { padding: 2px 8px; border: 1px solid var(--border-medium); background: var(--bg-tertiary); color: var(--text-secondary); font-family: var(--font-sans); font-size: 10px; font-weight: 600; border-radius: var(--radius-full); cursor: pointer; transition: all 150ms; text-transform: uppercase; letter-spacing: 0.04em; }
  .pt-toggle:hover { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }

  /* Optimal selector */
  .col-opt { min-width: 180px; position: relative; }
  .opt-selector { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 150ms; min-width: 140px; }
  .opt-selector:hover { border-color: var(--accent-primary); }
  .opt-selected-name { font-size: var(--text-xs); color: var(--text-primary); font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opt-chevron { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
  .opt-keep { font-size: var(--text-xs); color: var(--text-muted); font-style: italic; }

  /* Dropdown */
  .opt-dropdown { position: absolute; top: 100%; left: 0; width: 320px; background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-md); margin-top: 4px; z-index: 300; max-height: 320px; overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  .opt-dropdown-header { padding: 8px 12px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-subtle); background: var(--bg-tertiary); position: sticky; top: 0; }
  .opt-dropdown-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 7px 12px; border: none; background: transparent; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; text-align: left; transition: background 100ms; }
  .opt-dropdown-item:hover { background: var(--bg-hover); }
  .opt-dropdown-item.selected { background: rgba(0,184,148,0.08); }
  .odi-rank { font-weight: 600; color: var(--text-muted); min-width: 24px; }
  .odi-name { flex: 1; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .odi-state { font-size: 10px; color: var(--text-muted); min-width: 30px; }
  .odi-yield { font-weight: 600; color: var(--yield-high); min-width: 50px; text-align: right; }

  .col-opt-yield { min-width: 70px; }
  .col-action { width: 32px; text-align: center; }
  .remove-btn { width: 24px; height: 24px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 12px; border-radius: var(--radius-sm); transition: all 150ms; display: inline-flex; align-items: center; justify-content: center; }
  .remove-btn:hover { background: rgba(225,112,85,0.15); color: var(--yield-low); }

  /* Info Tooltips */
  .section-header-flex { display: flex; align-items: center; justify-content: flex-start; }
  .info-wrapper { position: relative; display: inline-flex; align-items: center; margin-left: 8px; }
  .info-icon { width: 15px; height: 15px; border-radius: 50%; background: var(--bg-tertiary); border: 1px solid var(--border-medium); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--text-muted); cursor: help; transition: all 150ms; }
  .info-wrapper:hover .info-icon { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
  .info-popup { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; width: 320px; padding: 14px; background: rgba(17,21,32,0.98); border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-md); font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; box-shadow: 0 8px 32px rgba(0,0,0,0.6); opacity: 0; visibility: hidden; transition: all 200ms; z-index: 1000; pointer-events: none; text-transform: none; letter-spacing: normal; font-weight: 400; text-align: left; }
  .info-wrapper:hover .info-popup { opacity: 1; visibility: visible; }
  .info-popup strong { color: var(--text-primary); font-weight: 700; }
  .info-popup::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-width: 6px; border-style: solid; border-color: rgba(255,255,255,0.15) transparent transparent transparent; }
</style>

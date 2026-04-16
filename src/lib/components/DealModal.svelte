<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { formatYield, formatCurrency, getYieldValue } from '../data/dataLoader.js';
  import { store } from '../stores/appState.svelte.js';

  Chart.register(...registerables);

  let {
    startMetro,
    endMetro,
    startPropertyType = 'sf',
    endPropertyType = 'sf',
    onClose = () => {},
  } = $props();

  // Tab + view toggles
  let activeTab = $state('overview');
  let overviewView = $state('table');
  let keepView = $state('table');
  let switchView = $state('table');

  // Transaction costs (separate per scenario)
  let closingCostPct = $state(2);
  let agentCommissionPct = $state(6);
  let keepTxEnabled = $state(false);
  let switchTxEnabled = $state(true);

  // Helpers
  function pt(metro, type) { return metro?.[type] || {}; }
  function fmt(v) { return formatCurrency(v); }
  function fmtPct(v) { return v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—'; }

  // Data
  let startData = $derived(pt(startMetro, startPropertyType));
  let endData = $derived(pt(endMetro, endPropertyType));
  let startValue = $derived(startData.currentValue);
  let endValue = $derived(endData.currentValue);

  let startRentalYield = $derived(startData.currentRentalYield ?? 0);
  let startAppYield = $derived(startData.currentAppreciationYield ?? 0);
  let startTotalYield = $derived(startData.currentTotalYield ?? startRentalYield);

  let endRentalYield = $derived(endData.currentRentalYield ?? 0);
  let endAppYield = $derived(endData.currentAppreciationYield ?? 0);
  let endTotalYield = $derived(endData.currentTotalYield ?? endRentalYield);

  // TX costs computed
  let txRate = $derived(closingCostPct + agentCommissionPct);
  let sellCosts = $derived(startValue ? startValue * txRate / 100 : 0);
  let buyCosts = $derived(endValue ? endValue * closingCostPct / 100 : 0);
  let totalTransactionCosts = $derived(sellCosts + buyCosts);

  let keepTxCost = $derived(keepTxEnabled ? startValue * (closingCostPct + agentCommissionPct) / 100 : 0);
  let switchSellCost = $derived(switchTxEnabled ? sellCosts : 0);
  let switchBuyCost = $derived(switchTxEnabled ? buyCosts : 0);
  let switchTxCost = $derived(switchSellCost + switchBuyCost);

  // Maintenance
  let overviewMaintenancePct = $state(1.0);
  let keepMaintenancePct = $state(1.0);
  let switchMaintenancePct = $state(1.0);

  // --- Projection helper ---
  function project5Years(initialValue, rentalYield, appYield, txCost, maintPct) {
    const rows = [];
    let val = initialValue;
    let cumRent = 0, cumApp = 0, cumMaint = 0;
    for (let yr = 0; yr <= 5; yr++) {
      if (yr === 0) {
        rows.push({ year: yr, propertyValue: val, annualRent: 0, appreciation: 0, maintenance: 0, cumRent: 0, cumApp: 0, cumMaint: 0, totalReturn: -txCost });
      } else {
        const rent = val * rentalYield / 100;
        const app = val * appYield / 100;
        const maint = val * maintPct / 100;
        val += app;
        cumRent += rent;
        cumApp += app;
        cumMaint += maint;
        rows.push({ year: yr, propertyValue: val, annualRent: rent, appreciation: app, maintenance: maint, cumRent, cumApp, cumMaint, totalReturn: cumRent + cumApp - cumMaint - txCost });
      }
    }
    return rows;
  }

  let overviewProjection = $derived.by(() => {
    if (!endValue) return [];
    return project5Years(endValue, endRentalYield, endAppYield, 0, overviewMaintenancePct);
  });
  let overviewY5 = $derived(overviewProjection[5] ?? null);

  // --- Tab 2: Keep vs Switch projections ---
  // Both start with same capital (startValue). TX costs deducted at end.
  let keepProjection = $derived.by(() => {
    if (!startValue) return [];
    return project5Years(startValue, startRentalYield, startAppYield, 0, keepMaintenancePct);
  });

  let switchProjection = $derived.by(() => {
    if (!startValue) return [];
    return project5Years(startValue, endRentalYield, endAppYield, 0, switchMaintenancePct);
  });

  let keepY5 = $derived(keepProjection[5] ?? null);
  let switchY5 = $derived(switchProjection[5] ?? null);

  // Normalized per $100 invested (rental and appreciation are gross, then deduct TX)
  function per100(totalGain, base) { return base ? totalGain / base * 100 : 0; }

  let keepRentalPer100 = $derived(per100(keepY5?.cumRent ?? 0, startValue));
  let keepAppPer100 = $derived(per100(keepY5?.cumApp ?? 0, startValue));
  let keepMaintPer100 = $derived(per100(keepY5?.cumMaint ?? 0, startValue));
  let keepTxPer100 = $derived(per100(keepTxCost, startValue));
  let keepNetPer100 = $derived(keepRentalPer100 + keepAppPer100 - keepMaintPer100 - keepTxPer100);

  let switchRentalPer100 = $derived(per100(switchY5?.cumRent ?? 0, startValue));
  let switchAppPer100 = $derived(per100(switchY5?.cumApp ?? 0, startValue));
  let switchMaintPer100 = $derived(per100(switchY5?.cumMaint ?? 0, startValue));
  let switchTxPer100 = $derived(per100(switchTxCost, startValue));
  let switchNetPer100 = $derived(switchRentalPer100 + switchAppPer100 - switchMaintPer100 - switchTxPer100);

  let advRental = $derived(switchRentalPer100 - keepRentalPer100);
  let advApp = $derived(switchAppPer100 - keepAppPer100);
  let advTx = $derived(keepTxPer100 - switchTxPer100); // positive = switch has lower costs
  let advTotal = $derived(switchNetPer100 - keepNetPer100);

  // Data date
  let dataDate = $derived.by(() => {
    const series = endData.rentalYieldSeries;
    if (series?.dates?.length) {
      const raw = series.dates[series.dates.length - 1];
      const [y, m] = raw.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(m) - 1]} ${y}`;
    }
    return null;
  });

  // --- Chart rendering ---
  let overviewCanvas;
  let keepCanvas;
  let switchCanvas;
  let charts = {};

  function destroyChart(name) {
    if (charts[name]) { charts[name].destroy(); delete charts[name]; }
  }

  function renderChart(canvas, name, data, label, color) {
    if (!canvas) return;
    destroyChart(name);
    const years = data.filter(r => r.year > 0).map(r => `Yr ${r.year}`);
    const rental = data.filter(r => r.year > 0).map(r => r.cumRent);
    const appreciation = data.filter(r => r.year > 0).map(r => r.cumApp);

    const ctx = canvas.getContext('2d');
    charts[name] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'Rental', data: [...rental], backgroundColor: 'rgba(108, 92, 231, 0.6)', borderRadius: 3 },
          { label: 'Appreciation', data: [...appreciation], backgroundColor: 'rgba(0, 206, 201, 0.6)', borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#8b93a7', font: { family: "'Inter', sans-serif", size: 11 }, boxWidth: 12, padding: 12 } },
          tooltip: {
            backgroundColor: 'rgba(17, 21, 32, 0.95)', titleColor: '#e8eaed', bodyColor: '#8b93a7',
            borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, cornerRadius: 8, padding: 10,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
          },
        },
        scales: {
          x: { stacked: true, ticks: { color: '#8892a8', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
          y: { stacked: true, ticks: { color: '#8892a8', font: { size: 10 }, callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
        },
      },
    });
  }

  $effect(() => {
    if (activeTab === 'overview' && overviewView === 'chart' && overviewCanvas) {
      requestAnimationFrame(() => renderChart(overviewCanvas, 'overview', overviewProjection, 'End', '#00b894'));
    }
  });

  $effect(() => {
    if (activeTab === 'compare' && keepView === 'chart') {
      requestAnimationFrame(() => {
        if (keepCanvas) renderChart(keepCanvas, 'keep', keepProjection, 'Keep', '#6c5ce7');
      });
    }
  });

  $effect(() => {
    if (activeTab === 'compare' && switchView === 'chart') {
      requestAnimationFrame(() => {
        if (switchCanvas) renderChart(switchCanvas, 'switch', switchProjection, 'Switch', '#00b894');
      });
    }
  });

  onDestroy(() => {
    Object.keys(charts).forEach(k => charts[k]?.destroy());
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onClose}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h2 class="modal-title">Deal Economics</h2>
        {#if dataDate}<div class="modal-date">Data as of {dataDate}</div>{/if}
      </div>
      <button class="modal-close" onclick={onClose}>✕</button>
    </div>

    <div class="modal-tabs">
      <button class="tab-btn" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>Overview</button>
      <button class="tab-btn" class:active={activeTab === 'compare'} onclick={() => activeTab = 'compare'}>Keep vs Switch</button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'overview'}
        <!-- ===== TAB 1: OVERVIEW ===== -->
        <div class="compare-section">
          <div class="location-card">
            <div class="loc-badge sell">Sell</div>
            <div class="loc-name">{startMetro.regionName}</div>
            <div class="loc-meta">{startMetro.stateName} • {startPropertyType === 'sf' ? 'SF' : 'MF'}</div>
            <div class="loc-value">{fmt(startValue)}</div>
            <div class="loc-yields">
              <div class="yield-line"><span class="yield-label">Rental</span><span class="yield-val">{fmtPct(startRentalYield)}</span></div>
              <div class="yield-line"><span class="yield-label">Appreciation</span><span class="yield-val">{fmtPct(startAppYield)}</span></div>
              <div class="yield-line total"><span class="yield-label">Total</span><span class="yield-val">{fmtPct(startTotalYield)}</span></div>
            </div>
          </div>
          <div class="compare-arrow">→</div>
          <div class="location-card">
            <div class="loc-badge buy">Buy</div>
            <div class="loc-name">{endMetro.regionName}</div>
            <div class="loc-meta">{endMetro.stateName} • {endPropertyType === 'sf' ? 'SF' : 'MF'}</div>
            <div class="loc-value">{fmt(endValue)}</div>
            <div class="loc-yields">
              <div class="yield-line"><span class="yield-label">Rental</span><span class="yield-val">{fmtPct(endRentalYield)}</span></div>
              <div class="yield-line"><span class="yield-label">Appreciation</span><span class="yield-val">{fmtPct(endAppYield)}</span></div>
              <div class="yield-line total"><span class="yield-label">Total</span><span class="yield-val">{fmtPct(endTotalYield)}</span></div>
            </div>
          </div>
        </div>

        <!-- Costs Config -->
        <div class="costs-stack" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="section cost-section">
            <h3 class="section-title">Transaction Costs</h3>
            <div class="cost-grid" style="grid-template-columns: 1fr 1fr; width: 100%;">
              <div class="cost-input-group">
                <div class="cost-label">Closing Costs</div>
                <div class="cost-input-row"><input type="number" class="cost-input" bind:value={closingCostPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
              </div>
              <div class="cost-input-group">
                <div class="cost-label">Agent Commission</div>
                <div class="cost-input-row"><input type="number" class="cost-input" bind:value={agentCommissionPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
              </div>
            </div>
            <div class="cost-summary">
              <div class="cost-line"><span>Closing costs ({closingCostPct}%)</span><span class="cost-val negative">{fmt(buyCosts)}</span></div>
              <div class="cost-line"><span>Agent commission ({agentCommissionPct}%)</span><span class="cost-val negative">{fmt(startValue * agentCommissionPct / 100)}</span></div>
              <div class="cost-line total-line"><span>Total</span><span class="cost-val negative">{fmt(totalTransactionCosts)}</span></div>
            </div>
          </div>
          
          <div class="section cost-section">
            <h3 class="section-title">Maintenance Costs</h3>
            <div class="cost-grid" style="grid-template-columns: 1fr 1fr; width: 100%;">
              <div class="cost-input-group">
                <div class="cost-label">Yearly Maintenance</div>
                <div class="cost-input-row"><input type="number" class="cost-input" bind:value={overviewMaintenancePct} min="0" max="10" step="0.1" /><span class="cost-unit">%/yr</span></div>
              </div>
            </div>
            <div class="cost-summary">
              <div class="cost-line"><span>Deducted linearly from yearly projections (Start & End)</span></div>
            </div>
          </div>
        </div>

        <!-- 5-Year Projection -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">5-Year Projection — {endMetro.regionName}</h3>
            <div class="view-toggle">
              <button class="vt-btn" class:active={overviewView === 'table'} onclick={() => overviewView = 'table'}>Table</button>
              <button class="vt-btn" class:active={overviewView === 'chart'} onclick={() => overviewView = 'chart'}>Chart</button>
            </div>
          </div>

          {#if overviewView === 'table'}
            <div class="projection-table-wrapper">
              <table class="projection-table">
                <thead><tr><th>Year</th><th>Property Value</th><th>Annual Rent</th><th>Appreciation</th><th>Maintenance</th><th>Total Return</th></tr></thead>
                <tbody>
                  {#each overviewProjection as row}
                    <tr class:year-zero={row.year === 0} class:year-five={row.year === 5}>
                      <td class="yr">{row.year === 0 ? 'Start' : `Yr ${row.year}`}</td>
                      <td>{fmt(row.propertyValue)}</td>
                      <td>{row.year === 0 ? '—' : fmt(row.annualRent)}</td>
                      <td>{row.year === 0 ? '—' : fmt(row.appreciation)}</td>
                      <td class="tx-c">{row.year === 0 ? '—' : `-${fmt(row.maintenance)}`}</td>
                      <td class="total-col">{row.year === 0 ? '—' : fmt(row.totalReturn)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="chart-area"><canvas bind:this={overviewCanvas}></canvas></div>
          {/if}

          {#if overviewY5}
            <div class="highlights">
              <div class="highlight-card rental"><div class="hl-label">Cumulative Rental</div><div class="hl-value">{fmt(overviewY5.cumRent)}</div></div>
              <div class="highlight-card appreciation"><div class="hl-label">Cumulative Appreciation</div><div class="hl-value">{fmt(overviewY5.cumApp)}</div></div>
              <div class="highlight-card total-card" style="background: rgba(253, 203, 110, 0.08); border-color: rgba(253, 203, 110, 0.2);">
                <div class="hl-label" style="font-size: 11px;">Gross 5-Year Return</div>
                <div class="hl-value net-big" style="color: rgba(253, 203, 110, 1);">{fmt(overviewY5.cumRent + overviewY5.cumApp)}</div>
                <div class="hl-sub" style="margin-top: 8px;">Before maintenance & transaction costs</div>
              </div>
              <div class="highlight-card total-card">
                <div class="hl-label" style="font-size: 11px;">Net 5-Year Return</div>
                <div class="hl-value net-big">{fmt(overviewY5.totalReturn - totalTransactionCosts)}</div>
                <div class="hl-sub" style="margin-top: 8px;">After all transaction & maintenance costs</div>
              </div>
            </div>
          {/if}
        </div>

      {:else}
        <!-- ===== TAB 2: KEEP vs SWITCH ===== -->
        <p class="tab-intro">Normalized to starting capital of <strong>{fmt(startValue)}</strong>.</p>

        <div class="compare-scenarios">
          <!-- KEEP -->
          <div class="scenario-card">
            <div class="scenario-header keep">
              <h4 class="scenario-title">Keep</h4>
              <span class="scenario-location">{startMetro.regionName}</span>
            </div>

            <!-- TX costs -->
            <div class="tx-toggle-row">
              <span class="tx-toggle-label">Transaction Costs</span>
              <button class="pill-toggle" class:on={keepTxEnabled} onclick={() => keepTxEnabled = !keepTxEnabled}>
                <span class="pill-knob"></span>
              </button>
            </div>
            <div class="tx-settings" class:collapsed={!keepTxEnabled} style={!keepTxEnabled ? "opacity: 0.35;" : ""}>
              <div class="tx-cost-grid">
                <div class="tx-cost-group">
                  <div class="tx-cost-label">Closing</div>
                  <div class="tx-inp-row"><input type="number" class="cost-input sm" bind:value={closingCostPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
                </div>
                <div class="tx-cost-group">
                  <div class="tx-cost-label">Agent</div>
                  <div class="tx-inp-row"><input type="number" class="cost-input sm" bind:value={agentCommissionPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
                </div>
              </div>
              <div class="tx-summary">
                <div class="tx-sum-line"><span>Closing costs ({closingCostPct}%)</span><span class="tx-sum-val">{fmt(startValue * closingCostPct / 100)}</span></div>
                <div class="tx-sum-line"><span>Agent commission ({agentCommissionPct}%)</span><span class="tx-sum-val">{fmt(startValue * agentCommissionPct / 100)}</span></div>
                <div class="tx-sum-line tx-sum-total"><span>Total</span><span class="tx-sum-val">{fmt(keepTxCost)}</span></div>
              </div>
            </div>
            <div class="tx-toggle-row" style="background: rgba(0,0,0,0.04); justify-content: flex-start; gap: 12px; border-top: 1px solid var(--border-subtle);">
              <span class="tx-toggle-label">Maintenance</span>
              <div class="tx-inp-row" style="flex:1;"><input type="number" class="cost-input sm" bind:value={keepMaintenancePct} min="0" max="10" step="0.1" /><span class="cost-unit">%/yr</span></div>
            </div>

            <div class="scenario-yields">
              <div class="sy-line"><span>Rental</span><span>{fmtPct(startRentalYield)}</span></div>
              <div class="sy-line"><span>Appreciation</span><span>{fmtPct(startAppYield)}</span></div>
              <div class="sy-line bold"><span>Total</span><span>{fmtPct(startTotalYield)}</span></div>
            </div>

            <div class="scenario-proj-header">
              <span class="scenario-proj-title">5-Year Projection</span>
              <div class="view-toggle">
                <button class="vt-btn" class:active={keepView === 'table'} onclick={() => keepView = 'table'}>Table</button>
                <button class="vt-btn" class:active={keepView === 'chart'} onclick={() => keepView = 'chart'}>Chart</button>
              </div>
            </div>

            {#if keepView === 'table'}
              <table class="scenario-table">
                <thead><tr><th>Yr</th><th>Value</th><th>Rent</th><th>Maint</th><th>Gain</th></tr></thead>
                <tbody>
                  {#each keepProjection as row}
                    <tr class:year-zero={row.year === 0} class:year-five={row.year === 5}>
                      <td class="yr">{row.year === 0 ? 'Start' : row.year}</td><td>{fmt(row.propertyValue)}</td><td>{row.year === 0 ? '—' : fmt(row.annualRent)}</td><td class="tx-c">{row.year === 0 ? '—' : `-${fmt(row.maintenance)}`}</td><td class="total-col">{row.year === 0 ? '—' : fmt(row.totalReturn)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <div class="chart-area-sm"><canvas bind:this={keepCanvas}></canvas></div>
            {/if}

            {#if keepY5}
              <div class="scenario-result">
                <div class="sr-row"><span class="sr-label">Rental / $100 / 5yr</span><span class="sr-val rental-c">${keepRentalPer100.toFixed(2)}</span></div>
                <div class="sr-row"><span class="sr-label">Appreciation / $100 / 5yr</span><span class="sr-val app-c">${keepAppPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-total" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; border-top: none;"><span class="sr-label">Gross Total / $100 / 5yr</span><span class="sr-val" style="color: rgba(253, 203, 110, 1);">${(keepRentalPer100 + keepAppPer100).toFixed(2)}</span></div>
                
                <div class="sr-row sr-deduction" style="margin-top: 4px;"><span class="sr-label">Maintenance / $100 / 5yr</span><span class="sr-val tx-c">-${keepMaintPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-deduction" class:disabled={!keepTxEnabled}><span class="sr-label">Transaction Costs / $100</span><span class="sr-val tx-c">-${keepTxPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-total"><span class="sr-label">Net Total / $100 / 5yr</span><span class="sr-val total-c">${keepNetPer100.toFixed(2)}</span></div>
              </div>
            {/if}
          </div>

          <!-- SWITCH -->
          <div class="scenario-card">
            <div class="scenario-header switch-h">
              <h4 class="scenario-title">Switch</h4>
              <span class="scenario-location">{endMetro.regionName}</span>
            </div>

            <!-- TX costs -->
            <div class="tx-toggle-row">
              <span class="tx-toggle-label">Transaction Costs</span>
              <button class="pill-toggle" class:on={switchTxEnabled} onclick={() => switchTxEnabled = !switchTxEnabled}>
                <span class="pill-knob"></span>
              </button>
            </div>
            <div class="tx-settings" class:collapsed={!switchTxEnabled} style={!switchTxEnabled ? "opacity: 0.35;" : ""}>
              <div class="tx-cost-grid">
                <div class="tx-cost-group">
                  <div class="tx-cost-label">Closing</div>
                  <div class="tx-inp-row"><input type="number" class="cost-input sm" bind:value={closingCostPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
                </div>
                <div class="tx-cost-group">
                  <div class="tx-cost-label">Agent</div>
                  <div class="tx-inp-row"><input type="number" class="cost-input sm" bind:value={agentCommissionPct} min="0" max="20" step="0.5" /><span class="cost-unit">%</span></div>
                </div>
              </div>
              <div class="tx-summary">
                <div class="tx-sum-line"><span>Closing costs ({closingCostPct}%)</span><span class="tx-sum-val">{fmt(switchBuyCost)}</span></div>
                <div class="tx-sum-line"><span>Agent commission ({agentCommissionPct}%)</span><span class="tx-sum-val">{fmt(startValue * agentCommissionPct / 100)}</span></div>
                <div class="tx-sum-line tx-sum-total"><span>Total</span><span class="tx-sum-val">{fmt(switchTxCost)}</span></div>
              </div>
            </div>
            <div class="tx-toggle-row" style="background: rgba(0,0,0,0.04); justify-content: flex-start; gap: 12px; border-top: 1px solid var(--border-subtle);">
              <span class="tx-toggle-label">Maintenance</span>
              <div class="tx-inp-row" style="flex:1;"><input type="number" class="cost-input sm" bind:value={switchMaintenancePct} min="0" max="10" step="0.1" /><span class="cost-unit">%/yr</span></div>
            </div>

            <div class="scenario-yields">
              <div class="sy-line"><span>Rental</span><span>{fmtPct(endRentalYield)}</span></div>
              <div class="sy-line"><span>Appreciation</span><span>{fmtPct(endAppYield)}</span></div>
              <div class="sy-line bold"><span>Total</span><span>{fmtPct(endTotalYield)}</span></div>
            </div>

            <div class="scenario-proj-header">
              <span class="scenario-proj-title">5-Year Projection</span>
              <div class="view-toggle">
                <button class="vt-btn" class:active={switchView === 'table'} onclick={() => switchView = 'table'}>Table</button>
                <button class="vt-btn" class:active={switchView === 'chart'} onclick={() => switchView = 'chart'}>Chart</button>
              </div>
            </div>

            {#if switchView === 'table'}
              <table class="scenario-table">
                <thead><tr><th>Yr</th><th>Value</th><th>Rent</th><th>Maint</th><th>Gain</th></tr></thead>
                <tbody>
                  {#each switchProjection as row}
                    <tr class:year-zero={row.year === 0} class:year-five={row.year === 5}>
                      <td class="yr">{row.year === 0 ? 'Start' : row.year}</td><td>{fmt(row.propertyValue)}</td><td>{row.year === 0 ? '—' : fmt(row.annualRent)}</td><td class="tx-c">{row.year === 0 ? '—' : `-${fmt(row.maintenance)}`}</td><td class="total-col">{row.year === 0 ? '—' : fmt(row.totalReturn)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <div class="chart-area-sm"><canvas bind:this={switchCanvas}></canvas></div>
            {/if}

            {#if switchY5}
              <div class="scenario-result">
                <div class="sr-row"><span class="sr-label">Rental / $100 / 5yr</span><span class="sr-val rental-c">${switchRentalPer100.toFixed(2)}</span></div>
                <div class="sr-row"><span class="sr-label">Appreciation / $100 / 5yr</span><span class="sr-val app-c">${switchAppPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-total" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; border-top: none;"><span class="sr-label">Gross Total / $100 / 5yr</span><span class="sr-val" style="color: rgba(253, 203, 110, 1);">${(switchRentalPer100 + switchAppPer100).toFixed(2)}</span></div>

                <div class="sr-row sr-deduction" style="margin-top: 4px;"><span class="sr-label">Maintenance / $100 / 5yr</span><span class="sr-val tx-c">-${switchMaintPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-deduction" class:disabled={!switchTxEnabled}><span class="sr-label">Transaction Costs / $100</span><span class="sr-val tx-c">-${switchTxPer100.toFixed(2)}</span></div>
                <div class="sr-row sr-total"><span class="sr-label">Net Total / $100 / 5yr</span><span class="sr-val total-c">${switchNetPer100.toFixed(2)}</span></div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Advantage Summary -->
        <div class="advantage-grid">
          <div class="adv-card" class:positive={advRental > 0} class:negative={advRental < 0}>
            <div class="adv-label">Rental Advantage</div>
            <div class="adv-value">{advRental >= 0 ? '+' : ''}{advRental.toFixed(2)}</div>
            <div class="adv-unit">per $100 / 5yr</div>
          </div>
          <div class="adv-card" class:positive={advApp > 0} class:negative={advApp < 0}>
            <div class="adv-label">Appreciation Advantage</div>
            <div class="adv-value">{advApp >= 0 ? '+' : ''}{advApp.toFixed(2)}</div>
            <div class="adv-unit">per $100 / 5yr</div>
          </div>
          <div class="adv-card total-adv" style="background: rgba(253, 203, 110, 0.06); border-color: rgba(253, 203, 110, 0.2);">
            <div class="adv-label">Gross Advantage</div>
            <div class="adv-value" style="color: rgba(253, 203, 110, 1);">{advRental + advApp >= 0 ? '+' : ''}{(advRental + advApp).toFixed(2)}</div>
            <div class="adv-unit">per $100 / 5yr</div>
          </div>
          <div class="adv-card total-adv" class:positive={advTotal > 0} class:negative={advTotal < 0}>
            <div class="adv-label">Total Advantage (Net of Costs)</div>
            <div class="adv-value">{advTotal >= 0 ? '+' : ''}{advTotal.toFixed(2)}</div>
            <div class="adv-unit">per $100 / 5yr</div>
            <div class="adv-desc">
              {#if advTotal > 0}Switching yields <strong>${advTotal.toFixed(2)} more</strong> per $100 invested.
              {:else if advTotal < 0}Keeping yields <strong>${Math.abs(advTotal).toFixed(2)} more</strong> per $100 invested.
              {:else}Both options produce equivalent returns.{/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; animation: fadeIn 200ms ease; padding: 24px; }
  .modal-content { background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); box-shadow: 0 16px 64px rgba(0,0,0,0.5); max-width: 800px; width: 100%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; flex-shrink: 0; }
  .modal-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-heading); }
  .modal-date { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
  .modal-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: var(--bg-tertiary); color: var(--text-secondary); border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; transition: all 150ms; }
  .modal-close:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }

  .modal-tabs { display: flex; padding: 0 24px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
  .tab-btn { padding: 10px 20px; border: none; background: transparent; color: var(--text-muted); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 150ms; margin-bottom: -1px; }
  .tab-btn:hover { color: var(--text-primary); }
  .tab-btn.active { color: var(--text-heading); border-bottom-color: var(--accent-primary); font-weight: 600; }

  .modal-body { padding: 20px 24px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
  .tab-intro { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6; margin: 0; }
  .tab-intro strong { color: var(--text-primary); }

  .compare-section { display: flex; align-items: stretch; gap: 12px; }
  .location-card { flex: 1; padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); }
  .loc-badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: var(--radius-full); margin-bottom: 8px; }
  .loc-badge.sell { background: rgba(225,112,85,0.15); color: var(--yield-low); }
  .loc-badge.buy { background: rgba(0,184,148,0.15); color: var(--yield-high); }
  .loc-name { font-size: var(--text-base); font-weight: 600; color: var(--text-heading); }
  .loc-meta { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
  .loc-value { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin-top: 10px; }
  .loc-yields { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .yield-line { display: flex; justify-content: space-between; font-size: var(--text-sm); }
  .yield-label { color: var(--text-muted); }
  .yield-val { font-weight: 500; color: var(--text-primary); }
  .yield-line.total { padding-top: 4px; border-top: 1px solid var(--border-subtle); font-weight: 600; }
  .compare-arrow { display: flex; align-items: center; font-size: 20px; color: var(--text-muted); flex-shrink: 0; }

  .section { display: flex; flex-direction: column; gap: 12px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; }
  .section-title { font-size: var(--text-base); font-weight: 700; color: var(--text-heading); margin: 0; }
  .section-desc { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; margin-top: -8px; }

  /* View toggle (Table / Chart) */
  .view-toggle { display: flex; background: var(--bg-tertiary); border-radius: var(--radius-full); padding: 2px; border: 1px solid var(--border-subtle); }
  .vt-btn { padding: 4px 14px; border: none; background: transparent; color: var(--text-muted); font-family: var(--font-sans); font-size: 11px; font-weight: 500; cursor: pointer; border-radius: var(--radius-full); transition: all 150ms; }
  .vt-btn.active { background: var(--accent-primary); color: white; }

  .cost-grid { display: flex; gap: 16px; }
  .cost-input-group { flex: 1; }
  .cost-label { display: block; font-size: var(--text-xs); font-weight: 500; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .cost-input-row { display: flex; align-items: center; gap: 4px; }
  .cost-input { width: 72px; padding: 6px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-medium); border-radius: var(--radius-sm); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; }
  .cost-input:focus { outline: none; border-color: var(--accent-primary); }
  .cost-unit { font-size: var(--text-sm); color: var(--text-muted); }
  .cost-summary { display: flex; flex-direction: column; gap: 6px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm); }
  .cost-line { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--text-secondary); }
  .cost-line.total-line { padding-top: 8px; border-top: 1px solid var(--border-subtle); font-weight: 600; color: var(--text-primary); }
  .cost-val.negative { color: var(--yield-low); }

  .projection-table-wrapper { overflow-x: auto; }
  .projection-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  .projection-table th { text-align: left; padding: 8px 10px; font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-subtle); }
  .projection-table td { padding: 8px 10px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.03); }
  .projection-table .yr { font-weight: 600; color: var(--text-primary); white-space: nowrap; }
  .projection-table .total-col { font-weight: 600; color: var(--yield-high); }
  .projection-table .year-zero td { color: var(--text-muted); }
  .projection-table .year-five td { background: rgba(0,184,148,0.04); }

  .chart-area { height: 220px; width: 100%; }
  .chart-area canvas { width: 100% !important; height: 100% !important; }
  .chart-area-sm { height: 180px; width: 100%; padding: 8px 12px; }
  .chart-area-sm canvas { width: 100% !important; height: 100% !important; }

  .highlights { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .highlight-card { padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); }
  .highlight-card.rental { background: rgba(108,92,231,0.08); border-color: rgba(108,92,231,0.2); }
  .highlight-card.appreciation { background: rgba(0,206,201,0.08); border-color: rgba(0,206,201,0.2); }
  .highlight-card.total-card { background: rgba(0,184,148,0.08); border-color: rgba(0,184,148,0.2); }
  .hl-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .hl-value { font-size: var(--text-xl); font-weight: 700; margin-top: 4px; }
  .highlight-card.rental .hl-value { color: var(--rental-color); }
  .highlight-card.appreciation .hl-value { color: var(--appreciation-color); }
  .highlight-card.total-card .hl-value { color: var(--yield-high); }
  .highlight-card.total-card .net-big { font-size: 32px; font-weight: 800; margin-top: 6px; letter-spacing: -0.02em; color: var(--yield-high); }
  .hl-sub { font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px; }

  /* ===== Tab 2 ===== */
  .compare-scenarios { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .scenario-card { background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; }
  .scenario-header { padding: 12px 16px; display: flex; align-items: baseline; gap: 8px; }
  .scenario-header.keep { background: rgba(108,92,231,0.08); border-bottom: 2px solid rgba(108,92,231,0.3); }
  .scenario-header.switch-h { background: rgba(0,184,148,0.08); border-bottom: 2px solid rgba(0,184,148,0.3); }
  .scenario-title { font-size: var(--text-base); font-weight: 700; color: var(--text-heading); margin: 0; }
  .scenario-location { font-size: var(--text-xs); color: var(--text-muted); }

  /* Pill toggle */
  .tx-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--border-subtle); }
  .tx-toggle-label { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; }
  .pill-toggle { position: relative; width: 36px; height: 20px; border-radius: 10px; border: none; background: rgba(255,255,255,0.08); cursor: pointer; transition: background 200ms ease; padding: 0; }
  .pill-toggle.on { background: var(--accent-primary); }
  .pill-knob { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: transform 200ms ease; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .pill-toggle.on .pill-knob { transform: translateX(16px); }

  .tx-settings { padding: 10px 16px 12px; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 8px; transition: opacity 150ms ease; }
  .tx-settings.collapsed { opacity: 0.35; pointer-events: none; }
  .tx-cost-grid { display: flex; gap: 12px; }
  .tx-cost-group { flex: 1; }
  .tx-cost-label { font-size: 10px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
  .tx-inp-row { display: flex; align-items: center; gap: 3px; }
  .cost-input.sm { width: 56px; padding: 4px 6px; font-size: 11px; }
  .tx-summary { display: flex; flex-direction: column; gap: 3px; padding: 6px 8px; background: rgba(0,0,0,0.12); border-radius: var(--radius-sm); }
  .tx-sum-line { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); }
  .tx-sum-val { color: var(--yield-low); font-weight: 500; }
  .tx-sum-line.tx-sum-total { padding-top: 4px; border-top: 1px solid var(--border-subtle); font-weight: 600; color: var(--text-primary); }

  .scenario-proj-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--border-subtle); }
  .scenario-proj-title { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

  .scenario-yields { padding: 10px 16px; display: flex; flex-direction: column; gap: 3px; border-bottom: 1px solid var(--border-subtle); }
  .sy-line { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--text-secondary); }
  .sy-line.bold { font-weight: 600; color: var(--text-primary); padding-top: 3px; border-top: 1px solid var(--border-subtle); margin-top: 2px; }

  .scenario-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .scenario-table th { text-align: left; padding: 6px 10px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-subtle); }
  .scenario-table td { padding: 5px 10px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.02); }
  .scenario-table .yr { font-weight: 600; color: var(--text-primary); }
  .scenario-table .total-col { font-weight: 600; color: var(--yield-high); }
  .scenario-table .year-five td { background: rgba(0,184,148,0.04); }
  .scenario-table .year-zero td { color: var(--text-muted); }

  .scenario-result { padding: 12px 16px; border-top: 1px solid var(--border-subtle); margin-top: auto; display: flex; flex-direction: column; gap: 4px; }
  .sr-row { display: flex; justify-content: space-between; font-size: var(--text-xs); }
  .sr-label { color: var(--text-muted); font-weight: 500; }
  .sr-val { font-weight: 600; }
  .sr-val.rental-c { color: var(--rental-color); }
  .sr-val.app-c { color: var(--appreciation-color); }
  .sr-val.total-c { color: var(--yield-high); }
  .sr-row.sr-total { padding-top: 4px; border-top: 1px solid var(--border-subtle); margin-top: 2px; font-size: var(--text-sm); }
  .sr-row.sr-total .sr-label { color: var(--text-primary); font-weight: 600; }
  .sr-row.sr-total .sr-val { font-size: var(--text-base); }

  .sr-row.sr-deduction { opacity: 0.8; }
  .sr-row.sr-deduction.disabled { opacity: 0.3; }
  .sr-val.tx-c { color: var(--yield-low); }

  /* Advantage grid */
  .advantage-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .adv-card { padding: 14px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle); }
  .adv-card.positive { background: rgba(0,184,148,0.06); border-color: rgba(0,184,148,0.2); }
  .adv-card.negative { background: rgba(225,112,85,0.06); border-color: rgba(225,112,85,0.2); }
  .adv-label { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .adv-value { font-size: 28px; font-weight: 800; margin-top: 2px; }
  .adv-card.positive .adv-value { color: var(--yield-high); }
  .adv-card.negative .adv-value { color: var(--yield-low); }
  .adv-unit { font-size: 10px; color: var(--text-muted); }
  .adv-desc { font-size: var(--text-sm); color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }
  .adv-desc strong { color: var(--text-primary); }

  .costs-split { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
  .cost-section { flex: 1; }
  
  .global-maint-config { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--text-muted); background: var(--bg-tertiary); padding: 4px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); }
  .global-maint-config .maint-inp { width: 44px; padding: 2px 4px; font-size: 11px; background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: 4px; color: var(--text-primary); text-align: center; }
</style>

<script>
  let { currentHoldings = [], optimalHoldings = [], correlationData = { current: 0, optimal: 0 }, aggMetrics = null, targetMode = 'total' } = $props();

  // Combine to find bounds
  let allPoints = $derived(
    viewMode === 'asset' || !aggMetrics
      ? [...currentHoldings, ...optimalHoldings].filter(p => p && !isNaN(p.risk) && !isNaN(p.yield))
      : [aggMetrics.current, aggMetrics.optimal].filter(p => p && !isNaN(p.risk) && !isNaN(p.yield))
  );
  
  let riskPad = $derived((Math.max(...allPoints.map(p => p.risk)) - Math.min(...allPoints.map(p => p.risk))) * 0.3 || 0.1);
  let minRisk = $derived(Math.max(0, Math.min(...allPoints.map(p => p.risk)) - riskPad));
  let maxRisk = $derived(Math.max(...allPoints.map(p => p.risk)) + riskPad);
  
  let yieldPad = $derived((Math.max(...allPoints.map(p => p.yield)) - Math.min(...allPoints.map(p => p.yield))) * 0.3 || 1.0);
  let minYield = $derived(Math.min(...allPoints.map(p => p.yield)) - yieldPad);
  let maxYield = $derived(Math.max(...allPoints.map(p => p.yield)) + yieldPad);

  // SVG dimensions
  let width = $state(800);
  const height = 280;
  const padding = { top: 20, right: 30, bottom: 45, left: 65 };
  
  let innerWidth = $derived(width - padding.left - padding.right);
  const innerHeight = height - padding.top - padding.bottom;

  function scaleX(val) {
    if (maxRisk === minRisk) return padding.left + innerWidth / 2;
    return padding.left + ((val - minRisk) / (maxRisk - minRisk)) * innerWidth;
  }
  
  function scaleY(val) {
    if (maxYield === minYield) return padding.top + innerHeight / 2;
    return padding.top + innerHeight - ((val - minYield) / (maxYield - minYield) * innerHeight);
  }

  // Tooltip
  let hoverData = $state(null);
  let viewMode = $state('portfolio');
</script>

<div class="risk-chart-wrapper">
  <div class="header">
    <div class="section-header-flex">
      <div class="title">Risk vs. Expected Return ({targetMode.toUpperCase()})</div>
      <div class="info-wrapper">
        <div class="info-icon">?</div>
        <div class="info-popup" style="width: 320px;">
          <strong>What is Risk?</strong> Risk measures how much a property's value fluctuates over time. A lower risk score means the value grows steadily, while a higher score means the value has larger, less predictable swings.<br><br>
          <strong>Example:</strong> A market with 2% Risk grows dependably each year. A market with 15% Risk might rise sharply one year and drop significantly the next.
        </div>
      </div>
    </div>
    <div class="header-right">
      <div class="view-toggles">
        <button class:active={viewMode === 'asset'} onclick={() => viewMode = 'asset'}>Asset View</button>
        <button class:active={viewMode === 'portfolio'} onclick={() => viewMode = 'portfolio'}>Portfolio View</button>
      </div>
      <div class="correlation-stats">
        <div class="statBox current">Current Portfolio Correlation: <strong>{(correlationData.current * 100).toFixed(1)}%</strong></div>
        <div class="arrow">→</div>
        <div class="statBox optimal">Optimized Correlation: <strong>{(correlationData.optimal * 100).toFixed(1)}%</strong></div>
      </div>
    </div>
  </div>

  <div class="chart-container" bind:clientWidth={width} onmouseleave={() => hoverData = null}>
    <!-- Contextual Legend -->
    <div class="chart-legend">
      {#if viewMode === 'asset'}
        <div class="legend-item"><span class="legend-dot current"></span> Current Holding</div>
        <div class="legend-item"><span class="legend-dot optimal"></span> Optimal Replacement</div>
        <div class="legend-item"><span class="legend-line dash"></span> Expected Shift</div>
      {:else}
        <div class="legend-item"><span class="legend-diamond current"></span> Current Master Portfolio</div>
        <div class="legend-item"><span class="legend-diamond optimal"></span> Optimized Master Portfolio</div>
        <div class="legend-item"><span class="legend-line solid"></span> Aggregate Shift</div>
      {/if}
    </div>

    <svg viewBox="0 0 {width} {height}" width="100%" height="100%">
      <!-- Grid -->
      {#each [0, 0.25, 0.5, 0.75, 1] as tick}
        {@const y = padding.top + tick * innerHeight}
        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.05)" />
        <text x={padding.left - 10} y={y + 4} font-size="10" fill="gray" text-anchor="end">
          {((maxYield - minYield) * (1 - tick) + minYield).toFixed(1)}%
        </text>
      {/each}

      {#each [0, 0.25, 0.5, 0.75, 1] as tick}
        {@const x = padding.left + tick * innerWidth}
        <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(255,255,255,0.05)" />
        <text x={x} y={height - padding.bottom + 15} font-size="10" fill="gray" text-anchor="middle">
          {((maxRisk - minRisk) * tick + minRisk).toFixed(2)}%
        </text>
      {/each}
      
      <!-- Axis labels -->
      <text x={padding.left + innerWidth / 2} y={height - 5} fill="rgba(255,255,255,0.8)" font-size="12" font-weight="500" text-anchor="middle" letter-spacing="0.02em">Risk (±% Standard Deviation)</text>
      <text x={18} y={padding.top + innerHeight / 2} fill="rgba(255,255,255,0.8)" font-size="12" font-weight="500" transform="rotate(-90 18 {padding.top + innerHeight / 2})" text-anchor="middle" letter-spacing="0.02em">Target Yield</text>

      {#if viewMode === 'asset'}
        <!-- Connection Lines (Current -> Optimal) -->
        {#each currentHoldings as cp, i}
          {#if optimalHoldings[i]}
            {@const op = optimalHoldings[i]}
            {#if cp && op && !isNaN(cp.risk) && !isNaN(op.risk)}
              <line 
                x1={scaleX(cp.risk)} y1={scaleY(cp.yield)} 
                x2={scaleX(op.risk)} y2={scaleY(op.yield)} 
                stroke="rgba(255,255,255,0.15)" stroke-dasharray="4"
              />
            {/if}
          {/if}
        {/each}

        <!-- Current Holdings -->
        {#each currentHoldings as point, i}
          {#if point && !isNaN(point.risk) && !isNaN(point.yield)}
            <circle 
              cx={scaleX(point.risk)} cy={scaleY(point.yield)} r="6" 
              fill="#888" opacity="0.6" stroke="#fff" stroke-width="1"
              onmouseenter={() => hoverData = { ...point, type: 'Current Asset' }}
            />
          {/if}
        {/each}

        <!-- Optimal Equivalents -->
        {#each optimalHoldings as point, i}
          {#if point && !isNaN(point.risk) && !isNaN(point.yield)}
            <circle 
              cx={scaleX(point.risk)} cy={scaleY(point.yield)} r="7" 
              fill="var(--accent-primary)" opacity="0.9" stroke="#fff" stroke-width="2"
              onmouseenter={() => hoverData = { ...point, type: 'Optimal Replacement' }}
            />
          {/if}
        {/each}
      {/if}

      <!-- Aggregate Portfolio Vector -->
      {#if viewMode === 'portfolio' && aggMetrics && !isNaN(aggMetrics.current.risk) && !isNaN(aggMetrics.optimal.risk)}
        <line 
          x1={scaleX(aggMetrics.current.risk)} y1={scaleY(aggMetrics.current.yield)} 
          x2={scaleX(aggMetrics.optimal.risk)} y2={scaleY(aggMetrics.optimal.yield)} 
          stroke="#ffd32a" stroke-dasharray="0" stroke-width="2" opacity="0.8"
        />
        <polygon 
          points="{scaleX(aggMetrics.current.risk)},{scaleY(aggMetrics.current.yield) - 10} {scaleX(aggMetrics.current.risk) + 10},{scaleY(aggMetrics.current.yield)} {scaleX(aggMetrics.current.risk)},{scaleY(aggMetrics.current.yield) + 10} {scaleX(aggMetrics.current.risk) - 10},{scaleY(aggMetrics.current.yield)}"
          fill="#535c68" opacity="1" stroke="#fff" stroke-width="2"
          onmouseenter={() => hoverData = { ...aggMetrics.current, type: 'Master Portfolio (Current)' }}
        />
        <polygon 
          points="{scaleX(aggMetrics.optimal.risk)},{scaleY(aggMetrics.optimal.yield) - 12} {scaleX(aggMetrics.optimal.risk) + 12},{scaleY(aggMetrics.optimal.yield)} {scaleX(aggMetrics.optimal.risk)},{scaleY(aggMetrics.optimal.yield) + 12} {scaleX(aggMetrics.optimal.risk) - 12},{scaleY(aggMetrics.optimal.yield)}"
          fill="#ffd32a" opacity="1" stroke="#fff" stroke-width="2"
          onmouseenter={() => hoverData = { ...aggMetrics.optimal, type: 'Master Portfolio (Optimized)' }}
        />
      {/if}
    </svg>

    {#if hoverData}
      <div 
        class="chart-tooltip" 
        style="left: {scaleX(hoverData.risk)}px; top: {scaleY(hoverData.yield) - 10}px;"
      >
        <div class="tt-type" class:is-opt={hoverData.type.includes('Optimal')}>{hoverData.type}</div>
        <div class="tt-name">{hoverData.name} <span>({hoverData.pt.toUpperCase()})</span></div>
        <div class="tt-metrics">
          <div>Yield: <strong>{hoverData.yield.toFixed(2)}%</strong></div>
          <div>Volatility: <strong>{hoverData.risk.toFixed(2)}%</strong></div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .risk-chart-wrapper {
    background: var(--bg-surface-2);
    border-radius: 16px;
    padding: 20px;
    margin-top: 24px;
    border: 1px solid var(--border-color);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .view-toggles {
    display: flex;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    padding: 3px;
  }
  .view-toggles button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-sans);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 150ms ease;
  }
  .view-toggles button:hover {
    color: var(--text-secondary);
  }
  .view-toggles button.active {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }
  .correlation-stats {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0,0,0,0.2);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .correlation-stats strong {
    color: var(--text-primary);
  }
  .statBox.optimal strong {
    color: var(--accent-primary);
  }
  .arrow {
    opacity: 0.5;
  }
  .chart-container {
    position: relative;
    width: 100%;
    height: 280px;
  }
  .chart-tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: rgba(17, 21, 32, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    pointer-events: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    min-width: 160px;
    z-index: 10;
  }
  .tt-type {
    font-size: 10px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .tt-type.is-opt {
    color: var(--accent-primary);
  }
  .tt-name {
    font-weight: 600;
    color: #fff;
    margin-bottom: 6px;
  }
  .tt-name span {
    opacity: 0.6;
    font-weight: 400;
    font-size: 10px;
  }
  .tt-metrics {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--text-secondary);
  }
  .tt-metrics strong {
    color: #fff;
  }

  /* Legend */
  .chart-legend { position: absolute; top: 12px; right: 20px; display: flex; gap: 16px; font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .legend-dot.current { background: #888; border: 1px solid #fff; }
  .legend-dot.optimal { background: var(--accent-primary); border: 1px solid #fff; }
  .legend-diamond { width: 8px; height: 8px; display: inline-block; transform: rotate(45deg); margin: 0 2px;}
  .legend-diamond.current { background: #535c68; border: 1px solid #fff; }
  .legend-diamond.optimal { background: #ffd32a; border: 1px solid #fff; }
  .legend-line { width: 14px; height: 2px; }
  .legend-line.dash { background: transparent; border-top: 2px dashed rgba(255,255,255,0.3); }
  .legend-line.solid { background: #ffd32a; }

  /* Info Tooltips */
  .section-header-flex { display: flex; align-items: center; justify-content: flex-start; }
  .info-wrapper { position: relative; display: inline-flex; align-items: center; margin-left: 8px; }
  .info-icon { width: 14px; height: 14px; border-radius: 50%; background: transparent; border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); cursor: help; transition: all 150ms; }
  .info-wrapper:hover .info-icon { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
  .info-popup { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; width: 330px; padding: 14px; background: rgba(17,21,32,0.98); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; font-size: 11.5px; color: rgba(255,255,255,0.7); line-height: 1.5; box-shadow: 0 8px 32px rgba(0,0,0,0.6); opacity: 0; visibility: hidden; transition: all 200ms; z-index: 1000; pointer-events: none; text-transform: none; letter-spacing: normal; font-weight: 400; text-align: left; }
  .info-wrapper:hover .info-popup { opacity: 1; visibility: visible; }
  .info-popup strong { color: #fff; font-weight: 700; }
  .info-popup::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-width: 6px; border-style: solid; border-color: rgba(255,255,255,0.15) transparent transparent transparent; }

  circle {
    transition: all 150ms ease;
  }
  circle:hover {
    r: 9;
  }
</style>

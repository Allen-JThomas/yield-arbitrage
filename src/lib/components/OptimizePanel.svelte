<script>
  import { store } from '../stores/appState.svelte.js';
  import { getYieldValue, formatYield } from '../data/dataLoader.js';

  let { onHighlightMetro = () => {} } = $props();

  let baseline = $derived(store.optimizeBaseline);
  let endPt = $derived(store.optimizeEndPropertyType);
  let startPt = $derived(store.propertyType);
  let yt = $derived(store.yieldType);

  let isCrossProperty = $derived(startPt !== endPt);
  let mfWarning = $derived.by(() => {
    if (endPt === 'mf' && (yt === 'appreciation' || yt === 'total')) return true;
    if (startPt === 'mf' && (yt === 'appreciation' || yt === 'total')) return true;
    return false;
  });

  let effectiveYieldType = $derived(mfWarning ? 'rental' : yt);

  let rankedMetros = $derived.by(() => {
    if (!store.appData || !baseline || !store.optimizeReady) return [];

    const bYield = getYieldValue(baseline, startPt, effectiveYieldType);
    if (bYield == null) return [];

    return store.appData.metros
      .filter(m => m.regionId !== baseline.regionId)
      .map(m => {
        const metroYield = getYieldValue(m, endPt, effectiveYieldType);
        return {
          metro: m,
          yield: metroYield,
          delta: metroYield != null ? metroYield - bYield : null,
        };
      })
      .filter(r => r.yield != null && r.delta != null)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, store.optimizeTopN);
  });

  function handleRowClick(metro) {
    store.selectedRegion = metro;
    onHighlightMetro(metro);
    store.dealMetro = metro;
  }
</script>

{#if store.optimizeReady && baseline}
  <div class="optimize-panel" id="optimize-panel">
    <div class="panel-header">
      <div class="panel-title-group">
        <h2 class="panel-title">Yield Optimization</h2>
        <span class="panel-subtitle">vs. {baseline.regionName}</span>
      </div>
      <button class="panel-close" onclick={() => store.closePanel()}>✕</button>
    </div>

    <div class="baseline-card">
      <div class="baseline-label">Baseline</div>
      <div class="baseline-name">{baseline.regionName}</div>
      <div class="baseline-meta">
        {baseline.stateName} • {startPt === 'sf' ? 'SF' : 'MF'} •
        <span class="baseline-yield">{formatYield(getYieldValue(baseline, startPt, effectiveYieldType))}</span>
        {effectiveYieldType} yield
      </div>
    </div>

    {#if mfWarning}
      <div class="panel-warning">
        <span>⚠️</span>
        <span>Appreciation data unavailable for Multi Family. Ranking by rental yield only.</span>
      </div>
    {/if}

    {#if isCrossProperty}
      <div class="panel-info">
        <span>ℹ️</span>
        <span>Cross-property comparison: {startPt === 'sf' ? 'SF' : 'MF'} → {endPt === 'sf' ? 'SF' : 'MF'}. Yields may not be directly comparable.</span>
      </div>
    {/if}

    <div class="topn-control">
      <label class="topn-label">Show top</label>
      <select class="topn-select" bind:value={store.optimizeTopN} id="topn-select">
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <span class="topn-label">results</span>
    </div>

    <div class="results-list" id="optimize-results">
      {#each rankedMetros as result, i}
        {@const isSelected = store.selectedRegion?.regionId === result.metro.regionId}
        <button
          class="result-row"
          class:selected={isSelected}
          onclick={() => handleRowClick(result.metro)}
          onmouseenter={() => store.hoveredMetro = result.metro}
          onmouseleave={() => store.hoveredMetro = null}
        >
          <div class="result-rank">#{i + 1}</div>
          <div class="result-info">
            <div class="result-name">{result.metro.regionName}</div>
            <div class="result-state">{result.metro.stateName}</div>
          </div>
          <div class="result-yields">
            <div class="result-yield">{formatYield(result.yield)}</div>
            <div class="result-delta" class:positive={result.delta > 0} class:negative={result.delta < 0}>
              {result.delta > 0 ? '▲' : '▼'} {Math.abs(result.delta).toFixed(2)}pp
            </div>
          </div>
        </button>
      {:else}
        <div class="results-empty">No results found.</div>
      {/each}
    </div>
  </div>
{:else}
  <div class="optimize-empty" id="optimize-empty">
    <h3 class="empty-title">Select a Starting Point</h3>
    <p class="empty-desc">Search for a metro in the filter bar above, or click one on the map, then click "Find Best Yields".</p>
  </div>
{/if}

<style>
  .optimize-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5);
    overflow-y: auto;
    height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .panel-title-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .panel-title {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--text-heading);
  }

  .panel-subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .panel-close {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
    transition: all var(--transition-fast);
  }

  .panel-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .baseline-card {
    padding: var(--space-3) var(--space-4);
    background: var(--accent-primary-dim);
    border: 1px solid rgba(108, 92, 231, 0.25);
    border-radius: var(--radius-md);
  }

  .baseline-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .baseline-name {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-heading);
    margin-top: var(--space-1);
  }

  .baseline-meta {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-1);
  }

  .baseline-yield {
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-warning {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    background: rgba(225, 112, 85, 0.08);
    border: 1px solid rgba(225, 112, 85, 0.2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--yield-low);
    line-height: 1.5;
  }

  .panel-info {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    background: rgba(108, 92, 231, 0.08);
    border: 1px solid rgba(108, 92, 231, 0.2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--accent-primary);
    line-height: 1.5;
  }

  .topn-control {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .topn-label {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .topn-select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-sans);
    text-align: left;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
  }

  .result-row:hover {
    background: var(--bg-hover);
    border-color: var(--border-subtle);
  }

  .result-row.selected {
    background: var(--accent-primary-dim);
    border-color: rgba(108, 92, 231, 0.3);
  }

  .result-rank {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    min-width: 28px;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-name {
    font-size: var(--text-sm);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-state {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .result-yields {
    text-align: right;
    flex-shrink: 0;
  }

  .result-yield {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .result-delta {
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .result-delta.positive { color: var(--yield-high); }
  .result-delta.negative { color: var(--yield-negative); }

  .results-empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .optimize-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-8);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-4);
    opacity: 0.5;
  }

  .empty-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .empty-desc {
    font-size: var(--text-sm);
    color: var(--text-muted);
    max-width: 280px;
    line-height: 1.6;
  }
</style>

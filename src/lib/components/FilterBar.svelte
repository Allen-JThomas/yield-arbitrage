<script>
  import { store } from '../stores/appState.svelte.js';

  const countries = [{ code: 'US', label: 'United States' }];
  const propertyTypes = [
    { code: 'sf', label: 'Single Family' },
    { code: 'mf', label: 'Multi Family' },
  ];
  const yieldTypes = [
    { code: 'total', label: 'Total' },
    { code: 'rental', label: 'Rental' },
    { code: 'app', label: 'Appreciation' },
  ];

  let searchQuery = $state('');
  let searchResults = $derived.by(() => {
    if (!searchQuery || searchQuery.length < 2 || !store.appData) return [];
    const q = searchQuery.toLowerCase();
    return store.appData.metros
      .filter(m => m.regionName.toLowerCase().includes(q))
      .slice(0, 8);
  });

  let showSearch = $state(false);

  function selectBaseline(metro) {
    store.setOptimizeBaseline(metro);
    searchQuery = metro.regionName;
    showSearch = false;
  }
</script>

<div class="filter-bar" id="filter-bar">
  <div class="filter-group">
    <label class="filter-label">Country</label>
    <select class="filter-select" bind:value={store.country} id="country-select">
      {#each countries as c}
        <option value={c.code}>{c.label}</option>
      {/each}
    </select>
  </div>

  {#if store.mode === 'portfolio'}
    <div class="filter-group">
      <label class="filter-label">Optimize Portfolio Mode</label>
      <div class="yield-toggle">
        {#each yieldTypes as yt}
          <button
            class="yield-toggle-btn"
            class:active={store.portfolioTarget === yt.code}
            onclick={() => store.portfolioTarget = yt.code}
          >
            {yt.label}
          </button>
        {/each}
      </div>
    </div>
  {:else if store.mode === 'explore'}
    <div class="filter-group">
      <label class="filter-label">Property Type</label>
      <select class="filter-select" bind:value={store.propertyType} id="property-type-select">
        {#each propertyTypes as pt}
          <option value={pt.code}>{pt.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label">Yield View</label>
      <div class="yield-toggle" id="yield-type-toggle">
        {#each yieldTypes as yt}
          <button
            class="yield-toggle-btn"
            class:active={store.yieldType === yt.code}
            class:disabled={store.propertyType === 'mf' && yt.code === 'appreciation'}
            onclick={() => {
              if (!(store.propertyType === 'mf' && yt.code === 'appreciation')) {
                store.yieldType = yt.code;
              }
            }}
            title={store.propertyType === 'mf' && yt.code === 'appreciation' ? 'Appreciation data unavailable for Multi Family' : ''}
          >
            {yt.label}
          </button>
        {/each}
      </div>
    </div>

  {:else}
    <div class="filter-group">
      <label class="filter-label">Starting Region</label>
      <div class="search-wrapper">
        <input
          type="text"
          class="filter-input"
          placeholder="Search metro..."
          bind:value={searchQuery}
          onfocus={() => showSearch = true}
          onblur={() => setTimeout(() => showSearch = false, 200)}
          id="baseline-search"
        />
        {#if showSearch && searchResults.length > 0}
          <div class="search-dropdown">
            {#each searchResults as metro}
              <button class="search-item" onmousedown={() => selectBaseline(metro)}>
                <span class="search-name">{metro.regionName}</span>
                <span class="search-state">{metro.stateName}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="filter-group">
      <label class="filter-label">Start Property</label>
      <select class="filter-select" bind:value={store.propertyType} id="start-property-select">
        {#each propertyTypes as pt}
          <option value={pt.code}>{pt.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-divider">→</div>

    <div class="filter-group">
      <label class="filter-label">End Property</label>
      <select class="filter-select" bind:value={store.optimizeEndPropertyType} id="end-property-select">
        {#each propertyTypes as pt}
          <option value={pt.code}>{pt.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label">Rank By</label>
      <div class="yield-toggle">
        {#each yieldTypes as yt}
          <button
            class="yield-toggle-btn"
            class:active={store.yieldType === yt.code}
            onclick={() => store.yieldType = yt.code}
          >
            {yt.label}
          </button>
        {/each}
      </div>
    </div>

    <button
      class="optimize-btn"
      onclick={() => store.runOptimize()}
      disabled={!store.optimizeBaseline}
      id="run-optimize-btn"
    >
      Find Best Yields
    </button>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    align-items: flex-end;
    gap: var(--space-4);
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .filter-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filter-select, .filter-input {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    padding: 0 var(--space-3);
    height: 36px;
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color var(--transition-fast);
    min-width: 140px;
    box-sizing: border-box;
  }

  .filter-select:focus, .filter-input:focus {
    border-color: var(--accent-primary);
  }

  .filter-select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .yield-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 3px;
    border: 1px solid var(--border-subtle);
    height: 36px;
    box-sizing: border-box;
  }

  .yield-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-3);
    height: 100%;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .yield-toggle-btn:hover:not(.active):not(.disabled) {
    color: var(--text-primary);
  }

  .yield-toggle-btn.active {
    background: var(--accent-primary);
    color: white;
  }

  .yield-toggle-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .search-wrapper { position: relative; }

  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    margin-top: 4px;
    z-index: 1000;
    max-height: 240px;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
  }

  .search-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
    text-align: left;
  }

  .search-item:hover { background: var(--bg-hover); }

  .search-state {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .filter-divider {
    color: var(--text-muted);
    font-size: var(--text-lg);
    padding-bottom: var(--space-2);
  }

  .optimize-btn {
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-sm);
    background: linear-gradient(135deg, var(--accent-primary), #5a4bd1);
    color: white;
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .optimize-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(108, 92, 231, 0.4);
  }

  .optimize-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

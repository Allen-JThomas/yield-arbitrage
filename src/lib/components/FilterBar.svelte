<script>
  import { store } from '../stores/appState.svelte.js';

  const locationLevels = [
    { code: 'country', label: 'Country', enabled: true },
    { code: 'region', label: 'Region', enabled: true },
    { code: 'state', label: 'State', enabled: true },
    { code: 'metro', label: 'Metro', enabled: true },
    { code: 'postcode', label: 'Postcode', enabled: false },
  ];

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
  let showCountryDropdown = $state(false);

  let hierarchy = $derived(store.locationHierarchy);
  let countryGroups = $derived(hierarchy?.countries ?? []);
  let isOptimize = $derived(store.mode === 'optimize');

  // --- Derived: which granularity/filters are "active" based on direction ---
  let activeGranularity = $derived(
    isOptimize && store.locationDirection === 'end'
      ? store.endLocationGranularity
      : store.locationGranularity
  );

  let activeRegionFilter = $derived(
    isOptimize && store.locationDirection === 'end'
      ? store.endRegionFilter
      : store.selectedRegionFilter
  );

  let activeStateFilter = $derived(
    isOptimize && store.locationDirection === 'end'
      ? store.endStateFilter
      : store.selectedStateFilter
  );

  // Region options
  let regionOptions = $derived.by(() => {
    if (!hierarchy?.US?.regions) return [];
    return Object.entries(hierarchy.US.regions).map(([code, data]) => ({
      code,
      name: data.name,
      stateCount: data.states.length,
    }));
  });

  // State options filtered by active region
  let stateOptions = $derived.by(() => {
    if (!hierarchy?.US?.states) return [];
    let entries = Object.entries(hierarchy.US.states);
    if (activeRegionFilter && hierarchy.US.regions[activeRegionFilter]) {
      const regionStates = new Set(hierarchy.US.regions[activeRegionFilter].states);
      entries = entries.filter(([code]) => regionStates.has(code));
    }
    return entries
      .map(([code, data]) => ({ code, name: data.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Location summary for active direction
  let locationSummary = $derived.by(() => {
    const g = activeGranularity;
    if (g === 'country') return '🇺🇸 United States';
    if (g === 'region') {
      if (activeRegionFilter && hierarchy?.US?.regions?.[activeRegionFilter]) {
        return hierarchy.US.regions[activeRegionFilter].name;
      }
      return 'All Regions';
    }
    if (g === 'state') {
      if (activeStateFilter && hierarchy?.US?.states?.[activeStateFilter]) {
        return hierarchy.US.states[activeStateFilter].name;
      }
      return 'All States';
    }
    if (g === 'metro') return 'Metro Level';
    return '';
  });

  // Filtered metro count for active direction filters
  let filteredMetroCount = $derived.by(() => {
    if (!store.appData) return 0;
    if (!hierarchy) return store.appData.metros.length;

    if (activeStateFilter) {
      return store.appData.metros.filter(m => m.stateName === activeStateFilter).length;
    }
    if (activeRegionFilter && hierarchy.US?.regions?.[activeRegionFilter]) {
      const states = new Set(hierarchy.US.regions[activeRegionFilter].states);
      return store.appData.metros.filter(m => states.has(m.stateName)).length;
    }
    return store.appData.metros.length;
  });

  let baselineName = $derived(store.optimizeBaseline?.regionName ?? '');

  function selectBaseline(metro) {
    store.setOptimizeBaseline(metro);
    searchQuery = metro.regionName;
    showSearch = false;
  }

  function handleGranularityClick(level) {
    if (!level.enabled) return;
    if (isOptimize && store.locationDirection === 'end') {
      store.setEndLocationGranularity(level.code);
    } else {
      store.setLocationGranularity(level.code);
    }
  }

  function handleCountrySelect(country) {
    if (!country.enabled) return;
    store.country = country.code;
    showCountryDropdown = false;
  }

  function handleRegionSelect(regionCode) {
    if (isOptimize && store.locationDirection === 'end') {
      store.endRegionFilter = regionCode;
      store.endStateFilter = null;
    } else {
      store.selectedRegionFilter = regionCode;
      store.selectedStateFilter = null;
    }
  }

  function handleStateSelect(stateCode) {
    if (isOptimize && store.locationDirection === 'end') {
      store.endStateFilter = stateCode;
    } else {
      store.selectedStateFilter = stateCode;
    }
  }

  // Direction label for the location section
  let locationLabel = $derived.by(() => {
    if (!isOptimize) return 'Location';
    return store.locationDirection === 'start' ? 'Starting Location' : 'Ending Location';
  });

  // The context label for the dropdown (what appears next to the granularity pills)
  let filterContextLabel = $derived.by(() => {
    const g = activeGranularity;
    if (g === 'country') return 'Country';
    if (g === 'region') return 'Region';
    if (g === 'state') return 'State';
    if (g === 'metro') {
      if (isOptimize && store.locationDirection === 'start') return 'Starting Metro';
      if (isOptimize && store.locationDirection === 'end') return 'Ending Scope';
      return 'Metro';
    }
    return '';
  });
</script>

<div class="filter-bar" id="filter-bar">
  <!-- Location Section -->
  <div class="filter-group granularity-group">
    <div class="location-header">
      <label class="filter-label">{locationLabel}</label>
      {#if isOptimize}
        <div class="direction-toggle">
          <button
            class="dir-btn"
            class:active={store.locationDirection === 'start'}
            onclick={() => store.locationDirection = 'start'}
          >Start</button>
          <button
            class="dir-btn"
            class:active={store.locationDirection === 'end'}
            onclick={() => store.locationDirection = 'end'}
          >End</button>
        </div>
      {/if}
    </div>
    <div class="granularity-toggle" id="granularity-toggle">
      {#each locationLevels as level}
        <button
          class="gran-btn"
          class:active={activeGranularity === level.code}
          class:locked={!level.enabled}
          onclick={() => handleGranularityClick(level)}
          title={!level.enabled ? 'Coming Soon' : level.label}
        >
          {#if !level.enabled}<span class="gran-lock">🔒</span>{/if}
          <span class="gran-label">{level.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Location Filter Dropdown -->
  {#if activeGranularity === 'country'}
    <div class="filter-group">
      <label class="filter-label">{filterContextLabel}</label>
      <div class="country-wrapper">
        <button
          class="country-trigger"
          onclick={() => showCountryDropdown = !showCountryDropdown}
          onblur={() => setTimeout(() => showCountryDropdown = false, 200)}
          id="country-select"
        >
          <span>🇺🇸 United States</span>
          <span class="trigger-chevron">▾</span>
        </button>
        {#if showCountryDropdown}
          <div class="country-dropdown">
            {#each countryGroups as group}
              <div class="country-group">
                <div class="country-group-label">{group.group}</div>
                {#each group.items as c}
                  <button
                    class="country-item"
                    class:active={store.country === c.code}
                    class:locked={!c.enabled}
                    onmousedown={() => handleCountrySelect(c)}
                  >
                    <span class="country-flag">{c.flag}</span>
                    <span class="country-name">{c.name}</span>
                    {#if !c.enabled}
                      <span class="country-lock">🔒</span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  {:else if activeGranularity === 'region'}
    <div class="filter-group">
      <label class="filter-label">{filterContextLabel}</label>
      <select
        class="filter-select"
        value={activeRegionFilter ?? ''}
        onchange={(e) => handleRegionSelect(e.target.value || null)}
        id="region-select"
      >
        <option value="">All Regions</option>
        {#each regionOptions as r}
          <option value={r.code}>{r.name} ({r.stateCount} states)</option>
        {/each}
      </select>
    </div>

  {:else if activeGranularity === 'state'}
    <div class="filter-group">
      <label class="filter-label">{filterContextLabel}</label>
      <select
        class="filter-select"
        value={activeStateFilter ?? ''}
        onchange={(e) => handleStateSelect(e.target.value || null)}
        id="state-select"
      >
        <option value="">All States</option>
        {#each stateOptions as s}
          <option value={s.code}>{s.name} ({s.code})</option>
        {/each}
      </select>
    </div>

  {:else if activeGranularity === 'metro'}
    {#if isOptimize && store.locationDirection === 'start'}
      <div class="filter-group">
        <label class="filter-label">Starting Metro</label>
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
    {:else}
      <div class="filter-group">
        <label class="filter-label">{filterContextLabel}</label>
        <div class="metro-hint">Click a metro on the map</div>
      </div>
    {/if}
  {/if}

  <!-- Active filter badge -->
  {#if activeRegionFilter || activeStateFilter}
    <div class="filter-badge">
      <span class="badge-text">{locationSummary}</span>
      <span class="badge-count">{filteredMetroCount} metros</span>
      <button class="badge-clear" onclick={() => {
        if (isOptimize && store.locationDirection === 'end') {
          store.endRegionFilter = null;
          store.endStateFilter = null;
        } else {
          store.selectedRegionFilter = null;
          store.selectedStateFilter = null;
        }
      }}>✕</button>
    </div>
  {/if}

  <!-- Baseline badge in optimize (when not on Start+Metro pill) -->
  {#if isOptimize && store.optimizeBaseline && !(store.locationDirection === 'start' && activeGranularity === 'metro')}
    <div class="filter-badge">
      <span class="badge-text">📍 {baselineName}</span>
      <button class="badge-clear" onclick={() => store.setOptimizeBaseline(null)}>✕</button>
    </div>
  {/if}

  <!-- Divider -->
  <div class="filter-separator"></div>

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
    <!-- Optimize mode: property selectors + rank + find -->
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
      Find Yields
    </button>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .granularity-group {
    flex-shrink: 0;
  }

  .location-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filter-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  /* --- Direction Toggle (Start/End) --- */

  .direction-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: 10px;
    padding: 1px;
    border: 1px solid var(--border-subtle);
    height: 18px;
  }

  .dir-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    height: 100%;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .dir-btn.active {
    background: var(--accent-primary);
    color: white;
  }

  .dir-btn:hover:not(.active) {
    color: var(--text-secondary);
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
    min-width: 120px;
    box-sizing: border-box;
  }

  .filter-select:focus, .filter-input:focus {
    border-color: var(--accent-primary);
  }

  .filter-select option {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  /* --- Granularity Toggle --- */

  .granularity-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 3px;
    border: 1px solid var(--border-subtle);
    height: 36px;
    box-sizing: border-box;
    gap: 1px;
  }

  .gran-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 var(--space-2);
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
    position: relative;
  }

  .gran-btn:hover:not(.active):not(.locked) {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }

  .gran-btn.active {
    background: var(--accent-primary);
    color: white;
  }

  .gran-btn.locked {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .gran-btn.locked:hover::after {
    content: 'Coming Soon';
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary);
    white-space: nowrap;
    z-index: 100;
    box-shadow: var(--shadow-md);
    pointer-events: none;
  }

  .gran-lock {
    font-size: 10px;
    line-height: 1;
  }

  .gran-label {
    line-height: 1;
  }

  /* --- Country Dropdown --- */

  .country-wrapper {
    position: relative;
  }

  .country-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    padding: 0 var(--space-3);
    height: 36px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color var(--transition-fast);
    min-width: 170px;
    box-sizing: border-box;
    text-align: left;
  }

  .country-trigger:focus {
    border-color: var(--accent-primary);
  }

  .trigger-chevron {
    font-size: 10px;
    color: var(--text-muted);
  }

  .country-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-sm);
    margin-top: 4px;
    z-index: 1000;
    max-height: 380px;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: fadeIn 150ms ease;
  }

  .country-group {
    padding: var(--space-1) 0;
  }

  .country-group:not(:last-child) {
    border-bottom: 1px solid var(--border-subtle);
  }

  .country-group-label {
    padding: var(--space-2) var(--space-3) var(--space-1);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .country-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 6px var(--space-3);
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
    text-align: left;
  }

  .country-item:hover:not(.locked) {
    background: var(--bg-hover);
  }

  .country-item.active {
    background: var(--accent-primary-dim);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .country-item.locked {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .country-flag {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .country-name {
    flex: 1;
  }

  .country-lock {
    font-size: 10px;
    margin-left: auto;
  }

  /* --- Filter Badge --- */

  .filter-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 4px var(--space-2) 4px var(--space-3);
    background: var(--accent-primary-dim);
    border: 1px solid rgba(108, 92, 231, 0.25);
    border-radius: var(--radius-full);
    height: 30px;
    align-self: flex-end;
    margin-bottom: 3px;
    animation: fadeIn 200ms ease;
    flex-shrink: 0;
  }

  .badge-text {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .badge-count {
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .badge-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
    font-size: 9px;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .badge-clear:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--text-primary);
  }

  /* --- Filter Separator --- */

  .filter-separator {
    width: 1px;
    height: 28px;
    background: var(--border-medium);
    align-self: flex-end;
    margin-bottom: 4px;
    flex-shrink: 0;
  }

  /* --- Metro Hint --- */

  .metro-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    padding: 6px 0;
    font-style: italic;
    height: 36px;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  /* --- Yield Toggle --- */

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
    min-width: 200px;
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
    flex-shrink: 0;
  }

  .optimize-btn {
    padding: var(--space-2) var(--space-4);
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
    flex-shrink: 0;
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

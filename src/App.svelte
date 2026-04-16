<script>
  import { onMount } from 'svelte';
  import { store } from './lib/stores/appState.svelte.js';
  import { loadData } from './lib/data/dataLoader.js';
  import ModeSelector from './lib/components/ModeSelector.svelte';
  import FilterBar from './lib/components/FilterBar.svelte';
  import MapView from './lib/components/MapView.svelte';
  import ExplorePanel from './lib/components/ExplorePanel.svelte';
  import OptimizePanel from './lib/components/OptimizePanel.svelte';
  import PortfolioPanel from './lib/components/PortfolioPanel.svelte';
  import DealModal from './lib/components/DealModal.svelte';
  import UserGuideModal from './lib/components/UserGuideModal.svelte';

  let mapView;
  let showGuide = $state(false);

  onMount(async () => {
    try {
      store.dataLoading = true;
      store.appData = await loadData();
      store.dataLoading = false;
    } catch (err) {
      store.dataError = err.message;
      store.dataLoading = false;
      console.error('Failed to load data:', err);
    }
  });

  function handleHighlightMetro(metro) {
    mapView?.highlightMetro?.(metro);
  }
</script>

<div class="app-layout" id="app-layout">
  <header class="topbar" id="topbar">
    <div class="topbar-left">
      <div class="logo" id="logo">
        <span class="logo-text">Yield<span class="logo-accent">Arbitrage</span></span>
      </div>
      <ModeSelector />
    </div>
    <FilterBar />
    <div class="topbar-right">
      <button class="guide-btn" onclick={() => showGuide = true}>User Guide</button>
    </div>
  </header>

  <main class="main-content" class:panel-open={store.panelOpen && store.mode !== 'portfolio'}>
    {#if store.mode === 'portfolio'}
      <PortfolioPanel />
    {:else}
      <div class="map-area">
        {#if store.dataLoading}
          <div class="loading-overlay" id="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading metro data...</div>
          </div>
        {:else if store.dataError}
          <div class="error-overlay" id="error-overlay">
            <div class="error-icon">⚠️</div>
            <div class="error-text">Failed to load data</div>
            <div class="error-detail">{store.dataError}</div>
          </div>
        {:else}
          <MapView bind:this={mapView} />
        {/if}
      </div>

      {#if store.panelOpen}
        <aside class="side-panel" id="side-panel">
          {#if store.mode === 'explore'}
            <ExplorePanel />
          {:else}
            <OptimizePanel onHighlightMetro={handleHighlightMetro} />
          {/if}
        </aside>
      {/if}
    {/if}
  </main>
</div>

{#if store.dealMetro && store.optimizeBaseline}
  <DealModal
    startMetro={store.optimizeBaseline}
    endMetro={store.dealMetro}
    startPropertyType={store.propertyType}
    endPropertyType={store.optimizeEndPropertyType}
    onClose={() => store.dealMetro = null}
  />
{/if}

{#if showGuide}
  <UserGuideModal onClose={() => showGuide = false} />
{/if}

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: 0 var(--space-6);
    background: var(--bg-surface-1);
    border-bottom: 1px solid var(--border-subtle);
    height: var(--topbar-height);
    z-index: 100;
  }

  .topbar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
  }

  .guide-btn {
    background: transparent;
    border: 1px solid var(--border-medium);
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .guide-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: default;
  }

  .logo-icon { font-size: 20px; }

  .logo-text {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-heading);
    letter-spacing: -0.02em;
  }

  .logo-accent { color: var(--accent-primary); }

  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .map-area {
    flex: 1;
    position: relative;
    transition: all var(--transition-slow);
  }

  .side-panel {
    width: var(--panel-width);
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-left: 1px solid var(--border-subtle);
    flex-shrink: 0;
    overflow: hidden;
    animation: slideInRight var(--transition-slow) forwards;
    z-index: 50;
  }

  .loading-overlay, .error-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-4);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-subtle);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .error-icon { font-size: 48px; }

  .error-text {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--yield-low);
  }

  .error-detail {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>

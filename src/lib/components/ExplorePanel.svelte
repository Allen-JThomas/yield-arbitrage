<script>
  import { store } from '../stores/appState.svelte.js';
  import { getYieldSeries, formatCurrency } from '../data/dataLoader.js';
  import YieldCard from './YieldCard.svelte';
  import YieldChart from './YieldChart.svelte';

  let metro = $derived(store.selectedRegion);
  let pt = $derived(store.propertyType);
  let ptData = $derived(metro ? metro[pt] : null);

  let rentalSeries = $derived(metro ? getYieldSeries(metro, pt, 'rental') : { dates: [], values: [] });
  let appreciationSeries = $derived(metro ? getYieldSeries(metro, pt, 'appreciation') : { dates: [], values: [] });

  let hasAppreciation = $derived(ptData?.hasAppreciation ?? false);
  let isMF = $derived(pt === 'mf');
</script>

{#if metro}
  <div class="explore-panel" id="explore-panel">
    <div class="panel-header">
      <div class="panel-title-group">
        <h2 class="panel-title">{metro.regionName}</h2>
        <span class="panel-subtitle">{metro.stateName} • {pt === 'sf' ? 'Single Family' : 'Multi Family'}</span>
      </div>
      <button class="panel-close" onclick={() => store.closePanel()} id="close-panel-btn">✕</button>
    </div>

    {#if isMF}
      <div class="panel-warning">
        <span class="warning-icon">ℹ️</span>
        <span>Appreciation data is unavailable for Multi Family. Total yield reflects rental yield only.</span>
      </div>
    {/if}

    <div class="yield-cards">
      <YieldCard label="Total Yield" value={ptData?.currentTotalYield} />
      <div class="yield-cards-row">
        <YieldCard
          label="Rental Yield"
          value={ptData?.currentRentalYield}
          subtitle={ptData?.currentRent ? `Rent: ${formatCurrency(ptData.currentRent)}/mo` : ''}
        />
        <YieldCard
          label="Appreciation"
          value={ptData?.currentAppreciationYield}
          unavailable={!hasAppreciation}
          subtitle={ptData?.currentValue ? `Value: ${formatCurrency(ptData.currentValue)}` : ''}
        />
      </div>
    </div>

    <div class="chart-section">
      <h3 class="chart-title">Rental Yield Over Time</h3>
      <YieldChart
        dates={rentalSeries.dates}
        values={rentalSeries.values}
        label="Rental Yield"
        color="var(--rental-color)"
        height={180}
      />
    </div>

    <div class="chart-section">
      <h3 class="chart-title">
        Appreciation Yield Over Time
        {#if !hasAppreciation}
          <span class="chart-badge">Unavailable</span>
        {/if}
      </h3>
      <YieldChart
        dates={appreciationSeries.dates}
        values={appreciationSeries.values}
        label="Appreciation Yield"
        color="var(--appreciation-color)"
        height={180}
      />
    </div>
  </div>
{/if}

<style>
  .explore-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
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
    line-height: 1.2;
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

  .panel-warning {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    background: rgba(225, 112, 85, 0.08);
    border: 1px solid rgba(225, 112, 85, 0.2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--yield-low);
    line-height: 1.5;
  }

  .warning-icon { flex-shrink: 0; }

  .yield-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .yield-cards-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .chart-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .chart-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .chart-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--yield-low);
    background: rgba(225, 112, 85, 0.1);
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
  }
</style>

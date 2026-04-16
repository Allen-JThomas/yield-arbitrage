<script>
  let { onClose } = $props();
</script>

<div class="modal-backdrop" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-container" onclick={e => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Yield Arbitrage User Guide</h2>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>
    
    <div class="modal-content">
      <section class="guide-section">
        <h3><span class="icon">🔍</span>Explore View</h3>
        <p>
          The <strong>Explore View</strong> is a top-level geographic scanner. It tracks the raw nominal historical data across over 800 Metro Markets in the US.
        </p>
        <ul>
          <li><strong>Map Interactions:</strong> Click and pan on the map to visualize density clusters for appreciation and rental yields.</li>
          <li><strong>Analytics Panel:</strong> Generates instantaneous 10-year line charts tracking total property growth and localized macro-economic trends.</li>
        </ul>
      </section>

      <section class="guide-section">
        <h3><span class="icon">⚡</span>Optimize View</h3>
        <p>
          The <strong>Optimize View</strong> leverages deep property datasets to execute algorithmic cross-market yield arbitrage, letting you automatically identify asymmetric market dislocations between states.
        </p>
        <ul>
          <li><strong>Comparative Targeting:</strong> Select between identifying purely rental-based hotbeds or long-term structural appreciation centers.</li>
          <li><strong>Algorithm Overlays:</strong> Computes standard deviations against regional averages to highlight metros that are vastly outperforming their neighbors.</li>
        </ul>
      </section>

      <section class="guide-section">
        <h3><span class="icon">💼</span>Portfolio Builder</h3>
        <p>
          The <strong>Portfolio</strong> simulates institutional-grade equity modeling. Configure a custom list of geographic holdings to track combined nominal asset growth over 5 years.
        </p>
        <ul>
          <li><strong>Greedy Yield Optimization:</strong> Automatically strips underperforming properties from your lineup and proposes pure high-yield replacements geometrically filtered by your limits.</li>
          <li><strong>Sharpe Ratio Engine:</strong> Employs complex correlation matrices to find mathematically safe <em>uncorrelated properties</em>. It lowers your total Standard Deviation (Risk) to theoretically stabilize your master equity growth against crashes.</li>
          <li><strong>Risk vs Expected Return (Chart):</strong> Visualizes how your chosen assets compare statistically. The X-axis represents historical boom-and-bust fluctuation, while the Y-axis forecasts overall growth.</li>
        </ul>
      </section>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .modal-container {
    width: 600px;
    max-width: 90vw;
    max-height: 85vh;
    background: var(--bg-surface-2, rgba(17,21,32,1));
    border: 1px solid var(--border-medium, rgba(255,255,255,0.1));
    border-radius: 12px;
    box-shadow: 0 16px 64px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: popIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popIn {
    0% { transform: scale(0.95); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: var(--bg-tertiary, rgba(255,255,255,0.03));
    border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.05));
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #8b93a7);
    font-size: 16px;
    cursor: pointer;
    transition: color 150ms ease;
  }

  .close-btn:hover {
    color: var(--text-primary, #fff);
  }

  .modal-content {
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .guide-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guide-section h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: var(--accent-primary, #00b894);
  }

  .icon {
    font-size: 18px;
  }

  .guide-section p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary, #8b93a7);
    line-height: 1.5;
  }

  .guide-section strong {
    color: var(--text-primary, #fff);
  }

  .guide-section ul {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .guide-section li {
    font-size: 13.5px;
    color: var(--text-secondary, #8b93a7);
    line-height: 1.5;
  }
</style>

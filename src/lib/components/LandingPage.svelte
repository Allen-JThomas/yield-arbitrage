<script>
  import { store } from '../stores/appState.svelte.js';

  const tools = [
    {
      id: 'yield-arbitrage',
      name: 'Yield Arbitrage',
      tagline: 'Property Yield Analyzer',
      description: 'Explore and compare rental and appreciation yields across US metro areas. Identify high-yield investment opportunities and build optimized portfolios.',
      status: 'live',
      accentColor: '#6c5ce7',
    },
    {
      id: 'market-sensing',
      name: 'Market Sensing',
      tagline: 'Real-Time Market Intelligence',
      description: 'Monitor macro and micro market signals across geographies. Detect emerging trends, supply shifts, and demand inflection points before they hit consensus.',
      status: 'coming-soon',
      accentColor: '#00cec9',
    },
    {
      id: 'ai-sentiment',
      name: 'AI Sentiment Analysis',
      tagline: 'Natural Language Market Pulse',
      description: 'Analyze broker reports, news feeds, and earnings calls with AI to surface sentiment shifts, risk signals, and conviction levels across asset classes.',
      status: 'coming-soon',
      accentColor: '#fd79a8',
    },
    {
      id: 'contract-optimization',
      name: 'Contract Optionality',
      tagline: 'Lease & Contract Optimizer',
      description: 'Model embedded options in lease structures, renewal clauses, and escalation terms. Quantify hidden value and negotiate with precision.',
      status: 'coming-soon',
      accentColor: '#fdcb6e',
    },
  ];

  function handleLaunch(tool) {
    if (tool.status === 'live') {
      store.activeTool = tool.id;
    }
  }
</script>

<div class="landing" id="landing-page">
  <!-- Header -->
  <header class="landing-header">
    <div class="brand">
      <span class="brand-name">Dark Value</span>
      <span class="brand-divider"></span>
      <span class="brand-sub">Analytics Platform</span>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <h1 class="hero-title">
      <span class="hero-line-1"><span class="hero-brand">Dark Value</span> tools for</span>
      <span class="hero-line-2">commercial real estate</span>
    </h1>
    <p class="hero-subtitle">
      A suite of purpose-built tools to identify opportunities, quantify risk, and optimize returns.
    </p>
  </section>

  <!-- Tool Grid -->
  <section class="tools-grid" id="tools-grid">
    {#each tools as tool, i}
      <button
        class="tool-card"
        class:live={tool.status === 'live'}
        class:coming-soon={tool.status === 'coming-soon'}
        id="tool-card-{tool.id}"
        onclick={() => handleLaunch(tool)}
        style="--card-accent: {tool.accentColor}; --card-index: {i}"
      >
        <div class="card-status">
          {#if tool.status === 'live'}
            <span class="status-badge live">Live</span>
          {:else}
            <span class="status-badge soon">Coming Soon</span>
          {/if}
        </div>

        <div class="card-content">
          <h2 class="card-name">{tool.name}</h2>
          <p class="card-tagline">{tool.tagline}</p>
          <p class="card-description">{tool.description}</p>
        </div>

        <div class="card-footer">
          {#if tool.status === 'live'}
            <span class="card-cta">Launch<span class="cta-arrow">&rarr;</span></span>
          {:else}
            <span class="card-cta muted">In Development</span>
          {/if}
        </div>

        <!-- Accent line -->
        <div class="card-accent-line"></div>
      </button>
    {/each}
  </section>

  <!-- Footer -->
  <footer class="landing-footer">
    <span class="footer-text">Built for strategic advantage</span>
  </footer>
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    background: var(--bg-primary);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* --- Header --- */
  .landing-header {
    display: flex;
    align-items: center;
    padding: var(--space-6) var(--space-8);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-name {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-heading);
    letter-spacing: -0.02em;
  }

  .brand-divider {
    width: 1px;
    height: 16px;
    background: var(--border-medium);
  }

  .brand-sub {
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  /* --- Hero --- */
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-12) var(--space-8) var(--space-10);
    animation: fadeInUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .hero-title {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-5);
  }

  .hero-line-1 {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 300;
    color: var(--text-secondary);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .hero-brand {
    font-weight: 700;
    color: var(--text-heading);
  }

  .hero-line-2 {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 700;
    color: var(--text-heading);
    letter-spacing: -0.03em;
    line-height: 1.2;
  }

  .hero-subtitle {
    font-size: var(--text-base);
    color: var(--text-muted);
    max-width: 480px;
    line-height: 1.6;
  }

  /* --- Tools Grid --- */
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-5);
    padding: 0 var(--space-8) var(--space-12);
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
  }

  /* --- Card --- */
  .tool-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: var(--space-6);
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    text-align: left;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all 350ms cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
    min-height: 240px;
    opacity: 0;
    transform: translateY(20px);
    animation: cardEnter 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: calc(100ms + var(--card-index) * 80ms);
  }

  .tool-card.live:hover {
    border-color: var(--card-accent);
    background: var(--bg-tertiary);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--card-accent);
  }

  .tool-card.coming-soon {
    cursor: default;
    opacity: 0;
  }

  .tool-card.coming-soon .card-content {
    opacity: 0.5;
  }

  .card-accent-line {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--card-accent);
    opacity: 0;
    transition: opacity 350ms ease;
  }

  .tool-card.live:hover .card-accent-line {
    opacity: 1;
  }

  /* --- Card Status --- */
  .card-status {
    margin-bottom: var(--space-5);
  }

  .status-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: var(--radius-full);
  }

  .status-badge.live {
    background: rgba(0, 184, 148, 0.12);
    color: #00b894;
  }

  .status-badge.soon {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-muted);
  }

  /* --- Card Content --- */
  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card-name {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--text-heading);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .card-tagline {
    font-size: var(--text-sm);
    color: var(--card-accent);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .card-description {
    font-size: var(--text-sm);
    color: var(--text-muted);
    line-height: 1.6;
    margin-top: var(--space-2);
  }

  /* --- Card Footer --- */
  .card-footer {
    margin-top: var(--space-5);
  }

  .card-cta {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-heading);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    transition: gap 250ms ease;
  }

  .tool-card.live:hover .card-cta {
    gap: var(--space-3);
  }

  .card-cta.muted {
    color: var(--text-muted);
    font-weight: 400;
  }

  .cta-arrow {
    transition: transform 250ms ease;
  }

  .tool-card.live:hover .cta-arrow {
    transform: translateX(2px);
  }

  /* --- Footer --- */
  .landing-footer {
    display: flex;
    justify-content: center;
    padding: var(--space-6) var(--space-8);
    margin-top: auto;
  }

  .footer-text {
    font-size: var(--text-xs);
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.5;
  }

  /* --- Animations --- */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

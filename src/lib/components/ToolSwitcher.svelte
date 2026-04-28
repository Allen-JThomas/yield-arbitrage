<script>
  import { store } from '../stores/appState.svelte.js';

  let open = $state(false);

  const tools = [
    { id: 'yield-arbitrage', name: 'Yield Arbitrage', status: 'live', accentColor: '#6c5ce7' },
    { id: 'market-sensing', name: 'Market Sensing', status: 'coming-soon', accentColor: '#00cec9' },
    { id: 'ai-sentiment', name: 'AI Sentiment', status: 'coming-soon', accentColor: '#fd79a8' },
    { id: 'contract-optimization', name: 'Contract Optionality', status: 'coming-soon', accentColor: '#fdcb6e' },
  ];

  function toggle() {
    open = !open;
  }

  function handleSelect(tool) {
    if (tool.status === 'live') {
      store.activeTool = tool.id;
      open = false;
    }
  }

  function goToLanding() {
    store.activeTool = null;
    open = false;
  }

  function handleClickOutside(e) {
    if (open && !e.target.closest('.switcher-wrapper')) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="switcher-wrapper" id="tool-switcher">
  <button class="switcher-trigger" class:open onclick={toggle} title="Switch tools">
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
    <span class="grid-dot"></span>
  </button>

  {#if open}
    <div class="switcher-dropdown" id="switcher-dropdown">
      <div class="dropdown-header">
        <span class="dropdown-title">Tools</span>
        <button class="all-tools-link" onclick={goToLanding}>View all</button>
      </div>

      <div class="dropdown-grid">
        {#each tools as tool}
          <button
            class="dropdown-item"
            class:active={store.activeTool === tool.id}
            class:disabled={tool.status === 'coming-soon'}
            id="switcher-item-{tool.id}"
            onclick={() => handleSelect(tool)}
            style="--item-accent: {tool.accentColor}"
          >
            <span class="item-name">{tool.name}</span>
            {#if store.activeTool === tool.id}
              <span class="item-active-dot"></span>
            {:else if tool.status === 'coming-soon'}
              <span class="item-soon">Soon</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .switcher-wrapper {
    position: relative;
  }

  /* --- Trigger: 3x3 dot grid --- */
  .switcher-trigger {
    display: grid;
    grid-template-columns: repeat(3, 4px);
    grid-template-rows: repeat(3, 4px);
    gap: 3px;
    padding: 8px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 150ms ease;
  }

  .switcher-trigger:hover,
  .switcher-trigger.open {
    background: rgba(255, 255, 255, 0.08);
  }

  .grid-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-secondary);
    transition: background 150ms ease;
  }

  .switcher-trigger:hover .grid-dot,
  .switcher-trigger.open .grid-dot {
    background: var(--text-primary);
  }

  /* --- Dropdown --- */
  .switcher-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 280px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    overflow: hidden;
    animation: dropdownEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }

  .dropdown-title {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .all-tools-link {
    font-size: var(--text-xs);
    color: var(--accent-primary);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 500;
    padding: 0;
    transition: color 150ms ease;
  }

  .all-tools-link:hover {
    color: var(--text-heading);
  }

  /* --- Dropdown Grid --- */
  .dropdown-grid {
    display: flex;
    flex-direction: column;
    padding: var(--space-2);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background 150ms ease;
    text-align: left;
  }

  .dropdown-item:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.05);
  }

  .dropdown-item.active {
    background: rgba(108, 92, 231, 0.08);
  }

  .dropdown-item.disabled {
    cursor: default;
    opacity: 0.45;
  }

  .item-name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .dropdown-item.disabled .item-name {
    color: var(--text-muted);
  }

  .item-active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-primary);
    box-shadow: 0 0 6px rgba(108, 92, 231, 0.5);
  }

  .item-soon {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  @keyframes dropdownEnter {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>

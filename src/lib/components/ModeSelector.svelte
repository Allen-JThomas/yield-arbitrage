<script>
  import { store } from '../stores/appState.svelte.js';

  const modes = [
    { id: 'explore', label: 'Explore' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'portfolio', label: 'Portfolio' },
  ];
</script>

<div class="mode-selector" id="mode-selector">
  {#each modes as m}
    <button
      class="mode-btn"
      class:active={store.mode === m.id}
      onclick={() => store.setMode(m.id)}
      id="mode-btn-{m.id}"
    >
      <span class="mode-label">{m.label}</span>
    </button>
  {/each}
</div>

<style>
  .mode-selector {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    padding: 3px;
    gap: 2px;
    border: 1px solid var(--border-subtle);
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .mode-btn:hover:not(.active) {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .mode-btn.active {
    background: var(--accent-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
  }

  .mode-icon {
    font-size: 14px;
  }

  .mode-label {
    letter-spacing: 0.01em;
  }
</style>

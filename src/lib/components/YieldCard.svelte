<script>
  import { formatYield } from '../data/dataLoader.js';

  let { label = '', value = null, color = 'var(--text-primary)', subtitle = '', unavailable = false } = $props();

  let displayValue = $derived(unavailable ? '—' : formatYield(value));

  let valueColor = $derived.by(() => {
    if (unavailable || value == null) return 'var(--text-muted)';
    if (value > 0) return 'var(--yield-high)';
    if (value < 0) return 'var(--yield-negative)';
    return 'var(--text-secondary)';
  });
</script>

<div class="yield-card" class:unavailable>
  <div class="card-label">{label}</div>
  <div class="card-value" style="color: {valueColor}">
    {displayValue}
  </div>
  {#if unavailable}
    <div class="card-badge">Data unavailable</div>
  {:else if subtitle}
    <div class="card-subtitle">{subtitle}</div>
  {/if}
</div>

<style>
  .yield-card {
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    transition: all var(--transition-fast);
  }

  .yield-card:hover {
    border-color: var(--border-medium);
  }

  .yield-card.unavailable {
    opacity: 0.6;
  }

  .card-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-1);
  }

  .card-value {
    font-size: var(--text-2xl);
    font-weight: 700;
    line-height: 1.2;
  }

  .card-subtitle {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: var(--space-1);
  }

  .card-badge {
    display: inline-block;
    font-size: var(--text-xs);
    color: var(--yield-low);
    background: rgba(225, 112, 85, 0.1);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
  }
</style>

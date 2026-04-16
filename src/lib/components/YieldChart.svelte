<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  let { dates = [], values = [], label = 'Yield', color = 'var(--rental-color)', height = 200 } = $props();

  let canvas;
  let chart;
  let mounted = false;

  function createChart() {
    if (chart) chart.destroy();
    if (!canvas || !dates.length) return;

    // Deep-clone to break Svelte $state proxy (Chart.js uses defineProperty internally)
    const plainDates = JSON.parse(JSON.stringify(dates));
    const plainValues = JSON.parse(JSON.stringify(values));

    // Resolve CSS variable to actual color
    let computedColor = color;
    if (color.startsWith('var(')) {
      const varName = color.replace('var(', '').replace(')', '').trim();
      computedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#6c5ce7';
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, computedColor + '40');
    gradient.addColorStop(1, computedColor + '05');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: plainDates,
        datasets: [{
          label,
          data: plainValues,
          borderColor: computedColor,
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: computedColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 21, 32, 0.95)',
            titleColor: '#e8eaed',
            bodyColor: '#8b93a7',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: "'Inter', sans-serif", size: 12, weight: 600 },
            bodyFont: { family: "'Inter', sans-serif", size: 12 },
            callbacks: {
              label: (ctx) => `${label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#8892a8',
              font: { family: "'Inter', sans-serif", size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
          },
          y: {
            ticks: {
              color: '#8892a8',
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: (v) => v.toFixed(1) + '%',
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: false },
          },
        },
      },
    });
  }

  onMount(() => {
    mounted = true;
    // Initial render if data is already present
    if (dates.length && canvas) {
      createChart();
    }
  });

  onDestroy(() => {
    if (chart) chart.destroy();
  });

  // Reactively rebuild chart when data changes
  $effect(() => {
    // Access deps to trigger reactivity
    const _d = dates;
    const _v = values;
    const _c = color;
    if (mounted && canvas) {
      // Use requestAnimationFrame so the canvas has correct dimensions
      requestAnimationFrame(() => createChart());
    }
  });
</script>

<div class="chart-wrapper" style="height: {height}px">
  <!-- Always render canvas so bind:this is available; hide visually when empty -->
  <canvas
    bind:this={canvas}
    class:hidden={!dates.length}
  ></canvas>
  {#if !dates.length}
    <div class="chart-empty">No data available</div>
  {/if}
</div>

<style>
  .chart-wrapper {
    width: 100%;
    position: relative;
  }

  .chart-wrapper canvas {
    width: 100% !important;
    height: 100% !important;
  }

  .chart-wrapper canvas.hidden {
    display: none;
  }

  .chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: var(--text-sm);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-subtle);
  }
</style>

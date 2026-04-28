<script>
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { store } from '../stores/appState.svelte.js';
  import { getYieldValue, yieldToColor, formatYield, getFilteredStates } from '../data/dataLoader.js';

  let { onShowGuide } = $props();

  let mapContainer;
  let map;
  let markersLayer;

  // Legend range (exposed for the template)
  let legendMin = $state(0);
  let methodologyOpen = $state(false);
  let legendMax = $state(10);

  const YIELD_LABELS = {
    total: 'Total Yield',
    rental: 'Rental Yield',
    appreciation: 'Appreciation Yield',
  };

  const COUNTRY_CONFIG = {
    US: { center: [39.8, -98.5], zoom: 4.5, minZoom: 3, maxZoom: 12 },
  };

  onMount(() => {
    const config = COUNTRY_CONFIG[store.country] || COUNTRY_CONFIG.US;

    map = L.map(mapContainer, {
      center: config.center,
      zoom: config.zoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark base (no labels)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Bright labels on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'overlayPane',
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  });

  onDestroy(() => {
    if (map) map.remove();
  });

  function updateMarkers() {
    if (!markersLayer || !store.appData) return;

    markersLayer.clearLayers();
    markerMap = {};

    // In optimize mode, use END location filters for destination scoping
    // In explore/portfolio, use the standard start location filters
    const isOpt = store.mode === 'optimize';
    const regionF = isOpt ? store.endRegionFilter : store.selectedRegionFilter;
    const stateF = isOpt ? store.endStateFilter : store.selectedStateFilter;

    const allowedStates = getFilteredStates(
      store.locationHierarchy,
      regionF,
      stateF
    );

    const allMetros = store.appData.metros;
    const metros = allowedStates
      ? allMetros.filter(m => allowedStates.has(m.stateName))
      : allMetros;
    const pt = store.propertyType;
    const yt = store.yieldType;

    const yieldValues = metros
      .map(m => getYieldValue(m, pt, yt))
      .filter(v => v != null);

    const sorted = [...yieldValues].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.05)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 10;

    // Update legend range
    legendMin = p5;
    legendMax = p95;

    for (const metro of metros) {
      if (metro.lat == null || metro.lng == null) continue;

      const yieldVal = getYieldValue(metro, pt, yt);
      const color = yieldToColor(yieldVal, p5, p95);
      const isBaseline = store.optimizeBaseline?.regionId === metro.regionId;

      const marker = L.circleMarker([metro.lat, metro.lng], {
        radius: isBaseline ? 10 : 6,
        fillColor: isBaseline ? '#f8a5c2' : color,
        color: isBaseline ? '#fff' : color,
        weight: isBaseline ? 2 : 1,
        opacity: 0.9,
        fillOpacity: isBaseline ? 0.9 : 0.7,
      });

      // Store default style for hover restore
      marker._defaultStyle = {
        radius: isBaseline ? 10 : 6,
        fillOpacity: isBaseline ? 0.9 : 0.7,
        fillColor: isBaseline ? '#f8a5c2' : color,
        color: isBaseline ? '#fff' : color,
        weight: isBaseline ? 2 : 1,
      };

      const tooltipContent = `
        <strong>${metro.regionName}</strong><br/>
        <span style="color:${color}">${formatYield(yieldVal)}</span> ${yt} yield
      `;

      marker.bindTooltip(tooltipContent, {
        className: 'metro-tooltip',
        direction: 'top',
        offset: [0, -8],
      });

      marker.on('click', () => {
        store.selectRegion(metro);
      });

      marker.on('mouseover', function() {
        this.setRadius(isBaseline ? 13 : 9);
        this.setStyle({ fillOpacity: 1 });
      });

      marker.on('mouseout', function() {
        this.setRadius(this._defaultStyle.radius);
        this.setStyle({ fillOpacity: this._defaultStyle.fillOpacity });
      });

      markersLayer.addLayer(marker);
      markerMap[metro.regionId] = marker;
    }
  }

  let markerMap = {};
  let prevHighlighted = null;

  $effect(() => {
    store.propertyType;
    store.yieldType;
    store.appData;
    store.optimizeBaseline;
    store.selectedRegionFilter;
    store.selectedStateFilter;
    store.endRegionFilter;
    store.endStateFilter;
    store.mode;
    updateMarkers();
  });

  // React to hoveredMetro from the optimize panel
  $effect(() => {
    const hovered = store.hoveredMetro;

    // Restore previous
    if (prevHighlighted && markerMap[prevHighlighted]) {
      const m = markerMap[prevHighlighted];
      m.setRadius(m._defaultStyle.radius);
      m.setStyle({
        fillColor: m._defaultStyle.fillColor,
        color: m._defaultStyle.color,
        weight: m._defaultStyle.weight,
        fillOpacity: m._defaultStyle.fillOpacity,
      });
      m.closeTooltip();
    }

    // Highlight new
    if (hovered && markerMap[hovered.regionId]) {
      const m = markerMap[hovered.regionId];
      m.setRadius(10);
      m.setStyle({
        color: '#fff',
        weight: 2,
        fillOpacity: 0.95,
      });
      m.bringToFront();
      m.openTooltip();

      // Pan map so the marker is visible
      if (map && hovered.lat && hovered.lng) {
        const point = map.latLngToContainerPoint([hovered.lat, hovered.lng]);
        const size = map.getSize();
        // Only pan if marker is outside the visible area (with padding)
        if (point.x < 40 || point.x > size.x - 40 || point.y < 40 || point.y > size.y - 40) {
          map.panTo([hovered.lat, hovered.lng], { animate: true, duration: 0.3 });
        }
      }

      prevHighlighted = hovered.regionId;
    } else {
      prevHighlighted = null;
    }
  });

  $effect(() => {
    store.panelOpen;
    if (map) {
      setTimeout(() => { try { map.invalidateSize(); } catch(e) {} }, 350);
    }
  });

  export function highlightMetro(metro) {
    if (map && metro.lat && metro.lng) {
      map.flyTo([metro.lat, metro.lng], 8, { duration: 0.8 });
    }
  }
</script>

<div class="map-wrapper">
  <div class="map-container" bind:this={mapContainer} id="map-view"></div>

  {#if store.appData}
    <div class="map-legend" id="map-legend">
      <div class="legend-title">{YIELD_LABELS[store.yieldType] || 'Yield'}</div>
      <div class="legend-bar-row">
        <span class="legend-value">{legendMin.toFixed(1)}%</span>
        <div class="legend-bar"></div>
        <span class="legend-value">{legendMax.toFixed(1)}%</span>
      </div>
      <div class="legend-labels">
        <span>Low</span>
        <span>Mid</span>
        <span>High</span>
      </div>
      <div class="legend-nodata">
        <span class="legend-dot-grey"></span>
        <span>No data</span>
      </div>
    </div>

    <!-- Bottom-left controls -->
    <div class="bottom-left-controls" id="bottom-left-controls">
      <div class="methodology-container" id="methodology">
        <button
          class="methodology-toggle"
          onclick={() => methodologyOpen = !methodologyOpen}
        >
          <span class="methodology-icon">📐</span>
          <span>Methodology</span>
          <span class="methodology-chevron" class:open={methodologyOpen}>▸</span>
        </button>

        {#if methodologyOpen}
          <div class="methodology-body">
            <div class="method-item">
              <div class="method-name">Rental Yield</div>
              <div class="method-formula">(Monthly Rent × 12) ÷ Asset Value × 100</div>
              <div class="method-desc">Annualized gross rental income as a percentage of current asset value.</div>
            </div>

            <div class="method-item">
              <div class="method-name">Appreciation Yield</div>
              <div class="method-formula">(Asset Value − Asset Value 12mo ago) ÷ Asset Value 12mo ago × 100</div>
              <div class="method-desc">Year-over-year percentage change in asset value. Only available for Single Family.</div>
            </div>

            <div class="method-item">
              <div class="method-name">Total Yield</div>
              <div class="method-formula">Rental Yield + Appreciation Yield</div>
              <div class="method-desc">Combined return from rental income and property value growth.</div>
            </div>

            <div class="method-divider"></div>

            <div class="method-source">
              <strong>Data</strong>: Zillow ZORI (rent) &amp; ZHVI (value), monthly, metro-level (MSA).
            </div>
            <div class="method-source">
              <strong>Coverage</strong>: ~900 US metros, 2015–present.
            </div>
          </div>
        {/if}
      </div>

      {#if onShowGuide}
        <button class="guide-btn-map" onclick={onShowGuide}>User Guide</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .map-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
  }

  .map-legend {
    position: absolute;
    bottom: 32px;
    right: 16px;
    z-index: 1000;
    background: rgba(17, 21, 32, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 12px 16px;
    min-width: 180px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .legend-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .legend-bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-bar {
    flex: 1;
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(to right, #e17055, #fdcb6e, #00b894);
  }

  .legend-value {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    min-width: 32px;
  }

  .legend-value:last-of-type {
    text-align: right;
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 9px;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .legend-nodata {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 10px;
    color: var(--text-muted);
  }

  .legend-dot-grey {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #888;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* --- Bottom-left controls --- */

  .bottom-left-controls {
    position: absolute;
    bottom: 32px;
    left: 16px;
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .methodology-container {
    max-width: 340px;
  }

  .guide-btn-map {
    padding: 8px 14px;
    background: rgba(17, 21, 32, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .guide-btn-map:hover {
    background: rgba(17, 21, 32, 0.95);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .methodology-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(17, 21, 32, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .methodology-toggle:hover {
    background: rgba(17, 21, 32, 0.95);
    color: var(--text-primary);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .methodology-icon {
    font-size: 14px;
  }

  .methodology-chevron {
    font-size: 10px;
    transition: transform 200ms ease;
    margin-left: auto;
  }

  .methodology-chevron.open {
    transform: rotate(90deg);
  }

  .methodology-body {
    margin-top: 6px;
    padding: 14px 16px;
    background: rgba(17, 21, 32, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: fadeIn 200ms ease;
  }

  .method-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .method-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .method-formula {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--accent-secondary);
    padding: 4px 8px;
    background: rgba(0, 206, 201, 0.06);
    border-radius: 4px;
    margin-top: 2px;
  }

  .method-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.5;
    margin-top: 2px;
  }

  .method-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .method-source {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .method-source strong {
    color: var(--text-secondary);
  }
</style>

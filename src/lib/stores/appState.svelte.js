/**
 * Global application state using Svelte 5 runes.
 * Uses a function-based pattern to allow cross-module reactivity.
 */

function createAppState() {
  let mode = $state('explore');
  let country = $state('US');
  let propertyType = $state('sf');
  let selectedRegion = $state(null);
  let panelOpen = $state(false);
  let yieldType = $state('total');
  let optimizeBaseline = $state(null);
  let optimizeEndPropertyType = $state('sf');
  let optimizeTopN = $state(25);
  let optimizeReady = $state(false);
  let appData = $state(null);
  let dataLoading = $state(true);
  let dataError = $state(null);
  let hoveredMetro = $state(null);
  let dealMetro = $state(null);
  let portfolioTarget = $state('total');

  return {
    get mode() { return mode; },
    set mode(v) { mode = v; },

    get country() { return country; },
    set country(v) { country = v; },

    get propertyType() { return propertyType; },
    set propertyType(v) { propertyType = v; },

    get selectedRegion() { return selectedRegion; },
    set selectedRegion(v) { selectedRegion = v; },

    get panelOpen() { return panelOpen; },
    set panelOpen(v) { panelOpen = v; },

    get yieldType() { return yieldType; },
    set yieldType(v) { yieldType = v; },

    get optimizeBaseline() { return optimizeBaseline; },
    set optimizeBaseline(v) { optimizeBaseline = v; },

    get optimizeEndPropertyType() { return optimizeEndPropertyType; },
    set optimizeEndPropertyType(v) { optimizeEndPropertyType = v; },

    get optimizeTopN() { return optimizeTopN; },
    set optimizeTopN(v) { optimizeTopN = v; },

    get optimizeReady() { return optimizeReady; },
    set optimizeReady(v) { optimizeReady = v; },

    get appData() { return appData; },
    set appData(v) { appData = v; },

    get dataLoading() { return dataLoading; },
    set dataLoading(v) { dataLoading = v; },

    get dataError() { return dataError; },
    set dataError(v) { dataError = v; },

    get hoveredMetro() { return hoveredMetro; },
    set hoveredMetro(v) { hoveredMetro = v; },

    get dealMetro() { return dealMetro; },
    set dealMetro(v) { dealMetro = v; },

    get portfolioTarget() { return portfolioTarget; },
    set portfolioTarget(v) { portfolioTarget = v; },

    // --- Actions ---
    selectRegion(metro) {
      selectedRegion = metro;
      panelOpen = true;
      if (mode === 'optimize' && !optimizeBaseline) {
        optimizeBaseline = metro;
      }
    },

    closePanel() {
      panelOpen = false;
      selectedRegion = null;
    },

    setMode(newMode) {
      mode = newMode;
      panelOpen = false;
      selectedRegion = null;
      optimizeBaseline = null;
      optimizeReady = false;
    },

    setOptimizeBaseline(metro) {
      optimizeBaseline = metro;
      optimizeReady = false;
    },

    runOptimize() {
      if (optimizeBaseline) {
        optimizeReady = true;
        panelOpen = true;
      }
    },

    clearOptimize() {
      optimizeBaseline = null;
      optimizeReady = false;
      panelOpen = false;
      selectedRegion = null;
    },
  };
}

export const store = createAppState();

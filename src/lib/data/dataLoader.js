/**
 * Data loader — fetches processed JSON and provides access functions.
 */

let cachedData = null;
let cachedHierarchy = null;

export async function loadData() {
  if (cachedData) return cachedData;

  const resp = await fetch('/data/processed-data.json');
  if (!resp.ok) throw new Error(`Failed to load data: ${resp.status}`);

  cachedData = await resp.json();
  return cachedData;
}

/**
 * Load the location hierarchy (countries, regions, states).
 */
export async function loadLocationHierarchy() {
  if (cachedHierarchy) return cachedHierarchy;

  const resp = await fetch('/data/locationHierarchy.json');
  if (!resp.ok) throw new Error(`Failed to load location hierarchy: ${resp.status}`);

  cachedHierarchy = await resp.json();
  return cachedHierarchy;
}

/**
 * Given the hierarchy and current filter selections, return the set of state
 * abbreviations that should be shown. Returns null if no filtering is active
 * (i.e. show everything).
 */
export function getFilteredStates(hierarchy, regionFilter, stateFilter) {
  if (!hierarchy) return null;

  // State filter is most specific — if set, only that state
  if (stateFilter) {
    return new Set([stateFilter]);
  }

  // Region filter — return all states in that region
  if (regionFilter && hierarchy.US?.regions?.[regionFilter]) {
    return new Set(hierarchy.US.regions[regionFilter].states);
  }

  // No filter active
  return null;
}

/**
 * Get the current yield value for a metro based on property type and yield type.
 * @param {object} metro
 * @param {'sf'|'mf'} propertyType
 * @param {'total'|'rental'|'appreciation'} yieldType
 * @returns {number|null}
 */
export function getYieldValue(metro, propertyType, yieldType) {
  const pt = metro[propertyType];
  if (!pt) return null;

  switch (yieldType) {
    case 'total': return pt.currentTotalYield;
    case 'rental': return pt.currentRentalYield;
    case 'app': return pt.currentAppreciationYield;
    default: return null;
  }
}

/**
 * Get the yield time series for a metro.
 * @param {object} metro
 * @param {'sf'|'mf'} propertyType
 * @param {'total'|'rental'|'appreciation'} yieldType
 * @returns {{dates: string[], values: number[]}}
 */
export function getYieldSeries(metro, propertyType, yieldType) {
  const pt = metro[propertyType];
  const empty = { dates: [], values: [] };
  if (!pt) return empty;

  switch (yieldType) {
    case 'total': return pt.totalYieldSeries || empty;
    case 'rental': return pt.rentalYieldSeries || empty;
    case 'app': return pt.appreciationYieldSeries || empty;
    default: return empty;
  }
}

/**
 * Get a color for a yield value based on a gradient.
 * Red (low/negative) → Yellow (medium) → Green (high)
 */
export function yieldToColor(value, min = -5, max = 15) {
  if (value == null) return '#555d72';

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (t < 0.5) {
    // Red to Yellow
    const s = t / 0.5;
    const r = Math.round(225 - s * 25);
    const g = Math.round(112 + s * 91);
    const b = Math.round(85 - s * 75);
    return `rgb(${r},${g},${b})`;
  } else {
    // Yellow to Green
    const s = (t - 0.5) / 0.5;
    const r = Math.round(200 - s * 200);
    const g = Math.round(203 - s * 19);
    const b = Math.round(10 + s * 138);
    return `rgb(${r},${g},${b})`;
  }
}

/**
 * Format yield value for display
 */
export function formatYield(value) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Mathematically measure historical volatility (Standard Deviation)
 */
export function calculateVolatility(values) {
  if (!values || values.length < 12) return NaN;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate the Pearson Correlation Coefficient between two datasets
 */
export function pearsonCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Measure Aggregate Internal Mathematical Correlation Matrix across entire array matrices.
 */
export function calculatePortfolioCorrelation(seriesMatrix) {
  const validSeries = seriesMatrix.filter(s => s && s.length > 5);
  if (validSeries.length < 2) return 0;
  
  let totalCorr = 0;
  let pairs = 0;
  
  const minLen = Math.min(...validSeries.map(s => s.length));
  
  for (let i = 0; i < validSeries.length; i++) {
    for (let j = i + 1; j < validSeries.length; j++) {
      const x = validSeries[i].slice(-minLen);
      const y = validSeries[j].slice(-minLen);
      const c = pearsonCorrelation(x, y);
      if (!isNaN(c)) {
        totalCorr += c;
        pairs++;
      }
    }
  }
  
  return pairs > 0 ? (totalCorr / pairs) : 0;
}

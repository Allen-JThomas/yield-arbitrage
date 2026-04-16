/**
 * Preprocessing script: reads 3 CSV data files and produces a single JSON
 * file with all metro data, yields, and coordinates for the frontend app.
 *
 * Usage: node scripts/preprocess.js
 * Output: public/data/processed-data.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { getMetroCoordinates } from './metro-coordinates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// --- File paths ---
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'processed-data.json');

const FILES = {
  sfRent: path.join(DATA_DIR, 'Metro_zori_rent_sf_monthly.csv'),
  mfRent: path.join(DATA_DIR, 'Metro_zori_rent_mf_monthly.csv'),
  sfValue: path.join(DATA_DIR, 'Metro_zhvi_sale_sf_monthly.csv'),
  mfValue: path.join(DATA_DIR, 'Metro_zhvi_sale_mf_monthly.csv'),
};

// --- Helpers ---
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  return result.data;
}

function extractTimeSeries(row, dateColumns) {
  const dates = [];
  const values = [];
  for (const col of dateColumns) {
    const val = parseFloat(row[col]);
    if (!isNaN(val)) {
      dates.push(col.slice(0, 7)); // YYYY-MM
      values.push(val);
    }
  }
  return { dates, values };
}

function getDateColumns(row) {
  return Object.keys(row).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
}

/** Shorten a full date to YYYY-MM */
function shortDate(d) { return d.slice(0, 7); }

/**
 * Compute rental yield time series.
 * Rental yield = (monthlyRent × 12) / homeValue × 100
 * Returns compact {dates:[], values:[]} format.
 */
function computeRentalYieldSeries(rentSeries, valueSeries) {
  if (!rentSeries.dates.length || !valueSeries.dates.length) return { dates: [], values: [] };

  const valueMap = new Map();
  for (let i = 0; i < valueSeries.dates.length; i++) {
    valueMap.set(valueSeries.dates[i], valueSeries.values[i]);
  }
  const dates = [];
  const values = [];

  for (let i = 0; i < rentSeries.dates.length; i++) {
    const value = valueMap.get(rentSeries.dates[i]);
    if (value && value > 0) {
      dates.push(rentSeries.dates[i]);
      values.push(parseFloat(((rentSeries.values[i] * 12) / value * 100).toFixed(2)));
    }
  }
  return { dates, values };
}

/**
 * Compute appreciation yield time series (YoY).
 * Appreciation yield = (value - value12MonthsAgo) / value12MonthsAgo × 100
 * Only includes dates >= minDate to keep output size manageable.
 */
function computeAppreciationYieldSeries(valueSeries, minDate = '2015-01') {
  if (valueSeries.dates.length < 13) return { dates: [], values: [] };

  const dates = [];
  const values = [];
  for (let i = 12; i < valueSeries.dates.length; i++) {
    if (valueSeries.dates[i] < minDate) continue;
    const current = valueSeries.values[i];
    const previous = valueSeries.values[i - 12];
    if (previous && previous > 0) {
      dates.push(valueSeries.dates[i]);
      values.push(parseFloat(((current - previous) / previous * 100).toFixed(2)));
    }
  }
  return { dates, values };
}

/**
 * Compute total yield = rental + appreciation for matching dates
 */
function computeTotalYieldSeries(rentalYieldSeries, appreciationYieldSeries) {
  if (!rentalYieldSeries.dates.length) return appreciationYieldSeries;
  if (!appreciationYieldSeries.dates.length) return rentalYieldSeries;

  const appreciationMap = new Map();
  for (let i = 0; i < appreciationYieldSeries.dates.length; i++) {
    appreciationMap.set(appreciationYieldSeries.dates[i], appreciationYieldSeries.values[i]);
  }
  const dates = [];
  const values = [];

  for (let i = 0; i < rentalYieldSeries.dates.length; i++) {
    const ay = appreciationMap.get(rentalYieldSeries.dates[i]);
    if (ay !== undefined) {
      dates.push(rentalYieldSeries.dates[i]);
      values.push(parseFloat((rentalYieldSeries.values[i] + ay).toFixed(2)));
    }
  }
  return { dates, values };
}

function getLatest(series) {
  if (!series.values || !series.values.length) return null;
  return series.values[series.values.length - 1];
}

// --- Main ---
function main() {
  console.log('📊 Preprocessing Zillow data...\n');

  // Parse CSVs
  const sfRentRows = parseCSV(FILES.sfRent);
  const mfRentRows = parseCSV(FILES.mfRent);
  const sfValueRows = parseCSV(FILES.sfValue);
  const mfValuePathMatches = fs.existsSync(FILES.mfValue);
  const mfValueRows = mfValuePathMatches ? parseCSV(FILES.mfValue) : [];

  console.log(`  SF Rent:  ${sfRentRows.length} rows`);
  console.log(`  MF Rent:  ${mfRentRows.length} rows`);
  console.log(`  SF Value: ${sfValueRows.length} rows`);
  if (mfValuePathMatches) console.log(`  MF Value: ${mfValueRows.length} rows`);

  // Get date columns
  const sfRentDates = getDateColumns(sfRentRows[0]);
  const mfRentDates = getDateColumns(mfRentRows[0]);
  const sfValueDates = getDateColumns(sfValueRows[0]);
  const mfValueDates = mfValuePathMatches ? getDateColumns(mfValueRows[0]) : sfValueDates;

  console.log(`\n  SF Rent dates:  ${sfRentDates[0]} → ${sfRentDates[sfRentDates.length - 1]} (${sfRentDates.length} months)`);
  console.log(`  MF Rent dates:  ${mfRentDates[0]} → ${mfRentDates[mfRentDates.length - 1]} (${mfRentDates.length} months)`);
  console.log(`  SF Value dates: ${sfValueDates[0]} → ${sfValueDates[sfValueDates.length - 1]} (${sfValueDates.length} months)`);
  if (mfValuePathMatches) console.log(`  MF Value dates: ${mfValueDates[0]} → ${mfValueDates[mfValueDates.length - 1]} (${mfValueDates.length} months)`);

  // Index rows by RegionID
  const sfRentMap = new Map(sfRentRows.map(r => [r.RegionID, r]));
  const mfRentMap = new Map(mfRentRows.map(r => [r.RegionID, r]));
  const sfValueMap = new Map(sfValueRows.map(r => [r.RegionID, r]));
  const mfValueMap = new Map(mfValueRows.map(r => [r.RegionID, r]));

  // Collect all unique region IDs (excluding the country-level row)
  const allRegionIds = new Set();
  const regionMeta = new Map();

  for (const rows of [sfRentRows, mfRentRows, sfValueRows, mfValueRows]) {
    for (const row of rows) {
      if (row.RegionType === 'msa') {
        allRegionIds.add(row.RegionID);
        if (!regionMeta.has(row.RegionID)) {
          regionMeta.set(row.RegionID, {
            regionId: row.RegionID,
            regionName: row.RegionName,
            stateName: row.StateName,
            sizeRank: parseInt(row.SizeRank) || 999,
          });
        }
      }
    }
  }

  console.log(`\n  Unique MSAs: ${allRegionIds.size}`);

  // Process each metro
  const metros = [];
  let missingCoords = 0;

  for (const regionId of allRegionIds) {
    const meta = regionMeta.get(regionId);
    const coords = getMetroCoordinates(meta.regionName, meta.stateName);

    if (!coords) {
      missingCoords++;
      console.warn(`  ⚠️  No coordinates for: ${meta.regionName} (${meta.stateName})`);
      continue;
    }

    const sfRentRow = sfRentMap.get(regionId);
    const mfRentRow = mfRentMap.get(regionId);
    const sfValueRow = sfValueMap.get(regionId);
    const mfValueRow = mfValuePathMatches ? mfValueMap.get(regionId) : undefined;

    const EMPTY = { dates: [], values: [] };
    const sfRentSeries = sfRentRow ? extractTimeSeries(sfRentRow, sfRentDates) : EMPTY;
    const mfRentSeries = mfRentRow ? extractTimeSeries(mfRentRow, mfRentDates) : EMPTY;
    const sfValueSeries = sfValueRow ? extractTimeSeries(sfValueRow, sfValueDates) : EMPTY;
    const mfValueSeries = mfValueRow ? extractTimeSeries(mfValueRow, mfValueDates) : sfValueSeries;

    // Compute yields for SF
    const sf = {};
    sf.rentalYieldSeries = computeRentalYieldSeries(sfRentSeries, sfValueSeries);
    sf.appreciationYieldSeries = computeAppreciationYieldSeries(sfValueSeries);
    sf.totalYieldSeries = computeTotalYieldSeries(sf.rentalYieldSeries, sf.appreciationYieldSeries);
    sf.currentRent = getLatest(sfRentSeries);
    sf.currentValue = getLatest(sfValueSeries);
    sf.currentRentalYield = getLatest(sf.rentalYieldSeries);
    sf.currentAppreciationYield = getLatest(sf.appreciationYieldSeries);
    sf.currentTotalYield = sf.currentRentalYield != null && sf.currentAppreciationYield != null
      ? parseFloat((sf.currentRentalYield + sf.currentAppreciationYield).toFixed(3))
      : sf.currentRentalYield;
    sf.hasAppreciation = sf.appreciationYieldSeries.dates.length > 0;

    // Compute yields for MF
    const mf = {};
    mf.rentalYieldSeries = computeRentalYieldSeries(mfRentSeries, mfValueSeries);
    mf.currentRent = getLatest(mfRentSeries);
    mf.currentValue = mfValuePathMatches ? getLatest(mfValueSeries) : sf.currentValue;
    mf.currentRentalYield = getLatest(mf.rentalYieldSeries);
    mf.appreciationYieldSeries = mfValuePathMatches ? computeAppreciationYieldSeries(mfValueSeries) : sf.appreciationYieldSeries;
    mf.currentAppreciationYield = mfValuePathMatches ? getLatest(mf.appreciationYieldSeries) : sf.currentAppreciationYield;
    mf.hasAppreciation = mfValuePathMatches ? mf.appreciationYieldSeries.dates.length > 0 : sf.hasAppreciation;
    mf.totalYieldSeries = computeTotalYieldSeries(mf.rentalYieldSeries, mf.appreciationYieldSeries);
    mf.currentTotalYield = (mf.currentRentalYield != null && mf.currentAppreciationYield != null)
      ? parseFloat((mf.currentRentalYield + mf.currentAppreciationYield).toFixed(3))
      : (mf.currentRentalYield ?? mf.currentAppreciationYield);

    metros.push({
      regionId: meta.regionId,
      regionName: meta.regionName,
      stateName: meta.stateName,
      sizeRank: meta.sizeRank,
      lat: coords.lat,
      lng: coords.lng,
      sf,
      mf,
    });
  }

  // Sort by sizeRank
  metros.sort((a, b) => a.sizeRank - b.sizeRank);

  // Build output
  const output = {
    generatedAt: new Date().toISOString(),
    country: 'US',
    totalMetros: metros.length,
    dateRange: {
      sfRent: { start: sfRentDates[0], end: sfRentDates[sfRentDates.length - 1] },
      mfRent: { start: mfRentDates[0], end: mfRentDates[mfRentDates.length - 1] },
      sfValue: { start: sfValueDates[0], end: sfValueDates[sfValueDates.length - 1] },
    },
    metros,
  };

  // Write output
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

  const fileSizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Done! Wrote ${metros.length} metros to ${OUTPUT_FILE}`);
  console.log(`   File size: ${fileSizeMB} MB`);
  if (missingCoords > 0) {
    console.log(`   ⚠️  ${missingCoords} metros skipped (missing coordinates)`);
  }
}

main();

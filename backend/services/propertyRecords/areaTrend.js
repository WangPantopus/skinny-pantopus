'use strict';

/**
 * The area's price change, from the FHFA House Price Index: one state's file at a
 * time under <root>/area-trends (scripts/property-index/build-area-trends.cjs). It is
 * a price-change index for a ZIP or a county: never a home's value, never a median
 * sale price, and a ZIP with no number and no county behind it has no trend at all.
 *
 * It answers null rather than wait or fail, so no card waits on it: a first read
 * that takes too long finishes in the background and the next card has it.
 */

const zlib = require('zlib');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const { createReader, createStorage, StorageUnavailable } = require('./reader');
const { zip5, stateCode } = require('./addressKey');

const SOURCE = 'FHFA House Price Index';
const FIRST_READ_MS = 400;
// A state's file is a few KB: every state fits in memory on the small server.
const KEPT_STATES = 56;
const FLAT_WITHIN = 0.5;
// What the apps in the stores call flat, up and down: the ±2% band of their ZIP trend.
const OLD_BUILD_FLAT_WITHIN = 2;

let shared = null;
function reader() {
  if (!shared) shared = createReader(createStorage(`${config.manifestUrl.replace(/\/+$/, '')}/area-trends`), { keptFiles: KEPT_STATES });
  return shared;
}

const gunzipJson = (bytes) => JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));

function stateFile(state) {
  const read = reader().file(`${state}.json.gz`, gunzipJson);
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(resolve, FIRST_READ_MS, null); });
  return Promise.race([read, late]).finally(() => clearTimeout(timer));
}

/**
 * @param {{ state: string, zip: string, fips?: string|null }} area  `fips`: the county the record names, over the ZIP's largest county.
 * @returns {Promise<null|{ scope: 'zip'|'county', change_pct: number, year: number, source: string }>}
 */
async function lookup({ state, zip, fips = null }) {
  if (!config.areaTrendEnabled()) return null;
  const code = stateCode(state);
  const zipCode = zip5(zip);
  if (!code || !zipCode) return null;
  try {
    const file = await stateFile(code);
    if (!file) return null;
    const own = file.zips?.[zipCode];
    if (Number.isFinite(own)) return { scope: 'zip', change_pct: own, year: file.year, source: SOURCE };
    const county = file.counties?.[fips || file.zip_county?.[zipCode]];
    return Number.isFinite(county) ? { scope: 'county', change_pct: county, year: file.year, source: SOURCE } : null;
  } catch (err) {
    if (!(err instanceof StorageUnavailable)) logger.warn('property_records.area_trend_failed', { error: err.name });
    return null;
  }
}

const directionOf = (change, within) => {
  if (change > within) return 'up';
  return change < -within ? 'down' : 'flat';
};

/** "Prices in this ZIP rose 3.1% in 2025 (FHFA House Price Index)." */
function describe(trend) {
  if (!trend) return null;
  const where = trend.scope === 'zip' ? 'this ZIP' : 'this county';
  const direction = directionOf(trend.change_pct, FLAT_WITHIN);
  const size = `${Math.abs(trend.change_pct).toFixed(1)}%`;
  const what = direction === 'flat' ? 'held about steady' : `${direction === 'up' ? 'rose' : 'fell'} ${size}`;
  return {
    direction,
    scope: trend.scope,
    change_pct: trend.change_pct,
    year: trend.year,
    label: `Prices in ${where} ${what} in ${trend.year} (${trend.source}).`,
    note: 'An area\'s price change, not your home\'s value.',
  };
}

/** For the apps in the stores, whose words are "in your ZIP": a ZIP's own number or nothing, never a default. */
const oldBuildDirection = (trend) => (trend?.scope === 'zip' ? directionOf(trend.change_pct, OLD_BUILD_FLAT_WITHIN) : null);

module.exports = { lookup, describe, oldBuildDirection };

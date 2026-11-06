/**
 * Where Pantopus's own property index is and which counties use it. Everything
 * reads these switches here, and nowhere else (services/propertyRecords).
 *
 *   PROPERTY_RECORDS_MANIFEST_URL          The index's root, s3://bucket/prefix or file:///dir. Empty: the index is off.
 *   PROPERTY_RECORDS_SHADOW_JURISDICTIONS  County FIPS codes looked up beside today's path: counts in the log, nothing shown.
 *   PROPERTY_RECORDS_LIVE_JURISDICTIONS    County FIPS codes served from the record. A live county never calls ATTOM.
 *   PROPERTY_ESTIMATES_ENABLED             1: homes with no record see the labeled national estimates, from <root>/estimates.
 *   PROPERTY_INDEX_AWS_ACCESS_KEY_ID, PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY, PROPERTY_INDEX_REGION  The read-only key.
 *
 * Both lists are empty by default, and a county on both is live.
 */

const logger = require('../utils/logger');
const { stateOfCounty } = require('../services/propertyRecords/addressKey');

const env = (key) => (process.env[key] || '').trim();

function fipsList(key) {
  return new Set(env(key).split(',').map((fips) => fips.trim()).filter((fips) => /^\d{5}$/.test(fips)));
}

const manifestUrl = env('PROPERTY_RECORDS_MANIFEST_URL');
const shadow = fipsList('PROPERTY_RECORDS_SHADOW_JURISDICTIONS');
const live = fipsList('PROPERTY_RECORDS_LIVE_JURISDICTIONS');

/** 'off', 'shadow' or 'live' for a county. Nothing is on without an index to read. */
function modeFor(fips) {
  if (!manifestUrl) return 'off';
  if (live.has(fips)) return 'live';
  return shadow.has(fips) ? 'shadow' : 'off';
}

const enabled = () => Boolean(manifestUrl);
const anyLive = () => Boolean(manifestUrl) && live.size > 0;
/** Whether a state has a live county, so a Home elsewhere never touches storage. */
const liveState = (state) => Boolean(manifestUrl) && [...live].some((fips) => stateOfCounty(fips) === state);
const estimatesEnabled = () => Boolean(manifestUrl) && env('PROPERTY_ESTIMATES_ENABLED') === '1';
const anyShadow = () => Boolean(manifestUrl) && [...shadow].some((fips) => !live.has(fips));

if (manifestUrl) {
  logger.info('property_records.config', { shadow: [...shadow], live: [...live], estimates: estimatesEnabled() });
}

module.exports = {
  manifestUrl,
  region: env('PROPERTY_INDEX_REGION') || 'us-west-2',
  accessKeyId: env('PROPERTY_INDEX_AWS_ACCESS_KEY_ID'),
  secretAccessKey: env('PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY'),
  modeFor,
  enabled,
  estimatesEnabled,
  anyLive,
  liveState,
  anyShadow,
};

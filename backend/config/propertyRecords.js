/**
 * Where Pantopus's own property index is and which counties use it, as this server's environment says.
 * What actually serves now is the router's answer (services/propertyRecords/router.js), which starts from these lists
 * and follows the index's switch file, so a county can move without touching a server.
 *
 *   PROPERTY_RECORDS_MANIFEST_URL          The index's root, s3://bucket/prefix or file:///dir. Empty: the index is off.
 *   PROPERTY_RECORDS_SHADOW_JURISDICTIONS  County FIPS codes looked up beside today's path: counts in the log, nothing shown.
 *   PROPERTY_RECORDS_LIVE_JURISDICTIONS    County FIPS codes served from the record. A live county never calls ATTOM.
 *   PROPERTY_RECORDS_SWITCHES              Which switch file this server follows, switches/<name>.json. Default: APP_ENV.
 *   VALUE_AREA_TREND                       1: owners' value cards show the area's price change, from <root>/area-trends, in every county.
 *   VALUE_ESTIMATES                        on: Pantopus estimates show, in each county its live switch has live. Anything else: none, anywhere.
 *   VALUE_NEIGHBORHOOD_FIGURES             1: owners' value cards show the Census Bureau's figures for the ZIP where a home has no estimate.
 *   PROPERTY_INDEX_AWS_ACCESS_KEY_ID, PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY, PROPERTY_INDEX_REGION  The read-only key.
 *   ATTOM_STAND_IN                         '1' only on a local rig whose stand-in answers for ATTOM. See below.
 *
 * Both lists are empty by default, and a county on both is live.
 */

const logger = require('../utils/logger');

const env = (key) => (process.env[key] || '').trim();

// Servers don't call ATTOM, whatever an env file still holds. Every ATTOM path
// treats a missing key as "not configured", so it reads as missing. Emptied, not deleted: dotenv won't fill it back in.
if (process.env.ATTOM_API_KEY && process.env.NODE_ENV !== 'test' && env('ATTOM_STAND_IN') !== '1') {
  process.env.ATTOM_API_KEY = '';
  logger.warn('property_records.attom_key_ignored');
}

function fipsList(key) {
  return new Set(env(key).split(',').map((fips) => fips.trim()).filter((fips) => /^\d{5}$/.test(fips)));
}

const manifestUrl = env('PROPERTY_RECORDS_MANIFEST_URL');
const shadow = fipsList('PROPERTY_RECORDS_SHADOW_JURISDICTIONS');
const live = fipsList('PROPERTY_RECORDS_LIVE_JURISDICTIONS');
const switchesName = env('PROPERTY_RECORDS_SWITCHES') || env('APP_ENV') || 'local';

/** Each county this server's environment lists, and its mode. */
function listedModes() {
  const modes = new Map();
  for (const fips of shadow) modes.set(fips, 'shadow');
  for (const fips of live) modes.set(fips, 'live');
  return modes;
}

const enabled = () => Boolean(manifestUrl);
const areaTrendEnabled = () => Boolean(manifestUrl) && env('VALUE_AREA_TREND') === '1';
const estimatesOn = () => env('VALUE_ESTIMATES') === 'on';
const neighborhoodFiguresEnabled = () => Boolean(manifestUrl) && env('VALUE_NEIGHBORHOOD_FIGURES') === '1';

if (manifestUrl) {
  logger.info('property_records.config', { shadow: [...shadow], live: [...live], switches: switchesName, area_trend: areaTrendEnabled(), estimates: estimatesOn(), neighborhood_figures: neighborhoodFiguresEnabled() });
}

module.exports = {
  manifestUrl,
  region: env('PROPERTY_INDEX_REGION') || 'us-west-2',
  accessKeyId: env('PROPERTY_INDEX_AWS_ACCESS_KEY_ID'),
  secretAccessKey: env('PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY'),
  switchesName,
  listedModes,
  enabled,
  areaTrendEnabled,
  estimatesOn,
  neighborhoodFiguresEnabled,
};

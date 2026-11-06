/**
 * Pantopus's own address registry: which states use it, and how. Everything reads these switches here, and nowhere else
 * (services/propertyRecords/registry.js). Off by default; shadow first, state by state.
 *
 *   ADDRESS_REGISTRY_URL            The registry's root, s3://bucket/prefix or file:///dir. Empty: <PROPERTY_RECORDS_MANIFEST_URL>/registry.
 *   ADDRESS_REGISTRY_SHADOW_STATES  State codes looked up beside today's path: counts in the log, nothing shown.
 *   ADDRESS_REGISTRY_LIVE_STATES    State codes whose Add Home and Place use the registry's units.
 *   ADDRESS_REGISTRY_COORDINATES    'on': the daily job replaces Google coordinates older than 30 days in live states with
 *                                   registry points. 'shadow': it counts what it would replace and changes nothing. Anything else: off.
 *
 * A state on both lists is live. Storage and keys are the property index's (config/propertyRecords.js).
 */

const logger = require('../utils/logger');

const env = (key) => (process.env[key] || '').trim();

function stateList(key) {
  return new Set(env(key).split(',').map((state) => state.trim().toUpperCase()).filter((state) => /^[A-Z]{2}$/.test(state)));
}

const manifestUrl = env('PROPERTY_RECORDS_MANIFEST_URL').replace(/\/+$/, '');
const url = env('ADDRESS_REGISTRY_URL') || (manifestUrl ? `${manifestUrl}/registry` : '');
const shadow = stateList('ADDRESS_REGISTRY_SHADOW_STATES');
const live = stateList('ADDRESS_REGISTRY_LIVE_STATES');
const coordinates = env('ADDRESS_REGISTRY_COORDINATES').toLowerCase();

/** 'off', 'shadow' or 'live' for a state. Nothing is on without a registry to read. */
function modeFor(state) {
  if (!url) return 'off';
  if (live.has(state)) return 'live';
  return shadow.has(state) ? 'shadow' : 'off';
}

const coordinatesMode = () => (url && (coordinates === 'on' || coordinates === 'shadow') ? coordinates : 'off');

if (url) logger.info('address_registry.config', { shadow: [...shadow], live: [...live], coordinates: coordinatesMode() });

module.exports = { url, modeFor, coordinatesMode };

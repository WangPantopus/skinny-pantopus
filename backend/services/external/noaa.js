/**
 * NOAA Weather Alerts Connector
 *
 * Fetches active weather alerts from the National Weather Service (NWS)
 * API for a given lat/lng. Free API, no key required.
 *
 * Docs: https://www.weather.gov/documentation/services-web-api
 * Endpoint: GET https://api.weather.gov/alerts/active?point={lat},{lng}
 *
 * Normalises raw NWS GeoJSON features into WeatherAlert objects.
 */
const logger = require('../../utils/logger');
const { getCache, setCache } = require('./cacheHelper');

const PROVIDER = 'NOAA_ALERTS';
const TTL_MINUTES = 10;
const FETCH_TIMEOUT_MS = 5000;

/**
 * @typedef {Object} WeatherAlert
 * @property {string} id          NWS alert ID
 * @property {string} event       e.g. "Wind Advisory"
 * @property {string} severity    minor | moderate | severe | extreme | unknown
 * @property {string} headline    Short headline
 * @property {string} description Full description text
 * @property {string} instruction Protective action guidance
 * @property {string} onset       ISO 8601 onset time
 * @property {string} expires     ISO 8601 expiry time
 * @property {string[]} areas     Affected areas
 */

/**
 * Map NWS severity to our normalised severity levels.
 */
function normaliseSeverity(nwsSeverity) {
  const map = {
    Extreme: 'extreme',
    Severe: 'severe',
    Moderate: 'moderate',
    Minor: 'minor',
  };
  return map[nwsSeverity] || 'unknown';
}

/**
 * Normalise a single NWS GeoJSON feature into a WeatherAlert.
 */
function normaliseFeature(feature) {
  const p = feature.properties || {};
  return {
    id: p.id || feature.id || '',
    event: p.event || 'Unknown alert',
    severity: normaliseSeverity(p.severity),
    headline: p.headline || p.event || '',
    description: (p.description || '').slice(0, 500),
    instruction: (p.instruction || '').slice(0, 300),
    onset: p.onset || p.effective || '',
    expires: p.expires || p.ends || '',
    areas: p.areaDesc ? p.areaDesc.split('; ') : [],
  };
}

/**
 * Fetch active NOAA weather alerts for a latitude/longitude.
 * Uses ExternalFeedCache for caching with a 10-minute TTL.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ alerts: WeatherAlert[], source: 'cache'|'live', fetchedAt: string }>}
 */
async function fetchAlerts(lat, lng) {
  const placeKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  // 1. Check cache
  const cached = await getCache(PROVIDER, placeKey);
  if (cached) {
    return {
      alerts: cached.payload.normalized || [],
      source: 'cache',
      fetchedAt: cached.fetchedAt,
    };
  }

  // 2. Fetch live from NWS
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': '(Pantopus, admin@pantopus.app)',   // NWS requires a contact User-Agent
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('NOAA API error', { status: res.status, url });
      return { alerts: [], source: 'error', fetchedAt: new Date().toISOString() };
    }

    const raw = await res.json();
    const features = raw.features || [];
    const normalized = features.map(normaliseFeature);

    // 3. Cache the result
    await setCache(PROVIDER, placeKey, { raw, normalized }, TTL_MINUTES);

    return {
      alerts: normalized,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('NOAA fetch timeout', { lat, lng });
    } else {
      logger.error('NOAA fetch error', { lat, lng, error: err.message });
    }
    return { alerts: [], source: 'error', fetchedAt: new Date().toISOString() };
  }
}

module.exports = { fetchAlerts, PROVIDER, TTL_MINUTES };

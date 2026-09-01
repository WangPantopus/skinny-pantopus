/**
 * AirNow Air Quality Connector
 *
 * Fetches current AQI readings from the EPA AirNow API for a given
 * lat/lng. Free API key required (register at airnowapi.org).
 *
 * Docs: https://docs.airnowapi.org/CurrentObservationsByLatLon/docs
 * Endpoint: GET https://www.airnowapi.org/aq/observation/latLong/current/
 *
 * Normalises raw AirNow observations into an AQI object.
 *
 * Environment variables:
 *   AIRNOW_API_KEY — Free API key from airnowapi.org (optional)
 */
const logger = require('../../utils/logger');
const { getCache, setCache } = require('./cacheHelper');

const PROVIDER = 'AIRNOW_AQI';
const TTL_MINUTES = 30;
const FETCH_TIMEOUT_MS = 5000;

/**
 * @typedef {Object} AQIReading
 * @property {number}  aqi            AQI value (0–500)
 * @property {string}  category       e.g. "Good", "Moderate", "Unhealthy"
 * @property {string}  pollutant      e.g. "PM2.5", "O3"
 * @property {string}  reporting_area Monitoring station area name
 * @property {string}  color          Hex colour for the AQI category
 */

/**
 * Map AQI category index (1–6) to a human-readable label.
 */
const CATEGORY_MAP = {
  1: 'Good',
  2: 'Moderate',
  3: 'Unhealthy for Sensitive Groups',
  4: 'Unhealthy',
  5: 'Very Unhealthy',
  6: 'Hazardous',
};

/**
 * Map AQI category index (1–6) to a hex colour for UI rendering.
 */
const COLOR_MAP = {
  1: '#00E400',   // green
  2: '#FFFF00',   // yellow
  3: '#FF7E00',   // orange
  4: '#FF0000',   // red
  5: '#8F3F97',   // purple
  6: '#7E0023',   // maroon
};

/**
 * Normalise a single AirNow observation into an AQIReading.
 */
function normaliseObservation(obs) {
  const catIdx = obs.Category?.Number || 0;
  return {
    aqi: obs.AQI ?? null,
    category: CATEGORY_MAP[catIdx] || obs.Category?.Name || 'Unknown',
    pollutant: obs.ParameterName || 'Unknown',
    reporting_area: obs.ReportingArea || '',
    color: COLOR_MAP[catIdx] || '#999999',
  };
}

/**
 * Pick the primary observation from a list. AirNow returns one per pollutant;
 * choose the one with the highest AQI (worst air quality) as the headline.
 */
function pickPrimary(observations) {
  if (!observations || observations.length === 0) return null;
  return observations.reduce((worst, obs) =>
    (obs.aqi > worst.aqi ? obs : worst)
  );
}

/**
 * Fetch current AQI for a latitude/longitude.
 * Uses ExternalFeedCache for caching with a 30-minute TTL.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ aqi: AQIReading|null, source: 'cache'|'live'|'error'|'unavailable', fetchedAt: string|null }>}
 */
async function fetchAQI(lat, lng) {
  const apiKey = process.env.AIRNOW_API_KEY;
  if (!apiKey) {
    return { aqi: null, source: 'unavailable', fetchedAt: null };
  }

  const placeKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  // 1. Check cache
  const cached = await getCache(PROVIDER, placeKey);
  if (cached) {
    return {
      aqi: cached.payload.normalized || null,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
    };
  }

  // 2. Fetch live from AirNow
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      format: 'application/json',
      latitude: lat,
      longitude: lng,
      distance: '25',
      API_KEY: apiKey,
    });
    const url = `https://www.airnowapi.org/aq/observation/latLong/current/?${params}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('AirNow API error', { status: res.status, url });
      return { aqi: null, source: 'error', fetchedAt: new Date().toISOString() };
    }

    const raw = await res.json();
    const observations = (Array.isArray(raw) ? raw : []).map(normaliseObservation);
    const normalized = pickPrimary(observations);

    // 3. Cache the result
    await setCache(PROVIDER, placeKey, { raw, normalized }, TTL_MINUTES);

    return {
      aqi: normalized,
      source: 'live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('AirNow fetch timeout', { lat, lng });
    } else {
      logger.error('AirNow fetch error', { lat, lng, error: err.message });
    }
    return { aqi: null, source: 'error', fetchedAt: new Date().toISOString() };
  }
}

module.exports = { fetchAQI, normaliseObservation, pickPrimary, PROVIDER, TTL_MINUTES };

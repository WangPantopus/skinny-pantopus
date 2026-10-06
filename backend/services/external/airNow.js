/**
 * AirNow Air Quality Connector
 *
 * Fetches current AQI readings from the EPA AirNow API for a given
 * lat/lng. Free API key required (register at docs.airnowapi.org).
 *
 * AirNow retired /aq/observation/latLong/current/ on September 30, 2026; it
 * now answers HTTP 410. Its documented replacement, "Current Observations by
 * Latitude/Longitude or ZIP Code", takes the same key:
 *   GET https://www.airnowapi.org/aq/observation/current/ziplatlong/
 * It returns one NowCast AQI per pollutant from the closest reporting monitor
 * within 50 miles, with camelCase fields (nowcastAQI, aqiCategoryName,
 * parameterName, reportingAreaName, dateObserved, hourObserved,
 * localTimeZone) and no category number.
 *
 * Normalises raw AirNow observations into an AQI object.
 *
 * Environment variables:
 *   AIRNOW_API_KEY — AirNow API key (optional; AIRNOW_KEY is accepted as an alias)
 */
const logger = require('../../utils/logger');
const { getCache, setCache } = require('./cacheHelper');

const PROVIDER = 'AIRNOW_AQI';
const TTL_MINUTES = 30;
// A failed lookup is remembered briefly so an outage doesn't add a timeout to
// every Today request in that area.
const ERROR_TTL_MINUTES = 5;
const FETCH_TIMEOUT_MS = 5000;
const ENDPOINT = 'https://www.airnowapi.org/aq/observation/current/ziplatlong/';

/**
 * @typedef {Object} AQIReading
 * @property {number}      aqi            AQI value (0–500)
 * @property {string}      category       e.g. "Good", "Moderate", "Unhealthy"
 * @property {string}      pollutant      e.g. "PM2.5", "O3"
 * @property {string}      reporting_area Reporting area name, e.g. "Vancouver"
 * @property {string}      color          Hex colour for the AQI category
 * @property {string|null} observed_at    ISO 8601 start of the observed hour, when known
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

// The service no longer sends a category number, so the EPA AQI breakpoints
// decide it.
function categoryIndex(aqi) {
  if (aqi <= 50) return 1;
  if (aqi <= 100) return 2;
  if (aqi <= 150) return 3;
  if (aqi <= 200) return 4;
  if (aqi <= 300) return 5;
  return 6;
}

// Keep the pollutant names consumers already show ("O3", not "OZONE").
const POLLUTANT_NAMES = { OZONE: 'O3', O3: 'O3', 'PM2.5': 'PM2.5', PM25: 'PM2.5', PM10: 'PM10', CO: 'CO', NO2: 'NO2', SO2: 'SO2' };

// UTC offsets (hours) for the zone abbreviations AirNow reports.
const ZONE_OFFSETS = {
  EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7,
  AKST: -9, AKDT: -8, HST: -10, HDT: -9, AST: -4, ADT: -3, SST: -11, CHST: 10,
};

/**
 * The observed hour as an ISO 8601 UTC instant, or null when the date, hour
 * or zone can't be read.
 */
function observedAt(obs) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(obs.dateObserved || '').trim());
  const hour = Number.parseInt(String(obs.hourObserved ?? '').trim(), 10);
  const offset = ZONE_OFFSETS[String(obs.localTimeZone || '').trim().toUpperCase()];
  if (!date || !Number.isInteger(hour) || hour < 0 || hour > 23 || offset === undefined) return null;
  const ms = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour) - offset * 3600 * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Normalise a single AirNow observation into an AQIReading. AirNow marks a
 * missing value with a negative number, which becomes null.
 */
function normaliseObservation(obs) {
  const value = Number(obs.nowcastAQI);
  const aqi = obs.nowcastAQI != null && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  const idx = aqi === null ? 0 : categoryIndex(aqi);
  const parameter = String(obs.parameterName || '').trim();
  return {
    aqi,
    category: CATEGORY_MAP[idx] || obs.aqiCategoryName || 'Unknown',
    pollutant: POLLUTANT_NAMES[parameter.toUpperCase()] || parameter || 'Unknown',
    reporting_area: obs.reportingAreaName || '',
    color: COLOR_MAP[idx] || '#999999',
    observed_at: observedAt(obs),
  };
}

/**
 * Pick the primary observation from a list. AirNow returns one per pollutant;
 * choose the one with the highest AQI (worst air quality) as the headline.
 */
function pickPrimary(observations) {
  const readings = (observations || []).filter((obs) => obs && obs.aqi !== null && obs.aqi !== undefined);
  if (readings.length === 0) return null;
  return readings.reduce((worst, obs) => (obs.aqi > worst.aqi ? obs : worst));
}

function apiKey() {
  return process.env.AIRNOW_API_KEY || process.env.AIRNOW_KEY || '';
}

/**
 * Cache key for the area around a point: two decimals is about 1 km, well
 * inside the 50-mile monitor lookup, so nearby addresses share one reading.
 */
function areaKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Fetch current AQI for a latitude/longitude.
 * Uses ExternalFeedCache for caching with a 30-minute TTL per area.
 *
 * `source` is 'live' or 'cache' when AirNow answered (aqi is null when no
 * monitor reports near the point), 'error' when it failed, and 'unavailable'
 * when no key is configured.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ aqi: AQIReading|null, source: 'cache'|'live'|'error'|'unavailable', fetchedAt: string|null }>}
 */
async function fetchAQI(lat, lng) {
  const key = apiKey();
  if (!key) {
    return { aqi: null, source: 'unavailable', fetchedAt: null };
  }

  const placeKey = areaKey(lat, lng);

  // 1. Check cache
  const cached = await getCache(PROVIDER, placeKey);
  if (cached) {
    if (cached.payload?.failed) {
      return { aqi: null, source: 'error', fetchedAt: cached.fetchedAt };
    }
    return {
      aqi: cached.payload?.normalized || null,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
    };
  }

  const failed = async () => {
    await setCache(PROVIDER, placeKey, { failed: true }, ERROR_TTL_MINUTES);
    return { aqi: null, source: 'error', fetchedAt: new Date().toISOString() };
  };

  // 2. Fetch live from AirNow
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      format: 'application/json',
      latitude: String(lat),
      longitude: String(lng),
      API_KEY: key,
    });

    let res;
    let raw;
    try {
      res = await fetch(`${ENDPOINT}?${params}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (res.ok) raw = await res.json();
    } finally {
      clearTimeout(timeout);
    }

    // The request URL carries the key, so it is never logged.
    if (!res.ok) {
      logger.warn('AirNow API error', { status: res.status });
      return failed();
    }

    if (!Array.isArray(raw)) {
      logger.warn('AirNow API returned an unexpected body', { type: typeof raw });
      return failed();
    }
    const normalized = pickPrimary(raw.map(normaliseObservation));

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
    return failed();
  }
}

module.exports = {
  fetchAQI,
  normaliseObservation,
  pickPrimary,
  observedAt,
  areaKey,
  PROVIDER,
  TTL_MINUTES,
  ERROR_TTL_MINUTES,
};

/**
 * WeatherKit REST Provider
 *
 * Fetches current conditions, hourly forecast, and daily forecast from
 * Apple WeatherKit REST API. Normalizes responses into the WeatherResult
 * shape defined in providerInterfaces.js.
 *
 * Environment variables:
 *   WEATHERKIT_KEY_ID        — Apple Developer key ID
 *   WEATHERKIT_TEAM_ID       — Apple Developer team ID
 *   WEATHERKIT_SERVICE_ID    — WeatherKit service identifier
 *   WEATHERKIT_PRIVATE_KEY   — ES256 private key (PEM or base64-encoded PEM)
 */

const jwt = require('jsonwebtoken');
const ngeohash = require('ngeohash');
const logger = require('../../../utils/logger');
const { getContextCache, setContextCache } = require('../contextCacheService');

const PROVIDER = 'WEATHERKIT';
const BASE_URL = 'https://weatherkit.apple.com/api/v1';
const FETCH_TIMEOUT_MS = 5000;
const GEOHASH_PRECISION = 5;

// Cache TTLs (minutes)
const TTL_CURRENT = 10;
const TTL_HOURLY = 30;
const TTL_DAILY = 240; // 4 hours

// JWT is cached in-memory; regenerate after 50 minutes
const JWT_LIFETIME_SEC = 3600;      // 1 hour
const JWT_REFRESH_MS = 50 * 60000;  // 50 minutes
let cachedJwt = null;
let cachedJwtExpiresAt = 0;

// ── Condition code mapping ──────────────────────────────────────────

const CONDITION_MAP = {
  Clear:                { label: 'Clear',                   icon: 'clear' },
  MostlyClear:          { label: 'Mostly Clear',            icon: 'mostly_clear' },
  PartlyCloudy:         { label: 'Partly Cloudy',           icon: 'partly_cloudy' },
  MostlyCloudy:         { label: 'Mostly Cloudy',           icon: 'mostly_cloudy' },
  Cloudy:               { label: 'Cloudy',                  icon: 'cloudy' },
  Rain:                 { label: 'Rain',                    icon: 'rain' },
  HeavyRain:            { label: 'Heavy Rain',              icon: 'heavy_rain' },
  Drizzle:              { label: 'Drizzle',                 icon: 'drizzle' },
  Snow:                 { label: 'Snow',                    icon: 'snow' },
  HeavySnow:            { label: 'Heavy Snow',              icon: 'heavy_snow' },
  Sleet:                { label: 'Sleet',                   icon: 'sleet' },
  FreezingRain:         { label: 'Freezing Rain',           icon: 'freezing_rain' },
  FreezingDrizzle:      { label: 'Freezing Drizzle',        icon: 'freezing_drizzle' },
  Thunderstorms:        { label: 'Thunderstorms',           icon: 'thunderstorms' },
  StrongStorms:         { label: 'Strong Storms',           icon: 'strong_storms' },
  Haze:                 { label: 'Haze',                    icon: 'haze' },
  Smoke:                { label: 'Smoke',                   icon: 'smoke' },
  Dust:                 { label: 'Dust',                    icon: 'dust' },
  Fog:                  { label: 'Fog',                     icon: 'fog' },
  Windy:                { label: 'Windy',                   icon: 'windy' },
  Breezy:               { label: 'Breezy',                  icon: 'breezy' },
  Blizzard:             { label: 'Blizzard',                icon: 'blizzard' },
  IsolatedThunderstorms:{ label: 'Isolated Thunderstorms',  icon: 'thunderstorms' },
  ScatteredThunderstorms:{ label: 'Scattered Thunderstorms', icon: 'thunderstorms' },
  Flurries:             { label: 'Flurries',                icon: 'flurries' },
  Hail:                 { label: 'Hail',                    icon: 'hail' },
  Hot:                  { label: 'Hot',                     icon: 'hot' },
  Frigid:               { label: 'Frigid',                  icon: 'frigid' },
  BlowingSnow:          { label: 'Blowing Snow',            icon: 'blowing_snow' },
  BlowingDust:          { label: 'Blowing Dust',            icon: 'blowing_dust' },
  SunShowers:           { label: 'Sun Showers',             icon: 'sun_showers' },
  TropicalStorm:        { label: 'Tropical Storm',          icon: 'tropical_storm' },
  Hurricane:            { label: 'Hurricane',               icon: 'hurricane' },
  WintryMix:            { label: 'Wintry Mix',              icon: 'wintry_mix' },
};

// ── Helpers ─────────────────────────────────────────────────────────

function cToF(celsius) {
  if (celsius == null) return null;
  return Math.round(celsius * 9 / 5 + 32);
}

function kphToMph(kph) {
  if (kph == null) return null;
  return Math.round(kph * 0.621371);
}

function kmToMiles(km) {
  if (km == null) return null;
  return Math.round(km * 0.621371 * 10) / 10;
}

function mapCondition(code) {
  const entry = CONDITION_MAP[code];
  return {
    code: code ? code.toLowerCase() : 'unknown',
    label: entry ? entry.label : code || 'Unknown',
  };
}

/**
 * Map WeatherKit wind direction degrees to compass label.
 */
function degreesToCompass(deg) {
  if (deg == null) return null;
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Map WeatherKit precipitationType enum to our normalized type.
 */
function mapPrecipType(wkType) {
  const map = {
    rain: 'rain',
    snow: 'snow',
    sleet: 'sleet',
    hail: 'hail',
    mixed: 'sleet',
  };
  return map[(wkType || '').toLowerCase()] || null;
}

// ── JWT generation ──────────────────────────────────────────────────

function getPrivateKey() {
  const raw = process.env.WEATHERKIT_PRIVATE_KEY;
  if (!raw) return null;
  // Support base64-encoded PEM
  if (!raw.includes('-----BEGIN')) {
    return Buffer.from(raw, 'base64').toString('utf8');
  }
  return raw;
}

function generateJwt() {
  const keyId = process.env.WEATHERKIT_KEY_ID;
  const teamId = process.env.WEATHERKIT_TEAM_ID;
  const serviceId = process.env.WEATHERKIT_SERVICE_ID;
  const privateKey = getPrivateKey();

  if (!keyId || !teamId || !serviceId || !privateKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: teamId,
      sub: serviceId,
      iat: now,
      exp: now + JWT_LIFETIME_SEC,
    },
    privateKey,
    {
      algorithm: 'ES256',
      header: {
        kid: keyId,
        id: `${teamId}.${serviceId}`,
      },
    }
  );

  cachedJwt = token;
  cachedJwtExpiresAt = Date.now() + JWT_REFRESH_MS;
  return token;
}

function getJwt() {
  if (cachedJwt && Date.now() < cachedJwtExpiresAt) {
    return cachedJwt;
  }
  return generateJwt();
}

// ── Normalizers ─────────────────────────────────────────────────────

/**
 * Normalize WeatherKit currentWeather into WeatherCurrent.
 */
function normalizeCurrent(cw) {
  if (!cw) return null;
  const cond = mapCondition(cw.conditionCode);
  return {
    temp_f: cToF(cw.temperature),
    temp_c: cw.temperature != null ? Math.round(cw.temperature) : null,
    condition_code: cond.code,
    condition_label: cond.label,
    humidity_pct: cw.humidity != null ? Math.round(cw.humidity * 100) : null,
    wind_mph: kphToMph(cw.windSpeed),
    wind_direction: degreesToCompass(cw.windDirection),
    feels_like_f: cToF(cw.temperatureApparent),
    uv_index: cw.uvIndex ?? null,
    cloud_cover_pct: cw.cloudCover != null ? Math.round(cw.cloudCover * 100) : null,
    visibility_miles: kmToMiles(cw.visibility),
    pressure_mb: cw.pressure != null ? Math.round(cw.pressure) : null,
    dew_point_f: cToF(cw.temperatureDewPoint),
  };
}

/**
 * Normalize WeatherKit forecastHourly hours into WeatherHourly[].
 */
function normalizeHourly(fh) {
  if (!fh?.hours) return [];
  return fh.hours.slice(0, 24).map((h) => {
    const cond = mapCondition(h.conditionCode);
    return {
      datetime_utc: h.forecastStart || '',
      temp_f: cToF(h.temperature),
      condition_code: cond.code,
      condition_label: cond.label,
      precip_chance_pct: h.precipitationChance != null ? Math.round(h.precipitationChance * 100) : null,
      precip_type: mapPrecipType(h.precipitationType),
      wind_mph: kphToMph(h.windSpeed),
      humidity_pct: h.humidity != null ? Math.round(h.humidity * 100) : null,
    };
  });
}

/**
 * Normalize WeatherKit forecastDaily days into WeatherDaily[].
 */
function normalizeDaily(fd) {
  if (!fd?.days) return [];
  return fd.days.slice(0, 7).map((d) => {
    const cond = mapCondition(d.conditionCode);
    return {
      date: d.forecastStart ? d.forecastStart.slice(0, 10) : '',
      high_f: cToF(d.temperatureMax),
      low_f: cToF(d.temperatureMin),
      condition_code: cond.code,
      condition_label: cond.label,
      precip_chance_pct: d.precipitationChance != null ? Math.round(d.precipitationChance * 100) : null,
      sunrise_utc: d.sunrise || null,
      sunset_utc: d.sunset || null,
      uv_index_max: d.maxUVIndex ?? null,
    };
  });
}

// ── Main fetch function ─────────────────────────────────────────────

/**
 * Fetch weather from WeatherKit REST API.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {Object} [options]
 * @returns {Promise<import('../providerInterfaces').WeatherResult & {source: string}>}
 */
async function fetchWeather(latitude, longitude, options = {}) {
  const token = getJwt();
  if (!token) {
    return {
      current: null,
      hourly: [],
      daily: [],
      provider: PROVIDER,
      fetchedAt: null,
      source: 'unavailable',
    };
  }

  const geohash = ngeohash.encode(latitude, longitude, GEOHASH_PRECISION);

  // ── Check cache for all three data sets ──
  const [cachedCurrent, cachedHourly, cachedDaily] = await Promise.all([
    getContextCache(PROVIDER, 'weather_current', geohash),
    getContextCache(PROVIDER, 'weather_hourly', geohash),
    getContextCache(PROVIDER, 'weather_daily', geohash),
  ]);

  if (cachedCurrent && cachedHourly && cachedDaily) {
    logger.debug('WeatherKit: all cache hit', { geohash });
    return {
      current: cachedCurrent.payload_json,
      hourly: cachedHourly.payload_json,
      daily: cachedDaily.payload_json,
      provider: PROVIDER,
      fetchedAt: cachedCurrent.fetched_at,
      source: 'cache',
    };
  }

  // ── Fetch live from WeatherKit ──
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `${BASE_URL}/weather/en/${latitude}/${longitude}?dataSets=currentWeather,forecastHourly,forecastDaily`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('WeatherKit API error', { status: res.status, geohash });
      return {
        current: null,
        hourly: [],
        daily: [],
        provider: PROVIDER,
        fetchedAt: new Date().toISOString(),
        source: 'error',
      };
    }

    const raw = await res.json();
    const fetchedAt = new Date().toISOString();

    const current = normalizeCurrent(raw.currentWeather);
    const hourly = normalizeHourly(raw.forecastHourly);
    const daily = normalizeDaily(raw.forecastDaily);

    // ── Cache each data set separately with different TTLs ──
    await Promise.all([
      current && setContextCache(PROVIDER, 'weather_current', geohash, current, TTL_CURRENT),
      hourly.length > 0 && setContextCache(PROVIDER, 'weather_hourly', geohash, hourly, TTL_HOURLY),
      daily.length > 0 && setContextCache(PROVIDER, 'weather_daily', geohash, daily, TTL_DAILY),
    ]);

    return {
      current,
      hourly,
      daily,
      provider: PROVIDER,
      fetchedAt,
      source: 'live',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('WeatherKit fetch timeout', { provider: PROVIDER, geohash, lat: latitude, lng: longitude, timeout_ms: FETCH_TIMEOUT_MS });
    } else {
      logger.error('WeatherKit fetch error', { provider: PROVIDER, geohash, lat: latitude, lng: longitude, error: err.message });
    }
    return {
      current: null,
      hourly: [],
      daily: [],
      provider: PROVIDER,
      fetchedAt: new Date().toISOString(),
      source: 'error',
    };
  }
}

// ── Weather Alerts ─────────────────────────────────────────────────

const TTL_ALERTS = 10; // minutes

/**
 * Map WeatherKit severity string to our normalised severity levels.
 */
function normaliseWkSeverity(wkSeverity) {
  const map = {
    extreme: 'extreme',
    severe: 'severe',
    moderate: 'moderate',
    minor: 'minor',
  };
  return map[(wkSeverity || '').toLowerCase()] || 'unknown';
}

/**
 * Normalise a single WeatherKit alert into our Alert shape.
 * Preserves detailsUrl and source per Apple WeatherKit attribution requirements:
 * - Must link to Apple details page
 * - Must display issuing agency name
 * - Must not modify alert text
 */
function normaliseWkAlert(a) {
  return {
    id: a.id || a.detailsUrl || '',
    event: a.description || a.eventType || 'Weather Alert',
    severity: normaliseWkSeverity(a.severity),
    headline: a.description || '',
    description: (a.description || ''),
    instruction: '',
    onset: a.effectiveTime || '',
    expires: a.expireTime || '',
    areas: a.areaName ? [a.areaName] : [],
    details_url: a.detailsUrl || '',
    source: a.source || '',
  };
}

/**
 * Fetch weather alerts from WeatherKit REST API.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ alerts: import('../providerInterfaces').Alert[], source: string, fetchedAt: string } | null>}
 */
async function fetchAlerts(latitude, longitude) {
  const token = getJwt();
  if (!token) {
    return null;
  }

  const geohash = ngeohash.encode(latitude, longitude, GEOHASH_PRECISION);

  // Check cache
  const cached = await getContextCache(PROVIDER, 'weather_alerts', geohash);
  if (cached) {
    logger.debug('WeatherKit alerts: cache hit', { geohash });
    return {
      alerts: cached.payload_json || [],
      source: 'cache',
      fetchedAt: cached.fetched_at,
    };
  }

  // Fetch live
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = `${BASE_URL}/weather/en/${latitude}/${longitude}?dataSets=weatherAlerts&country=US`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('WeatherKit alerts API error', { status: res.status, geohash });
      return null;
    }

    const raw = await res.json();
    const fetchedAt = new Date().toISOString();
    const wkAlerts = (raw.weatherAlerts && raw.weatherAlerts.alerts) || [];
    const normalized = wkAlerts.map(normaliseWkAlert);

    await setContextCache(PROVIDER, 'weather_alerts', geohash, normalized, TTL_ALERTS);

    return {
      alerts: normalized,
      source: 'live',
      fetchedAt,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('WeatherKit alerts timeout', { geohash, lat: latitude, lng: longitude });
    } else {
      logger.error('WeatherKit alerts error', { geohash, lat: latitude, lng: longitude, error: err.message });
    }
    return null;
  }
}

module.exports = { fetchWeather, fetchAlerts, PROVIDER, CONDITION_MAP };

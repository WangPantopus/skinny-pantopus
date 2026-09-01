/**
 * Open-Meteo Fallback Weather Provider
 *
 * Free weather API — no API key required. Used as fallback when
 * WeatherKit credentials are unavailable or the API errors out.
 *
 * API docs: https://open-meteo.com/en/docs
 * Normalizes into WeatherResult shape from providerInterfaces.js.
 */

const ngeohash = require('ngeohash');
const logger = require('../../../utils/logger');
const { getContextCache, getContextCacheStale, setContextCache } = require('../contextCacheService');

const PROVIDER = 'OPEN_METEO';
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 5000;
const GEOHASH_PRECISION = 5;

// Cache TTLs (minutes)
const TTL_CURRENT = 10;
const TTL_HOURLY = 30;
const TTL_DAILY = 240; // 4 hours
// When the API is down, serve expired rows up to this old (database-first).
const STALE_MAX_AGE_MIN = 360; // 6 hours

// ── WMO weather code mapping ────────────────────────────────────────
// https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM

const WMO_CODE_MAP = {
  0:  { code: 'clear',            label: 'Clear' },
  1:  { code: 'mostly_clear',     label: 'Mostly Clear' },
  2:  { code: 'partly_cloudy',    label: 'Partly Cloudy' },
  3:  { code: 'cloudy',           label: 'Overcast' },
  45: { code: 'fog',              label: 'Fog' },
  48: { code: 'fog',              label: 'Depositing Rime Fog' },
  51: { code: 'drizzle',          label: 'Light Drizzle' },
  53: { code: 'drizzle',          label: 'Moderate Drizzle' },
  55: { code: 'drizzle',          label: 'Dense Drizzle' },
  56: { code: 'freezing_drizzle', label: 'Light Freezing Drizzle' },
  57: { code: 'freezing_drizzle', label: 'Dense Freezing Drizzle' },
  61: { code: 'rain',             label: 'Slight Rain' },
  63: { code: 'rain',             label: 'Moderate Rain' },
  65: { code: 'heavy_rain',       label: 'Heavy Rain' },
  66: { code: 'freezing_rain',    label: 'Light Freezing Rain' },
  67: { code: 'freezing_rain',    label: 'Heavy Freezing Rain' },
  71: { code: 'snow',             label: 'Slight Snowfall' },
  73: { code: 'snow',             label: 'Moderate Snowfall' },
  75: { code: 'heavy_snow',       label: 'Heavy Snowfall' },
  77: { code: 'snow',             label: 'Snow Grains' },
  80: { code: 'rain',             label: 'Slight Rain Showers' },
  81: { code: 'rain',             label: 'Moderate Rain Showers' },
  82: { code: 'heavy_rain',       label: 'Violent Rain Showers' },
  85: { code: 'snow',             label: 'Slight Snow Showers' },
  86: { code: 'heavy_snow',       label: 'Heavy Snow Showers' },
  95: { code: 'thunderstorms',    label: 'Thunderstorm' },
  96: { code: 'thunderstorms',    label: 'Thunderstorm with Slight Hail' },
  99: { code: 'thunderstorms',    label: 'Thunderstorm with Heavy Hail' },
};

// ── Helpers ─────────────────────────────────────────────────────────

function mapWmoCode(wmoCode) {
  const entry = WMO_CODE_MAP[wmoCode];
  return entry || { code: 'unknown', label: 'Unknown' };
}

/**
 * Map wind direction degrees to compass label.
 */
function degreesToCompass(deg) {
  if (deg == null) return null;
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Infer precip type from WMO code.
 */
function inferPrecipType(wmoCode) {
  if (wmoCode == null) return null;
  if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return 'snow';
  if ([66, 67, 56, 57].includes(wmoCode)) return 'sleet';
  if ([96, 99].includes(wmoCode)) return 'hail';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95].includes(wmoCode)) return 'rain';
  return null;
}

function roundOrNull(val) {
  return val != null ? Math.round(val) : null;
}

// ── Build API URL ───────────────────────────────────────────────────

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'weather_code', 'wind_speed_10m', 'wind_direction_10m',
      'cloud_cover', 'surface_pressure', 'uv_index',
    ].join(','),
    hourly: [
      'temperature_2m', 'weather_code', 'precipitation_probability',
      'precipitation', 'wind_speed_10m', 'relative_humidity_2m',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '7',
    forecast_hours: '24',
  });
  return `${BASE_URL}?${params}`;
}

// ── Normalizers ─────────────────────────────────────────────────────

/**
 * Normalize Open-Meteo current block into WeatherCurrent.
 */
function normalizeCurrent(c) {
  if (!c) return null;
  const cond = mapWmoCode(c.weather_code);
  return {
    temp_f: roundOrNull(c.temperature_2m),
    temp_c: c.temperature_2m != null ? roundOrNull((c.temperature_2m - 32) * 5 / 9) : null,
    condition_code: cond.code,
    condition_label: cond.label,
    humidity_pct: roundOrNull(c.relative_humidity_2m),
    wind_mph: roundOrNull(c.wind_speed_10m),
    wind_direction: degreesToCompass(c.wind_direction_10m),
    feels_like_f: roundOrNull(c.apparent_temperature),
    uv_index: c.uv_index ?? null,
    cloud_cover_pct: roundOrNull(c.cloud_cover),
    visibility_miles: null, // not available from Open-Meteo free tier
    pressure_mb: roundOrNull(c.surface_pressure),
    dew_point_f: null,      // not requested in this query
  };
}

/**
 * Normalize Open-Meteo hourly arrays into WeatherHourly[].
 * Open-Meteo returns parallel arrays: hourly.time[], hourly.temperature_2m[], etc.
 */
function normalizeHourly(h) {
  if (!h?.time) return [];
  const len = Math.min(h.time.length, 24);
  const result = [];
  for (let i = 0; i < len; i++) {
    const wmoCode = h.weather_code?.[i];
    const cond = mapWmoCode(wmoCode);
    result.push({
      datetime_utc: h.time[i] || '',
      temp_f: roundOrNull(h.temperature_2m?.[i]),
      condition_code: cond.code,
      condition_label: cond.label,
      precip_chance_pct: roundOrNull(h.precipitation_probability?.[i]),
      precip_type: inferPrecipType(wmoCode),
      wind_mph: roundOrNull(h.wind_speed_10m?.[i]),
      humidity_pct: roundOrNull(h.relative_humidity_2m?.[i]),
    });
  }
  return result;
}

/**
 * Normalize Open-Meteo daily arrays into WeatherDaily[].
 */
function normalizeDaily(d) {
  if (!d?.time) return [];
  const len = Math.min(d.time.length, 7);
  const result = [];
  for (let i = 0; i < len; i++) {
    const cond = mapWmoCode(d.weather_code?.[i]);
    result.push({
      date: d.time[i] || '',
      high_f: roundOrNull(d.temperature_2m_max?.[i]),
      low_f: roundOrNull(d.temperature_2m_min?.[i]),
      condition_code: cond.code,
      condition_label: cond.label,
      precip_chance_pct: roundOrNull(d.precipitation_probability_max?.[i]),
      sunrise_utc: d.sunrise?.[i] || null,
      sunset_utc: d.sunset?.[i] || null,
      uv_index_max: d.uv_index_max?.[i] ?? null,
    });
  }
  return result;
}

// ── Main fetch function ─────────────────────────────────────────────

const ERROR_RESULT = {
  current: null,
  hourly: [],
  daily: [],
  provider: PROVIDER,
};

/**
 * Fetch weather from Open-Meteo API (free, no API key).
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<import('../providerInterfaces').WeatherResult & {source: string}>}
 */
async function fetchWeather(latitude, longitude) {
  const geohash = ngeohash.encode(latitude, longitude, GEOHASH_PRECISION);

  // ── Check cache ──
  const [cachedCurrent, cachedHourly, cachedDaily] = await Promise.all([
    getContextCache(PROVIDER, 'weather_current', geohash),
    getContextCache(PROVIDER, 'weather_hourly', geohash),
    getContextCache(PROVIDER, 'weather_daily', geohash),
  ]);

  if (cachedCurrent && cachedHourly && cachedDaily) {
    logger.debug('Open-Meteo: all cache hit', { geohash });
    return {
      current: cachedCurrent.payload_json,
      hourly: cachedHourly.payload_json,
      daily: cachedDaily.payload_json,
      provider: PROVIDER,
      fetchedAt: cachedCurrent.fetched_at,
      source: 'cache',
    };
  }

  // ── Fetch live ──
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url = buildUrl(latitude, longitude);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn('Open-Meteo API error', { status: res.status, geohash });
      const stale = await readStale(geohash);
      if (stale) return stale;
      return { ...ERROR_RESULT, fetchedAt: new Date().toISOString(), source: 'error' };
    }

    const raw = await res.json();
    const fetchedAt = new Date().toISOString();

    const current = normalizeCurrent(raw.current);
    const hourly = normalizeHourly(raw.hourly);
    const daily = normalizeDaily(raw.daily);

    // ── Cache each data set ──
    await Promise.all([
      current && setContextCache(PROVIDER, 'weather_current', geohash, current, TTL_CURRENT),
      hourly.length > 0 && setContextCache(PROVIDER, 'weather_hourly', geohash, hourly, TTL_HOURLY),
      daily.length > 0 && setContextCache(PROVIDER, 'weather_daily', geohash, daily, TTL_DAILY),
    ]);

    return { current, hourly, daily, provider: PROVIDER, fetchedAt, source: 'live' };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('Open-Meteo fetch timeout', { provider: PROVIDER, geohash, lat: latitude, lng: longitude, timeout_ms: FETCH_TIMEOUT_MS });
    } else {
      logger.error('Open-Meteo fetch error', { provider: PROVIDER, geohash, lat: latitude, lng: longitude, error: err.message });
    }
    const stale = await readStale(geohash);
    if (stale) return stale;
    return { ...ERROR_RESULT, fetchedAt: new Date().toISOString(), source: 'error' };
  }
}

// Database-first fallback: a recent-but-expired snapshot (≤6 h) beats
// an empty hub when the API is unreachable.
async function readStale(geohash) {
  const [current, hourly, daily] = await Promise.all([
    getContextCacheStale(PROVIDER, 'weather_current', geohash, STALE_MAX_AGE_MIN),
    getContextCacheStale(PROVIDER, 'weather_hourly', geohash, STALE_MAX_AGE_MIN),
    getContextCacheStale(PROVIDER, 'weather_daily', geohash, STALE_MAX_AGE_MIN),
  ]);
  if (!current) return null;
  logger.info('Open-Meteo serving stale cache (API unavailable)', { geohash });
  return {
    current: current.payload_json,
    hourly: hourly ? hourly.payload_json : [],
    daily: daily ? daily.payload_json : [],
    provider: PROVIDER,
    fetchedAt: current.fetched_at,
    source: 'cache_stale',
  };
}

module.exports = { fetchWeather, PROVIDER, WMO_CODE_MAP };

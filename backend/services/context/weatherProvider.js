/**
 * Weather Provider Orchestrator
 *
 * Fetches weather with automatic fallback: WeatherKit → Open-Meteo.
 * Returns a unified WeatherResult regardless of which provider served it.
 * Includes circuit breaker: after 3 consecutive WeatherKit failures in
 * 10 minutes, skips directly to Open-Meteo.
 */

const logger = require('../../utils/logger');
const weatherkit = require('./providers/weatherkit');
const openMeteo = require('./providers/openMeteo');

// ── Circuit breaker state (module-level, resets on deploy) ──────

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 10 * 60 * 1000; // 10 minutes

let wkConsecutiveFailures = 0;
let wkLastFailureAt = 0;

function isCircuitOpen() {
  if (wkConsecutiveFailures < CIRCUIT_FAILURE_THRESHOLD) return false;
  // Reset circuit after the window
  if (Date.now() - wkLastFailureAt > CIRCUIT_RESET_MS) {
    wkConsecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordWkSuccess() {
  wkConsecutiveFailures = 0;
}

function recordWkFailure() {
  wkConsecutiveFailures++;
  wkLastFailureAt = Date.now();
}

/**
 * Fetch weather with automatic provider fallback.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<import('./providerInterfaces').WeatherResult & {source: string}>}
 */
async function fetchWeather(latitude, longitude) {
  const startMs = Date.now();

  // Circuit breaker: skip WeatherKit if it's been failing
  if (isCircuitOpen()) {
    logger.info('weatherProvider: circuit open, skipping WeatherKit', {
      failures: wkConsecutiveFailures,
      lat: latitude,
      lng: longitude,
    });
  } else {
    // 1. Try WeatherKit first
    const wkStart = Date.now();
    const wkResult = await weatherkit.fetchWeather(latitude, longitude);
    const wkMs = Date.now() - wkStart;

    if (wkResult.source !== 'unavailable' && wkResult.source !== 'error') {
      recordWkSuccess();
      logger.debug('weatherProvider: served by WeatherKit', { source: wkResult.source, latency_ms: wkMs });
      return wkResult;
    }

    // Track failure
    if (wkResult.source === 'error') {
      recordWkFailure();
      logger.warn('weatherProvider: WeatherKit failed', {
        latency_ms: wkMs,
        consecutive_failures: wkConsecutiveFailures,
        lat: latitude,
        lng: longitude,
      });
    }
  }

  // 2. Fallback to Open-Meteo
  const omStart = Date.now();
  const omResult = await openMeteo.fetchWeather(latitude, longitude);
  const omMs = Date.now() - omStart;
  const totalMs = Date.now() - startMs;

  if (omResult.source !== 'error') {
    logger.info('weatherProvider: served by Open-Meteo (fallback)', {
      source: omResult.source,
      latency_ms: omMs,
      total_ms: totalMs,
    });
    return omResult;
  }

  // 3. Both failed
  logger.warn('weatherProvider: all providers failed', {
    total_ms: totalMs,
    lat: latitude,
    lng: longitude,
  });
  return {
    current: null,
    hourly: [],
    daily: [],
    provider: 'none',
    fetchedAt: new Date().toISOString(),
    source: 'error',
  };
}

module.exports = { fetchWeather };

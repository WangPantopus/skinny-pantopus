/**
 * Alerts Provider Adapter
 *
 * Fetches weather alerts with automatic fallback: WeatherKit → NOAA.
 * Returns a normalized AlertResult shape defined in providerInterfaces.js.
 */

const weatherkit = require('./providers/weatherkit');
const noaa = require('../external/noaa');
const logger = require('../../utils/logger');

/**
 * Fetch weather alerts and normalize to AlertResult shape.
 * Tries WeatherKit first; falls back to NOAA if unavailable or errored.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<import('./providerInterfaces').AlertResult & {source: string}>}
 */
async function fetchAlerts(latitude, longitude) {
  // 1. Try WeatherKit first
  const wkResult = await weatherkit.fetchAlerts(latitude, longitude);

  if (wkResult && wkResult.source !== 'error') {
    logger.debug('alertsProvider: served by WeatherKit', { source: wkResult.source });
    return {
      alerts: wkResult.alerts || [],
      provider: 'WEATHERKIT',
      fetchedAt: wkResult.fetchedAt || new Date().toISOString(),
      source: wkResult.source,
    };
  }

  // 2. Fallback to NOAA
  if (wkResult === null) {
    // WeatherKit not configured — silent fallback
    logger.debug('alertsProvider: WeatherKit unavailable, using NOAA');
  } else {
    // WeatherKit returned an error
    logger.warn('alertsProvider: WeatherKit failed, falling back to NOAA', {
      lat: latitude,
      lng: longitude,
    });
  }

  const noaaResult = await noaa.fetchAlerts(latitude, longitude);
  return {
    alerts: noaaResult.alerts || [],
    provider: 'NOAA',
    fetchedAt: noaaResult.fetchedAt || new Date().toISOString(),
    source: noaaResult.source,
  };
}

module.exports = { fetchAlerts };

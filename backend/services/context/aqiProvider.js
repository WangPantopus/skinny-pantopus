/**
 * AQI Provider Adapter
 *
 * Wraps the existing airNow.js connector into the normalized AQIResult
 * shape defined in providerInterfaces.js.
 */

const airNow = require('../external/airNow');

const PROVIDER = 'AIRNOW';

/**
 * Fetch AQI and normalize to AQIResult shape.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<import('./providerInterfaces').AQIResult & {source: string}>}
 */
async function fetchAQI(latitude, longitude) {
  const result = await airNow.fetchAQI(latitude, longitude);

  const reading = result.aqi;

  return {
    aqi: reading?.aqi ?? null,
    category: reading?.category ?? null,
    pollutant: reading?.pollutant ?? null,
    color: reading?.color ?? null,
    is_noteworthy: (reading?.aqi ?? 0) > 100,
    provider: PROVIDER,
    fetchedAt: result.fetchedAt || null,
    source: result.source,
  };
}

module.exports = { fetchAQI, PROVIDER };

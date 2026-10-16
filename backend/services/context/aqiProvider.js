/**
 * AQI Provider Adapter
 *
 * Wraps the existing airNow.js connector into the normalized AQIResult
 * shape defined in providerInterfaces.js.
 *
 * AirNow's reading comes from the closest monitor within its lookup radius,
 * which can be tens of miles away, so the result names that monitor
 * (`source_label`). When AirNow answers but no monitor reports near the
 * point, NOAA's forecast model stands in, labelled an estimate.
 */

const airNow = require('../external/airNow');
const noaaAirQuality = require('../external/noaaAirQuality');

const PROVIDER = 'AIRNOW';

/** "AirNow · Bennington monitor, within 50 miles" — whatever AirNow named. */
function monitorLabel(reading) {
  const site = String(reading.site_name || reading.reporting_area || '').trim();
  if (!site) return 'AirNow · EPA';
  const within = String(reading.lookup_boundary || '').trim().toLowerCase();
  return `AirNow · ${site} monitor${within ? `, within ${within}` : ''}`;
}

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

  // AirNow answered and no monitor reports within its radius.
  if (!reading && (result.source === 'live' || result.source === 'cache')) {
    const estimate = await noaaAirQuality.fetchModelAqi(latitude, longitude);
    if (estimate) {
      return {
        aqi: estimate.aqi,
        category: estimate.category,
        pollutant: 'PM2.5',
        color: null,
        observed_at: estimate.valid_at,
        is_noteworthy: estimate.aqi > 100,
        is_estimate: true,
        source_label: 'NOAA forecast model · estimate, no monitor nearby',
        provider: noaaAirQuality.PROVIDER,
        fetchedAt: result.fetchedAt || null,
        source: result.source,
      };
    }
  }

  return {
    aqi: reading?.aqi ?? null,
    category: reading?.category ?? null,
    pollutant: reading?.pollutant ?? null,
    color: reading?.color ?? null,
    observed_at: reading?.observed_at ?? null,
    is_noteworthy: (reading?.aqi ?? 0) > 100,
    is_estimate: false,
    source_label: reading ? monitorLabel(reading) : null,
    provider: PROVIDER,
    fetchedAt: result.fetchedAt || null,
    source: result.source,
  };
}

module.exports = { fetchAQI, PROVIDER, monitorLabel };

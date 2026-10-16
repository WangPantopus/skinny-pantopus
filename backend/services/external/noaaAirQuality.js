/**
 * NOAA air quality forecast — an AQI estimate where no monitor reports
 *
 * AirNow's readings come from the closest monitor within 50 miles; rural
 * addresses beyond every monitor get none. NOAA's bias-corrected PM2.5
 * forecast guidance (National Air Quality Forecast Capability, keyless
 * ArcGIS ImageServer, contiguous US only) gives a 24-hour average PM2.5
 * concentration at any point, valid hour by hour, which converts to an AQI
 * with EPA's PM2.5 breakpoints. It is a model estimate and is labelled so.
 *
 * EPA PM2.5 AQI breakpoints, effective May 6, 2024 (EPA, "Final Updates to
 * the Air Quality Index (AQI) for Particulate Matter", fact sheet), µg/m³
 * truncated to one decimal:
 *   Good 0.0–9.0 (0–50) · Moderate 9.1–35.4 (51–100) · Unhealthy for
 *   Sensitive Groups 35.5–55.4 (101–150) · Unhealthy 55.5–125.4 (151–200) ·
 *   Very Unhealthy 125.5–225.4 (201–300) · Hazardous 225.5+ (301+)
 */
const logger = require('../../utils/logger');
const { getCache, setCache } = require('./cacheHelper');

const PROVIDER = 'NOAA_AQ_MODEL';
const IDENTIFY_URL = 'https://mapservices.weather.noaa.gov/raster/rest/services/air_quality/ndgd_apm25_hr01_bc/ImageServer/identify';
const TTL_MINUTES = 60;
const FETCH_TIMEOUT_MS = 5000;

const BREAKPOINTS = [
  [0.0, 9.0, 0, 50, 'Good'],
  [9.1, 35.4, 51, 100, 'Moderate'],
  [35.5, 55.4, 101, 150, 'Unhealthy for Sensitive Groups'],
  [55.5, 125.4, 151, 200, 'Unhealthy'],
  [125.5, 225.4, 201, 300, 'Very Unhealthy'],
];

/** EPA's PM2.5 AQI for a 24-hour concentration in µg/m³. */
function pm25ToAqi(concentration) {
  const c = Math.floor(Math.max(0, concentration) * 10) / 10;
  // The fact sheet gives Hazardous only as 225.5 and up; report its floor.
  if (c >= 225.5) return { aqi: 301, category: 'Hazardous' };
  const [lo, hi, aqiLo, aqiHi, category] = BREAKPOINTS.find(([, top]) => c <= top);
  return { aqi: Math.round(((aqiHi - aqiLo) / (hi - lo)) * (c - lo) + aqiLo), category };
}

/**
 * NOAA's model AQI estimate at a point for the current hour.
 *
 * @returns {Promise<{aqi: number, category: string, valid_at: string|null}|null>}
 *   Null outside the contiguous US, when the service fails, or with no value.
 */
async function fetchModelAqi(lat, lng, { now = Date.now() } = {}) {
  const placeKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = await getCache(PROVIDER, placeKey);
  if (cached) return cached.payload && cached.payload.estimate ? cached.payload.estimate : null;

  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    returnGeometry: 'false',
    returnCatalogItems: 'true',
    // The service holds 72 hourly forecasts; ask for the one valid now.
    time: String(now),
    f: 'json',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${IDENTIFY_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Outside the model's grid the value is the string "NoData".
    const concentration = Number(data && data.value);
    let estimate = null;
    if (data && !data.error && Number.isFinite(concentration)) {
      const item = data.catalogItems && data.catalogItems.features && data.catalogItems.features[0];
      const validMs = item && item.attributes && Number(item.attributes.idp_validtime);
      estimate = {
        ...pm25ToAqi(concentration),
        valid_at: Number.isFinite(validMs) ? new Date(validMs).toISOString() : null,
      };
    }
    await setCache(PROVIDER, placeKey, { estimate }, TTL_MINUTES);
    return estimate;
  } catch (err) {
    logger.warn('noaaAirQuality: fetch failed', { error: err.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchModelAqi, pm25ToAqi, PROVIDER };

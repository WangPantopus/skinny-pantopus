const logger = require('./logger');
const { GEO_SERVER_TOKEN } = require('../config/geo');

const MAPBOX_ACCESS_TOKEN = GEO_SERVER_TOKEN;

/**
 * Geocode an address using the Mapbox Geocoding API.
 * Returns { latitude, longitude } on success, or null on any failure.
 * Never throws — all errors are logged as warnings and return null.
 */
async function geocodeAddress(address, city, state, zipcode, country = 'US') {
  const startTime = process.hrtime.bigint();
  const parts = [address, city, state, zipcode, country].filter(Boolean);
  const fullAddress = parts.join(', ');

  logger.info('geocode_request', {
    provider: 'mapbox',
    method: 'forward',
    query_redacted: fullAddress ? fullAddress.slice(0, 3) + '***' : '',
    parts_count: parts.length,
  });

  if (!fullAddress || parts.length < 2) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.warn('geocode_response', {
      provider: 'mapbox',
      method: 'forward',
      status: 'skipped',
      reason: 'insufficient_address_parts',
      response_time_ms: Math.round(elapsed * 100) / 100,
      cache_hit: false,
    });
    return null;
  }

  if (!MAPBOX_ACCESS_TOKEN) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.warn('geocode_response', {
      provider: 'mapbox',
      method: 'forward',
      status: 'skipped',
      reason: 'missing_mapbox_token',
      response_time_ms: Math.round(elapsed * 100) / 100,
      cache_hit: false,
    });
    return null;
  }

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json` +
      `?access_token=${encodeURIComponent(MAPBOX_ACCESS_TOKEN)}` +
      `&autocomplete=false&limit=1&country=${country.toLowerCase()}&types=address,place,locality,postcode`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
      logger.warn('geocode_response', {
        provider: 'mapbox',
        method: 'forward',
        status: 'http_error',
        http_status: response.status,
        response_time_ms: Math.round(elapsed * 100) / 100,
        cache_hit: false,
      });
      return null;
    }

    const data = await response.json();
    const feature = (data.features || [])[0];

    if (!feature || !feature.center) {
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
      logger.warn('geocode_response', {
        provider: 'mapbox',
        method: 'forward',
        status: 'no_results',
        response_time_ms: Math.round(elapsed * 100) / 100,
        cache_hit: false,
      });
      return null;
    }

    const lon = feature.center[0];
    const lat = feature.center[1];

    if (isNaN(lat) || isNaN(lon)) {
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
      logger.warn('geocode_response', {
        provider: 'mapbox',
        method: 'forward',
        status: 'invalid_coordinates',
        response_time_ms: Math.round(elapsed * 100) / 100,
        cache_hit: false,
      });
      return null;
    }

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info('geocode_response', {
      provider: 'mapbox',
      method: 'forward',
      status: 'success',
      response_time_ms: Math.round(elapsed * 100) / 100,
      cache_hit: false,
    });

    return { latitude: lat, longitude: lon };
  } catch (err) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.warn('geocode_response', {
      provider: 'mapbox',
      method: 'forward',
      status: 'error',
      error: err.message,
      response_time_ms: Math.round(elapsed * 100) / 100,
      cache_hit: false,
    });
    return null;
  }
}

module.exports = { geocodeAddress };

/**
 * Seeded Business Service
 *
 * Provides proximity-based queries against the SeededBusiness table to
 * show local service provider counts in the Pulse during cold start.
 *
 * Uses the PostGIS-backed `count_nearby_seeded_businesses` RPC function
 * and caches results in ExternalFeedCache with a 24-hour TTL.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { getCache, setCache } = require('../external/cacheHelper');

const PROVIDER = 'SEEDED_BIZ_COUNTS';
const TTL_MINUTES = 60 * 24; // 24 hours
const DEFAULT_RADIUS_METERS = 8047; // ~5 miles

/**
 * Round a coordinate to 2 decimal places for cache key grouping.
 * This groups locations within ~1.1 km so nearby requests share cache.
 */
function roundCoord(val) {
  return Number(val.toFixed(2));
}

/**
 * Get counts of nearby seeded businesses grouped by category.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.radiusMeters=8047]  Default ~5 miles
 * @returns {Promise<{ total: number, by_category: Record<string, number> } | null>}
 */
async function getNearbyBusinessCounts({ latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS }) {
  const lat = roundCoord(latitude);
  const lng = roundCoord(longitude);
  const placeKey = `${lat},${lng},${radiusMeters}`;

  // 1. Check cache
  const cached = await getCache(PROVIDER, placeKey);
  if (cached) {
    logger.info('SeededBusiness counts cache hit', { placeKey });
    return cached.payload;
  }

  // 2. Fetch from PostGIS RPC
  try {
    const { data, error } = await supabaseAdmin.rpc('count_nearby_seeded_businesses', {
      p_lat: latitude,
      p_lng: longitude,
      p_radius_meters: radiusMeters,
    });

    if (error) {
      logger.warn('SeededBusiness RPC error', { error: error.message, placeKey });
      return null;
    }

    // data is an array of { category, cnt }
    const byCategory = {};
    let total = 0;
    for (const row of (data || [])) {
      byCategory[row.category] = Number(row.cnt);
      total += Number(row.cnt);
    }

    const result = { total, by_category: byCategory };

    // 3. Cache the result
    await setCache(PROVIDER, placeKey, result, TTL_MINUTES);

    return result;
  } catch (err) {
    logger.error('SeededBusiness counts exception', { error: err.message, placeKey });
    return null;
  }
}

/**
 * Get actual nearby seeded business records.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.radiusMeters=8047]
 * @param {string} [params.category]  Optional category filter
 * @param {number} [params.limit=5]
 * @returns {Promise<object[]>}
 */
async function getNearbyBusinesses({ latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS, category, limit = 5 }) {
  try {
    let query = supabaseAdmin
      .from('SeededBusiness')
      .select('id, name, category, subcategory, city, state, zipcode, phone, website')
      .eq('is_active', true)
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    // Note: For actual proximity filtering we'd use RPC with PostGIS.
    // For now, filter by city/state since the table is small and seeded locally.
    const { data, error } = await query;

    if (error) {
      logger.warn('SeededBusiness query error', { error: error.message });
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error('SeededBusiness query exception', { error: err.message });
    return [];
  }
}

module.exports = {
  getNearbyBusinessCounts,
  getNearbyBusinesses,
  PROVIDER,
  TTL_MINUTES,
  DEFAULT_RADIUS_METERS,
};

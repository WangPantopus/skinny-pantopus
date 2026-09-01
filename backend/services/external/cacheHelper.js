/**
 * External Feed Cache Helper — generic read/write for the ExternalFeedCache table.
 *
 * Provides getCache / setCache for any connector (NOAA, WSDOT, etc.) to
 * store and retrieve normalised external data with TTL-based expiry.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

/**
 * Retrieve a cached payload for the given provider + place key.
 * Returns the payload (jsonb) if the cache entry exists and hasn't expired,
 * or null if cache miss / expired.
 *
 * @param {string} provider  e.g. 'NOAA_ALERTS'
 * @param {string} placeKey  e.g. 'placeId' or '45.62,-122.67,25'
 * @returns {Promise<object|null>}
 */
async function getCache(provider, placeKey) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ExternalFeedCache')
      .select('payload, fetched_at, etag')
      .eq('provider', provider)
      .eq('place_key', placeKey)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('Cache read error', { provider, placeKey, error: error.message });
      return null;
    }

    return data ? { payload: data.payload, fetchedAt: data.fetched_at, etag: data.etag } : null;
  } catch (err) {
    logger.error('Cache getCache exception', { provider, placeKey, error: err.message });
    return null;
  }
}

/**
 * Write / upsert a cache entry.
 *
 * @param {string} provider   e.g. 'NOAA_ALERTS'
 * @param {string} placeKey   e.g. 'placeId' or '45.62,-122.67,25'
 * @param {object} payload    { raw, normalized } — the data to cache
 * @param {number} ttlMinutes How long the entry is valid
 * @param {string} [etag]     Optional HTTP ETag for conditional requests
 */
async function setCache(provider, placeKey, payload, ttlMinutes, etag = null) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const { error } = await supabaseAdmin
      .from('ExternalFeedCache')
      .upsert(
        {
          provider,
          place_key: placeKey,
          fetched_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          etag,
          payload,
        },
        { onConflict: 'provider,place_key' }
      );

    if (error) {
      logger.warn('Cache write error', { provider, placeKey, error: error.message });
    }
  } catch (err) {
    logger.error('Cache setCache exception', { provider, placeKey, error: err.message });
  }
}

/**
 * Delete expired cache entries (for periodic cleanup).
 */
async function purgeExpired() {
  try {
    const { error, count } = await supabaseAdmin
      .from('ExternalFeedCache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.warn('Cache purge error', { error: error.message });
    } else if (count > 0) {
      logger.info('Cache purged expired entries', { count });
    }
  } catch (err) {
    logger.error('Cache purge exception', { error: err.message });
  }
}

module.exports = { getCache, setCache, purgeExpired };

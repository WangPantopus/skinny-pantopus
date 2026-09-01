/**
 * Context Cache Service — read/write for the ContextCache table.
 *
 * Provides geohash-keyed caching for normalized provider data (weather,
 * AQI, alerts) used by the context pipeline and daily briefing scheduler.
 * This is separate from ExternalFeedCache (which is keyed by provider +
 * place_key for the existing connectors).
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

/**
 * Retrieve a cached context entry for the given provider + type + geohash.
 * Returns the entry if it exists and hasn't expired, or null on miss.
 *
 * @param {string} provider     e.g. 'WEATHERKIT', 'AIRNOW', 'NOAA'
 * @param {string} contextType  e.g. 'weather_current', 'aqi', 'alerts'
 * @param {string} geohash      geohash5 or geohash6 precision
 * @returns {Promise<{payload_json: object, fetched_at: string, provider_status: string}|null>}
 */
async function getContextCache(provider, contextType, geohash) {
  try {
    const { data, error } = await supabaseAdmin
      .from('ContextCache')
      .select('payload_json, fetched_at, provider_status')
      .eq('provider', provider)
      .eq('context_type', contextType)
      .eq('geohash', geohash)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('ContextCache read error', { provider, contextType, geohash, error: error.message });
      return null;
    }

    return data || null;
  } catch (err) {
    logger.error('ContextCache getContextCache exception', { provider, contextType, geohash, error: err.message });
    return null;
  }
}

/**
 * Write / upsert a context cache entry.
 *
 * @param {string} provider     e.g. 'WEATHERKIT', 'AIRNOW', 'NOAA'
 * @param {string} contextType  e.g. 'weather_current', 'aqi', 'alerts'
 * @param {string} geohash      geohash5 or geohash6 precision
 * @param {object} payload      Normalized provider data
 * @param {number} ttlMinutes   How long the entry is valid
 * @param {string} [status='ok'] Provider status ('ok', 'partial', 'error', 'fallback')
 * @param {string|null} [errorCode=null] Error code if status is not 'ok'
 */
async function setContextCache(provider, contextType, geohash, payload, ttlMinutes, status = 'ok', errorCode = null) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const { error } = await supabaseAdmin
      .from('ContextCache')
      .upsert(
        {
          provider,
          context_type: contextType,
          geohash,
          fetched_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          payload_json: payload,
          provider_status: status,
          error_code: errorCode,
        },
        { onConflict: 'provider,context_type,geohash' }
      );

    if (error) {
      logger.warn('ContextCache write error', { provider, contextType, geohash, error: error.message });
    }
  } catch (err) {
    logger.error('ContextCache setContextCache exception', { provider, contextType, geohash, error: err.message });
  }
}

/**
 * Delete expired context cache entries.
 *
 * @returns {Promise<{purged: number}>}
 */
async function purgeExpiredContext() {
  try {
    const { error, count } = await supabaseAdmin
      .from('ContextCache')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.warn('ContextCache purge error', { error: error.message });
      return { purged: 0 };
    }

    if (count > 0) {
      logger.info('ContextCache purged expired entries', { count });
    }

    return { purged: count || 0 };
  } catch (err) {
    logger.error('ContextCache purge exception', { error: err.message });
    return { purged: 0 };
  }
}

/**
 * Bounded STALE read — ignores expires_at but refuses anything older
 * than maxAgeMinutes. Database-first resilience for transient feeds:
 * recent-but-expired weather beats nothing when the provider is down.
 * (Never use for alerts — an expired warning must not reappear.)
 */
async function getContextCacheStale(provider, contextType, geohash, maxAgeMinutes) {
  try {
    const oldest = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('ContextCache')
      .select('payload_json, fetched_at, provider_status')
      .eq('provider', provider)
      .eq('context_type', contextType)
      .eq('geohash', geohash)
      .gte('fetched_at', oldest)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.warn('ContextCache stale read error', { provider, contextType, geohash, error: error.message });
      return null;
    }
    return data || null;
  } catch (err) {
    logger.warn('ContextCache stale read exception', { provider, contextType, geohash, error: err.message });
    return null;
  }
}

module.exports = { getContextCache, getContextCacheStale, setContextCache, purgeExpiredContext };

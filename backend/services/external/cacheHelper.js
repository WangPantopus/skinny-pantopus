/**
 * External Feed Cache Helper — generic read/write for the ExternalFeedCache table.
 *
 * Provides getCache / setCache for any connector (NOAA, WSDOT, etc.) to
 * store and retrieve normalised external data with TTL-based expiry.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { createHash } = require('crypto');

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

// Raw reference data shares the existing, server-only JSONB table. Unlike a
// short-lived feed, it must survive the janitor and a provider outage. Freshness
// (maxAgeMs) is independent of retention. No credentials or caller identity are
// stored: the request identity is a digest of the endpoint and all query fields.
const responseFlights = new Map();

function hasData(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(hasData);
  if (typeof value === 'object') return Object.values(value).some(hasData);
  if (typeof value === 'string') return value.trim().length > 0;
  return true; // 0 and false are legitimate facts.
}

function responseIdentity(url) {
  const parsed = new URL(url);
  for (const name of [...parsed.searchParams.keys()]) {
    if (/^(key|api[-_]?key|access_token|token|wsapikey|auth-id|auth-token)$/i.test(name)) {
      parsed.searchParams.delete(name);
    }
  }
  parsed.searchParams.sort();
  parsed.hash = '';
  return {
    endpoint: `${parsed.origin}${parsed.pathname}`,
    key: createHash('sha256').update(parsed.toString()).digest('hex'),
  };
}

/**
 * Database first, then one asynchronous provider call and an awaited upsert.
 * isUsable validates the DATA portion, not an envelope containing only status.
 * Empty/error responses never replace a good copy. maxAgeMs is omitted for
 * stable facts; current-value/verification callers must supply their budget.
 * requirePersistence is for bounded operator jobs: a database read failure must
 * stop before another paid request, and an unsuccessful write must stop the job.
 */
async function readResponse({ provider, url, fetch: fetchResponse, isUsable = hasData,
  maxAgeMs = Infinity, allowStale = false, requirePersistence = false }) {
  const { endpoint, key } = responseIdentity(url);
  const namespace = `RESPONSE_V1:${provider}`;
  // Different freshness requirements must not share an in-flight result.
  const flightKey = `${namespace}:${key}:${maxAgeMs}:${allowStale}:${requirePersistence}`;
  if (responseFlights.has(flightKey)) return responseFlights.get(flightKey);
  const run = (async () => {
    let row;
    try {
      const { data, error } = await supabaseAdmin.from('ExternalFeedCache')
        .select('payload, fetched_at').eq('provider', namespace).eq('place_key', key).maybeSingle();
      if (error) throw error;
      row = data;
    } catch (error) {
      logger.warn('Provider response read failed', { provider, endpoint, error: error.message });
      if (requirePersistence) throw new Error('Provider cache read failed');
    }
    const stored = row?.payload?.response;
    const usable = isUsable(stored);
    const age = Date.now() - Date.parse(row?.fetched_at);
    const saved = { response: stored, fetchedAt: row?.fetched_at, hit: true, persisted: true };
    if (usable && (maxAgeMs === Infinity || (age >= 0 && age < maxAgeMs))) return saved;

    let response;
    try {
      response = await fetchResponse();
    } catch (error) {
      if (usable && allowStale) return saved;
      throw error;
    }
    if (!isUsable(response)) return usable && allowStale ? saved
      : { response: null, fetchedAt: null, hit: false, persisted: false };
    const fetchedAt = new Date().toISOString();
    let persisted = false;
    try {
      const { error } = await supabaseAdmin.from('ExternalFeedCache').upsert({
        provider: namespace,
        place_key: key,
        payload: { schema_version: 1, endpoint, response },
        fetched_at: fetchedAt,
        expires_at: 'infinity',
        etag: null,
      }, { onConflict: 'provider,place_key' });
      if (error) throw error;
      persisted = true;
    } catch (error) {
      // Keep the current request usable, but never claim it was persisted.
      logger.error('Provider response was not saved', { provider, endpoint, error: error.message });
      if (requirePersistence) throw new Error('Provider cache write failed');
    }
    return { response, fetchedAt, hit: false, persisted };
  })().finally(() => {
    if (responseFlights.get(flightKey) === run) responseFlights.delete(flightKey);
  });
  responseFlights.set(flightKey, run);
  return run;
}

module.exports = { getCache, setCache, purgeExpired, readResponse, hasData,
  _internals: { clearResponseFlights: () => responseFlights.clear() } };

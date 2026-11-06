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

// What a fetch returns when the provider answered that it has nothing for the
// request (no record, no estimate), as opposed to failing.
const NO_RESULT = Object.freeze({ noResult: true });
// Rows of their own beside the stored copy, so neither ever replaces a good one:
// a remembered "nothing here", and another server's lookup still running.
const EMPTY_SUFFIX = ':empty';
const LOOKUP_SUFFIX = ':lookup';
const LOOKUP_POLL_MS = 500;

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

// The first server to insert the short-lived lookup row asks the provider; the
// others wait for its answer. Best effort: when the row can't be read or
// written, this server asks too (a duplicate call beats a stuck screen).
async function claimLookup(provider, key, ms) {
  const now = new Date();
  try {
    const { error: cleanupError } = await supabaseAdmin.from('ExternalFeedCache').delete()
      .eq('provider', provider).eq('place_key', key).lt('expires_at', now.toISOString());
    if (cleanupError) throw cleanupError;
    const { data, error } = await supabaseAdmin.from('ExternalFeedCache').upsert({
      provider,
      place_key: key,
      payload: { schema_version: 1 },
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ms).toISOString(),
      etag: null,
    }, { onConflict: 'provider,place_key', ignoreDuplicates: true }).select('fetched_at');
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0].fetched_at || now.toISOString() : null;
  } catch (error) {
    logger.warn('Provider lookup claim failed', { provider, error: error.message });
    return now.toISOString();
  }
}

async function releaseLookup(provider, key, claimedAt) {
  try {
    const { error } = await supabaseAdmin.from('ExternalFeedCache').delete()
      .eq('provider', provider).eq('place_key', key).eq('fetched_at', claimedAt);
    if (error) throw error;
  } catch (error) {
    logger.warn('Provider lookup claim was not released', { provider, error: error.message });
  }
}

async function rememberEmpty(provider, key, endpoint, ms) {
  const now = new Date();
  try {
    const { error } = await supabaseAdmin.from('ExternalFeedCache').upsert({
      provider,
      place_key: key,
      payload: { schema_version: 1, endpoint, empty: true },
      fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ms).toISOString(),
      etag: null,
    }, { onConflict: 'provider,place_key' });
    if (error) throw error;
    return true;
  } catch (error) {
    logger.warn('Provider empty answer was not saved', { provider, endpoint, error: error.message });
    return false;
  }
}

/**
 * Database first, then one asynchronous provider call and an awaited upsert.
 * isUsable validates the DATA portion, not an envelope containing only status.
 * Empty/error responses never replace a good copy. maxAgeMs is omitted for
 * stable facts; current-value/verification callers must supply their budget.
 * requirePersistence is for bounded operator jobs: a database read failure must
 * stop before another paid request, and an unsuccessful write must stop the job.
 *
 * Screen lookups (ATTOM's) also pass:
 *   rememberEmptyMs  a NO_RESULT answer is kept that long, so the same request
 *                    answers from the database instead of asking (and paying)
 *                    again; with allowStale an older good copy keeps answering.
 *   shareFlightMs    while another server asks the same thing, wait up to that
 *                    long for its answer instead of asking too.
 *   cacheOnly        the database only, never the provider (`missing` when
 *                    nothing is stored).
 * An older good copy that answers with allowStale is marked `stale`.
 */
async function readResponse({ provider, url, fetch: fetchResponse, isUsable = hasData,
  maxAgeMs = Infinity, allowStale = false, requirePersistence = false,
  rememberEmptyMs = 0, shareFlightMs = 0, cacheOnly = false }) {
  const { endpoint, key } = responseIdentity(url);
  const namespace = `RESPONSE_V1:${provider}`;
  const markers = rememberEmptyMs > 0 || shareFlightMs > 0 || cacheOnly;
  // Different freshness requirements must not share an in-flight result.
  const flightKey = `${namespace}:${key}:${maxAgeMs}:${allowStale}:${requirePersistence}:${rememberEmptyMs}:${cacheOnly}`;
  if (responseFlights.has(flightKey)) return responseFlights.get(flightKey);
  const readRows = async () => {
    if (!markers) {
      const { data, error } = await supabaseAdmin.from('ExternalFeedCache')
        .select('payload, fetched_at').eq('provider', namespace).eq('place_key', key).maybeSingle();
      if (error) throw error;
      return { row: data };
    }
    const { data, error } = await supabaseAdmin.from('ExternalFeedCache')
      .select('provider, payload, fetched_at')
      .in('provider', [namespace, namespace + EMPTY_SUFFIX, namespace + LOOKUP_SUFFIX]).eq('place_key', key);
    if (error) throw error;
    const rows = new Map((data || []).map((row) => [row.provider, row]));
    return { row: rows.get(namespace), emptyRow: rows.get(namespace + EMPTY_SUFFIX), lookupRow: rows.get(namespace + LOOKUP_SUFFIX) };
  };
  // What the database answers by itself: a fresh copy, or a recent "nothing
  // here" (an older copy keeps answering beside it). Null: ask the provider.
  const storedAnswer = ({ row, emptyRow }) => {
    const stored = row?.payload?.response;
    const usable = isUsable(stored);
    const age = Date.now() - Date.parse(row?.fetched_at);
    const saved = { response: stored, fetchedAt: row?.fetched_at, hit: true, persisted: true };
    if (usable && (maxAgeMs === Infinity || (age >= 0 && age < maxAgeMs))) return saved;
    const emptyAge = Date.now() - Date.parse(emptyRow?.fetched_at);
    if (!(rememberEmptyMs > 0 && emptyAge >= 0 && emptyAge < rememberEmptyMs)) return null;
    return usable && allowStale ? { ...saved, stale: true, empty: true, emptyAt: emptyRow.fetched_at }
      : { response: null, fetchedAt: emptyRow.fetched_at, hit: true, persisted: true, empty: true, emptyAt: emptyRow.fetched_at };
  };
  const run = (async () => {
    let rows = {};
    try {
      rows = await readRows();
    } catch (error) {
      logger.warn('Provider response read failed', { provider, endpoint, error: error.message });
      if (requirePersistence) throw new Error('Provider cache read failed');
    }
    const stored = rows.row?.payload?.response;
    const kept = isUsable(stored) && allowStale
      ? { response: stored, fetchedAt: rows.row.fetched_at, hit: true, persisted: true, stale: true } : null;
    const answered = storedAnswer(rows);
    if (answered) return answered;
    if (cacheOnly) return kept || { response: null, fetchedAt: null, hit: false, persisted: false, missing: true };

    // Another server asking the same thing right now saves its answer here:
    // wait for it rather than ask again. If its lookup ends with nothing
    // saved (it failed), this server asks.
    let claimedAt = null;
    if (shareFlightMs > 0) {
      claimedAt = await claimLookup(namespace + LOOKUP_SUFFIX, key, shareFlightMs);
      for (const until = Date.now() + shareFlightMs; !claimedAt && Date.now() < until;) {
        await new Promise((resolve) => setTimeout(resolve, LOOKUP_POLL_MS));
        let again = null;
        try { again = await readRows(); } catch (_) { break; }
        const theirs = storedAnswer(again);
        if (theirs) return theirs;
        if (!again.lookupRow) break;
      }
    }
    try {
      let response;
      try {
        response = await fetchResponse();
      } catch (error) {
        if (kept) return kept;
        throw error;
      }
      if (response === NO_RESULT) {
        const emptyAt = new Date().toISOString();
        const remembered = rememberEmptyMs > 0
          && await rememberEmpty(namespace + EMPTY_SUFFIX, key, endpoint, rememberEmptyMs);
        return kept ? { ...kept, empty: true, emptyAt }
          : { response: null, fetchedAt: null, hit: false, persisted: remembered, empty: true, emptyAt };
      }
      if (!isUsable(response)) return kept || { response: null, fetchedAt: null, hit: false, persisted: false };
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
    } finally {
      if (claimedAt) await releaseLookup(namespace + LOOKUP_SUFFIX, key, claimedAt);
    }
  })().finally(() => {
    if (responseFlights.get(flightKey) === run) responseFlights.delete(flightKey);
  });
  responseFlights.set(flightKey, run);
  return run;
}

module.exports = { getCache, setCache, purgeExpired, readResponse, hasData, NO_RESULT,
  _internals: { clearResponseFlights: () => responseFlights.clear() } };

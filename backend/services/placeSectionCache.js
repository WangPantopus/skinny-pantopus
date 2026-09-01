/**
 * Place Section Cache (W0.3)
 *
 * Shared read-through TTL cache for PlaceIntelligence section providers,
 * backed by the PlaceSectionCache table (migration 156). Section adapters
 * (civic, EPA layers, HUD FMR, DSIRE, …) wrap their provider fetch in
 * `readThrough` and get the Step-1 freshness model for free:
 *
 *   const { payload, fetchedAt, stale } = await readThrough({
 *     cacheKey: `geo:${geohash6}`,        // 'home:…' | 'geo:…' | 'zip:…' | 'county:…'
 *     sectionId: 'civic_districts',
 *     ttlMs: 90 * 24 * 60 * 60 * 1000,
 *     fetch: () => civicProvider.fetchDistricts(latLng),
 *   });
 *
 * Behavior, in order:
 *   1. Fresh row (now < expires_at) → returned without calling `fetch`.
 *   2. Miss/expired → `fetch()` runs; the result is upserted and returned.
 *   3. `fetch()` throws but an expired row exists → that row is returned
 *      with `stale: true` so the composer can emit a `stale` envelope
 *      (section-level degradation, never all-or-nothing).
 *   4. `fetch()` throws with nothing cached → the error propagates to the
 *      caller (composers map it to an `error`/`unavailable` envelope).
 *
 * A `null`/`undefined` fetch result is treated as "provider had nothing"
 * and is NOT cached, so a transient empty answer can't mask data for a
 * full TTL.
 *
 * Resilience: if the table itself is missing (migration not applied yet),
 * the helper logs once and degrades to a direct fetch passthrough — a
 * pre-migration deploy stays correct, just uncached.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const TABLE = 'PlaceSectionCache';

// Log the missing-table condition once per process, not once per request.
let warnedMissingTable = false;

function isMissingTableError(error) {
  const msg = String((error && error.message) || '');
  return (
    (error && (error.code === 'PGRST205' || error.code === '42P01')) ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function warnMissingTableOnce(where, error) {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  logger.warn(`placeSectionCache: ${where} failed — running uncached (is migration 156 applied?)`, {
    error: error && error.message,
  });
}

async function readRow(cacheKey, sectionId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('payload, fetched_at, expires_at')
    .eq('cache_key', cacheKey)
    .eq('section_id', sectionId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) warnMissingTableOnce('read', error);
    else logger.warn('placeSectionCache: read failed', { cacheKey, sectionId, error: error.message });
    return null;
  }
  return data || null;
}

async function writeRow(cacheKey, sectionId, payload, ttlMs, fetchedAtIso) {
  const { error } = await supabaseAdmin.from(TABLE).upsert(
    {
      cache_key: cacheKey,
      section_id: sectionId,
      payload,
      fetched_at: fetchedAtIso,
      expires_at: new Date(Date.parse(fetchedAtIso) + ttlMs).toISOString(),
    },
    { onConflict: 'cache_key,section_id' },
  );
  if (error) {
    if (isMissingTableError(error)) warnMissingTableOnce('write', error);
    else logger.warn('placeSectionCache: write failed', { cacheKey, sectionId, error: error.message });
  }
}

/**
 * Read-through cache for one section payload.
 *
 * @param {object} params
 * @param {string} params.cacheKey   Scope-prefixed key ('home:…' | 'geo:…' | 'zip:…' | …).
 * @param {string} params.sectionId  Launch-set section id.
 * @param {number} params.ttlMs      Freshness budget for this section.
 * @param {function(): Promise<*>} params.fetch  Provider fetch; runs only on miss/expiry.
 * @param {boolean} [params.allowStale=true]     Serve an expired row when `fetch` fails.
 * @returns {Promise<{payload: *, fetchedAt: string|null, hit: boolean, stale: boolean}>}
 * @throws When `fetch` fails and no (allowed) cached row exists.
 */
async function readThrough({ cacheKey, sectionId, ttlMs, fetch, allowStale = true }) {
  if (!cacheKey || !sectionId || !Number.isFinite(ttlMs) || typeof fetch !== 'function') {
    throw new Error('placeSectionCache.readThrough: cacheKey, sectionId, ttlMs and fetch are required');
  }

  const row = await readRow(cacheKey, sectionId);
  const now = Date.now();

  if (row && Date.parse(row.expires_at) > now) {
    return { payload: row.payload, fetchedAt: row.fetched_at, hit: true, stale: false };
  }

  try {
    const payload = await fetch();
    if (payload == null) {
      // "Nothing there" is a valid provider answer — surfaced, not cached.
      return { payload: null, fetchedAt: null, hit: false, stale: false };
    }
    const fetchedAtIso = new Date(now).toISOString();
    await writeRow(cacheKey, sectionId, payload, ttlMs, fetchedAtIso);
    return { payload, fetchedAt: fetchedAtIso, hit: false, stale: false };
  } catch (err) {
    if (row && allowStale) {
      logger.warn('placeSectionCache: fetch failed — serving stale', {
        cacheKey,
        sectionId,
        error: err.message,
      });
      return { payload: row.payload, fetchedAt: row.fetched_at, hit: true, stale: true };
    }
    throw err;
  }
}

module.exports = {
  readThrough,
  // Exported for testing/janitor use.
  _internals: { isMissingTableError },
};

/**
 * NFIP Premium Benchmark (Wave 2 — "Flood Insurance, In Dollars")
 *
 * What flood policies around this home actually cost: count and
 * quartiles of real NFIP premiums in the home's census tract, from
 * OpenFEMA's NFIP Policies v3 (free, national, redacted to block
 * group). Extends the flood section — a zone tells you the hazard;
 * this tells you the bill.
 *
 * Probed live before building (2026-08-25):
 *   * v2 (FimaNfipPolicies) is DEPRECATED — frozen 2026-06-01, gone
 *     2026-10-15. v3 is /api/open/v3/NfipPolicies and renames
 *     censusTract → censusGeoid (12-digit block group), adds
 *     fullRiskPremium (Risk Rating 2.0).
 *   * The ONLY fast query shape is a bare censusGeoid range + $select
 *     + $top: latency scales ~20 ms/row, and adding $inlinecount,
 *     $orderby, or ANY second filter conjunction 503s around 60 s.
 *     A 2,000-row fetch runs ~40 s — far too slow for a request path.
 *
 * So the design is CACHE-ONLY composition + background warm:
 *   * the flood composer calls getTractBenchmark() — one cache read;
 *     on a miss it writes a `pending` marker and returns nothing;
 *   * the nfipTractWarm job (every 15 min) picks up pending/expired
 *     tracts and does the slow fetch with a job-sized timeout;
 *   * benchmarks cache 90 days (the dataset refreshes ~monthly);
 *   * fewer than K_MIN=10 recent policies → stored as `suppressed`
 *     (same floor the bill benchmark uses — premiums are about homes,
 *     and a benchmark of 3 neighbors is a disclosure, not a stat).
 *
 * Honesty: quartiles are labeled with their window (last 24 months of
 * policy effective dates) and coverage — a tract with more than
 * FETCH_ROW_CAP all-time rows gets stats over an arbitrary subset and
 * is marked `coverage: 'partial'`. Never presented as a quote.
 *
 * Re-probed 2026-10-15: the bare censusGeoid range above (and any shape
 * without a date filter) now times out at 90 s, so tract warms were
 * failing everywhere. The fast shape today is propertyState + a
 * censusGeoid prefix + policyEffectiveDate: a Clark County, WA tract in
 * ~3 s, the whole county in under 1 s, 2,000 Harris County, TX rows in
 * ~8 s. Both tracts and counties use it; the state comes from the
 * geoid's state FIPS prefix.
 *
 * County fallback (nationwide): a tract under the floor falls back to
 * its county, labeled as county-wide. County rows share this cache and
 * warm queue under `county:<5-digit FIPS>`.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { readRow, writeRow } = require('./placeSectionCache');

const OPENFEMA_BASE = 'https://www.fema.gov/api/open/v3/NfipPolicies';
// FEMA's terms require this sentence wherever OpenFEMA data is shown.
const OPENFEMA_NOTICE = "This product uses the Federal Emergency Management Agency's OpenFEMA API, but is not endorsed by FEMA.";
const SECTION_ID = '_nfip_tract';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // benchmark refresh cycle
const PENDING_TTL_MS = 90 * 24 * 60 * 60 * 1000; // marker lives until the job replaces it
// A capped fetch that still couldn't see K_MIN recent premiums is a
// sampling artifact, not a thin tract — retried on a short cycle, never
// parked for the full 90 days.
const INDETERMINATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A tract that failed this many warm attempts is dead-lettered on the
// short TTL: the composer stops waiting on it, and it gets a fresh start
// next week instead of occupying the queue forever.
const MAX_WARM_ATTEMPTS = 5;
// How long a claim parks a row before it becomes claimable again — the
// retry cadence for failed fetches, and the fence against a crashed
// worker orphaning a tract.
const CLAIM_RETRY_MS = 30 * 60 * 1000;
const WINDOW_MONTHS = 24;
const K_MIN = 10;
// One request, hard row cap — latency is ~20 ms/row server-side, so
// 2,000 rows ≈ 40 s, inside the job timeout and past most tracts'
// all-time policy count.
const FETCH_ROW_CAP = 2000;
const FETCH_TIMEOUT_MS = 75000;

function cacheKeyFor(tractId) {
  return `tract:${tractId}`;
}

function countyKeyFor(countyFips) {
  return `county:${countyFips}`;
}

function isValidTract(tractId) {
  return /^\d{11}$/.test(String(tractId || ''));
}

function isValidCounty(countyFips) {
  return /^\d{5}$/.test(String(countyFips || ''));
}

// Two-digit state FIPS → the USPS code OpenFEMA's propertyState uses.
const STATE_BY_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '72': 'PR',
};

/** A queue row's target: { kind: 'tract' | 'county', id }. */
function queueTarget(row) {
  const key = String((row && row.cache_key) || '');
  if (key.startsWith('tract:')) {
    const id = key.slice('tract:'.length);
    return isValidTract(id) ? { kind: 'tract', id } : null;
  }
  if (key.startsWith('county:')) {
    const id = key.slice('county:'.length);
    return isValidCounty(id) ? { kind: 'county', id } : null;
  }
  return null;
}

// ── The slow fetch (job context only) ────────────────────────

/**
 * The benchmark window's policies for a tract (11 digits) or county (5),
 * one unordered request in the fast shape (see the header): the state,
 * the geoid prefix and the window's start date.
 */
async function fetchPolicies(geoidPrefix, now = new Date()) {
  const state = STATE_BY_FIPS[String(geoidPrefix).slice(0, 2)];
  if (!state) throw new Error(`OpenFEMA: no state for ${geoidPrefix}`);
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - WINDOW_MONTHS);
  const filter = `propertyState eq '${state}' and startswith(censusGeoid,'${geoidPrefix}')`
    + ` and policyEffectiveDate ge '${windowStart.toISOString().slice(0, 10)}'`;
  const params = new URLSearchParams({
    $filter: filter,
    $top: String(FETCH_ROW_CAP),
    $select: 'totalInsurancePremiumOfThePolicy,fullRiskPremium,policyEffectiveDate,occupancyType',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${OPENFEMA_BASE}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenFEMA HTTP ${res.status}`);
    const json = await res.json();
    const rows = json && json.NfipPolicies;
    if (!Array.isArray(rows)) throw new Error('OpenFEMA: unexpected response shape');
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

const fetchTractPolicies = (tractId, now) => fetchPolicies(tractId, now);
const fetchCountyPolicies = (countyFips, now) => fetchPolicies(countyFips, now);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Rows → the stored benchmark payload. Pure, exported for tests.
 * @param {Array<object>} rows raw v3 policy rows
 * @param {Date} now
 */
function computeBenchmark(rows, now = new Date()) {
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - WINDOW_MONTHS);
  const startIso = windowStart.toISOString();

  const recent = rows.filter((r) => typeof r.policyEffectiveDate === 'string' && r.policyEffectiveDate >= startIso);
  const premiums = recent
    .map((r) => Number(r.totalInsurancePremiumOfThePolicy))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (premiums.length < K_MIN) {
    // Stored (not just returned) so the composer doesn't re-request a
    // warm for a tract we already know is too thin. BUT: when the fetch
    // hit the row cap, the thin window may be a sampling artifact — the
    // arbitrary 2,000-row subset skews old, and high-policy coastal
    // tracts are exactly where the benchmark matters. Marked
    // indeterminate so the job stores it on the short TTL instead of
    // parking a false "suppressed" for 90 days.
    if (rows.length >= FETCH_ROW_CAP) {
      return { suppressed: true, indeterminate: true, policy_count: premiums.length, coverage: 'partial' };
    }
    return { suppressed: true, policy_count: premiums.length };
  }

  const fullRisk = recent
    .map((r) => Number(r.fullRiskPremium))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  return {
    policy_count: premiums.length,
    premium_p25: quantile(premiums, 0.25),
    premium_median: quantile(premiums, 0.5),
    premium_p75: quantile(premiums, 0.75),
    // Risk Rating 2.0's actuarial number, where reported.
    full_risk_median: fullRisk.length >= K_MIN ? quantile(fullRisk, 0.5) : null,
    window_months: WINDOW_MONTHS,
    // FETCH_ROW_CAP all-time rows means an arbitrary subset was
    // sampled — the stats are honest but the coverage is not total.
    coverage: rows.length >= FETCH_ROW_CAP ? 'partial' : 'full',
  };
}

// ── Request-path read (never fetches) ────────────────────────

/**
 * The benchmark for a tract, from cache only.
 *
 * @param {string} tractId
 * @param {{enqueue?: boolean}} [opts] `enqueue: false` reads without
 *   leaving a pending marker. The anonymous preview passes it: the warm
 *   job takes 3 tracts per run at 12 runs an hour, and its pending lane
 *   is FIFO, so letting drive-by lookups queue lets anonymous traffic
 *   sit in front of tracts where someone actually lives. Enqueueing
 *   should follow the people, not the page views.
 * @returns {Promise<{status: 'ready'|'pending'|'suppressed', data?: object, fetchedAt?: string}>}
 *   `pending` also covers "tract we've never seen"; with `enqueue` left
 *   on, a marker row is written so the warm job picks it up.
 */
async function getTractBenchmark(tractId, { enqueue = true } = {}) {
  if (!isValidTract(tractId)) return { status: 'pending' };

  const row = await readRow(cacheKeyFor(tractId), SECTION_ID);
  const payload = row && row.payload;
  if (payload && !payload.pending) {
    if (payload.suppressed) return { status: 'suppressed' };
    return { status: 'ready', data: payload, fetchedAt: row.fetched_at };
  }

  if (!payload && enqueue) {
    // First sighting: leave a pending marker for the warm job. A lost
    // race between instances just writes the same marker twice.
    const nowIso = new Date().toISOString();
    await writeRow(cacheKeyFor(tractId), SECTION_ID, { pending: true, requested_at: nowIso }, PENDING_TTL_MS, nowIso);
  }
  return { status: 'pending' };
}

/**
 * The county-wide benchmark, from cache only — the fallback for a tract
 * under the floor. Same statuses and queue as getTractBenchmark.
 *
 * @param {string} countyFips 5-digit county FIPS
 */
async function getCountyBenchmark(countyFips, { enqueue = true } = {}) {
  if (!isValidCounty(countyFips)) return { status: 'pending' };

  const row = await readRow(countyKeyFor(countyFips), SECTION_ID);
  const payload = row && row.payload;
  if (payload && !payload.pending) {
    if (payload.suppressed) return { status: 'suppressed' };
    return { status: 'ready', data: payload, fetchedAt: row.fetched_at };
  }

  if (!payload && enqueue) {
    const nowIso = new Date().toISOString();
    await writeRow(countyKeyFor(countyFips), SECTION_ID, { pending: true, requested_at: nowIso }, PENDING_TTL_MS, nowIso);
  }
  return { status: 'pending' };
}

// ── The warm job worker ──────────────────────────────────────

/**
 * Claim one candidate row, atomically.
 *
 * The job runs on every instance at the same wall-clock minutes with no
 * leader election. Without a claim, every instance fetched the SAME
 * oldest candidates — N identical 40-second OpenFEMA pulls for zero
 * added throughput. And a failed tract kept its queue position forever:
 * three poison tracts occupied all the slots and the whole feature froze.
 *
 * The claim is one conditional UPDATE that (a) only one instance can
 * win (the previous fetched_at is the lock), and (b) advances the row's
 * queue keys, so even a tract whose fetch then FAILS rotates to the back
 * instead of head-blocking — the attempts counter rides along in the
 * payload for the dead-letter check.
 *
 * @returns the claimed row's payload, or null when another instance won.
 */
async function claimCandidate(row, nowIso) {
  const attempts = ((row.payload && row.payload.attempts) || 0) + 1;
  const claimedPayload = { ...(row.payload || {}), attempts, claimed_at: nowIso };
  const { data: claimed, error } = await supabaseAdmin
    .from('PlaceSectionCache')
    .update({
      payload: claimedPayload,
      fetched_at: nowIso,
      // Both queue lanes must rotate on a claim: pending markers sort by
      // fetched_at, expired benchmarks by expires_at. A failed fetch
      // retries in ~30 minutes instead of head-blocking its lane; a
      // successful one overwrites expires_at with the real TTL anyway.
      // (Reads never gate on expiry — a stale benchmark keeps serving.)
      expires_at: new Date(Date.parse(nowIso) + CLAIM_RETRY_MS).toISOString(),
    })
    .eq('cache_key', row.cache_key)
    .eq('section_id', SECTION_ID)
    .eq('fetched_at', row.fetched_at)
    .select('cache_key')
    .maybeSingle();
  if (error) {
    logger.warn('nfipWarm: claim failed', { cacheKey: row.cache_key, error: error.message });
    return null;
  }
  return claimed ? { attempts } : null;
}

/**
 * Fetch + store benchmarks for tracts that need it: pending markers
 * first, then the oldest expired benchmarks. Each candidate is claimed
 * before fetching (see claimCandidate), so concurrent instances drain
 * DIFFERENT tracts and adding instances adds throughput.
 * @returns {Promise<{warmed: number, failed: number, deadLettered: number}>}
 */
async function warmPendingTracts({ limit = 3 } = {}) {
  const nowIso = new Date().toISOString();
  const candidates = [];

  const { data: pending, error: pendErr } = await supabaseAdmin
    .from('PlaceSectionCache')
    .select('cache_key, payload, fetched_at')
    .eq('section_id', SECTION_ID)
    .filter('payload->>pending', 'eq', 'true')
    .order('fetched_at', { ascending: true })
    .range(0, limit - 1);
  if (pendErr) {
    // Missing table = migration 156 not applied; nothing to warm.
    logger.warn('nfipWarm: pending scan failed', { error: pendErr.message });
    return { warmed: 0, failed: 0, deadLettered: 0 };
  }
  candidates.push(...(pending || []));

  if (candidates.length < limit) {
    const { data: expired } = await supabaseAdmin
      .from('PlaceSectionCache')
      .select('cache_key, payload, fetched_at')
      .eq('section_id', SECTION_ID)
      .lt('expires_at', nowIso)
      .order('expires_at', { ascending: true })
      .range(0, limit - candidates.length - 1);
    for (const row of expired || []) {
      if (!candidates.some((c) => c.cache_key === row.cache_key)) candidates.push(row);
    }
  }

  let warmed = 0;
  let failed = 0;
  let deadLettered = 0;
  for (const row of candidates.slice(0, limit)) {
    const target = queueTarget(row);
    if (!target) continue;
    const tractId = target.id; // a tract or county id; the log key stays `tractId`
    const keyFor = target.kind === 'county' ? countyKeyFor : cacheKeyFor;

    const claim = await claimCandidate(row, nowIso);
    if (!claim) continue; // another instance owns this tract this round

    // Dead-letter: a tract that keeps failing stops occupying the queue.
    // Stored as suppressed on the SHORT TTL — the composer degrades to
    // the zone-only card, and next week the tract gets a clean retry.
    //
    // The attempt counter is RESET here, not carried forward. Writing
    // the exhausted count into the dead-letter payload made the "fresh
    // start" impossible: the next cycle's claim incremented from 6 to 7,
    // tripped this branch before fetching, and re-dead-lettered — so a
    // tract that failed once during an OpenFEMA outage would never be
    // warmed again, and its residents' flood card would stay
    // benchmark-less forever. The count belongs to a retry episode, not
    // to the tract.
    if (claim.attempts > MAX_WARM_ATTEMPTS) {
      await writeRow(
        keyFor(tractId),
        SECTION_ID,
        {
          suppressed: true,
          unavailable: true,
          reason: 'fetch_failed',
          attempts: 0,
          last_failed_after: claim.attempts,
        },
        INDETERMINATE_TTL_MS,
        new Date().toISOString(),
      );
      deadLettered += 1;
      logger.warn('nfipWarm: tract dead-lettered after repeated failures', { tractId, attempts: claim.attempts });
      continue;
    }

    try {
      const rows = await fetchPolicies(tractId);
      const benchmark = computeBenchmark(rows);
      const fetchedIso = new Date().toISOString();
      // Indeterminate (capped fetch, thin window) retries on the short
      // cycle; everything else settles for the full benchmark TTL.
      const ttl = benchmark.indeterminate ? INDETERMINATE_TTL_MS : TTL_MS;
      await writeRow(keyFor(tractId), SECTION_ID, benchmark, ttl, fetchedIso);
      warmed += 1;
      logger.info('nfipWarm: tract warmed', {
        kind: target.kind,
        tractId,
        rows: rows.length,
        suppressed: Boolean(benchmark.suppressed),
        attempts: claim.attempts,
      });
    } catch (err) {
      // The claim already rotated this tract to the back of the queue
      // and recorded the attempt — the next run tries a DIFFERENT tract
      // first, and this one retries later or dead-letters at the cap.
      failed += 1;
      logger.warn('nfipWarm: tract fetch failed', { tractId, attempts: claim.attempts, error: err.message });
    }
  }
  return { warmed, failed, deadLettered };
}

module.exports = {
  getTractBenchmark,
  getCountyBenchmark,
  warmPendingTracts,
  OPENFEMA_NOTICE,
  // Exported for testing.
  computeBenchmark,
  fetchTractPolicies,
  fetchCountyPolicies,
  isValidTract,
  K_MIN,
  WINDOW_MONTHS,
  FETCH_ROW_CAP,
  SECTION_ID,
};

/**
 * Real Rent Benchmark (Wave 3) — what neighbors ACTUALLY pay.
 *
 * The distinction that makes this worth building: `rent_band` is HUD's
 * Fair Market Rent, a 40th-percentile estimate for an entire COUNTY.
 * This is real monthly rents, reported by verified residents of ONE
 * geohash-6 block. A renter comparing their $2,400 against "HUD says
 * $2,120 for this county" learns nothing; comparing it against "ten
 * verified neighbors on your block pay $1,950–$2,300" is the number
 * they cannot get anywhere else — not from Zillow, not from the
 * listing sites, because nobody else can prove the reporters live
 * there.
 *
 * That proof is the whole product, so the contribution path is
 * T4-gated at the route: only a VERIFIED occupant may report.
 *
 * The privacy model, in one place:
 *   * K_MIN = 10 reports before ANY aggregate is returned — the same
 *     floor densityReader and the bill benchmark use;
 *   * quartiles + sample size only, never a row and never a per-home
 *     figure;
 *   * below the floor the caller gets `suppressed` with the PROGRESS
 *     count (how many have shared), which is safe precisely because it
 *     is bounded below the floor and carries no amounts — and it is
 *     what makes the Block Founders meter honest;
 *   * bedroom scope degrades explicitly: exact bedroom match if it
 *     clears the floor, else all sizes, else suppressed — the payload
 *     always says which, so a studio is never quietly priced against
 *     a four-bedroom.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { encodeGeohash } = require('../utils/geohash');

// The k-anonymity floor. Deliberately equal to densityReader.K_ANON_MIN
// and the bill benchmark's household_count floor — one number for
// "enough neighbors that no one is singled out", so the surfaces can
// never be compared against each other to narrow a cell.
const K_MIN = 10;

// Plausibility fence, mirrored from the CHECK constraint in migration
// 172 so a bad value is a clean 400 rather than a database error.
const MIN_RENT_CENTS = 5000; //     $50/mo
const MAX_RENT_CENTS = 5000000; // $50,000/mo

// The aggregate scan is bounded: a geohash-6 cell is roughly a city
// block, so this is far above any real cell and exists only so a
// pathological cell cannot pull an unbounded result set.
const CELL_ROW_CAP = 2000;

class RentReportError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function cellForHome(home) {
  // Number(null) is 0 — a finite value — so a missing coordinate must be
  // rejected BEFORE coercion or the home lands in the (0,0) cell.
  if (!home || home.map_center_lat == null || home.map_center_lng == null) return null;
  const lat = Number(home.map_center_lat);
  const lng = Number(home.map_center_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return encodeGeohash(lat, lng, 6);
}

/**
 * Bedrooms the report is FOR: the caller's value, else the home's.
 *
 * Returns null when neither is known — NOT 0. `Number(null)` is 0, a
 * finite value, so coercing first files every null-bedroom home as a
 * STUDIO: the resident's card reads "· studio", the shared studio
 * cohort's median is skewed by a house, and the read side then prices
 * them against studios. Home.bedrooms is nullable and all three clients
 * invite omission ("Leave it blank"), so this is the common case, not
 * an edge one. (cellForHome above guards the identical coercion for
 * coordinates; this is the same trap.)
 *
 * A null bedroom count is already legal — the migration's CHECK allows
 * it, and computeBlockRent keeps such rows out of every same-size
 * bucket while still counting them under 'all_sizes'. That is the
 * honest degradation.
 */
function normalizeBedrooms(value, home) {
  // The HOME's own record wins when it has one. The caller's declared
  // value is only a fallback for a home with no bedroom count on file.
  //
  // This is a privacy boundary, not a data-quality preference: a
  // freely-declared bedroom count lets a verified occupant join ANY
  // size cohort in their cell, including one sitting at 9 reports that
  // the k floor is deliberately suppressing — their own controllable
  // row lifts it over the line and the band opens up. Anchoring to the
  // home record removes that lever; a resident who disagrees with the
  // count edits their home, which is the single source of truth and is
  // already the number every other section reads.
  const raw = (home && home.bedrooms != null && home.bedrooms !== '')
    ? home.bedrooms
    : value;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n)));
}

function parseRentCents(monthlyRent) {
  const n = Number(monthlyRent);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RentReportError('Enter your monthly rent.', 'BAD_AMOUNT');
  }
  // Stored to the whole dollar, because that is the only precision the
  // product ever shows. Keeping cents made the round-trip lossy: a
  // resident who entered $2,400.50 read it back as $2,401, and simply
  // opening the edit form and pressing Save silently rewrote their
  // figure. Round once, at the boundary, and read == write forever.
  const cents = Math.round(n) * 100;
  if (cents < MIN_RENT_CENTS || cents > MAX_RENT_CENTS) {
    throw new RentReportError('That monthly rent looks off — enter the amount you pay each month.', 'BAD_AMOUNT');
  }
  return cents;
}

// Published figures are rounded to this many dollars. Nearest-rank
// quantiles return a RAW ARRAY ELEMENT, so an unrounded p25/median/p75
// at the k floor is literally three neighbours' exact monthly rents.
// Binning breaks the identity between a published statistic and a
// single household's figure while costing the reader nothing — nobody
// needs a block benchmark to the dollar.
const PUBLISH_ROUNDING_DOLLARS = 25;

function roundToBin(dollars) {
  return Math.round(dollars / PUBLISH_ROUNDING_DOLLARS) * PUBLISH_ROUNDING_DOLLARS;
}

// Published figures average a WINDOW, never a single order statistic.
// Nearest-rank selection returns one array element, so p25/median/p75
// were literally three neighbours' rents — binning to $25 only blurred
// them, and for rent a $25 window is effectively exact. Averaging at
// least three values means no published number is any one household's.
const PUBLISH_WINDOW = 3;

function quantile(sortedCents, q) {
  if (!sortedCents.length) return null;
  const idx = Math.min(sortedCents.length - 1, Math.max(0, Math.round(q * (sortedCents.length - 1))));
  const half = Math.floor(PUBLISH_WINDOW / 2);
  const lo = Math.max(0, Math.min(idx - half, sortedCents.length - PUBLISH_WINDOW));
  const hi = Math.min(sortedCents.length, lo + PUBLISH_WINDOW);
  const window = sortedCents.slice(Math.max(0, lo), hi);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  return roundToBin(mean / 100);
}

// ── The resident's own report ────────────────────────────────

/**
 * Create or update this resident's rent report for the home.
 * Route-gated to verified occupants — see routes/realRent.js.
 */
async function setReport({ home, userId, monthlyRent, bedrooms }) {
  const geohash6 = cellForHome(home);
  if (!geohash6) {
    throw new RentReportError('We could not place this home on a block yet.', 'NO_COORDINATES');
  }
  const cents = parseRentCents(monthlyRent);
  const nowIso = new Date().toISOString();

  // No `id` in the payload: the column has a DB default, and supplying a
  // fresh uuid would rewrite the row's primary key on every edit (the
  // bug the rate watch shipped with).
  const { data, error } = await supabaseAdmin
    .from('HomeRentReport')
    .upsert(
      {
        home_id: home.id,
        user_id: userId,
        geohash6,
        monthly_rent_cents: cents,
        bedrooms: normalizeBedrooms(bedrooms, home),
        updated_at: nowIso,
      },
      { onConflict: 'home_id,user_id' },
    )
    .select()
    .single();
  if (error) {
    logger.error('realRent: upsert failed', { homeId: home.id, userId, error: error.message });
    throw new Error('Could not save your rent');
  }
  return serializeReport(data);
}

async function getReport({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('HomeRentReport')
    .select('*')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.warn('realRent: read failed', { homeId, userId, error: error.message });
    return null;
  }
  return data ? serializeReport(data) : null;
}

async function deleteReport({ homeId, userId }) {
  const { error } = await supabaseAdmin
    .from('HomeRentReport')
    .delete()
    .eq('home_id', homeId)
    .eq('user_id', userId);
  if (error) {
    logger.warn('realRent: delete failed', { homeId, userId, error: error.message });
    throw new Error('Could not remove your rent');
  }
  return { ok: true };
}

function serializeReport(row) {
  return {
    monthly_rent: Math.round(row.monthly_rent_cents / 100),
    bedrooms: row.bedrooms,
    reported_at: row.reported_at,
    updated_at: row.updated_at,
  };
}

// ── The block aggregate ──────────────────────────────────────

/**
 * Every report in the cell, capped. Returns raw rows for the pure
 * aggregator below — callers outside this module must never see them.
 */
async function readCellReports(geohash6) {
  const { data, error } = await supabaseAdmin
    .from('HomeRentReport')
    // home_id is required for the ONE-ROW-PER-HOME collapse below: the
    // floor must count households, not rows.
    .select('home_id, monthly_rent_cents, bedrooms, updated_at')
    .eq('geohash6', geohash6)
    .range(0, CELL_ROW_CAP - 1);
  if (error) {
    logger.warn('realRent: cell scan failed', { geohash6, error: error.message });
    return null;
  }
  return data || [];
}

/**
 * Rows → the block benchmark. PURE, exported for tests.
 *
 * Bedroom scope degrades explicitly rather than silently widening:
 *   1. reports at the viewer's own bedroom count, if that clears K_MIN;
 *   2. else every size in the cell, if THAT clears K_MIN, labeled so;
 *   3. else suppressed, carrying only the progress count.
 *
 * @param {Array<{monthly_rent_cents:number, bedrooms:number|null}>} rows
 * @param {number|null} bedrooms  the viewer's own bedroom count
 */
function computeBlockRent(rows, bedrooms, viewerHomeId) {
  const clean = (rows || [])
    .map((r) => ({
      homeId: r.home_id == null ? null : String(r.home_id),
      cents: Number(r.monthly_rent_cents),
      bedrooms: r.bedrooms,
      updatedAt: r.updated_at || '',
    }))
    .filter((r) => Number.isFinite(r.cents) && r.cents > 0);

  // ONE ROW PER HOME. The table is unique per (home_id, user_id), so a
  // household with two verified occupants files two rows — which would
  // let five households satisfy a floor the product states as "10
  // verified homes", and would double-weight that household in the
  // median. Collapse to the most recently updated report per home
  // BEFORE the floor is applied, so both the count and the statistic
  // are per-household. Rows with no home id (not producible by the
  // service, but the aggregator is pure and takes what it is given)
  // each stand alone.
  const byHome = new Map();
  const all = [];
  for (const r of clean) {
    // THE VIEWER'S OWN ROW IS NEVER IN THE SAMPLE. This is the structural
    // defence: the viewer controls that row completely and can rewrite it
    // without limit, so including it let them (a) sweep their own value
    // and read neighbours' figures out of the moving statistics, and
    // (b) lift a 9-household cohort the floor is deliberately suppressing
    // over the line using nothing but their own contribution. Anchoring
    // the cohort to the home record only moved that lever one editable
    // field away; removing the row removes it. It also reads better: the
    // band is what the NEIGHBOURS pay, which is what a standing is
    // measured against.
    if (viewerHomeId != null && r.homeId === String(viewerHomeId)) continue;
    if (r.homeId == null) { all.push(r); continue; }
    const held = byHome.get(r.homeId);
    if (!held || String(r.updatedAt) > String(held.updatedAt)) byHome.set(r.homeId, r);
  }
  all.push(...byHome.values());

  const sameSize = bedrooms == null
    ? []
    : all.filter((r) => r.bedrooms === bedrooms);

  let scope = null;
  let sample = null;
  if (sameSize.length >= K_MIN) {
    scope = 'bedrooms';
    sample = sameSize;
  } else if (all.length >= K_MIN) {
    scope = 'all_sizes';
    sample = all;
  }

  if (!sample) {
    // Below the floor: the PROGRESS count only. No amounts, and the
    // number is bounded under K_MIN so it cannot single anyone out —
    // this is what the Block Founders meter reads.
    return {
      suppressed: true,
      reports: all.length,
      needed: K_MIN,
    };
  }

  const sorted = sample.map((r) => r.cents).sort((a, b) => a - b);
  return {
    suppressed: false,
    scope,
    bedrooms: scope === 'bedrooms' ? bedrooms : null,
    sample_size: sorted.length,
    rent_p25: quantile(sorted, 0.25),
    rent_median: quantile(sorted, 0.5),
    rent_p75: quantile(sorted, 0.75),
  };
}

/**
 * The block's real-rent benchmark for one home, plus the viewer's own
 * position in it when they have reported.
 *
 * @returns {Promise<object|null>} null when the home has no cell.
 */
async function getBlockBenchmark({ home, userId }) {
  const geohash6 = cellForHome(home);
  if (!geohash6) return null;

  const [rows, own] = await Promise.all([
    readCellReports(geohash6),
    userId ? getReport({ homeId: home.id, userId }) : Promise.resolve(null),
  ]);
  if (rows === null) return null;

  const bedrooms = normalizeBedrooms(own && own.bedrooms, home);
  const benchmark = computeBlockRent(rows, bedrooms, home.id);

  if (benchmark.suppressed) {
    return {
      status: 'building',
      reports: benchmark.reports,
      needed: benchmark.needed,
      your_rent: own ? own.monthly_rent : null,
    };
  }

  // The viewer's standing, stated in the band's own terms. Never a
  // rank ("you pay more than 7 neighbors") — that is a headcount of
  // identifiable households; a quartile position is not.
  let standing = null;
  if (own && benchmark.rent_p25 != null && benchmark.rent_p75 != null) {
    if (own.monthly_rent < benchmark.rent_p25) standing = 'below_band';
    else if (own.monthly_rent > benchmark.rent_p75) standing = 'above_band';
    else standing = 'in_band';
  }

  return {
    status: 'ready',
    scope: benchmark.scope,
    bedrooms: benchmark.bedrooms,
    sample_size: benchmark.sample_size,
    rent_p25: benchmark.rent_p25,
    rent_median: benchmark.rent_median,
    rent_p75: benchmark.rent_p75,
    your_rent: own ? own.monthly_rent : null,
    standing,
  };
}

/**
 * How many reports the cell holds — the Block Founders meter's reading.
 * Bounded and amount-free by construction.
 */
async function countCellReports(geohash6) {
  if (!geohash6) return 0;
  const { count, error } = await supabaseAdmin
    .from('HomeRentReport')
    .select('id', { count: 'exact', head: true })
    .eq('geohash6', geohash6);
  if (error) {
    logger.warn('realRent: cell count failed', { geohash6, error: error.message });
    return 0;
  }
  return count || 0;
}

module.exports = {
  setReport,
  getReport,
  deleteReport,
  getBlockBenchmark,
  countCellReports,
  RentReportError,
  K_MIN,
  // Exported for testing.
  computeBlockRent,
  normalizeBedrooms,
  cellForHome,
};

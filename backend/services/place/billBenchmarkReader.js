'use strict';
/**
 * Place — bill-benchmark read helper (W0.4)
 *
 * Reads the per-(geohash-6, bill_type) neighborhood bill aggregates written
 * by the `billBenchmarkRefresh` job (BillBenchmark table) and returns a
 * peer-relative view, gated by the same k-anon display floor the existing
 * `/api/homes/:id/bill-trends` endpoint uses:
 *   household_count >= 10  → shown (aggregates safe to reveal)
 *   household_count 3 .. 9 → insufficient_data (no amounts revealed)
 *   < 3 (never written)    → unavailable
 *
 * "Peer-relative": given the resident's own amount, it expresses where they
 * sit relative to the neighborhood (signed percent + a relation enum),
 * without exposing any individual neighbor's bill.
 *
 * Consumed by the Place dashboard (W0.3) Money Signals composer.
 *
 * @module services/place/billBenchmarkReader
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

// Mirrors billBenchmarkRefresh: rows with < 3 households are never written;
// the display floor for revealing aggregates is 10 households.
const BENCHMARK_DISPLAY_MIN = 10;
// Dead-band around the peer average: a resident within ±TYPICAL_PCT reads as
// "typical" rather than above/below, so tiny differences aren't dramatized.
const TYPICAL_PCT = 5;

/**
 * Compare a resident amount to the peer average. Pure + synchronous.
 *
 * @param {number} userAmountCents  resident's own amount, in cents
 * @param {number} peerAvgCents     neighborhood average, in cents
 * @returns {{ delta_pct: number, relation: 'above'|'below'|'typical' }|null}
 *          null when either input is missing / non-positive
 */
function relativeToPeers(userAmountCents, peerAvgCents) {
  const u = Number(userAmountCents);
  const p = Number(peerAvgCents);
  if (!Number.isFinite(u) || !Number.isFinite(p) || u <= 0 || p <= 0) return null;

  const deltaPct = Math.round(((u - p) / p) * 100);
  let relation = 'typical';
  if (deltaPct > TYPICAL_PCT) relation = 'above';
  else if (deltaPct < -TYPICAL_PCT) relation = 'below';

  return { delta_pct: deltaPct, relation };
}

/**
 * Read the peer-relative bill benchmark for a geohash-6 cell + bill type.
 *
 * Uses the most recent month that meets the display floor. Fails closed to
 * `unavailable` on bad input or read error so composers always get a valid
 * shape.
 *
 * @param {string} geohash   geohash-6 prefix
 * @param {string} billType  e.g. 'electric', 'gas', 'water'
 * @param {object} [opts]
 * @param {number|null} [opts.userAmountCents]  resident amount, for the comparison
 * @param {number} [opts.displayMin=10]         k-anon display floor (households)
 * @returns {Promise<object>} one of:
 *   { geohash, bill_type, status: 'ok', period, household_count,
 *     avg_amount_cents, median_amount_cents, comparison }
 *   { geohash, bill_type, status: 'insufficient_data', needed }
 *   { geohash, bill_type, status: 'unavailable' }
 */
async function getBillBenchmark(geohash, billType, opts = {}) {
  const displayMin = opts.displayMin != null ? opts.displayMin : BENCHMARK_DISPLAY_MIN;
  const userAmountCents = opts.userAmountCents != null ? opts.userAmountCents : null;
  const base = { geohash: geohash || null, bill_type: billType || null };

  if (!geohash || !billType) {
    return { ...base, status: 'unavailable' };
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('BillBenchmark')
      .select('month, year, avg_amount_cents, median_amount_cents, household_count')
      .eq('geohash', geohash)
      .eq('bill_type', billType);

    if (error) {
      logger.warn('placeBillBenchmarkReader: BillBenchmark read error', {
        geohash,
        billType,
        error: error.message,
      });
      return { ...base, status: 'unavailable' };
    }

    if (!rows || rows.length === 0) {
      return { ...base, status: 'unavailable' };
    }

    // Most recent period first (year, then month).
    const sorted = rows
      .slice()
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    const displayable = sorted.find((r) => (r.household_count || 0) >= displayMin);

    if (!displayable) {
      // Below the display floor: signal "almost there" using the most recent
      // sub-threshold row, without revealing any amounts.
      const best = sorted[0];
      return {
        ...base,
        status: 'insufficient_data',
        needed: Math.max(1, displayMin - (best.household_count || 0)),
      };
    }

    const comparison = userAmountCents != null
      ? relativeToPeers(userAmountCents, displayable.avg_amount_cents)
      : null;

    return {
      ...base,
      status: 'ok',
      period: { month: displayable.month, year: displayable.year },
      household_count: displayable.household_count,
      avg_amount_cents: displayable.avg_amount_cents,
      median_amount_cents: displayable.median_amount_cents != null
        ? displayable.median_amount_cents
        : null,
      comparison,
    };
  } catch (err) {
    logger.error('placeBillBenchmarkReader: getBillBenchmark failed', {
      geohash,
      billType,
      error: err.message,
    });
    return { ...base, status: 'unavailable' };
  }
}

module.exports = {
  getBillBenchmark,
  relativeToPeers,
  BENCHMARK_DISPLAY_MIN,
  TYPICAL_PCT,
};

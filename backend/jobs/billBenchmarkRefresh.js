// ============================================================
// JOB: Bill Benchmark Refresh
// Pre-computes anonymous neighborhood bill averages from paid
// HomeBill records. Groups by geohash-6 + bill_type + month/year.
// Upserts into BillBenchmark. Runs every 6 hours at :05.
// ============================================================

const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const { encodeGeohash } = require('../utils/geohash');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a PostGIS geography value (WKB hex, GeoJSON, or WKT) to { lat, lng }.
 */
function parseLocation(point) {
  if (!point) return null;
  // GeoJSON
  if (typeof point === 'object' && point.coordinates) {
    return { lat: point.coordinates[1], lng: point.coordinates[0] };
  }
  const str = String(point);
  // WKT
  const wkt = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wkt) return { lat: parseFloat(wkt[2]), lng: parseFloat(wkt[1]) };
  // WKB hex (Supabase geography columns)
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const offset = hasSRID ? 9 : 5;
      const readDouble = le
        ? (o) => buf.readDoubleLE(o)
        : (o) => buf.readDoubleBE(o);
      return { lat: readDouble(offset + 8), lng: readDouble(offset) };
    } catch { return null; }
  }
  return null;
}

/**
 * Compute median of a sorted (ascending) array of numbers.
 */
function median(sorted) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ── Main job ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 1000;

async function billBenchmarkRefresh() {
  // 0. Fetch opted-in home IDs (only these contribute to benchmarks)
  const optedInHomeIds = new Set();
  let prefOffset = 0;
  let prefHasMore = true;

  while (prefHasMore) {
    const { data: prefs, error: prefError } = await supabaseAdmin
      .from('HomePreference')
      .select('home_id')
      .eq('key', 'bill_benchmark_opt_in')
      .eq('value', 'true')
      .range(prefOffset, prefOffset + BATCH_SIZE - 1);

    if (prefError) {
      logger.error('[billBenchmarkRefresh] Failed to fetch opt-in preferences', { error: prefError.message });
      return;
    }

    if (!prefs || prefs.length === 0) {
      prefHasMore = false;
    } else {
      for (const p of prefs) optedInHomeIds.add(p.home_id);
      prefOffset += BATCH_SIZE;
      if (prefs.length < BATCH_SIZE) prefHasMore = false;
    }
  }

  if (optedInHomeIds.size === 0) {
    logger.info('[billBenchmarkRefresh] No homes opted in to bill benchmarks');
    return;
  }

  logger.info('[billBenchmarkRefresh] Opted-in homes', { count: optedInHomeIds.size });

  // 1. Fetch paid bills from opted-in homes only
  let allBills = [];
  let offset = 0;
  let hasMore = true;
  const optedInArray = Array.from(optedInHomeIds);

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('HomeBill')
      .select('id, home_id, bill_type, amount, period_start, home:home_id ( id, location )')
      .in('home_id', optedInArray)
      .eq('status', 'paid')
      .gt('amount', 0)
      .not('period_start', 'is', null)
      .not('bill_type', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      logger.error('[billBenchmarkRefresh] Failed to fetch bills', { error: error.message, offset });
      return;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allBills = allBills.concat(data);
      offset += BATCH_SIZE;
      if (data.length < BATCH_SIZE) hasMore = false;
    }
  }

  if (allBills.length === 0) {
    logger.info('[billBenchmarkRefresh] No paid bills from opted-in homes to process');
    return;
  }

  logger.info('[billBenchmarkRefresh] Fetched bills from opted-in homes', { count: allBills.length });

  // 2. Group by (geohash6, bill_type, month, year)
  const groups = {};

  for (const bill of allBills) {
    const loc = parseLocation(bill.home?.location);
    if (!loc) continue;

    const geohash = encodeGeohash(loc.lat, loc.lng, 6);
    const periodDate = new Date(bill.period_start);
    const month = periodDate.getUTCMonth() + 1; // 1-12
    const year = periodDate.getUTCFullYear();

    const key = `${geohash}|${bill.bill_type}|${month}|${year}`;
    if (!groups[key]) {
      groups[key] = { geohash, bill_type: bill.bill_type, month, year, amounts: [], homeIds: new Set() };
    }
    groups[key].amounts.push(bill.amount);
    groups[key].homeIds.add(bill.home_id);
  }

  // 3. Compute aggregates and filter by minimum household count
  //    PRIVACY: Never write rows with < 3 households (absolute floor).
  //    Display threshold is 10 (enforced by endpoint), but we also store
  //    rows with 3-9 so the endpoint can return an "insufficient_data" flag.
  const MIN_WRITE_HOUSEHOLDS = 3;
  const rows = [];
  let skippedGroups = 0;

  for (const g of Object.values(groups)) {
    const householdCount = g.homeIds.size;
    if (householdCount < MIN_WRITE_HOUSEHOLDS) {
      skippedGroups++;
      continue;
    }

    const sorted = g.amounts.slice().sort((a, b) => a - b);
    const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
    const med = median(sorted);

    rows.push({
      geohash: g.geohash,
      bill_type: g.bill_type,
      month: g.month,
      year: g.year,
      avg_amount_cents: avg,
      median_amount_cents: med,
      household_count: householdCount,
      computed_at: new Date().toISOString(),
    });
  }

  if (skippedGroups > 0) {
    logger.info('[billBenchmarkRefresh] Skipped groups with insufficient households', {
      skipped: skippedGroups,
      threshold: MIN_WRITE_HOUSEHOLDS,
    });
  }

  logger.info('[billBenchmarkRefresh] Computed benchmarks', {
    groups: Object.keys(groups).length,
    qualifying: rows.length,
  });

  // 4. Upsert in batches
  const UPSERT_BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabaseAdmin
      .from('BillBenchmark')
      .upsert(batch, { onConflict: 'geohash,bill_type,month,year' });

    if (error) {
      logger.error('[billBenchmarkRefresh] Upsert failed', { error: error.message, batchStart: i });
    } else {
      upserted += batch.length;
    }
  }

  // 5. Cleanup rows older than 24 months
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  const cutoffYear = cutoff.getUTCFullYear();
  const cutoffMonth = cutoff.getUTCMonth() + 1;

  // Delete rows where (year < cutoffYear) OR (year = cutoffYear AND month < cutoffMonth)
  const { error: delError, count: deleted } = await supabaseAdmin
    .from('BillBenchmark')
    .delete({ count: 'exact' })
    .or(`year.lt.${cutoffYear},and(year.eq.${cutoffYear},month.lt.${cutoffMonth})`);

  if (delError) {
    logger.warn('[billBenchmarkRefresh] Cleanup failed', { error: delError.message });
  }

  logger.info('[billBenchmarkRefresh] Done', { upserted, deleted: deleted || 0 });
}

module.exports = billBenchmarkRefresh;

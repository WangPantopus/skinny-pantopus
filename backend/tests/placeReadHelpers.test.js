/**
 * Tests for the Place read helpers (W0.4)
 *
 *  - densityReader.bucketForCount / getDensityBucket
 *      k-anon flooring: small N collapses to 'forming'/'none', and the raw
 *      verified-neighbor count is never surfaced.
 *  - billBenchmarkReader.relativeToPeers / getBillBenchmark
 *      peer-relative comparison + the household display floor.
 *
 * Uses the shared in-memory supabaseAdmin mock (wired via jest moduleNameMapper),
 * seeded per-test.
 */

const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

const {
  getDensityBucket,
  bucketForCount,
  DENSITY_BUCKET,
  K_ANON_MIN,
  FEW_MAX,
} = require('../services/place/densityReader');

const {
  getBillBenchmark,
  relativeToPeers,
  BENCHMARK_DISPLAY_MIN,
} = require('../services/place/billBenchmarkReader');

const VALID_BUCKETS = ['none', 'forming', 'few', 'growing'];

beforeEach(() => resetTables());

// ─────────────────────────────────────────────────────────────────────────
// bucketForCount — the k-anon flooring (the core VERIFY requirement)
// ─────────────────────────────────────────────────────────────────────────
describe('densityReader.bucketForCount — k-anon flooring', () => {
  it('maps 0 (and empty cells) to "none"', () => {
    expect(bucketForCount(0)).toBe('none');
  });

  it('floors small N (1..K_ANON_MIN-1) to "forming" — never the raw count', () => {
    for (let n = 1; n < K_ANON_MIN; n += 1) {
      const bucket = bucketForCount(n);
      expect(bucket).toBe('forming');
      // Must be the enum string, never the underlying number.
      expect(typeof bucket).toBe('string');
      expect(bucket).not.toBe(n);
    }
  });

  it('maps the "few" band [K_ANON_MIN .. FEW_MAX] to "few"', () => {
    expect(bucketForCount(K_ANON_MIN)).toBe('few'); // lower edge
    expect(bucketForCount(12)).toBe('few');
    expect(bucketForCount(FEW_MAX)).toBe('few'); // upper edge
  });

  it('maps counts above FEW_MAX to "growing"', () => {
    expect(bucketForCount(FEW_MAX + 1)).toBe('growing');
    expect(bucketForCount(50)).toBe('growing');
    expect(bucketForCount(500)).toBe('growing');
  });

  it('never returns a raw number — only the bucket enum, for any input', () => {
    const inputs = [-5, -1, 0, 1, 3, 4, 5, 9, 20, 21, 100, 9999];
    for (const n of inputs) {
      const bucket = bucketForCount(n);
      expect(typeof bucket).toBe('string');
      expect(VALID_BUCKETS).toContain(bucket);
      expect(bucket).not.toBe(String(n));
    }
  });

  it('treats negative / non-finite / garbage input as "none" (fail closed)', () => {
    expect(bucketForCount(-1)).toBe('none');
    expect(bucketForCount(-100)).toBe('none');
    expect(bucketForCount(NaN)).toBe('none');
    expect(bucketForCount(Infinity)).toBe('none');
    expect(bucketForCount(null)).toBe('none');
    expect(bucketForCount(undefined)).toBe('none');
    expect(bucketForCount('not-a-number')).toBe('none');
  });

  it('floors fractional counts before bucketing', () => {
    expect(bucketForCount(4.9)).toBe('forming'); // floors to 4
    expect(bucketForCount(5.9)).toBe('few');      // floors to 5
    expect(bucketForCount('7')).toBe('few');       // numeric string
  });

  it('exposes a frozen, ordered bucket enum', () => {
    expect(DENSITY_BUCKET).toEqual({
      NONE: 'none', FORMING: 'forming', FEW: 'few', GROWING: 'growing',
    });
    expect(Object.isFrozen(DENSITY_BUCKET)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// getDensityBucket — reads NeighborhoodPreview, returns the bucket ONLY
// ─────────────────────────────────────────────────────────────────────────
describe('densityReader.getDensityBucket', () => {
  it('floors a small seeded count to "forming" and never leaks the raw count', async () => {
    seedTable('NeighborhoodPreview', [
      { geohash: 'c20fbf', verified_users_count: 2, last_milestone_notified: 0 },
    ]);

    const result = await getDensityBucket('c20fbf');

    expect(result).toEqual({ geohash: 'c20fbf', bucket: 'forming' });
    // No raw-count fields surface through the helper.
    expect(result).not.toHaveProperty('verified_users_count');
    expect(result).not.toHaveProperty('count');
    expect(Object.values(result)).not.toContain(2);
  });

  it('returns "none" for an empty (0-count) cell', async () => {
    seedTable('NeighborhoodPreview', [
      { geohash: 'c20fbf', verified_users_count: 0, last_milestone_notified: 0 },
    ]);
    const result = await getDensityBucket('c20fbf');
    expect(result.bucket).toBe('none');
  });

  it('returns "few" / "growing" for larger cells', async () => {
    seedTable('NeighborhoodPreview', [
      { geohash: 'few000', verified_users_count: 12 },
      { geohash: 'grw000', verified_users_count: 60 },
    ]);
    expect((await getDensityBucket('few000')).bucket).toBe('few');
    expect((await getDensityBucket('grw000')).bucket).toBe('growing');
  });

  it('fails closed to "none" for an unknown geohash', async () => {
    seedTable('NeighborhoodPreview', []);
    const result = await getDensityBucket('nowhere');
    expect(result).toEqual({ geohash: 'nowhere', bucket: 'none' });
  });

  it('fails closed to "none" for missing/invalid geohash input', async () => {
    expect((await getDensityBucket('')).bucket).toBe('none');
    expect((await getDensityBucket(null)).bucket).toBe('none');
    expect((await getDensityBucket(undefined)).bucket).toBe('none');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// relativeToPeers — peer-relative comparison (pure)
// ─────────────────────────────────────────────────────────────────────────
describe('billBenchmarkReader.relativeToPeers', () => {
  it('reports "above" with a signed percent when the resident pays more', () => {
    expect(relativeToPeers(14200, 12500)).toEqual({ delta_pct: 14, relation: 'above' });
  });

  it('reports "below" when the resident pays less', () => {
    expect(relativeToPeers(10000, 12500)).toEqual({ delta_pct: -20, relation: 'below' });
  });

  it('reports "typical" inside the ±5% dead-band', () => {
    expect(relativeToPeers(12500, 12500)).toEqual({ delta_pct: 0, relation: 'typical' });
    expect(relativeToPeers(12800, 12500).relation).toBe('typical'); // +2%
  });

  it('returns null for missing / non-positive inputs', () => {
    expect(relativeToPeers(null, 12500)).toBeNull();
    expect(relativeToPeers(12500, 0)).toBeNull();
    expect(relativeToPeers(0, 12500)).toBeNull();
    expect(relativeToPeers(NaN, 12500)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// getBillBenchmark — reads BillBenchmark, gated by the household display floor
// ─────────────────────────────────────────────────────────────────────────
describe('billBenchmarkReader.getBillBenchmark', () => {
  it('returns the most recent displayable month with a peer comparison', async () => {
    seedTable('BillBenchmark', [
      { geohash: 'c20fbf', bill_type: 'electric', month: 3, year: 2026, avg_amount_cents: 12500, median_amount_cents: 12000, household_count: 18 },
      { geohash: 'c20fbf', bill_type: 'electric', month: 1, year: 2026, avg_amount_cents: 13000, median_amount_cents: 12800, household_count: 22 },
    ]);

    const result = await getBillBenchmark('c20fbf', 'electric', { userAmountCents: 14200 });

    expect(result.status).toBe('ok');
    expect(result.period).toEqual({ month: 3, year: 2026 }); // most recent
    expect(result.avg_amount_cents).toBe(12500);
    expect(result.median_amount_cents).toBe(12000);
    expect(result.household_count).toBe(18);
    expect(result.comparison).toEqual({ delta_pct: 14, relation: 'above' });
  });

  it('omits the comparison when no resident amount is provided', async () => {
    seedTable('BillBenchmark', [
      { geohash: 'c20fbf', bill_type: 'electric', month: 3, year: 2026, avg_amount_cents: 12500, median_amount_cents: 12000, household_count: 18 },
    ]);
    const result = await getBillBenchmark('c20fbf', 'electric');
    expect(result.status).toBe('ok');
    expect(result.comparison).toBeNull();
  });

  it('returns insufficient_data (no amounts) below the display floor', async () => {
    seedTable('BillBenchmark', [
      { geohash: 'c20fbf', bill_type: 'electric', month: 3, year: 2026, avg_amount_cents: 12500, median_amount_cents: 12000, household_count: 6 },
    ]);

    const result = await getBillBenchmark('c20fbf', 'electric', { userAmountCents: 14200 });

    expect(result.status).toBe('insufficient_data');
    expect(result.needed).toBe(BENCHMARK_DISPLAY_MIN - 6); // 4 more households
    expect(result).not.toHaveProperty('avg_amount_cents');
    expect(result).not.toHaveProperty('comparison');
  });

  it('returns unavailable when there is no row for the geohash+type', async () => {
    seedTable('BillBenchmark', []);
    const result = await getBillBenchmark('c20fbf', 'electric');
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable for missing geohash or bill type', async () => {
    expect((await getBillBenchmark('', 'electric')).status).toBe('unavailable');
    expect((await getBillBenchmark('c20fbf', '')).status).toBe('unavailable');
  });
});

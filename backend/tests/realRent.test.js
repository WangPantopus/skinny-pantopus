// ============================================================
// TEST: Real Rent Benchmark (Wave 3) — the Block Founders unlock
//
// The invariants here are all about the k-anonymity floor, because a
// rent benchmark is a financial disclosure about identifiable
// households:
//   * below K=10 reports NOTHING is returned but progress — no
//     amounts, no quartiles, not even a sample size;
//   * the bedroom scope degrades explicitly (exact size → all sizes →
//     suppressed) and always says which, so a studio is never priced
//     against a four-bedroom without saying so;
//   * only a VERIFIED occupant may contribute (the whole product
//     claim is that the reporters live there);
//   * the aggregate never leaks a per-home figure, and a viewer's own
//     standing is a band position, never a rank among neighbors.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const realRentService = require('../services/realRentService');
const { computeBlockRent, K_MIN } = realRentService;
const realRentRoutes = require('../routes/realRent');

const USER = 'rent-user-1';
const OTHER = 'rent-user-2';
const HOME_ID = 'home-rent-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', realRentRoutes);
  return app;
}

const HOME_ROW = {
  id: HOME_ID,
  owner_id: USER,
  address: '1421 SE Oak St, Portland, OR 97214',
  city: 'Portland',
  state: 'OR',
  bedrooms: 2,
  map_center_lat: 45.51,
  map_center_lng: -122.65,
};

function seedVerifiedResident({ verificationStatus = 'verified' } = {}) {
  seedTable('Home', [HOME_ROW]);
  seedTable('HomeOccupancy', [
    {
      id: 'occ-1',
      home_id: HOME_ID,
      user_id: USER,
      is_active: true,
      role: 'owner',
      role_base: 'owner',
      verification_status: verificationStatus,
    },
  ]);
}

/** n reports at one bedroom count, $1,000 apart in cents. */
function reports(n, bedrooms, baseDollars = 2000) {
  return Array.from({ length: n }, (_, i) => ({
    monthly_rent_cents: (baseDollars + i * 50) * 100,
    bedrooms,
  }));
}

beforeEach(() => resetTables());

// ── The floor (pure) ─────────────────────────────────────────

describe('computeBlockRent — the k-anonymity floor', () => {
  test('below the floor returns progress ONLY — no amounts, no sample size', () => {
    const out = computeBlockRent(reports(K_MIN - 1, 2), 2);
    expect(out.suppressed).toBe(true);
    expect(out.reports).toBe(K_MIN - 1);
    expect(out.needed).toBe(K_MIN);
    // The whole point: nothing about money escapes below the floor.
    expect(out.rent_median).toBeUndefined();
    expect(out.rent_p25).toBeUndefined();
    expect(out.rent_p75).toBeUndefined();
    expect(out.sample_size).toBeUndefined();
  });

  test('exactly the floor unlocks the band', () => {
    const out = computeBlockRent(reports(K_MIN, 2), 2);
    expect(out.suppressed).toBe(false);
    expect(out.sample_size).toBe(K_MIN);
    expect(out.scope).toBe('bedrooms');
    expect(out.bedrooms).toBe(2);
    expect(out.rent_p25).toBeLessThanOrEqual(out.rent_median);
    expect(out.rent_median).toBeLessThanOrEqual(out.rent_p75);
  });

  test('an empty block reports zero progress, never an error', () => {
    const out = computeBlockRent([], 2);
    expect(out.suppressed).toBe(true);
    expect(out.reports).toBe(0);
  });

  test('quartiles are dollars, not cents', () => {
    const out = computeBlockRent(reports(K_MIN, 2, 2000), 2);
    // Seeded $2,000–$2,450: a cents leak would read ~200000.
    expect(out.rent_median).toBeGreaterThan(1500);
    expect(out.rent_median).toBeLessThan(3000);
  });
});

describe('computeBlockRent — bedroom scope degrades explicitly', () => {
  test('same-size reports win when they clear the floor', () => {
    const rows = [...reports(K_MIN, 2, 2000), ...reports(K_MIN, 4, 5000)];
    const out = computeBlockRent(rows, 2);
    expect(out.scope).toBe('bedrooms');
    expect(out.bedrooms).toBe(2);
    expect(out.sample_size).toBe(K_MIN);
    // The 4-bedroom rents must not drag the 2-bedroom median up.
    expect(out.rent_median).toBeLessThan(3000);
  });

  test('falls back to all sizes — and SAYS so — when the exact size is thin', () => {
    const rows = [...reports(3, 2, 2000), ...reports(K_MIN, 4, 5000)];
    const out = computeBlockRent(rows, 2);
    expect(out.suppressed).toBe(false);
    expect(out.scope).toBe('all_sizes');
    // Scope 'all_sizes' must NOT claim a bedroom count.
    expect(out.bedrooms).toBeNull();
    expect(out.sample_size).toBe(3 + K_MIN);
  });

  test('a thin block stays suppressed even pooled across sizes', () => {
    const rows = [...reports(3, 2), ...reports(4, 4)];
    const out = computeBlockRent(rows, 2);
    expect(out.suppressed).toBe(true);
    expect(out.reports).toBe(7);
  });

  test('a viewer with unknown bedrooms pools all sizes rather than failing', () => {
    const out = computeBlockRent(reports(K_MIN, 3), null);
    expect(out.suppressed).toBe(false);
    expect(out.scope).toBe('all_sizes');
  });

  test('junk rows are dropped, not counted toward the floor', () => {
    const rows = [
      ...reports(K_MIN - 1, 2),
      { monthly_rent_cents: null, bedrooms: 2 },
      { monthly_rent_cents: 0, bedrooms: 2 },
      { monthly_rent_cents: 'abc', bedrooms: 2 },
    ];
    const out = computeBlockRent(rows, 2);
    expect(out.suppressed).toBe(true);
    expect(out.reports).toBe(K_MIN - 1);
  });
});

// ── The contribution gate ────────────────────────────────────

describe('contributing a rent', () => {
  test('an unverified occupant cannot contribute (T4 gate)', async () => {
    seedVerifiedResident({ verificationStatus: 'pending' });
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/rent-report`)
      .set('x-test-user-id', USER)
      .send({ monthly_rent: 2400 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
    expect(getTable('HomeRentReport')).toHaveLength(0);
  });

  test('a verified resident contributes, and the row carries the cell', async () => {
    seedVerifiedResident();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/rent-report`)
      .set('x-test-user-id', USER)
      .send({ monthly_rent: 2400 });
    expect(res.status).toBe(200);
    expect(res.body.report.monthly_rent).toBe(2400);

    const row = getTable('HomeRentReport')[0];
    // Cents in the column, dollars on the wire.
    expect(row.monthly_rent_cents).toBe(240000);
    // Denormalized at write time so the aggregate never joins Home.
    expect(row.geohash6).toBeTruthy();
    expect(row.bedrooms).toBe(2);
  });

  test('re-reporting updates in place — a household cannot stuff the sample', async () => {
    seedVerifiedResident();
    const app = buildApp();
    await request(app).put(`/api/homes/${HOME_ID}/rent-report`).set('x-test-user-id', USER).send({ monthly_rent: 2400 });
    await request(app).put(`/api/homes/${HOME_ID}/rent-report`).set('x-test-user-id', USER).send({ monthly_rent: 2550 });

    const rows = getTable('HomeRentReport');
    expect(rows).toHaveLength(1);
    expect(rows[0].monthly_rent_cents).toBe(255000);
  });

  test('implausible amounts are refused rather than skewing a ten-sample median', async () => {
    seedVerifiedResident();
    const app = buildApp();
    for (const amount of [0, -5, 12, 99999999]) {
      const res = await request(app)
        .put(`/api/homes/${HOME_ID}/rent-report`)
        .set('x-test-user-id', USER)
        .send({ monthly_rent: amount });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_AMOUNT');
    }
    expect(getTable('HomeRentReport')).toHaveLength(0);
  });

  test('the resident can withdraw their contribution', async () => {
    seedVerifiedResident();
    const app = buildApp();
    await request(app).put(`/api/homes/${HOME_ID}/rent-report`).set('x-test-user-id', USER).send({ monthly_rent: 2400 });
    const res = await request(app).delete(`/api/homes/${HOME_ID}/rent-report`).set('x-test-user-id', USER);
    expect(res.status).toBe(200);
    expect(getTable('HomeRentReport')).toHaveLength(0);
  });

  test('a non-occupant is refused outright', async () => {
    seedVerifiedResident();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/rent-report`)
      .set('x-test-user-id', OTHER)
      .send({ monthly_rent: 2400 });
    expect(res.status).toBe(403);
    expect(getTable('HomeRentReport')).toHaveLength(0);
  });
});

// ── The block read ───────────────────────────────────────────

describe('getBlockBenchmark', () => {
  const CELL_HOME = { ...HOME_ROW };
  // The real cell for the seeded coordinates — guessing a geohash here
  // would silently filter every seeded row out and read as "empty block".
  const CELL = realRentService.cellForHome(CELL_HOME);

  test('a thin block returns building progress and the viewer own rent, no amounts', async () => {
    seedTable('HomeRentReport', [
      { id: 'r1', home_id: HOME_ID, user_id: USER, geohash6: CELL, monthly_rent_cents: 240000, bedrooms: 2 },
    ]);
    const out = await realRentService.getBlockBenchmark({ home: CELL_HOME, userId: USER });
    expect(out.status).toBe('building');
    // The only report in the cell is the viewer's OWN, which is never in
    // the sample — progress counts other households, and their own rent
    // still comes back so the card can show it.
    expect(out.reports).toBe(0);
    expect(out.needed).toBe(K_MIN);
    expect(out.your_rent).toBe(2400);
    expect(out.rent_median).toBeUndefined();
  });

  test('a home with no coordinates yields null rather than a (0,0) cell read', async () => {
    const out = await realRentService.getBlockBenchmark({
      home: { ...CELL_HOME, map_center_lat: null, map_center_lng: null },
      userId: USER,
    });
    expect(out).toBeNull();
  });

  test('standing is a band position, never a rank among neighbors', async () => {
    // The mock ignores column filters, so every seeded row is the cell.
    const rows = reports(K_MIN, 2, 2000).map((r, i) => ({
      id: `r${i}`, home_id: `h${i}`, user_id: `u${i}`, geohash6: CELL, ...r,
    }));
    // The viewer's own report: far above the band.
    rows.push({ id: 'mine', home_id: HOME_ID, user_id: USER, geohash6: CELL, monthly_rent_cents: 900000, bedrooms: 2 });
    seedTable('HomeRentReport', rows);

    const out = await realRentService.getBlockBenchmark({ home: CELL_HOME, userId: USER });
    expect(out.status).toBe('ready');
    expect(out.standing).toBe('above_band');
    expect(out.your_rent).toBe(9000);
    // No per-home figures and no neighbor headcount ever escape.
    expect(JSON.stringify(out)).not.toContain('user_id');
    expect(out.neighbors_below).toBeUndefined();
  });
});

// ── Audit fixes: the floor counts HOMES, and no raw rent is published ──

describe('the floor counts households, not rows', () => {
  // HomeRentReport is unique per (home_id, user_id), so a household with
  // two verified occupants files two rows. Counting rows would let five
  // households satisfy a floor the product states as "10 verified homes",
  // and would double-weight that household in the median.
  function pair(homeId, cents, bedrooms = 2) {
    return [
      { home_id: homeId, user_id: `${homeId}-a`, monthly_rent_cents: cents, bedrooms, updated_at: '2026-08-01T00:00:00.000Z' },
      { home_id: homeId, user_id: `${homeId}-b`, monthly_rent_cents: cents, bedrooms, updated_at: '2026-08-02T00:00:00.000Z' },
    ];
  }

  test('five households filing ten rows do NOT clear the ten-home floor', () => {
    const rows = [].concat(...[1, 2, 3, 4, 5].map((i) => pair(`h${i}`, 200000 + i * 10000)));
    expect(rows).toHaveLength(10);
    const out = computeBlockRent(rows, 2);
    expect(out.suppressed).toBe(true);
    expect(out.reports).toBe(5); // homes, not rows
  });

  test('a household is counted once and weighted once', () => {
    // Nine single-occupant homes plus one two-occupant home = 10 homes.
    const singles = Array.from({ length: 9 }, (_, i) => ({
      home_id: `s${i}`, user_id: `s${i}-a`, monthly_rent_cents: 200000, bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z',
    }));
    const out = computeBlockRent([...singles, ...pair('dbl', 900000)], 2);
    expect(out.suppressed).toBe(false);
    expect(out.sample_size).toBe(10);
    // The double-occupant home contributes ONE $9,000 row, not two, so
    // it cannot drag the median off the nine $2,000 homes.
    expect(out.rent_median).toBe(2000);
  });

  test('the most recent report wins within a household', () => {
    const rows = [
      { home_id: 'h1', user_id: 'a', monthly_rent_cents: 100000, bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z' },
      { home_id: 'h1', user_id: 'b', monthly_rent_cents: 300000, bedrooms: 2, updated_at: '2026-08-09T00:00:00.000Z' },
    ];
    const out = computeBlockRent(rows, 2);
    expect(out.reports).toBe(1);
  });
});

describe('published figures are never a single household\'s exact rent', () => {
  test('quartiles are binned, not raw reported values', () => {
    // Ten distinct, deliberately un-round rents.
    const rows = [1237, 1462, 1688, 1913, 2044, 2166, 2311, 2489, 2637, 2988].map((d, i) => ({
      home_id: `h${i}`, user_id: `u${i}`, monthly_rent_cents: d * 100, bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z',
    }));
    const out = computeBlockRent(rows, 2);
    const raw = new Set([1237, 1462, 1688, 1913, 2044, 2166, 2311, 2489, 2637, 2988]);
    for (const published of [out.rent_p25, out.rent_median, out.rent_p75]) {
      // Nearest-rank quantiles return an array ELEMENT, so unbinned
      // output would BE three neighbours' exact monthly rents.
      expect(raw.has(published)).toBe(false);
      expect(published % 25).toBe(0);
    }
  });
});

describe('an unknown bedroom count is unknown, never a studio', () => {
  test('a home with no bedrooms on file files a null bedroom count', () => {
    // Number(null) is 0 — finite — so coercing first silently files
    // every null-bedroom home as a STUDIO, skewing that cohort and
    // pricing the resident against studios.
    expect(realRentService.normalizeBedrooms(undefined, { bedrooms: null })).toBeNull();
    expect(realRentService.normalizeBedrooms(undefined, {})).toBeNull();
    expect(realRentService.normalizeBedrooms(null, { bedrooms: '' })).toBeNull();
    // A real studio is still a studio.
    expect(realRentService.normalizeBedrooms(undefined, { bedrooms: 0 })).toBe(0);
  });

  test('a null-bedroom row is excluded from every same-size bucket', () => {
    const sized = Array.from({ length: 10 }, (_, i) => ({
      home_id: `h${i}`, user_id: `u${i}`, monthly_rent_cents: 200000, bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z',
    }));
    const unknown = { home_id: 'hx', user_id: 'ux', monthly_rent_cents: 999900, bedrooms: null, updated_at: '2026-08-01T00:00:00.000Z' };
    const out = computeBlockRent([...sized, unknown], 2);
    expect(out.scope).toBe('bedrooms');
    expect(out.sample_size).toBe(10); // the unknown row is not a 2-bedroom
  });

  test('the HOME record is authoritative, so a caller cannot pick their cohort', () => {
    // A freely-declared bedroom count would let a verified occupant join
    // any cohort in their cell — including one sitting at 9 reports that
    // the floor is deliberately suppressing, which their own row then
    // lifts over the line.
    expect(realRentService.normalizeBedrooms(4, { bedrooms: 2 })).toBe(2);
    // Only a home with nothing on file falls back to the caller.
    expect(realRentService.normalizeBedrooms(4, { bedrooms: null })).toBe(4);
  });
});

describe('the amount round-trips exactly', () => {
  test('reading a report and saving it back does not change it', async () => {
    seedVerifiedResident();
    const app = buildApp();
    const first = await request(app)
      .put(`/api/homes/${HOME_ID}/rent-report`)
      .set('x-test-user-id', USER)
      .send({ monthly_rent: 2400.5 });
    const stored = first.body.report.monthly_rent;

    // The edit form is seeded from the READ value; pressing Save with it
    // unchanged must be a no-op, not a silent rewrite.
    const second = await request(app)
      .put(`/api/homes/${HOME_ID}/rent-report`)
      .set('x-test-user-id', USER)
      .send({ monthly_rent: stored });
    expect(second.body.report.monthly_rent).toBe(stored);
  });
});

// ── Red-team regression: self-exclusion ──────────────────────
// A red team defeated the earlier controls by exploiting the fact that
// the viewer's own row was in the sample: they could sweep their own
// value to read neighbours' figures out of the moving statistics, and
// lift a deliberately-suppressed 9-household cohort over the floor with
// nothing but their own contribution. The row is now excluded outright.
describe('the viewer cannot influence the band they read', () => {
  function neighbours(n, cents = 200000) {
    return Array.from({ length: n }, (_, i) => ({
      home_id: `n${i}`, user_id: `u${i}`, monthly_rent_cents: cents + i * 1000,
      bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z',
    }));
  }
  const mine = (cents) => ({
    home_id: 'MINE', user_id: 'me', monthly_rent_cents: cents,
    bedrooms: 2, updated_at: '2026-08-09T00:00:00.000Z',
  });

  test('a suppressed 9-household cohort cannot be lifted by contributing', () => {
    const nine = neighbours(9);
    expect(computeBlockRent(nine, 2, 'MINE').suppressed).toBe(true);
    // Adding my own row must NOT open the band.
    const withMine = computeBlockRent([...nine, mine(300000)], 2, 'MINE');
    expect(withMine.suppressed).toBe(true);
    expect(withMine.reports).toBe(9);
  });

  test('sweeping my own value cannot move a single published figure', () => {
    const ten = neighbours(10);
    const at = (cents) => computeBlockRent([...ten, mine(cents)], 2, 'MINE');
    const low = at(5000);
    const high = at(5000000);
    expect(low.rent_p25).toBe(high.rent_p25);
    expect(low.rent_median).toBe(high.rent_median);
    expect(low.rent_p75).toBe(high.rent_p75);
    expect(low.sample_size).toBe(high.sample_size);
  });

  test('no published figure is any single household rent', () => {
    // Ten deliberately distinct, un-round rents.
    const rows = [1237, 1462, 1688, 1913, 2044, 2166, 2311, 2489, 2637, 2988].map((d, i) => ({
      home_id: `n${i}`, user_id: `u${i}`, monthly_rent_cents: d * 100,
      bedrooms: 2, updated_at: '2026-08-01T00:00:00.000Z',
    }));
    const out = computeBlockRent(rows, 2, 'MINE');
    const raw = new Set([1237, 1462, 1688, 1913, 2044, 2166, 2311, 2489, 2637, 2988]);
    for (const published of [out.rent_p25, out.rent_median, out.rent_p75]) {
      expect(raw.has(published)).toBe(false);
    }
  });
});

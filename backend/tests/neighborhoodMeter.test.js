/**
 * Tests for GET /api/neighborhood/meter — the density-gated door's meter.
 *
 * Asserts the wedge Phase-1 contract:
 *   • no primary home (or a home without coordinates) → state 'no_place';
 *   • below the k-anon floor the exact count is WITHHELD (verified_count
 *     null, state 'forming') — the first few residents of a cell are never
 *     countable;
 *   • from K_ANON_MIN up to the threshold → 'growing' with the real count;
 *   • at/above the threshold → 'unlocked';
 *   • NEIGHBORHOOD_UNLOCK_THRESHOLD env override is respected.
 *
 * supabaseAdmin + verifyToken are the project's standard mocks; the meter
 * reads the same NeighborhoodPreview substrate as the T0 preview.
 */

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const { encodeGeohash6 } = require('../utils/geohash');
const { K_ANON_MIN, FEW_MAX } = require('../services/place/densityReader');

const neighborhoodRouter = require('../routes/neighborhood');

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const HOME_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const CAMAS = { lat: 45.5871, lng: -122.4034 };
const CAMAS_GEOHASH = encodeGeohash6(CAMAS.lat, CAMAS.lng);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/neighborhood', neighborhoodRouter);
  return app;
}

function seedHome({ withCoords = true } = {}) {
  seedTable('Home', [
    {
      id: HOME_ID,
      city: 'Camas',
      state: 'WA',
      map_center_lat: withCoords ? CAMAS.lat : null,
      map_center_lng: withCoords ? CAMAS.lng : null,
    },
  ]);
  seedTable('HomeOccupancy', [
    { home_id: HOME_ID, user_id: USER_ID, is_active: true, created_at: '2026-01-01T00:00:00Z' },
  ]);
}

function seedPreview(count) {
  seedTable('NeighborhoodPreview', [{ geohash: CAMAS_GEOHASH, verified_users_count: count }]);
}

describe('GET /api/neighborhood/meter', () => {
  beforeEach(() => {
    resetTables();
    delete process.env.NEIGHBORHOOD_UNLOCK_THRESHOLD;
  });

  it("returns 'no_place' when the user has no home", async () => {
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: 'no_place',
      verified_count: null,
      unlocked: false,
      area: null,
    });
    expect(res.body.threshold).toBe(FEW_MAX);
  });

  it("returns 'no_place' when the home has no coordinates", async () => {
    seedHome({ withCoords: false });
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('no_place');
  });

  it('withholds the count below the k-anon floor', async () => {
    seedHome();
    seedPreview(K_ANON_MIN - 1);
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('forming');
    expect(res.body.verified_count).toBeNull();
    expect(res.body.unlocked).toBe(false);
    expect(res.body.k_anon_min).toBe(K_ANON_MIN);
    expect(res.body.area).toEqual({ city: 'Camas', state: 'WA' });
  });

  it("treats a missing NeighborhoodPreview cell as zero ('forming')", async () => {
    seedHome();
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('forming');
    expect(res.body.verified_count).toBeNull();
  });

  it("shows the real count between the floor and the threshold ('growing')", async () => {
    seedHome();
    seedPreview(12);
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: 'growing',
      verified_count: 12,
      unlocked: false,
      threshold: FEW_MAX,
    });
  });

  it('unlocks at the threshold', async () => {
    seedHome();
    seedPreview(FEW_MAX);
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'unlocked', verified_count: FEW_MAX, unlocked: true });
  });

  it('respects the NEIGHBORHOOD_UNLOCK_THRESHOLD override', async () => {
    process.env.NEIGHBORHOOD_UNLOCK_THRESHOLD = '10';
    seedHome();
    seedPreview(10);
    const res = await request(makeApp()).get('/api/neighborhood/meter');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'unlocked', threshold: 10, unlocked: true });
  });
});

// ── The window: density by block cell ────────────────────────
describe('GET /api/neighborhood/cells', () => {
  const { decodeGeohashBbox } = require('../utils/geohash');
  const { gridAround } = require('../routes/neighborhood');

  beforeEach(() => resetTables());

  it('returns the 5×5 grid around the place with a bucket per cell — never a count, never a point', async () => {
    seedHome();
    const grid = gridAround(CAMAS.lat, CAMAS.lng);
    const neighbor = grid.hashes.find((h) => h !== grid.home);
    seedTable('NeighborhoodPreview', [
      { geohash: CAMAS_GEOHASH, verified_users_count: 30 },
      { geohash: neighbor, verified_users_count: 12 },
    ]);
    const res = await request(makeApp()).get('/api/neighborhood/cells').set('x-test-user-id', USER_ID);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ready');
    expect(res.body.home_cell).toBe(CAMAS_GEOHASH);
    expect(res.body.cells).toHaveLength(25);
    const byHash = Object.fromEntries(res.body.cells.map((c) => [c.geohash, c]));
    expect(byHash[CAMAS_GEOHASH]).toMatchObject({ bucket: 'growing', is_home: true });
    expect(byHash[neighbor]).toMatchObject({ bucket: 'few', is_home: false });
    expect(res.body.cells.filter((c) => c.bucket === 'none')).toHaveLength(23);
    // Cell geometry is the geohash box, and the centre is the CELL's centre.
    const b = decodeGeohashBbox(CAMAS_GEOHASH);
    expect(byHash[CAMAS_GEOHASH].bounds).toEqual([[b.minLat, b.minLng], [b.maxLat, b.maxLng]]);
    expect(res.body.center).toEqual({ lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/verified_users_count|"count"|45\.5871|122\.4034/);
    expect(res.body.buckets).toMatchObject({ forming: `Forming (under ${K_ANON_MIN})`, growing: `Growing (${FEW_MAX + 1}+)` });
  });

  it('a cell below the k-anon floor reads forming, not its count', async () => {
    seedHome();
    seedPreview(K_ANON_MIN - 1);
    const res = await request(makeApp()).get('/api/neighborhood/cells').set('x-test-user-id', USER_ID);
    expect(res.body.cells.find((c) => c.is_home).bucket).toBe('forming');
  });

  it('is no_place without a placed home', async () => {
    seedHome({ withCoords: false });
    const res = await request(makeApp()).get('/api/neighborhood/cells').set('x-test-user-id', USER_ID);
    expect(res.body).toMatchObject({ state: 'no_place', cells: [], home_cell: null, center: null });
  });
});


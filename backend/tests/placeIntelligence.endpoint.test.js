// ============================================================
// TEST: Place dashboard contract — GET /api/homes/:id/intelligence
// (W0.2). Integration-shaped: hits the real route + service +
// serializer over the in-memory supabaseAdmin mock; the external
// provider services are mocked so each section's status is
// deterministic and no network is touched.
// ============================================================

jest.mock('../services/context/providerOrchestrator', () => ({
  getHubToday: jest.fn(),
  composeDailyBriefing: jest.fn(),
}));
jest.mock('../services/ai/neighborhoodProfileService', () => ({
  getProfile: jest.fn(),
}));
jest.mock('../services/ai/propertyIntelligenceService', () => ({
  getProfile: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const { encodeGeohash } = require('../utils/geohash');

const providerOrchestrator = require('../services/context/providerOrchestrator');
const neighborhoodProfileService = require('../services/ai/neighborhoodProfileService');
const propertyIntelligenceService = require('../services/ai/propertyIntelligenceService');
const placeIntelligenceRoutes = require('../routes/placeIntelligence');

const USER = 'place-user-1';
const OTHER = 'place-user-2';
const HOME_ID = 'home-place-1';
const LAT = 45.51;
const LNG = -122.65;
const GEOHASH = encodeGeohash(LAT, LNG, 6);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', placeIntelligenceRoutes);
  return app;
}

function seedHome(extra = {}) {
  seedTable('Home', [{
    id: HOME_ID,
    owner_id: USER, // legacy owner ⇒ checkHomePermission grants access
    address: '1421 SE Oak St',
    address2: null,
    city: 'Portland',
    state: 'OR',
    zipcode: '97214',
    map_center_lat: LAT,
    map_center_lng: LNG,
    year_built: 1979,
    sq_ft: 1840,
    bedrooms: 3,
    bathrooms: 2,
    lot_sq_ft: 5200,
    home_type: 'single_family',
    ...extra,
  }]);
}

function defaultHubToday() {
  return {
    fetched_at: '2026-06-07T09:12:00.000Z',
    weather: {
      current_temp_f: 62,
      condition_code: 'clear',
      condition_label: 'Clear',
      high_f: 68,
      low_f: 49,
      precipitation_next_6h: false,
      precipitation_start_at: null,
    },
    aqi: { index: 38, category: 'Good', is_noteworthy: false },
    alerts: [],
  };
}

function defaultNeighborhoodProfile() {
  return {
    profile: {
      tract_id: '41051001800',
      flood_zone: 'X',
      flood_zone_description: 'Zone X — minimal flood risk',
      median_year_built: 1985,
      median_home_value: 498000,
      cached_at: '2026-06-01T00:00:00.000Z',
    },
    source: 'live',
  };
}

// Flatten the grouped response into an id → envelope map.
function sectionsById(body) {
  const map = {};
  for (const group of body.groups) {
    for (const section of group.sections) map[section.id] = section;
  }
  return map;
}

// This is an integration-shaped suite: each test exercises the full route +
// service + serializer over the in-memory mocks. Even with every external
// provider mocked, composing all sections runs ~2–5s per test, which sits
// right at Jest's 5s default and flakes on slower CI runners. Give the suite
// generous headroom — this only raises the failure threshold (it can't make a
// passing test fail or change any behavior).
jest.setTimeout(30000);

describe('GET /api/homes/:id/intelligence', () => {
  let app;
  const savedAttomKey = process.env.ATTOM_API_KEY;

  beforeEach(() => {
    resetTables();
    delete process.env.ATTOM_API_KEY; // default: no ATTOM
    providerOrchestrator.getHubToday.mockResolvedValue(defaultHubToday());
    neighborhoodProfileService.getProfile.mockResolvedValue(defaultNeighborhoodProfile());
    propertyIntelligenceService.getProfile.mockReset();
    app = buildApp();
  });

  afterAll(() => {
    if (savedAttomKey === undefined) delete process.env.ATTOM_API_KEY;
    else process.env.ATTOM_API_KEY = savedAttomKey;
  });

  test('composes the grouped contract with per-section status', async () => {
    seedHome();
    seedTable('NeighborhoodPreview', [{ geohash: GEOHASH, verified_users_count: 12 }]);
    seedTable('BillBenchmark', [
      { geohash: GEOHASH, bill_type: 'electric', avg_amount_cents: 16500, household_count: 14 },
      { geohash: GEOHASH, bill_type: 'electric', avg_amount_cents: 21000, household_count: 14 },
    ]);

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('T3');
    expect(res.body.region_supported).toBe(true);
    expect(typeof res.body.generated_at).toBe('string');
    expect(res.body.place.label).toBe('1421 SE Oak St, Portland');

    const s = sectionsById(res.body);

    // Today — composed from getHubToday.
    expect(s.weather.status).toBe('ready');
    expect(s.weather.data.current_temp_f).toBe(62);
    expect(s.air_quality.status).toBe('ready');
    expect(s.air_quality.data.category).toBe('good');
    // Empty alerts list is still "ready" → renders "No active alerts".
    expect(s.alerts.status).toBe('ready');
    expect(s.alerts.data.active).toEqual([]);

    // Risk & Census — composed from neighborhoodProfileService.
    expect(s.flood.status).toBe('ready');
    expect(s.flood.data.zone).toBe('X');
    expect(s.flood.data.risk_level).toBe('minimal');
    expect(s.census_context.status).toBe('ready');
    expect(s.census_context.data.median_year_built).toBe(1985);

    // Density — bucket only (k-anon: never a count).
    expect(s.block_density.status).toBe('ready');
    expect(s.block_density.data.bucket).toBe('few');
    expect(s.block_density.data).not.toHaveProperty('count');
    expect(s.block_density.data).not.toHaveProperty('verified_users_count');

    // Money Signals — composed from the BillBenchmark table.
    expect(s.bill_benchmark.status).toBe('ready');
    expect(s.bill_benchmark.data.band_low).toBe(165);
    expect(s.bill_benchmark.data.band_high).toBe(210);

    // Not-yet-wired launch sections degrade independently to unavailable:
    // incentives is license-gated (DSIRE), and civic_election is key-gated
    // (GOOGLE_CIVIC_API_KEY is unset in tests).
    expect(s.incentives.status).toBe('unavailable');
    expect(s.civic_election.status).toBe('unavailable');

    // Phase-2/3 sections are wired: whatever the mocked providers yield,
    // each is present with a valid envelope status and can never sink
    // the response (section-level degradation).
    for (const id of ['lead_radon', 'sunrise_sunset', 'rent_band', 'drinking_water', 'environmental_hazards', 'civic_districts', 'seismic', 'wildfire']) {
      expect(s[id]).toBeDefined();
      expect(['ready', 'partial', 'stale', 'unavailable', 'error']).toContain(s[id].status);
    }
  });

  test('bill benchmark compares the resident amount in the right unit (cents → $)', async () => {
    seedHome();
    seedTable('BillBenchmark', [
      { geohash: GEOHASH, bill_type: 'electric', avg_amount_cents: 16500, household_count: 14 },
      { geohash: GEOHASH, bill_type: 'electric', avg_amount_cents: 21000, household_count: 14 },
    ]);
    // HomeBill.amount is in cents → $142/mo average.
    seedTable('HomeBill', [
      { id: 'b1', home_id: HOME_ID, bill_type: 'electric', amount: 14200 },
      { id: 'b2', home_id: HOME_ID, bill_type: 'electric', amount: 14200 },
    ]);

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    const s = sectionsById(res.body);
    // band 165–210 (mid 187.5); your $142 ⇒ ~24% below, not ~7500% above.
    expect(s.bill_benchmark.data.your_amount).toBe(142);
    expect(s.bill_benchmark.data.comparison).toBe('lower');
    expect(s.bill_benchmark.data.comparison_pct).toBe(-24);
  });

  test("a missing ATTOM key yields Your Home = 'unavailable' (not a 500)", async () => {
    seedHome();
    // ATTOM_API_KEY is deleted in beforeEach.

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    const s = sectionsById(res.body);
    expect(s.your_home.band).toBe('B');
    expect(s.your_home.status).toBe('unavailable');
    expect(s.your_home.data).toBeNull();
    // We must NOT have called the ATTOM-backed service without a key.
    expect(propertyIntelligenceService.getProfile).not.toHaveBeenCalled();
  });

  test('with an ATTOM key, Your Home composes exact property facts', async () => {
    process.env.ATTOM_API_KEY = 'test-attom-key';
    seedHome();
    propertyIntelligenceService.getProfile.mockResolvedValue({
      profile: {
        year_built: 1979,
        sqft: 1840,
        bedrooms: 3,
        bathrooms: 2,
        lot_sqft: 5200,
        property_type: 'single_family',
        estimated_value: 612000,
        value_range_low: 590000,
        value_range_high: 640000,
        cached_at: '2026-05-01T00:00:00.000Z',
      },
      source: 'attom',
    });

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    const s = sectionsById(res.body);
    expect(s.your_home.status).toBe('ready');
    expect(s.your_home.data.estimated_value).toBe(612000);
    expect(s.your_home.data.year_built).toBe(1979);
    expect(propertyIntelligenceService.getProfile).toHaveBeenCalledWith(HOME_ID);
  });

  test('a single failing source degrades only its section (no 500)', async () => {
    seedHome();
    providerOrchestrator.getHubToday.mockRejectedValue(new Error('NOAA down'));

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    const s = sectionsById(res.body);
    // Today degraded...
    expect(s.weather.status).toBe('unavailable');
    expect(s.air_quality.status).toBe('unavailable');
    // ...but other sources still composed.
    expect(s.flood.status).toBe('ready');
  });

  test('verified occupancy lifts the viewer to T4', async () => {
    seedHome({ owner_id: 'someone-else' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: HOME_ID,
      user_id: USER,
      is_active: true,
      start_at: null,
      end_at: null,
      verification_status: 'verified',
      role_base: 'member',
    }]);

    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('T4');
  });

  test('denies a viewer with no access', async () => {
    seedHome();
    const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', OTHER);
    expect(res.status).toBe(403);
  });
});

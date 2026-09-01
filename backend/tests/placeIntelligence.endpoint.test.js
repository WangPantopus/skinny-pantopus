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

// The `detail: true` shape — what the providers actually cache and what
// getHubToday now passes through instead of dropping at the block step.
function detailedHubToday() {
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
      feels_like_f: 59,
      humidity_pct: 71,
      uv_index: 4,
      dew_point_f: null,
      wind_mph: 6,
      hourly: [
        { datetime_utc: '2026-06-07T10:00:00.000Z', temp_f: 63, condition_code: 'mostly_clear', precip_chance_pct: 5 },
        { datetime_utc: '2026-06-07T11:00:00.000Z', temp_f: 65, condition_code: 'rain', precip_chance_pct: 70 },
        // Dropped: no usable temperature.
        { datetime_utc: '2026-06-07T12:00:00.000Z', temp_f: null, condition_code: 'rain', precip_chance_pct: 80 },
      ],
      daily: [
        { date: '2026-06-07', high_f: 68, low_f: 49, condition_code: 'clear', precip_chance_pct: 10 },
        { date: '2026-06-08', high_f: 71, low_f: 52, condition_code: 'partly', precip_chance_pct: 20 },
        // Dropped: the contract types both bounds as non-null numbers.
        { date: '2026-06-09', high_f: 74, low_f: null, condition_code: 'clear', precip_chance_pct: 0 },
      ],
    },
    aqi: { index: 38, category: 'Good', is_noteworthy: false, dominant_pollutant: 'PM2.5' },
    alerts: [{
      id: 'NWS-1',
      severity: 'severe',
      title: 'Wind Advisory',
      starts_at: '2026-06-07T14:00:00.000Z',
      ends_at: '2026-06-08T02:00:00.000Z',
      headline: 'Wind Advisory issued June 7 at 7:00AM PDT until June 7 at 7:00PM PDT',
      description: 'Southwest winds 20 to 30 mph with gusts up to 45 mph expected.',
      instruction: 'Secure loose outdoor objects and use extra care when driving.',
    }],
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

  // ── Regression: the Today section used to hardcode `hourly: []`,
  // `daily: []`, `feels_like_f: null` and `dominant_pollutant: null`, and
  // set both the alert headline and description to the alert title —
  // discarding data the providers had already fetched and cached. These
  // assertions fail against that behavior.
  describe('Today section carries the full already-fetched payload', () => {
    beforeEach(() => {
      providerOrchestrator.getHubToday.mockResolvedValue(detailedHubToday());
      seedHome();
    });

    test('fetches the provider payload exactly ONCE per request', async () => {
      // composeToday and composeHeatCold both need it, and both used to call
      // getHubToday themselves. The 2-minute memo does not absorb that: the
      // cache entry is written only after the pipeline completes and the
      // composers run concurrently, so every request made two full provider
      // round-trips.
      await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);
      expect(providerOrchestrator.getHubToday).toHaveBeenCalledTimes(1);
    });

    test('does not fetch the provider payload when no section needs it', async () => {
      await request(app)
        .get(`/api/homes/${HOME_ID}/intelligence?sections=flood`)
        .set('x-test-user-id', USER);
      expect(providerOrchestrator.getHubToday).not.toHaveBeenCalled();
    });

    test('requests the detail payload anchored to the REQUESTED home', async () => {
      await request(app).get(`/api/homes/${HOME_ID}/intelligence?sections=weather`).set('x-test-user-id', USER);
      // atLocation is the fix for the wrong-city bug: the hub payload used
      // to resolve from the viewer's location (custom pin / primary home),
      // which put one city's freeze guidance on another city's dashboard.
      expect(providerOrchestrator.getHubToday).toHaveBeenCalledWith(USER, expect.objectContaining({
        detail: true,
        atLocation: expect.objectContaining({ latitude: 45.51, longitude: -122.65, homeId: HOME_ID }),
      }));
    });

    test('weather carries feels-like plus the hourly and daily forecasts', async () => {
      const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);
      const w = sectionsById(res.body).weather;

      expect(w.status).toBe('ready');
      expect(w.data.feels_like_f).toBe(59);

      // Rows without a usable temperature are dropped, not rendered as gaps.
      expect(w.data.hourly).toEqual([
        { time: '2026-06-07T10:00:00.000Z', temp_f: 63, condition_code: 'partly_cloudy', precip_chance: 5 },
        { time: '2026-06-07T11:00:00.000Z', temp_f: 65, condition_code: 'rain', precip_chance: 70 },
      ]);

      // A day missing either bound is dropped — the contract types both as numbers.
      expect(w.data.daily).toEqual([
        { date: '2026-06-07', condition_code: 'clear', high_f: 68, low_f: 49, precip_chance: 10 },
        { date: '2026-06-08', condition_code: 'partly_cloudy', high_f: 71, low_f: 52, precip_chance: 20 },
      ]);
    });

    test('air quality names the dominant pollutant as a machine token', async () => {
      const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);
      expect(sectionsById(res.body).air_quality.data.dominant_pollutant).toBe('pm25');
    });

    test('alerts carry the real headline and the description plus instruction', async () => {
      const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);
      const alert = sectionsById(res.body).alerts.data.active[0];

      expect(alert.event).toBe('Wind Advisory');
      expect(alert.severity).toBe('warning');
      expect(alert.headline).toBe('Wind Advisory issued June 7 at 7:00AM PDT until June 7 at 7:00PM PDT');
      expect(alert.headline).not.toBe(alert.event);
      expect(alert.description).toContain('gusts up to 45 mph');
      // The protective-action instruction is the actionable half — kept.
      expect(alert.description).toContain('Secure loose outdoor objects');
    });

    test('degrades to empty arrays when the provider returns no forecast', async () => {
      providerOrchestrator.getHubToday.mockResolvedValue(defaultHubToday());
      const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);
      const w = sectionsById(res.body).weather;

      expect(w.status).toBe('ready');
      expect(w.data.hourly).toEqual([]);
      expect(w.data.daily).toEqual([]);
      expect(w.data.feels_like_f).toBeNull();
      expect(sectionsById(res.body).air_quality.data.dominant_pollutant).toBeNull();
    });
  });

  // Regression: the dashboard used to floor density with its own inline copy
  // of the k-anon logic (k=10) while the audited helper (k=5) had no callers
  // at all. Two implementations of one privacy primitive is itself a leak —
  // the same cell reporting different buckets on two surfaces narrows the
  // count by comparison. These pin the single reconciled floor.
  describe('block density uses one k-anon floor', () => {
    const { K_ANON_MIN, FEW_MAX } = require('../services/place/densityReader');

    async function bucketFor(count) {
      seedHome();
      seedTable('NeighborhoodPreview', [{ geohash: GEOHASH, verified_users_count: count }]);
      const res = await request(app)
        .get(`/api/homes/${HOME_ID}/intelligence?sections=block_density`)
        .set('x-test-user-id', USER);
      return sectionsById(res.body).block_density.data.bucket;
    }

    test('floors everything below the k-anon minimum to "forming"', async () => {
      expect(await bucketFor(1)).toBe('forming');
      expect(await bucketFor(K_ANON_MIN - 1)).toBe('forming');
    });

    test('opens the "few" band exactly at the floor', async () => {
      expect(await bucketFor(K_ANON_MIN)).toBe('few');
      expect(await bucketFor(FEW_MAX)).toBe('few');
    });

    test('reads as "growing" above the band', async () => {
      expect(await bucketFor(FEW_MAX + 1)).toBe('growing');
    });

    test('never returns the raw count', async () => {
      seedHome();
      seedTable('NeighborhoodPreview', [{ geohash: GEOHASH, verified_users_count: 17 }]);
      const res = await request(app)
        .get(`/api/homes/${HOME_ID}/intelligence?sections=block_density`)
        .set('x-test-user-id', USER);
      const data = sectionsById(res.body).block_density.data;
      expect(Object.keys(data).sort()).toEqual(['bucket', 'label']);
      expect(JSON.stringify(data)).not.toContain('17');
    });
  });

  // Regression: bill_type was hardcoded to 'electric' on BOTH the benchmark
  // read and the own-amount read, while the refresh job has always grouped
  // by type — so gas/water/internet benchmarks were computed and ignored.
  describe('bill benchmark picks a bill it can actually compare', () => {
    function seedBenchmarks(rows) {
      seedTable('BillBenchmark', rows.map((r) => ({ geohash: GEOHASH, ...r })));
    }

    async function benchmark() {
      const res = await request(app)
        .get(`/api/homes/${HOME_ID}/intelligence?sections=bill_benchmark`)
        .set('x-test-user-id', USER);
      return sectionsById(res.body).bill_benchmark;
    }

    beforeEach(() => seedHome());

    test('surfaces a non-electric benchmark that used to be ignored', async () => {
      seedBenchmarks([
        { bill_type: 'internet', avg_amount_cents: 7000, household_count: 14 },
        { bill_type: 'internet', avg_amount_cents: 9000, household_count: 14 },
      ]);

      const s = await benchmark();
      expect(s.status).toBe('ready');
      expect(s.data.utility).toBe('internet');
      expect(s.data.summary).toContain('internet');
    });

    test('prefers the type the resident can be compared on', async () => {
      // Electric has the bigger cohort, but the resident only logs internet —
      // and a comparison is the whole point of the section.
      seedBenchmarks([
        { bill_type: 'electric', avg_amount_cents: 16000, household_count: 40 },
        { bill_type: 'electric', avg_amount_cents: 20000, household_count: 40 },
        { bill_type: 'internet', avg_amount_cents: 7000, household_count: 12 },
        { bill_type: 'internet', avg_amount_cents: 9000, household_count: 12 },
      ]);
      seedTable('HomeBill', [{ home_id: HOME_ID, bill_type: 'internet', amount: 6000 }]);

      const s = await benchmark();
      expect(s.data.utility).toBe('internet');
      expect(s.data.your_amount).toBe(60);
      expect(s.data.comparison).toBe('lower');
      expect(s.data.summary).toContain('internet');
    });

    test('falls back to the largest cohort when nothing is comparable', async () => {
      seedBenchmarks([
        { bill_type: 'water', avg_amount_cents: 4000, household_count: 11 },
        { bill_type: 'electric', avg_amount_cents: 16000, household_count: 40 },
      ]);

      expect((await benchmark()).data.utility).toBe('electric');
    });

    test('never benchmarks rent or mortgage', async () => {
      // Wildly home-specific: comparing them tells the resident nothing, and
      // rent already has its own section from HUD Fair Market Rents.
      seedBenchmarks([
        { bill_type: 'rent', avg_amount_cents: 210000, household_count: 30 },
        { bill_type: 'mortgage', avg_amount_cents: 320000, household_count: 30 },
      ]);
      seedTable('HomeBill', [{ home_id: HOME_ID, bill_type: 'rent', amount: 200000 }]);

      expect((await benchmark()).status).toBe('unavailable');
    });

    test('still honours the k-anon cohort floor', async () => {
      seedBenchmarks([{ bill_type: 'gas', avg_amount_cents: 5000, household_count: 4 }]);
      expect((await benchmark()).status).toBe('unavailable');
    });
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

  // real_rent is the FIRST section to use Band D (the proven-resident
  // tier). The band machinery existed but had never carried a section,
  // so these pin that the gate actually bites — a claimed-but-unverified
  // owner must not see what the block pays, and must not be able to
  // infer the block's progress either.
  describe('real_rent — the first Band D section', () => {
    test('a claimed-but-unverified owner gets a locked envelope with no data', async () => {
      seedHome();
      const res = await request(app).get(`/api/homes/${HOME_ID}/intelligence`).set('x-test-user-id', USER);

      expect(res.body.tier).toBe('T3');
      const realRent = sectionsById(res.body).real_rent;
      expect(realRent).toBeDefined();
      expect(realRent.access).toBe('locked');
      expect(realRent.data).toBeNull();
      // Not even the block's progress leaks below the tier.
      expect(JSON.stringify(realRent)).not.toContain('reports');
      expect(realRent.unavailable_reason).toMatch(/verify your address/i);
    });

    test('a verified resident gets the section, in its honest building state', async () => {
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

      expect(res.body.tier).toBe('T4');
      const realRent = sectionsById(res.body).real_rent;
      expect(realRent.access).toBe('available');
      // An empty block is 'building' with progress — never an error and
      // never an empty state.
      expect(realRent.status).toBe('partial');
      expect(realRent.data.state).toBe('building');
      expect(realRent.data.reports).toBe(0);
      expect(realRent.data.needed).toBe(10);
      expect(realRent.data.summary).toMatch(/first/i);
      // Below the floor NOTHING about money is present.
      expect(realRent.data.rent_median).toBeNull();
      expect(realRent.data.rent_p25).toBeNull();
      expect(realRent.data.sample_size).toBeNull();
    });
  });
});

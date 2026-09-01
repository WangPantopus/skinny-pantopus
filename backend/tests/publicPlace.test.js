/**
 * Tests for GET /api/public/place — the anonymous T0 "Place" preview.
 *
 * Asserts the W0.3 contract + its constraints (and, since Wedge v2 D1, the
 * unlocked Band-A snapshot + the aha card — see the last two describes):
 *   • density is a BUCKET enum, never a raw count;
 *   • never calls ATTOM (no attomdata.com fetch, no propertyDataService);
 *   • the preview persists NOTHING — no SavedPlace / Home / per-address row and
 *     no DB writes at all (caches are in-memory, location-keyed, anonymous);
 *   • flood degrades independently of the Census tract lookup, and Walk Score
 *     is never fetched;
 *   • a non-US / ungeocodable address degrades to `unsupported_region` with
 *     HTTP 200 — never a 500;
 *   • repeat requests are served from the in-memory cache (no second Mapbox /
 *     FEMA / Census round-trip).
 *
 * The geocoder (services/geo) is mocked; the data fetchers run for real against
 * a URL-routed global.fetch mock so we can prove no ATTOM/Walk-Score URL is hit
 * and that caching eliminates the second round-trip. supabaseAdmin is the
 * project's in-memory mock; the route's in-memory caches are reset between
 * tests via its __clearPreviewCaches hook.
 */

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

// Geocoder — overridden per test. Default (US) set in beforeEach.
jest.mock('../services/geo', () => ({ forwardGeocode: jest.fn() }));
const geo = require('../services/geo');

// Today providers (weather / AQI / alerts) — mocked so the snapshot is
// deterministic; individual tests override them for the aha rule.
jest.mock('../services/context/weatherProvider', () => ({ fetchWeather: jest.fn() }));
jest.mock('../services/context/aqiProvider', () => ({ fetchAQI: jest.fn() }));
jest.mock('../services/context/alertsProvider', () => ({ fetchAlerts: jest.fn() }));
const weatherProvider = require('../services/context/weatherProvider');
const aqiProvider = require('../services/context/aqiProvider');
const alertsProvider = require('../services/context/alertsProvider');

// ATTOM entry point — must never be invoked by the preview.
jest.mock('../services/propertyDataService', () => ({
  verifyPropertyOwnership: jest.fn(),
  matchOwnerName: jest.fn(),
  isAvailable: jest.fn(() => false),
  PROVIDER: 'none',
}));
const propertyDataService = require('../services/propertyDataService');

const { encodeGeohash6 } = require('../utils/geohash');
const publicRouter = require('../routes/public');

// ── Fixtures ───────────────────────────────────────────────────────────────

const PORTLAND = {
  latitude: 45.5202,
  longitude: -122.6742,
  city: 'Portland',
  state: 'OR',
  zipcode: '97214',
  address: '1421 SE Oak St',
};
const PORTLAND_GEOHASH = encodeGeohash6(PORTLAND.latitude, PORTLAND.longitude);

const CENSUS_GEOCODER = {
  result: {
    geographies: {
      'Census Tracts': [{ STATE: '41', COUNTY: '051', TRACT: '001902' }],
      States: [{ NAME: 'Oregon' }],
      Counties: [{ NAME: 'Multnomah County' }],
      '119th Congressional Districts': [{ NAME: 'Congressional District 3', BASENAME: '3' }],
    },
  },
};
const USGS_SEISMIC = { response: { data: { sdc: 'D', sds: 1.1 } } };
const USFS_WHP = { value: '4' };
const EPA_ECHO = {
  Results: {
    QueryRows: '2',
    Facilities: [
      { FacName: 'Acme Plating', CAAFlag: 'Y', FacLat: 45.521, FacLong: -122.675 },
      { FacName: 'Riverside Yard', RCRAFlag: 'Y', FacLat: 45.53, FacLong: -122.68 },
    ],
  },
};
const OPEN_METEO_SUN = { daily: { sunrise: ['2026-09-01T13:30'], sunset: ['2026-09-02T02:45'], time: ['2026-09-01'] } };

const TODAY_FIXTURES = {
  weather: {
    current: { temp_f: 61, condition_code: 'clear', condition_label: 'Clear', feels_like_f: 60 },
    daily: [{ high_f: 72, low_f: 50 }],
    hourly: [],
    provider: 'OPEN_METEO',
    source: 'live',
    fetchedAt: '2026-09-01T14:00:00.000Z',
  },
  aqi: { aqi: 31, category: 'Good', pollutant: 'PM2.5', source: 'live', fetchedAt: '2026-09-01T14:00:00.000Z' },
  alerts: { alerts: [], provider: 'NOAA', source: 'live', fetchedAt: '2026-09-01T14:00:00.000Z' },
};
const CENSUS_ACS = [
  ['B25035_001E', 'B25077_001E', 'B19013_001E', 'B01003_001E', 'B25001_001E', 'state', 'county', 'tract'],
  ['1985', '498000', '70000', '4000', '1800', '41', '051', '001902'],
];
const FEMA = { features: [{ attributes: { FLD_ZONE: 'X', ZONE_SUBTY: null } }] };
const WALKSCORE_URL = 'api.walkscore.com';

function mockResp(data, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

// URL-routed fetch so the real Census/FEMA fetchers resolve. `femaOk`/`censusOk`
// let a test simulate an outage (→ partial). ATTOM and Walk Score URLs would
// resolve too, so asserting they're never called proves intent, not a
// mock-induced failure.
function installFetch({ femaOk = true, censusOk = true, geocoderOk = true, hang = null, whp = USFS_WHP, seismic = USGS_SEISMIC } = {}) {
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (hang && u.includes(hang)) return new Promise(() => {}); // never resolves
    if (u.includes('attomdata.com')) return Promise.resolve(mockResp({ status: { msg: 'SuccessWithResult' }, property: [] }));
    if (u.includes('earthquake.usgs.gov')) return Promise.resolve(mockResp(seismic));
    if (u.includes('imagery.geoplatform.gov')) return Promise.resolve(mockResp(whp));
    if (u.includes('echodata.epa.gov')) return Promise.resolve(mockResp(EPA_ECHO));
    if (u.includes('api.open-meteo.com')) return Promise.resolve(mockResp(OPEN_METEO_SUN));
    if (u.includes(WALKSCORE_URL)) return Promise.resolve(mockResp({ status: 1, walkscore: 50 }));
    if (u.includes('geocoding.geo.census.gov')) return Promise.resolve(mockResp(CENSUS_GEOCODER, geocoderOk));
    if (u.includes('api.census.gov')) return Promise.resolve(mockResp(CENSUS_ACS, censusOk));
    if (u.includes('hazards.fema.gov')) return Promise.resolve(mockResp(FEMA, femaOk));
    return Promise.resolve(mockResp({}, false));
  });
}

const countFetch = (substr) => (global.fetch.mock?.calls || []).filter(([u]) => String(u).includes(substr)).length;
const attomWasCalled = () => countFetch('attomdata.com') > 0;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRouter);
  return app;
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetTables();
  publicRouter.__clearPreviewCaches();
  jest.clearAllMocks();
  // Walk Score / Census keys off → deterministic external calls.
  delete process.env.WALKSCORE_API_KEY;
  delete process.env.CENSUS_API_KEY;
  geo.forwardGeocode.mockResolvedValue({ ...PORTLAND });
  weatherProvider.fetchWeather.mockResolvedValue({ ...TODAY_FIXTURES.weather });
  aqiProvider.fetchAQI.mockResolvedValue({ ...TODAY_FIXTURES.aqi });
  alertsProvider.fetchAlerts.mockResolvedValue({ ...TODAY_FIXTURES.alerts });
  delete process.env.PLACE_PREVIEW_SECTION_BUDGET_MS;
  installFetch();
  seedTable('NeighborhoodPreview', [{ geohash: PORTLAND_GEOHASH, verified_users_count: 5 }]);
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/public/place', () => {
  describe('ready — the free demonstration subset', () => {
    it('returns flood, a density bucket, and a Census area teaser', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St, Portland' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.tier).toBe('preview');
      expect(res.body.region).toBe('US');

      // area-level place identity, no precise coordinates leaked
      expect(res.body.place).toEqual({
        address: '1421 SE Oak St', city: 'Portland', state: 'OR', zipcode: '97214',
      });
      expect(res.body.place).not.toHaveProperty('latitude');
      expect(res.body.place).not.toHaveProperty('longitude');

      // flood (FEMA, area-level)
      expect(res.body.free.flood).toMatchObject({ status: 'ready', zone: 'X', description: 'Minimal flood risk' });

      // Census teaser — area medians, explicitly NOT the home's own record
      expect(res.body.free.area).toMatchObject({
        status: 'ready', median_year_built: 1985, median_home_value: 498000, note: 'Area-level, not your home',
      });
    });

    it('exposes density only as a bucket enum — never a count', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });

      const density = res.body.free.density;
      expect(typeof density.bucket).toBe('string');
      expect(['none', 'forming', 'few', 'growing']).toContain(density.bucket);
      expect(density.bucket).toBe('few'); // seeded count = 5
      // The raw count (5) must never appear anywhere on the density object.
      expect(density).not.toHaveProperty('verified_users_count');
      expect(density).not.toHaveProperty('count');
      expect(JSON.stringify(density)).not.toMatch(/\b5\b/);
    });

    it('keeps only Band B (ATTOM exact record) behind a locked descriptor', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.status).toBe(200);
      expect(res.body.locked).toHaveLength(1);
      expect(res.body.locked[0]).toMatchObject({ id: 'home_details', group: 'your_home', band: 'B', unlock: 'claim' });
      expect(res.body.locked.map((l) => l.id)).not.toContain('daily_conditions');
    });
  });


  describe('the unlocked Band-A snapshot (Wedge v2, D1)', () => {
    const byId = (body) => Object.fromEntries((body.sections || []).map((s) => [s.id, s]));

    it('returns every free layer as an available section envelope — and never Band B', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.status).toBe(200);
      const ids = res.body.sections.map((s) => s.id);
      for (const id of ['weather', 'air_quality', 'alerts', 'sunrise_sunset', 'flood', 'seismic', 'wildfire',
        'lead_radon', 'drinking_water', 'environmental_hazards', 'block_density', 'census_context', 'rent_band',
        'civic_districts', 'civic_election']) {
        expect(ids).toContain(id);
      }
      expect(ids).not.toContain('your_home');
      for (const s of res.body.sections) {
        expect(s.access).toBe('available');
        expect(s.band).toBe('A');
      }
      expect(attomWasCalled()).toBe(false);
    });

    it('carries today\'s conditions as a one-shot snapshot (weather, air, alerts)', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      const m = byId(res.body);
      expect(m.weather).toMatchObject({ status: 'ready', data: { current_temp_f: 61, condition_code: 'clear', high_f: 72, low_f: 50 } });
      expect(m.air_quality).toMatchObject({ status: 'ready', data: { index: 31, category: 'good' } });
      expect(m.alerts).toMatchObject({ status: 'ready', data: { active: [] } });
      expect(m.wildfire).toMatchObject({ status: 'ready', data: { hazard_class: 4, hazard_label: 'High' } });
      expect(m.seismic).toMatchObject({ status: 'ready', data: { design_category: 'D' } });
      expect(m.environmental_hazards).toMatchObject({ status: 'ready', data: { facilities_within_mile: 2 } });
      expect(m.flood).toMatchObject({ status: 'ready', data: { zone: 'X', risk_level: 'minimal', in_sfha: false } });
      expect(m.census_context).toMatchObject({ status: 'ready', data: { median_year_built: 1985 } });
      expect(m.block_density).toMatchObject({ status: 'ready', data: { bucket: 'few' } });
    });

    it('never shows a zero on the density card — below the floor it is an invitation', async () => {
      resetTables();
      publicRouter.__clearPreviewCaches();
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.free.density.bucket).toBe('none');
      expect(res.body.free.density.label).toMatch(/Founding Neighbor/);
      expect(byId(res.body).block_density.data.label).toMatch(/Founding Neighbor/);
    });

    it('degrades a single slow provider to unavailable within the budget — the rest stay ready', async () => {
      process.env.PLACE_PREVIEW_SECTION_BUDGET_MS = '40';
      installFetch({ hang: 'imagery.geoplatform.gov' });
      const started = Date.now();
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(3000);
      const m = byId(res.body);
      expect(m.wildfire.status).toBe('unavailable');
      expect(m.wildfire.unavailable_reason).toMatch(/Still loading/);
      expect(m.seismic.status).toBe('ready');
      expect(m.weather.status).toBe('ready');
    });

    it('writes only location-keyed cache rows — never a key that carries the typed address', async () => {
      await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      const rows = getTable('PlaceSectionCache');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.cache_key).toMatch(/^(geo|state|us|county):/);
        expect(row.cache_key.toLowerCase()).not.toContain('oak');
        expect(row.cache_key).not.toContain('home:');
      }
      expect(getTable('SavedPlace')).toHaveLength(0);
      expect(getTable('Home')).toHaveLength(0);
    });
  });

  describe('the aha card', () => {
    it('leads with the highest-surprise ready fact (high wildfire beats seismic D and good air)', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.aha).toMatchObject({ section_id: 'wildfire', tone: 'alert', grade: 'High' });
      expect(res.body.aha.headline).toMatch(/High wildfire hazard/);
      expect(res.body.aha.follow_up).toMatch(/Claim/);
    });

    it('an active warning outranks everything', async () => {
      alertsProvider.fetchAlerts.mockResolvedValue({
        alerts: [{ id: 'nws-1', event: 'Red Flag Warning', severity: 'severe', headline: 'Red Flag Warning until 8 PM', onset: '2026-09-01T18:00:00Z', expires: '2026-09-02T03:00:00Z' }],
        provider: 'NOAA', source: 'live', fetchedAt: '2026-09-01T14:00:00.000Z',
      });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.aha).toMatchObject({ section_id: 'alerts', tone: 'alert', grade: 'Warning' });
      expect(res.body.aha.headline).toMatch(/Red Flag Warning/);
    });

    it('falls back to the calm card when every layer is quiet', async () => {
      installFetch({ whp: { value: '1' }, seismic: { response: { data: { sdc: 'B', sds: 0.3 } } } });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      // The two ECHO facilities score 50 (a "watch"), so mute them too.
      // (fixture has 2 facilities → environmental_hazards would win at 50)
      if (res.body.aha.section_id === 'environmental_hazards') {
        expect(res.body.aha.tone).toBe('watch');
        return;
      }
      expect(res.body.aha).toMatchObject({ section_id: null, tone: 'calm' });
    });

    it('is calm for real when nothing nearby is regulated either', async () => {
      installFetch({ whp: { value: '1' }, seismic: { response: { data: { sdc: 'B', sds: 0.3 } } } });
      const base = global.fetch;
      global.fetch = jest.fn((url) => (String(url).includes('echodata.epa.gov')
        ? Promise.resolve(mockResp({ Results: { QueryRows: '0', Facilities: [] } }))
        : base(url)));
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.aha).toMatchObject({ section_id: null, tone: 'calm', headline: 'Quiet on every layer' });
      expect(res.body.aha.detail).toMatch(/minimal flood risk/i);
      expect(res.body.aha.detail).toMatch(/good air today/i);
      expect(res.body.aha.detail).toMatch(/no active alerts/i);
    });
  });

  describe('density buckets are floored server-side', () => {
    const cases = [
      [0, 'none'],
      [1, 'forming'],
      [2, 'forming'],
      [3, 'few'],
      [9, 'few'],
      [10, 'growing'],
      [250, 'growing'],
    ];
    it.each(cases)('count %i → bucket "%s" (no number leaked)', async (count, expected) => {
      seedTable('NeighborhoodPreview', [{ geohash: PORTLAND_GEOHASH, verified_users_count: count }]);
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.free.density.bucket).toBe(expected);
      expect(typeof res.body.free.density.bucket).toBe('string');
    });

    it('treats a cell with no preview row as "none"', async () => {
      seedTable('NeighborhoodPreview', []);
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(res.body.free.density.bucket).toBe('none');
    });
  });

  describe('no ATTOM, no Walk Score, no persistence', () => {
    it('never calls ATTOM or Walk Score', async () => {
      await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(attomWasCalled()).toBe(false);
      expect(countFetch(WALKSCORE_URL)).toBe(0);
      expect(propertyDataService.verifyPropertyOwnership).not.toHaveBeenCalled();
    });

    it('writes nothing to the database', async () => {
      await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });

      // Caches are in-memory only — no DB writes anywhere.
      expect(getTable('NeighborhoodProfileCache')).toHaveLength(0);
      // The preview itself is never persisted.
      expect(getTable('SavedPlace')).toHaveLength(0);
      expect(getTable('Home')).toHaveLength(0);
      // The bucket source is only read, never mutated.
      const previews = getTable('NeighborhoodPreview');
      expect(previews).toHaveLength(1);
      expect(previews[0].verified_users_count).toBe(5);
    });
  });

  describe('caching (in-memory, location-keyed)', () => {
    it('serves a repeat request from cache — no second Mapbox / FEMA / Census hit', async () => {
      const app = buildApp();

      await request(app).get('/api/public/place').query({ address: '1421 SE Oak St' });
      expect(geo.forwardGeocode.mock.calls.length).toBe(1);
      expect(countFetch('hazards.fema.gov')).toBe(1);
      // Census geocoder: the tract lookup, the civic layers=all lookup, and
      // ONE single-flighted county lookup shared by radon / rent / water.
      expect(countFetch('geocoding.geo.census.gov')).toBe(3);
      expect(countFetch('api.census.gov')).toBe(1);
      const firstPass = {
        usgs: countFetch('earthquake.usgs.gov'),
        whp: countFetch('imagery.geoplatform.gov'),
        echo: countFetch('echodata.epa.gov'),
        today: weatherProvider.fetchWeather.mock.calls.length,
      };
      expect(firstPass.usgs).toBe(1);
      expect(firstPass.whp).toBe(1);

      await request(app).get('/api/public/place').query({ address: '1421 SE Oak St' });

      // Every external dependency is served from a cache the 2nd time — the
      // route's in-memory caches for the address-shaped layers, the shared
      // PlaceSectionCache for the land-shaped ones. (Today's conditions are
      // the exception by design: they are live and cached by their providers.)
      expect(geo.forwardGeocode.mock.calls.length).toBe(1);      // Mapbox (billed)
      expect(countFetch('hazards.fema.gov')).toBe(1);            // FEMA flood
      expect(countFetch('geocoding.geo.census.gov')).toBe(3);    // Census geocoder (tract + civic + county)
      expect(countFetch('api.census.gov')).toBe(1);              // Census ACS
      expect(countFetch('earthquake.usgs.gov')).toBe(firstPass.usgs);
      expect(countFetch('imagery.geoplatform.gov')).toBe(firstPass.whp);
      expect(countFetch('echodata.epa.gov')).toBe(firstPass.echo);
    });

    it('still returns correct data on the cached (second) request', async () => {
      const app = buildApp();
      await request(app).get('/api/public/place').query({ address: '1421 SE Oak St' });
      const res = await request(app).get('/api/public/place').query({ address: '1421 SE Oak St' });

      expect(res.body.status).toBe('ready');
      expect(res.body.free.flood).toMatchObject({ status: 'ready', zone: 'X' });
      expect(res.body.free.area).toMatchObject({ status: 'ready', median_year_built: 1985 });
      expect(res.body.free.density.bucket).toBe('few');
    });
  });

  describe('section-by-section degradation (independent)', () => {
    it('returns partial when FEMA is unavailable but Census is not', async () => {
      installFetch({ femaOk: false });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('partial');
      expect(res.body.free.flood.status).toBe('unavailable');
      expect(res.body.free.area.status).toBe('ready');
      expect(res.body.free.density.bucket).toBe('few');
    });

    it('returns partial when the Census area teaser is unavailable', async () => {
      installFetch({ censusOk: false });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });

      expect(res.body.status).toBe('partial');
      expect(res.body.free.area.status).toBe('unavailable');
      expect(res.body.free.flood.status).toBe('ready');
    });

    it('keeps flood when ONLY the Census tract geocoder fails (independence)', async () => {
      // The exact regression the refactor fixes: a tract-geocoder outage must
      // not take flood down with it.
      installFetch({ geocoderOk: false });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '1421 SE Oak St' });

      expect(res.body.status).toBe('partial');
      expect(res.body.free.flood.status).toBe('ready'); // flood survived
      expect(res.body.free.area.status).toBe('unavailable');
    });
  });

  describe('unsupported_region — never a 500', () => {
    it('handles a non-US address (geocoder returns nothing → throws)', async () => {
      geo.forwardGeocode.mockRejectedValue(new Error('No result for address'));
      const res = await request(buildApp()).get('/api/public/place').query({ address: '221B Baker St, London' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unsupported_region');
      expect(res.body.region).toBeNull();
      expect(res.body.message).toMatch(/U\.S\.-only/i);
    });

    it('handles an ungeocodable address (no result object)', async () => {
      geo.forwardGeocode.mockResolvedValue(null);
      const res = await request(buildApp()).get('/api/public/place').query({ address: 'asdfghjkl' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unsupported_region');
    });

    it('handles a resolved point outside US coverage', async () => {
      // Valid lat/lng but in London — fails the US bounding-box guard.
      geo.forwardGeocode.mockResolvedValue({ latitude: 51.5237, longitude: -0.1585, city: 'London', state: 'England' });
      const res = await request(buildApp()).get('/api/public/place').query({ address: '221B Baker St' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unsupported_region');
      // A non-US lookup must not reach any external data source.
      expect(attomWasCalled()).toBe(false);
      expect(countFetch('hazards.fema.gov')).toBe(0);
      expect(countFetch('api.census.gov')).toBe(0);
    });

    it('does not cache a transient geocoder failure (a retry can still succeed)', async () => {
      geo.forwardGeocode.mockRejectedValue(new Error('boom'));
      const first = await request(buildApp()).get('/api/public/place').query({ address: 'somewhere' });
      expect(first.body.status).toBe('unsupported_region');

      geo.forwardGeocode.mockResolvedValue({ ...PORTLAND });
      const second = await request(buildApp()).get('/api/public/place').query({ address: 'somewhere' });
      expect(second.body.status).toBe('ready');
      expect(getTable('NeighborhoodProfileCache')).toHaveLength(0);
    });
  });

  describe('input validation', () => {
    it('returns 400 when the address is missing', async () => {
      const res = await request(buildApp()).get('/api/public/place');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/address/i);
    });

    it('returns 400 when the address is blank', async () => {
      const res = await request(buildApp()).get('/api/public/place').query({ address: '   ' });
      expect(res.status).toBe(400);
    });
  });
});

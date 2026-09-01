// ============================================================
// TEST: GeoProvider — MapboxProvider contract tests
//
// Verifies NormalizedSuggestion and NormalizedAddress shapes
// returned by the Mapbox provider. Mocks global fetch.
// ============================================================

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { geoCache } = require('../../utils/geoCache');

// ── Mapbox response fixtures ─────────────────────────────────

const MAPBOX_AUTOCOMPLETE_RESPONSE = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'address.12345',
      type: 'Feature',
      place_type: ['address'],
      address: '123',
      text: 'Main St',
      place_name: '123 Main St, Portland, Oregon 97201, United States',
      center: [-122.6784, 45.5152],
      context: [
        { id: 'postcode.1001', text: '97201' },
        { id: 'place.2001', text: 'Portland' },
        { id: 'region.3001', text: 'Oregon', short_code: 'us-or' },
        { id: 'country.4001', text: 'United States', short_code: 'us' },
      ],
      properties: { accuracy: 'rooftop' },
    },
    {
      id: 'place.67890',
      type: 'Feature',
      place_type: ['place'],
      text: 'Portland',
      place_name: 'Portland, Oregon, United States',
      center: [-122.6765, 45.5231],
      context: [
        { id: 'region.3001', text: 'Oregon', short_code: 'us-or' },
        { id: 'country.4001', text: 'United States', short_code: 'us' },
      ],
      properties: {},
    },
  ],
};

const MAPBOX_REVERSE_RESPONSE = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'address.99999',
      type: 'Feature',
      place_type: ['address'],
      address: '456',
      text: 'Oak Ave',
      place_name: '456 Oak Ave, Seattle, Washington 98101, United States',
      center: [-122.3321, 47.6062],
      context: [
        { id: 'postcode.5001', text: '98101' },
        { id: 'place.6001', text: 'Seattle' },
        { id: 'region.7001', text: 'Washington', short_code: 'us-wa' },
        { id: 'country.8001', text: 'United States', short_code: 'us' },
      ],
      properties: {},
    },
  ],
};

// ── Setup ────────────────────────────────────────────────────

let mapboxProvider;

beforeEach(() => {
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  geoCache.clear();
  jest.resetModules();

  global.fetch = jest.fn();
  mapboxProvider = require('../../services/geo/mapboxProvider');
});

afterEach(() => {
  delete process.env.MAPBOX_ACCESS_TOKEN;
  delete global.fetch;
});

// ── Helpers ──────────────────────────────────────────────────

function mockFetchOk(body) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(body || 'Error'),
  });
}

// ── NormalizedSuggestion shape validation ─────────────────────

function expectNormalizedSuggestion(s) {
  expect(s).toHaveProperty('suggestion_id');
  expect(s).toHaveProperty('primary_text');
  expect(s).toHaveProperty('secondary_text');
  expect(s).toHaveProperty('label');
  expect(s).toHaveProperty('center');
  expect(s).toHaveProperty('center.lat');
  expect(s).toHaveProperty('center.lng');
  expect(s).toHaveProperty('kind');
  expect(typeof s.suggestion_id).toBe('string');
  expect(typeof s.primary_text).toBe('string');
  expect(typeof s.secondary_text).toBe('string');
  expect(typeof s.label).toBe('string');
  expect(typeof s.center.lat).toBe('number');
  expect(typeof s.center.lng).toBe('number');
  expect(typeof s.kind).toBe('string');
}

function expectNormalizedAddress(n) {
  expect(n).toHaveProperty('address');
  expect(n).toHaveProperty('city');
  expect(n).toHaveProperty('state');
  expect(n).toHaveProperty('zipcode');
  expect(n).toHaveProperty('latitude');
  expect(n).toHaveProperty('longitude');
  expect(n).toHaveProperty('place_id');
  expect(n).toHaveProperty('verified', false);
  expect(n).toHaveProperty('source');
  expect(n).toHaveProperty('geocode_mode');
  expect(typeof n.address).toBe('string');
  expect(typeof n.city).toBe('string');
  expect(typeof n.state).toBe('string');
  expect(typeof n.zipcode).toBe('string');
  expect(['temporary', 'permanent']).toContain(n.geocode_mode);
}

// ── Tests ────────────────────────────────────────────────────

describe('MapboxProvider', () => {
  describe('autocomplete', () => {
    it('returns NormalizedSuggestion[] shape', async () => {
      mockFetchOk(MAPBOX_AUTOCOMPLETE_RESPONSE);

      const result = await mapboxProvider.autocomplete('123 Main St');

      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions).toHaveLength(2);

      for (const s of result.suggestions) {
        expectNormalizedSuggestion(s);
      }
    });

    it('maps Mapbox fields to normalized fields correctly', async () => {
      mockFetchOk(MAPBOX_AUTOCOMPLETE_RESPONSE);

      const { suggestions } = await mapboxProvider.autocomplete('123 Main');
      const first = suggestions[0];

      expect(first.suggestion_id).toMatch(/^address\.12345::[a-f0-9]{12}$/);
      expect(first.primary_text).toBe('123 Main St');
      expect(first.label).toBe('123 Main St, Portland, Oregon 97201, United States');
      expect(first.center.lat).toBeCloseTo(45.5152);
      expect(first.center.lng).toBeCloseTo(-122.6784);
      expect(first.kind).toBe('address');
      expect(first.secondary_text).toContain('Portland');
      expect(first.secondary_text).toContain('OR');
    });

    it('returns empty suggestions for empty Mapbox response', async () => {
      mockFetchOk({ features: [] });

      const result = await mapboxProvider.autocomplete('nonexistent');
      expect(result.suggestions).toEqual([]);
    });

    it('throws on Mapbox HTTP error', async () => {
      mockFetchError(502, 'Bad Gateway');

      await expect(mapboxProvider.autocomplete('test'))
        .rejects.toThrow('Mapbox autocomplete failed: 502');
    });

    it('throws when MAPBOX_ACCESS_TOKEN is missing', async () => {
      delete process.env.MAPBOX_ACCESS_TOKEN;
      jest.resetModules();
      const freshProvider = require('../../services/geo/mapboxProvider');

      await expect(freshProvider.autocomplete('test'))
        .rejects.toThrow('Missing env var: MAPBOX_ACCESS_TOKEN');
    });

    it('passes limit and country options to URL', async () => {
      mockFetchOk({ features: [] });

      await mapboxProvider.autocomplete('test', { limit: 3, country: 'ca' });

      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('limit=3');
      expect(url).toContain('country=ca');
    });
  });

  describe('resolve', () => {
    it('returns NormalizedAddress shape from cache (after autocomplete)', async () => {
      mockFetchOk(MAPBOX_AUTOCOMPLETE_RESPONSE);

      // Autocomplete pre-populates the resolve cache
      const { suggestions } = await mapboxProvider.autocomplete('123 Main St');

      // Resolve should return from cache — no additional fetch
      const normalized = await mapboxProvider.resolve(suggestions[0].suggestion_id);

      expectNormalizedAddress(normalized);
      // Only one fetch call (the autocomplete), no second call for resolve
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns correct address fields from cached resolve', async () => {
      mockFetchOk(MAPBOX_AUTOCOMPLETE_RESPONSE);
      const { suggestions } = await mapboxProvider.autocomplete('123 Main St');

      const n = await mapboxProvider.resolve(suggestions[0].suggestion_id);

      expect(n.address).toBe('123 Main St');
      expect(n.city).toBe('Portland');
      expect(n.state).toBe('OR');
      expect(n.zipcode).toBe('97201');
      expect(n.latitude).toBeCloseTo(45.5152);
      expect(n.longitude).toBeCloseTo(-122.6784);
      expect(n.place_id).toBe('address.12345');
      expect(n.source).toBe('mapbox_geocode');
    });

    it('falls back to Mapbox API on cache miss', async () => {
      mockFetchOk({
        features: [MAPBOX_AUTOCOMPLETE_RESPONSE.features[0]],
      });

      const normalized = await mapboxProvider.resolve('address.12345::stalehash');

      expectNormalizedAddress(normalized);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws when no result found on cache miss', async () => {
      mockFetchOk({ features: [] });

      await expect(mapboxProvider.resolve('nonexistent'))
        .rejects.toThrow('No result for suggestion_id');
    });
  });

  describe('reverseGeocode', () => {
    it('returns NormalizedAddress shape', async () => {
      mockFetchOk(MAPBOX_REVERSE_RESPONSE);

      const normalized = await mapboxProvider.reverseGeocode(47.6062, -122.3321);

      expectNormalizedAddress(normalized);
    });

    it('maps reverse geocode fields correctly', async () => {
      mockFetchOk(MAPBOX_REVERSE_RESPONSE);

      const n = await mapboxProvider.reverseGeocode(47.6062, -122.3321);

      expect(n.city).toBe('Seattle');
      expect(n.state).toBe('WA');
      expect(n.zipcode).toBe('98101');
      expect(n.source).toBe('mapbox_reverse');
    });

    it('throws when no address found', async () => {
      mockFetchOk({ features: [] });

      await expect(mapboxProvider.reverseGeocode(0, 0))
        .rejects.toThrow('No address found for that location');
    });

    it('throws on Mapbox HTTP error', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(mapboxProvider.reverseGeocode(47.6, -122.3))
        .rejects.toThrow('Mapbox reverse geocode failed: 500');
    });
  });

  describe('forwardGeocode', () => {
    it('returns NormalizedAddress with specified mode', async () => {
      mockFetchOk({
        features: [MAPBOX_AUTOCOMPLETE_RESPONSE.features[0]],
      });

      const n = await mapboxProvider.forwardGeocode('123 Main St Portland', { mode: 'permanent' });

      expectNormalizedAddress(n);
      expect(n.geocode_mode).toBe('permanent');
    });

    it('defaults to temporary mode', async () => {
      mockFetchOk({
        features: [MAPBOX_AUTOCOMPLETE_RESPONSE.features[0]],
      });

      const n = await mapboxProvider.forwardGeocode('123 Main St Portland');

      expect(n.geocode_mode).toBe('temporary');
    });

    it('throws when no result found', async () => {
      mockFetchOk({ features: [] });

      await expect(mapboxProvider.forwardGeocode('nonexistent'))
        .rejects.toThrow('No result for address');
    });
  });

  // ── Place-tag picker methods (nearbyPlaces / searchPlaces) ──

  const MAPBOX_POI_FEATURE = {
    id: 'poi.111',
    type: 'Feature',
    place_type: ['poi'],
    text: 'Blue Star Donuts',
    place_name: 'Blue Star Donuts, 1237 SW Washington St, Portland, Oregon 97205, United States',
    center: [-122.6841, 45.5219],
    properties: { category: 'donut shop, bakery', address: '1237 SW Washington St' },
    context: [
      { id: 'postcode.1001', text: '97205' },
      { id: 'place.2001', text: 'Portland' },
      { id: 'region.3001', text: 'Oregon', short_code: 'us-or' },
    ],
  };

  const MAPBOX_LOCALITY_FEATURE = {
    id: 'place.67890',
    type: 'Feature',
    place_type: ['place'],
    text: 'Portland',
    place_name: 'Portland, Oregon, United States',
    center: [-122.6765, 45.5231],
    properties: {},
    context: [
      { id: 'region.3001', text: 'Oregon', short_code: 'us-or' },
    ],
  };

  describe('nearbyPlaces', () => {
    it('returns NormalizedPlace POIs plus the locality from two typed reverse calls', async () => {
      mockFetchOk({ features: [MAPBOX_POI_FEATURE] });   // types=poi call
      mockFetchOk({ features: [MAPBOX_LOCALITY_FEATURE] }); // types=place call

      const result = await mapboxProvider.nearbyPlaces(45.52, -122.68);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      const poiUrl = global.fetch.mock.calls[0][0];
      const localityUrl = global.fetch.mock.calls[1][0];
      expect(poiUrl).toContain('/mapbox.places/-122.68,45.52.json');
      expect(poiUrl).toContain('types=poi');
      expect(poiUrl).toContain('limit=10');
      expect(localityUrl).toContain('types=place');
      expect(localityUrl).toContain('limit=1');

      expect(result.places).toHaveLength(1);
      const p = result.places[0];
      expect(p.place_id).toBe('poi.111');
      expect(p.name).toBe('Blue Star Donuts');
      expect(p.category).toBe('donut shop, bakery');
      expect(p.address).toBe('1237 SW Washington St');
      expect(p.full_address).toContain('Blue Star Donuts');
      expect(p.center).toEqual({ lat: 45.5219, lng: -122.6841 });
      expect(p.kind).toBe('poi');
      // Haversine from (45.52, -122.68) to the POI center is ~383m.
      expect(p.distance_m).toBeGreaterThan(350);
      expect(p.distance_m).toBeLessThan(420);
      expect(Number.isInteger(p.distance_m)).toBe(true);

      expect(result.locality).not.toBeNull();
      expect(result.locality.name).toBe('Portland');
      expect(result.locality.kind).toBe('place');
    });

    it('returns locality null when no place feature is found', async () => {
      mockFetchOk({ features: [] });
      mockFetchOk({ features: [] });

      const result = await mapboxProvider.nearbyPlaces(45.52, -122.68);

      expect(result.places).toEqual([]);
      expect(result.locality).toBeNull();
    });

    it('throws on Mapbox failure', async () => {
      mockFetchError(500, 'Internal Server Error');
      mockFetchOk({ features: [] });

      await expect(mapboxProvider.nearbyPlaces(45.52, -122.68))
        .rejects.toThrow('Mapbox nearby places failed: 500');
    });

    it('degrades to locality null when only the locality call fails', async () => {
      mockFetchOk({ features: [MAPBOX_POI_FEATURE] }); // types=poi ok
      mockFetchError(429, 'Rate limited');             // types=place fails

      const result = await mapboxProvider.nearbyPlaces(45.52, -122.68);

      expect(result.places).toHaveLength(1);
      expect(result.places[0].name).toBe('Blue Star Donuts');
      expect(result.locality).toBeNull();
    });

    it('filters out features without a usable center instead of defaulting to {0,0}', async () => {
      const centerless = { ...MAPBOX_POI_FEATURE, id: 'poi.222', center: undefined };
      mockFetchOk({ features: [centerless, MAPBOX_POI_FEATURE] });
      mockFetchOk({ features: [{ ...MAPBOX_LOCALITY_FEATURE, center: null }] });

      const result = await mapboxProvider.nearbyPlaces(45.52, -122.68);

      expect(result.places).toHaveLength(1);
      expect(result.places[0].place_id).toBe('poi.111');
      expect(result.locality).toBeNull();
    });
  });

  describe('searchPlaces', () => {
    it('searches poi,place,address with proximity when coords are given', async () => {
      mockFetchOk({ features: [MAPBOX_POI_FEATURE] });

      const result = await mapboxProvider.searchPlaces('blue star', { lat: 45.52, lng: -122.68 });

      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('/mapbox.places/blue%20star.json');
      expect(url).toContain('autocomplete=true');
      expect(url).toContain('limit=8');
      expect(url).toContain('country=us');
      expect(url).toContain('types=poi,place,address');
      expect(url).toContain('proximity=-122.68,45.52');

      expect(result.places).toHaveLength(1);
      expect(result.places[0].kind).toBe('poi');
      expect(typeof result.places[0].distance_m).toBe('number');
    });

    it('omits proximity and returns distance_m null without coords', async () => {
      mockFetchOk({ features: [MAPBOX_POI_FEATURE] });

      const result = await mapboxProvider.searchPlaces('blue star');

      const url = global.fetch.mock.calls[0][0];
      expect(url).not.toContain('proximity=');
      expect(result.places[0].distance_m).toBeNull();
    });

    it('throws on Mapbox failure', async () => {
      mockFetchError(429, 'Rate limited');

      await expect(mapboxProvider.searchPlaces('blue star'))
        .rejects.toThrow('Mapbox place search failed: 429');
    });

    it('joins the split house number into the name for address features', async () => {
      // Mapbox v5 splits "4014 Tacoma Court" into address='4014' +
      // text='Tacoma Court' — the row name must show the full line.
      mockFetchOk({
        features: [{
          id: 'address.777',
          type: 'Feature',
          place_type: ['address'],
          address: '4014',
          text: 'Tacoma Court',
          place_name: '4014 Tacoma Court, Tacoma, Washington 98402, United States',
          center: [-122.4443, 47.2529],
          properties: {},
          context: [
            { id: 'postcode.9001', text: '98402' },
            { id: 'place.9002', text: 'Tacoma' },
            { id: 'region.9003', text: 'Washington', short_code: 'us-wa' },
          ],
        }],
      });

      const result = await mapboxProvider.searchPlaces('4014 Tacoma Court');

      expect(result.places[0].name).toBe('4014 Tacoma Court');
      expect(result.places[0].kind).toBe('address');
    });
  });
});

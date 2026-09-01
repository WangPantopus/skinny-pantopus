// ============================================================
// TEST: Geo place-tag routes — contract tests for the
// Instagram-style place picker endpoints:
//   GET /geo/places/nearby   → { places, locality }
//   GET /geo/places/search   → { places }
//
// Verifies validation, response passthrough, cache behavior, and
// error handling. Uses the handler-extraction pattern with mock
// req/res (no express/supertest needed) — same as geoRoutes.test.js.
// ============================================================

// Mock express with a minimal Router implementation before anything loads
jest.mock('express', () => {
  const handlers = [];
  const router = function () {};
  router.stack = handlers;
  router.get = function (path, handler) {
    handlers.push({
      route: { path, methods: { get: true }, stack: [{ handle: handler }] },
    });
    return router;
  };
  router.post = function (path, handler) {
    handlers.push({
      route: { path, methods: { post: true }, stack: [{ handle: handler }] },
    });
    return router;
  };
  const express = () => {};
  express.Router = () => router;
  return express;
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the geo provider so route tests don't hit Mapbox
jest.mock('../../services/geo', () => ({
  autocomplete: jest.fn(),
  resolve: jest.fn(),
  reverseGeocode: jest.fn(),
  forwardGeocode: jest.fn(),
  nearbyPlaces: jest.fn(),
  searchPlaces: jest.fn(),
}));

const geoProvider = require('../../services/geo');
const { geoCache } = require('../../utils/geoCache');

// ── Import router (uses mocked express) ──────────────────────

const router = require('../../routes/geo');

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

const nearbyHandler = findHandler('GET', '/places/nearby');
const searchHandler = findHandler('GET', '/places/search');

// ── Mock req/res helpers ─────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

// ── Fixtures (NormalizedPlace wire shape) ────────────────────

const POI_PLACE = {
  place_id: 'poi.123',
  name: 'Blue Star Donuts',
  category: 'donut shop, bakery',
  address: '1237 SW Washington St',
  full_address: 'Blue Star Donuts, 1237 SW Washington St, Portland, Oregon 97205, United States',
  center: { lat: 45.5219, lng: -122.6841 },
  kind: 'poi',
  distance_m: 132,
};

const LOCALITY_PLACE = {
  place_id: 'place.456',
  name: 'Portland',
  category: null,
  address: null,
  full_address: 'Portland, Oregon, United States',
  center: { lat: 45.5152, lng: -122.6784 },
  kind: 'place',
  distance_m: 840,
};

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(() => {
  geoCache.clear();
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────

describe('GET /geo/places/nearby', () => {
  it('returns { places, locality } passed through from the provider', async () => {
    geoProvider.nearbyPlaces.mockResolvedValue({ places: [POI_PLACE], locality: LOCALITY_PLACE });
    const req = mockReq({ query: { lat: '45.5219', lng: '-122.6841' } });
    const res = mockRes();

    await nearbyHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.places).toEqual([POI_PLACE]);
    expect(res._json.locality).toEqual(LOCALITY_PLACE);
    expect(geoProvider.nearbyPlaces).toHaveBeenCalledWith(45.5219, -122.6841, { limit: 10 });
  });

  it('accepts the lon alias for lng', async () => {
    geoProvider.nearbyPlaces.mockResolvedValue({ places: [], locality: null });
    const req = mockReq({ query: { lat: '45.5219', lon: '-122.6841' } });
    const res = mockRes();

    await nearbyHandler(req, res);

    expect(res._status).toBe(200);
    expect(geoProvider.nearbyPlaces).toHaveBeenCalledWith(45.5219, -122.6841, { limit: 10 });
  });

  it('normalizes a missing locality to null', async () => {
    geoProvider.nearbyPlaces.mockResolvedValue({ places: [POI_PLACE], locality: undefined });
    const req = mockReq({ query: { lat: '45.5219', lng: '-122.6841' } });
    const res = mockRes();

    await nearbyHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.locality).toBeNull();
  });

  it('returns 400 for non-finite lat/lng', async () => {
    for (const query of [
      { lat: 'abc', lng: '-122.6841' },
      { lat: '45.5219' },
      {},
    ]) {
      const res = mockRes();
      await nearbyHandler(mockReq({ query }), res);
      expect(res._status).toBe(400);
      expect(res._json).toHaveProperty('error', 'lat and lng are required numbers');
    }
    expect(geoProvider.nearbyPlaces).not.toHaveBeenCalled();
  });

  it('returns 400 for out-of-range lat/lng without burning Mapbox calls', async () => {
    for (const query of [
      { lat: '95', lng: '-122.6841' },
      { lat: '45.5219', lng: '-190' },
      { lat: '-90.01', lng: '0' },
    ]) {
      const res = mockRes();
      await nearbyHandler(mockReq({ query }), res);
      expect(res._status).toBe(400);
      expect(res._json).toHaveProperty('error', 'lat and lng are required numbers');
    }
    expect(geoProvider.nearbyPlaces).not.toHaveBeenCalled();
  });

  it('serves cached response on second identical request', async () => {
    geoProvider.nearbyPlaces.mockResolvedValue({ places: [POI_PLACE], locality: LOCALITY_PLACE });

    const res1 = mockRes();
    await nearbyHandler(mockReq({ query: { lat: '45.5219', lng: '-122.6841' } }), res1);
    expect(geoProvider.nearbyPlaces).toHaveBeenCalledTimes(1);

    const res2 = mockRes();
    await nearbyHandler(mockReq({ query: { lat: '45.5219', lng: '-122.6841' } }), res2);

    expect(res2._status).toBe(200);
    expect(res2._json.places).toEqual([POI_PLACE]);
    expect(geoProvider.nearbyPlaces).toHaveBeenCalledTimes(1); // Still 1
  });

  it('returns 500 on provider failure', async () => {
    geoProvider.nearbyPlaces.mockRejectedValue(new Error('Mapbox down'));
    const res = mockRes();

    await nearbyHandler(mockReq({ query: { lat: '45.5219', lng: '-122.6841' } }), res);

    expect(res._status).toBe(500);
    expect(res._json).toHaveProperty('error', 'Mapbox down');
  });
});

describe('GET /geo/places/search', () => {
  it('returns { places } passed through from the provider with proximity forwarded', async () => {
    geoProvider.searchPlaces.mockResolvedValue({ places: [POI_PLACE] });
    const req = mockReq({ query: { q: 'blue star', lat: '45.5219', lng: '-122.6841' } });
    const res = mockRes();

    await searchHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.places).toEqual([POI_PLACE]);
    expect(geoProvider.searchPlaces).toHaveBeenCalledWith('blue star', {
      lat: 45.5219,
      lng: -122.6841,
      limit: 8,
    });
  });

  it('omits proximity when coords are missing', async () => {
    geoProvider.searchPlaces.mockResolvedValue({ places: [POI_PLACE] });
    const res = mockRes();

    await searchHandler(mockReq({ query: { q: 'blue star' } }), res);

    expect(res._status).toBe(200);
    expect(geoProvider.searchPlaces).toHaveBeenCalledWith('blue star', { limit: 8 });
  });

  it('drops out-of-range proximity coords instead of forwarding them', async () => {
    geoProvider.searchPlaces.mockResolvedValue({ places: [POI_PLACE] });
    const res = mockRes();

    await searchHandler(mockReq({ query: { q: 'blue star', lat: '95', lng: '-122.6841' } }), res);

    expect(res._status).toBe(200);
    expect(geoProvider.searchPlaces).toHaveBeenCalledWith('blue star', { limit: 8 });
  });

  it('short-circuits queries under 2 chars to { places: [] }', async () => {
    for (const q of ['', 'a', ' b ']) {
      const res = mockRes();
      await searchHandler(mockReq({ query: { q } }), res);
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ places: [] });
    }
    expect(geoProvider.searchPlaces).not.toHaveBeenCalled();
  });

  it('serves cached response on second identical request', async () => {
    geoProvider.searchPlaces.mockResolvedValue({ places: [POI_PLACE] });

    const res1 = mockRes();
    await searchHandler(mockReq({ query: { q: 'Blue Star', lat: '45.5219', lng: '-122.6841' } }), res1);
    expect(geoProvider.searchPlaces).toHaveBeenCalledTimes(1);

    // Same query (case-insensitive) + same coords → cache hit.
    const res2 = mockRes();
    await searchHandler(mockReq({ query: { q: 'blue star', lat: '45.5219', lng: '-122.6841' } }), res2);

    expect(res2._status).toBe(200);
    expect(res2._json.places).toEqual([POI_PLACE]);
    expect(geoProvider.searchPlaces).toHaveBeenCalledTimes(1); // Still 1
  });

  it('caches coordinate-less searches separately from proximity searches', async () => {
    geoProvider.searchPlaces.mockResolvedValue({ places: [POI_PLACE] });

    await searchHandler(mockReq({ query: { q: 'blue star', lat: '45.5219', lng: '-122.6841' } }), mockRes());
    await searchHandler(mockReq({ query: { q: 'blue star' } }), mockRes());

    expect(geoProvider.searchPlaces).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on provider failure', async () => {
    geoProvider.searchPlaces.mockRejectedValue(new Error('search failed'));
    const res = mockRes();

    await searchHandler(mockReq({ query: { q: 'blue star' } }), res);

    expect(res._status).toBe(500);
    expect(res._json).toHaveProperty('error', 'search failed');
  });
});

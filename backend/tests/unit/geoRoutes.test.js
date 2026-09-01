// ============================================================
// TEST: Geo Routes — contract tests for /api/geo endpoints
//
// Verifies response shapes, cache behavior, deprecation warnings,
// and error handling. Uses handler-extraction pattern with mock
// req/res (no express/supertest needed).
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
}));

const logger = require('../../utils/logger');
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

const autocompleteHandler = findHandler('GET', '/autocomplete');
const resolveHandler = findHandler('POST', '/resolve');
const reverseHandler = findHandler('GET', '/reverse');

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

// ── Fixtures ─────────────────────────────────────────────────

const PROVIDER_SUGGESTIONS = [
  {
    suggestion_id: 'address.12345',
    primary_text: '123 Main St',
    secondary_text: 'Portland, OR, 97201',
    label: '123 Main St, Portland, Oregon 97201, United States',
    center: { lat: 45.5152, lng: -122.6784 },
    kind: 'address',
  },
];

const PROVIDER_NORMALIZED = {
  address: '123 Main St, Portland, Oregon 97201, United States',
  city: 'Portland',
  state: 'OR',
  zipcode: '97201',
  latitude: 45.5152,
  longitude: -122.6784,
  place_id: 'address.12345',
  verified: false,
  source: 'mapbox_geocode',
  geocode_mode: 'temporary',
};

const PROVIDER_REVERSE_NORMALIZED = {
  address: '456 Oak Ave, Seattle, Washington 98101, United States',
  city: 'Seattle',
  state: 'WA',
  zipcode: '98101',
  latitude: 47.6062,
  longitude: -122.3321,
  place_id: 'address.99999',
  verified: false,
  source: 'mapbox_reverse',
  geocode_mode: 'temporary',
};

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(() => {
  geoCache.clear();
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────

describe('GET /geo/autocomplete', () => {
  it('returns { suggestions } with both new and legacy fields', async () => {
    geoProvider.autocomplete.mockResolvedValue({ suggestions: PROVIDER_SUGGESTIONS });
    const req = mockReq({ query: { q: '123 Main St' } });
    const res = mockRes();

    await autocompleteHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('suggestions');
    expect(res._json.suggestions).toHaveLength(1);

    const s = res._json.suggestions[0];
    // New contract fields
    expect(s.suggestion_id).toBe('address.12345');
    expect(s.primary_text).toBe('123 Main St');
    expect(s.secondary_text).toBe('Portland, OR, 97201');
    expect(s.kind).toBe('address');
    // Legacy compat fields
    expect(s.place_id).toBe('address.12345');
    expect(s.label).toContain('123 Main St');
    expect(s.text).toBe('123 Main St');
    expect(Array.isArray(s.center)).toBe(true);
    expect(s.center[0]).toBeCloseTo(-122.6784); // lng
    expect(s.center[1]).toBeCloseTo(45.5152);   // lat
  });

  it('returns empty suggestions for short query', async () => {
    const req = mockReq({ query: { q: 'ab' } });
    const res = mockRes();

    await autocompleteHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.suggestions).toEqual([]);
    expect(geoProvider.autocomplete).not.toHaveBeenCalled();
  });

  it('serves cached response on second identical request', async () => {
    geoProvider.autocomplete.mockResolvedValue({ suggestions: PROVIDER_SUGGESTIONS });

    // First request — hits provider
    const req1 = mockReq({ query: { q: '123 Main St' } });
    const res1 = mockRes();
    await autocompleteHandler(req1, res1);
    expect(geoProvider.autocomplete).toHaveBeenCalledTimes(1);

    // Second identical request — served from cache
    const req2 = mockReq({ query: { q: '123 Main St' } });
    const res2 = mockRes();
    await autocompleteHandler(req2, res2);

    expect(res2._status).toBe(200);
    expect(res2._json.suggestions).toHaveLength(1);
    expect(geoProvider.autocomplete).toHaveBeenCalledTimes(1); // Still 1
  });

  it('returns 500 on provider failure', async () => {
    geoProvider.autocomplete.mockRejectedValue(new Error('Mapbox down'));
    const req = mockReq({ query: { q: 'test query' } });
    const res = mockRes();

    await autocompleteHandler(req, res);

    expect(res._status).toBe(500);
    expect(res._json).toHaveProperty('error', 'Mapbox down');
  });

  it('logs telemetry for each request', async () => {
    geoProvider.autocomplete.mockResolvedValue({ suggestions: [] });
    const req = mockReq({ query: { q: 'test query' } });
    const res = mockRes();

    await autocompleteHandler(req, res);

    expect(logger.info).toHaveBeenCalledWith('geo_request', expect.objectContaining({
      endpoint: '/geo/autocomplete',
      method: 'GET',
    }));
    expect(logger.info).toHaveBeenCalledWith('geo_response', expect.objectContaining({
      endpoint: '/geo/autocomplete',
      status: 200,
    }));
  });
});

describe('POST /geo/resolve', () => {
  it('returns { normalized } with correct shape', async () => {
    geoProvider.resolve.mockResolvedValue(PROVIDER_NORMALIZED);
    const req = mockReq({ body: { suggestion_id: 'address.12345' } });
    const res = mockRes();

    await resolveHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('normalized');

    const n = res._json.normalized;
    expect(n.address).toBe(PROVIDER_NORMALIZED.address);
    expect(n.city).toBe('Portland');
    expect(n.state).toBe('OR');
    expect(n.zipcode).toBe('97201');
    expect(n.latitude).toBeCloseTo(45.5152);
    expect(n.longitude).toBeCloseTo(-122.6784);
    expect(n.place_id).toBe('address.12345');
    expect(n.verified).toBe(false);
    expect(n.source).toBe('mapbox_geocode');
    expect(n.geocode_mode).toBe('temporary');
  });

  it('returns 400 when suggestion_id is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await resolveHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toHaveProperty('error', 'suggestion_id is required');
  });

  it('caches resolve response on second request', async () => {
    geoProvider.resolve.mockResolvedValue(PROVIDER_NORMALIZED);

    const req1 = mockReq({ body: { suggestion_id: 'address.12345' } });
    const res1 = mockRes();
    await resolveHandler(req1, res1);
    expect(geoProvider.resolve).toHaveBeenCalledTimes(1);

    const req2 = mockReq({ body: { suggestion_id: 'address.12345' } });
    const res2 = mockRes();
    await resolveHandler(req2, res2);

    expect(res2._status).toBe(200);
    expect(geoProvider.resolve).toHaveBeenCalledTimes(1); // Still 1
  });

  it('returns 500 on provider failure', async () => {
    geoProvider.resolve.mockRejectedValue(new Error('resolve failed'));
    const req = mockReq({ body: { suggestion_id: 'bad-id' } });
    const res = mockRes();

    await resolveHandler(req, res);

    expect(res._status).toBe(500);
    expect(res._json).toHaveProperty('error', 'resolve failed');
  });
});

describe('GET /geo/reverse', () => {
  it('returns { normalized } with correct shape', async () => {
    geoProvider.reverseGeocode.mockResolvedValue(PROVIDER_REVERSE_NORMALIZED);
    const req = mockReq({ query: { lat: '47.6062', lon: '-122.3321' } });
    const res = mockRes();

    await reverseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('normalized');

    const n = res._json.normalized;
    expect(n.city).toBe('Seattle');
    expect(n.state).toBe('WA');
    expect(n.zipcode).toBe('98101');
    expect(n.source).toBe('mapbox_reverse');
    expect(n.geocode_mode).toBe('temporary');
  });

  it('returns 400 for invalid lat/lon', async () => {
    const req = mockReq({ query: { lat: 'abc', lon: 'def' } });
    const res = mockRes();

    await reverseHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json).toHaveProperty('error', 'lat and lon are required numbers');
  });

  it('caches reverse response', async () => {
    geoProvider.reverseGeocode.mockResolvedValue(PROVIDER_REVERSE_NORMALIZED);

    const req1 = mockReq({ query: { lat: '47.6062', lon: '-122.3321' } });
    const res1 = mockRes();
    await reverseHandler(req1, res1);
    expect(geoProvider.reverseGeocode).toHaveBeenCalledTimes(1);

    const req2 = mockReq({ query: { lat: '47.6062', lon: '-122.3321' } });
    const res2 = mockRes();
    await reverseHandler(req2, res2);

    expect(res2._status).toBe(200);
    expect(geoProvider.reverseGeocode).toHaveBeenCalledTimes(1); // Still 1
  });

  it('returns 404 when no address found', async () => {
    geoProvider.reverseGeocode.mockRejectedValue(new Error('No address found for that location'));
    const req = mockReq({ query: { lat: '0', lon: '0' } });
    const res = mockRes();

    await reverseHandler(req, res);

    expect(res._status).toBe(404);
    expect(res._json.error).toContain('No address found');
  });

  it('returns 500 on generic provider failure', async () => {
    geoProvider.reverseGeocode.mockRejectedValue(new Error('connection timeout'));
    const req = mockReq({ query: { lat: '47.6', lon: '-122.3' } });
    const res = mockRes();

    await reverseHandler(req, res);

    expect(res._status).toBe(500);
    expect(res._json).toHaveProperty('error', 'connection timeout');
  });
});

describe('/geo/normalize (removed)', () => {
  it('no longer exists in router stack', () => {
    const normalizeRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === '/normalize'
    );
    expect(normalizeRoute).toBeUndefined();
  });
});

describe('/geo/details (removed)', () => {
  it('no longer exists in router stack', () => {
    const detailsRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === '/details'
    );
    expect(detailsRoute).toBeUndefined();
  });
});

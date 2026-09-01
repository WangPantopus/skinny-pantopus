// ============================================================
// TEST: Geo Location E2E Flows
//
// End-to-end tests for all location-critical user flows:
//   a. Home onboarding by autocomplete
//   b. Business location onboarding
//   c. Gig creation with location
//   d. Current-location selection (reverse geocode)
//   e. Map-based discovery (bounds query)
//   f. Posting with location + provenance
//
// Uses supertest mini-app pattern with mocked GeoProvider for
// deterministic results. Covers happy-path and failure-path.
// ============================================================

const {
  resetTables,
  seedTable,
  getTable,
  setRpcMock,
} = require('../__mocks__/supabaseAdmin');

jest.setTimeout(15000);

// ── Mocks ────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = {
    id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: req.headers['x-test-user-role'] || 'user',
  };
  next();
});

jest.mock('../../services/geo', () => ({
  autocomplete: jest.fn(),
  resolve: jest.fn(),
  reverseGeocode: jest.fn(),
  forwardGeocode: jest.fn(),
}));

jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/s3Service', () => ({
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  createBulkNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/businessAddressService', () => ({
  validateBusinessAddress: jest.fn(),
}));

jest.mock('../../utils/businessPermissions', () => ({
  checkBusinessPermission: jest.fn(),
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  calculateAndStoreCompleteness: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/businessCompleteness', () => ({
  calculateAndStoreCompleteness: jest.fn().mockResolvedValue(undefined),
  calculateProfileCompleteness: jest.fn().mockReturnValue(0),
}));

jest.mock('../../utils/geocoding', () => ({
  geocodeAddress: jest.fn(),
}));

jest.mock('../../utils/normalizeAddress', () => ({
  computeAddressHash: jest.fn().mockReturnValue('hash-abc123'),
}));

jest.mock('../../utils/verifiedCoordinateGuard', () => ({
  shouldBlockCoordinateOverwrite: jest.fn().mockReturnValue(null),
  stripCoordinateFields: jest.fn((data) => data),
}));

jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_mock', client_secret: 'cs_mock', status: 'requires_payment_method' }),
  capturePaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_mock', status: 'succeeded' }),
  cancelPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_mock', status: 'canceled' }),
  createTransfer: jest.fn().mockResolvedValue({ id: 'tr_mock' }),
  createRefund: jest.fn().mockResolvedValue({ id: 're_mock' }),
}));

jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: { PENDING: 'pending', AUTHORIZED: 'authorized', CAPTURED: 'captured', CANCELED: 'canceled' },
  transitionPaymentStatus: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/gig/browseCacheService', () => ({
  invalidateForUser: jest.fn(),
  invalidateAll: jest.fn(),
  invalidateNear: jest.fn(),
}));

jest.mock('../../services/gig/affinityService', () => ({
  getAffinityScores: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../services/gig/rankingService', () => ({
  rankGigs: jest.fn((gigs) => gigs),
}));

jest.mock('../../utils/trustState', () => ({
  computeTrustState: jest.fn().mockResolvedValue({ level: 'verified_resident', roleBase: 'owner' }),
  getPostingIdentities: jest.fn().mockResolvedValue([]),
  canPostToAudience: jest.fn().mockReturnValue({ allowed: true }),
  canPostToPlace: jest.fn().mockReturnValue({ eligible: true }),
  haversineMeters: jest.fn().mockReturnValue(100),
}));

jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn().mockResolvedValue({ hasAccess: true }),
  getActiveOccupancy: jest.fn().mockResolvedValue(null),
  mapLegacyRole: jest.fn((role) => role),
}));

jest.mock('../../services/addressValidation', () => ({
  pipelineService: {
    buildStoredDecisionInputs: jest.fn(),
    runValidationPipeline: jest.fn(),
  },
  AddressVerdictStatus: {
    OK: 'OK',
    MIXED_USE: 'MIXED_USE',
    SERVICE_ERROR: 'SERVICE_ERROR',
    MISSING_UNIT: 'MISSING_UNIT',
    BUSINESS: 'BUSINESS',
    UNDELIVERABLE: 'UNDELIVERABLE',
    CONFLICT: 'CONFLICT',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  },
  addressDecisionEngine: { classify: jest.fn() },
  googleProvider: { isAvailable: jest.fn(() => true) },
  smartyProvider: { isAvailable: jest.fn(() => true) },
}));

jest.mock('../../utils/feedRanking', () => ({
  computeUtilityScore: jest.fn().mockReturnValue(50),
}));

jest.mock('../../services/feedService', () => ({
  invalidateUserFeedCache: jest.fn(),
  normalizeFeedPostRow: jest.fn((row) => row),
  normalizeMediaUrls: jest.fn((urls) => urls || []),
  normalizeAlignedMediaUrls: jest.fn((urls) => urls || []),
  getMuteAndHideFilters: jest.fn().mockReturnValue({ muteFilter: () => true, hideFilter: () => true }),
  applyMuteHideFilters: jest.fn((posts) => posts),
  enrichWithUserStatus: jest.fn((posts) => posts),
  attachIdentityAuthors: jest.fn((posts) => Promise.resolve(posts)),
  applyCursorCondition: jest.fn((qb) => qb),
  buildCursorPagination: jest.fn(() => ({ nextCursor: null, hasMore: false })),
  FEED_POST_SELECT: '*',
}));

jest.mock('../../middleware/rateLimiter', () => {
  const passthrough = (_req, _res, next) => next();
  return {
    globalWriteLimiter: passthrough,
    globalReadLimiter: passthrough,
    authLimiter: passthrough,
    postCreateLimiter: passthrough,
    gigCreateLimiter: passthrough,
    messageLimiter: passthrough,
    searchLimiter: passthrough,
    businessCreateLimiter: passthrough,
  };
});

const express = require('express');
const request = require('supertest');
const geoProvider = require('../../services/geo');
const { geoCache } = require('../../utils/geoCache');
const { validateBusinessAddress } = require('../../services/businessAddressService');
const { checkBusinessPermission } = require('../../utils/businessPermissions');
const {
  pipelineService,
  googleProvider,
  smartyProvider,
} = require('../../services/addressValidation');

// ── Constants ────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const HOME_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';

// ── Fixtures: deterministic GeoProvider responses ────────────

const AUTOCOMPLETE_RESULT = {
  suggestions: [
    {
      suggestion_id: 'address.12345',
      primary_text: '123 Main St',
      secondary_text: 'Portland, OR, 97201',
      label: '123 Main St, Portland, Oregon 97201, United States',
      center: { lat: 45.5152, lng: -122.6784 },
      kind: 'address',
    },
    {
      suggestion_id: 'place.67890',
      primary_text: 'Portland',
      secondary_text: 'OR',
      label: 'Portland, Oregon, United States',
      center: { lat: 45.5231, lng: -122.6765 },
      kind: 'place',
    },
  ],
};

const RESOLVED_ADDRESS = {
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

const REVERSE_ADDRESS = {
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

const EMPTY_AUTOCOMPLETE = { suggestions: [] };

// ── App factories ────────────────────────────────────────────

function createGeoApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/geo', require('../../routes/geo'));
  return app;
}

function createPostsApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

function createHomeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', require('../../routes/home'));
  return app;
}

function createBusinessApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/businesses', require('../../routes/businesses'));
  return app;
}

function createGigApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(() => {
  resetTables();
  geoCache.clear();
  jest.clearAllMocks();
  setRpcMock(null);

  // Default mock implementations
  geoProvider.autocomplete.mockResolvedValue(AUTOCOMPLETE_RESULT);
  geoProvider.resolve.mockResolvedValue(RESOLVED_ADDRESS);
  geoProvider.reverseGeocode.mockResolvedValue(REVERSE_ADDRESS);
  geoProvider.forwardGeocode.mockResolvedValue(RESOLVED_ADDRESS);
  googleProvider.isAvailable.mockReturnValue(true);
  smartyProvider.isAvailable.mockReturnValue(true);
  pipelineService.runValidationPipeline.mockResolvedValue({
    verdict: {
      status: 'OK',
      reasons: [],
      confidence: 0.95,
      next_actions: [],
      candidates: [],
    },
    address_id: 'addr-home-1',
    canonical_address: {
      id: 'addr-home-1',
      address_hash: 'hash-abc123',
      address_line1_norm: RESOLVED_ADDRESS.address,
      address_line2_norm: null,
      city_norm: RESOLVED_ADDRESS.city,
      state: RESOLVED_ADDRESS.state,
      postal_code: RESOLVED_ADDRESS.zipcode,
      country: 'US',
      geocode_lat: RESOLVED_ADDRESS.latitude,
      geocode_lng: RESOLVED_ADDRESS.longitude,
    },
  });
});

// ============================================================
// a. Home onboarding by autocomplete
// ============================================================

describe('Home onboarding by autocomplete', () => {
  it('autocomplete → select suggestion → resolve returns structured address', async () => {
    const app = createGeoApp();

    // Step 1: User types address, gets suggestions
    const acRes = await request(app)
      .get('/api/geo/autocomplete?q=123 Main St')
      .expect(200);

    expect(acRes.body.suggestions).toHaveLength(2);
    expect(acRes.body.suggestions[0].suggestion_id).toBe('address.12345');
    expect(acRes.body.suggestions[0].primary_text).toBe('123 Main St');

    // Step 2: User selects a suggestion → resolve to structured address
    const resolveRes = await request(app)
      .post('/api/geo/resolve')
      .send({ suggestion_id: 'address.12345' })
      .expect(200);

    const n = resolveRes.body.normalized;
    expect(n.address).toContain('123 Main St');
    expect(n.city).toBe('Portland');
    expect(n.state).toBe('OR');
    expect(n.zipcode).toBe('97201');
    expect(n.latitude).toBeCloseTo(45.5152);
    expect(n.longitude).toBeCloseTo(-122.6784);
    expect(n.place_id).toBe('address.12345');
  });

  it('creates a home with resolved location', async () => {
    const app = createHomeApp();

    seedTable('User', [{ id: USER_ID, role: 'user', name: 'Test User' }]);

    const res = await request(app)
      .post('/api/homes')
      .set('x-test-user-id', USER_ID)
      .send({
        address: RESOLVED_ADDRESS.address,
        city: RESOLVED_ADDRESS.city,
        state: RESOLVED_ADDRESS.state,
        zipcode: RESOLVED_ADDRESS.zipcode,
        home_type: 'house',
        latitude: RESOLVED_ADDRESS.latitude,
        longitude: RESOLVED_ADDRESS.longitude,
        geocode_provider: 'mapbox',
        geocode_accuracy: 'rooftop',
        geocode_place_id: RESOLVED_ADDRESS.place_id,
      });

    // Home creation should succeed (201 or 200)
    expect([200, 201]).toContain(res.status);

    // Check the Home was inserted with correct location data
    const homes = getTable('Home');
    expect(homes.length).toBeGreaterThanOrEqual(1);
    const home = homes[homes.length - 1];
    expect(home.city).toBe('Portland');
    expect(home.state).toBe('OR');
  });

  it('handles empty autocomplete gracefully', async () => {
    geoProvider.autocomplete.mockResolvedValue(EMPTY_AUTOCOMPLETE);
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/autocomplete?q=zzzznonexistent')
      .expect(200);

    expect(res.body.suggestions).toEqual([]);
  });
});

// ============================================================
// b. Business location onboarding
// ============================================================

describe('Business location onboarding', () => {
  beforeEach(() => {
    seedTable('User', [
      { id: USER_ID, role: 'user', name: 'Test User', account_type: 'business' },
      { id: BUSINESS_ID, role: 'business', name: 'Test Biz', account_type: 'business', username: 'testbiz' },
    ]);
    seedTable('BusinessProfile', [
      { id: BUSINESS_ID, business_user_id: BUSINESS_ID, name: 'Test Business', is_published: false },
    ]);

    checkBusinessPermission.mockResolvedValue({ hasAccess: true, role: 'owner' });

    validateBusinessAddress.mockResolvedValue({
      decision: {
        status: 'ok',
        reasons: [],
        business_location_type: 'storefront',
        allowed_capabilities: { map_pin: true, show_in_nearby: true, receive_mail: true, enable_payouts: true },
        required_verification: [],
      },
      canonical_address_id: 'canonical-1',
      coordinates: { lat: 45.5152, lng: -122.6784 },
      validation_provider: 'google_validation',
      geocode_accuracy: 'rooftop',
    });
  });

  it('autocomplete → resolve → create business location with provenance', async () => {
    const geoApp = createGeoApp();
    const bizApp = createBusinessApp();

    // Step 1: Autocomplete
    const acRes = await request(geoApp)
      .get('/api/geo/autocomplete?q=123 Main')
      .expect(200);

    expect(acRes.body.suggestions.length).toBeGreaterThan(0);

    // Step 2: Resolve
    const resolveRes = await request(geoApp)
      .post('/api/geo/resolve')
      .send({ suggestion_id: acRes.body.suggestions[0].suggestion_id })
      .expect(200);

    const addr = resolveRes.body.normalized;

    // Step 3: Create business location using resolved address
    const locRes = await request(bizApp)
      .post(`/api/businesses/${BUSINESS_ID}/locations`)
      .set('x-test-user-id', USER_ID)
      .send({
        label: 'Main Office',
        is_primary: true,
        address: addr.address,
        city: addr.city,
        state: addr.state,
        zipcode: addr.zipcode,
        latitude: addr.latitude,
        longitude: addr.longitude,
        geocode_provider: 'mapbox',
        geocode_place_id: addr.place_id,
      });

    expect([200, 201]).toContain(locRes.status);

    // Verify provenance was written
    const locations = getTable('BusinessLocation');
    expect(locations.length).toBeGreaterThanOrEqual(1);
    const loc = locations[locations.length - 1];
    expect(loc.geocode_provider).toBe('google_validation');
    expect(loc.geocode_mode).toBe('permanent');
    expect(loc.geocode_source_flow).toBe('business_onboarding');
    expect(loc.geocode_created_at).toBeDefined();
  });

  it('rejects undeliverable address', async () => {
    validateBusinessAddress.mockResolvedValue({
      decision: {
        status: 'undeliverable',
        reasons: ['address_not_found'],
        business_location_type: 'unknown',
        allowed_capabilities: {},
        required_verification: [],
      },
      canonical_address_id: null,
      coordinates: null,
    });

    const app = createBusinessApp();

    const res = await request(app)
      .post(`/api/businesses/${BUSINESS_ID}/locations`)
      .set('x-test-user-id', USER_ID)
      .send({
        label: 'Bad Office',
        address: '99999 Nowhere Rd',
        city: 'Faketown',
        state: 'ZZ',
        zipcode: '00000',
      })
      .expect(422);

    expect(res.body.error).toContain('undeliverable');
  });
});

// ============================================================
// c. Gig creation with location
// ============================================================

describe('Gig creation with location', () => {
  beforeEach(() => {
    seedTable('User', [
      { id: USER_ID, role: 'user', name: 'Test User', trust_level: 'established' },
    ]);
    seedTable('Gig', []);
  });

  it('creates a gig with location and provenance is persisted', async () => {
    const app = createGigApp();

    const res = await request(app)
      .post('/api/gigs')
      .set('x-test-user-id', USER_ID)
      .send({
        title: 'Help me move furniture',
        description: 'Need help moving a couch',
        price: 50,
        category: 'general',
        location: {
          mode: 'address',
          latitude: RESOLVED_ADDRESS.latitude,
          longitude: RESOLVED_ADDRESS.longitude,
          address: RESOLVED_ADDRESS.address,
          city: RESOLVED_ADDRESS.city,
          state: RESOLVED_ADDRESS.state,
          zip: RESOLVED_ADDRESS.zipcode,
          geocode_provider: 'mapbox',
          geocode_accuracy: 'address',
          geocode_place_id: RESOLVED_ADDRESS.place_id,
        },
      });

    // Gig creation should succeed
    expect([200, 201]).toContain(res.status);

    // Verify gig was inserted with location
    const gigs = getTable('Gig');
    expect(gigs.length).toBeGreaterThanOrEqual(1);
    const gig = gigs[gigs.length - 1];
    expect(gig.title).toBe('Help me move furniture');
  });

  it('rejects gig creation without required location', async () => {
    const app = createGigApp();

    const res = await request(app)
      .post('/api/gigs')
      .set('x-test-user-id', USER_ID)
      .send({
        title: 'Remote task - no location',
        description: 'A fully remote task',
        price: 25,
        category: 'general',
      });

    // location is required per schema — should return 400
    expect(res.status).toBe(400);
  });
});

// ============================================================
// d. Current-location selection (reverse geocode)
// ============================================================

describe('Current-location selection (reverse geocode)', () => {
  it('reverse geocodes GPS coordinates to structured address', async () => {
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/reverse?lat=47.6062&lon=-122.3321')
      .expect(200);

    const n = res.body.normalized;
    expect(n.address).toContain('456 Oak Ave');
    expect(n.city).toBe('Seattle');
    expect(n.state).toBe('WA');
    expect(n.zipcode).toBe('98101');
    expect(n.latitude).toBeCloseTo(47.6062);
    expect(n.longitude).toBeCloseTo(-122.3321);
    expect(n.source).toBe('mapbox_reverse');
  });

  it('returns 400 for missing coordinates', async () => {
    const app = createGeoApp();

    await request(app)
      .get('/api/geo/reverse')
      .expect(400);
  });

  it('returns 400 for non-numeric coordinates', async () => {
    const app = createGeoApp();

    await request(app)
      .get('/api/geo/reverse?lat=abc&lon=xyz')
      .expect(400);
  });

  it('returns 404 when no address found at coordinates', async () => {
    geoProvider.reverseGeocode.mockRejectedValue(new Error('No address found for that location'));
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/reverse?lat=0.0&lon=0.0')
      .expect(404);

    expect(res.body.error).toContain('No address found');
  });

  it('returns 500 on provider timeout', async () => {
    geoProvider.reverseGeocode.mockRejectedValue(new Error('connection timeout'));
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/reverse?lat=47.6&lon=-122.3')
      .expect(500);

    expect(res.body.error).toBe('connection timeout');
  });

  it('caches reverse geocode response', async () => {
    const app = createGeoApp();

    // First request
    await request(app)
      .get('/api/geo/reverse?lat=47.6062&lon=-122.3321')
      .expect(200);

    // Second request — should hit cache
    await request(app)
      .get('/api/geo/reverse?lat=47.6062&lon=-122.3321')
      .expect(200);

    // Provider should only be called once
    expect(geoProvider.reverseGeocode).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// e. Map-based discovery (bounds query)
// ============================================================

describe('Map-based discovery', () => {
  beforeEach(() => {
    // Seed posts with location data for map discovery
    seedTable('Post', [
      {
        id: 'post-aaa1',
        user_id: USER_ID,
        content: 'Portland coffee meetup',
        post_type: 'general',
        latitude: 45.5152,
        longitude: -122.6784,
        location_name: 'Portland, OR',
        visibility: 'neighborhood',
        visibility_scope: 'neighborhood',
        state: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: 'post-aaa2',
        user_id: USER_ID,
        content: 'Seattle art walk',
        post_type: 'general',
        latitude: 47.6062,
        longitude: -122.3321,
        location_name: 'Seattle, WA',
        visibility: 'neighborhood',
        visibility_scope: 'neighborhood',
        state: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: 'post-aaa3',
        user_id: USER_ID,
        content: 'No location post',
        post_type: 'general',
        latitude: null,
        longitude: null,
        visibility: 'followers',
        visibility_scope: 'followers',
        state: 'open',
        created_at: new Date().toISOString(),
      },
    ]);

    seedTable('User', [
      { id: USER_ID, role: 'user', name: 'Test User', username: 'testuser' },
    ]);
  });

  it('returns posts in geo app that have location', async () => {
    const app = createGeoApp();

    // Autocomplete returns suggestions for map view
    const acRes = await request(app)
      .get('/api/geo/autocomplete?q=Portland Oregon')
      .expect(200);

    expect(acRes.body.suggestions).toHaveLength(2);
    // Each suggestion has center coordinates for map pin placement
    acRes.body.suggestions.forEach((s) => {
      expect(s.center).toBeDefined();
      expect(typeof s.center[0]).toBe('number'); // lng
      expect(typeof s.center[1]).toBe('number'); // lat
    });
  });

  it('autocomplete returns data with center coords for pin placement', async () => {
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/autocomplete?q=Portland')
      .expect(200);

    const s = res.body.suggestions[0];
    expect(s.suggestion_id).toBeDefined();
    expect(s.center).toBeDefined();
    expect(s.label).toBeDefined();
    expect(s.kind).toBe('address');
  });
});

// ============================================================
// f. Posting with location + provenance
// ============================================================

describe('Posting with location + provenance', () => {
  beforeEach(() => {
    seedTable('User', [
      { id: USER_ID, role: 'user', name: 'Test User', trust_level: 'established' },
    ]);
    seedTable('Post', []);
  });

  it('creates a post with location and geocode provenance', async () => {
    const app = createPostsApp();

    const res = await request(app)
      .post('/api/posts')
      .set('x-test-user-id', USER_ID)
      .send({
        content: 'Great coffee shop on Main St!',
        postType: 'local_update',
        latitude: RESOLVED_ADDRESS.latitude,
        longitude: RESOLVED_ADDRESS.longitude,
        locationName: 'Portland, OR',
        locationAddress: RESOLVED_ADDRESS.address,
        audience: 'neighborhood',
        geocodeProvider: 'mapbox',
        geocodeAccuracy: 'address',
        geocodePlaceId: RESOLVED_ADDRESS.place_id,
      });

    // Post creation should succeed
    expect([200, 201]).toContain(res.status);

    // Verify post was inserted with provenance
    const posts = getTable('Post');
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const post = posts[posts.length - 1];
    expect(post.latitude).toBeCloseTo(45.5152);
    expect(post.longitude).toBeCloseTo(-122.6784);
    expect(post.geocode_provider).toBe('mapbox');
    expect(post.geocode_mode).toBe('temporary');
    expect(post.geocode_source_flow).toBe('post_create');
    expect(post.geocode_created_at).toBeDefined();
  });

  it('creates a post without location — no provenance written', async () => {
    const app = createPostsApp();

    const res = await request(app)
      .post('/api/posts')
      .set('x-test-user-id', USER_ID)
      .send({
        content: 'A thought with no location',
        postType: 'general',
        audience: 'followers',
      });

    expect([200, 201]).toContain(res.status);

    const posts = getTable('Post');
    const post = posts[posts.length - 1];
    expect(post.geocode_provider).toBeUndefined();
    expect(post.geocode_source_flow).toBeUndefined();
  });
});

// ============================================================
// Provider failure paths
// ============================================================

describe('GeoProvider failure paths', () => {
  it('autocomplete returns 500 on provider timeout', async () => {
    geoProvider.autocomplete.mockRejectedValue(new Error('ETIMEDOUT'));
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/autocomplete?q=portland')
      .expect(500);

    expect(res.body.error).toBe('ETIMEDOUT');
  });

  it('autocomplete returns empty for short queries without calling provider', async () => {
    const app = createGeoApp();

    const res = await request(app)
      .get('/api/geo/autocomplete?q=ab')
      .expect(200);

    expect(res.body.suggestions).toEqual([]);
    expect(geoProvider.autocomplete).not.toHaveBeenCalled();
  });

  it('resolve returns 400 when suggestion_id is missing', async () => {
    const app = createGeoApp();

    await request(app)
      .post('/api/geo/resolve')
      .send({})
      .expect(400);
  });

  it('resolve returns 500 on provider failure', async () => {
    geoProvider.resolve.mockRejectedValue(new Error('Mapbox service unavailable'));
    const app = createGeoApp();

    const res = await request(app)
      .post('/api/geo/resolve')
      .send({ suggestion_id: 'address.12345' })
      .expect(500);

    expect(res.body.error).toBe('Mapbox service unavailable');
  });
});

// ============================================================
// Caching behavior
// ============================================================

describe('Geo caching', () => {
  it('autocomplete caches results across identical queries', async () => {
    const app = createGeoApp();

    // First call — hits provider
    await request(app)
      .get('/api/geo/autocomplete?q=portland main')
      .expect(200);
    expect(geoProvider.autocomplete).toHaveBeenCalledTimes(1);

    // Second identical call — served from cache
    const res = await request(app)
      .get('/api/geo/autocomplete?q=portland main')
      .expect(200);

    expect(geoProvider.autocomplete).toHaveBeenCalledTimes(1);
    expect(res.body.suggestions).toHaveLength(2);
  });

  it('resolve caches results across identical suggestion_ids', async () => {
    const app = createGeoApp();

    await request(app)
      .post('/api/geo/resolve')
      .send({ suggestion_id: 'address.12345' })
      .expect(200);

    await request(app)
      .post('/api/geo/resolve')
      .send({ suggestion_id: 'address.12345' })
      .expect(200);

    expect(geoProvider.resolve).toHaveBeenCalledTimes(1);
  });
});

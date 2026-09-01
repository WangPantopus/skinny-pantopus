// ============================================================
// TEST: Gig Location Filtering
//
// Unit tests for location-based gig filtering in routes/gigs.js:
// GET /api/gigs, GET /api/gigs/search, GET /api/gigs/in-bounds
// ============================================================

// Use shared supabase mock so seedTable/setAuthMocks/setRpcMock are reliable (CI + full-suite runs)
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../config/supabase', () => jest.requireActual('../__mocks__/supabaseAdmin'));

const { resetTables, seedTable, setRpcMock, setAuthMocks, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Mock verifyToken ─────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  next();
});

// ── Mock notificationService ─────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
  createBulkNotifications: jest.fn(),
  notifyBidReceived: jest.fn(),
  notifyBidAccepted: jest.fn(),
}));

// ── Mock businessPermissions ─────────────────────────────────
jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]),
  getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]),
}));

// ── Mock stripeService ───────────────────────────────────────
jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntent: jest.fn(),
  capturePayment: jest.fn(),
  refundPayment: jest.fn(),
}));

// ── Mock paymentStateMachine ─────────────────────────────────
jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: {
    PENDING: 'pending',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    RELEASED: 'released',
    REFUNDED: 'refunded',
  },
}));

const express = require('express');
const request = require('supertest');

// ── Constants ────────────────────────────────────────────────
const GIG_1 = '11111111-1111-1111-8111-111111111111';
const GIG_2 = '22222222-2222-1222-8222-222222222222';
const GIG_3 = '33333333-3333-1333-8333-333333333333';
const USER_1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

function createApp() {
  const app = express();
  app.use(express.json());
  const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
  app.set('io', mockIo);
  // Set req.user when Bearer token is present so GET /api/gigs (no verifyToken) still
  // sees the current user for exclude-own-gigs and user_id filter.
  app.use('/api/gigs', (req, _res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      req.user = { id: USER_1 };
    }
    next();
  });
  app.use('/api/gigs', require('../../routes/gigs'));
  return { app, mockIo };
}

// ── Sample RPC rows ──────────────────────────────────────────
const makeGigRow = (overrides = {}) => ({
  id: GIG_1,
  title: 'Test Gig',
  description: 'A test gig description',
  price: 50,
  category: 'cleaning',
  deadline: null,
  estimated_duration: null,
  user_id: USER_1,
  status: 'open',
  accepted_by: null,
  created_at: '2026-01-15T00:00:00Z',
  creator_name: 'Test User',
  creator_username: 'testuser',
  profile_picture_url: null,
  distance_meters: 1200,
  exact_city: 'San Francisco',
  exact_state: 'CA',
  approx_latitude: 37.77,
  approx_longitude: -122.42,
  location_precision: 'approx_area',
  visibility_scope: 'city',
  is_urgent: false,
  tags: [],
  items: null,
  scheduled_start: null,
  ...overrides,
});

// ============================================================
// TEST SUITE
// ============================================================
describe('Gig Location Filtering', () => {
  let app;

  beforeAll(() => {
    ({ app } = createApp());
  });

  beforeEach(() => {
    resetTables();
  });

  // ── Test 1: GET /api/gigs with lat/lng calls find_gigs_nearby_v2 ──
  describe('GET /api/gigs with latitude & longitude', () => {
    it('should call find_gigs_nearby_v2 and return enriched gigs', async () => {
      const nearbyGig = makeGigRow({ id: GIG_1, distance_meters: 800 });
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [nearbyGig], error: null };
        }
        return { data: null, error: null };
      });

      // Seed empty GigBid table for bid count enrichment
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          radiusMiles: '10',
        })
        .expect(200);

      // Verify RPC was called with correct params
      expect(capturedParams).toBeTruthy();
      expect(capturedParams.user_lat).toBe(37.7749);
      expect(capturedParams.user_lon).toBe(-122.4194);
      expect(capturedParams.p_radius_meters).toBe(Math.round(10 * 1609.34));
      expect(capturedParams.p_include_remote).toBe(true); // default

      // Verify response shape
      expect(res.body.gigs).toBeDefined();
      expect(res.body.gigs).toHaveLength(1);
      expect(res.body.gigs[0].id).toBe(GIG_1);
      expect(res.body.gigs[0].distance_meters).toBe(800);
      expect(res.body.gigs[0].poster_display_name).toBe('Test User');
    });

    it('normalizes bracket-array status values before calling the nearby RPC', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [makeGigRow()], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          status: "['open']",
        })
        .expect(200);

      expect(capturedParams.gig_status).toBe('open');
    });

    it('accepts bracket notation query params for a single public status', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [makeGigRow()], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          'status[]': 'open',
        })
        .expect(200);

      expect(capturedParams.gig_status).toBe('open');
    });

    it('rejects multi-status public browse until the RPC supports it', async () => {
      setRpcMock(() => ({ data: [], error: null }));
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          status: 'open,assigned',
        })
        .expect(400);

      expect(res.body.error).toMatch(/only one status/i);
    });

    it('excludes the authenticated user own gigs from spatial browse results', async () => {
      setAuthMocks({
        getUser: async () => ({
          data: { user: { id: USER_1 } },
          error: null,
        }),
      });

      const ownGig = makeGigRow({ id: GIG_1, user_id: USER_1 });
      const otherGig = makeGigRow({ id: GIG_2, user_id: 'poster-2' });

      setRpcMock((rpcName) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          return { data: [ownGig, otherGig], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .set('Authorization', 'Bearer test-token')
        .query({ latitude: '37.7749', longitude: '-122.4194' })
        .expect(200);

      expect(res.body.gigs).toHaveLength(1);
      expect(res.body.gigs[0].id).toBe(GIG_2);
    });
  });

  // ── Test 2: Remote gigs included by default ──
  describe('GET /api/gigs with remote gigs', () => {
    it('should include remote gigs (null location) by default', async () => {
      const localGig = makeGigRow({ id: GIG_1, distance_meters: 500 });
      const remoteGig = makeGigRow({
        id: GIG_2,
        title: 'Remote Gig',
        distance_meters: null,
        approx_latitude: null,
        approx_longitude: null,
      });
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [localGig, remoteGig], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .query({ latitude: '37.7749', longitude: '-122.4194' })
        .expect(200);

      expect(capturedParams.p_include_remote).toBe(true);
      expect(res.body.gigs).toHaveLength(2);

      const remote = res.body.gigs.find((g) => g.id === GIG_2);
      expect(remote).toBeDefined();
      expect(remote.distance_meters).toBeNull();
    });
  });

  // ── Test 3: includeRemote=false excludes remote gigs ──
  describe('GET /api/gigs with includeRemote=false', () => {
    it('should pass p_include_remote=false to RPC', async () => {
      const localGig = makeGigRow({ id: GIG_1, distance_meters: 500 });
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [localGig], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          includeRemote: 'false',
        })
        .expect(200);

      expect(capturedParams.p_include_remote).toBe(false);
    });

    it('accepts boolean-ish includeRemote values and prefers max_distance over radiusMiles', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [makeGigRow()], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          includeRemote: '0',
          radiusMiles: '10',
          max_distance: '5000',
        })
        .expect(200);

      expect(capturedParams.p_include_remote).toBe(false);
      expect(capturedParams.p_radius_meters).toBe(5000);
    });
  });

  // ── Test 4: Fallback to non-spatial query without location ──
  describe('GET /api/gigs without location', () => {
    it('should NOT call find_gigs_nearby_v2 when lat/lng absent', async () => {
      let rpcCalled = false;

      setRpcMock((rpcName) => {
        if (rpcName === 'find_gigs_nearby_v2') rpcCalled = true;
        return { data: [], error: null };
      });

      // Seed the Gig table for the non-spatial fallback path
      seedTable('Gig', [
        {
          id: GIG_1,
          title: 'Fallback Gig',
          description: 'No location provided',
          price: 30,
          category: 'general',
          status: 'open',
          user_id: USER_1,
          created_at: '2026-01-10T00:00:00Z',
          User: { id: USER_1, username: 'testuser', name: 'Test', profile_picture_url: null },
        },
      ]);
      seedTable('GigBid', []);

      // The non-spatial path uses .range() which the mock doesn't fully support,
      // so we only verify that the spatial RPC was NOT called.
      await request(app).get('/api/gigs');

      expect(rpcCalled).toBe(false);
    });

    it('excludes the authenticated user own gigs from non-spatial browse results', async () => {
      const gigRows = [
        {
          id: GIG_1,
          title: 'My Own Gig',
          description: 'Should be excluded',
          price: 40,
          category: 'general',
          status: 'open',
          user_id: USER_1,
          created_at: '2026-01-10T00:00:00Z',
          deadline: null,
          attachments: [],
          User: { id: USER_1, username: 'me', name: 'Me', profile_picture_url: null },
        },
        {
          id: GIG_2,
          title: 'Someone Else Gig',
          description: 'Should remain visible',
          price: 55,
          category: 'general',
          status: 'open',
          user_id: 'poster-2',
          created_at: '2026-01-09T00:00:00Z',
          deadline: null,
          attachments: [],
          User: { id: 'poster-2', username: 'other', name: 'Other', profile_picture_url: null },
        },
      ];
      seedTable('Gig', gigRows);
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body.gigs).toHaveLength(1);
      expect(res.body.gigs[0].id).toBe(GIG_2);
    });

    it('keeps explicit user_id filters intact for profile views', async () => {
      const gigRows = [
        {
          id: GIG_1,
          title: 'My Own Gig',
          description: 'Should still show when requested explicitly',
          price: 40,
          category: 'general',
          status: 'open',
          user_id: USER_1,
          created_at: '2026-01-10T00:00:00Z',
          deadline: null,
          attachments: [],
          User: { id: USER_1, username: 'me', name: 'Me', profile_picture_url: null },
        },
        {
          id: GIG_2,
          title: 'Someone Else Gig',
          description: 'Not requested',
          price: 55,
          category: 'general',
          status: 'open',
          user_id: 'poster-2',
          created_at: '2026-01-09T00:00:00Z',
          deadline: null,
          attachments: [],
          User: { id: 'poster-2', username: 'other', name: 'Other', profile_picture_url: null },
        },
      ];
      seedTable('Gig', gigRows);
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs')
        .set('Authorization', 'Bearer test-token')
        .query({ user_id: USER_1 })
        .expect(200);

      expect(res.body.gigs).toHaveLength(1);
      expect(res.body.gigs[0].id).toBe(GIG_1);
    });
  });

  // ── Test 5: Category and price filters forwarded to RPC ──
  describe('GET /api/gigs with category and price filters', () => {
    it('should forward category, min_price, max_price to RPC', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          category: 'cleaning',
          price_min: '20',
          price_max: '100',
        })
        .expect(200);

      expect(capturedParams.p_category).toBe('cleaning');
      expect(capturedParams.p_min_price).toBe(20);
      expect(capturedParams.p_max_price).toBe(100);
    });
  });

  // ── Test 6: sort=distance forwarded to RPC ──
  describe('GET /api/gigs with sort=distance', () => {
    it('should map sort=distance to p_sort=distance in RPC call', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      await request(app)
        .get('/api/gigs')
        .query({
          latitude: '37.7749',
          longitude: '-122.4194',
          sort: 'distance',
        })
        .expect(200);

      expect(capturedParams.p_sort).toBe('distance');
    });
  });

  // ── Test 7: GET /api/gigs/search with lat/lng uses spatial search ──
  describe('GET /api/gigs/search with location', () => {
    it('should call find_gigs_nearby_v2 with p_search when location provided', async () => {
      const matchedGig = makeGigRow({ id: GIG_1, title: 'Lawn Mowing' });
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_nearby_v2') {
          capturedParams = params;
          return { data: [matchedGig], error: null };
        }
        return { data: null, error: null };
      });
      seedTable('GigBid', []);

      const res = await request(app)
        .get('/api/gigs/search')
        .query({
          q: 'lawn',
          latitude: '37.7749',
          longitude: '-122.4194',
          radiusMiles: '15',
        })
        .expect(200);

      expect(capturedParams).toBeTruthy();
      expect(capturedParams.p_search).toBe('lawn');
      expect(capturedParams.p_radius_meters).toBe(Math.round(15 * 1609.34));
      expect(capturedParams.p_include_remote).toBe(true);
      expect(res.body.gigs).toHaveLength(1);
    });
  });

  // ── Test 8: GET /api/gigs/in-bounds uses find_gigs_in_bounds_v2 ──
  describe('GET /api/gigs/in-bounds', () => {
    it('should call find_gigs_in_bounds_v2 with bounds, includeRemote, and category', async () => {
      const boundedGig = makeGigRow({
        id: GIG_1,
        approx_latitude: 37.78,
        approx_longitude: -122.41,
      });
      const remoteGig = makeGigRow({
        id: GIG_3,
        title: 'Remote Task',
        approx_latitude: null,
        approx_longitude: null,
        distance_meters: null,
      });
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_in_bounds_v2') {
          capturedParams = params;
          return { data: [boundedGig, remoteGig], error: null };
        }
        return { data: null, error: null };
      });

      const res = await request(app)
        .get('/api/gigs/in-bounds')
        .query({
          min_lat: '37.70',
          min_lon: '-122.50',
          max_lat: '37.85',
          max_lon: '-122.35',
          includeRemote: 'true',
          category: 'cleaning',
        })
        .expect(200);

      expect(capturedParams).toBeTruthy();
      expect(capturedParams.min_lat).toBe(37.7);
      expect(capturedParams.max_lat).toBe(37.85);
      expect(capturedParams.p_include_remote).toBe(true);
      expect(capturedParams.p_category).toBe('cleaning');
      expect(capturedParams.gig_status).toBe('open');

      expect(res.body.gigs).toHaveLength(2);
      // Verify enrichment
      expect(res.body.gigs[0].poster_display_name).toBe('Test User');
    });

    it('normalizes bracket notation status values for in-bounds map fetches', async () => {
      let capturedParams = null;

      setRpcMock((rpcName, params) => {
        if (rpcName === 'find_gigs_in_bounds_v2') {
          capturedParams = params;
          return { data: [makeGigRow()], error: null };
        }
        return { data: null, error: null };
      });

      await request(app)
        .get('/api/gigs/in-bounds')
        .query({
          min_lat: '37.70',
          min_lon: '-122.50',
          max_lat: '37.85',
          max_lon: '-122.35',
          'status[]': 'open',
        })
        .expect(200);

      expect(capturedParams.gig_status).toBe('open');
    });

    it('rejects multi-status in-bounds requests', async () => {
      const res = await request(app)
        .get('/api/gigs/in-bounds')
        .query({
          min_lat: '37.70',
          min_lon: '-122.50',
          max_lat: '37.85',
          max_lon: '-122.35',
          status: 'open,assigned',
        })
        .expect(400);

      expect(res.body.error).toMatch(/only one status/i);
    });
  });
});

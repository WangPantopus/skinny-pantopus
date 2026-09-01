// ============================================================
// TEST: GET /api/gigs/browse — Browse Sections Endpoint
// ============================================================

const { resetTables, seedTable, setRpcMock, setAuthMocks } = require('../__mocks__/supabaseAdmin');

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

// ─── Helpers ────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

let gigIdCounter = 0;
function makeGig(overrides = {}) {
  gigIdCounter++;
  return {
    id: overrides.id || `gig-${gigIdCounter}`,
    title: overrides.title || `Test Gig ${gigIdCounter}`,
    description: overrides.description || 'Test description',
    price: overrides.price ?? 50,
    category: overrides.category || 'Cleaning',
    status: 'open',
    created_at: overrides.created_at || new Date().toISOString(),
    distance_meters: overrides.distance_meters ?? 1000,
    deadline: overrides.deadline || null,
    is_urgent: overrides.is_urgent || false,
    user_id: overrides.user_id || 'user-1',
    creator_name: 'Test User',
    creator_username: 'testuser',
    profile_picture_url: null,
    exact_city: 'San Francisco',
    exact_state: 'CA',
    approx_latitude: 37.77,
    approx_longitude: -122.42,
    location_precision: 'approx_area',
    visibility_scope: 'city',
    tags: [],
    items: null,
    scheduled_start: null,
    accepted_by: null,
    estimated_duration: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('GET /api/gigs/browse', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
    gigIdCounter = 0;
    // Clear browse cache between tests (singleton)
    require('../../services/gig/browseCacheService').clear();
  });

  afterEach(() => {
    setRpcMock(null);
  });

  it('returns 400 when lat/lng are missing', async () => {
    const res = await request(app).get('/api/gigs/browse');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat.*lng/i);
  });

  it('returns 400 when lat/lng are invalid', async () => {
    const res = await request(app).get('/api/gigs/browse?lat=abc&lng=xyz');
    expect(res.status).toBe(400);
  });

  it('returns all section keys even with 0 gigs', async () => {
    setRpcMock(() => ({ data: [], error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.status).toBe(200);

    const { sections } = res.body;
    expect(sections).toHaveProperty('best_matches');
    expect(sections).toHaveProperty('urgent');
    expect(sections).toHaveProperty('clusters');
    expect(sections).toHaveProperty('high_paying');
    expect(sections).toHaveProperty('new_today');
    expect(sections).toHaveProperty('quick_jobs');

    // All should be arrays
    expect(Array.isArray(sections.best_matches)).toBe(true);
    expect(Array.isArray(sections.urgent)).toBe(true);
    expect(Array.isArray(sections.clusters)).toBe(true);
    expect(Array.isArray(sections.high_paying)).toBe(true);
    expect(Array.isArray(sections.new_today)).toBe(true);
    expect(Array.isArray(sections.quick_jobs)).toBe(true);

    expect(res.body.total_active).toBe(0);
    expect(res.body.radius_used).toBeDefined();
  });

  it('returns best_matches sorted by composite score (close + recent first)', async () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();

    const gigs = [
      makeGig({ id: 'far-old', distance_meters: 7000, created_at: weekAgo }),
      makeGig({ id: 'close-recent', distance_meters: 200, created_at: hourAgo }),
      makeGig({
        id: 'mid-mid',
        distance_meters: 3000,
        created_at: new Date(now.getTime() - 2 * 24 * 3600000).toISOString(),
      }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.status).toBe(200);

    const ids = res.body.sections.best_matches.map((g) => g.id);
    expect(ids[0]).toBe('close-recent');
  });

  it('returns urgent gigs with deadline today/tomorrow', async () => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 3600000);

    const gigs = [
      makeGig({ id: 'urgent-deadline', deadline: todayEnd.toISOString() }),
      makeGig({ id: 'not-urgent', deadline: nextWeek.toISOString() }),
      makeGig({ id: 'urgent-flag', is_urgent: true }),
      makeGig({ id: 'urgent-title', title: 'ASAP need help moving' }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    const urgentIds = res.body.sections.urgent.map((g) => g.id);

    expect(urgentIds).toContain('urgent-deadline');
    expect(urgentIds).toContain('urgent-flag');
    expect(urgentIds).toContain('urgent-title');
    expect(urgentIds).not.toContain('not-urgent');
  });

  it('returns high_paying gigs above 65th percentile', async () => {
    // Create 10 gigs with prices 10, 20, ..., 100
    const gigs = Array.from({ length: 10 }, (_, i) =>
      makeGig({ id: `gig-${i}`, price: (i + 1) * 10 })
    );

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    const highPaying = res.body.sections.high_paying;

    // 65th percentile of [10,20,...,100] = index 6 = 70
    // All high_paying should have price >= 70
    expect(highPaying.length).toBeGreaterThan(0);
    for (const g of highPaying) {
      expect(parseFloat(g.price)).toBeGreaterThanOrEqual(70);
    }
  });

  it('returns empty high_paying when fewer than 3 qualify', async () => {
    // Only 2 gigs total — no meaningful percentile
    const gigs = [makeGig({ price: 50 }), makeGig({ price: 60 })];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.body.sections.high_paying).toEqual([]);
  });

  it('returns new_today for gigs posted in last 24h', async () => {
    const now = new Date();
    const recentTime = new Date(now.getTime() - 2 * 3600000).toISOString(); // 2h ago
    const oldTime = new Date(now.getTime() - 48 * 3600000).toISOString(); // 2 days ago

    const gigs = [
      makeGig({ id: 'recent', created_at: recentTime }),
      makeGig({ id: 'old', created_at: oldTime }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    const newTodayIds = res.body.sections.new_today.map((g) => g.id);

    expect(newTodayIds).toContain('recent');
    expect(newTodayIds).not.toContain('old');
  });

  it('returns quick_jobs for gigs under $100', async () => {
    const gigs = [
      makeGig({ id: 'cheap', price: 25 }),
      makeGig({ id: 'mid', price: 75 }),
      makeGig({ id: 'expensive', price: 200 }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    const quickIds = res.body.sections.quick_jobs.map((g) => g.id);

    expect(quickIds).toContain('cheap');
    expect(quickIds).toContain('mid');
    expect(quickIds).not.toContain('expensive');
  });

  it('excludes the authenticated user own gigs from browse sections and clusters', async () => {
    setAuthMocks({
      getUser: async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    });

    const gigs = [
      makeGig({ id: 'mine', user_id: 'user-1', category: 'Cleaning', price: 45 }),
      makeGig({ id: 'other-cleaning', user_id: 'user-2', category: 'Cleaning', price: 60 }),
      makeGig({
        id: 'other-urgent',
        user_id: 'user-3',
        category: 'Pet Care',
        price: 75,
        is_urgent: true,
      }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app)
      .get('/api/gigs/browse?lat=37.77&lng=-122.42')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    const sectionIds = [
      ...res.body.sections.best_matches.map((gig) => gig.id),
      ...res.body.sections.urgent.map((gig) => gig.id),
      ...res.body.sections.high_paying.map((gig) => gig.id),
      ...res.body.sections.new_today.map((gig) => gig.id),
      ...res.body.sections.quick_jobs.map((gig) => gig.id),
    ];

    expect(sectionIds).not.toContain('mine');
    expect(res.body.sections.clusters).toEqual([]);
    expect(res.body.total_active).toBe(2);
  });

  it('returns empty quick_jobs when fewer than 2 qualify', async () => {
    const gigs = [
      makeGig({ price: 50 }), // 1 under $100
      makeGig({ price: 200 }),
      makeGig({ price: 300 }),
    ];

    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.body.sections.quick_jobs).toEqual([]);
  });

  it('respects custom radius parameter', async () => {
    let capturedParams = null;
    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_gigs_nearby_v2') capturedParams = params;
      return { data: [], error: null };
    });

    await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42&radius=16000');

    expect(capturedParams).toBeDefined();
    expect(capturedParams.p_radius_meters).toBe(16000);
  });

  it('allows radius above the old 50 mile cap', async () => {
    let capturedParams = null;
    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_gigs_nearby_v2') capturedParams = params;
      return { data: [], error: null };
    });

    await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42&radius=999999');

    expect(capturedParams.p_radius_meters).toBe(999999);
  });

  it('caps very large radius at global distance', async () => {
    let capturedParams = null;
    setRpcMock((rpcName, params) => {
      if (rpcName === 'find_gigs_nearby_v2') capturedParams = params;
      return { data: [], error: null };
    });

    await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42&radius=999999999');

    expect(capturedParams.p_radius_meters).toBe(40233500);
  });

  it('returns total_active and radius_used in response', async () => {
    const gigs = Array.from({ length: 7 }, () => makeGig({}));
    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.body.total_active).toBe(7);
    expect(res.body.radius_used).toBe(160934); // default 100 mi
  });

  it('best_matches limited to 5', async () => {
    const gigs = Array.from({ length: 20 }, () => makeGig({}));
    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.body.sections.best_matches.length).toBeLessThanOrEqual(5);
  });

  it('new_today limited to 10', async () => {
    const now = new Date();
    const gigs = Array.from({ length: 20 }, () =>
      makeGig({ created_at: new Date(now.getTime() - 1000).toISOString() })
    );
    setRpcMock(() => ({ data: gigs, error: null }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.body.sections.new_today.length).toBeLessThanOrEqual(10);
  });

  it('handles RPC error gracefully with 500', async () => {
    setRpcMock(() => ({ data: null, error: { message: 'RPC failed' } }));

    const res = await request(app).get('/api/gigs/browse?lat=37.77&lng=-122.42');
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

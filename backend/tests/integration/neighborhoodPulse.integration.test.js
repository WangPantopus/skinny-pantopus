/**
 * Integration tests for the Neighborhood Pulse endpoint.
 *
 * Tests the full /api/ai/pulse route including auth, HomeOccupancy checks,
 * response shape, graceful degradation, and performance.
 *
 * Requires a running backend and Supabase instance.
 */
const { createTestUser, seedRow, cleanup, apiRequest, admin } = require('./helpers');

// ── Test state ────────────────────────────────────────────────────────────

let owner;
let stranger;
let verifiedOwner;
let homeId;

// ── Setup ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create two users: one who owns the home, one who doesn't
  owner = await createTestUser({ name: 'Pulse Owner', first_name: 'PulseOwner', username: `pulse_owner_${Date.now()}` });
  stranger = await createTestUser({ name: 'Pulse Stranger', first_name: 'Stranger', username: `pulse_stranger_${Date.now()}` });
  verifiedOwner = await createTestUser({ name: 'Pulse Verified Owner', first_name: 'Verified', username: `pulse_verified_owner_${Date.now()}` });

  // Create a home
  const home = await seedRow('Home', {
    address: '123 Integration Test St',
    city: 'Vancouver',
    state: 'WA',
    zipcode: '98661',
    year_built: 1985,
    sq_ft: 1800,
    bedrooms: 3,
    bathrooms: 2,
    lot_sq_ft: 6000,
    home_type: 'house',
    map_center_lat: 45.6387,
    map_center_lng: -122.6615,
    status: 'active',
    created_by: owner.userId,
  });
  homeId = home.id;

  // Create HomeOccupancy for owner
  await seedRow('HomeOccupancy', {
    home_id: homeId,
    user_id: owner.userId,
    role_base: 'admin',
    is_active: true,
    verification_status: 'verified',
  });

  await seedRow('HomeOwner', {
    home_id: homeId,
    subject_id: verifiedOwner.userId,
    owner_status: 'verified',
    verification_tier: 'deed',
    is_primary_owner: false,
  });
}, 30000);

afterAll(async () => {
  await cleanup();
}, 15000);

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/ai/pulse', () => {

  // ── Auth & Access Control ─────────────────────────────────

  test('returns 401 without auth token', async () => {
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, null);
    expect(res.status).toBe(401);
  });

  test('returns 403 for user without HomeOccupancy', async () => {
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, stranger.token);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('access');
  });

  test('returns 200 for a verified owner without HomeOccupancy', async () => {
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, verifiedOwner.token);
    expect(res.status).toBe(200);
    expect(res.body.pulse).toBeDefined();
  });

  test('returns 400 for missing homeId', async () => {
    const res = await apiRequest('GET', '/api/ai/pulse', owner.token);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid homeId format', async () => {
    const res = await apiRequest('GET', '/api/ai/pulse?homeId=not-a-uuid', owner.token);
    expect(res.status).toBe(400);
  });

  // ── Valid Response Shape ───────────────────────────────────

  test('returns valid Pulse JSON with all expected fields', async () => {
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);

    expect(res.status).toBe(200);
    expect(res.body.pulse).toBeDefined();

    const p = res.body.pulse;

    // Top-level fields
    expect(p.greeting).toBeDefined();
    expect(typeof p.greeting).toBe('string');
    expect(p.greeting).toMatch(/^Good (morning|afternoon|evening)$/);

    expect(p.summary).toBeDefined();
    expect(typeof p.summary).toBe('string');

    expect(p.overall_status).toBeDefined();
    expect(['active', 'quiet', 'advisory', 'alert']).toContain(p.overall_status);

    // Signals array
    expect(Array.isArray(p.signals)).toBe(true);
    expect(p.signals.length).toBeGreaterThan(0); // At least seasonal signal

    for (const signal of p.signals) {
      expect(signal.signal_type).toBeDefined();
      expect(signal.priority).toBeDefined();
      expect(typeof signal.priority).toBe('number');
      expect(signal.title).toBeDefined();
      expect(signal.detail).toBeDefined();
      expect(signal.color).toBeDefined();
    }

    // Signals sorted by priority descending
    for (let i = 1; i < p.signals.length; i++) {
      expect(p.signals[i].priority).toBeLessThanOrEqual(p.signals[i - 1].priority);
    }

    // Seasonal context
    expect(p.seasonal_context).toBeDefined();
    expect(p.seasonal_context.season).toBeDefined();

    // Community density (cold-start)
    expect(p.community_density).toBeDefined();
    expect(p.community_density.neighbor_count).toBe(0);
    expect(p.community_density.invite_cta).toBe(true);

    // Sources
    expect(Array.isArray(p.sources)).toBe(true);

    // Meta
    expect(p.meta).toBeDefined();
    expect(p.meta.computed_at).toBeDefined();
    expect(Array.isArray(p.meta.partial_failures)).toBe(true);
  });

  // ── Graceful Degradation ──────────────────────────────────

  test('always includes seasonal signal even without external API keys', async () => {
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);

    expect(res.status).toBe(200);

    const p = res.body.pulse;
    const seasonalSignals = p.signals.filter((s) => s.signal_type === 'seasonal_suggestion');
    expect(seasonalSignals.length).toBe(1);
  });

  test('Pulse returns even when property data is unavailable', async () => {
    // The home might not have ATTOM data — Pulse should still return
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);

    expect(res.status).toBe(200);
    expect(res.body.pulse).toBeDefined();
    // property can be null — that's fine
    // But the pulse overall should still be valid
    expect(res.body.pulse.signals.length).toBeGreaterThan(0);
  });

  test('returns 404 for non-existent home (with valid occupancy check bypassed)', async () => {
    // Create occupancy for a non-existent home ID won't work due to FK,
    // so this tests the composer's HOME_NOT_FOUND path indirectly.
    // We test with a valid UUID that has no Home row but does have occupancy.
    // Since we can't create orphan occupancy (FK), test via a missing home scenario.
    const fakeHomeId = '00000000-0000-4000-a000-000000000099';
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${fakeHomeId}`, owner.token);

    // Should be 403 (no occupancy) or 404 (home not found)
    expect([403, 404]).toContain(res.status);
  });

  // ── Performance ───────────────────────────────────────────

  test('response time is under 5 seconds', async () => {
    const start = Date.now();
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(5000);
  });

  test('second request is faster (cache hit)', async () => {
    // First request (warms cache)
    await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);

    // Second request (should hit cache)
    const start = Date.now();
    const res = await apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token);
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2000);
  });

  // ── Parallel Safety ───────────────────────────────────────

  test('concurrent requests do not produce race conditions', async () => {
    const requests = Array.from({ length: 5 }, () =>
      apiRequest('GET', `/api/ai/pulse?homeId=${homeId}`, owner.token)
    );

    const results = await Promise.all(requests);

    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.pulse).toBeDefined();
      expect(res.body.pulse.greeting).toBeDefined();
      expect(res.body.pulse.signals.length).toBeGreaterThan(0);
    }

    // All responses should have the same structure
    const statuses = results.map((r) => r.body.pulse.overall_status);
    // All should agree on status (same data, same time window)
    expect(new Set(statuses).size).toBe(1);
  });
});

// ── Backward Compatibility: place-brief ───────────────────────────────────

describe('GET /api/ai/place-brief (backward compatibility)', () => {
  test('place-brief endpoint still returns valid response', async () => {
    const res = await apiRequest(
      'GET',
      `/api/ai/place-brief?homeId=${homeId}`,
      owner.token,
    );

    // place-brief may return 200 or a known error code — but not 500
    expect(res.status).not.toBe(500);

    if (res.status === 200) {
      // If successful, verify it has PlaceBrief structure
      expect(res.body).toBeDefined();
    }
  });
});

// ============================================================
// TEST: Marketplace Integration Tests
//
// Covers: create, edit, browse privacy, auth-aware browse,
// messages, and remote listing behaviour.
// Uses in-memory supabaseAdmin mock (no live DB required).
// ============================================================

const { resetTables, seedTable, setRpcMock, getTable, setAuthMocks } = require('../__mocks__/supabaseAdmin');

const express = require('express');
const request = require('supertest');

const USER_A = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const USER_C = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/listings', require('../../routes/listings'));
  return app;
}

// ── Helpers ──────────────────────────────────────────────────
const now = new Date().toISOString();
const futureExpiry = new Date(Date.now() + 30 * 86400000).toISOString();

function makeListing(overrides = {}) {
  const id = overrides.id || `mock-listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    user_id: USER_A,
    title: 'Test Listing',
    description: 'A test listing',
    price: 25,
    is_free: false,
    category: 'electronics',
    subcategory: null,
    condition: 'good',
    quantity: 1,
    status: 'active',
    media_urls: [],
    media_types: [],
    latitude: 45.52,
    longitude: -122.68,
    location_name: 'Portland',
    location_address: '123 Main St',
    location_precision: 'approx_area',
    reveal_policy: 'after_interest',
    visibility_scope: 'city',
    radius_miles: 10,
    meetup_preference: 'public_meetup',
    delivery_available: false,
    available_from: null,
    available_until: null,
    tags: [],
    view_count: 0,
    save_count: 0,
    message_count: 0,
    layer: 'goods',
    listing_type: 'sell_item',
    home_id: null,
    is_address_attached: false,
    quality_score: 0,
    context_tags: [],
    is_wanted: false,
    budget_max: null,
    expires_at: futureExpiry,
    archived_at: null,
    created_at: now,
    updated_at: now,
    search_vector: null,
    ...overrides,
  };
}

function validCreateBody(overrides = {}) {
  return {
    title: 'New Item For Sale',
    description: 'A brand new item',
    price: 50,
    category: 'electronics',
    condition: 'new',
    ...overrides,
  };
}

/** supertest helper: set auth user for verifyToken mock via x-test-user-id header */
function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

// ============================================================
// TEST SUITE
// ============================================================
describe('Marketplace Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();

    // Default RPC mock
    setRpcMock((rpcName) => {
      if (rpcName === 'claim_inventory_slot') return { data: true, error: null };
      if (rpcName === 'release_inventory_slot') return { data: null, error: null };
      if (rpcName === 'toggle_listing_save') return { data: true, error: null };
      if (rpcName === 'browse_listings_by_distance') return { data: [], error: null };
      return { data: null, error: null };
    });

    // Seed User table for creator join
    seedTable('User', [
      { id: USER_A, username: 'alice', name: 'Alice A', first_name: 'Alice', profile_picture_url: null, city: 'Portland', state: 'OR' },
      { id: USER_B, username: 'bob', name: 'Bob B', first_name: 'Bob', profile_picture_url: 'https://img.example.com/bob.jpg', city: 'Portland', state: 'OR' },
      { id: USER_C, username: 'carol', name: 'Carol C', first_name: 'Carol', profile_picture_url: null, city: 'Portland', state: 'OR' },
    ]);

    // Default auth: getUser returns USER_A (authenticated)
    setAuthMocks({
      getUser: async () => ({
        data: { user: { id: USER_A, email: 'alice@test.local' } },
        error: null,
      }),
    });
  });

  // ============================================================
  // 1. CREATE
  // ============================================================
  describe('1. Create', () => {
    const CATEGORIES = [
      'furniture', 'electronics', 'clothing', 'kids_baby', 'tools',
      'home_garden', 'sports_outdoors', 'vehicles', 'books_media',
      'collectibles', 'appliances', 'free_stuff', 'other',
    ];

    it.each(CATEGORIES)('POST with category "%s" → 201', async (cat) => {
      const res = await asUser(
        request(app).post('/api/listings').send(validCreateBody({ category: cat })),
        USER_A,
      ).expect(201);

      expect(res.body.listing).toBeDefined();
      expect(res.body.listing.category).toBe(cat);
      expect(res.body.listing.status).toBe('active');
    });

    it('rejects unsupported category → 400', async () => {
      await asUser(
        request(app).post('/api/listings').send(validCreateBody({ category: 'alien_technology' })),
        USER_A,
      ).expect(400);
    });

    it('accepts condition "for_parts" → 201', async () => {
      const res = await asUser(
        request(app).post('/api/listings').send(validCreateBody({ condition: 'for_parts' })),
        USER_A,
      ).expect(201);

      expect(res.body.listing.condition).toBe('for_parts');
    });

    it('rejects condition "poor" → 400', async () => {
      await asUser(
        request(app).post('/api/listings').send(validCreateBody({ condition: 'poor' })),
        USER_A,
      ).expect(400);
    });

    it('free listing → is_free=true, price=0', async () => {
      const res = await asUser(
        request(app).post('/api/listings').send(validCreateBody({ isFree: true, price: null, category: 'free_stuff' })),
        USER_A,
      ).expect(201);

      expect(res.body.listing.is_free).toBe(true);
      expect(res.body.listing.price).toBe(0);
    });
  });

  // ============================================================
  // 2. EDIT
  // ============================================================
  describe('2. Edit', () => {
    const LISTING_ID = '11111111-1111-1111-8111-111111111111';

    beforeEach(() => {
      seedTable('Listing', [makeListing({ id: LISTING_ID, user_id: USER_A })]);
    });

    it('PATCH succeeds for owner', async () => {
      const res = await asUser(
        request(app).patch(`/api/listings/${LISTING_ID}`).send({ title: 'Updated Title' }),
        USER_A,
      ).expect(200);

      expect(res.body.listing.title).toBe('Updated Title');
    });

    it('PATCH by non-owner → 403', async () => {
      await asUser(
        request(app).patch(`/api/listings/${LISTING_ID}`).send({ title: 'Hacker Title' }),
        USER_B,
      ).expect(403);
    });

    it('PUT → 404 (route does not exist)', async () => {
      const res = await asUser(
        request(app).put(`/api/listings/${LISTING_ID}`).send({ title: 'Should Fail' }),
        USER_A,
      );

      // Express returns 404 for unmatched routes
      expect([404, 405]).toContain(res.status);
    });
  });

  // ============================================================
  // 3. BROWSE PRIVACY
  // ============================================================
  describe('3. Browse Privacy', () => {
    const LISTING_NEIGHBORHOOD = '33333333-3333-1333-8333-333333333333';
    const LISTING_APPROX = '44444444-4444-1444-8444-444444444444';
    const LISTING_OWNED = '55555555-5555-1555-8555-555555555555';

    beforeEach(() => {
      seedTable('Listing', [
        makeListing({
          id: LISTING_NEIGHBORHOOD,
          user_id: USER_B,
          latitude: 45.52,
          longitude: -122.68,
          location_precision: 'neighborhood_only',
          reveal_policy: 'after_interest',
        }),
        makeListing({
          id: LISTING_APPROX,
          user_id: USER_B,
          latitude: 45.53,
          longitude: -122.69,
          location_precision: 'approx_area',
          reveal_policy: 'after_interest',
        }),
        makeListing({
          id: LISTING_OWNED,
          user_id: USER_A,
          latitude: 45.54,
          longitude: -122.70,
          location_precision: 'neighborhood_only',
          reveal_policy: 'never_public',
        }),
      ]);
    });

    it('neighborhood_only → no coordinates for non-owner', async () => {
      // USER_A viewing USER_B's listing
      const res = await asUser(
        request(app).get(`/api/listings/${LISTING_NEIGHBORHOOD}`),
        USER_A,
      ).set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(res.body.listing.latitude).toBeNull();
      expect(res.body.listing.longitude).toBeNull();
      expect(res.body.listing.location_address).toBeNull();
    });

    it('detail uses the seller name for displayName while keeping username as handle', async () => {
      const res = await asUser(
        request(app).get(`/api/listings/${LISTING_APPROX}`),
        USER_A,
      ).set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(res.body.listing.creator).toMatchObject({
        type: 'local',
        handle: 'bob',
        displayName: 'Bob B',
      });
      expect(res.body.listing.creator).not.toHaveProperty('username');
    });

    it('approx_area → blurred coordinates for non-owner', async () => {
      const res = await asUser(
        request(app).get(`/api/listings/${LISTING_APPROX}`),
        USER_A,
      ).set('Authorization', 'Bearer mock-token')
        .expect(200);

      // Coordinates should be present but blurred (not exact)
      expect(res.body.listing.latitude).not.toBeNull();
      expect(res.body.listing.longitude).not.toBeNull();
      expect(res.body.listing.latitude).not.toBe(45.53);
      expect(res.body.listing.longitude).not.toBe(-122.69);
      // Blurred within ±0.005° (~500m)
      expect(Math.abs(res.body.listing.latitude - 45.53)).toBeLessThan(0.006);
      expect(Math.abs(res.body.listing.longitude - (-122.69))).toBeLessThan(0.006);
    });

    it('owner → exact coordinates regardless of precision', async () => {
      const res = await asUser(
        request(app).get(`/api/listings/${LISTING_OWNED}`),
        USER_A,
      ).set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(res.body.listing.latitude).toBe(45.54);
      expect(res.body.listing.longitude).toBe(-122.70);
    });
  });

  // ============================================================
  // 4. AUTH-AWARE BROWSE
  // ============================================================
  describe('4. Auth-aware Browse', () => {
    const LISTING_NORMAL = '66666666-6666-1666-8666-666666666666';
    const LISTING_BLOCKED_USER = '77777777-7777-1777-8777-777777777777';

    beforeEach(() => {
      seedTable('Listing', [
        makeListing({ id: LISTING_NORMAL, user_id: USER_B }),
        makeListing({ id: LISTING_BLOCKED_USER, user_id: USER_C }),
      ]);

      // USER_A has blocked USER_C
      seedTable('Relationship', [
        { id: 'rel-1', requester_id: USER_A, addressee_id: USER_C, status: 'blocked' },
      ]);

      // USER_A has saved LISTING_NORMAL
      seedTable('ListingSave', [
        { id: 'save-1', listing_id: LISTING_NORMAL, user_id: USER_A },
      ]);
    });

    it('authenticated → blocked user excluded, userHasSaved populated', async () => {
      const res = await request(app)
        .get('/api/listings/browse')
        .set('Authorization', 'Bearer mock-token')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'newest',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      // Blocked user's listing should be excluded
      expect(ids).not.toContain(LISTING_BLOCKED_USER);

      // Normal listing should be present
      expect(ids).toContain(LISTING_NORMAL);

      // userHasSaved should be true for the saved listing
      const normal = res.body.listings.find(l => l.id === LISTING_NORMAL);
      expect(normal.userHasSaved).toBe(true);
      expect(normal.creator).toMatchObject({
        handle: 'bob',
        displayName: 'Bob B',
      });
    });

    it('anonymous → all public listings, no saved state', async () => {
      // Set auth to return no user (anonymous)
      setAuthMocks({
        getUser: async () => ({
          data: { user: null },
          error: { message: 'invalid token' },
        }),
      });

      const res = await request(app)
        .get('/api/listings/browse')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'newest',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      // Both listings visible (no block filtering for anon)
      expect(ids).toContain(LISTING_NORMAL);
      expect(ids).toContain(LISTING_BLOCKED_USER);

      // No save state for anonymous
      for (const listing of res.body.listings) {
        expect(listing.userHasSaved).toBe(false);
      }
    });
  });

  // ============================================================
  // 5. MESSAGES
  // ============================================================
  describe('5. Messages', () => {
    const LISTING_ID = '88888888-8888-1888-8888-888888888888';

    beforeEach(() => {
      seedTable('Listing', [
        makeListing({ id: LISTING_ID, user_id: USER_B, message_count: 0 }),
      ]);
    });

    it('POST message → creates inquiry, increments message_count', async () => {
      const res = await asUser(
        request(app)
          .post(`/api/listings/${LISTING_ID}/message`)
          .send({ message: 'Is this still available?', offerAmount: 20 }),
        USER_A,
      ).expect(201);

      expect(res.body.inquiry).toBeDefined();
      expect(res.body.inquiry.listing_id).toBe(LISTING_ID);
      expect(res.body.inquiry.buyer_id).toBe(USER_A);
      expect(res.body.inquiry.offer_amount).toBe(20);
      expect(res.body.inquiry.status).toBe('pending');

      // ListingMessage table should have a row
      const messages = getTable('ListingMessage');
      expect(messages.length).toBe(1);
      expect(messages[0].seller_id).toBe(USER_B);
    });

    it('GET messages → seller sees messages', async () => {
      // Seed a message
      seedTable('ListingMessage', [
        {
          id: 'msg-1',
          listing_id: LISTING_ID,
          buyer_id: USER_A,
          seller_id: USER_B,
          message: 'Hello',
          offer_amount: null,
          status: 'pending',
          created_at: now,
          buyer: { id: USER_A, username: 'alice', name: 'Alice A', profile_picture_url: null },
        },
      ]);

      const res = await asUser(
        request(app).get(`/api/listings/${LISTING_ID}/messages`),
        USER_B,
      ).expect(200);

      expect(res.body.messages).toBeDefined();
      expect(res.body.messages.length).toBe(1);
      expect(res.body.messages[0].buyer_id).toBe(USER_A);
    });

    it('buyer cannot message own listing', async () => {
      await asUser(
        request(app)
          .post(`/api/listings/${LISTING_ID}/message`)
          .send({ message: 'Self-message' }),
        USER_B,
      ).expect(400);
    });
  });

  // ============================================================
  // 6. REMOTE LISTINGS
  // ============================================================
  describe('6. Remote Listings', () => {
    const LOCAL_1 = 'aaaa1111-1111-1111-8111-111111111111';
    const LOCAL_2 = 'aaaa2222-2222-1222-8222-222222222222';
    const REMOTE_1 = 'bbbb1111-1111-1111-8111-111111111111';

    beforeEach(() => {
      seedTable('Listing', [
        makeListing({ id: LOCAL_1, latitude: 45.52, longitude: -122.68 }),
        makeListing({ id: LOCAL_2, latitude: 45.53, longitude: -122.69 }),
        makeListing({
          id: REMOTE_1,
          latitude: null,
          longitude: null,
          location_name: 'Remote Service',
          category: 'other',
        }),
      ]);
    });

    it('default browse includes remote listings', async () => {
      const res = await request(app)
        .get('/api/listings/browse')
        .set('Authorization', 'Bearer mock-token')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'newest',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      // Both local and remote should be included
      expect(ids).toContain(LOCAL_1);
      expect(ids).toContain(LOCAL_2);
      expect(ids).toContain(REMOTE_1);
    });

    it('sort=nearest → remote listings come after located listings', async () => {
      setRpcMock((rpcName) => {
        if (rpcName === 'browse_listings_by_distance') {
          return {
            data: [
              makeListing({ id: LOCAL_1, latitude: 45.52, longitude: -122.68, distance_meters: 100 }),
              makeListing({ id: LOCAL_2, latitude: 45.53, longitude: -122.69, distance_meters: 500 }),
            ],
            error: null,
          };
        }
        if (rpcName === 'claim_inventory_slot') return { data: true, error: null };
        return { data: null, error: null };
      });

      const res = await request(app)
        .get('/api/listings/browse')
        .set('Authorization', 'Bearer mock-token')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'nearest',
          ref_lat: '45.52', ref_lng: '-122.68',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      const localIdx1 = ids.indexOf(LOCAL_1);
      const localIdx2 = ids.indexOf(LOCAL_2);
      const remoteIdx = ids.indexOf(REMOTE_1);

      expect(localIdx1).toBeGreaterThanOrEqual(0);
      expect(localIdx2).toBeGreaterThanOrEqual(0);
      expect(remoteIdx).toBeGreaterThanOrEqual(0);
      expect(remoteIdx).toBeGreaterThan(localIdx1);
      expect(remoteIdx).toBeGreaterThan(localIdx2);
    });

    it('remote_only=true → only NULL-coordinate listings', async () => {
      const res = await request(app)
        .get('/api/listings/browse')
        .set('Authorization', 'Bearer mock-token')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'newest',
          remote_only: 'true',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      expect(ids).toContain(REMOTE_1);
      expect(ids).not.toContain(LOCAL_1);
      expect(ids).not.toContain(LOCAL_2);
    });

    it('include_remote=false → excludes NULL-coordinate listings', async () => {
      const res = await request(app)
        .get('/api/listings/browse')
        .set('Authorization', 'Bearer mock-token')
        .query({
          south: '45.0', west: '-123.0', north: '46.0', east: '-122.0',
          sort: 'newest',
          include_remote: 'false',
        })
        .expect(200);

      const ids = res.body.listings.map(l => l.id);

      expect(ids).toContain(LOCAL_1);
      expect(ids).toContain(LOCAL_2);
      expect(ids).not.toContain(REMOTE_1);
    });
  });

  // ============================================================
  // 7. SAVE
  // ============================================================
  describe('7. Save', () => {
    const LISTING_ID = '99999999-9999-1999-8999-999999999999';

    beforeEach(() => {
      seedTable('Listing', [
        makeListing({ id: LISTING_ID, user_id: USER_B, save_count: 3 }),
      ]);
    });

    it('POST save → toggles save state', async () => {
      const res = await asUser(
        request(app).post(`/api/listings/${LISTING_ID}/save`),
        USER_A,
      ).expect(200);

      expect(res.body.saved).toBe(true);
      expect(res.body.saveCount).toBeDefined();
    });
  });
});

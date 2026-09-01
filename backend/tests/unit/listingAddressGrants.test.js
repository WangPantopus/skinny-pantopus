// ============================================================
// TEST: Listing Address Grants – reveal, list, revoke endpoints
//
// Route-level integration tests using the in-memory supabase mock.
// ============================================================

const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

// The moduleNameMapper in jest.config.js handles: supabaseAdmin, supabase,
// logger, verifyToken, and notificationService. We only need jest.mock for
// modules NOT covered by the mapper.

// Make the notification mock return a promise (the route calls .catch() on it)
const notificationMock = require('../__mocks__/notificationService');

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'] };
  }
  next();
});

jest.mock('../../services/marketplace/marketplaceService', () => ({
  browseListings: jest.fn().mockResolvedValue({ data: [], count: 0 }),
  discoverListings: jest.fn().mockResolvedValue({ data: [], count: 0 }),
  searchListings: jest.fn().mockResolvedValue({ data: [], count: 0 }),
  autocompleteListings: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../services/marketplace/locationPrivacy', () => ({
  applyLocationPrivacy: jest.fn((listing) => listing),
  applyLocationPrivacyBatch: jest.fn((listings) => listings),
}));

const express = require('express');
const request = require('supertest');

const AUTHOR_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const BUYER_ID  = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const OTHER_ID  = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const LISTING_ID = '11111111-1111-4111-8111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/listings', require('../../routes/listings'));
  return app;
}

function seedListing(overrides = {}) {
  seedTable('Listing', [{
    id: LISTING_ID,
    user_id: AUTHOR_ID,
    title: 'Test Listing',
    location_address: '123 Main St',
    exact_address: '123 Main St, Portland, OR',
    location_name: 'Downtown Portland',
    latitude: 45.5,
    longitude: -122.6,
    status: 'active',
    listing_layer: 'goods',
    listing_type: 'sell_item',
    category: 'electronics',
    ...overrides,
  }]);
}

// ── POST /api/listings/:id/reveal-address ───────────────

describe('POST /api/listings/:id/reveal-address', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    resetTables();
    notificationMock.createNotification.mockReturnValue(Promise.resolve());
    notificationMock.notifyAddressRevealed.mockClear();
  });

  it('allows author to reveal address to buyer', async () => {
    seedListing();
    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({ userId: BUYER_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const grants = getTable('ListingAddressGrant');
    expect(grants).toHaveLength(1);
    expect(grants[0].listing_id).toBe(LISTING_ID);
    expect(grants[0].grantee_user_id).toBe(BUYER_ID);
    expect(grants[0].granted_by).toBe(AUTHOR_ID);
  });

  it('rejects when userId is missing', async () => {
    seedListing();
    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId is required/i);
  });

  it('rejects self-reveal', async () => {
    seedListing();
    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({ userId: AUTHOR_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });

  it('returns 404 for non-existent listing', async () => {
    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({ userId: BUYER_ID });

    expect(res.status).toBe(404);
  });

  it('returns 403 when non-author tries to reveal', async () => {
    seedListing();
    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', OTHER_ID)
      .send({ userId: BUYER_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the listing author/i);
  });

  it('is idempotent (double reveal succeeds)', async () => {
    seedListing();
    seedTable('ConversationTopic', [
      {
        id: 'topic-1',
        conversation_user_id_1: AUTHOR_ID,
        conversation_user_id_2: BUYER_ID,
        topic_type: 'listing',
        topic_ref_id: LISTING_ID,
        status: 'active',
      },
    ]);
    seedTable('ChatParticipant', [
      { id: 'cp-1', room_id: 'room-1', user_id: AUTHOR_ID },
      { id: 'cp-2', room_id: 'room-1', user_id: BUYER_ID },
    ]);

    await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({ userId: BUYER_ID });

    const res = await request(app)
      .post(`/api/listings/${LISTING_ID}/reveal-address`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({ userId: BUYER_ID });

    // Second reveal should still succeed (real DB upsert deduplicates
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/already available/i);
    expect(getTable('ListingAddressGrant')).toHaveLength(1);
    expect(getTable('ChatMessage')).toHaveLength(1);
    expect(notificationMock.notifyAddressRevealed).toHaveBeenCalledTimes(1);
  });
});

// ── GET /api/listings/:id/address-grants ────────────────

describe('GET /api/listings/:id/address-grants', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    resetTables();
    notificationMock.createNotification.mockReturnValue(Promise.resolve());
  });

  it('author can list grants', async () => {
    seedListing();
    seedTable('ListingAddressGrant', [
      { id: 'g1', listing_id: LISTING_ID, grantee_user_id: BUYER_ID, granted_by: AUTHOR_ID, granted_at: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get(`/api/listings/${LISTING_ID}/address-grants`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(200);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0].grantee_user_id).toBe(BUYER_ID);
  });

  it('returns empty array when no grants exist', async () => {
    seedListing();
    const res = await request(app)
      .get(`/api/listings/${LISTING_ID}/address-grants`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(200);
    expect(res.body.grants).toEqual([]);
  });

  it('returns 403 for non-author', async () => {
    seedListing();
    const res = await request(app)
      .get(`/api/listings/${LISTING_ID}/address-grants`)
      .set('x-test-user-id', OTHER_ID);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent listing', async () => {
    const res = await request(app)
      .get(`/api/listings/${LISTING_ID}/address-grants`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/listings/:id/address-grants/:userId ─────

describe('DELETE /api/listings/:id/address-grants/:userId', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    resetTables();
    notificationMock.createNotification.mockReturnValue(Promise.resolve());
  });

  it('author can revoke a grant', async () => {
    seedListing();
    seedTable('ListingAddressGrant', [
      { id: 'g1', listing_id: LISTING_ID, grantee_user_id: BUYER_ID, granted_by: AUTHOR_ID },
    ]);

    const res = await request(app)
      .delete(`/api/listings/${LISTING_ID}/address-grants/${BUYER_ID}`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const grants = getTable('ListingAddressGrant');
    expect(grants).toHaveLength(0);
  });

  it('returns 403 for non-author', async () => {
    seedListing();
    const res = await request(app)
      .delete(`/api/listings/${LISTING_ID}/address-grants/${BUYER_ID}`)
      .set('x-test-user-id', OTHER_ID);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent listing', async () => {
    const res = await request(app)
      .delete(`/api/listings/${LISTING_ID}/address-grants/${BUYER_ID}`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(404);
  });

  it('succeeds silently when grant does not exist', async () => {
    seedListing();
    const res = await request(app)
      .delete(`/api/listings/${LISTING_ID}/address-grants/${BUYER_ID}`)
      .set('x-test-user-id', AUTHOR_ID);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

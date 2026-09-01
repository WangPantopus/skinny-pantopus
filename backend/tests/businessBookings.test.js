// ============================================================
// TEST: Business Bookings pipeline + My businesses enrichment
//
// Drives the REAL Express handlers in routes/businesses.js via
// supertest (jest.config.js maps supabaseAdmin/verifyToken/logger to the
// in-memory mocks; checkBusinessPermission / writeAuditLog /
// getAllSeatsForUser are stubbed here). Binding to the production router
// means deleting or breaking a handler fails this suite.
//
// Covers:
//   1. POST /:businessId/catalog/:itemId/request — stores a real
//      BusinessBooking (frozen item fields, req.body.note truncation,
//      price_cents fallback, kind guard, 404 guard).
//   2. GET /:businessId/bookings — permission gate (403 before query),
//      business scoping, status allowlist (invalid ignored).
//   3. GET /my-businesses — stats / team / verification enrichment, plus
//      graceful defaults when there are no seats / chats / bookings.
//
// NOTE: the in-memory mock's .order()/.limit() are no-ops, so created_at
// DESC ordering and the limit clamp are the real Postgres query's job and
// are not asserted here.
// ============================================================

jest.mock('../utils/businessPermissions', () => ({
  ...jest.requireActual('../utils/businessPermissions'),
  checkBusinessPermission: jest.fn(),
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/seatPermissions', () => ({
  ...jest.requireActual('../utils/seatPermissions'),
  getAllSeatsForUser: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { checkBusinessPermission } = require('../utils/businessPermissions');
const { getAllSeatsForUser } = require('../utils/seatPermissions');
const businessesRoutes = require('../routes/businesses');

const BIZ = 'biz-1';
const OTHER_BIZ = 'biz-2';
const CUSTOMER = 'cust-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/businesses', businessesRoutes);
  return app;
}

const recentISO = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const oldISO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  resetTables();
  checkBusinessPermission.mockResolvedValue({ hasAccess: true, isOwner: true, roleBase: 'owner' });
  getAllSeatsForUser.mockResolvedValue([]);
});

// ── POST /:businessId/catalog/:itemId/request ────────────────

describe('Catalog booking request', () => {
  function seedServiceItem(extra = {}) {
    seedTable('BusinessCatalogItem', [
      { id: 'item-1', business_user_id: BIZ, name: 'Deep Clean', description: 'Full home', kind: 'service', price_cents: 12000, price_unit: 'flat', status: 'active', ...extra },
    ]);
    seedTable('User', [{ id: BIZ, name: 'Sparkle Co' }]);
    seedTable('BusinessProfile', [{ business_user_id: BIZ, avg_response_minutes: 30 }]);
    seedTable('BusinessBooking', []);
  }

  test('stores a pending BusinessBooking with frozen fields + body note', async () => {
    seedServiceItem();
    const res = await request(buildApp())
      .post(`/api/businesses/${BIZ}/catalog/item-1/request`)
      .set('x-test-user-id', CUSTOMER)
      .send({ note: 'Tuesday please' });

    expect(res.status).toBe(201);
    expect(res.body.booking_id).toBeTruthy();
    expect(res.body.item_name).toBe('Deep Clean');
    expect(res.body.business_name).toBe('Sparkle Co');
    expect(res.body.avg_response_minutes).toBe(30);

    const rows = getTable('BusinessBooking');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      business_user_id: BIZ,
      requester_id: CUSTOMER,
      catalog_item_id: 'item-1',
      item_name: 'Deep Clean',
      price_cents: 12000,
      note: 'Tuesday please',
      status: 'pending',
    });
  });

  test('truncates an over-long note to 1000 chars and tolerates missing price', async () => {
    seedServiceItem({ price_cents: null });
    const res = await request(buildApp())
      .post(`/api/businesses/${BIZ}/catalog/item-1/request`)
      .set('x-test-user-id', CUSTOMER)
      .send({ note: 'x'.repeat(1500) });

    expect(res.status).toBe(201);
    const row = getTable('BusinessBooking')[0];
    expect(row.note).toHaveLength(1000);
    expect(row.price_cents).toBeNull();
  });

  test('no note → stores null note', async () => {
    seedServiceItem();
    await request(buildApp())
      .post(`/api/businesses/${BIZ}/catalog/item-1/request`)
      .set('x-test-user-id', CUSTOMER)
      .send({});
    expect(getTable('BusinessBooking')[0].note).toBeNull();
  });

  test('rejects non-service/class items with 400 and stores nothing', async () => {
    seedServiceItem({ kind: 'product' });
    const res = await request(buildApp())
      .post(`/api/businesses/${BIZ}/catalog/item-1/request`)
      .set('x-test-user-id', CUSTOMER)
      .send({});
    expect(res.status).toBe(400);
    expect(getTable('BusinessBooking')).toHaveLength(0);
  });

  test('missing/inactive item → 404 and stores nothing', async () => {
    seedTable('BusinessCatalogItem', []);
    seedTable('BusinessBooking', []);
    const res = await request(buildApp())
      .post(`/api/businesses/${BIZ}/catalog/item-1/request`)
      .set('x-test-user-id', CUSTOMER)
      .send({});
    expect(res.status).toBe(404);
    expect(getTable('BusinessBooking')).toHaveLength(0);
  });
});

// ── GET /:businessId/bookings ────────────────────────────────

describe('Bookings list', () => {
  function seedBookings() {
    seedTable('BusinessBooking', [
      { id: 'b1', business_user_id: BIZ, requester_id: CUSTOMER, item_name: 'A', status: 'pending', created_at: '2026-06-01T00:00:00Z' },
      { id: 'b2', business_user_id: BIZ, requester_id: CUSTOMER, item_name: 'B', status: 'accepted', created_at: '2026-06-10T00:00:00Z' },
      { id: 'b3', business_user_id: OTHER_BIZ, requester_id: CUSTOMER, item_name: 'C', status: 'pending', created_at: '2026-06-09T00:00:00Z' },
    ]);
  }

  test('403 (before any query) when the caller lacks access', async () => {
    seedBookings();
    checkBusinessPermission.mockResolvedValue({ hasAccess: false });
    const res = await request(buildApp())
      .get(`/api/businesses/${BIZ}/bookings`)
      .set('x-test-user-id', 'stranger');
    expect(res.status).toBe(403);
    expect(res.body.bookings).toBeUndefined();
  });

  test('returns only this business\'s bookings', async () => {
    seedBookings();
    const res = await request(buildApp())
      .get(`/api/businesses/${BIZ}/bookings`)
      .set('x-test-user-id', CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.bookings.map((b) => b.id).sort()).toEqual(['b1', 'b2']); // OTHER_BIZ excluded
  });

  test('applies a valid status filter', async () => {
    seedBookings();
    const res = await request(buildApp())
      .get(`/api/businesses/${BIZ}/bookings?status=pending`)
      .set('x-test-user-id', CUSTOMER);
    expect(res.body.bookings.map((b) => b.id)).toEqual(['b1']);
  });

  test('ignores an invalid status (allowlist) and returns all scoped rows', async () => {
    seedBookings();
    const res = await request(buildApp())
      .get(`/api/businesses/${BIZ}/bookings?status=garbage`)
      .set('x-test-user-id', CUSTOMER);
    expect(res.body.bookings.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });
});

// ── GET /my-businesses (enrichment) ──────────────────────────

describe('My businesses enrichment', () => {
  test('projects rating, verification tier, team chips, and stats', async () => {
    getAllSeatsForUser.mockResolvedValue([
      { seat_id: 'seat-1', role_base: 'owner', display_name: 'Founder', business_user_id: BIZ, business_username: 'big', business_name: 'Big Tree' },
    ]);
    seedTable('User', [
      { id: BIZ, username: 'big', name: 'Big Tree Handyman', profile_picture_url: null, account_type: 'business', city: 'Elm Park', state: 'NY', average_rating: 4.9, review_count: 218 },
    ]);
    seedTable('BusinessProfile', [
      { business_user_id: BIZ, business_type: 'home_services', categories: ['handyman'], is_published: true, logo_file_id: null, banner_file_id: null, description: 'Local crew', identity_verification_tier: 'bi3_documented' },
    ]);
    seedTable('BusinessSeat', [
      { business_user_id: BIZ, display_name: 'Mary Jones', display_avatar_file_id: 'file-1', is_active: true, created_at: '2026-01-01T00:00:00Z' },
      { business_user_id: BIZ, display_name: 'Alex Kim', display_avatar_file_id: null, is_active: true, created_at: '2026-01-02T00:00:00Z' },
      { business_user_id: BIZ, display_name: 'Pat', display_avatar_file_id: null, is_active: true, created_at: '2026-01-03T00:00:00Z' },
      { business_user_id: BIZ, display_name: 'Dev Rao', display_avatar_file_id: null, is_active: true, created_at: '2026-01-04T00:00:00Z' },
      { business_user_id: BIZ, display_name: 'Inactive', display_avatar_file_id: null, is_active: false, created_at: '2026-01-05T00:00:00Z' },
    ]);
    seedTable('ChatParticipant', [
      { user_id: BIZ, is_active: true, unread_count: 3 },
      { user_id: BIZ, is_active: true, unread_count: 1 },
      { user_id: BIZ, is_active: true, unread_count: 0 }, // read — excluded
      { user_id: BIZ, is_active: false, unread_count: 5 }, // inactive — excluded
    ]);
    seedTable('BusinessBooking', [
      { id: 'k1', business_user_id: BIZ, created_at: recentISO() },
      { id: 'k2', business_user_id: BIZ, created_at: recentISO() },
      { id: 'k3', business_user_id: BIZ, created_at: oldISO() }, // outside 7d — excluded
    ]);

    const res = await request(buildApp())
      .get('/api/businesses/my-businesses')
      .set('x-test-user-id', 'me');

    expect(res.status).toBe(200);
    const row = res.body.businesses.find((b) => b.business_user_id === BIZ);
    expect(row.business.average_rating).toBe(4.9);
    expect(row.business.review_count).toBe(218);
    expect(row.profile.identity_verification_tier).toBe('bi3_documented');
    expect(row.stats).toEqual({ open_chats: 2, bookings_this_week: 2 });
    expect(row.team.count).toBe(4); // inactive seat excluded
    expect(row.team.members).toHaveLength(3); // capped at 3
    expect(row.team.members[0]).toEqual({ name: 'Mary Jones', initials: 'MJ', avatar_file_id: 'file-1' });
    expect(row.team.members[2]).toEqual({ name: 'Pat', initials: 'PA', avatar_file_id: null }); // single word → first 2 letters
  });

  test('defaults team/stats to zero when there are no seats, chats, or bookings', async () => {
    getAllSeatsForUser.mockResolvedValue([
      { seat_id: 'seat-1', role_base: 'owner', display_name: null, business_user_id: BIZ, business_username: 'solo', business_name: 'Solo Shop' },
    ]);
    seedTable('User', [{ id: BIZ, username: 'solo', name: 'Solo Shop', account_type: 'business', city: 'Reno', state: 'NV' }]);
    seedTable('BusinessProfile', []);
    seedTable('BusinessSeat', []);
    seedTable('ChatParticipant', []);
    seedTable('BusinessBooking', []);

    const res = await request(buildApp())
      .get('/api/businesses/my-businesses')
      .set('x-test-user-id', 'me');

    expect(res.status).toBe(200);
    const row = res.body.businesses.find((b) => b.business_user_id === BIZ);
    expect(row.team).toEqual({ count: 0, members: [] });
    expect(row.stats).toEqual({ open_chats: 0, bookings_this_week: 0 });
    expect(row.profile).toBeNull();
  });
});

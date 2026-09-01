// ============================================================
// TEST: Dismiss & Hidden Categories Routes
//
// Unit tests for POST/DELETE /:gigId/dismiss and
// GET/POST/DELETE /hidden-categories endpoints in routes/gigs.js.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Mock verifyToken ─────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: 'user' };
  } else {
    req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  }
  next();
});

// ── Mock services used by gigs router ─────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
  createBulkNotifications: jest.fn(),
  notifyBidReceived: jest.fn(),
  notifyBidAccepted: jest.fn(),
}));

jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]),
  getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntent: jest.fn(),
  capturePayment: jest.fn(),
  refundPayment: jest.fn(),
}));

jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: { PENDING: 'pending', CAPTURED: 'captured', REFUNDED: 'refunded' },
}));

jest.mock('../../services/gig/browseCacheService', () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  invalidateNear: jest.fn(),
}));

jest.mock('../../services/gig/affinityService', () => ({
  recordInteraction: jest.fn().mockResolvedValue(undefined),
  getUserAffinities: jest.fn().mockResolvedValue([]),
  getCategoryAffinity: jest.fn().mockResolvedValue(0),
  computeScore: jest.fn().mockReturnValue(0),
}));

jest.mock('../../services/gig/rankingService', () => ({
  rankGigs: jest.fn((gigs) => gigs),
  computeRelevanceScore: jest.fn().mockReturnValue(50),
  computeCategoryMedians: jest.fn().mockReturnValue(new Map()),
  buildAffinityLookup: jest.fn().mockReturnValue({ byCategory: new Map(), topScore: 0 }),
}));

const express = require('express');
const request = require('supertest');
const affinityService = require('../../services/gig/affinityService');

// ── Constants ────────────────────────────────────────────────
const USER_1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const USER_2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const GIG_1 = 'gig-11111111-1111-1111-1111-111111111111';
const GIG_2 = 'gig-22222222-2222-2222-2222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

function seedGigs() {
  seedTable('Gig', [
    {
      id: GIG_1,
      title: 'Clean the yard',
      category: 'Cleaning',
      status: 'open',
      price: 50,
      poster_id: USER_2,
      created_at: '2026-03-01T00:00:00Z',
    },
    {
      id: GIG_2,
      title: 'Walk the dog',
      category: 'Pet Care',
      status: 'open',
      price: 30,
      poster_id: USER_2,
      created_at: '2026-03-01T00:00:00Z',
    },
  ]);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedGigs();
  seedTable('dismissed_gigs', []);
  seedTable('user_hidden_categories', []);
});

// ─── POST /:gigId/dismiss ────────────────────────────────────

describe('POST /api/gigs/:gigId/dismiss', () => {
  it('dismisses a gig and returns success', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify dismissal was stored
    const dismissed = getTable('dismissed_gigs');
    expect(dismissed.length).toBe(1);
    expect(dismissed[0].user_id).toBe(USER_1);
    expect(dismissed[0].gig_id).toBe(GIG_1);
  });

  it('stores reason when provided', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({ reason: 'Too far away' });

    expect(res.status).toBe(200);
    const dismissed = getTable('dismissed_gigs');
    expect(dismissed[0].reason).toBe('Too far away');
  });

  it('records affinity interaction for dismiss', async () => {
    const app = createApp();

    await request(app)
      .post(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({});

    expect(affinityService.recordInteraction).toHaveBeenCalledWith(
      USER_1,
      'Cleaning',
      'dismiss'
    );
  });

  it('returns 404 for non-existent gig', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/gigs/nonexistent-id/dismiss')
      .set('x-test-user-id', USER_1)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('can dismiss multiple gigs for the same user', async () => {
    const app = createApp();

    await request(app)
      .post(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({});

    await request(app)
      .post(`/api/gigs/${GIG_2}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({});

    const dismissed = getTable('dismissed_gigs');
    expect(dismissed.length).toBe(2);
  });
});

// ─── DELETE /:gigId/dismiss ──────────────────────────────────

describe('DELETE /api/gigs/:gigId/dismiss', () => {
  it('removes a dismissal and returns success', async () => {
    const app = createApp();

    // First dismiss
    seedTable('dismissed_gigs', [
      { id: 'dismiss-1', user_id: USER_1, gig_id: GIG_1, dismissed_at: '2026-03-01T00:00:00Z' },
    ]);

    const res = await request(app)
      .delete(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dismissed = getTable('dismissed_gigs');
    expect(dismissed.length).toBe(0);
  });

  it('succeeds even if gig was not dismissed', async () => {
    const app = createApp();

    const res = await request(app)
      .delete(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('only removes dismissal for the requesting user', async () => {
    const app = createApp();

    seedTable('dismissed_gigs', [
      { id: 'dismiss-1', user_id: USER_1, gig_id: GIG_1, dismissed_at: '2026-03-01T00:00:00Z' },
      { id: 'dismiss-2', user_id: USER_2, gig_id: GIG_1, dismissed_at: '2026-03-01T00:00:00Z' },
    ]);

    await request(app)
      .delete(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1);

    const dismissed = getTable('dismissed_gigs');
    expect(dismissed.length).toBe(1);
    expect(dismissed[0].user_id).toBe(USER_2);
  });
});

// ─── GET /hidden-categories ──────────────────────────────────

describe('GET /api/gigs/hidden-categories', () => {
  it('returns empty array when no categories hidden', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });

  it('returns hidden categories for the user', async () => {
    const app = createApp();

    seedTable('user_hidden_categories', [
      { id: 'hc-1', user_id: USER_1, category: 'Cleaning', hidden_at: '2026-03-01T00:00:00Z' },
      { id: 'hc-2', user_id: USER_1, category: 'Moving', hidden_at: '2026-03-01T00:00:00Z' },
    ]);

    const res = await request(app)
      .get('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.categories).toContain('Cleaning');
    expect(res.body.categories).toContain('Moving');
    expect(res.body.categories.length).toBe(2);
  });

  it('does not return other users hidden categories', async () => {
    const app = createApp();

    seedTable('user_hidden_categories', [
      { id: 'hc-1', user_id: USER_1, category: 'Cleaning', hidden_at: '2026-03-01T00:00:00Z' },
      { id: 'hc-2', user_id: USER_2, category: 'Moving', hidden_at: '2026-03-01T00:00:00Z' },
    ]);

    const res = await request(app)
      .get('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual(['Cleaning']);
  });
});

// ─── POST /hidden-categories ─────────────────────────────────

describe('POST /api/gigs/hidden-categories', () => {
  it('hides a category and returns success', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1)
      .send({ category: 'Cleaning' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const hidden = getTable('user_hidden_categories');
    expect(hidden.length).toBe(1);
    expect(hidden[0].category).toBe('Cleaning');
    expect(hidden[0].user_id).toBe(USER_1);
  });

  it('returns 400 when category is missing', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/i);
  });

  it('returns 400 when category is not a string', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1)
      .send({ category: 123 });

    expect(res.status).toBe(400);
  });

  it('trims whitespace from category', async () => {
    const app = createApp();

    await request(app)
      .post('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1)
      .send({ category: '  Cleaning  ' });

    const hidden = getTable('user_hidden_categories');
    expect(hidden[0].category).toBe('Cleaning');
  });
});

// ─── DELETE /hidden-categories/:category ─────────────────────

describe('DELETE /api/gigs/hidden-categories/:category', () => {
  it('unhides a category and returns success', async () => {
    const app = createApp();

    seedTable('user_hidden_categories', [
      { id: 'hc-1', user_id: USER_1, category: 'Cleaning', hidden_at: '2026-03-01T00:00:00Z' },
    ]);

    const res = await request(app)
      .delete('/api/gigs/hidden-categories/Cleaning')
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const hidden = getTable('user_hidden_categories');
    expect(hidden.length).toBe(0);
  });

  it('succeeds even if category was not hidden', async () => {
    const app = createApp();

    const res = await request(app)
      .delete('/api/gigs/hidden-categories/Cleaning')
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('only removes for the requesting user', async () => {
    const app = createApp();

    seedTable('user_hidden_categories', [
      { id: 'hc-1', user_id: USER_1, category: 'Cleaning', hidden_at: '2026-03-01T00:00:00Z' },
      { id: 'hc-2', user_id: USER_2, category: 'Cleaning', hidden_at: '2026-03-01T00:00:00Z' },
    ]);

    await request(app)
      .delete('/api/gigs/hidden-categories/Cleaning')
      .set('x-test-user-id', USER_1);

    const hidden = getTable('user_hidden_categories');
    expect(hidden.length).toBe(1);
    expect(hidden[0].user_id).toBe(USER_2);
  });
});

// ─── getUserExclusions + applyUserExclusions (via browse) ────

describe('Exclusion filtering', () => {
  it('dismiss + undismiss round-trip works', async () => {
    const app = createApp();

    // Dismiss
    let res = await request(app)
      .post(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1)
      .send({});
    expect(res.status).toBe(200);
    expect(getTable('dismissed_gigs').length).toBe(1);

    // Undismiss
    res = await request(app)
      .delete(`/api/gigs/${GIG_1}/dismiss`)
      .set('x-test-user-id', USER_1);
    expect(res.status).toBe(200);
    expect(getTable('dismissed_gigs').length).toBe(0);
  });

  it('hide + unhide category round-trip works', async () => {
    const app = createApp();

    // Hide
    let res = await request(app)
      .post('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1)
      .send({ category: 'Cleaning' });
    expect(res.status).toBe(200);

    // Verify
    res = await request(app)
      .get('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1);
    expect(res.body.categories).toContain('Cleaning');

    // Unhide
    res = await request(app)
      .delete('/api/gigs/hidden-categories/Cleaning')
      .set('x-test-user-id', USER_1);
    expect(res.status).toBe(200);

    // Verify removed
    res = await request(app)
      .get('/api/gigs/hidden-categories')
      .set('x-test-user-id', USER_1);
    expect(res.body.categories).toEqual([]);
  });
});

const {
  resetTables,
  seedTable,
  getTable,
  setAuthMocks,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../__mocks__/verifyToken', () => {
  const verifyToken = (req, res, next) => {
    const userId = req.headers['x-test-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: userId, role: 'user' };
    next();
  };

  verifyToken.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
    next();
  };

  return verifyToken;
});

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
  PAYMENT_STATES: {
    PENDING: 'pending',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    RELEASED: 'released',
    REFUNDED: 'refunded',
  },
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

const USER_1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const USER_2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const POSTER_ID = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
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
      title: 'Lawn cleanup',
      description: 'Need help cleaning up leaves and branches.',
      price: 90,
      category: 'Cleaning',
      deadline: null,
      estimated_duration: 2,
      user_id: POSTER_ID,
      poster_id: POSTER_ID,
      status: 'open',
      accepted_by: null,
      created_at: '2026-03-01T00:00:00Z',
      attachments: ['https://example.com/lawn.jpg'],
      is_urgent: false,
      tags: ['yard'],
      items: [],
      location: { latitude: 37.77, longitude: -122.42 },
      exact_address: '123 Market St',
      exact_city: 'San Francisco',
      exact_state: 'CA',
      exact_zip: '94103',
      User: {
        id: POSTER_ID,
        username: 'poster',
        name: 'Poster Person',
        first_name: 'Poster',
        last_name: 'Person',
        profile_picture_url: null,
        city: 'San Francisco',
        state: 'CA',
        account_type: 'personal',
      },
    },
    {
      id: GIG_2,
      title: 'Dog walking',
      description: 'Walk my dog this afternoon.',
      price: 35,
      category: 'Pet Care',
      user_id: POSTER_ID,
      poster_id: POSTER_ID,
      status: 'open',
      accepted_by: null,
      created_at: '2026-03-02T00:00:00Z',
      attachments: [],
      User: {
        id: POSTER_ID,
        username: 'poster',
        name: 'Poster Person',
        profile_picture_url: null,
        account_type: 'personal',
      },
    },
  ]);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedGigs();
  seedTable('GigBid', []);
  seedTable('GigSave', []);
  seedTable('GigReport', []);
  setAuthMocks({
    getUser: async () => ({
      data: { user: { id: USER_1 } },
      error: null,
    }),
  });
});

describe('POST /api/gigs/:gigId/save', () => {
  it('saves a gig for the current user', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/save`)
      .set('x-test-user-id', USER_1)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);

    const saves = getTable('GigSave');
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ gig_id: GIG_1, user_id: USER_1 });
  });

  it('is idempotent when saving the same gig twice', async () => {
    const app = createApp();

    await request(app)
      .post(`/api/gigs/${GIG_1}/save`)
      .set('x-test-user-id', USER_1)
      .send({})
      .expect(200);

    await request(app)
      .post(`/api/gigs/${GIG_1}/save`)
      .set('x-test-user-id', USER_1)
      .send({})
      .expect(200);

    expect(getTable('GigSave')).toHaveLength(1);
  });

  it('requires authentication', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/save`)
      .send({});

    expect(res.status).toBe(401);
    expect(getTable('GigSave')).toHaveLength(0);
  });
});

describe('DELETE /api/gigs/:gigId/save', () => {
  it('removes a saved gig for the current user', async () => {
    const app = createApp();
    seedTable('GigSave', [
      { id: 'save-1', gig_id: GIG_1, user_id: USER_1, created_at: '2026-03-03T00:00:00Z' },
    ]);

    const res = await request(app)
      .delete(`/api/gigs/${GIG_1}/save`)
      .set('x-test-user-id', USER_1);

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(false);
    expect(getTable('GigSave')).toHaveLength(0);
  });
});

describe('GET /api/gigs/saved', () => {
  it('returns saved gigs with viewer_has_saved and summary aliases', async () => {
    const app = createApp();
    seedTable('GigSave', [
      { id: 'save-1', gig_id: GIG_1, user_id: USER_1, created_at: '2026-03-03T00:00:00Z' },
      { id: 'save-2', gig_id: GIG_2, user_id: USER_2, created_at: '2026-03-03T00:00:00Z' },
    ]);

    const res = await request(app)
      .get('/api/gigs/saved')
      .set('x-test-user-id', USER_1)
      .expect(200);

    expect(res.body.gigs).toHaveLength(1);
    expect(res.body.gigs[0]).toMatchObject({
      id: GIG_1,
      viewer_has_saved: true,
      bid_count: 0,
      bidsCount: 0,
      first_image: 'https://example.com/lawn.jpg',
    });
  });
});

describe('POST /api/gigs/:gigId/report', () => {
  it('creates a moderation report', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/report`)
      .set('x-test-user-id', USER_1)
      .send({ reason: 'spam', details: 'Looks fraudulent' });

    expect(res.status).toBe(200);
    expect(res.body.already_reported).toBe(false);

    const reports = getTable('GigReport');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      gig_id: GIG_1,
      reported_by: USER_1,
      reason: 'spam',
      details: 'Looks fraudulent',
    });
  });

  it('is idempotent for duplicate reports by the same user', async () => {
    const app = createApp();

    await request(app)
      .post(`/api/gigs/${GIG_1}/report`)
      .set('x-test-user-id', USER_1)
      .send({ reason: 'spam' })
      .expect(200);

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/report`)
      .set('x-test-user-id', USER_1)
      .send({ reason: 'spam' });

    expect(res.status).toBe(200);
    expect(res.body.already_reported).toBe(true);
    expect(getTable('GigReport')).toHaveLength(1);
  });

  it('validates the report reason', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/report`)
      .set('x-test-user-id', USER_1)
      .send({ reason: 'not-a-real-reason' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details[0].field).toBe('reason');
  });

  it('requires authentication', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/gigs/${GIG_1}/report`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(401);
    expect(getTable('GigReport')).toHaveLength(0);
  });
});

describe('GET /api/gigs/:id', () => {
  it('includes viewer_has_saved when the viewer has already saved the gig', async () => {
    const app = createApp();
    seedTable('GigSave', [
      { id: 'save-1', gig_id: GIG_1, user_id: USER_1, created_at: '2026-03-03T00:00:00Z' },
    ]);

    const res = await request(app)
      .get(`/api/gigs/${GIG_1}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(res.body.gig.id).toBe(GIG_1);
    expect(res.body.gig.viewer_has_saved).toBe(true);
  });
});

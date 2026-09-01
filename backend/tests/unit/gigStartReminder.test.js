const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]),
  getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn(),
  createSetupIntent: jest.fn(),
  cancelAuthorization: jest.fn(),
  capturePayment: jest.fn(),
  syncPaymentAuthorizationStatus: jest.fn(),
}));

jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: {
    NONE: 'none',
    SETUP_PENDING: 'setup_pending',
    READY_TO_AUTHORIZE: 'ready_to_authorize',
    AUTHORIZE_PENDING: 'authorize_pending',
    AUTHORIZED: 'authorized',
    AUTHORIZATION_FAILED: 'authorization_failed',
    CAPTURED_HOLD: 'captured_hold',
    TRANSFER_SCHEDULED: 'transfer_scheduled',
    TRANSFER_PENDING: 'transfer_pending',
    TRANSFERRED: 'transferred',
    CANCELED: 'canceled',
  },
  getPaymentStateInfo: jest.fn(),
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
const notificationService = require('../../services/notificationService');

const POSTER_ID = 'poster-1111-1111-1111-111111111111';
const WORKER_ID = 'worker-2222-2222-2222-222222222222';
const OTHER_ID = 'other-3333-3333-3333-333333333333';
const GIG_ID = 'gig-reminder-4444-4444-4444-444444444444';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

function seedAssignedGig(overrides = {}) {
  seedTable('Gig', [
    {
      id: GIG_ID,
      title: 'Furniture assembly',
      user_id: POSTER_ID,
      poster_id: POSTER_ID,
      accepted_by: WORKER_ID,
      status: 'assigned',
      started_at: null,
      scheduled_start: '2026-03-28T18:00:00.000Z',
      ...overrides,
    },
  ]);

  seedTable('User', [
    { id: POSTER_ID, account_type: 'personal', name: 'Poster' },
    { id: WORKER_ID, account_type: 'personal', name: 'Worker' },
    { id: OTHER_ID, account_type: 'personal', name: 'Other User' },
  ]);
}

describe('POST /api/gigs/:gigId/remind-worker', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    seedAssignedGig();
    seedTable('Notification', []);
    notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
  });

  it('lets the owner send a reminder to the assigned worker', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/remind-worker`)
      .set('x-test-user-id', POSTER_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Reminder sent to the worker.');
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: WORKER_ID,
        type: 'gig_start_reminder',
        link: `/gigs/${GIG_ID}`,
        metadata: expect.objectContaining({
          gig_id: GIG_ID,
          reminder_kind: 'start_work',
          sent_by: POSTER_ID,
        }),
      })
    );
  });

  it('rejects reminder requests from non-owners', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/remind-worker`)
      .set('x-test-user-id', OTHER_ID)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Only the gig owner can remind the worker');
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('rate limits repeated reminders for the same gig', async () => {
    seedAssignedGig({ last_worker_reminder_at: new Date().toISOString() });

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/remind-worker`)
      .set('x-test-user-id', POSTER_ID)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('gig_start_reminder_rate_limited');
    expect(res.body.next_allowed_at).toBeDefined();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('persists last_worker_reminder_at on the Gig row after a successful reminder', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/remind-worker`)
      .set('x-test-user-id', POSTER_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.sent_at).toBeDefined();

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.last_worker_reminder_at).toBe(res.body.sent_at);
  });

  it('allows a reminder after the cooldown period has elapsed', async () => {
    const expired = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    seedAssignedGig({ last_worker_reminder_at: expired });

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/remind-worker`)
      .set('x-test-user-id', POSTER_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

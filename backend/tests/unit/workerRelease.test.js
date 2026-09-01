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
const GIG_ID = 'gig-release-5555-5555-555555555555';

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
      accepted_at: '2026-03-28T10:00:00.000Z',
      status: 'assigned',
      started_at: null,
      payment_id: null,
      payment_status: 'none',
      worker_ack_status: null,
      ...overrides,
    },
  ]);

  seedTable('User', [
    { id: POSTER_ID, account_type: 'personal', name: 'Poster' },
    { id: WORKER_ID, account_type: 'personal', name: 'Worker' },
    { id: OTHER_ID, account_type: 'personal', name: 'Other User' },
  ]);

  seedTable('GigBid', [
    { id: 'bid-accepted', gig_id: GIG_ID, user_id: WORKER_ID, status: 'accepted' },
    { id: 'bid-rejected', gig_id: GIG_ID, user_id: OTHER_ID, status: 'rejected' },
  ]);
}

describe('POST /api/gigs/:gigId/worker-release', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    seedAssignedGig();
    seedTable('Notification', []);
    seedTable('Payment', []);
    notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
    notificationService.createBulkNotifications.mockResolvedValue([{ id: 'notif-1' }]);
  });

  it('lets the worker self-release from the assignment', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({ note: 'Something came up' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.status).toBe('open');
    expect(updatedGig.accepted_by).toBeNull();
  });

  it('notifies the owner when the worker releases', async () => {
    await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: POSTER_ID,
          type: 'worker_cant_make_it',
        }),
      ])
    );
  });

  it('does not reopen manually rejected bids (standby bids stay pending, rejected stay rejected)', async () => {
    await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    const bids = getTable('GigBid');
    // Manually rejected bids stay rejected — they are NOT reopened.
    // Under the new lifecycle, other bids are never auto-rejected on accept,
    // so there's nothing to reopen here.
    const rejectedBid = bids.find((b) => b.id === 'bid-rejected');
    expect(rejectedBid.status).toBe('rejected');
  });

  it('rejects release from non-worker', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', OTHER_ID)
      .send({});

    expect(res.status).toBe(403);
  });

  it('rejects release after work has started', async () => {
    seedAssignedGig({ started_at: new Date().toISOString(), status: 'in_progress' });

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    expect(res.status).toBe(400);
  });

  it('cancels payment authorization when a payment hold exists', async () => {
    const stripeService = require('../../stripe/stripeService');
    const PAYMENT_ID = 'pay-release-1111';

    seedAssignedGig({ payment_id: PAYMENT_ID, payment_status: 'authorized' });
    seedTable('Payment', [
      { id: PAYMENT_ID, payment_status: 'authorized' },
    ]);

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(stripeService.cancelAuthorization).toHaveBeenCalledWith(PAYMENT_ID);
  });

  it('clears last_worker_reminder_at on release', async () => {
    seedAssignedGig({ last_worker_reminder_at: new Date().toISOString() });

    await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.last_worker_reminder_at).toBeNull();
  });

  it('returns 502 and does not reopen gig if Stripe cancellation fails', async () => {
    const stripeService = require('../../stripe/stripeService');
    const PAYMENT_ID = 'pay-release-fail';

    stripeService.cancelAuthorization.mockRejectedValueOnce(new Error('Stripe timeout'));
    seedAssignedGig({ payment_id: PAYMENT_ID, payment_status: 'authorized' });
    seedTable('Payment', [
      { id: PAYMENT_ID, payment_status: 'authorized' },
    ]);

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-release`)
      .set('x-test-user-id', WORKER_ID)
      .send({});

    expect(res.status).toBe(502);

    // Gig should still be assigned — not reopened
    const gigTable = getTable('Gig');
    const gig = gigTable.find((g) => g.id === GIG_ID);
    expect(gig.status).toBe('assigned');
    expect(gig.accepted_by).toBe(WORKER_ID);
  });
});

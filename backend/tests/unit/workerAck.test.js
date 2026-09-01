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
const GIG_ID = 'gig-ack-4444-4444-4444-444444444444';

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
      worker_ack_status: null,
      worker_ack_eta_minutes: null,
      worker_ack_note: null,
      worker_ack_updated_at: null,
      ...overrides,
    },
  ]);

  seedTable('User', [
    { id: POSTER_ID, account_type: 'personal', name: 'Poster' },
    { id: WORKER_ID, account_type: 'personal', name: 'Worker' },
    { id: OTHER_ID, account_type: 'personal', name: 'Other User' },
  ]);
}

describe('POST /api/gigs/:gigId/worker-ack', () => {
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
    notificationService.createBulkNotifications.mockResolvedValue([{ id: 'notif-1' }]);
  });

  it('lets the worker send a starting_now acknowledgement', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'starting_now' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.worker_ack_status).toBe('starting_now');

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.worker_ack_status).toBe('starting_now');
  });

  it('lets the worker send a running_late acknowledgement with ETA', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'running_late', eta_minutes: 20, note: 'Stuck in traffic' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.worker_ack_status).toBe('running_late');

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.worker_ack_status).toBe('running_late');
    expect(updatedGig.worker_ack_eta_minutes).toBe(20);
    expect(updatedGig.worker_ack_note).toBe('Stuck in traffic');
  });

  it('sends notification to the owner', async () => {
    await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'starting_now' });

    expect(notificationService.createBulkNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: POSTER_ID,
          type: 'worker_starting',
        }),
      ])
    );
  });

  it('rejects ack from non-worker', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', OTHER_ID)
      .send({ status: 'starting_now' });

    expect(res.status).toBe(403);
  });

  it('rejects ack after work has started', async () => {
    seedAssignedGig({ started_at: new Date().toISOString(), status: 'in_progress' });

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'starting_now' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  it('rejects cant_make_it via the ack endpoint', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'cant_make_it' });

    expect(res.status).toBe(400);
  });

  it('accepts running_late without eta_minutes', async () => {
    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'running_late' });

    expect(res.status).toBe(200);
    expect(res.body.worker_ack_status).toBe('running_late');

    const gigTable = getTable('Gig');
    const updatedGig = gigTable.find((g) => g.id === GIG_ID);
    expect(updatedGig.worker_ack_eta_minutes).toBeNull();
  });

  it('skips notification when ack status has not changed', async () => {
    seedAssignedGig({ worker_ack_status: 'starting_now' });

    const res = await request(app)
      .post(`/api/gigs/${GIG_ID}/worker-ack`)
      .set('x-test-user-id', WORKER_ID)
      .send({ status: 'starting_now' });

    expect(res.status).toBe(200);
    expect(notificationService.createBulkNotifications).not.toHaveBeenCalled();
  });
});

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

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

  verifyToken.requireAdmin = (req, res, next) => next();
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

const mockGetPaymentStateInfo = jest.fn((status) => ({
  label: status,
  description: `State: ${status}`,
}));

jest.mock('../../stripe/paymentStateMachine', () => ({
  PAYMENT_STATES: {
    AUTHORIZE_PENDING: 'authorize_pending',
    AUTHORIZED: 'authorized',
    CAPTURED_HOLD: 'captured_hold',
    TRANSFERRED: 'transferred',
    REFUND_PENDING: 'refund_pending',
  },
  getPaymentStateInfo: (status) => mockGetPaymentStateInfo(status),
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

const POSTER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const WORKER_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const GIG_ID = 'gig-pay-11111111-1111-1111-1111-111111111111';
const MAIN_PAYMENT_ID = 'pay-main-11111111-1111-1111-1111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', require('../../routes/gigs'));
  return app;
}

describe('GET /api/gigs/:gigId/payment', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('returns the main gig payment with aggregated net successful tips', async () => {
    seedTable('Gig', [{
      id: GIG_ID,
      user_id: POSTER_ID,
      accepted_by: WORKER_ID,
      payment_id: MAIN_PAYMENT_ID,
    }]);

    seedTable('Payment', [
      {
        id: MAIN_PAYMENT_ID,
        gig_id: GIG_ID,
        payer_id: POSTER_ID,
        payee_id: WORKER_ID,
        payment_status: 'captured_hold',
        amount_total: 10000,
        amount_subtotal: 10000,
        amount_to_payee: 8500,
        payment_type: 'gig_payment',
        tip_amount: 0,
      },
      {
        id: 'tip-success-1',
        gig_id: GIG_ID,
        payer_id: POSTER_ID,
        payee_id: WORKER_ID,
        payment_status: 'captured_hold',
        payment_type: 'tip',
        tip_amount: 300,
        refunded_amount: 0,
        payment_succeeded_at: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'tip-success-2',
        gig_id: GIG_ID,
        payer_id: POSTER_ID,
        payee_id: WORKER_ID,
        payment_status: 'transferred',
        payment_type: 'tip',
        tip_amount: 250,
        refunded_amount: 50,
        payment_succeeded_at: '2026-04-02T00:00:00.000Z',
      },
      {
        id: 'tip-abandoned',
        gig_id: GIG_ID,
        payer_id: POSTER_ID,
        payee_id: WORKER_ID,
        payment_status: 'authorize_pending',
        payment_type: 'tip',
        tip_amount: 500,
        refunded_amount: 0,
        payment_succeeded_at: null,
      },
      {
        id: 'tip-canceled',
        gig_id: GIG_ID,
        payer_id: POSTER_ID,
        payee_id: WORKER_ID,
        payment_status: 'canceled',
        payment_type: 'tip',
        tip_amount: 400,
        refunded_amount: 0,
        payment_succeeded_at: null,
      },
    ]);

    const res = await request(app)
      .get(`/api/gigs/${GIG_ID}/payment`)
      .set('x-test-user-id', POSTER_ID);

    expect(res.status).toBe(200);
    expect(res.body.payment.id).toBe(MAIN_PAYMENT_ID);
    expect(res.body.payment.tip_amount).toBe(500);
    expect(res.body.stateInfo).toEqual({
      label: 'captured_hold',
      description: 'State: captured_hold',
    });
    expect(mockGetPaymentStateInfo).toHaveBeenCalledWith('captured_hold');
  });
});

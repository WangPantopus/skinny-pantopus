// ============================================================
// TEST: Critical money-movement routes in pays.js
// Covers:
//   1. POST /api/payments/tip — happy path + error paths
//   2. POST /api/payments/:paymentId/admin-refund — happy + error paths
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  createTipPayment: jest.fn(),
  syncTipPaymentStatus: jest.fn(),
  createSmartRefund: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');
const { createNotification } = require('../services/notificationService');

// Override verifyToken mock to support x-test-role header for admin tests
jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    const role = req.headers['x-test-role'] || 'user';
    req.user = {
      id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      role,
    };
    next();
  };
  mw.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
    next();
  };
  mw.invalidateRoleCache = () => {};
  return mw;
});

const paysRoutes = require('../routes/pays');

const DEFAULT_USER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const GIG_ID = 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee';
const WORKER_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  return app;
}

function makeGig(overrides = {}) {
  return {
    id: GIG_ID,
    user_id: DEFAULT_USER,
    accepted_by: WORKER_ID,
    status: 'completed',
    title: 'Test Gig',
    owner_confirmed_at: new Date().toISOString(),
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    id: overrides.id || 'pay-001',
    payer_id: DEFAULT_USER,
    payee_id: WORKER_ID,
    gig_id: GIG_ID,
    amount_total: 5000,
    payment_status: 'captured_hold',
    payment_type: 'gig',
    payment_succeeded_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ============================================================
// 1. POST /api/payments/tip
// ============================================================

describe('POST /api/payments/tip', () => {
  test('happy path: creates tip for completed confirmed gig', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig()]);
    seedTable('Payment', []); // no existing tips

    stripeService.createTipPayment.mockResolvedValue({
      success: true,
      clientSecret: 'pi_xxx_secret_xxx',
      paymentId: 'pay-tip-001',
      paymentIntentId: 'pi_xxx',
    });

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.paymentId).toBe('pay-tip-001');
    expect(res.body.clientSecret).toBe('pi_xxx_secret_xxx');
    expect(stripeService.createTipPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payerId: DEFAULT_USER,
        payeeId: WORKER_ID,
        gigId: GIG_ID,
        amount: 500,
        offSession: false,
      })
    );
    expect(createNotification).not.toHaveBeenCalled();
  });

  test('rejects tip on non-existent gig', async () => {
    const app = buildApp();
    seedTable('Gig', []);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });

  test('rejects tip from non-poster', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig({ user_id: 'cccccccc-cccc-1ccc-8ccc-cccccccccccc' })]);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the gig poster/i);
  });

  test('rejects tip on incomplete gig', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig({ status: 'in_progress' })]);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/completed/i);
  });

  test('rejects tip on unconfirmed gig', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig({ owner_confirmed_at: null })]);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/confirmed/i);
  });

  test('rejects tip when 3 successful tips already exist for gig', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig()]);
    seedTable('Payment', [
      makePayment({
        id: 'tip-1',
        payment_type: 'tip',
        payment_status: 'transferred',
        payment_succeeded_at: '2026-04-01T00:00:00.000Z',
      }),
      makePayment({
        id: 'tip-2',
        payment_type: 'tip',
        payment_status: 'captured_hold',
        payment_succeeded_at: '2026-04-02T00:00:00.000Z',
      }),
      makePayment({
        id: 'tip-3',
        payment_type: 'tip',
        payment_status: 'refund_pending',
        payment_succeeded_at: '2026-04-03T00:00:00.000Z',
      }),
    ]);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum 3 tips/i);
  });

  test('does not count abandoned pre-confirmation tip attempts toward the cap', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig()]);
    seedTable('Payment', [
      makePayment({ id: 'tip-abandoned-1', payment_type: 'tip', payment_status: 'authorize_pending' }),
      makePayment({ id: 'tip-abandoned-2', payment_type: 'tip', payment_status: 'authorize_pending' }),
      makePayment({ id: 'tip-abandoned-3', payment_type: 'tip', payment_status: 'authorize_pending' }),
    ]);

    stripeService.createTipPayment.mockResolvedValue({
      success: true,
      clientSecret: 'pi_retry_secret',
      paymentId: 'pay-tip-retry',
      paymentIntentId: 'pi_retry',
    });

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body.paymentId).toBe('pay-tip-retry');
    expect(stripeService.createTipPayment).toHaveBeenCalledTimes(1);
  });

  test('returns 500 when stripeService.createTipPayment throws', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig()]);
    seedTable('Payment', []);

    stripeService.createTipPayment.mockRejectedValue(new Error('Stripe connect failure'));

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/stripe connect failure/i);
  });

  test('returns 402 for SCA authentication_required error', async () => {
    const app = buildApp();
    seedTable('Gig', [makeGig()]);
    seedTable('Payment', []);

    const scaError = new Error('Your card was declined');
    scaError.type = 'StripeCardError';
    scaError.code = 'authentication_required';
    stripeService.createTipPayment.mockRejectedValue(scaError);

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500, paymentMethodId: 'pm_xxx' });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('authentication_required');
  });

  test('rejects invalid body (missing amount)', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

describe('POST /api/payments/tip/:paymentId/refresh-status', () => {
  test('payer can reconcile a tip payment after mobile confirmation', async () => {
    const app = buildApp();
    seedTable('Payment', [
      makePayment({
        id: 'pay-tip-refresh-1',
        payment_type: 'tip',
        payment_status: 'authorize_pending',
      }),
    ]);

    stripeService.syncTipPaymentStatus.mockResolvedValue({
      payment_status: 'captured_hold',
      stripe_status: 'succeeded',
    });

    const res = await request(app)
      .post('/api/payments/tip/pay-tip-refresh-1/refresh-status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      paymentStatus: 'captured_hold',
      previousPaymentStatus: 'authorize_pending',
      changed: true,
      stripeStatus: 'succeeded',
    });
    expect(stripeService.syncTipPaymentStatus).toHaveBeenCalledWith('pay-tip-refresh-1');
  });

  test('rejects users who are not part of the tip payment', async () => {
    const app = buildApp();
    seedTable('Payment', [
      makePayment({
        id: 'pay-tip-refresh-2',
        payment_type: 'tip',
        payer_id: 'payer-else',
        payee_id: 'worker-else',
        payment_status: 'authorize_pending',
      }),
    ]);

    const res = await request(app)
      .post('/api/payments/tip/pay-tip-refresh-2/refresh-status');

    expect(res.status).toBe(403);
    expect(stripeService.syncTipPaymentStatus).not.toHaveBeenCalled();
  });
});

// ============================================================
// 2. POST /api/payments/:paymentId/admin-refund
// ============================================================

describe('POST /api/payments/:paymentId/admin-refund', () => {
  function adminRequest(app, path) {
    return request(app)
      .post(path)
      .set('x-test-role', 'admin');
  }

  test('happy path: admin refund with full amount', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-refund-1', payment_status: 'captured_hold', amount_total: 5000 })]);

    stripeService.createSmartRefund.mockResolvedValue({
      refund: { id: 'refund-001', amount: 5000, status: 'succeeded' },
    });

    const res = await adminRequest(app, '/api/payments/pay-refund-1/admin-refund')
      .send({ reason: 'requested_by_customer' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/admin refund created/i);
    expect(res.body.refund.id).toBe('refund-001');
    expect(stripeService.createSmartRefund).toHaveBeenCalledWith(
      'pay-refund-1', 5000, 'requested_by_customer', DEFAULT_USER
    );
  });

  test('happy path: admin partial refund', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-refund-2', payment_status: 'transferred', amount_total: 10000 })]);

    stripeService.createSmartRefund.mockResolvedValue({
      refund: { id: 'refund-002', amount: 3000, status: 'succeeded' },
    });

    const res = await adminRequest(app, '/api/payments/pay-refund-2/admin-refund')
      .send({ reason: 'work_not_completed', amount: 3000, description: 'Partial work done' });

    expect(res.status).toBe(201);
    expect(stripeService.createSmartRefund).toHaveBeenCalledWith(
      'pay-refund-2', 3000, 'work_not_completed', DEFAULT_USER
    );
  });

  test('rejects non-admin user', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-refund-3' })]);

    // No x-test-role header — default is 'user'
    const res = await request(app)
      .post('/api/payments/pay-refund-3/admin-refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(403);
    expect(stripeService.createSmartRefund).not.toHaveBeenCalled();
  });

  test('rejects refund on non-existent payment', async () => {
    const app = buildApp();
    seedTable('Payment', []);

    const res = await adminRequest(app, '/api/payments/pay-nonexistent/admin-refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('rejects refund on terminal state (refunded_full)', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-terminal', payment_status: 'refunded_full' })]);

    const res = await adminRequest(app, '/api/payments/pay-terminal/admin-refund')
      .send({ reason: 'duplicate' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terminal state/i);
  });

  test('rejects refund on canceled payment', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-canceled', payment_status: 'canceled' })]);

    const res = await adminRequest(app, '/api/payments/pay-canceled/admin-refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terminal state/i);
  });

  test('returns 500 when createSmartRefund throws', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-err', payment_status: 'captured_hold', amount_total: 5000 })]);

    stripeService.createSmartRefund.mockRejectedValue(new Error('Stripe API error'));

    const res = await adminRequest(app, '/api/payments/pay-err/admin-refund')
      .send({ reason: 'fraudulent' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to create admin refund/i);
    expect(res.body.message).toMatch(/stripe api error/i);
  });

  test('rejects invalid reason', async () => {
    const app = buildApp();

    const res = await adminRequest(app, '/api/payments/pay-001/admin-refund')
      .send({ reason: 'invalid_reason' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

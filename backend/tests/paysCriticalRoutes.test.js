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
  previewTip: jest.fn(),
  readTipRequest: jest.fn(),
  syncTipPaymentStatus: jest.fn(),
  createSmartRefund: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');
jest.mock('../services/paymentRefundService', () => ({ create: jest.fn(), history: jest.fn() }));
const refundService = require('../services/paymentRefundService');
const { createNotification } = require('../services/notificationService');

// Override verifyToken mock to support x-test-role header for admin tests
jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    const role = req.headers['x-test-role'] || 'user';
    req.user = {
      id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      role,
    };
    req.session = { id: 'tip-route-session' };
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

const TIP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const { getRequestSessionScope } = require('../utils/requestSessionScope');
const opening = actor => getRequestSessionScope({ user: { id: actor }, session: { id: 'tip-route-session' } }).session_scope;
function tipCommand(overrides = {}) {
  return { requestId: TIP_ID, gigId: GIG_ID, amount: 500, expectedActorId: DEFAULT_USER,
    expectedSessionScope: opening(DEFAULT_USER), expectedTerms: { gigId: GIG_ID, payerId: DEFAULT_USER,
      payeeId: WORKER_ID, ownerConfirmedAt: '2026-09-14T00:00:00Z' }, mode: 'resume', ...overrides };
}
function tipProgress(status = 'pending') {
  const original = { requestId: TIP_ID, paymentId: TIP_ID, gigId: GIG_ID, payerId: DEFAULT_USER, payeeId: WORKER_ID,
    amountCents: 500, currency: 'usd', terms: tipCommand().expectedTerms, paymentMethodId: null };
  return { request: original, status, paymentStatus: status === 'succeeded' ? 'captured_hold' : 'authorize_pending',
    providerStatus: status === 'succeeded' ? 'succeeded' : 'requires_action', paymentIntentId: 'pi_tiproute',
    canRetry: status !== 'succeeded', canCancel: status !== 'succeeded', receipt: status === 'succeeded'
      ? { ...original, status, paymentIntentId: 'pi_tiproute', chargeId: 'ch_tiproute', amountChargedCents: 500 } : null };
}

describe('POST /api/payments/tip', () => {
  test('passes the original UUID, exact terms and current actor/session to the service', async () => {
    stripeService.createTipPayment.mockResolvedValue(tipProgress());
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(res.status).toBe(202); expect(res.body.status).toBe('pending'); expect(res.body.receipt).toBeNull();
    expect(res.body.success).toBeUndefined(); expect(res.body.sessionScope).toBe(opening(DEFAULT_USER));
    expect(stripeService.createTipPayment).toHaveBeenCalledWith({ ...tipCommand(), paymentMethodId: null,
      payerId: DEFAULT_USER, sessionScope: opening(DEFAULT_USER) });
  });
  test('returns a successful terminal receipt without replacing original identity', async () => {
    stripeService.createTipPayment.mockResolvedValue(tipProgress('succeeded'));
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand({ mode: 'check' }));
    expect(res.status).toBe(200); expect(res.body.receipt.paymentId).toBe(TIP_ID);
    expect(res.body.receipt.amountChargedCents).toBe(500);
  });
  test.each([
    { gigId: GIG_ID, amount: 500 }, tipCommand({ amount: 49 }), tipCommand({ amount: 100000000 }),
    tipCommand({ amount: '500' }), tipCommand({ requestId: 'not-a-uuid' }), tipCommand({ mode: 'capture' }),
    tipCommand({ paymentMethodId: 'other' }), tipCommand({ expectedTerms: {} }),
  ])('rejects incomplete or invalid original commands before service access: %j', async body => {
    const res = await request(buildApp()).post('/api/payments/tip').send(body);
    expect(res.status).toBe(409); expect(res.body.code).toBe('TIP_TERMS_REQUIRED');
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test('stale account opening fails before provider service access', async () => {
    const res = await request(buildApp()).post('/api/payments/tip').set('x-test-user-id', WORKER_ID).send(tipCommand());
    expect(res.status).toBe(409); expect(res.body.code).toBe('SESSION_SCOPE_CHANGED');
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test('stale session opening fails before provider service access', async () => {
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand({ expectedSessionScope: 'f'.repeat(64) }));
    expect(res.status).toBe(409); expect(res.body.code).toBe('SESSION_SCOPE_CHANGED');
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test.each([
    ['TIP_FORBIDDEN', 403], ['TIP_NOT_FOUND', 404], ['TIP_NOT_CONFIRMED', 409], ['TIP_WORKER_UNAVAILABLE', 409],
    ['TIP_LIMIT', 409], ['TIP_LEGACY_REVIEW', 409], ['TIP_REQUEST_CONFLICT', 409], ['TIP_RECEIPT_UNKNOWN', 503],
  ])('preserves the atomic service admission or recovery error %s', async (code, statusCode) => {
    stripeService.createTipPayment.mockRejectedValue(Object.assign(new Error('Check original tip'), { code, statusCode }));
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(res.status).toBe(statusCode); expect(res.body.code).toBe(code); expect(res.body.receipt).toBeUndefined();
  });
  test('only TIP_ACTIVE may identify another active original for explicit recovery', async () => {
    stripeService.createTipPayment.mockRejectedValue(Object.assign(new Error('Original active'),
      { code: 'TIP_ACTIVE', statusCode: 409, activeRequestId: TIP_ID }));
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(res.body.activeRequestId).toBe(TIP_ID);
    stripeService.createTipPayment.mockRejectedValue(Object.assign(new Error('Other conflict'),
      { code: 'TIP_REQUEST_CONFLICT', statusCode: 409, activeRequestId: TIP_ID }));
    const conflict = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(conflict.body.activeRequestId).toBeUndefined();
  });
  test('unexpected failure returns a recoverable error without exposing provider internals', async () => {
    stripeService.createTipPayment.mockRejectedValue(new Error('synthetic private provider payload'));
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(res.status).toBe(503); expect(res.body.code).toBe('TIP_UNKNOWN');
    expect(JSON.stringify(res.body)).not.toContain('synthetic private');
  });
});

describe('original tip preview and local receipt reads', () => {
  test('preview returns current opening proof and existing service eligibility', async () => {
    stripeService.previewTip.mockResolvedValue({ terms: tipCommand().expectedTerms, eligible: true, activeRequestId: null });
    const res = await request(buildApp()).get('/api/payments/tip-preview').query({ gigId: GIG_ID });
    expect(res.status).toBe(200); expect(res.body.actorId).toBe(DEFAULT_USER); expect(res.body.sessionScope).toBe(opening(DEFAULT_USER));
    expect(stripeService.previewTip).toHaveBeenCalledWith({ gigId: GIG_ID, payerId: DEFAULT_USER });
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test('read retains the original and binds the response to the current session', async () => {
    stripeService.readTipRequest.mockResolvedValue(tipProgress());
    const res = await request(buildApp()).get(`/api/payments/tip-requests/${TIP_ID}`);
    expect(res.status).toBe(200); expect(res.body.request.requestId).toBe(TIP_ID);
    expect(res.body.sessionScope).toBe(opening(DEFAULT_USER)); expect(res.body.checkout).toBeUndefined();
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test('an absent original remains 404 without reserving another payment', async () => {
    stripeService.readTipRequest.mockRejectedValue(Object.assign(new Error('Original absent'), { code: 'TIP_NOT_FOUND', statusCode: 404 }));
    const res = await request(buildApp()).get(`/api/payments/tip-requests/${TIP_ID}`);
    expect(res.status).toBe(404); expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
  test('invalid read identity fails before any service read', async () => {
    const res = await request(buildApp()).get('/api/payments/tip-requests/invalid');
    expect(res.status).toBe(400); expect(stripeService.readTipRequest).not.toHaveBeenCalled();
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

    refundService.create.mockResolvedValue({
      success: true, refund: { id: 'refund-001', amount: 5000, status: 'succeeded' },
    });

    const res = await adminRequest(app, '/api/payments/pay-refund-1/admin-refund')
      .send({ reason: 'requested_by_customer' });

    expect(res.status).toBe(200);
    expect(res.body.refund.id).toBe('refund-001');
    expect(refundService.create).toHaveBeenCalledWith(
      { paymentId: 'pay-refund-1', reason: 'requested_by_customer', actorId: DEFAULT_USER, actorMode: 'admin' }
    );
  });

  test('happy path: admin partial refund', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-refund-2', payment_status: 'transferred', amount_total: 10000 })]);

    refundService.create.mockResolvedValue({
      success: true, refund: { id: 'refund-002', amount: 3000, status: 'succeeded' },
    });

    const res = await adminRequest(app, '/api/payments/pay-refund-2/admin-refund')
      .send({ reason: 'work_not_completed', amount: 3000, description: 'Partial work done' });

    expect(res.status).toBe(200);
    expect(refundService.create).toHaveBeenCalledWith(
      { paymentId: 'pay-refund-2', amount: 3000, reason: 'work_not_completed', description: 'Partial work done', actorId: DEFAULT_USER, actorMode: 'admin' }
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
    expect(refundService.create).not.toHaveBeenCalled();
  });

  test('rejects refund on non-existent payment', async () => {
    const app = buildApp();
    seedTable('Payment', []);
    refundService.create.mockRejectedValueOnce(Object.assign(new Error('Payment not found'), { statusCode: 404 }));

    const res = await adminRequest(app, '/api/payments/pay-nonexistent/admin-refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('rejects refund on terminal state (refunded_full)', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-terminal', payment_status: 'refunded_full' })]);

    refundService.create.mockRejectedValueOnce(Object.assign(new Error('Payment state changed'), { statusCode: 409 }));
    const res = await adminRequest(app, '/api/payments/pay-terminal/admin-refund')
      .send({ reason: 'duplicate' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/state changed/i);
  });

  test('rejects refund on canceled payment', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-canceled', payment_status: 'canceled' })]);

    refundService.create.mockRejectedValueOnce(Object.assign(new Error('Payment state changed'), { statusCode: 409 }));
    const res = await adminRequest(app, '/api/payments/pay-canceled/admin-refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/state changed/i);
  });

  test('returns pending error when refund confirmation is unavailable', async () => {
    const app = buildApp();
    seedTable('Payment', [makePayment({ id: 'pay-err', payment_status: 'captured_hold', amount_total: 5000 })]);

    refundService.create.mockRejectedValueOnce(Object.assign(new Error('Refund confirmation unavailable'), { statusCode: 503, refundRequest: { requestId: 'retained' } }));

    const res = await adminRequest(app, '/api/payments/pay-err/admin-refund')
      .send({ reason: 'fraudulent' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/confirmation unavailable/i);
    expect(res.body.refundRequest.requestId).toBe('retained');
  });

  test('rejects invalid reason', async () => {
    const app = buildApp();

    const res = await adminRequest(app, '/api/payments/pay-001/admin-refund')
      .send({ reason: 'invalid_reason' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

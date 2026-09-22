// ============================================================
// TEST: Tip mobile PaymentSheet params + refresh-status (Block 3D)
// The mobile clients tip a worker via POST /api/payments/tip and then
// reconcile with POST /api/payments/tip/:paymentId/refresh-status. This locks
// the existing mobile-specific params inside a scoped original progress response, and the
// refresh-status route returns the reconciled payment status.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  createTipPayment: jest.fn(),
  syncTipPaymentStatus: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || POSTER_ID, role: 'user' };
    req.session = { id: 'tip-mobile-route-session' };
    next();
  };
  mw.requireAdmin = (_req, _res, next) => next();
  mw.invalidateRoleCache = () => {};
  return mw;
});

const paysRoutes = require('../routes/pays');

const POSTER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const WORKER_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const GIG_ID = 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  return app;
}

const { getRequestSessionScope } = require('../utils/requestSessionScope');
const originalId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tipCommand = () => ({ requestId: originalId, gigId: GIG_ID, amount: 500, mode: 'check', expectedActorId: POSTER_ID,
  expectedSessionScope: getRequestSessionScope({ user: { id: POSTER_ID }, session: { id: 'tip-mobile-route-session' } }).session_scope,
  expectedTerms: { gigId: GIG_ID, payerId: POSTER_ID, payeeId: WORKER_ID, ownerConfirmedAt: '2026-09-14T00:00:00Z' } });

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('POST /api/payments/tip — existing mobile PaymentSheet params', () => {
  test.each(['null', 'omitted'])('historical check preserves %s confirmation time through the scoped command', async encoding => {
    const cmd = tipCommand(); cmd.expectedTerms.ownerConfirmedAt = null;
    if (encoding === 'omitted') delete cmd.expectedTerms.ownerConfirmedAt;
    stripeService.createTipPayment.mockResolvedValue({ status: 'needs_review', receipt: null });
    const res = await request(buildApp()).post('/api/payments/tip').send(cmd);
    expect(res.status).toBe(202); expect(res.body.receipt).toBeNull();
    expect(stripeService.createTipPayment).toHaveBeenCalledWith(expect.objectContaining({
      expectedTerms: expect.objectContaining({ ownerConfirmedAt: null }), mode: 'check', payerId: POSTER_ID }));
  });
  test('pending scoped command carries transient checkout without asserting payment success', async () => {
    const checkout = { paymentIntentId: 'pi_tip', clientSecret: 'pi_tip_secret_fixture', customer: 'cus_tip',
      ephemeralKey: 'ek_fixture', publishableKey: 'pk_test_fixture' };
    stripeService.createTipPayment.mockResolvedValue({ status: 'requires_action', request: { requestId: originalId, paymentId: originalId },
      receipt: null, checkout });
    const res = await request(buildApp()).post('/api/payments/tip').send(tipCommand());
    expect(res.status).toBe(202); expect(res.body.checkout).toEqual(checkout);
    expect(res.body.receipt).toBeNull(); expect(res.body.success).toBeUndefined();
    expect(stripeService.createTipPayment).toHaveBeenCalledWith(expect.objectContaining({ payerId: POSTER_ID, requestId: originalId, mode: 'check' }));
  });
  test('a sheet opened under a different actor cannot resume a tip', async () => {
    const res = await request(buildApp()).post('/api/payments/tip').set('x-test-user-id', WORKER_ID).send(tipCommand());
    expect(res.status).toBe(409); expect(res.body.code).toBe('SESSION_SCOPE_CHANGED');
    expect(stripeService.createTipPayment).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/tip/:paymentId/refresh-status', () => {
  test('reconciles + returns the tip payment status', async () => {
    seedTable('Payment', [{
      id: 'pay-tip-1',
      payer_id: POSTER_ID,
      payee_id: WORKER_ID,
      payment_type: 'tip',
      payment_status: 'authorize_pending',
    }]);
    stripeService.syncTipPaymentStatus.mockResolvedValue({
      payment_status: 'captured',
      stripe_status: 'succeeded',
    });

    const res = await request(buildApp())
      .post('/api/payments/tip/pay-tip-1/refresh-status')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      paymentStatus: 'captured',
      previousPaymentStatus: 'authorize_pending',
      changed: true,
    });
    expect(stripeService.syncTipPaymentStatus).toHaveBeenCalledWith('pay-tip-1');
  });

  test('refuses to refresh a non-tip payment', async () => {
    seedTable('Payment', [{
      id: 'pay-gig-1',
      payer_id: POSTER_ID,
      payee_id: WORKER_ID,
      payment_type: 'gig_payment',
      payment_status: 'captured_hold',
    }]);

    const res = await request(buildApp())
      .post('/api/payments/tip/pay-gig-1/refresh-status')
      .send({});

    expect(res.status).toBe(400);
    expect(stripeService.syncTipPaymentStatus).not.toHaveBeenCalled();
  });
});

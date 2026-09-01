// ============================================================
// TEST: Tip mobile PaymentSheet params + refresh-status (Block 3D)
// The mobile clients tip a worker via POST /api/payments/tip and then
// reconcile with POST /api/payments/tip/:paymentId/refresh-status. This locks
// the mobile-specific bits the clients depend on: the tip response carries the
// PaymentSheet params (customer + ephemeralKey + publishableKey), and the
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

function completedGig() {
  return {
    id: GIG_ID,
    user_id: POSTER_ID,
    accepted_by: WORKER_ID,
    status: 'completed',
    title: 'Patio cleanup',
    owner_confirmed_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('POST /api/payments/tip — mobile PaymentSheet params', () => {
  test('returns clientSecret + customer + ephemeralKey + publishableKey', async () => {
    seedTable('Gig', [completedGig()]);
    seedTable('Payment', []);
    stripeService.createTipPayment.mockResolvedValue({
      success: true,
      clientSecret: 'pi_tip_secret',
      paymentId: 'pay-tip-1',
      paymentIntentId: 'pi_tip',
      customer: 'cus_1',
      ephemeralKey: 'ek_1',
      publishableKey: 'pk_test',
    });

    const res = await request(buildApp())
      .post('/api/payments/tip')
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      clientSecret: 'pi_tip_secret',
      paymentId: 'pay-tip-1',
      customer: 'cus_1',
      ephemeralKey: 'ek_1',
      publishableKey: 'pk_test',
    });
    expect(stripeService.createTipPayment).toHaveBeenCalledWith(
      expect.objectContaining({ payerId: POSTER_ID, payeeId: WORKER_ID, gigId: GIG_ID, amount: 500, offSession: false }),
    );
  });

  test('only the gig poster can tip', async () => {
    seedTable('Gig', [completedGig()]);
    const res = await request(buildApp())
      .post('/api/payments/tip')
      .set('x-test-user-id', WORKER_ID)
      .send({ gigId: GIG_ID, amount: 500 });

    expect(res.status).toBe(403);
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

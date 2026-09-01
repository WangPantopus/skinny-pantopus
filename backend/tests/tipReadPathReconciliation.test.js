const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  reconcilePendingTipsForUser: jest.fn(),
}));

const stripeService = require('../stripe/stripeService');

function buildWalletApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/wallet', require('../routes/wallet'));
  return app;
}

function buildPaysApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', require('../routes/pays'));
  return app;
}

describe('tip read-path reconciliation', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('GET /api/wallet/pending-release includes a previously stuck tip after reconcile', async () => {
    const app = buildWalletApp();
    const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
    const futureIso = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

    seedTable('Payment', [{
      id: 'tip-stuck-001',
      payer_id: 'payer-001',
      payee_id: userId,
      gig_id: 'gig-tip-001',
      amount_total: 500,
      amount_to_payee: 456,
      payment_type: 'tip',
      payment_status: 'authorize_pending',
      cooling_off_ends_at: null,
      dispute_id: null,
      created_at: '2026-04-15T22:00:00.000Z',
    }]);

    stripeService.reconcilePendingTipsForUser.mockImplementation(async () => {
      const payment = getTable('Payment').find((row) => row.id === 'tip-stuck-001');
      payment.payment_status = 'captured_hold';
      payment.payment_succeeded_at = '2026-04-15T22:01:00.000Z';
      payment.cooling_off_ends_at = futureIso;
      return [{ status: 'fulfilled', value: { payment_status: 'captured_hold' } }];
    });

    const res = await request(app).get('/api/wallet/pending-release');

    expect(res.status).toBe(200);
    expect(stripeService.reconcilePendingTipsForUser).toHaveBeenCalledWith(userId, { payeeOnly: true });
    expect(res.body.in_review_cents).toBe(456);
    expect(res.body.releasing_soon_cents).toBe(0);
    expect(res.body.total_pending_cents).toBe(456);
    expect(res.body.in_review_count).toBe(1);
  });

  test('GET /api/payments/history shows reconciled tip status instead of authorize_pending', async () => {
    const app = buildPaysApp();
    const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

    seedTable('Payment', [{
      id: 'tip-stuck-002',
      payer_id: 'payer-002',
      payee_id: userId,
      gig_id: 'gig-tip-002',
      amount_total: 500,
      amount_to_payee: 456,
      currency: 'USD',
      payment_type: 'tip',
      payment_status: 'authorize_pending',
      created_at: '2026-04-15T22:05:00.000Z',
      updated_at: '2026-04-15T22:05:00.000Z',
    }]);
    seedTable('Payout', []);

    stripeService.reconcilePendingTipsForUser.mockImplementation(async () => {
      const payment = getTable('Payment').find((row) => row.id === 'tip-stuck-002');
      payment.payment_status = 'captured_hold';
      payment.updated_at = '2026-04-15T22:06:00.000Z';
      return [{ status: 'fulfilled', value: { payment_status: 'captured_hold' } }];
    });

    const res = await request(app).get('/api/payments/history');

    expect(res.status).toBe(200);
    expect(stripeService.reconcilePendingTipsForUser).toHaveBeenCalledWith(userId);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({
      id: 'tip-stuck-002',
      payment_type: 'tip',
      status: 'captured_hold',
      amount_cents: 456,
      direction: 'credit',
    });
  });
});

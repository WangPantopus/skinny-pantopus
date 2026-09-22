const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  createRefund: jest.fn(),
}));
jest.mock('../services/paymentRefundService', () => ({ create: jest.fn(), history: jest.fn() }));
const refundService = require('../services/paymentRefundService');
const paysRoutes = require('../routes/pays');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  return app;
}

describe('Payment routes hardening', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('GET /api/payments rejects oversized offset', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/payments?offset=5001&limit=50');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Offset too large/i);
  });

  test('GET /api/payments/history rejects offset past capped window', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/payments/history?offset=500&limit=50');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Offset too large/i);
  });

  test('POST /api/payments/:paymentId/refund retains operation identity on unknown refund confirmation', async () => {
    const app = buildApp();

    // verifyToken mock default user id:
    // aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa
    seedTable('Payment', [{
      id: 'payment-refund-1',
      payer_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      payee_id: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb',
      amount_total: 1000,
      payment_status: 'captured_hold',
    }]);

    refundService.create.mockRejectedValue(Object.assign(new Error('Refund confirmation unavailable'), { statusCode: 503, refundRequest: { requestId: 'retained' } }));

    const res = await request(app)
      .post('/api/payments/payment-refund-1/refund')
      .send({ reason: 'other' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Refund confirmation unavailable');
    expect(res.body.refundRequest.requestId).toBe('retained');
  });
});

describe('private original approval stays outside existing payment DTOs', () => {
  test.each(['/api/payments', '/api/payments/private-payment'])('%s preserves old fields without approval details', async path => {
    resetTables();
    seedTable('Payment', [{ id: 'private-payment', payer_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      payee_id: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb', amount_total: 1250, metadata: { existing: 'unchanged' },
      gig_completion_original: { actor_id: 'private-business-manager', note: 'Private approval' } }]);
    const response = await request(buildApp()).get(path); expect(response.status).toBe(200);
    const payment = response.body.payment || response.body.payments[0];
    expect(payment).toMatchObject({ id: 'private-payment', amount_total: 1250, metadata: { existing: 'unchanged' } });
    expect(payment).not.toHaveProperty('gig_completion_original');
  });
});

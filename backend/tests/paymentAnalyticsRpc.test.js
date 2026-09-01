const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  setRpcMock,
  resetRpc,
} = require('./__mocks__/supabaseAdmin');
jest.mock('../stripe/stripeService', () => ({}));
const earningsService = require('../services/earningsService');
const paysRoutes = require('../routes/pays');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  return app;
}

describe('Payment analytics RPC integration', () => {
  beforeEach(() => {
    resetTables();
    resetRpc();
    jest.clearAllMocks();
  });

  test('getEarningsForUser uses get_user_earnings RPC when available', async () => {
    setRpcMock(async (fnName) => {
      if (fnName === 'get_user_earnings') {
        return {
          data: {
            totalPayments: 2,
            totalEarned: 17500,
            totalPaid: 9000,
            totalEscrowed: 8500,
            totalAvailable: 9000,
            currency: 'USD',
          },
          error: null,
        };
      }
      return { data: null, error: { message: `Unexpected RPC ${fnName}` } };
    });

    const result = await earningsService.getEarningsForUser('user-earnings-1');
    expect(result.total_payments).toBe(2);
    expect(result.total_earned).toBe(17500);
    expect(result.total_paid).toBe(9000);
    expect(result.total_escrowed).toBe(8500);
    expect(result.total_available).toBe(9000);
  });

  test('getEarningsForUser falls back to JS aggregation when RPC fails', async () => {
    setRpcMock(async (fnName) => {
      if (fnName === 'get_user_earnings') {
        return { data: null, error: { message: 'rpc unavailable' } };
      }
      return { data: null, error: null };
    });

    seedTable('Payment', [
      {
        id: 'p1',
        payee_id: 'user-earnings-1',
        amount_to_payee: 8500,
        refunded_amount: 0,
        payment_status: 'captured_hold',
        is_escrowed: true,
        escrow_released_at: null,
        created_at: '2026-03-11T00:00:00.000Z',
      },
      {
        id: 'p2',
        payee_id: 'user-earnings-1',
        amount_to_payee: 10000,
        refunded_amount: 1000,
        payment_status: 'transferred',
        is_escrowed: true,
        escrow_released_at: '2026-03-12T00:00:00.000Z',
        created_at: '2026-03-12T00:00:00.000Z',
      },
      {
        id: 'p3',
        payee_id: 'user-earnings-1',
        amount_to_payee: 5000,
        refunded_amount: 0,
        payment_status: 'authorize_pending',
        is_escrowed: true,
        escrow_released_at: null,
        created_at: '2026-03-13T00:00:00.000Z',
      },
      {
        id: 'p4',
        payee_id: 'some-other-user',
        amount_to_payee: 9000,
        refunded_amount: 0,
        payment_status: 'transferred',
        is_escrowed: false,
        escrow_released_at: null,
        created_at: '2026-03-14T00:00:00.000Z',
      },
    ]);

    const result = await earningsService.getEarningsForUser('user-earnings-1');
    expect(result.total_payments).toBe(2);
    expect(result.total_earned).toBe(17500);
    expect(result.total_paid).toBe(9000);
    expect(result.total_escrowed).toBe(8500);
    expect(result.total_available).toBe(9000);
  });

  test('GET /api/payments/spending uses get_user_spending RPC when available', async () => {
    setRpcMock(async (fnName) => {
      if (fnName === 'get_user_spending') {
        return {
          data: {
            totalPayments: 3,
            totalSpent: 21000,
            totalPaid: 8500,
            totalRefunded: 7500,
            currency: 'USD',
          },
          error: null,
        };
      }
      return { data: null, error: { message: `Unexpected RPC ${fnName}` } };
    });

    const app = buildApp();
    const res = await request(app).get('/api/payments/spending');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('rpc');
    expect(res.body.total_spent).toBe(21000);
    expect(res.body.total_paid).toBe(8500);
    expect(res.body.total_refunded).toBe(7500);
    expect(res.body.spending.total_spent).toBe(21000);
  });

  test('GET /api/payments/spending falls back to aggregate when RPC fails', async () => {
    setRpcMock(async (fnName) => {
      if (fnName === 'get_user_spending') {
        return { data: null, error: { message: 'rpc unavailable' } };
      }
      return { data: null, error: null };
    });

    const payerId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa'; // verifyToken mock default
    seedTable('Payment', [
      {
        id: 'sp1',
        payer_id: payerId,
        amount_total: 10000,
        refunded_amount: 1500,
        payment_status: 'transferred',
        created_at: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 'sp2',
        payer_id: payerId,
        amount_total: 6000,
        refunded_amount: 0,
        payment_status: 'authorize_pending',
        created_at: '2026-03-11T00:00:00.000Z',
      },
      {
        id: 'sp3',
        payer_id: payerId,
        amount_total: 5000,
        refunded_amount: 6000,
        payment_status: 'refunded_partial',
        created_at: '2026-03-12T00:00:00.000Z',
      },
      {
        id: 'sp4',
        payer_id: 'other-payer',
        amount_total: 9000,
        refunded_amount: 0,
        payment_status: 'transferred',
        created_at: '2026-03-13T00:00:00.000Z',
      },
    ]);

    const app = buildApp();
    const res = await request(app)
      .get('/api/payments/spending')
      .set('x-test-user-id', payerId);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('aggregate');
    // Fallback aggregate includes paid lifecycle statuses only
    expect(res.body.total_payments).toBe(2);
    expect(res.body.total_spent).toBe(15000);
    expect(res.body.total_paid).toBe(8500);
    expect(res.body.total_refunded).toBe(7500);
    expect(res.body.spending.total_spent).toBe(15000);
  });
});

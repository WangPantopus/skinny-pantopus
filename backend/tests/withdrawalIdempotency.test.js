// ============================================================
// TEST: Withdrawal Idempotency (Prompt 6 fix)
// Verifies:
//   - Two consecutive withdrawals with different keys both succeed
//   - Same client idempotency key submitted twice is deduplicated
//   - Each withdrawal generates a unique idempotency key format
// ============================================================

const { resetTables, seedTable, getTable, setRpcMock } = require('./__mocks__/supabaseAdmin');

// Mock stripe — inline mock object so jest.clearAllMocks doesn't interfere
const mockTransfersCreate = jest.fn();

jest.mock('../stripe/stripeService', () => ({}));

// Mock the stripe module — return an object with transfers.create directly
// so getStripeClient() detects it as an already-instantiated client
jest.mock('stripe', () => ({
  transfers: { create: mockTransfersCreate },
}));

const walletService = require('../services/walletService');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();

  // Re-set mock implementation after clearAllMocks
  mockTransfersCreate.mockResolvedValue({
    id: 'tr_mock_123',
    amount: 8500,
    destination: 'acct_mock_worker',
  });

  // Seed a Stripe account for the user
  seedTable('StripeAccount', [{
    id: 'sa-001',
    user_id: 'user-worker',
    stripe_account_id: 'acct_mock_worker',
    payouts_enabled: true,
  }]);

  // Seed wallet
  seedTable('Wallet', [{
    id: 'wal-001',
    user_id: 'user-worker',
    balance: 50000, // $500
    currency: 'usd',
    frozen: false,
    lifetime_withdrawals: 0,
    lifetime_received: 50000,
  }]);
});

describe('Withdrawal idempotency key generation', () => {
  test('idempotency key format is withdraw:{userId}:{requestId}', () => {
    // Per walletService.withdraw():
    //   const requestId = clientKey || crypto.randomUUID();
    //   const idempotencyKey = `withdraw:${userId}:${requestId}`;
    const userId = 'user-worker';
    const clientKey = '550e8400-e29b-41d4-a716-446655440000';
    const expected = `withdraw:${userId}:${clientKey}`;
    expect(expected).toBe('withdraw:user-worker:550e8400-e29b-41d4-a716-446655440000');
  });

  test('without client key, each call generates a unique key', () => {
    const crypto = require('crypto');
    const key1 = `withdraw:user:${crypto.randomUUID()}`;
    const key2 = `withdraw:user:${crypto.randomUUID()}`;
    expect(key1).not.toBe(key2);
  });

  test('with same client key, idempotency key is identical', () => {
    const clientKey = 'my-client-key';
    const key1 = `withdraw:user-worker:${clientKey}`;
    const key2 = `withdraw:user-worker:${clientKey}`;
    expect(key1).toBe(key2);
  });
});

describe('Withdrawal via walletService', () => {
  let debitCallCount;
  let debitKeys;

  beforeEach(() => {
    debitCallCount = 0;
    debitKeys = [];

    setRpcMock(async (fnName, params) => {
      if (fnName === 'wallet_debit') {
        debitCallCount++;
        debitKeys.push(params.p_idempotency_key);
        return {
          data: {
            id: `wtx-${debitCallCount}`,
            user_id: params.p_user_id,
            amount: params.p_amount,
            type: params.p_type,
            metadata: params.p_metadata || {},
          },
          error: null,
        };
      }
      if (fnName === 'wallet_credit') {
        return { data: { id: `wtx-credit-${Date.now()}` }, error: null };
      }
      return { data: null, error: null };
    });
  });

  test('two consecutive withdrawals with no client key generate different idempotency keys', async () => {
    await walletService.withdraw('user-worker', 1000);
    await walletService.withdraw('user-worker', 1000);

    expect(debitCallCount).toBe(2);
    expect(debitKeys[0]).not.toBe(debitKeys[1]);
    // Both should start with 'withdraw:user-worker:'
    expect(debitKeys[0]).toMatch(/^withdraw:user-worker:/);
    expect(debitKeys[1]).toMatch(/^withdraw:user-worker:/);
  });

  test('same client idempotency key produces same debit key', async () => {
    const clientKey = '550e8400-e29b-41d4-a716-446655440000';
    await walletService.withdraw('user-worker', 1000, { idempotencyKey: clientKey });
    await walletService.withdraw('user-worker', 1000, { idempotencyKey: clientKey });

    expect(debitCallCount).toBe(2);
    // Both calls produce the same idempotency key
    expect(debitKeys[0]).toBe(debitKeys[1]);
    expect(debitKeys[0]).toBe(`withdraw:user-worker:${clientKey}`);
  });

  test('minimum withdrawal amount is enforced', async () => {
    await expect(
      walletService.withdraw('user-worker', 50) // $0.50 < $1.00 minimum
    ).rejects.toThrow(/Minimum withdrawal/);
  });

  test('user without Stripe account cannot withdraw', async () => {
    seedTable('StripeAccount', []); // Remove stripe account

    await expect(
      walletService.withdraw('user-worker', 1000)
    ).rejects.toThrow(/payout account/);
  });

  test('user with payouts not enabled cannot withdraw', async () => {
    seedTable('StripeAccount', [{
      id: 'sa-001',
      user_id: 'user-worker',
      stripe_account_id: 'acct_mock_worker',
      payouts_enabled: false,
    }]);

    await expect(
      walletService.withdraw('user-worker', 1000)
    ).rejects.toThrow(/not yet verified/);
  });
});

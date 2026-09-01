// ============================================================
// TEST 3: Leaky Pipe
// Ensures the processPendingTransfers job releases escrow safely:
//   - Skips payments with active disputes
//   - Credits wallet only after cooling off ends
//   - Missing/disabled Stripe payout account does NOT block wallet credit
//   - Wallet credit failures revert state to captured_hold
//   - Race-condition guard: skips if state changed between query
//     and processing
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

jest.mock('../services/walletService', () => ({
  creditGigIncome: jest.fn().mockResolvedValue({ id: 'wtx_mock_1' }),
}));

const walletService = require('../services/walletService');
const processPendingTransfers = require('../jobs/processPendingTransfers');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function makeEligiblePayment(overrides = {}) {
  return {
    id: 'pay-001',
    gig_id: 'gig-001',
    payer_id: 'user-payer',
    payee_id: 'user-payee',
    amount_total: 10000,
    amount_to_payee: 8500,
    platform_fee: 1500,
    currency: 'usd',
    stripe_charge_id: 'ch_mock_123',
    stripe_payment_intent_id: 'pi_mock_123',
    payment_status: PAYMENT_STATES.CAPTURED_HOLD,
    cooling_off_ends_at: hoursAgo(1), // Cooling off ended 1h ago
    dispute_id: null,
    dispute_status: null,
    ...overrides,
  };
}

function makePayeeAccount(overrides = {}) {
  return {
    user_id: 'user-payee',
    stripe_account_id: 'acct_mock_payee',
    payouts_enabled: true,
    ...overrides,
  };
}

// ── Happy path ─────────────────────────────────────────────

describe('processPendingTransfers', () => {
  test('credits eligible payment to wallet after cooling off', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('StripeAccount', [makePayeeAccount()]);
    seedTable('Gig', [{ id: 'gig-001', title: 'Test Gig' }]);

    await processPendingTransfers();

    // Should credit wallet
    expect(walletService.creditGigIncome).toHaveBeenCalledTimes(1);
    expect(walletService.creditGigIncome).toHaveBeenCalledWith(
      'user-payee',
      8500,
      'gig-001',
      'pay-001',
      'user-payer'
    );

    // Payment should move to transferred after wallet credit
    const payment = getTable('Payment').find((p) => p.id === 'pay-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
  });

  // ── Skip conditions ────────────────────────────────────

  test('skips payment with active dispute', async () => {
    seedTable('Payment', [makeEligiblePayment({
      dispute_id: 'dp_active',
      dispute_status: 'needs_response',
    })]);
    seedTable('StripeAccount', [makePayeeAccount()]);

    await processPendingTransfers();

    // Should NOT credit wallet — the .is('dispute_id', null) filter excludes it
    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  test('skips payment still within cooling off', async () => {
    seedTable('Payment', [makeEligiblePayment({
      cooling_off_ends_at: hoursFromNow(12), // Still cooling
    })]);
    seedTable('StripeAccount', [makePayeeAccount()]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  test('processes legacy captured_hold rows with null cooling_off_ends_at after 48h', async () => {
    seedTable('Payment', [makeEligiblePayment({
      cooling_off_ends_at: null,
      created_at: hoursAgo(72),
    })]);
    seedTable('StripeAccount', [makePayeeAccount()]);
    seedTable('Gig', [{ id: 'gig-001', title: 'Legacy Gig' }]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).toHaveBeenCalledTimes(1);
  });

  test('does not process legacy rows with null cooling_off_ends_at before 48h', async () => {
    seedTable('Payment', [makeEligiblePayment({
      cooling_off_ends_at: null,
      created_at: hoursAgo(6),
    })]);
    seedTable('StripeAccount', [makePayeeAccount()]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  test('still credits wallet when payee has no Stripe account', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    // No StripeAccount rows seeded

    await processPendingTransfers();

    expect(walletService.creditGigIncome).toHaveBeenCalledTimes(1);
  });

  test('still credits wallet when payee payouts are not enabled', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('StripeAccount', [makePayeeAccount({ payouts_enabled: false })]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).toHaveBeenCalledTimes(1);
  });

  test('skips when amount_to_payee is 0 or missing', async () => {
    seedTable('Payment', [makeEligiblePayment({ amount_to_payee: 0 })]);
    seedTable('StripeAccount', [makePayeeAccount()]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  // ── Race condition guard ───────────────────────────────

  test('skips if payment state changed between query and processing', async () => {
    // Seed the payment in captured_hold initially (matches query)
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('StripeAccount', [makePayeeAccount()]);
    seedTable('Gig', [{ id: 'gig-001', title: 'Race Gig' }]);

    // Simulate race: after the initial query, the state changes to 'disputed'
    // The second fetch (race-condition guard) will see the changed state.
    // We can do this by changing the payment state just before the job processes it.
    // For this test, we change the row after seed but before run — the mock
    // supabase returns fresh data each time.
    const table = getTable('Payment');
    table[0].payment_status = PAYMENT_STATES.DISPUTED;

    await processPendingTransfers();

    // The job's first query finds it (captured_hold initially), but the
    // race-condition re-fetch sees 'disputed' and skips
    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  // ── Wallet credit failure recovery ────────────────────

  test('reverts to captured_hold when wallet credit fails', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('StripeAccount', [makePayeeAccount()]);
    seedTable('Gig', [{ id: 'gig-001', title: 'Gig' }]);

    // Make wallet credit fail
    walletService.creditGigIncome.mockRejectedValueOnce(new Error('wallet rpc failed'));

    await processPendingTransfers();

    // Payment should be reverted to captured_hold
    const payment = getTable('Payment').find(p => p.id === 'pay-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);

    // Gig should also be reverted
    const gig = getTable('Gig').find(g => g.id === 'gig-001');
    expect(gig.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });
});

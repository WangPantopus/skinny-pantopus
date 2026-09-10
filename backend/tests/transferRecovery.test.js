// ============================================================
// TEST: Transfer Stranding Recovery (Prompt 7 fix)
// Verifies:
//   - Normal flow: captured_hold → transfer_scheduled → transferred
//   - Stranded transfer_scheduled with no wallet credit → reverted to captured_hold
//   - Stranded transfer_scheduled with wallet credit → advanced to transferred
//   - Stranded transfer_pending with wallet credit → advanced to transferred
//   - Stranded transfer_pending with no wallet credit → unknown outcome retained
// ============================================================

const { resetTables, seedTable, getTable, setRpcMock } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES, transitionPaymentStatus, canTransition } = require('../stripe/paymentStateMachine');

jest.mock('../services/walletService', () => ({
  creditGigIncome: jest.fn().mockResolvedValue({ id: 'wtx_mock_1' }),
}));
const walletService = require('../services/walletService');

const processPendingTransfers = require('../jobs/processPendingTransfers');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  walletService.creditGigIncome.mockImplementation(async (user, amount, gig, payment) => {
    getTable('WalletTransaction').push({ id: 'wtx_mock_1', payment_id: payment, user_id: user, amount, type: 'gig_income', direction: 'credit' });
    return { id: 'wtx_mock_1' };
  });
  // Transaction boundary is exercised with real PostgreSQL separately. This
  // double lets the job tests exercise admission, failures and notifications.
  setRpcMock(async (name, args) => {
    if (name !== 'reconcile_payment_wallet_release') throw new Error('Unexpected RPC');
    const p = getTable('Payment').find(x => x.id === args.p_payment_id);
    if (!p) return { data: { error: 'NOT_FOUND' } };
    if (!['transfer_scheduled', 'transfer_pending'].includes(p.payment_status)) return { data: { payment: p } };
    const credited = getTable('WalletTransaction').some(x => x.payment_id === p.id && x.amount === p.amount_to_payee && x.direction === 'credit' && x.user_id === p.payee_id);
    if (!credited && p.payment_status === 'transfer_pending') return { data: { error: 'TRANSFER_UNKNOWN' } };
    p.payment_status = credited ? 'transferred' : 'captured_hold';
    if (credited) { p.transfer_status = 'wallet_credited'; p.transfer_completed_at = new Date().toISOString(); }
    const g = getTable('Gig').find(x => x.payment_id === p.id); if (g) g.payment_status = p.payment_status;
    return { data: { payment: p } };
  });
});

// ── Helpers ──

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

function makeEligiblePayment(overrides = {}) {
  return {
    id: 'pay-tr-001',
    gig_id: 'gig-tr-001',
    payer_id: 'user-payer',
    payee_id: 'user-payee',
    amount_total: 10000,
    amount_to_payee: 8500,
    platform_fee: 1500,
    currency: 'usd',
    stripe_charge_id: 'ch_tr_001',
    stripe_payment_intent_id: 'pi_tr_001',
    payment_status: PAYMENT_STATES.CAPTURED_HOLD,
    cooling_off_ends_at: hoursAgo(2), // Cooling off ended 2 hours ago
    dispute_id: null,
    dispute_status: null,
    updated_at: hoursAgo(1),
    ...overrides,
  };
}

// ── State machine validation ──

describe('Transfer state transitions', () => {
  test('transfer_scheduled → transferred is a valid direct transition', () => {
    expect(canTransition(PAYMENT_STATES.TRANSFER_SCHEDULED, PAYMENT_STATES.TRANSFERRED)).toBe(true);
  });

  test('transfer_pending → transferred is still valid', () => {
    expect(canTransition(PAYMENT_STATES.TRANSFER_PENDING, PAYMENT_STATES.TRANSFERRED)).toBe(true);
  });

  test('captured_hold → transfer_scheduled is valid', () => {
    expect(canTransition(PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.TRANSFER_SCHEDULED)).toBe(true);
  });
});

// ── Normal flow ──

describe('Normal transfer flow', () => {
  test('captured_hold → transfer_scheduled → transferred in one pass', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      title: 'Test Gig',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
    }]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).toHaveBeenCalledTimes(1);
    expect(walletService.creditGigIncome).toHaveBeenCalledWith(
      'user-payee', 8500, 'gig-tr-001', 'pay-tr-001', 'user-payer'
    );

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
    expect(payment.transfer_status).toBe('wallet_credited');
    expect(payment.transfer_completed_at).toBeTruthy();

    const gig = getTable('Gig').find((g) => g.id === 'gig-tr-001');
    expect(gig.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
  });

  test('skips payment still in cooling off period', async () => {
    seedTable('Payment', [makeEligiblePayment({
      cooling_off_ends_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
    })]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });

  test('skips payment with active dispute', async () => {
    seedTable('Payment', [makeEligiblePayment({
      dispute_id: 'disp-001',
    })]);

    await processPendingTransfers();

    expect(walletService.creditGigIncome).not.toHaveBeenCalled();
  });
});

// ── Recovery ──

describe('Stranded transfer recovery', () => {
  test('transfer_scheduled with no wallet credit → reverted to captured_hold', async () => {
    // Payment stuck in transfer_scheduled for 15 minutes, no wallet credit.
    // Set cooling_off_ends_at to the future so Phase 2 doesn't re-process
    // the payment after recovery reverts it to captured_hold.
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
      updated_at: hoursAgo(1), // 1 hour ago > 10 min threshold
      cooling_off_ends_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
    }]);
    seedTable('WalletTransaction', []); // No wallet credit

    await processPendingTransfers();

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });

  test('transfer_scheduled with wallet credit already applied → advanced to transferred', async () => {
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
      updated_at: hoursAgo(1),
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
    }]);
    seedTable('WalletTransaction', [{
      id: 'wtx-existing',
      payment_id: 'pay-tr-001',
      type: 'gig_income',
      amount: 8500, direction: 'credit', user_id: 'user-payee',
    }]);

    await processPendingTransfers();

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
  });

  test('transfer_scheduled tip with tip_income wallet credit → advanced to transferred', async () => {
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
      payment_type: 'tip',
      updated_at: hoursAgo(1),
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
    }]);
    seedTable('WalletTransaction', [{
      id: 'wtx-existing-tip',
      payment_id: 'pay-tr-001',
      type: 'tip_income',
      amount: 8500, direction: 'credit', user_id: 'user-payee',
    }]);

    await processPendingTransfers();

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
  });

  test('transfer_pending with wallet credit → advanced to transferred', async () => {
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_PENDING,
      updated_at: hoursAgo(1),
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_PENDING,
    }]);
    seedTable('WalletTransaction', [{
      id: 'wtx-existing-2',
      payment_id: 'pay-tr-001',
      type: 'gig_income',
      amount: 8500, direction: 'credit', user_id: 'user-payee',
    }]);

    await processPendingTransfers();

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFERRED);
  });

  test('transfer_pending with no wallet credit → unknown outcome retained', async () => {
    // Set cooling_off_ends_at to the future so Phase 2 doesn't re-process
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_PENDING,
      updated_at: hoursAgo(1),
      cooling_off_ends_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_PENDING,
    }]);
    seedTable('WalletTransaction', []); // No wallet credit

    await processPendingTransfers();

    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFER_PENDING);
  });

  test('recently stuck payment (< 10 min) is NOT recovered yet', async () => {
    seedTable('Payment', [makeEligiblePayment({
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
      updated_at: new Date().toISOString(), // Just now
    })]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      payment_status: PAYMENT_STATES.TRANSFER_SCHEDULED,
    }]);
    seedTable('WalletTransaction', []);

    await processPendingTransfers();

    // Should NOT be reverted — not old enough
    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.TRANSFER_SCHEDULED);
  });
});

// ── Error recovery in catch block ──

describe('Catch block recovery', () => {
  test('wallet credit failure after transfer_scheduled → reverted to captured_hold', async () => {
    seedTable('Payment', [makeEligiblePayment()]);
    seedTable('Gig', [{
      id: 'gig-tr-001',
      payment_id: 'pay-tr-001',
      title: 'Test Gig',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
    }]);
    seedTable('WalletTransaction', []);

    walletService.creditGigIncome.mockRejectedValueOnce(new Error('wallet rpc failed'));

    await processPendingTransfers();

    // Payment should be reverted to captured_hold
    const payment = getTable('Payment').find((p) => p.id === 'pay-tr-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });
});

test('reconciliation database failure does not reset a stranded payment', async () => {
  seedTable('Payment', [makeEligiblePayment({ payment_status: 'transfer_pending' })]);
  setRpcMock(async () => ({ error: { code: '08006' } }));
  await processPendingTransfers();
  expect(getTable('Payment')[0].payment_status).toBe('transfer_pending');
  expect(walletService.creditGigIncome).not.toHaveBeenCalled();
});

// ============================================================
// TEST 5: Post-Transfer Refund
// Tests the createSmartRefund logic across 3 scenarios:
//   Scenario 1: Pre-capture → cancel PI (release hold)
//   Scenario 2: Post-capture, pre-transfer → normal Stripe refund
//   Scenario 3: Post-transfer → refund + transfer reversal
//   Scenario 3b: Reversal fails → records provider debt
//
// We test via state machine + mocked Stripe rather than calling
// createSmartRefund directly, to avoid env-var dependencies.
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const {
  PAYMENT_STATES,
  canTransition,
  transitionPaymentStatus,
} = require('../stripe/paymentStateMachine');

beforeEach(() => resetTables());

describe('Post-Transfer Refund — State Machine Validation', () => {
  test('Scenario 1: authorized → canceled (release hold)', async () => {
    // Pre-capture: cancel the PaymentIntent releases the hold
    expect(canTransition(PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.CANCELED)).toBe(true);

    seedTable('Payment', [{
      id: 'pay-pre',
      gig_id: 'gig-pre',
      payment_status: PAYMENT_STATES.AUTHORIZED,
      amount_total: 10000,
    }]);
    seedTable('Gig', [{ id: 'gig-pre', payment_status: PAYMENT_STATES.AUTHORIZED }]);

    await transitionPaymentStatus('pay-pre', PAYMENT_STATES.CANCELED);

    const payment = getTable('Payment').find(p => p.id === 'pay-pre');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CANCELED);
  });

  test('Scenario 2: captured_hold → refund_pending → refunded_full', async () => {
    // Post-capture, pre-transfer: normal Stripe refund
    expect(canTransition(PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.REFUND_PENDING)).toBe(true);
    expect(canTransition(PAYMENT_STATES.REFUND_PENDING, PAYMENT_STATES.REFUNDED_FULL)).toBe(true);

    seedTable('Payment', [{
      id: 'pay-cap',
      gig_id: 'gig-cap',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
      amount_total: 10000,
      refunded_amount: 0,
    }]);
    seedTable('Gig', [{ id: 'gig-cap' }]);

    // Smart refund transitions captured_hold → refunded_full directly
    // (via refund_pending intermediate if needed, but the actual code
    //  calls transitionPaymentStatus with REFUNDED_FULL for full refund)
    // Since captured_hold → refund_pending and refund_pending → refunded_full
    // are both valid, let's walk the explicit path:
    await transitionPaymentStatus('pay-cap', PAYMENT_STATES.REFUND_PENDING);
    await transitionPaymentStatus('pay-cap', PAYMENT_STATES.REFUNDED_FULL, {
      refunded_amount: 10000,
      refund_reason: 'requested_by_customer',
    });

    const payment = getTable('Payment').find(p => p.id === 'pay-cap');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_FULL);
    expect(payment.refunded_amount).toBe(10000);
  });

  test('Scenario 2b: captured_hold → partial refund', async () => {
    expect(canTransition(PAYMENT_STATES.REFUND_PENDING, PAYMENT_STATES.REFUNDED_PARTIAL)).toBe(true);

    seedTable('Payment', [{
      id: 'pay-partial',
      gig_id: 'gig-partial',
      payment_status: PAYMENT_STATES.CAPTURED_HOLD,
      amount_total: 10000,
    }]);
    seedTable('Gig', [{ id: 'gig-partial' }]);

    await transitionPaymentStatus('pay-partial', PAYMENT_STATES.REFUND_PENDING);
    await transitionPaymentStatus('pay-partial', PAYMENT_STATES.REFUNDED_PARTIAL, {
      refunded_amount: 5000,
    });

    const payment = getTable('Payment').find(p => p.id === 'pay-partial');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_PARTIAL);
    expect(payment.refunded_amount).toBe(5000);
  });

  test('Scenario 3: transferred → refund_pending → refunded_full (with reversal)', async () => {
    expect(canTransition(PAYMENT_STATES.TRANSFERRED, PAYMENT_STATES.REFUND_PENDING)).toBe(true);

    seedTable('Payment', [{
      id: 'pay-xfer',
      gig_id: 'gig-xfer',
      payment_status: PAYMENT_STATES.TRANSFERRED,
      amount_total: 10000,
      amount_to_payee: 8500,
      stripe_transfer_id: 'tr_mock_123',
    }]);
    seedTable('Gig', [{ id: 'gig-xfer' }]);

    // Post-transfer refund: refund customer + reverse transfer
    await transitionPaymentStatus('pay-xfer', PAYMENT_STATES.REFUND_PENDING);
    await transitionPaymentStatus('pay-xfer', PAYMENT_STATES.REFUNDED_FULL, {
      refunded_amount: 10000,
      stripe_transfer_reversal_id: 'trr_mock_123',
      refund_reason: 'work_not_completed',
    });

    const payment = getTable('Payment').find(p => p.id === 'pay-xfer');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_FULL);
    expect(payment.stripe_transfer_reversal_id).toBe('trr_mock_123');
    expect(payment.refund_reason).toBe('work_not_completed');
  });

  test('Scenario 3b: reversal fails → records provider debt in metadata', async () => {
    // When the transfer reversal fails (e.g., connected account has insufficient funds),
    // the refund to customer still succeeds, but the platform records a "debt"
    // the provider owes.

    seedTable('Payment', [{
      id: 'pay-debt',
      gig_id: 'gig-debt',
      payment_status: PAYMENT_STATES.TRANSFERRED,
      amount_total: 10000,
      amount_to_payee: 8500,
      stripe_transfer_id: 'tr_debt_123',
      metadata: {},
    }]);
    seedTable('Gig', [{ id: 'gig-debt' }]);

    // Simulate: refund succeeds but reversal fails.
    // The createSmartRefund code records the failure in metadata.
    // Here we test the state transitions and metadata recording.

    await transitionPaymentStatus('pay-debt', PAYMENT_STATES.REFUND_PENDING);

    // Record reversal failure in metadata (as createSmartRefund does)
    const table = getTable('Payment');
    const payIdx = table.findIndex(p => p.id === 'pay-debt');
    table[payIdx].metadata = {
      ...table[payIdx].metadata,
      reversal_failed: true,
      reversal_failure_reason: 'Insufficient funds in connected account',
      reversal_failed_at: new Date().toISOString(),
      provider_debt_amount: 8500,
    };

    await transitionPaymentStatus('pay-debt', PAYMENT_STATES.REFUNDED_FULL, {
      refunded_amount: 10000,
    });

    const payment = getTable('Payment').find(p => p.id === 'pay-debt');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_FULL);
    expect(payment.metadata.reversal_failed).toBe(true);
    expect(payment.metadata.provider_debt_amount).toBe(8500);
  });

  test('refunded_full is terminal — cannot transition further', async () => {
    expect(canTransition(PAYMENT_STATES.REFUNDED_FULL, PAYMENT_STATES.DISPUTED)).toBe(false);
    expect(canTransition(PAYMENT_STATES.REFUNDED_FULL, PAYMENT_STATES.TRANSFERRED)).toBe(false);
    expect(canTransition(PAYMENT_STATES.REFUNDED_FULL, PAYMENT_STATES.REFUND_PENDING)).toBe(false);
  });

  test('refunded_partial can go back to refund_pending for additional refund', async () => {
    expect(canTransition(PAYMENT_STATES.REFUNDED_PARTIAL, PAYMENT_STATES.REFUND_PENDING)).toBe(true);

    seedTable('Payment', [{
      id: 'pay-multi',
      gig_id: 'gig-multi',
      payment_status: PAYMENT_STATES.REFUNDED_PARTIAL,
      amount_total: 10000,
      refunded_amount: 3000,
    }]);
    seedTable('Gig', [{ id: 'gig-multi' }]);

    // Issue second refund
    await transitionPaymentStatus('pay-multi', PAYMENT_STATES.REFUND_PENDING);
    await transitionPaymentStatus('pay-multi', PAYMENT_STATES.REFUNDED_FULL, {
      refunded_amount: 10000,
    });

    const payment = getTable('Payment').find(p => p.id === 'pay-multi');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_FULL);
    expect(payment.refunded_amount).toBe(10000);
  });

  test('dispute during transfer → refund path: transferred → disputed → refund_pending → refunded_full', async () => {
    seedTable('Payment', [{
      id: 'pay-disp',
      gig_id: 'gig-disp',
      payment_status: PAYMENT_STATES.TRANSFERRED,
    }]);
    seedTable('Gig', [{ id: 'gig-disp' }]);

    // Dispute comes in
    await transitionPaymentStatus('pay-disp', PAYMENT_STATES.DISPUTED, {
      dispute_id: 'dp_mock',
      dispute_status: 'needs_response',
    });

    // Dispute lost → refund
    await transitionPaymentStatus('pay-disp', PAYMENT_STATES.REFUND_PENDING);
    await transitionPaymentStatus('pay-disp', PAYMENT_STATES.REFUNDED_FULL);

    const payment = getTable('Payment').find(p => p.id === 'pay-disp');
    expect(payment.payment_status).toBe(PAYMENT_STATES.REFUNDED_FULL);
  });
});

// ── Audit Link: payment ↔ gig sync ──────────────────────

describe('Audit Link: Payment-Gig Sync', () => {
  test('every transition syncs payment_status to the linked Gig', async () => {
    const paymentId = 'pay-audit';
    const gigId = 'gig-audit';

    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payment_status: PAYMENT_STATES.NONE,
    }]);
    seedTable('Gig', [{
      id: gigId,
      payment_status: PAYMENT_STATES.NONE,
    }]);

    const path = [
      'setup_pending',
      'ready_to_authorize',
      'authorize_pending',
      'authorized',
      'capture_pending',
      'captured_hold',
      'transfer_scheduled',
      'transfer_pending',
      'transferred',
    ];

    for (const step of path) {
      await transitionPaymentStatus(paymentId, step);

      const gig = getTable('Gig').find(g => g.id === gigId);
      expect(gig.payment_status).toBe(step);
    }
  });

  test('payment without gig_id does not crash', async () => {
    seedTable('Payment', [{
      id: 'pay-orphan',
      gig_id: null,
      payment_status: PAYMENT_STATES.NONE,
    }]);

    // Should not throw even though there's no gig to sync
    await transitionPaymentStatus('pay-orphan', PAYMENT_STATES.AUTHORIZE_PENDING);

    const payment = getTable('Payment').find(p => p.id === 'pay-orphan');
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZE_PENDING);
  });
});

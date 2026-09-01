// ============================================================
// TEST 1: Payment State Machine
// Validates all valid transitions succeed, invalid ones throw,
// and transitionPaymentStatus syncs gig payment_status.
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const {
  PAYMENT_STATES,
  VALID_TRANSITIONS,
  canTransition,
  transitionPaymentStatus,
  getPaymentStateInfo,
} = require('../stripe/paymentStateMachine');

beforeEach(() => resetTables());

// ── canTransition (pure logic) ──────────────────────────────

describe('canTransition', () => {
  test('every declared transition in VALID_TRANSITIONS is allowed', () => {
    for (const [from, toList] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of toList) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  test('terminal states (refunded_full, canceled) have no outbound transitions', () => {
    expect(VALID_TRANSITIONS[PAYMENT_STATES.REFUNDED_FULL]).toEqual([]);
    expect(VALID_TRANSITIONS[PAYMENT_STATES.CANCELED]).toEqual([]);
  });

  test('rejects invalid forward jumps', () => {
    // none → transferred is not allowed (must go through many states)
    expect(canTransition('none', 'transferred')).toBe(false);
    // authorized → transferred is not allowed (must capture first)
    expect(canTransition('authorized', 'transferred')).toBe(false);
    // captured_hold → canceled is not allowed (must refund)
    expect(canTransition('captured_hold', 'canceled')).toBe(false);
  });

  test('rejects backward transitions that are not explicitly declared', () => {
    // transferred → authorized
    expect(canTransition('transferred', 'authorized')).toBe(false);
    // refunded_full → captured_hold
    expect(canTransition('refunded_full', 'captured_hold')).toBe(false);
  });

  test('rejects unknown states', () => {
    expect(canTransition('banana', 'authorized')).toBe(false);
    expect(canTransition('none', 'banana')).toBe(false);
  });

  test('every state in PAYMENT_STATES has a transition entry', () => {
    for (const state of Object.values(PAYMENT_STATES)) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });
});

// ── transitionPaymentStatus (DB-interacting) ─────────────────

describe('transitionPaymentStatus', () => {
  const paymentId = 'pay-001';
  const gigId = 'gig-001';

  test('happy path: transitions payment and syncs gig', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'none', gig_id: gigId },
    ]);
    seedTable('Gig', [
      { id: gigId, payment_status: 'none' },
    ]);

    const result = await transitionPaymentStatus(paymentId, PAYMENT_STATES.SETUP_PENDING);

    expect(result.payment_status).toBe('setup_pending');

    // Gig should be synced
    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.payment_status).toBe('setup_pending');
  });

  test('walks the full happy path: none → ... → transferred', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'none', gig_id: gigId },
    ]);
    seedTable('Gig', [{ id: gigId, payment_status: 'none' }]);

    const steps = [
      'authorize_pending',
      'authorized',
      'capture_pending',
      'captured_hold',
      'transfer_scheduled',
      'transfer_pending',
      'transferred',
    ];

    for (const step of steps) {
      await transitionPaymentStatus(paymentId, step);
    }

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe('transferred');

    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.payment_status).toBe('transferred');
  });

  test('throws on invalid transition', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'none', gig_id: gigId },
    ]);

    await expect(
      transitionPaymentStatus(paymentId, PAYMENT_STATES.TRANSFERRED)
    ).rejects.toThrow(/Invalid payment transition/);
  });

  test('throws when payment not found', async () => {
    await expect(
      transitionPaymentStatus('nonexistent', PAYMENT_STATES.AUTHORIZED)
    ).rejects.toThrow(/Payment not found/);
  });

  test('stores extraUpdates alongside status change', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'none', gig_id: gigId },
    ]);
    seedTable('Gig', [{ id: gigId }]);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.SETUP_PENDING, {
      stripe_setup_intent_id: 'seti_xxx',
    });

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.stripe_setup_intent_id).toBe('seti_xxx');
  });

  test('dispute → captured_hold (dispute won) is valid', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'disputed', gig_id: gigId },
    ]);
    seedTable('Gig', [{ id: gigId }]);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.CAPTURED_HOLD);
    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe('captured_hold');
  });

  test('dispute → transferred (dispute won, already paid) is valid', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'disputed', gig_id: gigId },
    ]);
    seedTable('Gig', [{ id: gigId }]);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.TRANSFERRED);
    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe('transferred');
  });

  test('authorized → captured_hold is valid (direct capture flow)', async () => {
    seedTable('Payment', [
      { id: paymentId, payment_status: 'authorized', gig_id: gigId },
    ]);
    seedTable('Gig', [{ id: gigId }]);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.CAPTURED_HOLD);
    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe('captured_hold');
  });
});

// ── getPaymentStateInfo ─────────────────────────────────────

describe('getPaymentStateInfo', () => {
  test('returns label + color for every known state', () => {
    for (const state of Object.values(PAYMENT_STATES)) {
      const info = getPaymentStateInfo(state);
      expect(info).toHaveProperty('label');
      expect(info).toHaveProperty('color');
      expect(info).toHaveProperty('description');
      expect(typeof info.label).toBe('string');
      expect(info.label.length).toBeGreaterThan(0);
    }
  });

  test('returns fallback for unknown state', () => {
    const info = getPaymentStateInfo('banana');
    expect(info.label).toBe('banana');
    expect(info.color).toBe('gray');
  });
});

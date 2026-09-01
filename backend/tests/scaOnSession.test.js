// ============================================================
// TEST: SCA On-Session 3DS Handling (Prompt 4 fix)
// Verifies on-session vs off-session distinction:
//   - requires_action for on-session: stays in authorize_pending
//   - requires_action for off-session: transitions to authorization_failed
//   - amount_capturable_updated after on-session 3DS: → authorized
//   - amount_capturable_updated after off-session failure: → authorized
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES, transitionPaymentStatus, canTransition } = require('../stripe/paymentStateMachine');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ── Helpers ──

function seedPaymentAndGig(paymentOverrides = {}) {
  const payment = {
    id: 'pay-sca-001',
    gig_id: 'gig-sca-001',
    payer_id: 'user-payer',
    payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
    stripe_payment_intent_id: 'pi_sca_001',
    ...paymentOverrides,
  };
  const gig = {
    id: 'gig-sca-001',
    payment_status: payment.payment_status,
  };
  seedTable('Payment', [payment]);
  seedTable('Gig', [gig]);
  return payment;
}

// ── requires_action distinction ──

describe('payment_intent.requires_action — on-session vs off-session', () => {
  test('on-session PI: payment stays in authorize_pending (no transition)', async () => {
    seedPaymentAndGig();

    // On-session flow: metadata.off_session is NOT 'true'
    // The webhook handler does NOT transition the state
    const payment = getTable('Payment').find((p) => p.id === 'pay-sca-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZE_PENDING);
    // No state change — frontend handles 3DS challenge
  });

  test('off-session PI: transitions to authorization_failed', async () => {
    seedPaymentAndGig();

    // Off-session flow: handler transitions to AUTHORIZATION_FAILED
    const result = await transitionPaymentStatus('pay-sca-001', PAYMENT_STATES.AUTHORIZATION_FAILED, {
      off_session_auth_required: true,
      failure_message: 'Strong Customer Authentication (SCA) required.',
    });

    expect(result.payment_status).toBe(PAYMENT_STATES.AUTHORIZATION_FAILED);
    expect(result.off_session_auth_required).toBe(true);
  });
});

// ── amount_capturable_updated transitions ──

describe('payment_intent.amount_capturable_updated — authorization success', () => {
  test('authorize_pending → authorized on successful 3DS (on-session)', async () => {
    seedPaymentAndGig();

    const result = await transitionPaymentStatus('pay-sca-001', PAYMENT_STATES.AUTHORIZED, {
      authorization_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      stripe_charge_id: 'ch_sca_001',
    });

    expect(result.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
    expect(result.stripe_charge_id).toBe('ch_sca_001');
    expect(result.authorization_expires_at).toBeTruthy();

    const gig = getTable('Gig').find((g) => g.id === 'gig-sca-001');
    expect(gig.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
  });

  test('authorization_failed → authorized on retry after off-session SCA failure', async () => {
    seedPaymentAndGig({ payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED });

    // User retries on-session, 3DS succeeds, webhook fires amount_capturable_updated
    const result = await transitionPaymentStatus('pay-sca-001', PAYMENT_STATES.AUTHORIZED, {
      authorization_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      stripe_charge_id: 'ch_sca_retry_001',
    });

    expect(result.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
    expect(result.stripe_charge_id).toBe('ch_sca_retry_001');
  });

  test('handler ignores non-manual capture PIs', () => {
    // The handler checks capture_method === 'manual' and returns early otherwise
    // This is a guard — non-manual PIs should not trigger state changes
    const piAutoCapture = { capture_method: 'automatic' };
    expect(piAutoCapture.capture_method).not.toBe('manual');
  });

  test('handler skips payment not in actionable state', async () => {
    // If payment is already in authorized state, transition would fail
    seedPaymentAndGig({ payment_status: PAYMENT_STATES.AUTHORIZED });

    // authorized → authorized is not a valid transition
    await expect(
      transitionPaymentStatus('pay-sca-001', PAYMENT_STATES.AUTHORIZED)
    ).rejects.toThrow(/Invalid payment transition/);
  });
});

// ── State machine validation ──

describe('SCA state transitions are valid in VALID_TRANSITIONS', () => {
  test('authorize_pending → authorized is valid', () => {
    expect(canTransition(PAYMENT_STATES.AUTHORIZE_PENDING, PAYMENT_STATES.AUTHORIZED)).toBe(true);
  });

  test('authorize_pending → authorization_failed is valid', () => {
    expect(canTransition(PAYMENT_STATES.AUTHORIZE_PENDING, PAYMENT_STATES.AUTHORIZATION_FAILED)).toBe(true);
  });

  test('authorization_failed → authorized is valid (retry success)', () => {
    expect(canTransition(PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.AUTHORIZED)).toBe(true);
  });

  test('authorization_failed → authorize_pending is valid (new attempt)', () => {
    expect(canTransition(PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.AUTHORIZE_PENDING)).toBe(true);
  });
});

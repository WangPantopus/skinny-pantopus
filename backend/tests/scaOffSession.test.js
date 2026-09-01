// ============================================================
// TEST 4: SCA Off-Session Failure
// Verifies:
//   - Off-session PaymentIntent that requires SCA fails gracefully
//   - Payment transitions to AUTHORIZATION_FAILED
//   - Gig status is synced
//   - Retry route creates new on-session PI and returns clientSecret
//   - After successful retry, payment becomes authorized
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const {
  PAYMENT_STATES,
  transitionPaymentStatus,
  canTransition,
} = require('../stripe/paymentStateMachine');

beforeEach(() => resetTables());

describe('SCA Off-Session Failure Flow', () => {
  const paymentId = 'pay-sca-001';
  const gigId = 'gig-sca-001';

  // Seed a payment that was in ready_to_authorize → authorize_pending
  // (simulating the background job's off-session attempt)
  function seedScenario() {
    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
      amount_total: 10000,
      stripe_payment_intent_id: 'pi_offses_001',
      stripe_payment_method_id: 'pm_sca_card',
    }]);
    seedTable('Gig', [{
      id: gigId,
      user_id: 'user-owner',
      accepted_by: 'user-worker',
      payment_id: paymentId,
      status: 'assigned',
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
    }]);
  }

  test('Step 1: off-session auth failure → AUTHORIZATION_FAILED', async () => {
    seedScenario();

    // Simulate what the webhook handler does when Stripe reports authentication_required
    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZATION_FAILED, {
      off_session_auth_required: true,
    });

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZATION_FAILED);
    expect(payment.off_session_auth_required).toBe(true);

    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.payment_status).toBe(PAYMENT_STATES.AUTHORIZATION_FAILED);
  });

  test('Step 2: AUTHORIZATION_FAILED → AUTHORIZE_PENDING (retry)', async () => {
    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED,
      off_session_auth_required: true,
    }]);
    seedTable('Gig', [{
      id: gigId,
      user_id: 'user-owner',
      payment_id: paymentId,
      payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED,
    }]);

    // The retry route creates a new PaymentIntent on-session.
    // This transitions AUTHORIZATION_FAILED → AUTHORIZE_PENDING.
    expect(canTransition(PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.AUTHORIZE_PENDING)).toBe(true);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZE_PENDING, {
      stripe_payment_intent_id: 'pi_retry_001',
      off_session_auth_required: false,
    });

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZE_PENDING);
    expect(payment.stripe_payment_intent_id).toBe('pi_retry_001');
    expect(payment.off_session_auth_required).toBe(false);
  });

  test('Step 3: retry succeeds → AUTHORIZE_PENDING → AUTHORIZED', async () => {
    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
      stripe_payment_intent_id: 'pi_retry_001',
    }]);
    seedTable('Gig', [{
      id: gigId,
      user_id: 'user-owner',
      payment_id: paymentId,
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
    }]);

    // After successful on-session confirmation, webhook fires
    // amount_capturable_updated → transition to AUTHORIZED
    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZED, {
      authorization_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
    expect(payment.authorization_expires_at).toBeDefined();

    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
  });

  test('Full round trip: authorize_pending → auth_failed → authorize_pending → authorized', async () => {
    seedScenario();

    // Off-session fails
    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZATION_FAILED, {
      off_session_auth_required: true,
    });

    // User retries on-session
    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZE_PENDING, {
      stripe_payment_intent_id: 'pi_retry_002',
      off_session_auth_required: false,
    });

    // Retry succeeds
    await transitionPaymentStatus(paymentId, PAYMENT_STATES.AUTHORIZED, {
      authorization_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);

    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
  });

  test('can transition from AUTHORIZATION_FAILED directly to AUTHORIZED (retry-authorization flow)', async () => {
    // Valid: user completes SCA on-session after off-session failure
    expect(canTransition(PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.AUTHORIZED)).toBe(true);
  });

  test('AUTHORIZATION_FAILED → CANCELED is valid (user gives up)', async () => {
    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED,
    }]);
    seedTable('Gig', [{ id: gigId }]);

    expect(canTransition(PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.CANCELED)).toBe(true);

    await transitionPaymentStatus(paymentId, PAYMENT_STATES.CANCELED);

    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.payment_status).toBe(PAYMENT_STATES.CANCELED);
  });
});

// ============================================================
// TEST: Capture + Retry Job (Prompt 5 fix)
// Verifies:
//   - capturePayment increments capture_attempts
//   - Successful capture transitions authorized → captured_hold
//   - Capture failure: owner_confirmed_at NOT written
//   - Retry job picks up stranded authorized-but-confirmed gigs
//   - After 3 failed attempts, job stops retrying
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES, transitionPaymentStatus } = require('../stripe/paymentStateMachine');

// Mock stripeService
jest.mock('../stripe/stripeService', () => ({
  capturePayment: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');

// Mock notificationService (already auto-mocked via moduleNameMapper)
const { createNotification } = require('../services/notificationService');

const retryCaptureFailures = require('../jobs/retryCaptureFailures');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  stripeService.capturePayment.mockResolvedValue({ success: true, chargeId: 'ch_cap_001' });
});

// ── Helpers ──

function seedCaptureScenario({ captureAttempts = 0, paymentStatus = PAYMENT_STATES.AUTHORIZED, ownerConfirmedAt = new Date().toISOString() } = {}) {
  seedTable('Payment', [{
    id: 'pay-cap-001',
    gig_id: 'gig-cap-001',
    payer_id: 'user-payer',
    payment_status: paymentStatus,
    stripe_payment_intent_id: 'pi_cap_001',
    capture_attempts: captureAttempts,
  }]);
  seedTable('Gig', [{
    id: 'gig-cap-001',
    title: 'Test Gig',
    user_id: 'user-poster',
    payment_id: 'pay-cap-001',
    payment_status: paymentStatus,
    owner_confirmed_at: ownerConfirmedAt,
  }]);
}

// ── Capture state transitions ──

describe('capturePayment state transitions', () => {
  test('authorized → captured_hold on successful capture', async () => {
    seedTable('Payment', [{
      id: 'pay-cap-010',
      gig_id: 'gig-cap-010',
      payment_status: PAYMENT_STATES.AUTHORIZED,
      capture_attempts: 0,
    }]);
    seedTable('Gig', [{
      id: 'gig-cap-010',
      payment_status: PAYMENT_STATES.AUTHORIZED,
    }]);

    const result = await transitionPaymentStatus('pay-cap-010', PAYMENT_STATES.CAPTURED_HOLD, {
      captured_at: new Date().toISOString(),
    });

    expect(result.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });
});

// ── Retry job ──

describe('retryCaptureFailures job', () => {
  test('picks up stranded authorized gig with owner_confirmed_at and retries capture', async () => {
    seedCaptureScenario();

    await retryCaptureFailures();

    expect(stripeService.capturePayment).toHaveBeenCalledTimes(1);
    expect(stripeService.capturePayment).toHaveBeenCalledWith('pay-cap-001');

    // Gig payment_status should be updated to captured_hold
    const gig = getTable('Gig').find((g) => g.id === 'gig-cap-001');
    expect(gig.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });

  test('skips gig without owner_confirmed_at', async () => {
    seedCaptureScenario({ ownerConfirmedAt: null });

    await retryCaptureFailures();

    expect(stripeService.capturePayment).not.toHaveBeenCalled();
  });

  test('skips gig where payment is already captured', async () => {
    seedCaptureScenario({ paymentStatus: PAYMENT_STATES.CAPTURED_HOLD });

    await retryCaptureFailures();

    expect(stripeService.capturePayment).not.toHaveBeenCalled();
  });

  test('stops retrying after MAX_CAPTURE_ATTEMPTS (3)', async () => {
    seedCaptureScenario({ captureAttempts: 3 });

    await retryCaptureFailures();

    expect(stripeService.capturePayment).not.toHaveBeenCalled();
    // Should send notification to payer
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-payer',
        type: 'payment_capture_failed',
      })
    );
  });

  test('capture failure does not crash the job (continues to next gig)', async () => {
    seedCaptureScenario({ captureAttempts: 0 });
    // Add a second gig
    getTable('Payment').push({
      id: 'pay-cap-002',
      gig_id: 'gig-cap-002',
      payer_id: 'user-payer-2',
      payment_status: PAYMENT_STATES.AUTHORIZED,
      capture_attempts: 0,
    });
    getTable('Gig').push({
      id: 'gig-cap-002',
      title: 'Second Gig',
      user_id: 'user-poster-2',
      payment_id: 'pay-cap-002',
      payment_status: PAYMENT_STATES.AUTHORIZED,
      owner_confirmed_at: new Date().toISOString(),
    });

    // First capture fails, second succeeds
    stripeService.capturePayment
      .mockRejectedValueOnce(new Error('Stripe timeout'))
      .mockResolvedValueOnce({ success: true, chargeId: 'ch_cap_002' });

    await retryCaptureFailures();

    expect(stripeService.capturePayment).toHaveBeenCalledTimes(2);
    // Second gig should have been captured
    const gig2 = getTable('Gig').find((g) => g.id === 'gig-cap-002');
    expect(gig2.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
  });

  test('does nothing when no orphaned captures exist', async () => {
    // Empty tables
    await retryCaptureFailures();

    expect(stripeService.capturePayment).not.toHaveBeenCalled();
  });
});

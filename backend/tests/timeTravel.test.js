// ============================================================
// TEST 2: Time-Travel
// Verifies background jobs correctly handle time-based logic:
//   - authorizeUpcomingGigs picks up ready_to_authorize payments
//     for gigs starting within 24h
//   - authorizeUpcomingGigs auto-cancels gigs starting within 2h
//     with failed authorization
//   - expireUncapturedAuthorizations cancels gigs with expiring
//     auths (not started) and flags in-progress gigs
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

// Mock stripeService — we don't want real Stripe calls
jest.mock('../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn().mockResolvedValue({ success: true }),
  cancelAuthorization: jest.fn().mockResolvedValue({ success: true }),
}));

const stripeService = require('../stripe/stripeService');
const { createNotification } = require('../services/notificationService');
const authorizeUpcomingGigs = require('../jobs/authorizeUpcomingGigs');
const expireUncapturedAuthorizations = require('../jobs/expireUncapturedAuthorizations');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// ── authorizeUpcomingGigs ──────────────────────────────────

describe('authorizeUpcomingGigs', () => {
  test('Part 1: authorizes gig starting within 24h with saved card', async () => {
    const paymentId = 'pay-tt-001';
    const gigId = 'gig-tt-001';

    seedTable('Gig', [{
      id: gigId,
      user_id: 'user-owner',
      accepted_by: 'user-worker',
      payment_id: paymentId,
      title: 'Lawn mowing',
      scheduled_start: hoursFromNow(12), // 12 hours from now
      status: 'assigned',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
    }]);

    seedTable('Payment', [{
      id: paymentId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      amount_total: 10000,
      stripe_payment_method_id: 'pm_saved_card',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
      gig_id: gigId,
    }]);

    await authorizeUpcomingGigs();

    expect(stripeService.createPaymentIntentForGig).toHaveBeenCalledTimes(1);
    expect(stripeService.createPaymentIntentForGig).toHaveBeenCalledWith(
      expect.objectContaining({
        payerId: 'user-owner',
        payeeId: 'user-worker',
        amount: 10000,
        paymentMethodId: 'pm_saved_card',
        offSession: true,
        existingPaymentId: paymentId,
      })
    );
  });

  test('Part 1: skips gig starting beyond 24h', async () => {
    seedTable('Gig', [{
      id: 'gig-far',
      user_id: 'user-owner',
      accepted_by: 'user-worker',
      payment_id: 'pay-far',
      title: 'Future gig',
      scheduled_start: hoursFromNow(48), // 2 days from now
      status: 'assigned',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
    }]);
    seedTable('Payment', [{
      id: 'pay-far',
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      amount_total: 5000,
      stripe_payment_method_id: 'pm_saved_card',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
    }]);

    await authorizeUpcomingGigs();

    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
  });

  test('Part 1: SCA failure sends notification to requester', async () => {
    stripeService.createPaymentIntentForGig.mockResolvedValueOnce({
      success: false,
      error: 'authentication_required',
    });

    seedTable('Gig', [{
      id: 'gig-sca',
      user_id: 'user-owner',
      accepted_by: 'user-worker',
      payment_id: 'pay-sca',
      title: 'SCA Gig',
      scheduled_start: hoursFromNow(6),
      status: 'assigned',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
    }]);
    seedTable('Payment', [{
      id: 'pay-sca',
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      amount_total: 15000,
      stripe_payment_method_id: 'pm_sca_card',
      payment_status: PAYMENT_STATES.READY_TO_AUTHORIZE,
    }]);

    await authorizeUpcomingGigs();

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-owner',
        type: 'payment_auth_failed',
      })
    );
  });

  test('Part 2: auto-cancels gig starting within 2h with failed auth', async () => {
    seedTable('Gig', [{
      id: 'gig-fail',
      user_id: 'user-owner',
      accepted_by: 'user-worker',
      payment_id: 'pay-fail',
      title: 'Urgent Gig',
      scheduled_start: hoursFromNow(1), // 1 hour from now
      status: 'assigned',
      payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED,
    }]);
    seedTable('Payment', [{
      id: 'pay-fail',
      payment_status: PAYMENT_STATES.AUTHORIZATION_FAILED,
    }]);

    await authorizeUpcomingGigs();

    // Should cancel auth
    expect(stripeService.cancelAuthorization).toHaveBeenCalledWith('pay-fail');

    // Should update gig to cancelled
    const gig = getTable('Gig').find(g => g.id === 'gig-fail');
    expect(gig.status).toBe('cancelled');
    expect(gig.payment_status).toBe(PAYMENT_STATES.CANCELED);
    expect(gig.cancellation_reason).toBe('payment_authorization_failed');

    // Should notify both parties
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-owner', type: 'gig_auto_cancelled' })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-worker', type: 'gig_auto_cancelled' })
    );
  });
});

// ── expireUncapturedAuthorizations ─────────────────────────

describe('expireUncapturedAuthorizations', () => {
  test('Part 1: cancels auth + gig for assigned gig with expiring auth', async () => {
    const paymentId = 'pay-exp-001';
    const gigId = 'gig-exp-001';

    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      amount_total: 20000,
      payment_status: PAYMENT_STATES.AUTHORIZED,
      authorization_expires_at: hoursFromNow(10), // Expires in 10h (within 24h window)
    }]);
    seedTable('Gig', [{
      id: gigId,
      status: 'assigned',
      title: 'Plumbing Fix',
      user_id: 'user-owner',
      accepted_by: 'user-worker',
    }]);

    await expireUncapturedAuthorizations();

    // Auth should be cancelled
    expect(stripeService.cancelAuthorization).toHaveBeenCalledWith(paymentId);

    // Gig should be cancelled
    const gig = getTable('Gig').find(g => g.id === gigId);
    expect(gig.status).toBe('cancelled');
    expect(gig.cancellation_reason).toBe('authorization_expired');
    expect(gig.payment_status).toBe(PAYMENT_STATES.CANCELED);

    // Notifications
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-owner', type: 'gig_auto_cancelled' })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-worker', type: 'gig_auto_cancelled' })
    );
  });

  test('Part 1: skips auth that expires beyond 24h', async () => {
    seedTable('Payment', [{
      id: 'pay-ok',
      gig_id: 'gig-ok',
      payer_id: 'u1',
      payee_id: 'u2',
      amount_total: 5000,
      payment_status: PAYMENT_STATES.AUTHORIZED,
      authorization_expires_at: hoursFromNow(72), // Expires in 3 days — no action needed
    }]);
    seedTable('Gig', [{
      id: 'gig-ok',
      status: 'assigned',
      user_id: 'u1',
      accepted_by: 'u2',
    }]);

    await expireUncapturedAuthorizations();

    expect(stripeService.cancelAuthorization).not.toHaveBeenCalled();
    const gig = getTable('Gig').find(g => g.id === 'gig-ok');
    expect(gig.status).toBe('assigned'); // unchanged
  });

  test('Part 2: flags in-progress gig with expiring auth for manual review', async () => {
    const paymentId = 'pay-inprog';
    const gigId = 'gig-inprog';

    seedTable('Payment', [{
      id: paymentId,
      gig_id: gigId,
      payer_id: 'user-owner',
      payee_id: 'user-worker',
      amount_total: 30000,
      payment_status: PAYMENT_STATES.AUTHORIZED,
      authorization_expires_at: hoursFromNow(8), // Expiring soon
    }]);
    seedTable('Gig', [{
      id: gigId,
      status: 'in_progress',
      title: 'Kitchen Remodel',
      user_id: 'user-owner',
      accepted_by: 'user-worker',
    }]);

    await expireUncapturedAuthorizations();

    // Should NOT cancel auth (gig is in progress)
    expect(stripeService.cancelAuthorization).not.toHaveBeenCalled();

    // Should flag for manual review
    const payment = getTable('Payment').find(p => p.id === paymentId);
    expect(payment.off_session_auth_required).toBe(true);

    // Should send urgent notifications to both parties
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-owner',
        type: 'payment_auth_expiring',
      })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-worker',
        type: 'payment_auth_expiring',
      })
    );
  });
});

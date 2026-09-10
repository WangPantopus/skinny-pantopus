// ============================================================
// TEST 2: Time-Travel
// Verifies background jobs correctly handle time-based logic:
//   - authorizeUpcomingGigs picks up ready_to_authorize payments
//     for gigs starting within 24h
//   - authorizeUpcomingGigs auto-cancels gigs starting within 2h
//     with failed authorization
//   - the daily booking expiry job leaves Gig decisions to the exact
//     provider-proof coordinator (covered by its service/SQL contracts)
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

// Mock stripeService — we don't want real Stripe calls
jest.mock('../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn().mockResolvedValue({ success: true }),
  cancelAuthorization: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../services/legacyGigAuthorization', () => ({ recover: jest.fn() }));
const { recover } = require('../services/legacyGigAuthorization');
const stripeService = require('../stripe/stripeService');
const { createNotification } = require('../services/notificationService');
const authorizeUpcomingGigs = require('../jobs/authorizeUpcomingGigs');
const expireUncapturedAuthorizations = require('../jobs/expireUncapturedAuthorizations');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  recover.mockResolvedValue({ authorizationReady: true });
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

    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledWith(
      expect.objectContaining({
        gigId, scheduler: true, mode: 'resume', expectedPaymentId: paymentId,
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

    expect(recover).not.toHaveBeenCalled();
  });

  test('Part 1: SCA failure sends notification to requester', async () => {
    recover.mockResolvedValueOnce({
      authorizationReady: false,
      recoveryState: 'action_required',
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

  test('Part 2: announces only the protected cancellation receipt for a due gig', async () => {
    recover.mockResolvedValueOnce({ cancelled: true });
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

    expect(recover).toHaveBeenCalledWith({ gigId: 'gig-fail', scheduler: true, mode: 'cancel', expectedPaymentId: 'pay-fail' });
    expect(stripeService.cancelAuthorization).not.toHaveBeenCalled();
    // The job never writes a guessed cancellation. The real SQL contract owns
    // that atomic change; this fake receipt only tests dispatch/notification.
    expect(getTable('Gig')[0].status).toBe('assigned');

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

describe('daily booking expiry preserves separate protected Gig recovery', () => {
  test.each([['assigned', 10], ['assigned', 72], ['in_progress', 8]])(
    '%s Gig with estimated deadline %sh is untouched by daily booking policy', async (status, hours) => {
      seedTable('Payment', [{ id: 'pay-expiry', gig_id: 'gig-expiry', payment_type: 'gig_payment',
        payment_status: PAYMENT_STATES.AUTHORIZED, authorization_expires_at: hoursFromNow(hours) }]);
      seedTable('Gig', [{ id: 'gig-expiry', status, user_id: 'owner', accepted_by: 'worker' }]);
      await expireUncapturedAuthorizations();
      expect(stripeService.cancelAuthorization).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
      expect(getTable('Gig')).toEqual([{ id: 'gig-expiry', status, user_id: 'owner', accepted_by: 'worker' }]);
      expect(getTable('Payment')[0].payment_status).toBe(PAYMENT_STATES.AUTHORIZED);
      expect(getTable('Payment')[0].off_session_auth_required).toBeUndefined();
    });
});

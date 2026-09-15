// ============================================================
// JOB: Authorize Upcoming Gigs
// Runs hourly. For gigs starting within 24 hours that have a
// saved card (ready_to_authorize), creates a PaymentIntent
// off-session. Also enforces auto-cancel for auth failures
// within 2 hours of start.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const { recover } = require('../services/legacyGigAuthorization');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

async function authorizeUpcomingGigs() {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // ─── Part 1: Authorize gigs starting within 24h ───
  try {
    // Find gigs that need authorization
    const { data: gigsToAuthorize, error } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, payment_id, title, scheduled_start')
      .eq('status', 'assigned')
      .in('payment_status', [PAYMENT_STATES.READY_TO_AUTHORIZE, PAYMENT_STATES.AUTHORIZE_PENDING])
      .not('payment_id', 'is', null)
      .lte('scheduled_start', twentyFourHoursFromNow.toISOString());

    if (error) {
      logger.error('authorizeUpcomingGigs: query error', { error: error.message });
      // Don't return — still run Part 2
    }

    if (!gigsToAuthorize || gigsToAuthorize.length === 0) {
      logger.info('authorizeUpcomingGigs: no gigs to authorize');
      // Fall through to Part 2
    }

    if (gigsToAuthorize && gigsToAuthorize.length > 0) {
    logger.info('authorizeUpcomingGigs: found gigs to authorize', { count: gigsToAuthorize.length });

    for (const gig of gigsToAuthorize) {
      try {
        const result = await recover({ gigId: gig.id, scheduler: true, mode: 'resume', expectedPaymentId: gig.payment_id });

        if (result.authorizationReady) {
          logger.info('authorizeUpcomingGigs: authorized', { gigId: gig.id, paymentId: gig.payment_id });
        } else if (result.recoveryState === 'action_required') {
          // Off-session auth failed — notify the requester
          logger.warn('authorizeUpcomingGigs: auth failed (SCA required)', { gigId: gig.id });

          createNotification({
            userId: gig.user_id,
            type: 'payment_auth_failed',
            title: 'Payment authorization failed',
            body: `Your payment for "${gig.title || 'a gig'}" needs your attention. Please update your payment to keep your booking.`,
            icon: '⚠️',
            link: `/gigs/${gig.id}`,
            metadata: { gig_id: gig.id, payment_id: gig.payment_id },
          });
        }
      } catch (gigErr) {
        logger.error('authorizeUpcomingGigs: error authorizing gig', {
          error: gigErr.message,
          gigId: gig.id,
        });
      }
    }
    } // end if gigsToAuthorize
  } catch (err) {
    logger.error('authorizeUpcomingGigs: Part 1 failed', { error: err.message });
  }

  // ─── Part 2: Auto-cancel gigs starting within 2h with failed auth ───
  try {
    const { data: failedGigs, error: failedErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, payment_id, title')
      .eq('status', 'assigned')
      .in('payment_status', [PAYMENT_STATES.AUTHORIZATION_FAILED, PAYMENT_STATES.CANCELED])
      .not('payment_id', 'is', null)
      .lte('scheduled_start', twoHoursFromNow.toISOString());

    if (failedErr) {
      logger.error('authorizeUpcomingGigs: failed gigs query error', { error: failedErr.message });
      return;
    }

    if (!failedGigs || failedGigs.length === 0) return;

    logger.info('authorizeUpcomingGigs: auto-cancelling gigs with failed auth', { count: failedGigs.length });

    for (const gig of failedGigs) {
      try {
        const result = await recover({ gigId: gig.id, scheduler: true, mode: 'cancel', expectedPaymentId: gig.payment_id });
        if (!result.cancelled) continue;

        // Notify both parties
        createNotification({
          userId: gig.user_id,
          type: 'gig_auto_cancelled',
          title: `"${gig.title || 'Your gig'}" was auto-cancelled`,
          body: 'Your gig was cancelled because payment authorization could not be completed in time.',
          icon: '🚫',
          link: `/gigs/${gig.id}`,
          metadata: { gig_id: gig.id, reason: 'payment_failed' },
        });

        if (gig.accepted_by) {
          createNotification({
            userId: gig.accepted_by,
            type: 'gig_auto_cancelled',
            title: `"${gig.title || 'A gig'}" was cancelled`,
            body: 'This gig was cancelled due to a payment issue. We apologize for the inconvenience.',
            icon: '🚫',
            link: `/gigs/${gig.id}`,
            metadata: { gig_id: gig.id, reason: 'payment_failed' },
          });
        }

        logger.info('authorizeUpcomingGigs: auto-cancelled gig', { gigId: gig.id });
      } catch (cancelErr) {
        logger.error('authorizeUpcomingGigs: error auto-cancelling gig', {
          error: cancelErr.message,
          gigId: gig.id,
        });
      }
    }
  } catch (err) {
    logger.error('authorizeUpcomingGigs: Part 2 failed', { error: err.message });
  }
}

module.exports = authorizeUpcomingGigs;

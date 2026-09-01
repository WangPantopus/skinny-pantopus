// ============================================================
// JOB: Expire Uncaptured Authorizations
// Runs daily at 3:00 AM. Handles two scenarios:
//
// 1. Gig NOT started + auth expiring within 24h:
//    Cancel the authorization, cancel the gig, notify both.
//
// 2. Gig IN PROGRESS + auth expiring within 24h:
//    Log critical alert for manual review (need re-authorization).
//    The auth hold is about to expire while work is happening.
//
// Stripe authorization holds last 7 days for card payments.
// After that the hold is automatically released and we lose
// the ability to capture.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');
const logger = require('../utils/logger');
const bookingService = require('../services/scheduling/bookingService');

// ─── Part 0: abandoned / auth-expiring BOOKING payments ───
//
// A priced booking inserts its 'pending' row BEFORE the PaymentIntent is confirmed, and a
// pending row occupies the slot (Booking_no_overlap counts pending+confirmed). An invitee
// who abandons checkout therefore blocks the slot indefinitely. Two cases:
//   (a) intent never completed (authorize_pending past a 30-min TTL) — dead checkout;
//   (b) authorized but the host never approved and the card hold is about to lapse.
// Both cancel via bookingService.cancelBooking(system): its guarded CAS loses cleanly to a
// concurrent approval, and its refund path releases/refunds the hold.
// NOTE: authorized + pending is NORMAL for approval-gated bookings — case (b) deliberately
// waits for authorization_expires_at rather than a short TTL.
async function sweepAbandonedBookingPayments(now, twentyFourHoursFromNow) {
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const candidates = [];
  const { data: dead } = await supabaseAdmin
    .from('Payment')
    .select('id, booking_id, payment_status')
    .eq('payment_type', 'booking_payment')
    .eq('payment_status', PAYMENT_STATES.AUTHORIZE_PENDING)
    .lt('created_at', thirtyMinAgo)
    .not('booking_id', 'is', null);
  const { data: lapsing } = await supabaseAdmin
    .from('Payment')
    .select('id, booking_id, payment_status')
    .eq('payment_type', 'booking_payment')
    .eq('payment_status', PAYMENT_STATES.AUTHORIZED)
    .lte('authorization_expires_at', twentyFourHoursFromNow.toISOString())
    .not('booking_id', 'is', null);
  candidates.push(...(dead || []), ...(lapsing || []));
  let released = 0;
  for (const payment of candidates) {
    try {
      const { data: booking } = await supabaseAdmin.from('Booking').select('id, status').eq('id', payment.booking_id).maybeSingle();
      if (!booking || booking.status !== 'pending') continue;
      await bookingService.cancelBooking(booking.id, null, 'Payment was not completed in time.', 'system');
      released += 1;
    } catch (err) {
      if (err && err.code === 'BAD_STATE') continue; // lost the race to a real approval — fine
      logger.error('expireUncapturedAuths: booking sweep item failed', { paymentId: payment.id, error: err.message });
    }
  }
  if (released > 0) logger.info('expireUncapturedAuths: released abandoned booking slots', { count: released });
}

async function expireUncapturedAuthorizations() {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();

  try {
    await sweepAbandonedBookingPayments(now, twentyFourHoursFromNow);
  } catch (err) {
    logger.error('expireUncapturedAuths: Part 0 fatal error', { error: err.message });
  }

  // ─── Part 1: Authorized payments expiring soon, gig NOT started ───
  try {
    const { data: expiringNotStarted, error: err1 } = await supabaseAdmin
      .from('Payment')
      .select(`
        id,
        gig_id,
        payer_id,
        payee_id,
        amount_total,
        authorization_expires_at,
        stripe_payment_intent_id
      `)
      .eq('payment_status', PAYMENT_STATES.AUTHORIZED)
      .lte('authorization_expires_at', twentyFourHoursFromNow.toISOString());

    if (err1) {
      logger.error('expireUncapturedAuths: Part 1 query error', { error: err1.message });
    } else if (expiringNotStarted && expiringNotStarted.length > 0) {
      logger.info('expireUncapturedAuths: found expiring auths (not started)', {
        count: expiringNotStarted.length,
      });

      for (const payment of expiringNotStarted) {
        try {
          // Non-gig payments (bookings, packages) are handled by Part 0 / settlement.
          if (!payment.gig_id) continue;
          // Check if the gig is still in a non-started state
          const { data: gig } = await supabaseAdmin
            .from('Gig')
            .select('id, status, title, user_id, accepted_by')
            .eq('id', payment.gig_id)
            .single();

          if (!gig) {
            logger.warn('expireUncapturedAuths: gig not found', { gigId: payment.gig_id });
            continue;
          }

          if (gig.status === 'in_progress') {
            // This belongs in Part 2 — skip here
            continue;
          }

          if (['completed', 'cancelled'].includes(gig.status)) {
            // Gig already finished/cancelled — just cancel the dangling auth
            try {
              await stripeService.cancelAuthorization(payment.id);
            } catch (cancelErr) {
              logger.warn('expireUncapturedAuths: cancel auth error (gig already done)', {
                paymentId: payment.id,
                error: cancelErr.message,
              });
            }
            continue;
          }

          // Gig is in 'assigned' or 'open' state — hasn't started yet
          // Cancel authorization and cancel the gig
          logger.info('expireUncapturedAuths: cancelling auth + gig (not started, auth expiring)', {
            paymentId: payment.id,
            gigId: gig.id,
            expiresAt: payment.authorization_expires_at,
          });

          // Cancel the payment authorization
          try {
            await stripeService.cancelAuthorization(payment.id);
          } catch (cancelErr) {
            logger.error('expireUncapturedAuths: cancel auth failed', {
              paymentId: payment.id,
              error: cancelErr.message,
            });
            // Continue to cancel gig anyway — the hold will auto-release
          }

          // Cancel the gig
          await supabaseAdmin.from('Gig').update({
            status: 'cancelled',
            cancelled_at: nowIso,
            cancellation_reason: 'authorization_expired',
            cancellation_zone: 1,
            cancellation_fee: 0,
            payment_status: PAYMENT_STATES.CANCELED,
            updated_at: nowIso,
          }).eq('id', gig.id);

          const gigTitle = gig.title || 'Your gig';

          // Notify requester
          createNotification({
            userId: gig.user_id,
            type: 'gig_auto_cancelled',
            title: `"${gigTitle}" was auto-cancelled`,
            body: 'Your gig was cancelled because the payment authorization was about to expire. No charges were made. You can repost the gig.',
            icon: '⏰',
            link: `/gigs/${gig.id}`,
            metadata: { gig_id: gig.id, reason: 'authorization_expired' },
          });

          // Notify provider
          if (gig.accepted_by) {
            createNotification({
              userId: gig.accepted_by,
              type: 'gig_auto_cancelled',
              title: `"${gigTitle}" was cancelled`,
              body: 'This gig was cancelled due to a payment authorization expiry. We apologize for the inconvenience.',
              icon: '⏰',
              link: `/gigs/${gig.id}`,
              metadata: { gig_id: gig.id, reason: 'authorization_expired' },
            });
          }

          logger.info('expireUncapturedAuths: gig cancelled (auth expiring)', {
            paymentId: payment.id,
            gigId: gig.id,
          });
        } catch (itemErr) {
          logger.error('expireUncapturedAuths: error processing payment', {
            paymentId: payment.id,
            error: itemErr.message,
          });
        }
      }
    } else {
      logger.info('expireUncapturedAuths: no expiring authorizations (Part 1)');
    }
  } catch (err) {
    logger.error('expireUncapturedAuths: Part 1 fatal error', { error: err.message });
  }

  // ─── Part 2: Authorized payments expiring soon, gig IN PROGRESS ───
  // These are critical — the worker is actively doing the gig but the
  // payment hold is about to expire. We need manual intervention.
  try {
    const { data: expiringInProgress, error: err2 } = await supabaseAdmin
      .from('Payment')
      .select(`
        id,
        gig_id,
        payer_id,
        payee_id,
        amount_total,
        authorization_expires_at
      `)
      .eq('payment_status', PAYMENT_STATES.AUTHORIZED)
      .lte('authorization_expires_at', twentyFourHoursFromNow.toISOString());

    if (err2) {
      logger.error('expireUncapturedAuths: Part 2 query error', { error: err2.message });
      return;
    }

    if (!expiringInProgress || expiringInProgress.length === 0) {
      logger.info('expireUncapturedAuths: no in-progress auths expiring (Part 2)');
      return;
    }

    // Filter to only gigs that are actually in_progress
    for (const payment of expiringInProgress) {
      try {
        // Non-gig payments (bookings, packages) are handled by Part 0 / settlement.
        if (!payment.gig_id) continue;
        const { data: gig } = await supabaseAdmin
          .from('Gig')
          .select('id, status, title, user_id, accepted_by')
          .eq('id', payment.gig_id)
          .single();

        if (!gig || gig.status !== 'in_progress') continue;

        // ALERT: This is a critical situation
        logger.error('CRITICAL: Authorization expiring for in-progress gig', {
          paymentId: payment.id,
          gigId: gig.id,
          gigTitle: gig.title,
          expiresAt: payment.authorization_expires_at,
          amountAtRisk: payment.amount_total,
        });

        const gigTitle = gig.title || 'a gig';
        const hoursRemaining = Math.max(
          0,
          Math.round((new Date(payment.authorization_expires_at) - now) / (60 * 60 * 1000))
        );

        // Notify requester to complete confirmation ASAP
        createNotification({
          userId: gig.user_id,
          type: 'payment_auth_expiring',
          title: 'Action needed: Confirm work completion',
          body: `Payment authorization for "${gigTitle}" expires in ~${hoursRemaining}h. Please confirm the work is complete to ensure the provider gets paid.`,
          icon: '🔴',
          link: `/gigs/${gig.id}`,
          metadata: {
            gig_id: gig.id,
            payment_id: payment.id,
            urgency: 'critical',
            hours_remaining: hoursRemaining,
          },
        });

        // Notify provider that payment might need attention
        if (gig.accepted_by) {
          createNotification({
            userId: gig.accepted_by,
            type: 'payment_auth_expiring',
            title: 'Payment hold expiring soon',
            body: `The payment hold for "${gigTitle}" is expiring soon. Please submit your completion proof so the requester can confirm.`,
            icon: '⚠️',
            link: `/gigs/${gig.id}`,
            metadata: {
              gig_id: gig.id,
              payment_id: payment.id,
              urgency: 'high',
            },
          });
        }

        // Flag payment for admin review
        await supabaseAdmin.from('Payment').update({
          off_session_auth_required: true,
          updated_at: nowIso,
        }).eq('id', payment.id);
      } catch (itemErr) {
        logger.error('expireUncapturedAuths: error processing in-progress payment', {
          paymentId: payment.id,
          error: itemErr.message,
        });
      }
    }
  } catch (err) {
    logger.error('expireUncapturedAuths: Part 2 fatal error', { error: err.message });
  }
}

module.exports = expireUncapturedAuthorizations;

// ============================================================
// JOB: Retry Capture Failures
// Runs every 15 minutes. Finds gigs where the owner confirmed
// completion (owner_confirmed_at IS SET) but the associated
// Payment is still in 'authorized' state, meaning a previous
// capture attempt failed. Retries capturePayment up to 3 times.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

const MAX_CAPTURE_ATTEMPTS = 3;

async function retryCaptureFailures() {
  // Find gigs where owner confirmed but payment is still authorized
  const { data: orphanedGigs, error } = await supabaseAdmin
    .from('Gig')
    .select('id, title, user_id, payment_id')
    .not('owner_confirmed_at', 'is', null)
    .not('payment_id', 'is', null)
    .eq('payment_status', PAYMENT_STATES.AUTHORIZED);

  if (error) {
    logger.error('retryCaptureFailures: failed to query gigs', { error: error.message });
    return;
  }

  if (!orphanedGigs || orphanedGigs.length === 0) {
    logger.info('retryCaptureFailures: no orphaned captures found');
    return;
  }

  logger.info('retryCaptureFailures: found orphaned captures', { count: orphanedGigs.length });

  for (const gig of orphanedGigs) {
    try {
      // Fetch the payment to check capture_attempts
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('id, capture_attempts, payment_status, payer_id')
        .eq('id', gig.payment_id)
        .single();

      if (!payment) {
        logger.warn('retryCaptureFailures: payment not found', { paymentId: gig.payment_id });
        continue;
      }

      // Only retry if still in authorized state
      if (payment.payment_status !== PAYMENT_STATES.AUTHORIZED) {
        continue;
      }

      const attempts = payment.capture_attempts || 0;

      if (attempts >= MAX_CAPTURE_ATTEMPTS) {
        // Stop retrying — notify payer to contact support
        logger.warn('retryCaptureFailures: max attempts reached', {
          paymentId: payment.id,
          gigId: gig.id,
          attempts,
        });

        createNotification({
          userId: payment.payer_id,
          type: 'payment_capture_failed',
          title: 'Payment capture failed',
          body: `We were unable to capture payment for "${gig.title || 'a gig'}". Please contact support for assistance.`,
          icon: '⚠️',
          link: `/gigs/${gig.id}`,
          metadata: { gig_id: gig.id, payment_id: payment.id },
        });

        continue;
      }

      // Attempt capture
      const result = await stripeService.capturePayment(payment.id);

      // Update gig payment_status on success
      await supabaseAdmin
        .from('Gig')
        .update({ payment_status: PAYMENT_STATES.CAPTURED_HOLD })
        .eq('id', gig.id);

      logger.info('retryCaptureFailures: capture succeeded', {
        paymentId: payment.id,
        gigId: gig.id,
        chargeId: result.chargeId,
      });

    } catch (captureErr) {
      logger.error('retryCaptureFailures: capture attempt failed', {
        error: captureErr.message,
        paymentId: gig.payment_id,
        gigId: gig.id,
      });
    }
  }
}

module.exports = retryCaptureFailures;

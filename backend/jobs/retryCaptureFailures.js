// ============================================================
// JOB: Retry Capture Failures
// Runs every 15 minutes. Finds gigs where the owner confirmed
// completion (owner_confirmed_at IS SET) but the associated
// Payment is still in 'authorized' state, meaning a previous
// capture attempt failed. Reconciles provider proof before capped capture retries.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const logger = require('../utils/logger');

// Cap work per run so a capture backlog can't push the job past the Lambda
// HTTP timeout. Remaining gigs are retried on the next run (every 15 min),
// oldest confirmation first (FIFO).
const BATCH_SIZE = 100;

async function retryCaptureFailures() {
  // Find gigs where owner confirmed but payment is still authorized
  const { data: orphanedGigs, error } = await supabaseAdmin
    .from('Gig')
    .select('id, title, user_id, payment_id')
    .not('owner_confirmed_at', 'is', null)
    .not('payment_id', 'is', null)
    .in('payment_status', [PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.CAPTURE_PENDING])
    .order('owner_confirmed_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error('retryCaptureFailures: failed to query gigs', { error: error.message });
    return;
  }

  if (!orphanedGigs || orphanedGigs.length === 0) {
    logger.info('retryCaptureFailures: no orphaned captures found');
    return;
  }

  logger.info('retryCaptureFailures: found orphaned captures', { count: orphanedGigs.length });

  if (orphanedGigs.length === BATCH_SIZE) {
    logger.warn('retryCaptureFailures: batch full — possible backlog, remaining gigs retried next run', { batchSize: BATCH_SIZE });
  }

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
      if (![PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.CAPTURE_PENDING].includes(payment.payment_status)) {
        continue;
      }

      // capturePayment first reconciles exact provider success, even when new
      // capture attempts reached their cap. The transactional service owns caps.
      // Attempt capture
      const result = await stripeService.capturePayment(payment.id);

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

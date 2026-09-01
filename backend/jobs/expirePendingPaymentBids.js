// ============================================================
// JOB: Expire Stale pending_payment Bids
// Reverts bids that have been in pending_payment state past
// their expiry time. Cancels associated Stripe intents.
// Runs every 2 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const stripeService = require('../stripe/stripeService');

async function expirePendingPaymentBids() {
  const now = new Date().toISOString();

  const { data: staleBids, error } = await supabaseAdmin
    .from('GigBid')
    .select('id, pending_payment_intent_id')
    .eq('status', 'pending_payment')
    .not('pending_payment_expires_at', 'is', null)
    .lt('pending_payment_expires_at', now);

  if (error) {
    logger.error('[expirePendingPaymentBids] Failed to query stale bids', { error: error.message });
    return;
  }

  if (!staleBids || staleBids.length === 0) return;

  let revertedCount = 0;

  for (const bid of staleBids) {
    try {
      // Cancel the Stripe intent if one exists
      if (bid.pending_payment_intent_id) {
        try {
          await stripeService.cancelAuthorization(bid.pending_payment_intent_id);
        } catch (cancelErr) {
          logger.error('[expirePendingPaymentBids] Failed to cancel Stripe intent', {
            bidId: bid.id,
            intentId: bid.pending_payment_intent_id,
            error: cancelErr.message,
          });
        }
      }

      // Revert bid to pending
      await supabaseAdmin
        .from('GigBid')
        .update({
          status: 'pending',
          pending_payment_expires_at: null,
          pending_payment_intent_id: null,
          updated_at: now,
        })
        .eq('id', bid.id)
        .eq('status', 'pending_payment'); // optimistic lock

      revertedCount++;
    } catch (err) {
      logger.error('[expirePendingPaymentBids] Failed to revert bid', {
        bidId: bid.id,
        error: err.message,
      });
    }
  }

  if (revertedCount > 0) {
    logger.info('[expirePendingPaymentBids] Reverted stale bids', {
      count: revertedCount,
      bid_ids: staleBids.map((b) => b.id),
    });
  }
}

module.exports = expirePendingPaymentBids;

// ============================================================
// JOB: Compute Reputation Scores
// Recomputes reputation for users with recent activity
// (new reviews or completed transactions in the last 2 hours).
// Runs every 30 minutes at :07/:37.
// ============================================================

const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const reputationService = require('../services/marketplace/reputationService');

async function computeReputation() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Collect user IDs that need recomputation:
    // 1. Users who received reviews recently
    const { data: reviewedUsers } = await supabaseAdmin
      .from('TransactionReview')
      .select('reviewed_id')
      .gte('created_at', twoHoursAgo);

    // 2. Sellers/buyers on recently completed offers
    const { data: completedOffers } = await supabaseAdmin
      .from('ListingOffer')
      .select('seller_id, buyer_id')
      .eq('status', 'completed')
      .gte('completed_at', twoHoursAgo);

    // Deduplicate user IDs
    const userIdSet = new Set();

    (reviewedUsers || []).forEach(r => {
      if (r.reviewed_id) userIdSet.add(r.reviewed_id);
    });

    (completedOffers || []).forEach(o => {
      if (o.seller_id) userIdSet.add(o.seller_id);
      if (o.buyer_id) userIdSet.add(o.buyer_id);
    });

    const userIds = [...userIdSet];

    if (userIds.length === 0) {
      logger.info('[computeReputation] No users need recomputation');
      return;
    }

    logger.info('[computeReputation] Recomputing reputation', { userCount: userIds.length });

    const { computed, failed } = await reputationService.computeReputationBatch(userIds);

    logger.info('[computeReputation] Batch complete', { computed, failed });
  } catch (err) {
    logger.error('[computeReputation] Job failed', {
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = computeReputation;

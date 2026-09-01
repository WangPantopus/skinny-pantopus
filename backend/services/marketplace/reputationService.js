/**
 * reputationService.js — Computes and caches user reputation scores
 * based on transaction reviews, completed sales, purchases, trades,
 * and gig completions.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

/**
 * Compute and upsert the reputation score for a single user.
 * Aggregates data from TransactionReview, ListingOffer, ListingTrade (if exists),
 * and gigs tables.
 */
async function computeReputation(userId) {
  // 1. Average rating + total ratings from TransactionReview
  const { data: reviewAgg, error: reviewErr } = await supabaseAdmin
    .from('TransactionReview')
    .select('rating')
    .eq('reviewed_id', userId);

  if (reviewErr) {
    logger.error('[reputationService] Failed to query TransactionReview', {
      userId,
      error: reviewErr.message,
    });
  }

  const ratings = (reviewAgg || []).map(r => r.rating);
  const total_ratings = ratings.length;
  const avg_rating = total_ratings > 0
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / total_ratings) * 100) / 100
    : 0;

  // 2. Completed listing sales (user is seller)
  const { count: total_sales } = await supabaseAdmin
    .from('ListingOffer')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'completed');

  // 3. Completed listing purchases (user is buyer)
  const { count: total_purchases } = await supabaseAdmin
    .from('ListingOffer')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', userId)
    .eq('status', 'completed');

  // 4. Completed trades — ListingTrade may not exist yet
  let total_trades = 0;
  try {
    const { count, error: tradeErr } = await supabaseAdmin
      .from('ListingTrade')
      .select('id', { count: 'exact', head: true })
      .or(`target_user_id.eq.${userId},proposer_id.eq.${userId}`)
      .eq('status', 'completed');

    if (!tradeErr) {
      total_trades = count || 0;
    }
  } catch {
    // ListingTrade table may not exist yet — default to 0
  }

  // 5. Completed gigs (user accepted and completed)
  const { count: total_gigs_completed } = await supabaseAdmin
    .from('gigs')
    .select('id', { count: 'exact', head: true })
    .eq('accepted_by', userId)
    .eq('status', 'completed');

  // 6. Response time — TODO: Phase 3 — compute average response time
  // from ChatRoom messages. For MVP, set to null.
  const avg_response_time_min = null;

  // 7. Badges
  const is_fast_responder = false; // Requires response time — Phase 3
  const is_top_seller = (total_sales || 0) >= 10 && avg_rating >= 4.5;

  // 8. Member since
  const { data: userRow } = await supabaseAdmin
    .from('User')
    .select('created_at')
    .eq('id', userId)
    .single();

  const member_since = userRow?.created_at || null;

  // 9. Upsert into ReputationScore
  const row = {
    user_id: userId,
    avg_rating,
    total_ratings,
    total_sales: total_sales || 0,
    total_purchases: total_purchases || 0,
    total_trades,
    total_gigs_completed: total_gigs_completed || 0,
    avg_response_time_min,
    is_fast_responder,
    is_top_seller,
    member_since,
    last_computed_at: new Date().toISOString(),
  };

  const { data: upserted, error: upsertErr } = await supabaseAdmin
    .from('ReputationScore')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();

  if (upsertErr) {
    logger.error('[reputationService] Failed to upsert ReputationScore', {
      userId,
      error: upsertErr.message,
    });
    throw upsertErr;
  }

  logger.info('[reputationService] Computed reputation', {
    userId,
    avg_rating,
    total_ratings,
    total_sales: total_sales || 0,
    total_purchases: total_purchases || 0,
  });

  return upserted;
}

/**
 * Get the cached reputation for a user.
 * Returns a default object if no cached reputation exists.
 */
async function getReputation(userId) {
  const { data, error } = await supabaseAdmin
    .from('ReputationScore')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      user_id: userId,
      avg_rating: 0,
      total_ratings: 0,
      total_sales: 0,
      total_purchases: 0,
      total_trades: 0,
      total_gigs_completed: 0,
      is_fast_responder: false,
      is_top_seller: false,
      member_since: null,
      badges: [],
    };
  }

  // Compute badges array from boolean flags
  const badges = [];
  if (data.is_fast_responder) badges.push('fast_responder');
  if (data.is_top_seller) badges.push('top_seller');

  return { ...data, badges };
}

/**
 * Compute reputation for multiple users. Uses Promise.allSettled
 * so one failure doesn't block others.
 */
async function computeReputationBatch(userIds) {
  const results = await Promise.allSettled(
    userIds.map(id => computeReputation(id))
  );

  let computed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      computed++;
    } else {
      failed++;
      logger.error('[reputationService] Batch compute failed for user', {
        error: result.reason?.message,
      });
    }
  }

  return { computed, failed };
}

module.exports = {
  computeReputation,
  getReputation,
  computeReputationBatch,
};

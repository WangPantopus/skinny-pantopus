// ============================================================
// Affinity Service — tracks per-user category affinity scores
//
// Scores are computed as:
//   view_count * 1 + bid_count * 5 + completion_count * 10 - dismiss_count * 3
//
// Exports:
//   recordInteraction(userId, category, type)
//   getUserAffinities(userId)
//   getCategoryAffinity(userId, category)
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

const TABLE = 'user_task_affinity';

// Weights for affinity score computation
const WEIGHTS = {
  view: 1,
  bid: 5,
  completion: 10,
  dismiss: -3,
};

const COUNTER_FIELD = {
  view: 'view_count',
  bid: 'bid_count',
  completion: 'completion_count',
  dismiss: 'dismiss_count',
};

/**
 * Compute affinity score from counter values.
 */
function computeScore({ view_count = 0, bid_count = 0, completion_count = 0, dismiss_count = 0 }) {
  return (
    view_count * WEIGHTS.view +
    bid_count * WEIGHTS.bid +
    completion_count * WEIGHTS.completion +
    dismiss_count * Math.abs(WEIGHTS.dismiss) * -1
  );
}

/**
 * Record a user interaction with a category.
 * Upserts the affinity row, incrementing the relevant counter and recomputing the score.
 *
 * @param {string} userId
 * @param {string} category
 * @param {'view'|'bid'|'completion'|'dismiss'} type
 */
async function recordInteraction(userId, category, type) {
  if (!userId || !category || !COUNTER_FIELD[type]) {
    logger.warn('affinityService.recordInteraction: invalid args', { userId, category, type });
    return null;
  }

  const now = new Date().toISOString();

  // Fetch existing row (if any)
  const { data: existing } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();

  const counters = {
    view_count: existing?.view_count || 0,
    bid_count: existing?.bid_count || 0,
    completion_count: existing?.completion_count || 0,
    dismiss_count: existing?.dismiss_count || 0,
  };

  // Increment the relevant counter
  const field = COUNTER_FIELD[type];
  counters[field] += 1;

  const score = computeScore(counters);

  if (existing) {
    // Update
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update({
        ...counters,
        affinity_score: score,
        last_interaction_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('category', category)
      .select('*')
      .single();

    if (error) {
      logger.error('affinityService.recordInteraction update error', { error: error.message, userId, category, type });
      return null;
    }
    return data;
  }

  // Insert new row
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert({
      user_id: userId,
      category,
      ...counters,
      affinity_score: score,
      last_interaction_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('affinityService.recordInteraction insert error', { error: error.message, userId, category, type });
    return null;
  }
  return data;
}

/**
 * Get all affinity rows for a user, sorted by score descending.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getUserAffinities(userId) {
  if (!userId) return [];

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('affinity_score', { ascending: false });

  if (error) {
    logger.error('affinityService.getUserAffinities error', { error: error.message, userId });
    return [];
  }
  return data || [];
}

/**
 * Get the affinity score for a specific user + category.
 *
 * @param {string} userId
 * @param {string} category
 * @returns {Promise<number>}
 */
async function getCategoryAffinity(userId, category) {
  if (!userId || !category) return 0;

  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('affinity_score')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();

  return data?.affinity_score ?? 0;
}

module.exports = {
  recordInteraction,
  getUserAffinities,
  getCategoryAffinity,
  // Exported for testing
  computeScore,
};

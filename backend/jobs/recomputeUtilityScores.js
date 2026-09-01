/**
 * Recompute Utility Scores — Background Job
 *
 * Periodically recomputes utility_score on recent posts so that
 * feed ranking reflects up-to-date engagement signals.
 *
 * Selection criteria:
 *   - Non-archived posts created in the last 7 days
 *   - OR posts updated in the last 24 hours (engagement changes)
 *
 * Uses computeUtilityScore() from backend/utils/feedRanking.js.
 * Updates in batches of 100 to avoid long-running single queries.
 * Uses Promise.allSettled to batch updates within each page (was N+1).
 *
 * Runs every 15 minutes via cron.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { computeUtilityScore } = require('../utils/feedRanking');

const BATCH_SIZE = 100;
// Max concurrent updates within a batch to avoid overwhelming the DB
const CONCURRENCY = 20;

async function recomputeUtilityScores() {
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let offset = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  while (true) {
    // Fetch posts created in last 7 days OR updated in last 24 hours
    const { data: posts, error } = await supabaseAdmin
      .from('Post')
      .select('id, purpose, post_type, utility_score, like_count, comment_count, save_count, not_helpful_count, state, media_urls, latitude, longitude, created_at, is_visitor_post')
      .is('archived_at', null)
      .or(`created_at.gte.${cutoff7d},updated_at.gte.${cutoff24h}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      logger.error('[recomputeUtilityScores] Fetch error', { error: error.message, offset });
      break;
    }
    if (!posts || posts.length === 0) break;

    // Compute new scores, skip posts where score didn't change
    const updates = [];
    for (const post of posts) {
      const newScore = computeUtilityScore(post);
      // Only update if score actually changed (avoid unnecessary writes)
      if (Math.abs(newScore - (post.utility_score || 0)) >= 0.01) {
        updates.push({ id: post.id, utility_score: newScore });
      }
    }

    // Batch update with controlled concurrency
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += CONCURRENCY) {
        const chunk = updates.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map(({ id, utility_score }) =>
            supabaseAdmin
              .from('Post')
              .update({ utility_score })
              .eq('id', id)
          )
        );

        for (const result of results) {
          if (result.status === 'rejected') {
            totalErrors++;
            logger.error('[recomputeUtilityScores] Update error', {
              error: result.reason?.message || String(result.reason),
            });
          } else if (result.value?.error) {
            totalErrors++;
            logger.error('[recomputeUtilityScores] Update error', {
              error: result.value.error.message,
            });
          }
        }
      }
    }

    totalUpdated += updates.length;
    offset += BATCH_SIZE;
    if (posts.length < BATCH_SIZE) break;
  }

  logger.info('[recomputeUtilityScores] Completed', { totalUpdated, totalErrors });
}

module.exports = recomputeUtilityScores;

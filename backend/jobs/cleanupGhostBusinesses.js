/**
 * cleanupGhostBusinesses
 *
 * Nightly job that removes orphaned business accounts — businesses that were
 * created by the old wizard flow (which called the API at Step 2) but never
 * completed onboarding. With the refactored wizard (BIZ-12) this should
 * produce fewer matches over time.
 *
 * Ghost criteria (all must be true):
 *   1. Created more than 48 hours ago
 *   2. Never published (is_published = false)
 *   3. No locations attached
 *   4. No catalog items
 *   5. Profile completeness <= 10
 *
 * Deletes: User row (cascades to BusinessProfile, BusinessTeam, BusinessPrivate,
 * BusinessPage via ON DELETE CASCADE).
 *
 * Schedule: daily at 2:30 AM UTC
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const GHOST_AGE_HOURS = 48;
const MAX_COMPLETENESS = 10;
const BATCH_SIZE = 50;

async function cleanupGhostBusinesses() {
  const cutoff = new Date(Date.now() - GHOST_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // Find draft businesses older than cutoff with very low completeness
  const { data: candidates, error: fetchErr } = await supabaseAdmin
    .from('BusinessProfile')
    .select('business_user_id, profile_completeness, created_at')
    .eq('is_published', false)
    .lte('profile_completeness', MAX_COMPLETENESS)
    .lte('created_at', cutoff)
    .limit(BATCH_SIZE);

  if (fetchErr) {
    logger.error('[cleanupGhostBusinesses] Failed to query candidates', { error: fetchErr.message });
    return;
  }

  if (!candidates || candidates.length === 0) {
    logger.info('[cleanupGhostBusinesses] No ghost candidates found');
    return;
  }

  let deleted = 0;

  for (const candidate of candidates) {
    const bizId = candidate.business_user_id;

    // Check for locations
    const { count: locCount } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id', { count: 'exact', head: true })
      .eq('business_user_id', bizId);

    if ((locCount || 0) > 0) continue;

    // Check for catalog items
    const { count: catCount } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id', { count: 'exact', head: true })
      .eq('business_user_id', bizId);

    if ((catCount || 0) > 0) continue;

    // Safe to delete — cascade removes all related rows
    const { error: delErr } = await supabaseAdmin
      .from('User')
      .delete()
      .eq('id', bizId)
      .eq('account_type', 'business');

    if (delErr) {
      logger.error('[cleanupGhostBusinesses] Failed to delete ghost', { bizId, error: delErr.message });
    } else {
      deleted++;
      logger.info('[cleanupGhostBusinesses] Deleted ghost business', { bizId });
    }
  }

  logger.info('[cleanupGhostBusinesses] Completed', {
    candidates_checked: candidates.length,
    deleted,
  });
}

module.exports = cleanupGhostBusinesses;

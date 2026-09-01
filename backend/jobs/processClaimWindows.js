// ============================================================
// JOB: Process Expired Claim Windows
// Finds provisional occupancies whose challenge window has expired
// and promotes them to fully verified.
// Runs every 10 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { applyOccupancyTemplate, writeAuditLog } = require('../utils/homePermissions');

async function processExpiredClaimWindows() {
  const now = new Date().toISOString();

  // 1. Find occupancies past their challenge window
  const { data: expiredOccupancies, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('id, home_id, user_id')
    .eq('verification_status', 'provisional')
    .eq('is_active', true)
    .not('challenge_window_ends_at', 'is', null)
    .lt('challenge_window_ends_at', now)
    .limit(200);

  if (error) {
    logger.error('[processClaimWindows] Failed to query expired occupancies', { error: error.message });
    return;
  }

  if (!expiredOccupancies || expiredOccupancies.length === 0) return;

  logger.info('[processClaimWindows] Found expired challenge windows', { count: expiredOccupancies.length });

  let promoted = 0;
  let errors = 0;

  for (const occ of expiredOccupancies) {
    try {
      // 2a. Look up the linked HomeResidencyClaim to get claimed_role
      const { data: claim } = await supabaseAdmin
        .from('HomeResidencyClaim')
        .select('id, claimed_role')
        .eq('home_id', occ.home_id)
        .eq('user_id', occ.user_id)
        .in('status', ['pending', 'provisional', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const roleBase = claim?.claimed_role || 'member';

      // 2b. Promote via applyOccupancyTemplate (the single write path)
      await applyOccupancyTemplate(occ.home_id, occ.user_id, roleBase, 'verified');

      // 2c. Reset Home.security_state to 'normal' if currently 'claim_window'
      await supabaseAdmin
        .from('Home')
        .update({ security_state: 'normal', updated_at: now })
        .eq('id', occ.home_id)
        .eq('security_state', 'claim_window');

      // 2d. Notify the user
      try {
        const notificationService = require('../services/notificationService');
        notificationService.createNotification({
          userId: occ.user_id,
          type: 'challenge_window_passed',
          title: 'Access confirmed',
          body: 'Your access is now fully active.',
          link: `/homes/${occ.home_id}/dashboard`,
          metadata: { home_id: occ.home_id },
        });
      } catch (notifErr) {
        logger.warn('[processClaimWindows] Failed to send promotion notification (non-fatal)', {
          error: notifErr.message,
          userId: occ.user_id,
        });
      }

      // 2e. Audit log
      await writeAuditLog(occ.home_id, occ.user_id, 'CHALLENGE_WINDOW_EXPIRED_PROMOTED', 'HomeOccupancy', occ.id, {
        claimed_role: roleBase,
        claim_id: claim?.id || null,
      });

      promoted++;
    } catch (err) {
      errors++;
      logger.error('[processClaimWindows] Failed to promote occupancy', {
        error: err.message,
        occupancyId: occ.id,
        homeId: occ.home_id,
        userId: occ.user_id,
      });
    }
  }

  logger.info('[processClaimWindows] Completed', { promoted, errors, total: expiredOccupancies.length });
}

module.exports = processExpiredClaimWindows;

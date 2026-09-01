// ============================================================
// JOB: Notify 48h Before Claim Window Expires (BUG 5B)
//
// Finds homes with claim_window_ends_at between 46h and 50h from now
// (i.e. approximately 48 hours away). Sends notifications to all
// verified occupants of those homes so they can submit additional
// ownership claims before the window closes.
//
// Runs every 2 hours at :20.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function notifyClaimWindowExpiry() {
  const now = new Date();
  // Window: homes whose claim_window_ends_at is between 46h and 50h from now
  const minTime = new Date(now.getTime() + 46 * 60 * 60 * 1000).toISOString();
  const maxTime = new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString();

  const { data: homes, error } = await supabaseAdmin
    .from('Home')
    .select('id, name, address, claim_window_ends_at')
    .eq('security_state', 'claim_window')
    .gte('claim_window_ends_at', minTime)
    .lte('claim_window_ends_at', maxTime)
    .eq('home_status', 'active')
    .limit(100);

  if (error) {
    logger.error('[notifyClaimWindowExpiry] Failed to query homes', { error: error.message });
    return;
  }

  if (!homes || homes.length === 0) return;

  logger.info('[notifyClaimWindowExpiry] Found homes with expiring claim windows', { count: homes.length });

  let notified = 0;
  let errors = 0;

  for (const home of homes) {
    try {
      // Find all active occupants of this home
      const { data: occupants } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', home.id)
        .eq('is_active', true);

      if (!occupants || occupants.length === 0) continue;

      const notificationService = require('../services/notificationService');

      for (const occ of occupants) {
        // Check if we already sent this notification (idempotency via metadata check)
        const { count: existing } = await supabaseAdmin
          .from('Notification')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', occ.user_id)
          .eq('type', 'claim_window_expiring')
          .contains('metadata', { home_id: home.id });

        if (existing > 0) continue; // Already notified

        try {
          await notificationService.createNotification({
            userId: occ.user_id,
            type: 'claim_window_expiring',
            title: 'Ownership claim window closing soon',
            body: `The claim window for ${home.name || home.address || 'your home'} closes in ~48 hours. Submit any ownership claims before it closes.`,
            link: `/homes/${home.id}/ownership`,
            metadata: { home_id: home.id, claim_window_ends_at: home.claim_window_ends_at },
          });
          notified++;
        } catch (notifErr) {
          logger.warn('[notifyClaimWindowExpiry] Failed to send notification (non-fatal)', {
            error: notifErr.message, userId: occ.user_id, homeId: home.id,
          });
        }
      }
    } catch (err) {
      errors++;
      logger.error('[notifyClaimWindowExpiry] Failed to process home', { error: err.message, homeId: home.id });
    }
  }

  logger.info('[notifyClaimWindowExpiry] Completed', { notified, errors, homes: homes.length });
}

module.exports = notifyClaimWindowExpiry;

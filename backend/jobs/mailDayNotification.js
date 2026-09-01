// ============================================================
// MAIL DAY NOTIFICATION JOB
// Sends daily mailbox summary notification to users
// Runs daily at 8:00 AM (per user's configured time in Phase 2)
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function mailDayNotification() {
  logger.info('[MailDay] Starting mail day notification job');

  // Get all users with active mail
  const { data: usersWithMail, error } = await supabaseAdmin
    .from('Mail')
    .select('recipient_user_id')
    .in('lifecycle', ['delivered', 'opened'])
    .eq('archived', false)
    .not('recipient_user_id', 'is', null);

  if (error) {
    logger.error('[MailDay] Failed to query users with mail', { error: error.message });
    return;
  }

  // Deduplicate user IDs
  const userIds = [...new Set((usersWithMail || []).map(m => m.recipient_user_id))];
  logger.info(`[MailDay] Found ${userIds.length} users with active mail`);

  let notified = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      // Build summary per drawer
      const { data: mail } = await supabaseAdmin
        .from('Mail')
        .select('drawer, category, mail_object_type, urgency')
        .eq('recipient_user_id', userId)
        .in('lifecycle', ['delivered', 'opened'])
        .eq('archived', false);

      if (!mail || mail.length === 0) {
        skipped++;
        continue;
      }

      const bills = mail.filter(m => m.category === 'bill').length;
      const packages = mail.filter(m => m.mail_object_type === 'package').length;
      const urgent = mail.filter(m => m.urgency !== 'none').length;

      // Count earn offers
      const { count: offerCount } = await supabaseAdmin
        .from('EarnOffer')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Build notification summary
      const parts = [];
      if (bills > 0) parts.push(`${bills} bill${bills > 1 ? 's' : ''}`);
      if (packages > 0) parts.push(`${packages} package${packages > 1 ? 's' : ''}`);
      if (offerCount > 0) parts.push(`${offerCount} offer${offerCount > 1 ? 's' : ''}`);

      if (parts.length === 0 && mail.length > 0) {
        parts.push(`${mail.length} item${mail.length > 1 ? 's' : ''}`);
      }

      if (parts.length === 0) {
        skipped++;
        continue;
      }

      const summary = `You've got mail.\n[${parts.join(', ')}]`;

      // Determine most urgent drawer
      const drawerUrgency = {};
      for (const m of mail) {
        if (!drawerUrgency[m.drawer]) drawerUrgency[m.drawer] = 0;
        if (m.urgency !== 'none') drawerUrgency[m.drawer]++;
      }
      const mostUrgentDrawer = Object.entries(drawerUrgency)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'personal';

      // Log notification event
      await supabaseAdmin
        .from('MailEvent')
        .insert({
          event_type: 'mail_day_notification',
          user_id: userId,
          metadata: {
            total: mail.length,
            bills,
            packages,
            offers: offerCount || 0,
            urgent,
            most_urgent_drawer: mostUrgentDrawer,
            summary,
          },
        });

      // In a production system, this would call the notification service
      // For Phase 1, we just log the event
      notified++;
    } catch (err) {
      logger.error('[MailDay] Error processing user notification', {
        userId,
        error: err.message,
      });
    }
  }

  logger.info(`[MailDay] Complete: ${notified} notified, ${skipped} skipped`);
}

module.exports = mailDayNotification;

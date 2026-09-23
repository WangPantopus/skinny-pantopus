/**
 * expirePopupBusinesses
 *
 * Runs periodically to unpublish pop_up_temporary businesses whose active_until
 * has passed. Notifies owners that their listing has ended.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getBusinessMemberIdsByRole } = require('../utils/businessPermissions');
const notificationService = require('../services/notificationService');

async function expirePopupBusinesses() {
  const now = new Date().toISOString();

  // Find published pop-up businesses past their active_until
  const { data: expiredPopups, error } = await supabaseAdmin
    .from('BusinessProfile')
    .select('business_user_id')
    .eq('business_type', 'pop_up_temporary')
    .eq('is_published', true)
    .not('active_until', 'is', null)
    .lt('active_until', now);

  if (error) {
    logger.error('expirePopupBusinesses: query error', { error: error.message });
    return;
  }

  if (!expiredPopups || expiredPopups.length === 0) {
    return;
  }

  logger.info(`expirePopupBusinesses: found ${expiredPopups.length} expired pop-up(s)`);

  for (const popup of expiredPopups) {
    const businessId = popup.business_user_id;

    // Unpublish
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update({ is_published: false, updated_at: now })
      .eq('business_user_id', businessId);

    if (updateErr) {
      logger.error('expirePopupBusinesses: failed to unpublish', { businessId, error: updateErr.message });
      continue;
    }

    // Get business name for notification
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('name')
      .eq('id', businessId)
      .single();

    const businessName = bizUser?.name || 'Your pop-up';

    // In-app notification. The business account has no sign-in, so its
    // owners and admins get it, with a link to the business dashboard.
    try {
      const recipients = await getBusinessMemberIdsByRole(businessId, ['owner', 'admin']);
      for (const userId of recipients) {
        await notificationService.createNotification({
          userId,
          type: 'popup_expired',
          title: 'Pop-up listing ended',
          body: `Your pop-up listing for ${businessName} has ended. Renew to list again.`,
          link: `/app/businesses/${businessId}/dashboard`,
          metadata: { business_id: businessId },
          context: 'personal',
        });
      }
    } catch (notifErr) {
      // Non-critical — the pop-up is already unpublished.
      logger.warn('expirePopupBusinesses: notification failed', { businessId, error: notifErr.message });
    }

    logger.info('expirePopupBusinesses: unpublished expired pop-up', { businessId, name: businessName });
  }
}

module.exports = expirePopupBusinesses;

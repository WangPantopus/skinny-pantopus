/**
 * expirePopupBusinesses
 *
 * Runs periodically to unpublish pop_up_temporary businesses whose active_until
 * has passed. Notifies owners that their listing has ended.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

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

    // Create an in-app notification (insert into Notification table if it exists)
    try {
      await supabaseAdmin.from('Notification').insert({
        user_id: businessId,
        type: 'popup_expired',
        title: 'Pop-up listing ended',
        body: `Your pop-up listing for ${businessName} has ended. Renew to list again.`,
        data: { business_id: businessId },
      });
    } catch (notifErr) {
      // Non-critical — notification table may not exist yet
      logger.warn('expirePopupBusinesses: notification insert failed', { businessId, error: notifErr.message });
    }

    logger.info('expirePopupBusinesses: unpublished expired pop-up', { businessId, name: businessName });
  }
}

module.exports = expirePopupBusinesses;

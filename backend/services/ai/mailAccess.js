const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

/**
 * Authorize whether a user can view a mail item destination.
 * Mirrors DB policy logic via public.can_view_mail().
 */
async function canUserViewMail({ recipientUserId, recipientHomeId, userId }) {
  if (!userId) return false;
  if (recipientUserId && recipientUserId === userId) return true;
  if (!recipientHomeId) return false;

  const { data, error } = await supabaseAdmin.rpc('can_view_mail', {
    p_recipient_user_id: recipientUserId || null,
    p_recipient_home_id: recipientHomeId || null,
    p_user_id: userId,
  });

  if (error) {
    logger.error('can_view_mail check failed', {
      userId,
      recipientHomeId,
      error: error.message,
    });
    return false;
  }

  return Boolean(data);
}

/**
 * Fetch a mail row and enforce viewer authorization before returning it.
 * Returns null when not found or not authorized.
 */
async function getAuthorizedMail({ mailItemId, userId, select }) {
  const projection = [
    'id',
    'recipient_user_id',
    'recipient_home_id',
    ...(select ? [select] : []),
  ].join(', ');

  const { data: row, error } = await supabaseAdmin
    .from('Mail')
    .select(projection)
    .eq('id', mailItemId)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  const allowed = await canUserViewMail({
    recipientUserId: row.recipient_user_id,
    recipientHomeId: row.recipient_home_id,
    userId,
  });

  if (!allowed) return null;
  return row;
}

module.exports = {
  canUserViewMail,
  getAuthorizedMail,
};

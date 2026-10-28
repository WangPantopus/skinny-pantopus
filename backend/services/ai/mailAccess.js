const supabaseAdmin = require('../../config/supabaseAdmin');
const { canAccessMail } = require('../../utils/homeMailAccess');
const { hydrateMail } = require('../mailObjectStorage');

/**
 * Fetch a mail row and enforce viewer authorization before returning it.
 * Returns null when not found or not authorized.
 *
 * The assistant reads a letter by the mailbox's own rule (canAccessMail: the
 * caller's letter, or a Home letter the Home mail rule shows them), so it never
 * reads a letter the Mailbox would not show, such as a housemate's private one.
 */
async function getAuthorizedMail({ mailItemId, userId, select }) {
  if (!userId) return null;
  const readsContent = (select || '').split(',').some((field) => field.trim() === 'content');
  const projection = [
    'id',
    'recipient_user_id',
    'recipient_home_id',
    'deleted_at',
    ...(readsContent ? ['object_id'] : []),
    ...(select ? [select] : []),
  ].join(', ');

  const { data: row, error } = await supabaseAdmin
    .from('Mail')
    .select(projection)
    .eq('id', mailItemId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  if (!(await canAccessMail(row, userId))) return null;
  return readsContent ? hydrateMail(row) : row;
}

module.exports = {
  getAuthorizedMail,
};

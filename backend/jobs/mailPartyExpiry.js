// ============================================================
// MAIL PARTY EXPIRY JOB
// Expires pending mail party invitations older than 90 seconds
// and notifies the host that the invite expired.
// Runs every minute.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function mailPartyExpiry() {
  const expiryThreshold = new Date(Date.now() - 90 * 1000).toISOString();

  // Find pending party sessions past the 90s window
  const { data: expired, error } = await supabaseAdmin
    .from('MailPartySession')
    .select('id, mail_id, initiated_by, home_id')
    .eq('status', 'pending')
    .lt('created_at', expiryThreshold);

  if (error) {
    logger.error('[PartyExpiry] Failed to query expired sessions', { error: error.message });
    return;
  }

  if (!expired || expired.length === 0) return;

  logger.info(`[PartyExpiry] Found ${expired.length} expired party invites`);

  let expiredCount = 0;

  for (const session of expired) {
    try {
      // Mark session as expired
      await supabaseAdmin
        .from('MailPartySession')
        .update({ status: 'expired' })
        .eq('id', session.id);

      // Log notification event for the host
      await supabaseAdmin
        .from('MailEvent')
        .insert({
          event_type: 'party_invite_expired',
          mail_id: session.mail_id,
          user_id: session.initiated_by,
          metadata: {
            session_id: session.id,
            home_id: session.home_id,
          },
        });

      expiredCount++;
    } catch (err) {
      logger.error('[PartyExpiry] Error expiring session', {
        sessionId: session.id,
        error: err.message,
      });
    }
  }

  logger.info(`[PartyExpiry] Expired ${expiredCount} party sessions`);
}

module.exports = mailPartyExpiry;

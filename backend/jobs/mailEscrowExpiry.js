// ============================================================
// MAIL ESCROW EXPIRY JOB
// Expires pending escrowed mail past its escrow_expires_at date
// and notifies senders that their mail wasn't picked up.
// Runs daily at 6:00 AM UTC.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

async function mailEscrowExpiry() {
  const now = new Date().toISOString();
  const BATCH_SIZE = 500;
  let totalExpired = 0;
  let hasMore = true;

  while (hasMore) {
    // Find pending escrowed mail that has expired
    const { data: expired, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, escrow_recipient_contact, subject, display_title')
      .eq('escrow_status', 'pending')
      .not('escrow_expires_at', 'is', null)
      .lt('escrow_expires_at', now)
      .limit(BATCH_SIZE);

    if (error) {
      logger.error('[EscrowExpiry] Failed to query expired escrows', { error: error.message });
      return;
    }

    if (!expired || expired.length === 0) break;

    logger.info(`[EscrowExpiry] Processing batch of ${expired.length} expired escrowed mails`);

    for (const mail of expired) {
      try {
        // Mark as expired
        await supabaseAdmin
          .from('Mail')
          .update({ escrow_status: 'expired' })
          .eq('id', mail.id);

        // Mask the contact for the notification (e.g., j***@gmail.com or +1***456)
        const contact = mail.escrow_recipient_contact || 'the recipient';
        const maskedContact = maskContact(contact);

        // Notify the sender
        await notificationService.createNotification({
          userId: mail.sender_user_id,
          type: 'mail_escrow_expired',
          title: 'Mail not picked up',
          body: `Your letter to ${maskedContact} hasn't been picked up. Would you like to resend or withdraw it?`,
          icon: '📭',
          link: `/app/mailbox/${mail.id}`,
          metadata: {
            mail_id: mail.id,
            escrow_contact: maskedContact,
          },
        });

        totalExpired++;
      } catch (err) {
        logger.error('[EscrowExpiry] Error expiring mail', {
          mailId: mail.id,
          error: err.message,
        });
      }
    }

    // If we got a full batch, there may be more
    hasMore = expired.length === BATCH_SIZE;
  }

  if (totalExpired > 0) {
    logger.info(`[EscrowExpiry] Expired ${totalExpired} escrowed mails total`);
  }
}

/**
 * Mask a contact string for display in notifications.
 * Email: j***@gmail.com
 * Phone: +1***7890
 */
function maskContact(contact) {
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@');
    if (local.length <= 1) return `*@${domain}`;
    return `${local[0]}***@${domain}`;
  }
  // Phone: show first 2 and last 4 chars
  if (contact.length > 6) {
    return `${contact.slice(0, 2)}***${contact.slice(-4)}`;
  }
  return '***';
}

module.exports = mailEscrowExpiry;

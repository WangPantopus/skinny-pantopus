// ============================================================
// MAIL INTERRUPT NOTIFICATION JOB
// Sends real-time notifications for:
// - Package "out for delivery" status changes
// - Items tagged time_sensitive or overdue
// - Certified mail arrival
// Runs every 5 minutes
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function mailInterruptNotification() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // 1. Package status changes (out_for_delivery)
  const { data: recentPackageEvents } = await supabaseAdmin
    .from('PackageEvent')
    .select('*, MailPackage!inner(mail_id)')
    .eq('status', 'Out for delivery')
    .gte('created_at', fiveMinAgo);

  for (const event of (recentPackageEvents || [])) {
    const mailId = event.MailPackage?.mail_id;
    if (!mailId) continue;

    const { data: mail } = await supabaseAdmin
      .from('Mail')
      .select('recipient_user_id, sender_display')
      .eq('id', mailId)
      .single();

    if (mail?.recipient_user_id) {
      // Check if we already sent this notification
      const { count } = await supabaseAdmin
        .from('MailEvent')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'interrupt_out_for_delivery')
        .eq('mail_id', mailId);

      if (count === 0) {
        await supabaseAdmin.from('MailEvent').insert({
          event_type: 'interrupt_out_for_delivery',
          mail_id: mailId,
          user_id: mail.recipient_user_id,
          metadata: { sender: mail.sender_display },
        });
        logger.info('[Interrupt] Out for delivery notification', { mailId });
      }
    }
  }

  // 2. Time sensitive items (new in last 5 minutes)
  const { data: timeSensitive } = await supabaseAdmin
    .from('Mail')
    .select('id, recipient_user_id, sender_display, urgency')
    .in('urgency', ['time_sensitive', 'overdue'])
    .gte('created_at', fiveMinAgo);

  for (const item of (timeSensitive || [])) {
    if (!item.recipient_user_id) continue;

    const { count } = await supabaseAdmin
      .from('MailEvent')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'interrupt_urgent')
      .eq('mail_id', item.id);

    if (count === 0) {
      await supabaseAdmin.from('MailEvent').insert({
        event_type: 'interrupt_urgent',
        mail_id: item.id,
        user_id: item.recipient_user_id,
        metadata: { urgency: item.urgency, sender: item.sender_display },
      });
      logger.info('[Interrupt] Urgent mail notification', { mailId: item.id, urgency: item.urgency });
    }
  }

  // 3. Certified mail (ack_required, new in last 5 minutes)
  const { data: certified } = await supabaseAdmin
    .from('Mail')
    .select('id, recipient_user_id, sender_display')
    .eq('ack_required', true)
    .eq('ack_status', 'pending')
    .gte('created_at', fiveMinAgo);

  for (const item of (certified || [])) {
    if (!item.recipient_user_id) continue;

    const { count } = await supabaseAdmin
      .from('MailEvent')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'interrupt_certified')
      .eq('mail_id', item.id);

    if (count === 0) {
      await supabaseAdmin.from('MailEvent').insert({
        event_type: 'interrupt_certified',
        mail_id: item.id,
        user_id: item.recipient_user_id,
        metadata: { sender: item.sender_display },
      });
      logger.info('[Interrupt] Certified mail notification', { mailId: item.id });
    }
  }
}

module.exports = mailInterruptNotification;

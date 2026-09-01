/**
 * Support Train Notification Events
 *
 * Maps Support Train lifecycle events to the notification system.
 * Uses createNotification / createBulkNotifications from notificationService.
 *
 * Topics (type field values):
 *   support_train_updates
 *   support_train_reminders
 *   support_train_slot_changes
 *   support_train_donations
 *   support_train_open_slots
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const { createNotification, createBulkNotifications } = require('./notificationService');
const logger = require('../utils/logger');

const DEEP_LINK_PREFIX = 'pantopus://activities/support-trains';

function supportTrainReference(trainTitle) {
  const safeTrainTitle = typeof trainTitle === 'string' ? trainTitle.trim() : '';
  if (!safeTrainTitle || safeTrainTitle.toLowerCase() === 'support train') {
    return 'this Support Train';
  }
  return `the Support Train "${safeTrainTitle}"`;
}

function buildReminderTitle() {
  return 'Support Train Reminder';
}

function buildReminderBody(trainTitle, payload, timeLabel) {
  const slotLabel = payload.slot_label || 'your contribution';
  const dateLabel = payload.slot_date || timeLabel;
  const restrictionsSuffix =
    typeof payload.restrictions === 'string' && payload.restrictions.trim()
      ? ` ${payload.restrictions.trim()}`
      : '';
  const trainRef = supportTrainReference(trainTitle);

  return `You signed up to bring ${slotLabel} on ${dateLabel} for ${trainRef}.${restrictionsSuffix}`;
}

/**
 * Emit a Support Train event, fanning out notifications to the right recipients.
 *
 * @param {Object} opts
 * @param {string} opts.event — one of the support_train.* event names
 * @param {string} opts.supportTrainId
 * @param {string} opts.actorUserId — who triggered the event
 * @param {Object} opts.payload — event-specific data
 */
async function emitSupportTrainEvent({ event, supportTrainId, actorUserId, payload = {} }) {
  try {
    // Load Support Train + Activity for context
    const { data: st } = await supabaseAdmin
      .from('SupportTrain')
      .select('id, organizer_user_id, recipient_user_id, story, Activity!inner ( title )')
      .eq('id', supportTrainId)
      .single();

    if (!st) {
      logger.warn('emitSupportTrainEvent: Support Train not found', { supportTrainId, event });
      return;
    }

    const title = st.Activity?.title || 'Support Train';
    const link = `${DEEP_LINK_PREFIX}/${supportTrainId}`;

    switch (event) {
      case 'support_train.published': {
        // Notify invitees
        const { data: invites } = await supabaseAdmin
          .from('SupportTrainInvite')
          .select('invitee_user_id')
          .eq('support_train_id', supportTrainId)
          .not('invitee_user_id', 'is', null);

        const recipients = (invites || [])
          .map((i) => i.invitee_user_id)
          .filter((id) => id !== actorUserId);

        if (recipients.length > 0) {
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_updates',
              title: 'Support Train Shared',
              body: `A new Support Train "${title}" has been shared with you.`,
              icon: '🚂',
              link,
              metadata: { support_train_id: supportTrainId },
            }))
          );
        }
        break;
      }

      case 'support_train.slot_filled': {
        const recipients = await _getOrganizersAndRecipient(supportTrainId, st, actorUserId);
        const helperName = payload.helper_name || 'A helper';
        const slotLabel = payload.slot_label || 'a slot';
        const slotDate = payload.slot_date || '';

        if (recipients.length > 0) {
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_slot_changes',
              title: 'Support Train Slot Filled',
              body: `${helperName} signed up for ${slotLabel} on ${slotDate} for ${supportTrainReference(title)}.`,
              icon: '✅',
              link,
              metadata: { support_train_id: supportTrainId, slot_id: payload.slot_id },
            }))
          );
        }
        break;
      }

      case 'support_train.slot_canceled_by_helper': {
        const recipients = await _getOrganizers(supportTrainId, actorUserId);
        const helperName = payload.helper_name || 'A helper';
        const slotLabel = payload.slot_label || 'a slot';
        const reason =
          typeof payload.helper_reason === 'string' && payload.helper_reason.trim()
            ? ` Reason: ${payload.helper_reason.trim()}`
            : '';

        if (recipients.length > 0) {
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_slot_changes',
              title: 'Support Train Slot Canceled',
              body: `${helperName} canceled their ${slotLabel} signup for ${supportTrainReference(title)}.${reason}`,
              icon: '⚠️',
              link,
              metadata: { support_train_id: supportTrainId, slot_id: payload.slot_id },
            }))
          );
        }
        break;
      }

      case 'support_train.slot_canceled_by_organizer': {
        // Notify the helper whose reservation was canceled
        if (payload.helper_user_id) {
          const slotLabel = payload.slot_label || 'your slot';
          const slotDate =
            typeof payload.slot_date === 'string' && payload.slot_date
              ? new Date(`${payload.slot_date}T00:00:00Z`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
              : '';
          const reason =
            typeof payload.organizer_reason === 'string' && payload.organizer_reason.trim()
              ? ` Reason: ${payload.organizer_reason.trim()}`
              : '';
          await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_slot_changes',
            title: 'Support Train Slot Removed',
            body: `An organizer removed you from the ${slotLabel} slot${slotDate ? ` on ${slotDate}` : ''} for ${supportTrainReference(title)}.${reason}`,
            icon: '⚠️',
            link,
            metadata: {
              support_train_id: supportTrainId,
              slot_id: payload.slot_id || null,
              organizer_reason: payload.organizer_reason || null,
            },
          });
        }
        break;
      }

      case 'support_train.address_shared': {
        if (payload.helper_user_id) {
          const slotLabel = payload.slot_label || 'your delivery';
          const slotDate =
            typeof payload.slot_date === 'string' && payload.slot_date
              ? new Date(`${payload.slot_date}T00:00:00Z`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
              : '';
          await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_slot_changes',
            title: 'Support Train Address Shared',
            body: `An organizer shared the exact delivery address for the ${slotLabel} slot${slotDate ? ` on ${slotDate}` : ''} on ${supportTrainReference(title)}.`,
            icon: '📍',
            link,
            metadata: {
              support_train_id: supportTrainId,
              reservation_id: payload.reservation_id || null,
              slot_id: payload.slot_id || null,
            },
          });
        }
        break;
      }

      case 'support_train.reservation_delivered': {
        // Notify organizers + recipient that a delivery was made
        const deliverRecipients = await _getOrganizersAndRecipient(supportTrainId, st, actorUserId);
        if (deliverRecipients.length > 0) {
          const dHelperName = payload.helper_name || 'A helper';
          await createBulkNotifications(
            deliverRecipients.map((userId) => ({
              userId,
              type: 'support_train_slot_changes',
              title: 'Support Train Delivery Made',
              body: `${dHelperName} marked a contribution as delivered for ${supportTrainReference(title)}.`,
              icon: '📦',
              link,
              metadata: {
                support_train_id: supportTrainId,
                reservation_id: payload.reservation_id,
              },
            }))
          );
        }
        break;
      }

      case 'support_train.reservation_confirmed': {
        // Notify the helper that their delivery was confirmed
        if (payload.helper_user_id) {
          await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_slot_changes',
            title: 'Support Train Delivery Confirmed',
            body: `Your contribution for ${supportTrainReference(title)} has been confirmed. Thank you!`,
            icon: '🎉',
            link,
            metadata: { support_train_id: supportTrainId, reservation_id: payload.reservation_id },
          });
        }
        break;
      }

      case 'support_train.reservation_reminder_24h':
      case 'support_train.reservation_reminder_dayof': {
        // Notify the helper with full context
        if (payload.helper_user_id) {
          const timeLabel = event.includes('24h') ? 'tomorrow' : 'today';
          await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_reminders',
            title: buildReminderTitle(title, timeLabel),
            body: payload.reminder_body || buildReminderBody(title, payload, timeLabel),
            icon: '⏰',
            link,
            metadata: { support_train_id: supportTrainId, slot_id: payload.slot_id },
          });
        }
        break;
      }

      case 'support_train.update_posted': {
        // Notify all participants except the author
        const allParticipants = await _getAllParticipants(supportTrainId, actorUserId);

        if (allParticipants.length > 0) {
          await createBulkNotifications(
            allParticipants.map((userId) => ({
              userId,
              type: 'support_train_updates',
              title: 'Support Train Update',
              body: `New update on ${supportTrainReference(title)}: ${(payload.body || '').slice(0, 100)}${(payload.body || '').length > 100 ? '...' : ''}`,
              icon: '📝',
              link,
              metadata: { support_train_id: supportTrainId, update_id: payload.update_id },
            }))
          );
        }
        break;
      }

      case 'support_train.donation_received': {
        const recipients = await _getOrganizersAndRecipient(supportTrainId, st, actorUserId);

        if (recipients.length > 0) {
          const amount = payload.amount ? `$${(payload.amount / 100).toFixed(2)}` : 'a donation';
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_donations',
              title: 'Support Train Donation Received',
              body: `${payload.donor_name || 'Someone'} contributed ${amount} to ${supportTrainReference(title)}.`,
              icon: '💝',
              link,
              metadata: { support_train_id: supportTrainId },
            }))
          );
        }
        break;
      }

      case 'support_train.open_slots_nudge': {
        await createNotification({
          userId: st.organizer_user_id,
          type: 'support_train_open_slots',
          title: 'Support Train Open Slots',
          body:
            payload.nudge_text ||
            `Some slots on ${supportTrainReference(title)} are still open. Want to send a reminder?`,
          icon: '📋',
          link,
          metadata: { support_train_id: supportTrainId, open_count: payload.open_count },
        });
        break;
      }

      default:
        logger.warn('emitSupportTrainEvent: unknown event', { event, supportTrainId });
    }
  } catch (err) {
    logger.error('emitSupportTrainEvent failed', { event, supportTrainId, error: err.message });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function _getOrganizers(supportTrainId, excludeUserId) {
  const { data } = await supabaseAdmin
    .from('SupportTrainOrganizer')
    .select('user_id')
    .eq('support_train_id', supportTrainId);
  return (data || []).map((r) => r.user_id).filter((id) => id !== excludeUserId);
}

async function _getOrganizersAndRecipient(supportTrainId, st, excludeUserId) {
  const organizers = await _getOrganizers(supportTrainId, excludeUserId);
  if (
    st.recipient_user_id &&
    st.recipient_user_id !== excludeUserId &&
    !organizers.includes(st.recipient_user_id)
  ) {
    organizers.push(st.recipient_user_id);
  }
  return organizers;
}

async function _getAllParticipants(supportTrainId, excludeUserId) {
  // Organizers + recipient + helpers with active reservations
  const [orgRes, resRes, stRes] = await Promise.all([
    supabaseAdmin
      .from('SupportTrainOrganizer')
      .select('user_id')
      .eq('support_train_id', supportTrainId),
    supabaseAdmin
      .from('SupportTrainReservation')
      .select('user_id')
      .eq('support_train_id', supportTrainId)
      .neq('status', 'canceled')
      .not('user_id', 'is', null),
    supabaseAdmin
      .from('SupportTrain')
      .select('recipient_user_id')
      .eq('id', supportTrainId)
      .single(),
  ]);

  const ids = new Set();
  for (const r of orgRes.data || []) ids.add(r.user_id);
  for (const r of resRes.data || []) ids.add(r.user_id);
  if (stRes.data?.recipient_user_id) ids.add(stRes.data.recipient_user_id);

  ids.delete(excludeUserId);
  return [...ids];
}

module.exports = { emitSupportTrainEvent };

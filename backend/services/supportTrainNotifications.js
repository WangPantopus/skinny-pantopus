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
const { sendGuestReservationReminderEmail, sendGuestSignupReleasedEmail } = require('./emailService');
const { inferTimezone } = require('./context/locationResolver');
const { DateTime } = require('luxon');
const logger = require('../utils/logger');
const { loadChatPeople } = require('./chatPeople');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');
const pantopusLetters = require('./pantopusLetters');

const DEEP_LINK_PREFIX = '/app/support-trains';

function supportTrainReference(trainTitle) {
  const safeTrainTitle = typeof trainTitle === 'string' ? trainTitle.trim() : '';
  if (!safeTrainTitle || safeTrainTitle.toLowerCase() === 'support train') {
    return 'this Support Train';
  }
  return `the Support Train "${safeTrainTitle}"`;
}

// Slot dates are calendar dates ("2026-10-09"); notifications show them as "Fri, Oct 9".
function formatSlotDate(slotDate) {
  if (typeof slotDate !== 'string' || !slotDate) return '';
  return new Date(`${slotDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// "17:00:00" -> "5:00 pm", the way the apps show slot times.
function formatClockTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return String(value || '');
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'pm' : 'am'}`;
}

/** A slot's time window for emails: "5:00 pm – 7:00 pm", "From 5:00 pm", "Until 7:00 pm". */
function formatSupportTrainSlotTime(slot) {
  if (!slot) return null;
  const { start_time: start, end_time: end } = slot;
  if (start && end) return `${formatClockTime(start)} – ${formatClockTime(end)}`;
  if (start) return `From ${formatClockTime(start)}`;
  if (end) return `Until ${formatClockTime(end)}`;
  return null;
}

function buildReminderTitle() {
  return 'Support Train Reminder';
}

function buildReminderBody(trainTitle, payload, timeLabel) {
  const slotLabel = payload.slot_label || 'your contribution';
  const dateLabel = formatSlotDate(payload.slot_date) || timeLabel;
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
      .select('id, organizer_user_id, recipient_user_id, status, story, Activity!inner ( title )')
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
        // And an invitation in their Mail (SRV-9).
        await inviteLetters(supportTrainId, recipients);
        break;
      }

      case 'support_train.slot_filled': {
        const recipients = await _getOrganizersAndRecipient(supportTrainId, st, actorUserId);
        const helperName =
          payload.helper_name || (await _getDisplayName(actorUserId)) || 'A helper';
        const slotLabel = payload.slot_label || 'a slot';
        const slotDate = formatSlotDate(payload.slot_date);

        if (recipients.length > 0) {
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_slot_changes',
              title: 'Support Train Slot Filled',
              body: `${helperName} signed up for ${slotLabel}${slotDate ? ` on ${slotDate}` : ''} for ${supportTrainReference(title)}.`,
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
        const helperName =
          payload.helper_name || (await _getDisplayName(actorUserId)) || 'A helper';
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
        // Notify the helper whose reservation was canceled; an email-only guest gets an email.
        if (!payload.helper_user_id && payload.helper_guest_email) {
          await sendGuestSignupReleasedEmail({
            toEmail: payload.helper_guest_email,
            guestName: payload.helper_guest_name || 'helper',
            trainTitle: title,
            slots: [{ slotLabel: payload.slot_label || 'Your signup', slotDate: formatSlotDate(payload.slot_date) }],
            removed: true,
            reason: payload.organizer_reason,
          });
        }
        if (payload.helper_user_id) {
          const slotLabel = payload.slot_label || 'your slot';
          const slotDate = formatSlotDate(payload.slot_date);
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
        // An organizer who is also the helper shared it with themselves: nothing to tell them.
        if (payload.helper_user_id && payload.helper_user_id !== actorUserId) {
          const slotLabel = payload.slot_label || 'your delivery';
          const slotDate = formatSlotDate(payload.slot_date);
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
          const dHelperName =
            payload.helper_name || (await _getDisplayName(actorUserId)) || 'A helper';
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
        // Notify the helper that their delivery was confirmed, unless they confirmed it themselves as an organizer
        if (payload.helper_user_id && payload.helper_user_id !== actorUserId) {
          await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_slot_changes',
            title: 'Support Train Delivery Confirmed',
            body: `Your contribution for ${supportTrainReference(title)} has been confirmed. Thank you!`,
            icon: '🎉',
            link,
            metadata: { support_train_id: supportTrainId, reservation_id: payload.reservation_id },
          });
          // And a thank-you letter in their Mail (SRV-9).
          await thanksLetter({ supportTrainId, reservationId: payload.reservation_id, helperUserId: payload.helper_user_id, confirmedBy: actorUserId });
        }
        break;
      }

      case 'support_train.reservation_reminder_24h':
      case 'support_train.reservation_reminder_dayof': {
        if (!['published', 'active'].includes(st.status)) return { delivered: false };
        // Notify the helper with full context
        if (payload.helper_user_id) {
          const timeLabel = event.includes('24h') ? 'tomorrow' : 'today';
          const notification = await createNotification({
            userId: payload.helper_user_id,
            type: 'support_train_reminders',
            title: buildReminderTitle(title, timeLabel),
            body: payload.reminder_body || buildReminderBody(title, payload, timeLabel),
            icon: '⏰',
            link,
            metadata: { support_train_id: supportTrainId, slot_id: payload.slot_id },
          });
          return { delivered: Boolean(notification) };
        }
        if (payload.helper_guest_email) {
          // Resolve exact address data only for a guest with an existing share
          // receipt, using the same Home/custom-address priority as address sharing.
          let addressLabel = null;
          if (payload.guest_address_shared_at) {
            if (!payload.reservation_id || !payload.slot_id) return { delivered: false };
            // The job's snapshot can precede a cancellation or a re-share. Bind
            // the current guest receipt before repeating private address data.
            const { data: reservation, error: reservationError } = await supabaseAdmin
              .from('SupportTrainReservation')
              .select('id, SupportTrainSlot:slot_id ( id, status )')
              .eq('id', payload.reservation_id)
              .eq('support_train_id', supportTrainId)
              .eq('slot_id', payload.slot_id)
              .eq('status', 'reserved')
              .is('user_id', null)
              .eq('guest_email', payload.helper_guest_email)
              .eq('guest_address_shared_at', payload.guest_address_shared_at)
              .maybeSingle();
            if (reservationError || !reservation ||
                reservation.SupportTrainSlot?.id !== payload.slot_id ||
                !['open', 'full'].includes(reservation.SupportTrainSlot?.status)) {
              return { delivered: false };
            }
            const { data: delivery, error } = await supabaseAdmin
              .from('SupportTrain')
              .select('recipient_home_id, delivery_address, delivery_city, delivery_state, delivery_zip, Activity!inner ( home_id )')
              .eq('id', supportTrainId)
              .in('status', ['published', 'active'])
              .single();
            if (error || !delivery) return { delivered: false };
            const homeId = delivery.recipient_home_id || delivery.Activity?.home_id;
            let home = null;
            if (homeId) {
              const result = await supabaseAdmin.from('Home')
                .select('address, address2, city, state, zipcode').eq('id', homeId).single();
              if (result.error) return { delivered: false };
              home = result.data;
            }
            const firstLine = home ? [home.address, home.address2].filter(Boolean).join(' ') : delivery.delivery_address;
            const secondLine = home ? [home.city, home.state, home.zipcode] : [delivery.delivery_city, delivery.delivery_state, delivery.delivery_zip];
            if (firstLine) addressLabel = [firstLine, secondLine.filter(Boolean).join(', ')].filter(Boolean).join('\n');
          }
          const slotTime = formatSupportTrainSlotTime(payload);
          const result = await sendGuestReservationReminderEmail({
            toEmail: payload.helper_guest_email,
            guestName: payload.helper_guest_name || 'helper',
            trainTitle: title,
            slotLabel: payload.slot_label || 'your contribution',
            slotDate: formatSlotDate(payload.slot_date),
            slotTime,
            contributionMode: payload.contribution_mode,
            dishTitle: payload.dish_title,
            restaurantName: payload.restaurant_name,
            reminderDay: event.includes('24h') ? 'tomorrow' : 'today',
            guestAddressSharedAt: payload.guest_address_shared_at,
            ...(addressLabel ? { addressLabel } : {}),
            supportTrainId,
          });
          // A local log preview is not delivery and must not retire the retry.
          return { delivered: result?.success === true && result.preview !== true };
        }
        return { delivered: false };
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
              // The web train page opens its Updates tab; the apps' routers ignore the query.
              link: `${link}?tab=updates`,
              metadata: { support_train_id: supportTrainId, update_id: payload.update_id },
            })),
            { sendPush: payload.push_to_phones !== false }
          );
        }
        break;
      }

      case 'support_train.donation_received': {
        const recipients = await _getOrganizersAndRecipient(supportTrainId, st, actorUserId);

        if (recipients.length > 0) {
          const amount = payload.amount ? `$${(payload.amount / 100).toFixed(2)}` : 'a donation';
          const donorName =
            payload.donor_name || (await _getDisplayName(actorUserId)) || 'Someone';
          await createBulkNotifications(
            recipients.map((userId) => ({
              userId,
              type: 'support_train_donations',
              title: 'Support Train Donation Received',
              body: `${donorName} contributed ${amount} to ${supportTrainReference(title)}.`,
              icon: '💝',
              link,
              metadata: { support_train_id: supportTrainId },
            }))
          );
        }
        break;
      }

      case 'support_train.closed': {
        // Closing ends the Train's reminders, so helpers still signed up for a date from today
        // on (in the Train's time zone) are told they are no longer needed. Their reservations
        // stay as they are.
        const [{ data: train }, { data: reservations, error }] = await Promise.all([
          supabaseAdmin.from('SupportTrain').select('delivery_lat, delivery_lng').eq('id', supportTrainId).single(),
          supabaseAdmin
            .from('SupportTrainReservation')
            .select('user_id, guest_name, guest_email, SupportTrainSlot:slot_id ( slot_date, slot_label )')
            .eq('support_train_id', supportTrainId)
            .eq('status', 'reserved'),
        ]);
        if (error) throw error;
        const today = DateTime.now()
          .setZone(inferTimezone(train?.delivery_lat, train?.delivery_lng))
          .toISODate();
        const byHelper = new Map();
        for (const r of reservations || []) {
          const slot = r.SupportTrainSlot;
          if (!slot?.slot_date || slot.slot_date < today) continue;
          const key = r.user_id || (r.guest_email ? `guest:${r.guest_email.toLowerCase()}` : null);
          if (!key || r.user_id === actorUserId) continue;
          if (!byHelper.has(key)) byHelper.set(key, { userId: r.user_id, guestEmail: r.guest_email, guestName: r.guest_name, slots: [] });
          byHelper.get(key).slots.push(slot);
        }

        const released = (slots) => {
          const sorted = [...slots].sort((a, b) => a.slot_date.localeCompare(b.slot_date));
          return sorted.length === 1
            ? `Your ${sorted[0].slot_label || 'signup'} on ${formatSlotDate(sorted[0].slot_date)} is no longer needed.`
            : `Your ${sorted.length} upcoming signups are no longer needed.`;
        };
        const helpers = [...byHelper.values()];
        const members = helpers.filter((h) => h.userId);
        if (members.length > 0) {
          await createBulkNotifications(
            members.map((h) => ({
              userId: h.userId,
              type: 'support_train_slot_changes',
              title: 'Support Train Closed',
              body: `The organizer closed ${supportTrainReference(title)}. ${released(h.slots)} Thank you for offering to help.`,
              icon: '🚂',
              link,
              metadata: { support_train_id: supportTrainId },
            }))
          );
        }
        for (const h of helpers.filter((x) => !x.userId)) {
          await sendGuestSignupReleasedEmail({
            toEmail: h.guestEmail,
            guestName: h.guestName || 'helper',
            trainTitle: title,
            slots: [...h.slots]
              .sort((a, b) => a.slot_date.localeCompare(b.slot_date))
              .map((s) => ({ slotLabel: s.slot_label || 'Your signup', slotDate: formatSlotDate(s.slot_date) })),
          });
        }
        // Letters in their Mail (SRV-9): a thank-you to each helper, the summary to the person helped and organizers.
        await doneLetters(supportTrainId);
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
    logger.error('emitSupportTrainEvent failed', { event, supportTrainId, errorCode: err.code });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// A signed-in request carries no display name (req.user is the id, email and role), so name whoever acted
// as the train's lists do (services/chatPeople.js): a person by their Local Profile, a business by the business.
async function _getDisplayName(userId) {
  if (!userId) return null;
  return (await loadChatPeople([userId])).get(String(userId))?.displayName || null;
}

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

// ─── Letters from Pantopus (Mail tab, SRV-9) ───────────────────────────────
// The founder's picks for Support Trains: an invitation to help, a thank-you when the organizer confirms a delivery,
// a thank-you or a summary when the Train is done, and a receipt for a gift. Each goes to people the Train already
// shows itself to, beside its notice (never instead of it). Pantopus writes the words (no AI); each is made once.

const NEEDS = [
  ['enable_home_cooked_meals', 'home-cooked meals'],
  ['enable_takeout', 'takeout'],
  ['enable_groceries', 'groceries'],
  ['enable_gift_funds', 'gifts to the gift fund'],
];

const capitalized = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
// A name can end in a period ("Sage A."): a sentence ending on one gets no second.
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
const listText = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// "Fri, Oct 9" or "Fri, Oct 9 – Sun, Oct 18".
function dateRange(dates) {
  const sorted = [...new Set((dates || []).filter(Boolean))].sort();
  if (!sorted.length) return null;
  const first = formatSlotDate(sorted[0]);
  return sorted.length === 1 ? first : `${first} – ${formatSlotDate(sorted[sorted.length - 1])}`;
}

// What a Train's letters say about it: its title, who it's for, who organizes it, what it needs and its days.
async function trainForLetters(supportTrainId) {
  const [{ data: train, error }, { data: slots }] = await Promise.all([
    supabaseAdmin.from('SupportTrain')
      .select('id, organizer_user_id, recipient_user_id, status, enable_home_cooked_meals, enable_takeout, enable_groceries, enable_gift_funds, Activity!inner ( title )')
      .eq('id', supportTrainId)
      .single(),
    supabaseAdmin.from('SupportTrainSlot').select('id, slot_date').eq('support_train_id', supportTrainId),
  ]);
  if (error || !train) throw new Error(error?.message || 'Support Train not found');
  const people = await loadChatPeople([train.organizer_user_id, train.recipient_user_id].filter(Boolean));
  const title = (train.Activity?.title || '').trim() || 'Support Train';
  const recipientName = train.recipient_user_id ? people.get(String(train.recipient_user_id))?.displayName || null : null;
  return {
    train,
    title,
    reference: supportTrainReference(title),
    organizerName: people.get(String(train.organizer_user_id))?.displayName || 'The organizer',
    recipientName,
    forWhom: recipientName || title,
    needs: NEEDS.filter(([key]) => train[key]).map(([, label]) => label),
    slots: slots || [],
    dates: dateRange((slots || []).map((s) => s.slot_date)),
  };
}

/** 1. Invited to help: a letter to each invitee with an account, once per Train. Never throws. */
async function inviteLetters(supportTrainId, inviteeIds) {
  const ids = [...new Set((inviteeIds || []).filter(Boolean))];
  if (!ids.length || !isLaunchFeatureEnabled('mailbox')) return;
  try {
    const t = await trainForLetters(supportTrainId);
    const needs = t.needs.length ? listText(t.needs) : null;
    for (const userId of ids) {
      await pantopusLetters.sendSafe(`st-invite:${supportTrainId}:${userId}`, {
        recipient_user_id: userId,
        subject: t.recipientName ? `You're invited to help ${t.recipientName}` : `You're invited to help: ${t.title}`,
        content: [
          sentence(`${t.organizerName} invited you to help with ${t.reference}${t.recipientName ? `, for ${t.recipientName}` : ''}`),
          '',
          ...(needs ? [`What's needed: ${needs}.`] : []),
          ...(t.dates ? [`When: ${t.dates}.`] : []),
          ...(needs || t.dates ? [''] : []),
          'Open the Support Train in Pantopus to see the open days and sign up for one.',
          '',
          'Your Pantopus carrier',
        ].join('\n'),
        summary: sentence(`${t.organizerName} invited you to help ${t.forWhom}${needs ? ` with ${needs}` : ''}${t.dates ? `, ${t.dates}` : ''}`),
        key_facts: [
          { label: 'For', value: t.forWhom },
          ...(needs ? [{ label: 'Needed', value: capitalized(needs) }] : []),
          ...(t.dates ? [{ label: 'When', value: t.dates }] : []),
          { label: 'Organizer', value: t.organizerName },
        ],
      });
    }
  } catch (err) {
    logger.warn('Support Train invite letters not written', { supportTrainId, error: err.message });
  }
}

/** 3. Thank you for helping: when an organizer confirms a helper's delivery, to that helper. Never throws. */
async function thanksLetter({ supportTrainId, reservationId, helperUserId, confirmedBy }) {
  if (!helperUserId || !reservationId || !isLaunchFeatureEnabled('mailbox')) return;
  try {
    const [t, { data: r }] = await Promise.all([
      trainForLetters(supportTrainId),
      supabaseAdmin.from('SupportTrainReservation')
        .select('id, user_id, dish_title, restaurant_name, SupportTrainSlot:slot_id ( slot_date, slot_label )')
        .eq('id', reservationId)
        .maybeSingle(),
    ]);
    if (!r || r.user_id !== helperUserId) return;
    const what = r.SupportTrainSlot?.slot_label || 'contribution';
    const day = formatSlotDate(r.SupportTrainSlot?.slot_date);
    const by = (await _getDisplayName(confirmedBy)) || t.organizerName;
    const brought = r.dish_title || r.restaurant_name || null;
    await pantopusLetters.sendSafe(`st-thanks:${reservationId}`, {
      recipient_user_id: helperUserId,
      subject: t.recipientName ? `Thank you for helping ${t.recipientName}` : 'Thank you for helping',
      content: [
        `${by} confirmed your ${what}${day ? ` on ${day}` : ''} for ${t.reference}.`,
        '',
        'Thank you for showing up for your neighbor.',
        '',
        'Your Pantopus carrier',
      ].join('\n'),
      summary: sentence(`${by} confirmed your ${what}${day ? ` on ${day}` : ''}. Thank you for helping ${t.forWhom}`),
      key_facts: [
        { label: 'For', value: t.forWhom },
        { label: 'Your help', value: brought ? `${capitalized(what)}: ${brought}` : capitalized(what) },
        ...(day ? [{ label: 'Day', value: day }] : []),
      ],
    });
  } catch (err) {
    logger.warn('Support Train thank-you letter not written', { supportTrainId, error: err.message });
  }
}

/**
 * 5. The Train is done: a thank-you to each helper, and a summary to the person helped and each organizer (days
 * covered, helpers, gifts). Never throws.
 */
async function doneLetters(supportTrainId) {
  if (!isLaunchFeatureEnabled('mailbox')) return;
  try {
    const t = await trainForLetters(supportTrainId);
    const [{ data: reservations, error }, organizers, { data: fund }] = await Promise.all([
      supabaseAdmin.from('SupportTrainReservation')
        .select('user_id, guest_email, SupportTrainSlot:slot_id ( slot_date, slot_label )')
        .eq('support_train_id', supportTrainId)
        .neq('status', 'canceled'),
      _getOrganizers(supportTrainId, null),
      supabaseAdmin.from('SupportTrainFund').select('id, total_amount').eq('support_train_id', supportTrainId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const helpers = new Map();
    const helperKeys = new Set();
    for (const r of reservations || []) {
      const key = r.user_id || (r.guest_email ? `guest:${r.guest_email.toLowerCase()}` : null);
      if (key) helperKeys.add(key);
      if (!r.user_id) continue;
      if (!helpers.has(r.user_id)) helpers.set(r.user_id, []);
      helpers.get(r.user_id).push(r.SupportTrainSlot?.slot_date);
    }
    const covered = new Set((reservations || []).map((r) => r.SupportTrainSlot?.slot_date).filter(Boolean));
    const allDays = new Set(t.slots.map((s) => s.slot_date).filter(Boolean));
    let gifts = null;
    if (fund?.id && t.train.enable_gift_funds) {
      const { count } = await supabaseAdmin.from('SupportTrainFundContribution').select('id', { count: 'exact', head: true })
        .eq('support_train_fund_id', fund.id).eq('payment_status', 'succeeded');
      if (count) gifts = { count, total: `$${(Number(fund.total_amount || 0) / 100).toFixed(2)}` };
    }
    const leaders = new Set([...organizers, t.train.organizer_user_id, t.train.recipient_user_id].filter(Boolean));

    for (const [userId, dates] of helpers) {
      if (leaders.has(userId)) continue;
      const days = dates.filter(Boolean).length;
      const range = dateRange(dates);
      await pantopusLetters.sendSafe(`st-done:${supportTrainId}:${userId}`, {
        recipient_user_id: userId,
        subject: t.recipientName ? `Thank you for helping ${t.recipientName}` : `${t.title} is complete`,
        content: [
          `${t.organizerName} closed ${t.reference}: it's complete.`,
          '',
          `You signed up for ${days || 1} ${days === 1 || !days ? 'day' : 'days'}${range ? ` (${range})` : ''}. Thank you for helping.`,
          '',
          'Your Pantopus carrier',
        ].join('\n'),
        summary: sentence(`${capitalized(t.reference)} is complete. Thank you for helping ${t.forWhom}`),
        key_facts: [{ label: 'For', value: t.forWhom }, ...(range ? [{ label: 'Your days', value: range }] : [])],
      });
    }

    const lines = [
      `Days covered: ${covered.size} of ${allDays.size || covered.size}${t.dates ? ` (${t.dates})` : ''}`,
      `Helpers: ${helperKeys.size} ${helperKeys.size === 1 ? 'neighbor' : 'neighbors'}`,
      ...(gifts ? [`Gifts: ${gifts.total} from ${gifts.count} ${gifts.count === 1 ? 'gift' : 'gifts'}`] : []),
    ];
    for (const userId of leaders) {
      const helped = userId === t.train.recipient_user_id;
      await pantopusLetters.sendSafe(`st-done:${supportTrainId}:${userId}`, {
        recipient_user_id: userId,
        subject: `${t.title} is complete`,
        content: [
          `${capitalized(t.reference)} is complete. Here's what neighbors gave:`,
          '',
          ...lines,
          '',
          helped ? 'Your neighbors were glad to help.' : 'Thank you for organizing it.',
          '',
          'Your Pantopus carrier',
        ].join('\n'),
        summary: `${capitalized(t.reference)} is complete: ${covered.size} of ${allDays.size || covered.size} days covered by ${helperKeys.size} ${helperKeys.size === 1 ? 'neighbor' : 'neighbors'}${gifts ? `, and ${gifts.total} in gifts` : ''}.`,
        key_facts: [
          { label: 'Days covered', value: `${covered.size} of ${allDays.size || covered.size}` },
          { label: 'Helpers', value: String(helperKeys.size) },
          ...(gifts ? [{ label: 'Gifts', value: gifts.total }] : []),
        ],
      });
    }
  } catch (err) {
    logger.warn('Support Train done letters not written', { supportTrainId, error: err.message });
  }
}

/**
 * 6. Gift receipt: once a gift is recorded as made, a receipt to the donor, filed in their own Receipts folder (the
 * donor gets it whether or not the gift showed their name). Never throws.
 */
async function giftReceiptLetter(contributionId) {
  if (!contributionId || !isLaunchFeatureEnabled('mailbox')) return;
  try {
    const { data: c, error } = await supabaseAdmin.from('SupportTrainFundContribution')
      .select('id, contributor_user_id, amount, is_anonymous, payment_status, created_at, SupportTrainFund:support_train_fund_id ( support_train_id )')
      .eq('id', contributionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c?.contributor_user_id || c.payment_status !== 'succeeded' || !c.SupportTrainFund?.support_train_id) return;
    const donor = c.contributor_user_id;
    const t = await trainForLetters(c.SupportTrainFund.support_train_id);
    /* eslint-disable global-require */
    const { ensureSystemFolders } = require('./mailVault');
    const { getAccessibleHomeIds } = require('../utils/homeMailAccess');
    const mailDelivery = require('./mailDelivery');
    /* eslint-enable global-require */
    await ensureSystemFolders(donor, await getAccessibleHomeIds(donor));
    const { data: receipts } = await supabaseAdmin.from('VaultFolder').select('id').eq('user_id', donor)
      .eq('drawer', 'personal').eq('label', 'Receipts').eq('system', true).order('created_at').limit(1);
    const zone = (await mailDelivery.personTimeZone(donor)) || mailDelivery.FALLBACK_TIME_ZONE;
    const day = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: zone });
    const amount = `$${(Number(c.amount || 0) / 100).toFixed(2)}`;
    await pantopusLetters.sendSafe(`st-gift:${c.id}`, {
      recipient_user_id: donor,
      subject: `Your gift to ${t.forWhom}`,
      content: [
        `Thank you for your gift of ${amount} to ${t.reference} on ${day}.`,
        '',
        ...(c.is_anonymous ? ['You gave without your name: the Train shows your gift as anonymous.', ''] : []),
        'This is your receipt. Pantopus keeps it in your Vault, under Receipts.',
        '',
        'Your Pantopus carrier',
      ].join('\n'),
      summary: `You gave ${amount} to ${t.reference} on ${day}.`,
      key_facts: [{ label: 'Amount', value: amount }, { label: 'Date', value: day }, { label: 'For', value: t.forWhom }],
      category: 'receipt',
      filed_folder_id: receipts?.[0]?.id || null,
    });
  } catch (err) {
    logger.warn('Support Train gift receipt not written', { contributionId, error: err.message });
  }
}

module.exports = { emitSupportTrainEvent, formatSupportTrainSlotTime, inviteLetters, giftReceiptLetter };

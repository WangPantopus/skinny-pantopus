// ============================================================
// JOB: Support Train Reminders
// Sends reminders to helpers for upcoming slots and nudges
// organizers about unfilled slots. Runs every 30 minutes.
//
// Three tasks:
//   1. Reminders after 17:00 train-local time the evening before
//   2. Day-of reminders at 07:00 local or 4h before an earlier start
//   3. Open-slots nudges for organizers (max once per 48h)
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { emitSupportTrainEvent } = require('../services/supportTrainNotifications');
const { listEffectivelyOpenSlots } = require('../services/supportTrainSlotAvailability');
const { inferTimezone } = require('../services/context/locationResolver');
const { DateTime } = require('luxon');

function localReminderTime(reservation, now) {
  const train = reservation.SupportTrain;
  return DateTime.fromJSDate(now, {
    zone: inferTimezone(train?.delivery_lat, train?.delivery_lng),
  });
}

// A reservation is claimed (its marker set while it is still reserved and
// unmarked) before anything is sent, so overlapping runs, or a run after a
// failed marker write, never send twice, and a helper who cancelled first is
// never reminded. A delivery that doesn't go out releases the claim, so the
// next run retries it.
async function claimReminder(reservationId, marker, claimedAt) {
  const { data, error } = await supabaseAdmin
    .from('SupportTrainReservation')
    .update({ [marker]: claimedAt })
    .eq('id', reservationId)
    .eq('status', 'reserved')
    .is(marker, null)
    .select('id')
    .maybeSingle();
  if (error) {
    logger.error('[supportTrainReminders] reminder claim failed', { errorCode: error.code });
    return false;
  }
  return Boolean(data);
}

async function releaseReminder(reservationId, marker, claimedAt) {
  const { error } = await supabaseAdmin
    .from('SupportTrainReservation')
    .update({ [marker]: null })
    .eq('id', reservationId)
    .eq(marker, claimedAt);
  if (error) {
    logger.error('[supportTrainReminders] reminder release failed', { errorCode: error.code });
  }
}

async function runSupportTrainReminders() {
  await _send24hReminders();
  await _sendDayOfReminders();
  await _sendOpenSlotNudges();
}

// ─── 24h Reminders ─────────────────────────────────────────────────────────

async function _send24hReminders() {
  try {
    const now = new Date();

    const { data: reservations, error } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(`
        id, user_id, guest_name, guest_email, support_train_id, contribution_mode,
        dish_title, restaurant_name, guest_address_shared_at, last_reminder_sent,
        SupportTrain:support_train_id ( delivery_lat, delivery_lng ),
        SupportTrainSlot:slot_id (
          id, slot_date, slot_label, support_mode, start_time, end_time, status
        )
      `)
      .eq('status', 'reserved')
      .is('last_reminder_sent', null);

    if (error) {
      logger.error('[supportTrainReminders] 24h query failed', { errorCode: error.code });
      return;
    }

    const tomorrowReservations = (reservations || []).filter(r => {
      const localNow = localReminderTime(r, now);
      return localNow.hour >= 17 &&
        r.SupportTrainSlot?.slot_date === localNow.plus({ days: 1 }).toISODate() &&
        ['open', 'full'].includes(r.SupportTrainSlot.status);
    });

    let sent = 0;
    for (const res of tomorrowReservations) {
      const slot = res.SupportTrainSlot;
      const claimedAt = now.toISOString();
      if (!(await claimReminder(res.id, 'last_reminder_sent', claimedAt))) continue;
      const delivery = await emitSupportTrainEvent({
        event: 'support_train.reservation_reminder_24h',
        supportTrainId: res.support_train_id,
        actorUserId: res.user_id,
        payload: {
          reservation_id: res.id,
          helper_user_id: res.user_id,
          helper_guest_email: res.guest_email,
          helper_guest_name: res.guest_name,
          contribution_mode: res.contribution_mode,
          dish_title: res.dish_title,
          restaurant_name: res.restaurant_name,
          guest_address_shared_at: res.guest_address_shared_at,
          slot_id: slot.id,
          slot_label: slot.slot_label,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
      });

      if (delivery?.delivered !== true) {
        await releaseReminder(res.id, 'last_reminder_sent', claimedAt);
        continue;
      }

      sent++;
    }

    if (sent > 0) {
      logger.info('[supportTrainReminders] 24h reminders sent', { count: sent });
    }
  } catch (err) {
    logger.error('[supportTrainReminders] 24h reminders failed', { errorCode: err.code });
  }
}

// ─── Day-of Reminders ──────────────────────────────────────────────────────

async function _sendDayOfReminders() {
  try {
    const now = new Date();

    const { data: reservations, error } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(`
        id, user_id, guest_name, guest_email, support_train_id, contribution_mode,
        dish_title, restaurant_name, guest_address_shared_at, day_of_reminder_sent_at,
        SupportTrain:support_train_id ( delivery_lat, delivery_lng ),
        SupportTrainSlot:slot_id (
          id, slot_date, slot_label, support_mode, start_time, end_time, status
        )
      `)
      .eq('status', 'reserved')
      .is('day_of_reminder_sent_at', null);

    if (error) {
      logger.error('[supportTrainReminders] day-of query failed', { errorCode: error.code });
      return;
    }

    const eligible = (reservations || []).filter(r => {
      const slot = r.SupportTrainSlot;
      const localNow = localReminderTime(r, now);
      if (!slot || slot.slot_date !== localNow.toISODate()) return false;
      if (!['open', 'full'].includes(slot.status)) return false;
      const morning = localNow.startOf('day').set({ hour: 7 });
      if (!slot.start_time) return localNow >= morning;
      const start = DateTime.fromISO(`${slot.slot_date}T${slot.start_time}`, { zone: localNow.zoneName });
      if (!start.isValid || start < localNow) return false;
      const fourHoursBefore = start.minus({ hours: 4 });
      const due = fourHoursBefore < morning ? fourHoursBefore : morning;
      // A start before 04:00 is eligible from midnight on the slot's day;
      // the day-of email must not say "today" on the preceding evening.
      return localNow >= due;
    });

    let sent = 0;
    for (const res of eligible) {
      const slot = res.SupportTrainSlot;
      const claimedAt = now.toISOString();
      if (!(await claimReminder(res.id, 'day_of_reminder_sent_at', claimedAt))) continue;
      const delivery = await emitSupportTrainEvent({
        event: 'support_train.reservation_reminder_dayof',
        supportTrainId: res.support_train_id,
        actorUserId: res.user_id,
        payload: {
          reservation_id: res.id,
          helper_user_id: res.user_id,
          helper_guest_email: res.guest_email,
          helper_guest_name: res.guest_name,
          contribution_mode: res.contribution_mode,
          dish_title: res.dish_title,
          restaurant_name: res.restaurant_name,
          guest_address_shared_at: res.guest_address_shared_at,
          slot_id: slot.id,
          slot_label: slot.slot_label,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
      });

      if (delivery?.delivered !== true) {
        await releaseReminder(res.id, 'day_of_reminder_sent_at', claimedAt);
        continue;
      }

      sent++;
    }

    if (sent > 0) {
      logger.info('[supportTrainReminders] day-of reminders sent', { count: sent });
    }
  } catch (err) {
    logger.error('[supportTrainReminders] day-of reminders failed', { errorCode: err.code });
  }
}

// ─── Open Slot Nudges ──────────────────────────────────────────────────────

async function _sendOpenSlotNudges() {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayDate = now.toISOString().split('T')[0];
    const weekDate = sevenDaysLater.toISOString().split('T')[0];
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Find slots with real remaining capacity in the next 7 days. Do not trust
    // denormalized slot counters alone; stale rows can otherwise nudge organizers
    // after every visible slot already has an active reservation.
    let openSlots;
    try {
      openSlots = await listEffectivelyOpenSlots({
        fromDate: todayDate,
        toDate: weekDate,
        columns: 'id, support_train_id, slot_date, status, capacity, filled_count',
      });
    } catch (error) {
      logger.error('[supportTrainReminders] open slots query failed', { errorCode: error.code });
      return;
    }

    // Group by support_train_id and count
    const trainCounts = {};
    for (const slot of (openSlots || [])) {
      trainCounts[slot.support_train_id] = (trainCounts[slot.support_train_id] || 0) + 1;
    }

    let sent = 0;
    for (const [trainId, openCount] of Object.entries(trainCounts)) {
      // Check train is published or active
      const { data: train } = await supabaseAdmin
        .from('SupportTrain')
        .select('id, organizer_user_id, status, Activity!inner ( title )')
        .eq('id', trainId)
        .in('status', ['published', 'active'])
        .single();

      if (!train) continue;

      // Check if we already nudged in the last 48 hours (use notification log)
      // Simple approach: check last open_slots nudge notification
      const { count: recentNudgeCount } = await supabaseAdmin
        .from('Notification')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', train.organizer_user_id)
        .eq('type', 'support_train_open_slots')
        .gte('created_at', fortyEightHoursAgo);

      if ((recentNudgeCount || 0) > 0) continue;

      const title = train.Activity?.title || 'Support Train';
      await emitSupportTrainEvent({
        event: 'support_train.open_slots_nudge',
        supportTrainId: trainId,
        actorUserId: train.organizer_user_id,
        payload: {
          open_count: openCount,
          nudge_text: `${openCount} slot${openCount > 1 ? 's' : ''} on "${title}" ${openCount > 1 ? 'are' : 'is'} still open this week. Want to send a gentle reminder?`,
        },
      });
      sent++;
    }

    if (sent > 0) {
      logger.info('[supportTrainReminders] open slot nudges sent', { count: sent });
    }
  } catch (err) {
    logger.error('[supportTrainReminders] open slot nudges failed', { errorCode: err.code });
  }
}

module.exports = { runSupportTrainReminders };

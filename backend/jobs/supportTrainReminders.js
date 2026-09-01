// ============================================================
// JOB: Support Train Reminders
// Sends reminders to helpers for upcoming slots and nudges
// organizers about unfilled slots. Runs every 30 minutes.
//
// Three tasks:
//   1. 24h reminders for tomorrow's reservations
//   2. Day-of reminders for slots starting within 4 hours
//   3. Open-slots nudges for organizers (max once per 48h)
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { emitSupportTrainEvent } = require('../services/supportTrainNotifications');
const { listEffectivelyOpenSlots } = require('../services/supportTrainSlotAvailability');

async function runSupportTrainReminders() {
  await _send24hReminders();
  await _sendDayOfReminders();
  await _sendOpenSlotNudges();
}

// ─── 24h Reminders ─────────────────────────────────────────────────────────

async function _send24hReminders() {
  try {
    // Find reservations for tomorrow's slots
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const { data: reservations, error } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(`
        id, user_id, support_train_id, contribution_mode, last_reminder_sent,
        SupportTrainSlot:slot_id (
          id, slot_date, slot_label, support_mode, start_time, end_time
        )
      `)
      .eq('status', 'reserved')
      .is('last_reminder_sent', null)
      .not('user_id', 'is', null);

    if (error) {
      logger.error('[supportTrainReminders] 24h query failed', { error: error.message });
      return;
    }

    // Filter for tomorrow's slots (slot_date comparison)
    const tomorrowReservations = (reservations || []).filter(r =>
      r.SupportTrainSlot?.slot_date === tomorrowDate
    );

    const now = new Date().toISOString();
    let sent = 0;
    for (const res of tomorrowReservations) {
      const slot = res.SupportTrainSlot;
      await emitSupportTrainEvent({
        event: 'support_train.reservation_reminder_24h',
        supportTrainId: res.support_train_id,
        actorUserId: res.user_id,
        payload: {
          helper_user_id: res.user_id,
          slot_id: slot.id,
          slot_label: slot.slot_label,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
        },
      });

      // Mark as reminded so we don't re-send
      await supabaseAdmin
        .from('SupportTrainReservation')
        .update({ last_reminder_sent: now })
        .eq('id', res.id);

      sent++;
    }

    if (sent > 0) {
      logger.info('[supportTrainReminders] 24h reminders sent', { count: sent });
    }
  } catch (err) {
    logger.error('[supportTrainReminders] 24h reminders failed', { error: err.message });
  }
}

// ─── Day-of Reminders ──────────────────────────────────────────────────────

async function _sendDayOfReminders() {
  try {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const nowTimeStr = now.toISOString().split('T')[1].slice(0, 5);       // HH:mm
    const laterTimeStr = fourHoursLater.toISOString().split('T')[1].slice(0, 5);

    const { data: reservations, error } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(`
        id, user_id, support_train_id, contribution_mode, last_reminder_sent,
        SupportTrainSlot:slot_id (
          id, slot_date, slot_label, support_mode, start_time, end_time
        )
      `)
      .eq('status', 'reserved')
      .is('last_reminder_sent', null)
      .not('user_id', 'is', null);

    if (error) {
      logger.error('[supportTrainReminders] day-of query failed', { error: error.message });
      return;
    }

    // Filter: today's slots with start_time within the next 4 hours
    const eligible = (reservations || []).filter(r => {
      const slot = r.SupportTrainSlot;
      if (!slot || slot.slot_date !== todayDate || !slot.start_time) return false;
      return slot.start_time >= nowTimeStr && slot.start_time <= laterTimeStr;
    });

    let sent = 0;
    for (const res of eligible) {
      const slot = res.SupportTrainSlot;
      await emitSupportTrainEvent({
        event: 'support_train.reservation_reminder_dayof',
        supportTrainId: res.support_train_id,
        actorUserId: res.user_id,
        payload: {
          helper_user_id: res.user_id,
          slot_id: slot.id,
          slot_label: slot.slot_label,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
        },
      });

      // Mark as reminded
      await supabaseAdmin
        .from('SupportTrainReservation')
        .update({ last_reminder_sent: now.toISOString() })
        .eq('id', res.id);

      sent++;
    }

    if (sent > 0) {
      logger.info('[supportTrainReminders] day-of reminders sent', { count: sent });
    }
  } catch (err) {
    logger.error('[supportTrainReminders] day-of reminders failed', { error: err.message });
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
      logger.error('[supportTrainReminders] open slots query failed', { error: error.message });
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
    logger.error('[supportTrainReminders] open slot nudges failed', { error: err.message });
  }
}

module.exports = { runSupportTrainReminders };

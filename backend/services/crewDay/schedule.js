'use strict';

/**
 * The Crew Day timers (02-contract.md §7): the evening-before reminder (6 PM local, once per booking) and the deadlines
 * (unanswered new dates and price offers end free; finished days close; access notes are cleared 7 days after the
 * booking's day). Each skips while `crew_day` is unlisted; locally they run once through the internal job endpoints.
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { skipForLaunchCut } = require('../../utils/featureFlags');
const rules = require('./rules');
const store = require('./store');
const notices = require('./notices');
const bookingsService = require('./bookings');

async function daysById(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin.from('CrewDay').select('*').in('id', [...new Set(ids)]);
  if (error) throw store.unavailable('schedule_days', error);
  return new Map((data || []).map((d) => [String(d.id), d]));
}

/** crewDayReminders: from 6 PM local the evening before until the window starts, once per booking. */
async function runReminders({ now = new Date() } = {}) {
  if (skipForLaunchCut('crew_day', 'crewDayReminders')) return { skipped: true };
  const soon = DateTime.fromJSDate(now).plus({ days: 2 }).toISODate();
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('status', 'booked')
    .is('reminder_sent_at', null).lte('service_date', soon);
  if (error) throw store.unavailable('reminders', error);
  const dayOf = await daysById((rows || []).map((b) => b.crew_day_id));
  let sent = 0;
  for (const b of rows || []) {
    const day = dayOf.get(String(b.crew_day_id));
    if (!day || !['open', 'in_progress'].includes(day.status)) continue;
    const from = DateTime.fromISO(b.service_date, { zone: day.timezone }).minus({ days: 1 }).set({ hour: 18, minute: 0 });
    const until = rules.localInstant(b.service_date, b.window_start, day.timezone);
    const at = DateTime.fromJSDate(now);
    if (at < from || at >= until) continue;
    const { data: claimed } = await supabaseAdmin.from('CrewDayBooking').update({ reminder_sent_at: now.toISOString() })
      .eq('id', b.id).is('reminder_sent_at', null).select('*').maybeSingle();
    if (!claimed) continue;
    await notices.reminder(day, claimed).catch(() => {});
    sent += 1;
  }
  logger.info('[crewDayReminders] run', { sent });
  return { sent };
}

async function endBooking(b, day, from, reason, crew, fields = {}) {
  const ended = await bookingsService.transition(b, from, { status: 'cancelled', cancelled_by: 'system',
    cancelled_at: new Date().toISOString(), cancel_reason: reason, ...fields }).catch(() => null);
  if (!ended) return false;
  await store.addEvent({ day, booking: ended, actorRole: 'system', kind: 'booking_cancelled', data: { by: 'system', reason },
    visibleTo: 'both' });
  await notices.bookingCancelled(day, ended, crew, reason).catch(() => {});
  return true;
}

/** crewDayDeadlines: unanswered new dates and price offers end free; finished days close; old access notes go. */
async function runDeadlines({ now = new Date() } = {}) {
  if (skipForLaunchCut('crew_day', 'crewDayDeadlines')) return { skipped: true };
  const result = { no_new_date: 0, price_not_answered: 0, days_done: 0, notes_cleared: 0 };
  const { data: waiting, error } = await supabaseAdmin.from('CrewDayBooking').select('*')
    .in('status', ['new_dates', 'price_pending', 'price_offered']);
  if (error) throw store.unavailable('deadlines', error);
  const dayOf = await daysById((waiting || []).map((b) => b.crew_day_id));
  for (const b of waiting || []) {
    const day = dayOf.get(String(b.crew_day_id));
    if (!day) continue;
    const crew = await bookingsService.crewFor(day);
    if (b.status === 'new_dates' && day.proposed_dates && now >= new Date(day.proposed_dates.deadline_at)) {
      // Recorded as the proposal's answer, like the household's own "Cancel at no charge" (with no answer time), so the
      // crew's answers list the home as cancelled.
      const answer = { new_date_choice: { proposal_id: day.proposed_dates.id, date: 'cancel', answered_at: null } };
      if (await endBooking(b, day, ['new_dates'], 'no_new_date', crew, answer)) result.no_new_date += 1;
    } else if (b.status !== 'new_dates' && now >= new Date(day.booking_closes_at)) {
      if (await endBooking(b, day, ['price_pending', 'price_offered'], 'price_not_answered', crew)) result.price_not_answered += 1;
    }
  }
  // A day is done once its dates have passed and none of its homes still waits for work or money.
  const { data: live } = await supabaseAdmin.from('CrewDay').select('*').eq('kind', 'offer').in('status', ['open', 'in_progress']);
  const bookings = await store.bookingsByDay((live || []).map((d) => d.id));
  for (const day of live || []) {
    const rows = bookings.get(String(day.id)) || [];
    const lastDate = [day.service_date, ...rows.filter((b) => !rules.INACTIVE_BOOKING_STATUSES.includes(b.status))
      .map((b) => b.service_date)].sort().pop();
    const settled = rows.every((b) => ['paid', 'refunded', 'cancelled', 'declined'].includes(b.status));
    if (lastDate < rules.todayIn(day.timezone, now) && settled) {
      const { data: closed } = await supabaseAdmin.from('CrewDay').update({ status: 'done', completed_at: now.toISOString(),
        proposed_dates: null, updated_at: now.toISOString() }).eq('id', day.id).in('status', ['open', 'in_progress'])
        .select('*').maybeSingle();
      if (closed) {
        await store.addEvent({ day: closed, actorRole: 'system', kind: 'day_done', visibleTo: 'both' });
        result.days_done += 1;
      }
    }
  }
  const cutoff = DateTime.fromJSDate(now).minus({ days: 7 }).toISODate();
  const { data: cleared } = await supabaseAdmin.from('CrewDayBooking').update({ access_note: null, updated_at: now.toISOString() })
    .lt('service_date', cutoff).not('access_note', 'is', null).select('id');
  result.notes_cleared = (cleared || []).length;
  logger.info('[crewDayDeadlines] run', result);
  return result;
}

module.exports = { runReminders, runDeadlines };

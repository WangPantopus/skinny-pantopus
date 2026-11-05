'use strict';

/**
 * When plans change (01-spec.md rules 4–5, screens 6, 15 and 18): rain (the crew offers two or three dates at the same
 * price; each household picks one or cancels free; unanswered bookings are cancelled free at the deadline), cancelling
 * a whole day (the crew or the operator; nobody is charged), and inviting the crew's past customers to a new day.
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const blockService = require('../blockService');
const rules = require('./rules');
const store = require('./store');
const days = require('./days');
const bookingsService = require('./bookings');
const notices = require('./notices');

const { CrewDayError } = rules;
// Homes a day's cancellation or rain moves: everything not yet worked on.
const NOT_STARTED = ['price_pending', 'price_offered', 'booked', 'new_dates', 'on_the_way'];

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

function parseTime(value, field) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(String(value || ''));
  if (!m) throw invalid('Each date needs an arrival window like 09:00 to 13:00.', field);
  return `${m[1]}:${m[2]}`;
}

/** POST /:id/propose-dates { dates: [{ date, window_start, window_end }] (2–3), note? } */
async function proposeDates(dayId, userId, body = {}) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId, 'profile.edit');
  if (!['open', 'in_progress'].includes(day.status)) throw new CrewDayError(409, 'DAY_NOT_OPEN', 'Only an open Crew Day can move.');
  const list = Array.isArray(body.dates) ? body.dates : [];
  if (list.length < 2 || list.length > 3) throw invalid('Offer two or three dates.', 'dates');
  const today = rules.todayIn(day.timezone);
  const last = DateTime.fromISO(today).plus({ days: 14 }).toISODate();
  const dates = list.map((d, i) => {
    const date = String(d?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today || date > last) {
      throw invalid('Pick dates in the next 14 days, after today.', `dates.${i}.date`);
    }
    const start = parseTime(d.window_start, `dates.${i}.window_start`);
    const end = parseTime(d.window_end, `dates.${i}.window_end`);
    if (end <= start) throw invalid('Each window has to end after it starts.', `dates.${i}.window_end`);
    return { date, window_start: start, window_end: end };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(dates.map((d) => d.date)).size !== dates.length) throw invalid('Pick different dates.', 'dates');
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('crew_day_id', day.id)
    .in('status', ['booked', 'new_dates']);
  if (error) throw store.unavailable('propose_dates', error);
  if (!rows?.length) throw new CrewDayError(409, 'NO_HOMES', 'No booked homes to move.');
  const proposal = {
    id: crypto.randomUUID(),
    dates,
    deadline_at: rules.localInstant(dates[0].date, dates[0].window_start, day.timezone).minus({ hours: 24 }).toUTC().toISO(),
    note: body.note == null ? null : String(body.note).trim().slice(0, 500) || null,
    sent_at: new Date().toISOString(),
    homes: rows.length,
  };
  if (new Date(proposal.deadline_at) <= new Date()) throw invalid('The first date needs to be at least a day away.', 'dates');
  const { data: updatedDay, error: dayError } = await supabaseAdmin.from('CrewDay')
    .update({ proposed_dates: proposal, updated_at: new Date().toISOString() }).eq('id', day.id).select('*').single();
  if (dayError) throw store.unavailable('propose_day', dayError);
  await store.addEvent({ day: updatedDay, actorUserId: userId, actorRole: 'crew', kind: 'dates_proposed',
    data: { proposal_id: proposal.id, dates, homes: rows.length }, visibleTo: 'both' });
  const crew = await bookingsService.crewFor(day);
  for (const b of rows) {
    const moved = await bookingsService.transition(b, ['booked', 'new_dates'], { status: 'new_dates', new_date_choice: null,
      eta_start: null, eta_end: null }).catch(() => null);
    if (moved) await notices.newDates(updatedDay, moved, crew, proposal).catch(() => {});
  }
  return updatedDay;
}

/** POST /bookings/:id/new-date { proposal_id, choice: date or "cancel" } */
async function answerDate(bookingId, userId, body = {}) {
  const { booking, day } = await bookingsService.householdBooking(bookingId, userId);
  const proposal = day.proposed_dates;
  if (booking.status !== 'new_dates' || !proposal) throw new CrewDayError(409, 'NO_PROPOSAL', 'There are no new dates to answer.');
  if (body.proposal_id !== proposal.id) throw new CrewDayError(409, 'CHANGED', 'The crew changed the dates. Refresh and pick again.');
  if (new Date() >= new Date(proposal.deadline_at)) throw new CrewDayError(409, 'DEADLINE_PASSED', 'The time to pick a new date has passed.');
  const answeredAt = new Date().toISOString();
  let updated;
  if (body.choice === 'cancel') {
    updated = await bookingsService.transition(booking, ['new_dates'], { status: 'cancelled', cancelled_by: 'household',
      cancelled_at: answeredAt, cancel_reason: 'new_dates_declined',
      new_date_choice: { proposal_id: proposal.id, date: 'cancel', answered_at: answeredAt } });
  } else {
    const pick = proposal.dates.find((d) => d.date === body.choice);
    if (!pick) throw invalid('Pick one of the dates, or cancel.', 'choice');
    updated = await bookingsService.transition(booking, ['new_dates'], { status: 'booked', service_date: pick.date,
      window_start: pick.window_start, window_end: pick.window_end, reminder_sent_at: null, route_position: null,
      new_date_choice: { proposal_id: proposal.id, date: pick.date, answered_at: answeredAt } });
  }
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'date_answered',
    data: { proposal_id: proposal.id, choice: body.choice }, visibleTo: 'both' });
  const { data: answered } = await supabaseAdmin.from('CrewDayBooking').select('id, new_date_choice')
    .eq('crew_day_id', day.id).not('new_date_choice', 'is', null);
  const picked = (answered || []).filter((b) => b.new_date_choice?.proposal_id === proposal.id && b.new_date_choice?.date !== 'cancel').length;
  await notices.datesAnswered(day, updated, picked, proposal.homes || picked).catch(() => {});
  return updated;
}

/** Cancels a whole day (the crew's or the operator's call): every home not yet worked on ends free. */
async function cancelDay(dayId, actorId, { reason, byOperator }) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  if (!byOperator) await days.requireCrew(day, actorId, 'profile.edit');
  else if (!day) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that Crew Day.");
  if (day.status === 'cancelled') return day;
  if (!['draft', 'pending_review', 'declined', 'open', 'in_progress'].includes(day.status)) {
    throw new CrewDayError(409, 'NOT_CANCELLABLE', 'This Crew Day is over.');
  }
  const note = reason == null ? null : String(reason).trim().slice(0, 500) || null;
  if (byOperator && !note) throw invalid('Say why, for the crew and the households.', 'reason');
  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin.from('CrewDay').update({ status: 'cancelled', cancel_reason: note,
    cancelled_by: byOperator ? 'operator' : 'crew', cancelled_by_user_id: actorId, cancelled_at: now, proposed_dates: null,
    updated_at: now }).eq('id', day.id).eq('status', day.status).select('*').maybeSingle();
  if (error) throw store.unavailable('cancel_day', error);
  if (!updated) throw new CrewDayError(409, 'CHANGED', 'This Crew Day just changed. Refresh and try again.');
  await store.addEvent({ day: updated, actorUserId: actorId, actorRole: byOperator ? 'operator' : 'crew', kind: 'day_cancelled',
    data: note ? { reason: note } : {}, visibleTo: 'both' });
  const { data: rows } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('crew_day_id', day.id).in('status', NOT_STARTED);
  const crew = await bookingsService.crewFor(day);
  for (const b of rows || []) {
    const ended = await bookingsService.transition(b, NOT_STARTED, { status: 'cancelled', cancelled_by: byOperator ? 'operator' : 'crew',
      cancelled_at: now, cancel_reason: 'day_cancelled' }).catch(() => null);
    if (ended) await notices.bookingCancelled(updated, ended, crew, byOperator ? 'operator' : 'crew_cancelled_day').catch(() => {});
  }
  if (byOperator) await notices.dayCancelledForCrew(updated, true).catch(() => {});
  return updated;
}

/** Households this business served with a paid booking within this day's area in the last 400 days. */
async function pastCustomers(day) {
  const since = DateTime.now().minus({ days: 400 }).toISODate();
  const { data: theirDays } = await supabaseAdmin.from('CrewDay').select('id').eq('business_user_id', day.business_user_id)
    .eq('kind', 'offer').neq('id', day.id);
  const ids = (theirDays || []).map((d) => d.id);
  if (!ids.length) return [];
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking')
    .select('household_user_id, latitude, longitude, line_items, service_date').in('crew_day_id', ids).eq('status', 'paid')
    .gte('service_date', since);
  if (error) throw store.unavailable('past_customers', error);
  const { data: current } = await supabaseAdmin.from('CrewDayBooking').select('household_user_id').eq('crew_day_id', day.id)
    .not('status', 'in', `(${rules.INACTIVE_BOOKING_STATUSES.join(',')})`);
  const booked = new Set((current || []).map((b) => String(b.household_user_id)));
  // One row per household: its latest paid booking whose option this day also prices (so the invite can say their
  // price), else its latest.
  const listed = new Set((day.price_options || []).filter((o) => !o.needs_look).map((o) => o.label));
  const onList = (b) => listed.has((b.line_items || []).find((i) => i.kind === 'option')?.label);
  const better = (b, prev) => (onList(b) !== onList(prev) ? onList(b) : prev.service_date < b.service_date);
  const byHousehold = new Map();
  for (const b of rows || []) {
    if (booked.has(String(b.household_user_id)) || !rules.inArea(day, b)) continue;
    const prev = byHousehold.get(String(b.household_user_id));
    if (!prev || better(b, prev)) byHousehold.set(String(b.household_user_id), b);
  }
  return [...byHousehold.values()];
}

/** POST /:id/invite-past: each past customer near here is told once, with their price on this day when it matches. */
async function invitePast(dayId, userId) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId, 'profile.edit');
  if (day.status !== 'open') throw new CrewDayError(409, 'DAY_NOT_OPEN', 'Invite past customers once the Crew Day is open.');
  const { data: sent } = await supabaseAdmin.from('CrewDayEvent').select('data').eq('crew_day_id', day.id).eq('kind', 'invited_past');
  const already = new Set((sent || []).flatMap((e) => e.data?.household_user_ids || []).map(String));
  const crew = await bookingsService.crewFor(day);
  const invited = [];
  for (const past of await pastCustomers(day)) {
    const id = String(past.household_user_id);
    if (already.has(id) || await blockService.isBlocked(id, day.business_user_id)) continue;
    const label = (past.line_items || []).find((i) => i.kind === 'option')?.label;
    const option = (day.price_options || []).find((o) => o.label === label && !o.needs_look);
    await notices.invite(day, id, crew, option?.price_cents || null).catch(() => {});
    invited.push(id);
  }
  if (invited.length) {
    await store.addEvent({ day, actorUserId: userId, actorRole: 'crew', kind: 'invited_past',
      data: { household_user_ids: invited, count: invited.length }, visibleTo: 'crew' });
  }
  return { invited: invited.length };
}

module.exports = { proposeDates, answerDate, cancelDay, pastCustomers, invitePast, NOT_STARTED };

'use strict';

/**
 * The day itself (01-spec.md §5 screens 16–17, §3 screen 5's "On the way" and "Done"): the route and its order, "On
 * my way", "Running late", "Gate is ready", "Can't get in", and marking a home done with its photos, which makes the
 * home's invoice (02-contract.md §3: one BusinessInvoice per booking, charged 24 hours later).
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const stripeService = require('../../stripe/stripeService');
const rules = require('./rules');
const store = require('./store');
const days = require('./days');
const bookingsService = require('./bookings');
const reads = require('./reads');
const notices = require('./notices');
const photos = require('./photos');

const { CrewDayError } = rules;

// Homes still to work on that day.
const ON_ROUTE = ['booked', 'on_the_way'];

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

async function startDay(day) {
  if (day.status !== 'open') return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('CrewDay').update({ status: 'in_progress', started_at: now, updated_at: now })
    .eq('id', day.id).eq('status', 'open');
  if (error) logger.warn('crewDay.start_day_failed', { crewDayId: day.id, error: error.message });
  else await store.addEvent({ day, actorRole: 'system', kind: 'day_started', visibleTo: 'both' });
}

/** GET /:id/route?date=: the homes on that date in the crew's order, each with what the privacy rule allows now. */
async function route(dayId, userId, date) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId);
  const homes = (await reads.crewHomes(day)).filter((h) => h.active);
  const dates = [...new Set(homes.map((h) => h.service_date))].sort();
  const on = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date)
    : (dates.find((d) => d >= rules.todayIn(day.timezone)) || dates[dates.length - 1] || day.service_date);
  const onDate = homes.filter((h) => h.service_date === on)
    .sort((a, b) => (a.route_position ?? 1e6) - (b.route_position ?? 1e6) || String(a.created_at).localeCompare(String(b.created_at)));
  const list = await reads.withPhotos(onDate.map(({ row, ...home }) => home), new Map(onDate.map((h) => [h.id, h.row])));
  return {
    crew_day_id: day.id,
    title: day.title,
    date: on,
    dates,
    timezone: day.timezone,
    window_start: list[0]?.window_start || rules.hhmm(day.window_start),
    window_end: list[0]?.window_end || rules.hhmm(day.window_end),
    total: list.length,
    done: list.filter((h) => ['done', 'paid', 'payment_failed', 'refunded'].includes(h.status)).length,
    homes: list,
  };
}

/** POST /:id/route/order { booking_ids }: the crew's order for the homes on one date. */
async function order(dayId, userId, body = {}) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId);
  const ids = Array.isArray(body.booking_ids) ? [...new Set(body.booking_ids.map(String))] : [];
  if (ids.length === 0 || ids.length > 60) throw invalid('Send the homes in their new order.', 'booking_ids');
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('id, service_date, status')
    .eq('crew_day_id', day.id).in('id', ids);
  if (error) throw store.unavailable('route_order', error);
  if ((rows || []).length !== ids.length || new Set(rows.map((r) => r.service_date)).size !== 1) {
    throw invalid('The order has to list homes on one date of this Crew Day.', 'booking_ids');
  }
  for (const [position, id] of ids.entries()) {
    const { error: updateError } = await supabaseAdmin.from('CrewDayBooking')
      .update({ route_position: position + 1, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) throw store.unavailable('route_order_write', updateError);
  }
  return route(day.id, userId, rows[0].service_date);
}

function etaInstant(value, field) {
  const at = DateTime.fromISO(String(value || ''));
  if (!at.isValid) throw invalid('Pick when you expect to arrive.', field);
  return at.toUTC();
}

/** POST /bookings/:id/on-the-way { eta_start, eta_end }: tells the household; a later call moves the time. */
async function onTheWay(bookingId, userId, body = {}) {
  const booking = await bookingsService.loadBooking(bookingId);
  if (!booking) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  const { day } = await bookingsService.crewBooking(booking.crew_day_id, bookingId, userId);
  if (!ON_ROUTE.includes(booking.status)) {
    throw new CrewDayError(409, 'NOT_ON_ROUTE', booking.status === 'new_dates'
      ? 'This home is picking a new date.' : "This home isn't waiting for the crew.");
  }
  if (booking.service_date > rules.todayIn(day.timezone)) {
    throw new CrewDayError(409, 'NOT_TODAY', `This home is on ${rules.formatDay(booking.service_date)}.`);
  }
  const start = etaInstant(body.eta_start, 'eta_start');
  const end = etaInstant(body.eta_end, 'eta_end');
  if (end <= start || end.diff(start, 'hours').hours > 4) throw invalid('Give a window of up to four hours.', 'eta_end');
  const moved = booking.status === 'on_the_way';
  const updated = await bookingsService.transition(booking, ON_ROUTE, { status: 'on_the_way', eta_start: start.toISO(),
    eta_end: end.toISO(), eta_updated_at: new Date().toISOString() });
  await startDay(day);
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: moved ? 'eta_changed' : 'on_the_way',
    data: { eta_start: updated.eta_start, eta_end: updated.eta_end }, visibleTo: 'both' });
  if (moved) await notices.etaChanged(day, updated, await bookingsService.crewFor(day)).catch(() => {});
  else await notices.onTheWay(day, updated).catch(() => {});
  return updated;
}

/** POST /:id/running-late { minutes, date }: every home still waiting that date moves back and is told. */
async function runningLate(dayId, userId, body = {}) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId);
  const minutes = Number(body.minutes);
  if (![30, 60, 90].includes(minutes)) throw invalid('Pick 30, 60 or 90 minutes.', 'minutes');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : rules.todayIn(day.timezone);
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('crew_day_id', day.id)
    .eq('service_date', date).in('status', ON_ROUTE);
  if (error) throw store.unavailable('running_late', error);
  const shift = (time) => DateTime.fromISO(`${date}T${rules.hhmm(time)}`).plus({ minutes });
  if ((rows || []).some((b) => shift(b.window_end).toISODate() !== date)) {
    throw new CrewDayError(409, 'TOO_LATE', 'That would run past midnight. Message the households instead.');
  }
  const crew = await bookingsService.crewFor(day);
  const moved = [];
  for (const b of rows || []) {
    const fields = { window_start: shift(b.window_start).toFormat('HH:mm'), window_end: shift(b.window_end).toFormat('HH:mm') };
    if (b.eta_start) {
      Object.assign(fields, {
        eta_start: DateTime.fromISO(b.eta_start).plus({ minutes }).toUTC().toISO(),
        eta_end: DateTime.fromISO(b.eta_end).plus({ minutes }).toUTC().toISO(),
        eta_updated_at: new Date().toISOString(),
      });
    }
    const updated = await bookingsService.transition(b, ON_ROUTE, fields).catch(() => null);
    if (!updated) continue;
    moved.push(updated.id);
    await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'eta_changed',
      data: { minutes, window_start: updated.window_start, window_end: updated.window_end }, visibleTo: 'both' });
    await notices.etaChanged(day, updated, crew).catch(() => {});
  }
  return { date, minutes, moved: moved.length, route: await route(day.id, userId, date) };
}

/** POST /bookings/:id/gate-ready: the household tells the crew the gate is open (on the day). */
async function gateReady(bookingId, userId) {
  const { booking, day } = await bookingsService.householdBooking(bookingId, userId);
  if (!ON_ROUTE.includes(booking.status)) throw new CrewDayError(409, 'NOT_ON_ROUTE', 'The crew isn\'t on its way to your home.');
  if (!reads.addressVisible(booking, day)) {
    throw new CrewDayError(409, 'TOO_EARLY', `Tap this on ${rules.formatDay(booking.service_date)}, when the crew is coming.`);
  }
  if (booking.gate_ready_at) return booking;
  const updated = await bookingsService.transition(booking, ON_ROUTE, { gate_ready_at: new Date().toISOString() });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'gate_ready', visibleTo: 'both' });
  await notices.gateReady(day, updated).catch(() => {});
  return updated;
}

/** POST /bookings/:id/cant-get-in { note }: recorded on the booking and sent to the household. */
async function cantGetIn(bookingId, userId, body = {}) {
  const booking = await bookingsService.loadBooking(bookingId);
  if (!booking) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  const { day } = await bookingsService.crewBooking(booking.crew_day_id, bookingId, userId);
  if (!ON_ROUTE.includes(booking.status)) throw new CrewDayError(409, 'NOT_ON_ROUTE', "This home isn't waiting for the crew.");
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  if (!note) throw invalid('Say what stopped you, for the household.', 'note');
  const updated = await bookingsService.transition(booking, ON_ROUTE, { cant_get_in_at: new Date().toISOString() });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'cant_get_in', data: { note },
    visibleTo: 'both' });
  await notices.cantGetIn(day, updated, note).catch(() => {});
  return updated;
}

/** The home's invoice: the crew to the household, one line per option and add-on, due when the charge runs. */
async function createInvoice(day, booking, chargeDueAt) {
  const feeRate = await stripeService.getEffectiveFeeRate(day.business_user_id);
  const fees = stripeService.calculateFees(booking.price_cents, feeRate);
  const { data, error } = await supabaseAdmin.from('BusinessInvoice').insert({
    business_user_id: day.business_user_id,
    recipient_user_id: booking.household_user_id,
    line_items: (booking.line_items || []).map((item) => ({ description: item.label, amount_cents: item.price_cents, quantity: 1 })),
    subtotal_cents: booking.price_cents,
    fee_cents: fees.platformFee,
    total_cents: booking.price_cents,
    currency: 'usd',
    status: 'sent',
    due_date: chargeDueAt,
    memo: `Crew Day: ${day.title}, ${rules.formatDay(booking.service_date)}`,
  }).select('*').single();
  if (error) {
    logger.error('crewDay.done.invoice_failed', { bookingId: booking.id, error: error.message });
    throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't mark this home done. Please try again.");
  }
  return data;
}

/**
 * POST /bookings/:id/done { photo_paths (1–8), note? }: the home is done. Its invoice is made now (no generic
 * invoice notice or Mail bill: crew_day_done replaces them) and charged 24 hours later unless the household reports a
 * problem or says everything looks good first.
 */
async function markDone(bookingId, userId, body = {}) {
  const booking = await bookingsService.loadBooking(bookingId);
  if (!booking) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  const { day } = await bookingsService.crewBooking(booking.crew_day_id, bookingId, userId);
  if (['done', 'paid', 'payment_failed'].includes(booking.status)) return booking;
  if (!ON_ROUTE.includes(booking.status)) throw new CrewDayError(409, 'NOT_ON_ROUTE', "This home isn't on the route.");
  if (booking.service_date > rules.todayIn(day.timezone)) {
    throw new CrewDayError(409, 'NOT_TODAY', `This home is on ${rules.formatDay(booking.service_date)}.`);
  }
  const paths = photos.validPaths(booking, 'done', body.photo_paths, { min: 1, max: 8 });
  if (!paths) throw invalid('Add one to eight photos of the finished work.', 'photo_paths');
  const note = body.note == null ? null : String(body.note).trim().slice(0, 500) || null;
  const doneAt = new Date();
  const chargeDueAt = new Date(doneAt.getTime() + rules.CHARGE_DELAY_HOURS * 60 * 60 * 1000).toISOString();
  const invoice = await createInvoice(day, booking, chargeDueAt);
  let updated;
  try {
    updated = await bookingsService.transition(booking, ON_ROUTE, { status: 'done', done_at: doneAt.toISOString(),
      done_by: userId, done_note: note, photo_paths: paths, charge_due_at: chargeDueAt, invoice_id: invoice.id });
  } catch (err) {
    // Someone else finished it meanwhile: this invoice is not the home's.
    await supabaseAdmin.from('BusinessInvoice').update({ status: 'void' }).eq('id', invoice.id);
    throw err;
  }
  await startDay(day);
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'done',
    data: { photos: paths.length, invoice_id: invoice.id, charge_due_at: chargeDueAt }, visibleTo: 'both' });
  await notices.workDone(day, updated).catch(() => {});
  return updated;
}

/** POST /uploads (multipart `photo`, `booking_id`, `purpose`): the crew's done photos, the household's problem photos. */
async function upload(userId, { bookingId, purpose, buffer }) {
  const booking = await bookingsService.loadBooking(bookingId);
  if (!booking) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  if (purpose === 'problem') {
    if (String(booking.household_user_id) !== String(userId)) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  } else {
    await bookingsService.crewBooking(booking.crew_day_id, bookingId, userId);
  }
  if (!buffer?.length) throw invalid('Add a photo.', 'photo');
  return { path: await photos.store({ booking, purpose, buffer }) };
}

module.exports = { route, order, onTheWay, runningLate, gateReady, cantGetIn, markDone, upload, ON_ROUTE };

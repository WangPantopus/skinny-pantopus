'use strict';

/**
 * Booking a home on a street day and what each side can do to it before the day (docs/product/crew-day-build/01-spec.md
 * §3 screens 2–5 and 8, §5 screen 15; 02-contract.md §4 "Household" and the crew's price, decline and release). The
 * card is saved at booking; nothing is charged until the crew marks the home done.
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const blockService = require('../blockService');
const rules = require('./rules');
const store = require('./store');
const days = require('./days');
const notices = require('./notices');

const { CrewDayError } = rules;

// Before the crew has started: the states a household can still cancel or change (before the cutoff).
const CHANGEABLE = ['price_pending', 'price_offered', 'booked', 'new_dates'];

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

/** One home's price from the day's list: the option plus its add-ons, or none yet for a look-first option. */
function priceFor(day, optionId, addOnIds = []) {
  const option = (day.price_options || []).find((o) => o.id === optionId);
  if (!option) throw invalid('Pick one of the options.', 'option_id');
  if (!Array.isArray(addOnIds)) throw invalid('Pick add-ons from the list.', 'add_on_ids');
  const unique = [...new Set(addOnIds.map(String))];
  const addOns = unique.map((id) => (day.add_ons || []).find((a) => a.id === id));
  if (addOns.some((a) => !a)) throw invalid('Pick add-ons from the list.', 'add_on_ids');
  const lineItems = [
    { kind: 'option', id: option.id, label: option.label, price_cents: option.needs_look ? null : option.price_cents },
    ...addOns.map((a) => ({ kind: 'add_on', id: a.id, label: a.label, price_cents: a.price_cents })),
  ];
  const needsLook = Boolean(option.needs_look);
  return {
    option,
    add_on_ids: unique,
    line_items: lineItems,
    needs_look: needsLook,
    price_cents: needsLook ? null : lineItems.reduce((total, item) => total + item.price_cents, 0),
  };
}

function cutoffPassed(booking, day, now = new Date()) {
  const cutoff = rules.cancelCutoffAt(booking.service_date, booking.window_start, day.timezone);
  return Boolean(cutoff && now >= new Date(cutoff));
}

async function activeCount(dayId) {
  const { count, error } = await supabaseAdmin.from('CrewDayBooking').select('id', { count: 'exact', head: true })
    .eq('crew_day_id', dayId).not('status', 'in', `(${rules.INACTIVE_BOOKING_STATUSES.join(',')})`);
  if (error) throw store.unavailable('active_count', error);
  return count || 0;
}

async function crewFor(day) {
  return store.publicCrew((await store.crewFacts([day.business_user_id])).get(String(day.business_user_id)));
}

/** A live, approved day by its share code, or 404 (the public read's rule). */
async function liveDayByCode(code) {
  const notFound = new CrewDayError(404, 'NOT_FOUND', "This Crew Day isn't available.");
  if (!rules.SHARE_CODE_PATTERN.test(String(code || ''))) throw notFound;
  const day = await store.getDayByCode(String(code));
  if (!day || !rules.LIVE_DAY_STATUSES.includes(day.status)) throw notFound;
  return day;
}

/** POST /public/:code/quote: the price for this home, and whether the day reaches it. Anyone may ask. */
async function quote(code, body = {}) {
  const day = await liveDayByCode(code);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw invalid('Pick your address from the list.', 'address');
  const price = priceFor(day, body.option_id, body.add_on_ids || []);
  const reaches = rules.inArea(day, { latitude, longitude });
  const line = typeof body.address_line === 'string' && body.address_line.trim() ? body.address_line.trim().slice(0, 120) : 'this address';
  return {
    in_area: reaches,
    price_cents: price.price_cents,
    needs_look: price.needs_look,
    line_items: price.line_items,
    message: !reaches
      ? `This Crew Day doesn't reach ${line}. It covers homes near ${day.street_label}.`
      : (price.needs_look ? "The crew confirms your price before you're booked." : null),
  };
}

async function findByClientRequest(userId, clientRequestId) {
  const { data, error } = await supabaseAdmin.from('CrewDayBooking').select('*')
    .eq('household_user_id', userId).eq('client_request_id', clientRequestId).maybeSingle();
  if (error) throw store.unavailable('client_request', error);
  return data || null;
}

/** POST /:id/bookings: book a home (or ask for the price of a look-first one). Idempotent by client_request_id. */
async function book(dayId, user, body = {}) {
  const clientRequestId = typeof body.client_request_id === 'string' ? body.client_request_id.trim() : '';
  if (clientRequestId.length < 8 || clientRequestId.length > 100) throw invalid('This booking needs a request id.', 'client_request_id');
  const repeat = await findByClientRequest(user.id, clientRequestId);
  if (repeat) return { booking: repeat, repeated: true };

  const day = await store.getDay(dayId, { kind: 'offer' });
  if (!day || !rules.LIVE_DAY_STATUSES.includes(day.status)) {
    throw new CrewDayError(404, 'NOT_FOUND', "This Crew Day isn't available.");
  }
  if (day.status !== 'open') throw new CrewDayError(409, 'DAY_NOT_OPEN', "This Crew Day isn't taking bookings.");
  if (new Date() >= new Date(day.booking_closes_at)) {
    throw new CrewDayError(409, 'BOOKING_CLOSED', `Booking closed on ${rules.formatDay(
      DateTime.fromISO(day.booking_closes_at).setZone(day.timezone).toISODate())}.`);
  }
  if (body.approve_terms !== true) throw invalid('Tick the box to approve the scope, the total and the terms.', 'approve_terms');
  if ((await days.crewAccess(day.business_user_id, user.id)).hasAccess) {
    throw new CrewDayError(409, 'OWN_CREW', "This is your own Crew Day, so you can't book it.");
  }
  if (await blockService.isBlocked(user.id, day.business_user_id)) {
    throw new CrewDayError(422, 'CANNOT_BOOK', "You can't book this Crew Day.");
  }

  // The address: one of the person's homes in Pantopus, or one picked from the address list.
  let address;
  if (body.home_id) {
    const home = (await store.myHomes(user.id)).find((h) => String(h.id) === String(body.home_id));
    if (!home || !home.point) throw invalid("We couldn't find that home. Pick your address instead.", 'home_id');
    address = { home_id: home.id, line: home.line, city: home.city, state: home.state, zip: home.zip, ...home.point };
  } else {
    const a = body.address || {};
    const line = typeof a.line === 'string' ? a.line.trim() : '';
    if (!line || line.length > 200) throw invalid('Pick your address from the list.', 'address');
    if (!Number.isFinite(Number(a.latitude)) || !Number.isFinite(Number(a.longitude))) {
      throw invalid('Pick your address from the list.', 'address');
    }
    address = { home_id: null, line, city: a.city || null, state: a.state || null, zip: a.zip || null,
      latitude: Number(a.latitude), longitude: Number(a.longitude) };
  }
  if (!rules.inArea(day, address)) {
    throw new CrewDayError(422, 'OUT_OF_AREA', `This Crew Day doesn't reach ${address.line}. It covers homes near ${day.street_label}.`);
  }
  const price = priceFor(day, body.option_id, body.add_on_ids || []);
  const card = await store.savedCard(user.id, String(body.payment_method_id || ''));
  if (!card) throw new CrewDayError(422, 'PAYMENT_METHOD_INVALID', "Your card couldn't be saved. Try another card.");
  const accessNote = body.access_note == null ? null : String(body.access_note).trim().slice(0, 500) || null;

  const { data: booking, error } = await supabaseAdmin.from('CrewDayBooking').insert({
    crew_day_id: day.id,
    household_user_id: user.id,
    home_id: address.home_id,
    address_line: address.line,
    address_city: address.city,
    address_state: address.state,
    address_zip: address.zip,
    latitude: address.latitude,
    longitude: address.longitude,
    option_id: price.option.id,
    add_on_ids: price.add_on_ids,
    line_items: price.line_items,
    price_cents: price.price_cents,
    status: price.needs_look ? 'price_pending' : 'booked',
    service_date: day.service_date,
    window_start: day.window_start,
    window_end: day.window_end,
    access_note: accessNote,
    payment_method_id: card.stripe_payment_method_id,
    client_request_id: clientRequestId,
  }).select('*').single();
  if (error) {
    if (/CREW_DAY_FULL/.test(error.message)) throw new CrewDayError(409, 'DAY_FULL', 'This Crew Day filled up while you were booking.');
    if (/CREW_DAY_NOT_OPEN/.test(error.message)) throw new CrewDayError(409, 'DAY_NOT_OPEN', "This Crew Day isn't taking bookings.");
    if (error.code === '23505') {
      const again = await findByClientRequest(user.id, clientRequestId);
      if (again) return { booking: again, repeated: true };
      throw new CrewDayError(409, 'ALREADY_BOOKED', 'You already have a booking on this Crew Day.');
    }
    logger.error('crewDay.book.insert_failed', { crewDayId: day.id, error: error.message });
    throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't book your home. Please try again.");
  }
  const lookFirst = booking.status === 'price_pending';
  await store.addEvent({ day, booking, actorUserId: user.id, actorRole: 'household',
    kind: lookFirst ? 'price_requested' : 'booked', data: { option_id: booking.option_id }, visibleTo: 'both' });
  const count = await activeCount(day.id);
  if (lookFirst) {
    await notices.priceNeeded(day, booking).catch(() => {});
  } else {
    await notices.booked(day, booking).catch(() => {});
    await notices.newBooking(day, booking, count).catch(() => {});
  }
  return { booking, repeated: false };
}

// ── One booking ────────────────────────────────────────────────

async function loadBooking(bookingId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(bookingId || ''))) return null;
  const { data, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('id', bookingId).maybeSingle();
  if (error) throw store.unavailable('booking', error);
  return data || null;
}

const bookingNotFound = () => new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");

/** The booking and its day, for its own household only. */
async function householdBooking(bookingId, userId) {
  const booking = await loadBooking(bookingId);
  if (!booking || String(booking.household_user_id) !== String(userId)) throw bookingNotFound();
  const day = await store.getDay(booking.crew_day_id);
  return { booking, day };
}

/** The booking and its day, for the crew (any member, or `permission`). */
async function crewBooking(dayId, bookingId, userId, permission = null) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  await days.requireCrew(day, userId, permission);
  const booking = await loadBooking(bookingId);
  if (!booking || String(booking.crew_day_id) !== String(day.id)) throw bookingNotFound();
  return { booking, day };
}

/** Moves a booking from one of `from` to new fields; null when it moved meanwhile. */
async function transition(booking, from, fields) {
  const { data, error } = await supabaseAdmin.from('CrewDayBooking')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', booking.id).in('status', from).select('*').maybeSingle();
  if (error) {
    logger.error('crewDay.booking.update_failed', { bookingId: booking.id, error: error.message });
    throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't save that. Please try again.");
  }
  if (!data) throw new CrewDayError(409, 'CHANGED', 'This booking just changed. Refresh and try again.');
  return data;
}

/** PATCH /bookings/:id: the note for the crew, home details (before the cutoff; re-priced), remind me next season. */
async function change(bookingId, userId, body = {}) {
  const { booking, day } = await householdBooking(bookingId, userId);
  const fields = {};
  const events = [];
  if (body.access_note !== undefined) {
    if (['done', 'paid', 'payment_failed', 'refunded', 'cancelled', 'declined'].includes(booking.status)) {
      throw new CrewDayError(409, 'NOT_EDITABLE', 'The note for the crew can only change before the work is done.');
    }
    fields.access_note = body.access_note == null ? null : String(body.access_note).trim().slice(0, 500) || null;
    events.push({ kind: 'access_note_changed', data: {} });
  }
  let priceNeeded = false;
  if (body.option_id !== undefined || body.add_on_ids !== undefined) {
    if (!CHANGEABLE.includes(booking.status) || cutoffPassed(booking, day)) {
      throw new CrewDayError(409, 'ASK_THE_CREW', `It's less than 48 hours to go. Ask ${(await crewFor(day))?.name || 'the crew'} to change it.`);
    }
    const price = priceFor(day, body.option_id ?? booking.option_id, body.add_on_ids ?? booking.add_on_ids);
    Object.assign(fields, { option_id: price.option.id, add_on_ids: price.add_on_ids, line_items: price.line_items,
      price_cents: price.price_cents, status: price.needs_look ? 'price_pending' : 'booked' });
    priceNeeded = price.needs_look && booking.status !== 'price_pending';
    events.push({ kind: 'booking_changed', data: { option_id: price.option.id, add_on_ids: price.add_on_ids, price_cents: price.price_cents } });
  }
  if (body.remind_next_season !== undefined) {
    if (booking.status !== 'paid') throw new CrewDayError(409, 'NOT_EDITABLE', 'We can remind you once this Crew Day is paid.');
    fields.remind_next_season = Boolean(body.remind_next_season);
  }
  if (Object.keys(fields).length === 0) throw invalid('Nothing to change.');
  const updated = await transition(booking, [booking.status], fields);
  for (const e of events) {
    await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: e.kind, data: e.data,
      visibleTo: 'both' });
  }
  if (priceNeeded) await notices.priceNeeded(day, updated).catch(() => {});
  return updated;
}

/** POST /bookings/:id/cancel: free until 48 hours before the window; after that the household asks the crew. */
async function cancel(bookingId, userId) {
  const { booking, day } = await householdBooking(bookingId, userId);
  if (booking.status === 'cancelled') return booking;
  if (!CHANGEABLE.includes(booking.status)) {
    throw new CrewDayError(409, 'NOT_CANCELLABLE', "This booking can't be cancelled now. Message the crew or Pantopus support.");
  }
  if (cutoffPassed(booking, day)) {
    throw new CrewDayError(409, 'ASK_THE_CREW', `It's less than 48 hours to go. Ask ${(await crewFor(day))?.name || 'the crew'} to release your home at no charge.`);
  }
  const updated = await transition(booking, CHANGEABLE, { status: 'cancelled', cancelled_by: 'household',
    cancelled_at: new Date().toISOString(), cancel_reason: 'household' });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'booking_cancelled',
    data: { by: 'household' }, visibleTo: 'both' });
  await notices.homeCancelled(day, updated, await activeCount(day.id)).catch(() => {});
  return updated;
}

/** POST /bookings/:id/ask-release: inside the cutoff, the household asks the crew to let the home go. */
async function askRelease(bookingId, userId) {
  const { booking, day } = await householdBooking(bookingId, userId);
  if (!CHANGEABLE.includes(booking.status)) throw new CrewDayError(409, 'NOT_CANCELLABLE', "This booking can't be released now.");
  if (!cutoffPassed(booking, day)) throw new CrewDayError(409, 'CAN_CANCEL', 'You can still cancel this booking yourself, at no charge.');
  if (booking.release_asked_at) return booking;
  const updated = await transition(booking, CHANGEABLE, { release_asked_at: new Date().toISOString() });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'release_asked', visibleTo: 'both' });
  await notices.releaseAsked(day, updated).catch(() => {});
  return updated;
}

/** POST /bookings/:id/price-answer { approve }: the household approves the crew's price (booked) or declines it (free). */
async function answerPrice(bookingId, userId, body = {}) {
  const { booking, day } = await householdBooking(bookingId, userId);
  if (typeof body.approve !== 'boolean') throw invalid('Approve or decline the price.', 'approve');
  if (booking.status !== 'price_offered') {
    throw new CrewDayError(409, 'NO_PRICE_OFFER', booking.status === 'price_pending'
      ? 'The crew is still checking your price.' : 'There is no price to answer.');
  }
  const now = new Date().toISOString();
  if (body.approve) {
    const updated = await transition(booking, ['price_offered'], { status: 'booked' });
    await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'price_approved',
      data: { price_cents: updated.price_cents }, visibleTo: 'both' });
    await notices.booked(day, updated).catch(() => {});
    await notices.newBooking(day, updated, await activeCount(day.id)).catch(() => {});
    return updated;
  }
  const updated = await transition(booking, ['price_offered'], { status: 'cancelled', cancelled_by: 'household',
    cancelled_at: now, cancel_reason: 'price_declined' });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'price_declined', visibleTo: 'both' });
  await notices.homeCancelled(day, updated, await activeCount(day.id)).catch(() => {});
  return updated;
}

// ── Crew on one home ───────────────────────────────────────────

/** POST /:id/bookings/:bookingId/price { price_cents } or { decline: true, note }: the crew's look-first answer. */
async function setPrice(dayId, bookingId, userId, body = {}) {
  const { booking, day } = await crewBooking(dayId, bookingId, userId, 'profile.edit');
  const crew = await crewFor(day);
  if (body.decline === true) {
    if (!['price_pending', 'price_offered'].includes(booking.status)) {
      throw new CrewDayError(409, 'NO_PRICE_CHECK', 'This home is booked already. Release it instead.');
    }
    const note = body.note == null ? null : String(body.note).trim().slice(0, 500) || null;
    const updated = await transition(booking, ['price_pending', 'price_offered'], { status: 'declined',
      cancelled_by: 'crew', cancelled_at: new Date().toISOString(), cancel_reason: note || 'crew_declined' });
    await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'price_declined',
      data: note ? { note } : {}, visibleTo: 'both' });
    await notices.bookingCancelled(day, updated, crew, 'crew_declined').catch(() => {});
    return updated;
  }
  if (booking.status !== 'price_pending' && booking.status !== 'price_offered') {
    throw new CrewDayError(409, 'NO_PRICE_CHECK', "This home doesn't need a price check.");
  }
  const optionCents = Number(body.price_cents);
  if (!Number.isInteger(optionCents) || optionCents < 100 || optionCents > 1000000) {
    throw invalid('Set a price from $1 to $10,000.', 'price_cents');
  }
  // The crew prices the look-first option; the add-ons keep their listed prices.
  const lineItems = (booking.line_items || []).map((item) => (item.kind === 'option' ? { ...item, price_cents: optionCents } : item));
  const total = lineItems.reduce((sum, item) => sum + (Number(item.price_cents) || 0), 0);
  const updated = await transition(booking, ['price_pending', 'price_offered'], { status: 'price_offered',
    line_items: lineItems, price_cents: total });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'price_offered',
    data: { price_cents: total }, visibleTo: 'both' });
  await notices.priceOffered(day, updated, crew).catch(() => {});
  return updated;
}

/** POST /:id/bookings/:bookingId/release: the crew lets a home go at no charge (a household's ask, or its own call). */
async function release(dayId, bookingId, userId) {
  const { booking, day } = await crewBooking(dayId, bookingId, userId, 'profile.edit');
  if (booking.status === 'cancelled') return booking;
  if (!CHANGEABLE.includes(booking.status)) {
    throw new CrewDayError(409, 'NOT_CANCELLABLE', "This home's work has started, so it can't be released.");
  }
  const updated = await transition(booking, CHANGEABLE, { status: 'cancelled', cancelled_by: 'crew',
    cancelled_at: new Date().toISOString(), cancel_reason: booking.release_asked_at ? 'released_on_request' : 'released' });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'crew', kind: 'released', visibleTo: 'both' });
  await notices.bookingCancelled(day, updated, await crewFor(day), 'crew_released').catch(() => {});
  return updated;
}

/** POST /:id/dismiss: "Not for me" on the Today card hides that day for good. */
async function dismiss(dayId, userId) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  if (!day) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that Crew Day.");
  const { data: seen } = await supabaseAdmin.from('CrewDayEvent').select('id').eq('crew_day_id', day.id)
    .eq('kind', 'today_dismissed').eq('actor_user_id', userId).limit(1);
  if (!seen?.length) {
    await store.addEvent({ day, actorUserId: userId, actorRole: 'household', kind: 'today_dismissed', visibleTo: 'operator' });
  }
  return { dismissed: true };
}

module.exports = {
  CHANGEABLE,
  priceFor,
  cutoffPassed,
  activeCount,
  crewFor,
  quote,
  book,
  loadBooking,
  householdBooking,
  crewBooking,
  transition,
  change,
  cancel,
  askRelease,
  answerPrice,
  setPrice,
  release,
  dismiss,
};

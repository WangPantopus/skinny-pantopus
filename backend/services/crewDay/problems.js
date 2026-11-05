'use strict';

/**
 * "Something needs attention" (01-spec.md rule 6, screens 7 and 22): the household's report pauses the charge and
 * opens a case Pantopus support owns, due by 5 PM local the next business day; the crew is told and sees the note.
 * The operator adds notes, releases the charge, refunds (the existing refund machinery: an invoice payment is refunded
 * in full; before the charge, an amount off re-invoices the rest), or resolves the case.
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const stripeService = require('../../stripe/stripeService');
const rules = require('./rules');
const store = require('./store');
const notices = require('./notices');
const photos = require('./photos');
const money = require('./money');
const bookingsService = require('./bookings');

const { CrewDayError } = rules;
const KINDS = ['missed', 'damage', 'no_show', 'charge', 'other'];
const REPORTABLE = ['booked', 'on_the_way', 'done', 'paid', 'payment_failed'];

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

/** 5 PM local on the next business day (Monday after a Friday or a weekend). */
function nextBusinessDayFivePm(timezone, now = new Date()) {
  let at = DateTime.fromJSDate(now).setZone(timezone || rules.DEFAULT_TIMEZONE).plus({ days: 1 });
  while (at.weekday > 5) at = at.plus({ days: 1 });
  return at.set({ hour: 17, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO();
}

/** POST /bookings/:id/problem { kind, note, photo_paths }: opens the case; again, adds a note or photos. */
async function report(bookingId, userId, body = {}) {
  const { booking, day } = await bookingsService.householdBooking(bookingId, userId);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note || note.length > 1000) throw invalid('Say what happened (up to 1,000 characters).', 'note');
  const existing = booking.problem_photo_paths || [];
  const added = body.photo_paths == null ? []
    : photos.validPaths(booking, 'problem', body.photo_paths, { min: 0, max: 4 });
  if (!added) throw invalid('Add up to four photos.', 'photo_paths');
  const allPhotos = [...new Set([...existing, ...added])];
  if (allPhotos.length > 4) throw invalid('A report holds up to four photos.', 'photo_paths');
  const now = new Date().toISOString();
  if (booking.problem_status === 'open') {
    const updated = await bookingsService.transition(booking, [booking.status], { problem_photo_paths: allPhotos });
    await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'problem_note',
      data: { note, photos: added.length }, visibleTo: 'both' });
    return updated;
  }
  if (!KINDS.includes(body.kind)) throw invalid('Pick what went wrong.', 'kind');
  if (!REPORTABLE.includes(booking.status) || booking.service_date > rules.todayIn(day.timezone)) {
    throw new CrewDayError(409, 'NOT_REPORTABLE', 'You can report a problem once the crew has come.');
  }
  const updated = await bookingsService.transition(booking, [booking.status], {
    problem_status: 'open', problem_kind: body.kind, problem_note: note, problem_photo_paths: allPhotos,
    problem_opened_at: now, problem_due_at: nextBusinessDayFivePm(day.timezone), problem_resolved_at: null,
    problem_resolution: null,
  });
  await store.addEvent({ day, booking: updated, actorUserId: userId, actorRole: 'household', kind: 'problem_opened',
    data: { kind: body.kind, note, photos: allPhotos.length }, visibleTo: 'both' });
  await notices.problemReported(day, updated).catch(() => {});
  await notices.problemOpened(day, updated).catch(() => {});
  return updated;
}

async function resolve(booking, day, operatorId, resolution, note, extra = {}) {
  const updated = await bookingsService.transition(booking, [booking.status], {
    problem_status: 'resolved', problem_resolution: resolution, problem_resolved_at: new Date().toISOString(), ...extra,
  });
  await store.addEvent({ day, booking: updated, actorUserId: operatorId, actorRole: 'operator', kind: 'problem_resolved',
    data: { resolution, ...(note ? { note } : {}) }, visibleTo: 'both' });
  return updated;
}

async function cardLine(booking) {
  const card = await store.savedCard(booking.household_user_id, booking.payment_method_id);
  return card ? `${String(card.card_brand || 'card').replace(/^\w/, (c) => c.toUpperCase())} ending ${card.card_last4}` : 'your card';
}

/**
 * POST /api/admin/crew-days/bookings/:id/problem { action: note|release|refund|resolve, amount_cents?, note }.
 * Answers the booking as the operator sees it.
 */
async function operatorAction(bookingId, operatorId, body = {}) {
  const booking = await bookingsService.loadBooking(bookingId);
  if (!booking) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that booking.");
  const day = await store.getDay(booking.crew_day_id);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const action = String(body.action || '');
  if (action === 'note') {
    if (!note) throw invalid('Write the note.', 'note');
    await store.addEvent({ day, booking, actorUserId: operatorId, actorRole: 'operator', kind: 'operator_note',
      data: { note }, visibleTo: 'both' });
    await notices.problemUpdate(day, booking, note).catch(() => {});
    return booking;
  }
  if (booking.problem_status !== 'open') throw new CrewDayError(409, 'NO_OPEN_PROBLEM', 'This booking has no open problem.');
  if (action === 'release') {
    const resolved = await resolve(booking, day, operatorId, 'released', note);
    const after = resolved.status === 'done' ? await money.chargeBooking(resolved, { reason: 'released' }) : resolved;
    const line = after.status === 'paid' ? `Charge released: ${rules.formatMoney(after.price_cents)} paid.`
      : 'We released the charge.';
    await notices.problemUpdate(day, after, note ? `${line} ${note}` : line).catch(() => {});
    return after;
  }
  if (action === 'resolve') {
    if (!note) throw invalid('Write a note for the household and the crew.', 'note');
    const resolved = await resolve(booking, day, operatorId, 'resolved', note);
    await notices.problemUpdate(day, resolved, note).catch(() => {});
    return resolved;
  }
  if (action !== 'refund') throw invalid('Pick note, release, refund or resolve.', 'action');
  const price = booking.price_cents || 0;
  const amount = body.amount_cents == null ? price : Number(body.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > price) {
    throw invalid(`Refund from $0.01 to ${rules.formatReceipt(price)}.`, 'amount_cents');
  }
  const card = await cardLine(booking);
  if (booking.status === 'paid') {
    if (amount < price) {
      throw new CrewDayError(409, 'REFUND_IN_FULL', 'A charged Crew Day is refunded in full. Refund it, and the crew can invoice the rest.');
    }
    const { data: invoice } = await supabaseAdmin.from('BusinessInvoice').select('payment_id').eq('id', booking.invoice_id).maybeSingle();
    if (!invoice?.payment_id) throw new CrewDayError(409, 'NO_PAYMENT', "We couldn't find this charge's payment.");
    await stripeService.createSmartRefund(invoice.payment_id, null, 'other', operatorId,
      { actorMode: 'admin', requestId: money.newRequestId(), description: 'Crew Day problem refund' });
    const refunded = await resolve(booking, day, operatorId, 'refunded', note, { status: 'refunded', refunded_cents: price });
    await store.addEvent({ day, booking: refunded, actorUserId: operatorId, actorRole: 'operator', kind: 'refunded',
      data: { amount_cents: price }, visibleTo: 'both' });
    await notices.problemUpdate(day, refunded, `Refunded ${rules.formatReceipt(price)} to ${card}.${note ? ` ${note}` : ''}`).catch(() => {});
    return refunded;
  }
  if (!['done', 'payment_failed'].includes(booking.status)) {
    throw new CrewDayError(409, 'NOTHING_TO_REFUND', 'This booking has no charge to refund.');
  }
  if (amount === price) {
    // Before a charge, a refund means the charge never runs: the invoice is voided and the booking ends.
    await supabaseAdmin.from('BusinessInvoice').update({ status: 'void' }).eq('id', booking.invoice_id).neq('status', 'paid');
    const cancelled = await resolve(booking, day, operatorId, 'refunded', note, { status: 'cancelled', cancelled_by: 'operator',
      cancelled_at: new Date().toISOString(), cancel_reason: 'refunded_before_charge', refunded_cents: price });
    await store.addEvent({ day, booking: cancelled, actorUserId: operatorId, actorRole: 'operator', kind: 'refunded',
      data: { amount_cents: price, before_charge: true }, visibleTo: 'both' });
    await notices.problemUpdate(day, cancelled, `We cancelled the ${rules.formatReceipt(price)} charge. Nothing was charged.${note ? ` ${note}` : ''}`).catch(() => {});
    return cancelled;
  }
  // An amount off before the charge: the rest is invoiced again and charged now.
  const fresh = await money.reinvoiceRemainder(day, booking, amount);
  const resolved = await resolve(booking, day, operatorId, 'partial_refund', note, { invoice_id: fresh.id, refunded_cents: amount,
    status: 'done', charge_failure: null });
  await store.addEvent({ day, booking: resolved, actorUserId: operatorId, actorRole: 'operator', kind: 'refunded',
    data: { amount_cents: amount, before_charge: true, invoice_id: fresh.id }, visibleTo: 'both' });
  const after = await money.chargeBooking(resolved, { reason: 'partial_refund' });
  await notices.problemUpdate(day, after, `Refunded ${rules.formatMoney(amount)} of ${rules.formatMoney(price)}. `
    + `We charged ${rules.formatReceipt(price - amount)} to ${card}.${note ? ` ${note}` : ''}`).catch(() => {});
  return after;
}

module.exports = { KINDS, report, operatorAction, nextBusinessDayFivePm };

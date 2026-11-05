'use strict';

/**
 * Crew Day notices (docs/product/crew-day-build/02-contract.md §6): who gets each one, its copy and its link. Every
 * notice is a personal notification with metadata { crew_day_id, booking_id }; the launch-cut type map drops them while
 * `crew_day` is unlisted. Links are web paths; the apps map them to native screens by type.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');
const { getBusinessPrimaryOwnerId, getActiveMembership } = require('../../utils/businessPermissions');
const rules = require('./rules');

const links = {
  booking: (bookingId) => `/app/crew-days/bookings/${bookingId}`,
  mine: () => '/app/crew-days',
  crewList: (businessId) => `/app/businesses/${businessId}/dashboard?tab=crew-days`,
  crewDay: (businessId, crewDayId) => `/app/businesses/${businessId}/crew-days/${crewDayId}`,
  admin: (crewDayId) => (crewDayId ? `/app/admin/crew-days/${crewDayId}` : '/app/admin/crew-days'),
};

// Crew notices go to the business's primary owner and to the member who set the day up, while they still have access.
async function crewRecipients(day) {
  const ids = new Set();
  try {
    const owner = await getBusinessPrimaryOwnerId(day.business_user_id);
    if (owner) ids.add(String(owner));
  } catch (err) {
    logger.warn('crewDay.notices.owner_unavailable', { crewDayId: day.id, error: err.message });
  }
  if (day.created_by && !ids.has(String(day.created_by))) {
    const membership = await getActiveMembership(day.business_user_id, day.created_by);
    if (membership) ids.add(String(day.created_by));
  }
  return [...ids];
}

async function adminRecipients() {
  const { data, error } = await supabaseAdmin.from('User').select('id').eq('role', 'admin');
  if (error) {
    logger.warn('crewDay.notices.admins_unavailable', { error: error.message });
    return [];
  }
  return (data || []).map((u) => String(u.id));
}

async function send(userIds, notice, { day, booking = null, link, push = true, idempotencyKey = null }) {
  const metadata = { crew_day_id: day.id, ...(booking ? { booking_id: booking.id } : {}) };
  await Promise.all(userIds.map((userId) => notificationService.createNotification({
    userId,
    type: notice.type,
    title: notice.title,
    body: notice.body || null,
    icon: '🧰',
    link,
    metadata,
    context: 'personal',
    sendPush: push,
    ...(idempotencyKey ? { idempotencyKey: `${idempotencyKey}:${userId}` } : {}),
  }).catch((err) => {
    logger.warn('crewDay.notices.send_failed', { type: notice.type, crewDayId: day.id, error: err.message });
  })));
}

// ── Crew ───────────────────────────────────────────────────────

async function dayApproved(day, { bookedCount = 0 } = {}) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_approved',
    title: 'Your Crew Day is open',
    body: `Share the link: ${bookedCount} of ${day.capacity} booked.`,
  }, { day, link: links.crewDay(day.business_user_id, day.id) });
}

async function dayDeclined(day) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_declined',
    title: `Pantopus didn't approve ${day.title}`,
    body: day.review_note || null,
  }, { day, link: links.crewDay(day.business_user_id, day.id) });
}

function dayWhen(day, booking) {
  const date = booking?.service_date || day.service_date;
  return `${rules.formatDay(date)}, ${rules.formatWindow(booking?.window_start || day.window_start,
    booking?.window_end || day.window_end)}`;
}
function serviceDayName(day) {
  return (rules.SERVICES[day.service] || rules.SERVICES.other).day;
}
function businessName(crew) {
  return crew?.name || 'The crew';
}

// ── Household ─────────────────────────────────────────────────

async function booked(day, booking) {
  await send([booking.household_user_id], {
    type: 'crew_day_booked',
    title: "You're on the route",
    body: `${day.title}, ${dayWhen(day, booking)}. Total ${rules.formatMoney(booking.price_cents)}. We'll remind you the evening before.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function priceOffered(day, booking, crew) {
  await send([booking.household_user_id], {
    type: 'crew_day_price_offered',
    title: `Your price is ready: ${rules.formatMoney(booking.price_cents)}`,
    body: `${businessName(crew)} looked at your home. Approve it to book.`,
  }, { day, booking, link: links.booking(booking.id) });
}

// Who cancelled, in words: the crew released the home, couldn't take it, or cancelled the day; the operator; the
// system (no new date picked). Nothing is ever charged for a cancellation.
async function bookingCancelled(day, booking, crew, reason) {
  const lines = {
    crew_released: `${businessName(crew)} released your home at no charge.`,
    crew_declined: `${businessName(crew)} can't take your home this time.`,
    crew_cancelled_day: `${businessName(crew)} cancelled this day.`,
    operator: 'Pantopus cancelled this booking.',
    no_new_date: "No new date was picked, so this booking was cancelled.",
    price_not_answered: "The price wasn't approved before booking closed, so this booking was cancelled.",
  };
  await send([booking.household_user_id], {
    type: 'crew_day_cancelled',
    title: `Your ${serviceDayName(day)} was cancelled`,
    body: `${lines[reason] || 'This booking was cancelled.'} Nothing was charged.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function onTheWay(day, booking) {
  await send([booking.household_user_id], {
    type: 'crew_day_on_the_way',
    title: 'Your crew is on the way',
    body: `Expected ${rules.formatInstantWindow(booking.eta_start, booking.eta_end, day.timezone)}. Tap when the gate is ready.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function etaChanged(day, booking, crew) {
  const when = booking.eta_start
    ? rules.formatInstantWindow(booking.eta_start, booking.eta_end, day.timezone)
    : rules.formatWindow(booking.window_start, booking.window_end);
  await send([booking.household_user_id], {
    type: 'crew_day_eta_changed',
    title: 'New arrival time',
    body: `${businessName(crew)} now expects ${when}.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function cantGetIn(day, booking, note) {
  await send([booking.household_user_id], {
    type: 'crew_day_cant_get_in',
    title: "The crew can't get in",
    body: note || null,
  }, { day, booking, link: links.booking(booking.id) });
}

// "Gutters cleaned and flushed." and the like, by service.
const DONE_LINES = {
  gutter_cleaning: 'Gutters cleaned and flushed.',
  leaf_cleanup: 'Leaves cleared and hauled away.',
  roof_moss: 'Roof moss removed.',
  holiday_lights: 'Your lights are up.',
  window_washing: 'Windows washed.',
  pressure_washing: 'Pressure washing done.',
  other: 'The work is done.',
};

async function workDone(day, booking) {
  await send([booking.household_user_id], {
    type: 'crew_day_done',
    title: 'One thing off your list',
    body: `${DONE_LINES[day.service] || DONE_LINES.other} See the photos. We'll charge ${rules.formatMoney(booking.price_cents)} `
      + `${rules.formatDayRelative(booking.charge_due_at, day.timezone)} at ${rules.formatTime(booking.charge_due_at, day.timezone)} `
      + 'unless something needs attention.',
  }, { day, booking, link: links.booking(booking.id) });
}

async function charged(day, booking, crew) {
  const amount = (booking.price_cents || 0) - (booking.refunded_cents || 0);
  await send([booking.household_user_id], {
    type: 'crew_day_charged',
    title: `Paid: ${rules.formatReceipt(amount)} to ${businessName(crew)}`,
    body: null,
  }, { day, booking, link: links.booking(booking.id), push: false });
}

async function chargeFailed(day, booking, crew) {
  await send([booking.household_user_id], {
    type: 'crew_day_charge_failed',
    title: "Your card didn't go through",
    body: `Pay ${rules.formatMoney((booking.price_cents || 0) - (booking.refunded_cents || 0))} to ${businessName(crew)} in Pantopus.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function problemUpdate(day, booking, body) {
  await send([booking.household_user_id], {
    type: 'crew_day_problem_update',
    title: 'Update on your Crew Day',
    body,
  }, { day, booking, link: links.booking(booking.id) });
}

async function newDates(day, booking, crew, proposal) {
  const dates = proposal.dates.map((d) => rules.formatDay(d.date));
  const list = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} or ${dates[dates.length - 1]}` : dates[0];
  await send([booking.household_user_id], {
    type: 'crew_day_new_dates',
    title: 'Rain changed the plan',
    body: `${businessName(crew)} can come ${list} at the same price. No payment has been taken. If you don't answer by `
      + `${rules.formatDayRelative(proposal.deadline_at, day.timezone).replace(/^on /, '')} ${rules.formatTime(proposal.deadline_at, day.timezone)}, we won't book a new date.`,
  }, { day, booking, link: links.booking(booking.id) });
}

async function reminder(day, booking) {
  await send([booking.household_user_id], {
    type: 'crew_day_reminder',
    title: `${serviceDayName(day)} is tomorrow`,
    body: `${rules.formatWindow(booking.window_start, booking.window_end)}.${day.prep_note ? ` ${day.prep_note}` : ''}`
      + `${day.outside_only ? " You don't need to be home." : ''}`,
  }, { day, booking, link: links.booking(booking.id), idempotencyKey: `crew-day-reminder:${booking.id}:${booking.service_date}` });
}

async function invite(day, userId, crew, priceCents) {
  await send([userId], {
    type: 'crew_day_invite',
    title: `${businessName(crew)} is back on ${day.street_label}`,
    body: `${rules.formatDay(day.service_date)}. Book again: ${priceCents ? `your price is ${rules.formatMoney(priceCents)}` : 'see your price'}.`,
  }, { day, link: `/crew-day/${day.share_code}`, idempotencyKey: `crew-day-invite:${day.id}` });
}

async function requestAnswered(request, offerDay) {
  await send([request.created_by], offerDay ? {
    type: 'crew_day_request_answered',
    title: `A crew can come to ${request.street_label}`,
    body: `${offerDay.title}, ${rules.formatDay(offerDay.service_date)}. See your price.`,
  } : {
    type: 'crew_day_request_answered',
    title: `No crew yet for ${request.street_label}`,
    body: request.review_note || null,
  }, { day: request, link: offerDay ? `/crew-day/${offerDay.share_code}` : links.mine() });
}

// ── Crew (about one home) ─────────────────────────────────────

async function datesAnswered(day, booking, answered, total) {
  await send(await crewRecipients(day), {
    type: 'crew_day_dates_answered',
    title: `${answered} of ${total} picked a new date`,
    body: day.title,
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id), push: false });
}

async function dayCancelledForCrew(day, byOperator) {
  await send(await crewRecipients(day), {
    type: 'crew_day_cancelled',
    title: byOperator ? `Pantopus cancelled ${day.title}` : `${day.title} was cancelled`,
    body: `${day.cancel_reason ? `${day.cancel_reason} ` : ''}Nobody was charged.`,
  }, { day, link: links.crewDay(day.business_user_id, day.id) });
}

async function problemReported(day, booking) {
  await send(await crewRecipients(day), {
    type: 'crew_day_problem',
    title: 'A household reported a problem',
    body: 'Pantopus support has it. Their charge waits.',
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

async function gateReady(day, booking) {
  await send(await crewRecipients(day), {
    type: 'crew_day_gate_ready',
    title: `Gate is ready at ${booking.address_line}`,
    body: null,
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

async function newBooking(day, booking, bookedCount) {
  await send(await crewRecipients(day), {
    type: 'crew_day_new_booking',
    title: 'New home on your route',
    body: `${day.title}: ${bookedCount} of ${day.capacity} booked.`,
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

async function priceNeeded(day, booking) {
  const option = (booking.line_items || []).find((i) => i.kind === 'option');
  await send(await crewRecipients(day), {
    type: 'crew_day_price_needed',
    title: 'A home needs your price',
    body: `${option?.label || 'A home'} on ${day.street_label}.`,
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

async function homeCancelled(day, booking, bookedCount) {
  await send(await crewRecipients(day), {
    type: 'crew_day_booking_cancelled',
    title: 'A home cancelled',
    body: `${day.title}: ${bookedCount} of ${day.capacity} booked.`,
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

async function releaseAsked(day, booking) {
  await send(await crewRecipients(day), {
    type: 'crew_day_release_asked',
    title: 'A home asks to cancel',
    body: 'Release it at no charge in Crew Days.',
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id) });
}

// ── Operator ───────────────────────────────────────────────────

async function requestNew(request) {
  await send(await adminRecipients(), {
    type: 'crew_day_request_new',
    title: 'A street asked for a Crew Day',
    body: `${request.title}.`,
  }, { day: request, link: links.admin(request.id), push: false });
}

async function problemOpened(day, booking) {
  const due = rules.formatDayRelative(booking.problem_due_at, day.timezone);
  await send(await adminRecipients(), {
    type: 'crew_day_problem_opened',
    title: 'A Crew Day problem needs a reply',
    body: `${day.title}: reply ${due} by ${rules.formatTime(booking.problem_due_at, day.timezone)}.`,
  }, { day, booking, link: links.admin(day.id), push: false });
}

async function reviewNeeded(day, { businessName }) {
  const recipients = await adminRecipients();
  await send(recipients, {
    type: 'crew_day_review_needed',
    title: 'A Crew Day is waiting for approval',
    body: `${businessName || 'A crew'}: ${day.title}.`,
  }, { day, link: links.admin(day.id), push: false });
}

module.exports = {
  newDates,
  reminder,
  invite,
  requestAnswered,
  datesAnswered,
  dayCancelledForCrew,
  requestNew,
  charged,
  chargeFailed,
  problemUpdate,
  problemReported,
  problemOpened,
  onTheWay,
  etaChanged,
  cantGetIn,
  workDone,
  gateReady,
  DONE_LINES,
  booked,
  priceOffered,
  bookingCancelled,
  newBooking,
  priceNeeded,
  homeCancelled,
  releaseAsked,
  dayWhen,
  serviceDayName,
  links,
  crewRecipients,
  adminRecipients,
  send,
  dayApproved,
  dayDeclined,
  reviewNeeded,
};

'use strict';

/**
 * Crew Day notices (docs/product/crew-day-build/02-contract.md §6): who gets each one, its copy and its link. Every
 * notice is a personal notification with metadata { crew_day_id, booking_id }; the launch-cut type map drops them while
 * `crew_day` is unlisted. Links are web paths; the apps map them to native screens by type. The notices marked Email
 * in §6 also go out by email (emailService, Mailpit locally) to each person a notice was just made for, and the
 * operator's go to ADMIN_ALERT_EMAIL and the admin accounts.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');
const notificationService = require('../notificationService');
const emailService = require('../emailService');
const adminAlerts = require('../adminAlerts');
const { getBusinessPrimaryOwnerId, getActiveMembership } = require('../../utils/businessPermissions');
const store = require('./store');
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

/**
 * Stores the notice for each person (and pushes it unless `push` is false). With `email` (true, the email's words, or
 * a function answering them) it is emailed too, only to the people a notice was just made for: nobody while
 * `crew_day` is off, and never twice for an idempotent notice that already went out.
 */
async function send(userIds, notice, { day, booking = null, link, push = true, idempotencyKey = null, email = null }) {
  const metadata = { crew_day_id: day.id, ...(booking ? { booking_id: booking.id } : {}) };
  const made = await Promise.all(userIds.map((userId) => notificationService.createNotification({
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
    return null;
  })));
  const told = userIds.filter((_, i) => made[i]);
  if (email && told.length && isLaunchFeatureEnabled('crew_day')) {
    queueEmail(() => emailNotice(told, notice, { day, booking, link, email }));
  }
}

// ── Emails ────────────────────────────────────────────────────

// Emails leave one at a time after the notice is stored: the person who tapped never waits on the mail server, and a
// day cancelled with 60 homes never opens 60 connections at once. An email that fails is logged; the notice stays.
let emailQueue = Promise.resolve();
function queueEmail(job) {
  emailQueue = emailQueue.then(job).catch((err) => {
    logger.warn('crewDay.notices.email_failed', { error: err.message });
  });
  return emailQueue;
}

// The people's addresses, leaving out anyone who turned off Email Notifications (web Settings), as the monthly summary
// does. A preference that couldn't be read is not a yes.
async function emailRecipients(userIds) {
  if (!userIds.length) return [];
  const [users, prefs] = await Promise.all([
    supabaseAdmin.from('User').select('id, email').in('id', userIds),
    supabaseAdmin.from('MailPreferences').select('user_id, email_notifications').in('user_id', userIds),
  ]);
  if (users.error || prefs.error) {
    logger.warn('crewDay.notices.email_recipients_unavailable', { error: (users.error || prefs.error).message });
    return [];
  }
  const off = new Set((prefs.data || []).filter((p) => p.email_notifications === false).map((p) => String(p.user_id)));
  return (users.data || []).filter((u) => u.email && !off.has(String(u.id)));
}

const FOOTERS = {
  household: 'You got this email about your Crew Day on Pantopus.',
  crew: 'You got this email about a Crew Day your business runs on Pantopus.',
  request: 'You got this email because you asked for a Crew Day on your street on Pantopus.',
  operator: 'You got this email because you run Crew Day approvals and support on Pantopus.',
};

function dayFacts(day, booking) {
  return day.kind === 'request' ? [day.title] : [day.title, dayWhen(day, booking)];
}

async function emailNotice(userIds, notice, { day, booking, link, email }) {
  const words = typeof email === 'function' ? await email() : email === true ? {} : email;
  const people = await emailRecipients(userIds);
  for (const person of people) {
    const result = await emailService.sendCrewDayEmail({
      toEmail: person.email,
      subject: words.subject || notice.title,
      lead: words.lead === undefined ? notice.body : words.lead,
      facts: words.facts || dayFacts(day, booking),
      rows: words.rows || [],
      button: words.button || 'Open Pantopus',
      link: rules.webUrl(words.link || link),
      footer: words.footer || FOOTERS.household,
      settingsLink: rules.webUrl('/app/profile/settings'),
    });
    if (!result?.success) {
      logger.warn('crewDay.notices.email_not_sent', { type: notice.type, crewDayId: day.id, error: result?.error });
    }
  }
}

/**
 * An operator alert by email (02-contract.md §6), like services/adminAlerts.js: to ADMIN_ALERT_EMAIL and every admin
 * account, the city in the subject (never an address), ids and a link to the admin page, never a household's name,
 * address or note. Nothing while `crew_day` is off.
 */
function alertOperators(adminIds, { subject, lead, facts, button, link, place }) {
  if (!isLaunchFeatureEnabled('crew_day')) return;
  queueEmail(async () => {
    const admins = await emailRecipients(adminIds);
    const to = [...new Set([...adminAlerts.recipients(), ...admins.map((u) => u.email)].map((e) => e.toLowerCase()))];
    const where = [place?.city, place?.state].filter(Boolean).join(', ') || 'unknown area';
    for (const toEmail of to) {
      const result = await emailService.sendCrewDayEmail({
        toEmail,
        subject: `[Pantopus] ${subject} · ${where}`,
        lead,
        facts,
        button,
        link: rules.webUrl(link),
        footer: FOOTERS.operator,
      });
      if (!result?.success) logger.warn('crewDay.notices.alert_not_sent', { subject, error: result?.error });
    }
  });
}

// ── Crew ───────────────────────────────────────────────────────

async function dayApproved(day, { bookedCount = 0 } = {}) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_approved',
    title: 'Your Crew Day is open',
    body: `Share the link: ${bookedCount} of ${day.capacity} booked.`,
  }, { day, link: links.crewDay(day.business_user_id, day.id), email: {
    facts: [day.title, dayWhen(day), rules.webUrl(`/crew-day/${day.share_code}`)],
    button: 'Open your Crew Day',
    footer: FOOTERS.crew,
  } });
}

async function dayDeclined(day) {
  const recipients = await crewRecipients(day);
  await send(recipients, {
    type: 'crew_day_declined',
    title: `Pantopus didn't approve ${day.title}`,
    body: day.review_note || null,
  }, { day, link: links.crewDay(day.business_user_id, day.id), email: {
    button: 'Open your Crew Day',
    footer: FOOTERS.crew,
  } });
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

// What the household booked, line by line, and its total (whole dollars; the receipt has cents).
function bookedRows(booking) {
  return [
    ...(booking.line_items || []).map((item) => ({ label: item.label, value: rules.formatMoney(item.price_cents) })),
    { label: 'Total', value: rules.formatMoney(booking.price_cents), strong: true },
  ];
}

async function booked(day, booking) {
  await send([booking.household_user_id], {
    type: 'crew_day_booked',
    title: "You're on the route",
    body: `${day.title}, ${dayWhen(day, booking)}. Total ${rules.formatMoney(booking.price_cents)}. We'll remind you the evening before.`,
  }, { day, booking, link: links.booking(booking.id), email: { rows: bookedRows(booking), button: 'See your Crew Day' } });
}

async function priceOffered(day, booking, crew) {
  await send([booking.household_user_id], {
    type: 'crew_day_price_offered',
    title: `Your price is ready: ${rules.formatMoney(booking.price_cents)}`,
    body: `${businessName(crew)} looked at your home. Approve it to book.`,
  }, { day, booking, link: links.booking(booking.id), email: { rows: bookedRows(booking), button: 'See your price' } });
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
  }, { day, booking, link: links.booking(booking.id), email: { button: 'See your Crew Day' } });
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
  }, { day, booking, link: links.booking(booking.id), email: { button: 'See the photos' } });
}

// "Visa ending 4242": the card that paid (the household may have paid with another one after a failed charge).
async function cardLabel(userId, paymentMethodId) {
  const card = await store.savedCard(userId, paymentMethodId).catch(() => null);
  return card?.card_last4
    ? `${String(card.card_brand || 'card').replace(/^\w/, (c) => c.toUpperCase())} ending ${card.card_last4}`
    : 'Your card';
}

// The receipt (02-contract.md §6): the amount with cents, the crew, what was done, the card, the date and the invoice.
async function receipt(day, booking, crew, invoice, amount) {
  const invoiceId = invoice?.id || booking.invoice_id;
  const paymentId = invoice?.payment_id || null;
  const { data: payment } = paymentId
    ? await supabaseAdmin.from('Payment').select('stripe_payment_method_id, payment_succeeded_at').eq('id', paymentId)
      .maybeSingle()
    : { data: null };
  const card = await cardLabel(booking.household_user_id, payment?.stripe_payment_method_id || booking.payment_method_id);
  const localDay = (at) => rules.formatDay(rules.todayIn(day.timezone, new Date(at)));
  const paidOn = localDay(booking.paid_at || payment?.payment_succeeded_at || Date.now());
  const doneOn = booking.done_at ? localDay(booking.done_at) : rules.formatDay(booking.service_date || day.service_date);
  return {
    lead: `${businessName(crew)} finished your home on ${doneOn}. Here's your receipt.`,
    facts: [day.title, `${card} · ${paidOn}`],
    rows: [
      ...(booking.line_items || []).map((item) => ({ label: item.label, value: rules.formatReceipt(item.price_cents) })),
      ...(booking.refunded_cents
        ? [{ label: 'Taken off by Pantopus support', value: `−${rules.formatReceipt(booking.refunded_cents)}` }] : []),
      { label: 'Total paid', value: rules.formatReceipt(amount), strong: true },
    ],
    button: 'See the receipt',
    link: invoiceId ? `/app/invoice/${invoiceId}` : links.booking(booking.id),
  };
}

async function charged(day, booking, crew, invoice = null) {
  const amount = (booking.price_cents || 0) - (booking.refunded_cents || 0);
  await send([booking.household_user_id], {
    type: 'crew_day_charged',
    title: `Paid: ${rules.formatReceipt(amount)} to ${businessName(crew)}`,
    body: null,
  }, { day, booking, link: links.booking(booking.id), push: false,
    email: () => receipt(day, booking, crew, invoice, amount) });
}

async function chargeFailed(day, booking, crew) {
  await send([booking.household_user_id], {
    type: 'crew_day_charge_failed',
    title: "Your card didn't go through",
    body: `Pay ${rules.formatMoney((booking.price_cents || 0) - (booking.refunded_cents || 0))} to ${businessName(crew)} in Pantopus.`,
  }, { day, booking, link: links.booking(booking.id), email: { button: 'Pay in Pantopus' } });
}

async function problemUpdate(day, booking, body) {
  await send([booking.household_user_id], {
    type: 'crew_day_problem_update',
    title: 'Update on your Crew Day',
    body,
  }, { day, booking, link: links.booking(booking.id), email: { button: 'See your Crew Day' } });
}

async function newDates(day, booking, crew, proposal) {
  const dates = proposal.dates.map((d) => rules.formatDay(d.date));
  const list = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} or ${dates[dates.length - 1]}` : dates[0];
  await send([booking.household_user_id], {
    type: 'crew_day_new_dates',
    title: 'Rain changed the plan',
    body: `${businessName(crew)} can come ${list} at the same price. No payment has been taken. If you don't answer by `
      + `${rules.formatDayRelative(proposal.deadline_at, day.timezone).replace(/^on /, '')} ${rules.formatTime(proposal.deadline_at, day.timezone)}, we won't book a new date.`,
  }, { day, booking, link: links.booking(booking.id), email: { facts: [day.title], button: 'Pick a date' } });
}

async function reminder(day, booking) {
  // Sent from 6 PM the evening before until the window starts, so a late booking or run can send it on the day itself.
  const when = booking.service_date === rules.todayIn(day.timezone) ? 'today' : 'tomorrow';
  await send([booking.household_user_id], {
    type: 'crew_day_reminder',
    title: `${serviceDayName(day)} is ${when}`,
    body: `${rules.formatWindow(booking.window_start, booking.window_end)}.${day.prep_note ? ` ${day.prep_note}` : ''}`
      + `${day.outside_only ? " You don't need to be home." : ''}`,
  }, { day, booking, link: links.booking(booking.id), idempotencyKey: `crew-day-reminder:${booking.id}:${booking.service_date}`,
    email: { button: 'See your Crew Day' } });
}

async function invite(day, userId, crew, priceCents) {
  await send([userId], {
    type: 'crew_day_invite',
    title: `${businessName(crew)} is back on ${day.street_label}`,
    body: `${rules.formatDay(day.service_date)}. Book again: ${priceCents ? `your price is ${rules.formatMoney(priceCents)}` : 'see your price'}.`,
  }, { day, link: `/crew-day/${day.share_code}`, idempotencyKey: `crew-day-invite:${day.id}`, email: {
    button: 'Book again',
    footer: `You got this email because you booked ${businessName(crew)} on Pantopus before.`,
  } });
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
  }, { day: request, link: offerDay ? `/crew-day/${offerDay.share_code}` : links.mine(), email: offerDay
    ? { facts: [offerDay.title, dayWhen(offerDay)], button: 'See your price', footer: FOOTERS.request }
    : { button: 'See your Crew Days', footer: FOOTERS.request } });
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
  }, { day, link: links.crewDay(day.business_user_id, day.id), email: {
    button: 'Open your Crew Day',
    footer: FOOTERS.crew,
  } });
}

async function problemReported(day, booking) {
  await send(await crewRecipients(day), {
    type: 'crew_day_problem',
    title: 'A household reported a problem',
    body: 'Pantopus support has it. Their charge waits.',
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id), email: {
    button: 'Open your Crew Day',
    footer: FOOTERS.crew,
  } });
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
  }, { day, booking, link: links.crewDay(day.business_user_id, day.id), email: {
    facts: [day.title, dayWhen(day)],
    button: 'Set your price',
    footer: FOOTERS.crew,
  } });
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

// "December 2026", "December 2026 or January 2027", "any month"
function requestMonths(months) {
  const names = (months || []).map((m) => (m === 'any' ? 'any month' : rules.formatMonth(m))).filter(Boolean);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] || 'any month';
}

async function requestNew(request) {
  const recipients = await adminRecipients();
  await send(recipients, {
    type: 'crew_day_request_new',
    title: 'A street asked for a Crew Day',
    body: `${request.title}.`,
  }, { day: request, link: links.admin(request.id), push: false });
  alertOperators(recipients, {
    subject: 'Crew Day request to answer',
    lead: `A household asked for a Crew Day: ${request.title}, ${requestMonths(request.request_months)}. Answer with an open `
      + 'Crew Day or "No crew yet".',
    facts: [request.title, `Request ${request.id}`],
    button: 'Answer the request',
    link: links.admin(request.id),
    place: request,
  });
}

const PROBLEM_KINDS = {
  missed: 'the crew missed something',
  damage: 'something was damaged',
  no_show: "the crew didn't come",
  charge: 'a question about the charge',
  other: 'something else',
};

async function problemOpened(day, booking) {
  const due = rules.formatDayRelative(booking.problem_due_at, day.timezone);
  const by = `${due} by ${rules.formatTime(booking.problem_due_at, day.timezone)}`;
  const recipients = await adminRecipients();
  await send(recipients, {
    type: 'crew_day_problem_opened',
    title: 'A Crew Day problem needs a reply',
    body: `${day.title}: reply ${by}.`,
  }, { day, booking, link: links.admin(day.id), push: false });
  alertOperators(recipients, {
    subject: 'Crew Day problem to answer',
    lead: `A household reported a problem on ${day.title}: ${PROBLEM_KINDS[booking.problem_kind] || 'something else'}. `
      + `Its charge is paused. Reply ${by}.`,
    facts: [day.title, dayWhen(day, booking), `Booking ${booking.id}`],
    button: 'Open the problem',
    link: links.admin(day.id),
    place: day,
  });
}

async function reviewNeeded(day, { businessName }) {
  const recipients = await adminRecipients();
  await send(recipients, {
    type: 'crew_day_review_needed',
    title: 'A Crew Day is waiting for approval',
    body: `${businessName || 'A crew'}: ${day.title}.`,
  }, { day, link: links.admin(day.id), push: false });
  alertOperators(recipients, {
    subject: 'Crew Day to approve',
    lead: `${businessName || 'A crew'} sent ${day.title} for approval. Its invitation works once you approve it.`,
    facts: [day.title, dayWhen(day), `${day.capacity} homes · Crew Day ${day.id}`],
    button: 'Review it',
    link: links.admin(day.id),
    place: day,
  });
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

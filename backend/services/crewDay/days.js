'use strict';

/**
 * A crew's street days (docs/product/crew-day-build/01-spec.md §5 screens 13–14, §6 screens 20–21): setting one up,
 * editing it within the rules, sending it to Pantopus, and the operator's approval or decline.
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { checkBusinessPermission } = require('../../utils/businessPermissions');
const stripeService = require('../../stripe/stripeService');
const rules = require('./rules');
const store = require('./store');
const views = require('./views');
const notices = require('./notices');

const { CrewDayError } = rules;

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

function text(value, { field, label, min = 0, max }) {
  if (value === undefined || value === null) {
    if (min > 0) throw invalid(`${label} is required.`, field);
    return null;
  }
  if (typeof value !== 'string') throw invalid(`${label} must be text.`, field);
  const trimmed = value.trim();
  if (trimmed.length < min) throw invalid(min > 0 ? `${label} is required.` : `${label} is too short.`, field);
  if (trimmed.length > max) throw invalid(`${label} must be at most ${max} characters.`, field);
  return trimmed.length ? trimmed : null;
}

function integer(value, { field, label, min, max }) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid(`${label} must be a whole number from ${min} to ${max}.`, field);
  return n;
}

function money(value, { field, label }) {
  const n = Number(value);
  // $1 to $10,000 a home.
  if (!Number.isInteger(n) || n < 100 || n > 1000000) throw invalid(`${label} needs a price from $1 to $10,000.`, field);
  return n;
}

function optionId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function parseOptions(list, existing = []) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 6) {
    throw invalid('Add one to six price options.', 'price_options');
  }
  const known = new Set(existing.map((o) => o.id));
  const seen = new Set();
  return list.map((raw, i) => {
    const label = text(raw?.label, { field: `price_options.${i}.label`, label: 'Each option', min: 1, max: 60 });
    const needsLook = Boolean(raw?.needs_look);
    const id = raw?.id && known.has(raw.id) && !seen.has(raw.id) ? raw.id : optionId('opt');
    seen.add(id);
    return {
      id,
      label,
      price_cents: needsLook ? null : money(raw?.price_cents, { field: `price_options.${i}.price_cents`, label: label }),
      needs_look: needsLook,
    };
  });
}

function parseAddOns(list, existing = []) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 4) throw invalid('Add at most four add-ons.', 'add_ons');
  const known = new Set(existing.map((a) => a.id));
  const seen = new Set();
  return list.map((raw, i) => {
    const label = text(raw?.label, { field: `add_ons.${i}.label`, label: 'Each add-on', min: 1, max: 60 });
    const id = raw?.id && known.has(raw.id) && !seen.has(raw.id) ? raw.id : optionId('add');
    seen.add(id);
    return { id, label, price_cents: money(raw?.price_cents, { field: `add_ons.${i}.price_cents`, label }) };
  });
}

function parseIncluded(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 6) throw invalid('List at most six things the crew does.', 'included');
  return list.map((item, i) => text(item, { field: `included.${i}`, label: 'Each item', min: 1, max: 120 }));
}

function parseTime(value, field, label) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(String(value || ''));
  if (!m) throw invalid(`${label} needs a time like 09:00.`, field);
  return `${m[1]}:${m[2]}`;
}

/**
 * The whole New Crew Day form, merged over the stored day for an edit, checked as one: a day is always complete, so
 * a draft can be sent at any time. `checkTiming` (off for an open day, whose date and window can't change) refuses a
 * date in the past or a booking window that closes within the hour.
 */
function parseForm(input, base = {}, { now = new Date(), checkTiming = true } = {}) {
  const pick = (key) => (input[key] !== undefined ? input[key] : base[key]);
  const service = pick('service');
  if (!rules.SERVICE_KEYS.includes(service)) throw invalid('Pick a service.', 'service');
  const streetLabel = text(pick('street_label'), { field: 'street_label', label: 'The street or area name', min: 1, max: 80 });
  const city = text(pick('city'), { field: 'city', label: 'The city', min: 1, max: 80 });
  const state = text(pick('state'), { field: 'state', label: 'The state', min: 2, max: 40 });
  const center = input.center !== undefined ? input.center
    : (base.center_latitude != null ? { latitude: base.center_latitude, longitude: base.center_longitude } : null);
  const latitude = Number(center?.latitude);
  const longitude = Number(center?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw invalid('Pick where the crew starts on the map.', 'center');
  }
  const radius = integer(pick('radius_m'), { field: 'radius_m', label: 'The reach in meters', ...rules.RADIUS_M });
  const timezone = base.timezone || rules.timezoneFor(latitude, longitude);
  const serviceDate = String(pick('service_date') || '');
  const date = DateTime.fromISO(serviceDate, { zone: timezone });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || !date.isValid) throw invalid('Pick the date.', 'service_date');
  const today = rules.todayIn(timezone, now);
  if (checkTiming && serviceDate <= today) throw invalid('Pick a date after today.', 'service_date');
  if (checkTiming && date.diff(DateTime.fromISO(today, { zone: timezone }), 'days').days > 180) {
    throw invalid('Pick a date in the next six months.', 'service_date');
  }
  const windowStart = parseTime(pick('window_start'), 'window_start', 'The arrival window');
  const windowEnd = parseTime(pick('window_end'), 'window_end', 'The arrival window');
  if (windowEnd <= windowStart) throw invalid('The arrival window has to end after it starts.', 'window_end');
  const capacity = integer(pick('capacity'), { field: 'capacity', label: 'How many homes you can take', ...rules.CAPACITY });
  const startsAt = rules.localInstant(serviceDate, windowStart, timezone);
  const closesRaw = input.booking_closes_at !== undefined ? input.booking_closes_at
    : (input.service_date !== undefined || input.window_start !== undefined ? null : base.booking_closes_at);
  const closesAt = closesRaw
    ? DateTime.fromISO(String(closesRaw)).toUTC()
    : startsAt.minus({ hours: rules.CANCEL_CUTOFF_HOURS }).toUTC();
  if (!closesAt.isValid) throw invalid('Booking needs a closing time.', 'booking_closes_at');
  if (closesAt > startsAt.toUTC()) throw invalid('Booking has to close before the crew arrives.', 'booking_closes_at');
  if (checkTiming && closesAt.toJSDate() <= new Date(now.getTime() + 60 * 60 * 1000)) {
    throw invalid('Booking needs to stay open a while. Pick a later date or a later closing time.', 'booking_closes_at');
  }
  const priceOptions = parseOptions(pick('price_options'), base.price_options || []);
  const addOns = parseAddOns(pick('add_ons'), base.add_ons || []);
  const title = input.title !== undefined
    ? (text(input.title, { field: 'title', label: 'The title', min: 1, max: 80 }))
    : (base.title && input.service === undefined && input.street_label === undefined
      ? base.title : rules.titleFor(service, streetLabel));
  return {
    service,
    title,
    street_label: streetLabel,
    city,
    state,
    center_latitude: latitude,
    center_longitude: longitude,
    radius_m: radius,
    timezone,
    service_date: serviceDate,
    window_start: windowStart,
    window_end: windowEnd,
    capacity,
    booking_closes_at: closesAt.toISO(),
    included: parseIncluded(pick('included')),
    outside_only: pick('outside_only') === undefined || pick('outside_only') === null ? true : Boolean(pick('outside_only')),
    prep_note: text(pick('prep_note'), { field: 'prep_note', label: 'The note for households', max: 500 }),
    price_options: priceOptions,
    add_ons: addOns,
  };
}

// ── Access ─────────────────────────────────────────────────────

async function crewAccess(businessUserId, userId, permission = null) {
  const access = await checkBusinessPermission(businessUserId, userId, permission, { throwOnError: true });
  return access;
}

async function requireCrew(day, userId, permission = null) {
  if (!day || day.kind !== 'offer') throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that Crew Day.");
  const access = await crewAccess(day.business_user_id, userId, permission);
  if (!access.hasAccess) {
    if (permission) {
      const member = await crewAccess(day.business_user_id, userId);
      if (member.hasAccess) {
        throw new CrewDayError(403, 'NOT_ALLOWED', "Only the business's owners and editors can change a Crew Day.");
      }
    }
    throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that Crew Day.");
  }
  return access;
}

async function feeFor(businessUserId, facts) {
  const ratePct = Number(await stripeService.getEffectiveFeeRate(businessUserId));
  return { rate_pct: ratePct, founding: Boolean(facts?.founding) };
}

// ── Reads ──────────────────────────────────────────────────────

async function dayForCrew(day, userId) {
  const editAccess = await crewAccess(day.business_user_id, userId, 'profile.edit');
  const bookings = (await store.bookingsByDay([day.id])).get(String(day.id));
  return views.crewDayForCrew(day, views.dayStats(bookings), { canEdit: editAccess.hasAccess });
}

/** Screen 13: readiness and the day lists for a business the viewer belongs to. */
async function listForBusiness(businessUserId, userId) {
  const access = await crewAccess(businessUserId, userId);
  if (!access.hasAccess) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that business.");
  const edit = await crewAccess(businessUserId, userId, 'profile.edit');
  const { data: days, error } = await supabaseAdmin.from('CrewDay').select('*')
    .eq('business_user_id', businessUserId).eq('kind', 'offer')
    .order('service_date', { ascending: true }).limit(300);
  if (error) throw store.unavailable('business_list', error);
  const [bookings, ready] = await Promise.all([
    store.bookingsByDay((days || []).map((d) => d.id)),
    store.readiness(businessUserId),
  ]);
  const sections = { today: [], upcoming: [], pending: [], drafts: [], past: [] };
  const now = new Date();
  for (const day of days || []) {
    const stats = views.dayStats(bookings.get(String(day.id)), now);
    const card = views.crewDayCard(day, stats);
    const today = rules.todayIn(day.timezone, now);
    const lastDate = card.dates[card.dates.length - 1] || day.service_date;
    if (day.status === 'draft') sections.drafts.push(card);
    else if (['pending_review', 'declined'].includes(day.status)) sections.pending.push(card);
    else if (['open', 'in_progress'].includes(day.status) && card.dates.includes(today)) sections.today.push(card);
    else if (['open', 'in_progress'].includes(day.status) && lastDate >= today) sections.upcoming.push(card);
    else sections.past.push(card);
  }
  sections.drafts.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  sections.pending.sort((a, b) => String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')));
  sections.past.reverse();
  await markPaidOut(sections.past);
  return {
    readiness: { published: ready.published, payouts_enabled: ready.payouts_enabled,
      documents_verified: ready.documents_verified, missing: ready.missing },
    can_edit: edit.hasAccess,
    fee: await feeFor(businessUserId, ready.facts),
    services: rules.SERVICE_KEYS.map((key) => ({ key, label: rules.SERVICES[key].label,
      day_title: rules.SERVICES[key].day, included: rules.SERVICES[key].included })),
    ...sections,
  };
}

/**
 * Screen 1: the invitation by its code, signed in or out. Only a day Pantopus approved is public (a cancelled one
 * still says so); counts only, never a household. Signed in, `viewer` says whether this is the crew or a household
 * with a booking.
 */
async function publicInvitation(code, user = null) {
  const notFound = new CrewDayError(404, 'NOT_FOUND', "This Crew Day isn't available.");
  if (!rules.SHARE_CODE_PATTERN.test(String(code || ''))) throw notFound;
  const day = await store.getDayByCode(String(code));
  if (!day) throw notFound;
  if (!rules.LIVE_DAY_STATUSES.includes(day.status)) {
    if (day.status !== 'cancelled') throw notFound;
    const { data: approved, error } = await supabaseAdmin.from('CrewDayEvent').select('id')
      .eq('crew_day_id', day.id).eq('kind', 'day_approved').limit(1);
    if (error) throw store.unavailable('public_approved', error);
    if (!approved?.length) throw notFound;
  }
  const [bookings, facts] = await Promise.all([
    store.bookingsByDay([day.id]),
    store.crewFacts([day.business_user_id]),
  ]);
  const rows = bookings.get(String(day.id));
  let viewer = null;
  if (user?.id) {
    const access = await crewAccess(day.business_user_id, user.id);
    const mine = rows.find((b) => String(b.household_user_id) === String(user.id)
      && !rules.INACTIVE_BOOKING_STATUSES.includes(b.status));
    viewer = { role: access.hasAccess ? 'crew' : (mine ? 'household' : 'none'), booking_id: mine ? mine.id : null };
  }
  return views.invitation(day, views.dayStats(rows), store.publicCrew(facts.get(String(day.business_user_id))), viewer);
}

/** A past day is paid out once every charge's money has been transferred to the crew. */
async function markPaidOut(cards) {
  const charged = cards.filter((c) => c.charged_cents > 0);
  for (const c of cards) c.paid_out = false;
  if (!charged.length) return;
  const { data: paid } = await supabaseAdmin.from('CrewDayBooking').select('crew_day_id, invoice_id')
    .in('crew_day_id', charged.map((c) => c.id)).in('status', ['paid', 'refunded']);
  const invoiceIds = (paid || []).map((b) => b.invoice_id).filter(Boolean);
  if (!invoiceIds.length) return;
  const { data: invoices } = await supabaseAdmin.from('BusinessInvoice').select('id, payment_id').in('id', invoiceIds);
  const paymentIds = (invoices || []).map((i) => i.payment_id).filter(Boolean);
  const { data: payments } = paymentIds.length
    ? await supabaseAdmin.from('Payment').select('id, payment_status').in('id', paymentIds) : { data: [] };
  const statusOf = new Map((payments || []).map((p) => [String(p.id), p.payment_status]));
  const paymentOf = new Map((invoices || []).map((i) => [String(i.id), i.payment_id]));
  for (const c of charged) {
    const rows = (paid || []).filter((b) => String(b.crew_day_id) === String(c.id));
    c.paid_out = rows.length > 0 && rows.every((b) => ['transferred', 'refunded_full', 'refunded_partial']
      .includes(statusOf.get(String(paymentOf.get(String(b.invoice_id))))));
  }
}

// ── Writes ─────────────────────────────────────────────────────

function notReady(ready) {
  return new CrewDayError(409, 'BUSINESS_NOT_READY',
    ready.missing.includes('publish_page')
      ? 'Publish your business page and set up payouts before starting a Crew Day.'
      : 'Set up payouts before starting a Crew Day.',
    { missing: ready.missing });
}

async function insertWithCode(row) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabaseAdmin.from('CrewDay').insert({ ...row, share_code: rules.newShareCode() })
      .select('*').single();
    if (!error) return data;
    if (error.code !== '23505') {
      logger.error('crewDay.create.insert_failed', { error: error.message });
      throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't save your Crew Day. Please try again.");
    }
  }
  throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't save your Crew Day. Please try again.");
}

async function announceSubmitted(day, facts) {
  await notices.reviewNeeded(day, { businessName: facts?.name }).catch(() => {});
}

async function create(userId, body = {}) {
  const businessUserId = String(body.business_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(businessUserId)) throw invalid('Pick the business running this Crew Day.', 'business_id');
  const access = await crewAccess(businessUserId, userId, 'profile.edit');
  if (!access.hasAccess) {
    const member = await crewAccess(businessUserId, userId);
    throw member.hasAccess
      ? new CrewDayError(403, 'NOT_ALLOWED', "Only the business's owners and editors can set up a Crew Day.")
      : new CrewDayError(404, 'NOT_FOUND', "We couldn't find that business.");
  }
  const ready = await store.readiness(businessUserId);
  if (!ready.ready) throw notReady(ready);
  let repeatOf = null;
  if (body.repeat_of) {
    const previous = await store.getDay(body.repeat_of, { kind: 'offer' });
    if (!previous || previous.business_user_id !== businessUserId) throw invalid("We couldn't find the Crew Day to repeat.", 'repeat_of');
    repeatOf = previous.id;
  }
  const form = parseForm(body);
  const submit = Boolean(body.submit);
  const now = new Date().toISOString();
  const day = await insertWithCode({
    kind: 'offer',
    business_user_id: businessUserId,
    created_by: userId,
    ...form,
    status: submit ? 'pending_review' : 'draft',
    submitted_at: submit ? now : null,
    repeat_of: repeatOf,
  });
  await store.addEvent({ day, actorUserId: userId, actorRole: 'crew', kind: 'day_created',
    data: repeatOf ? { repeat_of: repeatOf } : {}, visibleTo: 'crew' });
  if (submit) {
    await store.addEvent({ day, actorUserId: userId, actorRole: 'crew', kind: 'day_submitted', visibleTo: 'crew' });
    await announceSubmitted(day, ready.facts);
  }
  return views.crewDayForCrew(day, views.dayStats([]), { canEdit: true });
}

async function edit(dayId, userId, body = {}) {
  const day = await store.getDay(dayId);
  await requireCrew(day, userId, 'profile.edit');
  const allowed = views.editableFields(day);
  const asked = views.FORM_FIELDS.filter((field) => body[field] !== undefined);
  if (asked.length === 0) throw invalid('Nothing to change.');
  const refused = asked.filter((field) => !allowed.includes(field));
  if (refused.length) {
    throw new CrewDayError(409, 'NOT_EDITABLE', allowed.length
      ? "An open Crew Day keeps its street, date and window. Use \"Propose new dates\" to move it."
      : "This Crew Day can't be changed anymore.", { fields: refused });
  }
  const bookings = (await store.bookingsByDay([day.id], 'id, status, option_id, add_on_ids, price_cents, refunded_cents, service_date, problem_status, release_asked_at, household_user_id, crew_day_id'))
    .get(String(day.id));
  const active = bookings.filter((b) => !rules.INACTIVE_BOOKING_STATUSES.includes(b.status));
  const form = parseForm(body, day, { checkTiming: !['open', 'in_progress'].includes(day.status) });
  if (form.capacity < active.length) {
    throw new CrewDayError(409, 'CAPACITY_BELOW_BOOKED',
      `${active.length} homes are booked already, so the day needs room for at least ${active.length}.`);
  }
  const optionIds = new Set(form.price_options.map((o) => o.id));
  const addOnIds = new Set(form.add_ons.map((a) => a.id));
  if (active.some((b) => !optionIds.has(b.option_id) || (b.add_on_ids || []).some((id) => !addOnIds.has(id)))) {
    throw new CrewDayError(409, 'OPTION_IN_USE', 'A booked home uses that option. Change its price instead of removing it.');
  }
  const changes = Object.fromEntries(Object.entries(form).filter(([key]) => {
    if (key === 'center_latitude' || key === 'center_longitude') return asked.includes('center');
    if (key === 'timezone') return false;
    if (key === 'title') return asked.includes('title') || asked.includes('service') || asked.includes('street_label');
    if (key === 'booking_closes_at') {
      return asked.some((f) => ['booking_closes_at', 'service_date', 'window_start'].includes(f));
    }
    return asked.includes(key);
  }));
  const { data: updated, error } = await supabaseAdmin.from('CrewDay')
    .update({ ...changes, updated_at: new Date().toISOString() }).eq('id', day.id).eq('status', day.status)
    .select('*').maybeSingle();
  if (error) {
    logger.error('crewDay.edit.update_failed', { crewDayId: day.id, error: error.message });
    throw new CrewDayError(500, 'SERVER_ERROR', "We couldn't save your changes. Please try again.");
  }
  if (!updated) throw new CrewDayError(409, 'CHANGED', 'This Crew Day just changed. Refresh and try again.');
  await store.addEvent({ day: updated, actorUserId: userId, actorRole: 'crew', kind: 'day_edited',
    data: { fields: asked }, visibleTo: 'crew' });
  return views.crewDayForCrew(updated, views.dayStats(bookings), { canEdit: true });
}

async function submit(dayId, userId) {
  const day = await store.getDay(dayId);
  await requireCrew(day, userId, 'profile.edit');
  if (day.status === 'pending_review') return views.crewDayForCrew(day, views.dayStats([]), { canEdit: true });
  if (!['draft', 'declined'].includes(day.status)) {
    throw new CrewDayError(409, 'DAY_NOT_DRAFT', 'This Crew Day was sent already.');
  }
  const ready = await store.readiness(day.business_user_id);
  if (!ready.ready) throw notReady(ready);
  parseForm({}, day); // still in the future, booking still open long enough
  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin.from('CrewDay')
    .update({ status: 'pending_review', submitted_at: now, updated_at: now }).eq('id', day.id).eq('status', day.status)
    .select('*').maybeSingle();
  if (error) throw store.unavailable('submit', error);
  if (!updated) throw new CrewDayError(409, 'CHANGED', 'This Crew Day just changed. Refresh and try again.');
  await store.addEvent({ day: updated, actorUserId: userId, actorRole: 'crew', kind: 'day_submitted', visibleTo: 'crew' });
  await announceSubmitted(updated, ready.facts);
  return views.crewDayForCrew(updated, views.dayStats([]), { canEdit: true });
}

// ── Operator ───────────────────────────────────────────────────

async function review(dayId, operatorId, { approve, note }) {
  const day = await store.getDay(dayId, { kind: 'offer' });
  if (!day) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that Crew Day.");
  if (day.status !== 'pending_review') {
    throw new CrewDayError(409, 'NOT_WAITING', day.status === 'open' ? 'This Crew Day is open already.'
      : "This Crew Day isn't waiting for approval.");
  }
  const reviewNote = text(note, { field: 'note', label: approve ? 'The note' : 'A note for the crew', min: approve ? 0 : 1, max: 500 });
  if (approve) {
    const ready = await store.readiness(day.business_user_id);
    if (!ready.ready) throw notReady(ready);
    if (day.service_date <= rules.todayIn(day.timezone) || new Date(day.booking_closes_at) <= new Date()) {
      throw new CrewDayError(409, 'DAY_PASSED',
        "Booking for this Crew Day would already be closed. Decline it and ask the crew to pick a later date.");
    }
  }
  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin.from('CrewDay').update({
    status: approve ? 'open' : 'declined',
    review_note: reviewNote,
    reviewed_by: operatorId,
    reviewed_at: now,
    updated_at: now,
  }).eq('id', day.id).eq('status', 'pending_review').select('*').maybeSingle();
  if (error) throw store.unavailable('review', error);
  if (!updated) throw new CrewDayError(409, 'CHANGED', 'This Crew Day just changed. Refresh and try again.');
  await store.addEvent({ day: updated, actorUserId: operatorId, actorRole: 'operator',
    kind: approve ? 'day_approved' : 'day_declined', data: reviewNote ? { note: reviewNote } : {}, visibleTo: 'crew' });
  if (approve) await notices.dayApproved(updated).catch(() => {});
  else await notices.dayDeclined(updated).catch(() => {});
  return updated;
}

module.exports = {
  publicInvitation,
  parseForm,
  crewAccess,
  requireCrew,
  dayForCrew,
  listForBusiness,
  create,
  edit,
  submit,
  review,
  feeFor,
};

'use strict';

/**
 * Crew Day read shapes (docs/product/crew-day-build/02-contract.md §2 "Derived" and §4). Each view gets the day row and
 * the day's booking rows; nothing here reads the database. Households never appear in the public view: counts only.
 */

const rules = require('./rules');

/** Counts and money over a day's bookings. */
function dayStats(bookings = [], now = new Date()) {
  const active = bookings.filter((b) => !rules.INACTIVE_BOOKING_STATUSES.includes(b.status));
  const sum = (rows) => rows.reduce((total, b) => total + (Number(b.price_cents) || 0), 0);
  const paid = active.filter((b) => b.status === 'paid');
  const paused = active.filter((b) => b.status === 'done' && b.problem_status === 'open');
  const scheduled = active.filter((b) => b.status === 'done' && b.problem_status !== 'open');
  const dates = [...new Set(active.map((b) => b.service_date).filter(Boolean))].sort();
  return {
    booked_count: active.length,
    price_checks: active.filter((b) => b.status === 'price_pending').length,
    release_asks: active.filter((b) => b.release_asked_at && !['done', 'paid', 'payment_failed'].includes(b.status)).length,
    done_count: active.filter((b) => ['done', 'paid', 'payment_failed'].includes(b.status)).length,
    charged_cents: sum(paid) - paid.reduce((total, b) => total + (Number(b.refunded_cents) || 0), 0),
    scheduled_cents: sum(scheduled),
    paused_cents: sum(paused),
    gross_cents: sum(active.filter((b) => b.price_cents != null)),
    dates,
    now,
  };
}

/** Where a booking's money stands, for the crew's and the operator's pills. */
function chargeState(b) {
  if (b.status === 'refunded') return 'refunded';
  if (b.status === 'paid') return (Number(b.refunded_cents) || 0) > 0 ? 'partially_refunded' : 'charged';
  if (b.status === 'payment_failed') return 'failed';
  if (b.status === 'done') return b.problem_status === 'open' ? 'paused' : 'scheduled';
  if (rules.INACTIVE_BOOKING_STATUSES.includes(b.status)) return 'none';
  return 'not_yet';
}

/** The money preview and the after-the-day totals: gross of every priced booking, and the crew's share. */
function money(stats, feeRatePct) {
  const rate = feeRatePct == null ? null : Number(feeRatePct);
  const net = (cents) => (rate == null ? null : Math.round((cents * (100 - rate)) / 100));
  return {
    gross_cents: stats.gross_cents,
    fee_rate: rate,
    net_cents: net(stats.gross_cents),
    charged_cents: stats.charged_cents,
    scheduled_cents: stats.scheduled_cents,
    paused_cents: stats.paused_cents,
  };
}

/** Never stored: instants of the window, the cutoff, and whether booking is closed or full. */
function derived(day, stats) {
  const now = stats?.now || new Date();
  const bookedCount = stats?.booked_count || 0;
  const windowStartsAt = rules.windowStartsAt(day.service_date, day.window_start, day.timezone);
  const closes = day.booking_closes_at ? new Date(day.booking_closes_at) : null;
  return {
    booked_count: bookedCount,
    spots_left: Math.max(0, (Number(day.capacity) || 0) - bookedCount),
    is_full: bookedCount >= (Number(day.capacity) || 0),
    is_closed: Boolean(closes && now >= closes),
    window_starts_at: windowStartsAt,
    window_ends_at: rules.windowEndsAt(day.service_date, day.window_end, day.timezone),
    cancel_cutoff_at: rules.cancelCutoffAt(day.service_date, day.window_start, day.timezone),
  };
}

function priceFromCents(day) {
  const prices = (day.price_options || []).filter((o) => !o.needs_look && Number.isInteger(o.price_cents))
    .map((o) => o.price_cents);
  return prices.length ? Math.min(...prices) : null;
}

function share(day) {
  if (!day.share_code) return null;
  return {
    code: day.share_code,
    url: rules.webUrl(`/crew-day/${day.share_code}`),
    flyer_url: rules.webUrl(`/crew-day/${day.share_code}/flyer`),
  };
}

function availability(day, d) {
  if (day.status === 'cancelled') return 'cancelled';
  if (day.status === 'done') return 'done';
  if (day.status === 'in_progress' || d.is_closed) return 'closed';
  if (d.is_full) return 'full';
  return 'open';
}

function serviceFields(day) {
  return { service: day.service, service_label: (rules.SERVICES[day.service] || rules.SERVICES.other).label };
}

function timeFields(day) {
  return {
    timezone: day.timezone,
    service_date: day.service_date,
    window_start: rules.hhmm(day.window_start),
    window_end: rules.hhmm(day.window_end),
  };
}

/** A row in the crew's Crew Days list (screen 13). */
function crewDayCard(day, stats) {
  const d = derived(day, stats);
  return {
    id: day.id,
    title: day.title,
    ...serviceFields(day),
    street_label: day.street_label,
    city: day.city,
    state: day.state,
    ...timeFields(day),
    window_starts_at: d.window_starts_at,
    window_ends_at: d.window_ends_at,
    status: day.status,
    capacity: day.capacity,
    booked_count: d.booked_count,
    spots_left: d.spots_left,
    is_full: d.is_full,
    booking_closes_at: day.booking_closes_at,
    is_closed: d.is_closed,
    price_checks: stats?.price_checks || 0,
    release_asks: stats?.release_asks || 0,
    done_count: stats?.done_count || 0,
    charged_cents: stats?.charged_cents || 0,
    dates: stats?.dates?.length ? stats.dates : [day.service_date],
    review_note: day.status === 'declined' ? day.review_note : null,
    submitted_at: day.submitted_at,
    share: share(day),
    updated_at: day.updated_at,
  };
}

/** The whole day for the crew (the wizard's edit form and screen 15's header). */
function crewDayForCrew(day, stats, { canEdit = false } = {}) {
  return {
    ...crewDayCard(day, stats),
    kind: day.kind,
    business_user_id: day.business_user_id,
    center: { latitude: Number(day.center_latitude), longitude: Number(day.center_longitude) },
    radius_m: day.radius_m,
    cancel_cutoff_at: derived(day, stats).cancel_cutoff_at,
    included: day.included || [],
    outside_only: day.outside_only,
    prep_note: day.prep_note,
    price_options: day.price_options || [],
    add_ons: day.add_ons || [],
    price_from_cents: priceFromCents(day),
    proposed_dates: day.proposed_dates,
    repeat_of: day.repeat_of,
    review_note: day.review_note,
    reviewed_at: day.reviewed_at,
    cancel_reason: day.cancel_reason,
    cancelled_by: day.cancelled_by,
    cancelled_at: day.cancelled_at,
    created_at: day.created_at,
    started_at: day.started_at,
    completed_at: day.completed_at,
    can_edit: canEdit,
    editable_fields: canEdit ? editableFields(day) : [],
  };
}

const FORM_FIELDS = ['service', 'title', 'street_label', 'city', 'state', 'center', 'radius_m', 'service_date',
  'window_start', 'window_end', 'capacity', 'booking_closes_at', 'included', 'outside_only', 'prep_note',
  'price_options', 'add_ons'];
// An open day keeps its place, date and window (dates change only through "Propose new dates"); existing bookings
// keep their prices whatever the list says.
const OPEN_EDITABLE = ['capacity', 'included', 'outside_only', 'prep_note', 'price_options', 'add_ons'];

function editableFields(day) {
  if (['draft', 'declined', 'pending_review'].includes(day.status)) return FORM_FIELDS;
  if (['open', 'in_progress'].includes(day.status)) return OPEN_EDITABLE;
  return [];
}

/** The public invitation (screen 1): never an address, a household or the area's coordinates. */
function invitation(day, stats, crew, viewer = null) {
  const d = derived(day, stats);
  return {
    id: day.id,
    code: day.share_code,
    title: day.title,
    ...serviceFields(day),
    street_label: day.street_label,
    city: day.city,
    state: day.state,
    ...timeFields(day),
    window_starts_at: d.window_starts_at,
    window_ends_at: d.window_ends_at,
    booking_closes_at: day.booking_closes_at,
    included: day.included || [],
    outside_only: day.outside_only,
    price_from_cents: priceFromCents(day),
    price_options: (day.price_options || []).map((o) => ({
      id: o.id, label: o.label, price_cents: o.needs_look ? null : o.price_cents, needs_look: Boolean(o.needs_look),
    })),
    add_ons: (day.add_ons || []).map((a) => ({ id: a.id, label: a.label, price_cents: a.price_cents })),
    capacity: day.capacity,
    booked_count: d.booked_count,
    spots_left: d.spots_left,
    availability: availability(day, d),
    crew,
    ...(viewer ? { viewer } : {}),
  };
}

module.exports = {
  dayStats,
  chargeState,
  money,
  derived,
  priceFromCents,
  share,
  availability,
  crewDayCard,
  crewDayForCrew,
  invitation,
  editableFields,
  FORM_FIELDS,
  OPEN_EDITABLE,
};

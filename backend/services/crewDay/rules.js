'use strict';

/**
 * Crew Day rules shared by the routes, the notices and the jobs: services, statuses, local times, money and copy
 * formats (docs/product/crew-day-build/01-spec.md §1 "Copy", 02-contract.md §2).
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// label: the service tag and the request chips; day: the title's first words ("Gutter Day on Maple Lane");
// included: what the New Crew Day wizard prefills.
const SERVICES = {
  gutter_cleaning: {
    label: 'Gutter cleaning',
    day: 'Gutter Day',
    included: ['Cleans every gutter by hand', 'Flushes each downspout', 'Bags the debris and takes it away', 'Outside only'],
  },
  leaf_cleanup: {
    label: 'Leaf cleanup',
    day: 'Leaf Day',
    included: ['Rakes leaves from the lawn and beds', 'Clears the walkways and the driveway', 'Bags the leaves and takes them away', 'Outside only'],
  },
  roof_moss: {
    label: 'Roof moss',
    day: 'Roof Moss Day',
    included: ['Removes moss from the roof by hand', 'Treats the roof against regrowth', 'Clears what falls into the gutters', 'Outside only'],
  },
  holiday_lights: {
    label: 'Holiday lights',
    day: 'Holiday Lights Day',
    included: ['Hangs lights along the roofline', 'Uses clips that leave no marks', 'Tests every strand before leaving', 'Outside only'],
  },
  window_washing: {
    label: 'Window washing',
    day: 'Window Day',
    included: ['Washes every outside window', 'Wipes the frames and sills', 'Leaves no streaks or drips', 'Outside only'],
  },
  pressure_washing: {
    label: 'Pressure washing',
    day: 'Pressure Washing Day',
    included: ['Washes the driveway and walkways', 'Rinses the front steps', 'Clears the moss and stains it can', 'Outside only'],
  },
  other: { label: 'Something else', day: 'Crew Day', included: [] },
};
const SERVICE_KEYS = Object.keys(SERVICES);

const OFFER_STATUSES = ['draft', 'pending_review', 'declined', 'open', 'in_progress', 'done', 'cancelled'];
const REQUEST_STATUSES = ['requested', 'offer_ready', 'no_crew'];
// Bookings that hold a spot on the route (everything but the ends below).
const INACTIVE_BOOKING_STATUSES = ['cancelled', 'declined', 'refunded'];
const ACTIVE_BOOKING_STATUSES = ['price_pending', 'price_offered', 'booked', 'new_dates', 'on_the_way', 'done', 'paid',
  'payment_failed'];
// Days a household can reach by link: approved once (open, started, finished or cancelled after approval).
const LIVE_DAY_STATUSES = ['open', 'in_progress', 'done'];

const CAPACITY = { min: 1, max: 60 };
const RADIUS_M = { min: 100, max: 1600 };
const CANCEL_CUTOFF_HOURS = 48;
const CHARGE_DELAY_HOURS = 24;

class CrewDayError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Share codes: 8 characters without look-alikes (no 0, 1, i, l, o), matching the table's CHECK.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function newShareCode() {
  let code = '';
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}
const SHARE_CODE_PATTERN = /^[a-hjkmnp-z2-9]{8}$/;

function titleFor(service, streetLabel) {
  const prefix = (SERVICES[service] || SERVICES.other).day;
  return `${prefix} on ${streetLabel}`.slice(0, 80);
}

// ── Local times ─────────────────────────────────────────────────
// Dates are YYYY-MM-DD in the day's timezone, windows HH:MM local; instants are ISO strings in UTC.
function hhmm(time) {
  return String(time || '').slice(0, 5);
}

function localInstant(date, time, timezone) {
  const at = DateTime.fromISO(`${date}T${hhmm(time)}`, { zone: timezone || DEFAULT_TIMEZONE });
  return at.isValid ? at : null;
}

function windowStartsAt(date, start, timezone) {
  return localInstant(date, start, timezone)?.toUTC().toISO() || null;
}

function windowEndsAt(date, end, timezone) {
  return localInstant(date, end, timezone)?.toUTC().toISO() || null;
}

function defaultBookingClosesAt(date, start, timezone) {
  return localInstant(date, start, timezone)?.minus({ hours: CANCEL_CUTOFF_HOURS }).toUTC().toISO() || null;
}

function cancelCutoffAt(date, start, timezone) {
  return defaultBookingClosesAt(date, start, timezone);
}

function todayIn(timezone, now = new Date()) {
  return DateTime.fromJSDate(now).setZone(timezone || DEFAULT_TIMEZONE).toISODate();
}

// ── Copy formats (01-spec.md "Copy") ────────────────────────────
// "Tue, Nov 17"
function formatDay(date, { long = false } = {}) {
  const at = DateTime.fromISO(String(date));
  if (!at.isValid) return '';
  return at.toFormat(long ? 'cccc, LLL d' : 'ccc, LLL d');
}

// "9 AM", "9:30 AM"
function formatClock(time) {
  const [h, m] = hhmm(time).split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}
function meridiem(time) {
  return Number(hhmm(time).split(':')[0]) < 12 ? 'AM' : 'PM';
}

// "9 AM–1 PM", "10–11 AM", "11 AM–12 PM"
function formatWindow(start, end) {
  if (!start || !end) return '';
  if (meridiem(start) === meridiem(end)) return `${formatClock(start)}–${formatClock(end)} ${meridiem(end)}`;
  return `${formatClock(start)} ${meridiem(start)}–${formatClock(end)} ${meridiem(end)}`;
}

// A window from two instants, in the day's zone ("expected 10–11 AM").
function formatInstantWindow(startIso, endIso, timezone) {
  const zone = timezone || DEFAULT_TIMEZONE;
  const a = DateTime.fromISO(String(startIso)).setZone(zone);
  const b = DateTime.fromISO(String(endIso)).setZone(zone);
  if (!a.isValid || !b.isValid) return '';
  return formatWindow(a.toFormat('HH:mm'), b.toFormat('HH:mm'));
}

// "tomorrow", "today", or "Wed, Nov 18" for an instant, in the day's zone.
function formatDayRelative(iso, timezone, now = new Date()) {
  const zone = timezone || DEFAULT_TIMEZONE;
  const at = DateTime.fromISO(String(iso)).setZone(zone);
  if (!at.isValid) return '';
  const today = DateTime.fromJSDate(now).setZone(zone).startOf('day');
  const days = Math.round(at.startOf('day').diff(today, 'days').days);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `on ${at.toFormat('ccc, LLL d')}`;
}

// "11:42 AM" in the day's zone
function formatTime(iso, timezone) {
  const at = DateTime.fromISO(String(iso)).setZone(timezone || DEFAULT_TIMEZONE);
  return at.isValid ? `${formatClock(at.toFormat('HH:mm'))} ${at.toFormat('a')}` : '';
}

// Whole dollars without cents ("$180"); "$180.50" when there are cents. Receipts use formatReceipt.
function formatMoney(cents) {
  const n = Number(cents) || 0;
  const dollars = n / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString('en-US')}`
    : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatReceipt(cents) {
  return `$${((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Places ─────────────────────────────────────────────────────
function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inArea(day, point) {
  if (!point || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) return false;
  const center = { latitude: Number(day.center_latitude), longitude: Number(day.center_longitude) };
  return distanceMeters(center, { latitude: Number(point.latitude), longitude: Number(point.longitude) })
    <= Number(day.radius_m);
}

function timezoneFor(latitude, longitude) {
  try {
    // geo-tz ships its own boundary data; a failed lookup keeps the pilot's zone.
    const { find } = require('geo-tz');
    return find(Number(latitude), Number(longitude))[0] || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function webUrl(pathname) {
  const base = String(process.env.APP_URL || process.env.WEB_APP_URL || 'https://pantopus.com').replace(/\/+$/, '');
  return `${base}${pathname}`;
}

module.exports = {
  DEFAULT_TIMEZONE,
  SERVICES,
  SERVICE_KEYS,
  OFFER_STATUSES,
  REQUEST_STATUSES,
  ACTIVE_BOOKING_STATUSES,
  INACTIVE_BOOKING_STATUSES,
  LIVE_DAY_STATUSES,
  CAPACITY,
  RADIUS_M,
  CANCEL_CUTOFF_HOURS,
  CHARGE_DELAY_HOURS,
  CrewDayError,
  newShareCode,
  SHARE_CODE_PATTERN,
  titleFor,
  hhmm,
  localInstant,
  windowStartsAt,
  windowEndsAt,
  defaultBookingClosesAt,
  cancelCutoffAt,
  todayIn,
  formatDay,
  formatWindow,
  formatInstantWindow,
  formatDayRelative,
  formatTime,
  formatMoney,
  formatReceipt,
  distanceMeters,
  inArea,
  timezoneFor,
  webUrl,
};

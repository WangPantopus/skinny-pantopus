'use strict';

/**
 * Nearby Plans: the rules for who, where and when (build brief §7), stated once.
 *
 * Distances shown to people are always bands, never meters. Bands are measured
 * from the plan's public area point, never from the exact place, so moving the
 * viewer's own point around can't trilaterate a plan's exact place.
 */

const { haversineMeters } = require('../../utils/trustState');

const KINDS = ['watch_party', 'playdate', 'pickup_game', 'walk_coffee'];
const AUTO_RULES = ['verified', 'hosted_before', 'anyone_nearby'];
const KIDS_AGE_BANDS = ['under_2', '2_3', '4_5', '6_8', '9_12'];
const DISTANCE_BANDS = ['under_1_mi', 'about_1_mi', 'about_2_mi', 'about_3_mi', 'about_5_mi'];
const SPORTS = ['pickleball', 'basketball', 'soccer', 'tennis', 'volleyball', 'running', 'other'];
const LEVELS = ['any', 'casual', 'competitive'];
const WALK_KINDS = ['walk', 'dog_walk', 'stroller_walk', 'coffee'];
const PACES = ['easy', 'brisk'];
const WINDOWS = ['now', 'today', 'week', 'weekend'];

const MILE_METERS = 1609.344;
// Hosting: within the existing 5 km canPostToPlace proximity (about 3 miles) of
// where the host lives or where they are now (utils/trustState.js).
const HOST_RADIUS_METERS = 5000;
// Asking: a location within 5 miles; playdates 3 miles.
const ASK_RADIUS_METERS = 5 * MILE_METERS;
const PLAYDATE_ASK_RADIUS_METERS = 5000;
// The list under the map: "This week · within 5 mi".
const LIST_RADIUS_METERS = 5 * MILE_METERS;
// A GPS fix proves where someone is for 5 minutes.
const GPS_MAX_AGE_MS = 5 * 60 * 1000;
// A "public" place this close to one of the host's homes is the home (decision D2, board H4).
// A phone's fix taken anywhere in the house or yard lands within it (indoors, usually 10–30 m
// off, plus a few meters between the address point and the house). Most parks beside a home
// sit farther out, since a park's point is its middle; a wider radius would also refuse the
// corner café or the park across the street.
const HOME_GUARD_METERS = 50;

const LIMITS = Object.freeze({
  upcomingPlansPerHost: 3,
  openRequestsPerPerson: 10,
  newPlansPerDay: 5,
  asksPerPlan: 3,
  maxDaysAhead: 14,
  minDurationMinutes: 15,
  maxDurationMinutes: 8 * 60,
  // Pickup games and walks take people until 30 minutes before the end.
  lateJoinCutoffMinutes: 30,
  // Moving the time by more than this asks everyone "Still coming?".
  reconfirmShiftMinutes: 30,
  // A plan may start "now": a small grace for the time it took to post.
  startGraceMinutes: 10,
});

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// Past this, a band would mislead: the plan is simply not nearby.
const MAX_BAND_METERS = 10 * MILE_METERS;

function distanceBandFromMeters(meters) {
  if (meters == null || !Number.isFinite(meters) || meters > MAX_BAND_METERS) return null;
  const miles = meters / MILE_METERS;
  if (miles < 1) return 'under_1_mi';
  if (miles < 1.5) return 'about_1_mi';
  if (miles < 2.5) return 'about_2_mi';
  if (miles < 3.75) return 'about_3_mi';
  return 'about_5_mi';
}

function distanceMeters(a, b) {
  if (!a || !b) return null;
  const values = [a.latitude, a.longitude, b.latitude, b.longitude].map(Number);
  if (values.some((v) => !Number.isFinite(v))) return null;
  return haversineMeters(values[0], values[1], values[2], values[3]);
}

/** Local wall-clock parts of an instant in a time zone. */
function localParts(instant, timeZone = DEFAULT_TIMEZONE) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** The instant of a local wall-clock time (y-m-d hh:mm) in a time zone. */
function zonedInstant(year, month, day, hour, minute, timeZone = DEFAULT_TIMEZONE) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (t) => {
    const p = localParts(new Date(t), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(t / 60000) * 60000;
  };
  let t = guess - offsetAt(guess);
  const second = offsetAt(t);
  if (guess - second !== t) t = guess - second;
  return new Date(t);
}

/** When to remind people who are in: 2 hours before, or 7 PM the evening before a plan starting before 10 AM. */
function reminderAt(startsAt, timeZone = DEFAULT_TIMEZONE) {
  const start = new Date(startsAt);
  const local = localParts(start, timeZone);
  // Date.UTC rolls day 0 back to the last day of the previous month.
  if (local.hour < 10) return zonedInstant(local.year, local.month, local.day - 1, 19, 0, timeZone);
  return new Date(start.getTime() - 2 * 60 * 60 * 1000);
}

/** morning | afternoon | evening | night, from the local start hour. */
function dayPart(startsAt, timeZone = DEFAULT_TIMEZONE) {
  const local = localParts(startsAt, timeZone);
  if (!local) return null;
  const { hour } = local;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** upcoming | live | ended | cancelled */
function planState(plan, startsAt, endsAt, now = Date.now()) {
  if (plan.status === 'cancelled') return 'cancelled';
  if (plan.status === 'ended') return 'ended';
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isFinite(end) && now >= end) return 'ended';
  if (Number.isFinite(start) && now >= start) return 'live';
  return 'upcoming';
}

/** The moment asking closes: the start, or 30 minutes before the end for pickup games and walks. */
function askingClosesAt(kind, startsAt, endsAt) {
  if (kind === 'pickup_game' || kind === 'walk_coffee') {
    return new Date(new Date(endsAt).getTime() - LIMITS.lateJoinCutoffMinutes * 60 * 1000);
  }
  return new Date(startsAt);
}

function isAskingOpen(plan, startsAt, endsAt, now = Date.now()) {
  if (plan.status !== 'open') return false;
  return now < askingClosesAt(plan.kind, startsAt, endsAt).getTime();
}

/** Seats taken by accepted requests: party sizes, or one per family at a playdate. */
function seatsFor(kind, partySize) {
  if (kind === 'playdate') return 1;
  const size = Number(partySize) || 1;
  return Math.min(Math.max(size, 1), 4);
}

function isFreshGps(gps, now = Date.now()) {
  if (!gps) return false;
  const lat = Number(gps.latitude);
  const lng = Number(gps.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const at = new Date(gps.timestamp).getTime();
  if (!Number.isFinite(at)) return false;
  // Allow a minute of clock skew into the future.
  return now - at <= GPS_MAX_AGE_MS && at - now <= 60 * 1000;
}

module.exports = {
  KINDS,
  AUTO_RULES,
  KIDS_AGE_BANDS,
  DISTANCE_BANDS,
  SPORTS,
  LEVELS,
  WALK_KINDS,
  PACES,
  WINDOWS,
  LIMITS,
  MILE_METERS,
  HOST_RADIUS_METERS,
  ASK_RADIUS_METERS,
  PLAYDATE_ASK_RADIUS_METERS,
  LIST_RADIUS_METERS,
  GPS_MAX_AGE_MS,
  HOME_GUARD_METERS,
  DEFAULT_TIMEZONE,
  distanceBandFromMeters,
  distanceMeters,
  localParts,
  zonedInstant,
  reminderAt,
  dayPart,
  planState,
  askingClosesAt,
  isAskingOpen,
  seatsFor,
  isFreshGps,
};

'use strict';

/**
 * Whether a public place is open during a plan, from its OpenStreetMap
 * `opening_hours` tag (the place picker, board H6): "Open until 11 PM",
 * "Closes at 2 PM", "Opens at 4 PM", "Closed on Sundays".
 *
 * Only the forms people actually write are read: weekdays and their ranges,
 * months and dates, times (past midnight too), sunrise, sunset, dawn and dusk
 * (with offsets), "off", "24/7" and open ends ("16:00+"). Anything else
 * (week numbers, nth weekdays, years, comments, fallback rules) answers null,
 * so the picker says nothing rather than something wrong. Rules for public or
 * school holidays alone are skipped: the picker doesn't know the holidays.
 */

const { DateTime } = require('luxon');

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENTS = ['sunrise', 'sunset', 'dawn', 'dusk'];
const DAY_MINUTES = 1440;
const MAX_SPEC_LENGTH = 255;

// ─── Reading the tag ───────────────────────────────────────────────────────

const TOKEN = /\s*(24\/7|"[^"]*"|\|\||\d{1,2}:\d{2}|\d+|[A-Za-z]+|[-,;+()[\]])/y;

function tokenize(text) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (!match) return text.slice(at).trim() ? null : tokens;
    tokens.push(match[1]);
  }
  return tokens;
}

const isDay = (token) => DAYS.includes(token);
const isHoliday = (token) => token === 'PH' || token === 'SH';
const isMonth = (token) => MONTHS.includes(token);
const isClock = (token) => /^\d{1,2}:\d{2}$/.test(token || '');
const isEvent = (token) => EVENTS.includes(token);
const startsTime = (token) => isClock(token) || isEvent(token) || token === '(';
const startsSelector = (token) => isDay(token) || isHoliday(token) || isMonth(token);

function clockMinutes(token) {
  const [h, m] = token.split(':').map(Number);
  if (h > 48 || m > 59) return null;
  return h * 60 + m;
}

/** "Apr", "Apr 15", "Apr-Oct", "Apr 15-Oct 15", "Dec 24-26": [{ from: {m, d}, to: {m, d} }]. */
function readMonths(tokens, at, rule) {
  let i = at;
  if (!isMonth(tokens[i])) return i;
  rule.months = [];
  for (;;) {
    const from = { m: MONTHS.indexOf(tokens[i]) + 1, d: null };
    i += 1;
    if (/^\d{1,2}$/.test(tokens[i] || '')) { from.d = Number(tokens[i]); i += 1; }
    let to = { m: from.m, d: from.d };
    if (tokens[i] === '-') {
      i += 1;
      if (isMonth(tokens[i])) {
        to = { m: MONTHS.indexOf(tokens[i]) + 1, d: null };
        i += 1;
        if (/^\d{1,2}$/.test(tokens[i] || '')) { to.d = Number(tokens[i]); i += 1; }
      } else if (/^\d{1,2}$/.test(tokens[i] || '') && from.d != null) {
        to = { m: from.m, d: Number(tokens[i]) };
        i += 1;
      } else {
        return -1;
      }
    }
    if ((from.d == null) !== (to.d == null)) return -1;
    rule.months.push({ from, to });
    if (tokens[i] === ',' && isMonth(tokens[i + 1])) { i += 1; continue; }
    return i;
  }
}

/** "Mo", "Mo-Fr", "Sa,Su", "Fr-Mo", "Mo-Fr,PH": a set of weekday indexes (0 = Monday). */
function readDays(tokens, at, rule) {
  let i = at;
  if (!isDay(tokens[i]) && !isHoliday(tokens[i])) return i;
  rule.days = new Set();
  let holidays = false;
  for (;;) {
    const token = tokens[i];
    if (isHoliday(token)) {
      holidays = true;
      i += 1;
    } else if (isDay(token)) {
      const from = DAYS.indexOf(token);
      i += 1;
      // "Mo[1]" (the first Monday) and the like are not read.
      if (tokens[i] === '[') return -1;
      let to = from;
      if (tokens[i] === '-' && isDay(tokens[i + 1])) {
        to = DAYS.indexOf(tokens[i + 1]);
        i += 2;
      }
      for (let d = from; ; d = (d + 1) % 7) {
        rule.days.add(d);
        if (d === to) break;
      }
    } else {
      return -1;
    }
    if (tokens[i] === ',' && (isDay(tokens[i + 1]) || isHoliday(tokens[i + 1]))) { i += 1; continue; }
    // Only holidays ("PH off"): a rule for days the picker can't tell apart.
    if (holidays && rule.days.size === 0) rule.holidaysOnly = true;
    return i;
  }
}

/** One time: "07:00", "sunset", "(sunset-01:00)" → { minutes } or { event, offset }. */
function readTime(tokens, at) {
  const token = tokens[at];
  if (isClock(token)) {
    const minutes = clockMinutes(token);
    return minutes == null ? null : { value: { minutes }, next: at + 1 };
  }
  if (isEvent(token)) return { value: { event: token, offset: 0 }, next: at + 1 };
  if (token === '(' && isEvent(tokens[at + 1]) && (tokens[at + 2] === '+' || tokens[at + 2] === '-')
    && isClock(tokens[at + 3]) && tokens[at + 4] === ')') {
    const offset = clockMinutes(tokens[at + 3]);
    if (offset == null) return null;
    return { value: { event: tokens[at + 1], offset: tokens[at + 2] === '-' ? -offset : offset }, next: at + 5 };
  }
  return null;
}

/** "07:00-12:00,13:00-18:00", "16:00-23:00+", "18:00+", "sunrise-sunset". */
function readTimes(tokens, at, rule) {
  let i = at;
  if (!startsTime(tokens[i])) return i;
  rule.times = [];
  for (;;) {
    const from = readTime(tokens, i);
    if (!from) return -1;
    i = from.next;
    let to = null;
    let openEnd = false;
    if (tokens[i] === '-') {
      const end = readTime(tokens, i + 1);
      if (!end) return -1;
      to = end.value;
      i = end.next;
    }
    if (tokens[i] === '+') { openEnd = true; i += 1; }
    if (!to && !openEnd) return -1;
    rule.times.push({ from: from.value, to, openEnd });
    if (tokens[i] === ',' && startsTime(tokens[i + 1])) { i += 1; continue; }
    return i;
  }
}

/**
 * The tag's rules in order, or null when it uses a form this reader doesn't
 * know. A rule after ";" replaces earlier rules for the days it names; one
 * after "," adds to them.
 */
function parse(spec) {
  const text = String(spec || '').trim();
  if (!text || text.length > MAX_SPEC_LENGTH) return null;
  const tokens = tokenize(text);
  if (!tokens || tokens.length === 0) return null;
  const rules = [];
  let additional = false;
  let i = 0;
  while (i < tokens.length) {
    const rule = { months: null, days: null, holidaysOnly: false, times: null, off: false, additional };
    if (tokens[i] === '24/7') {
      rule.times = [{ from: { minutes: 0 }, to: { minutes: DAY_MINUTES }, openEnd: false }];
      i += 1;
    } else {
      i = readMonths(tokens, i, rule);
      if (i < 0) return null;
      i = readDays(tokens, i, rule);
      if (i < 0) return null;
      i = readTimes(tokens, i, rule);
      if (i < 0) return null;
    }
    const word = String(tokens[i] || '').toLowerCase();
    if (word === 'off' || word === 'closed') {
      rule.off = true;
      i += 1;
    } else if (word === 'open') {
      i += 1;
    } else if (word === 'unknown' || word.startsWith('"')) {
      return null;
    }
    if (!rule.months && !rule.days && !rule.times && !rule.off) return null;
    // A day selector without times means open all day.
    if (!rule.times && !rule.off) rule.times = [{ from: { minutes: 0 }, to: { minutes: DAY_MINUTES }, openEnd: false }];
    rules.push(rule);
    if (i >= tokens.length) break;
    if (tokens[i] === ';') {
      additional = false;
    } else if (tokens[i] === ',' && startsSelector(tokens[i + 1])) {
      additional = true;
    } else {
      return null;
    }
    i += 1;
  }
  return rules.length ? rules : null;
}

// ─── Sunrise and sunset ────────────────────────────────────────────────────

const RAD = Math.PI / 180;

/**
 * Sunrise and sunset (or civil dawn and dusk) for a local day, as minutes
 * after that day's local midnight; null where the sun doesn't rise or set.
 * The standard solar equation, within a few minutes.
 */
function sunMinutes(day, latitude, longitude) {
  const noonUtc = Date.UTC(day.year, day.month - 1, day.day, 12);
  const n = Math.round(noonUtc / 86400000 + 2440587.5 - 2451545.0 + 0.0008);
  const meanSolarNoon = n - longitude / 360;
  const anomaly = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const center = 1.9148 * Math.sin(anomaly * RAD) + 0.02 * Math.sin(2 * anomaly * RAD) + 0.0003 * Math.sin(3 * anomaly * RAD);
  const eclipticLongitude = (anomaly + center + 180 + 102.9372) % 360;
  const transit = 2451545.0 + meanSolarNoon + 0.0053 * Math.sin(anomaly * RAD) - 0.0069 * Math.sin(2 * eclipticLongitude * RAD);
  const declination = Math.asin(Math.sin(eclipticLongitude * RAD) * Math.sin(23.4397 * RAD));
  const at = (elevation) => {
    const cos = (Math.sin(elevation * RAD) - Math.sin(latitude * RAD) * Math.sin(declination))
      / (Math.cos(latitude * RAD) * Math.cos(declination));
    if (cos < -1 || cos > 1) return null;
    const hourAngle = Math.acos(cos) / RAD;
    const toLocal = (julian) => {
      const local = DateTime.fromMillis((julian - 2440587.5) * 86400000, { zone: day.zone });
      return Math.round(local.diff(day.startOf('day'), 'minutes').minutes);
    };
    return { rise: toLocal(transit - hourAngle / 360), set: toLocal(transit + hourAngle / 360) };
  };
  const sun = at(-0.833);
  const civil = at(-6);
  return {
    sunrise: sun ? sun.rise : null,
    sunset: sun ? sun.set : null,
    dawn: civil ? civil.rise : null,
    dusk: civil ? civil.set : null,
  };
}

// ─── Evaluating a day ──────────────────────────────────────────────────────

function inMonths(rule, day) {
  if (!rule.months) return true;
  const here = day.month * 100 + day.day;
  return rule.months.some(({ from, to }) => {
    const start = from.m * 100 + (from.d ?? 1);
    const end = to.m * 100 + (to.d ?? 31);
    return start <= end ? here >= start && here <= end : here >= start || here <= end;
  });
}

function applies(rule, day) {
  if (rule.holidaysOnly) return false;
  if (rule.days && !rule.days.has(day.weekday - 1)) return false;
  return inMonths(rule, day);
}

/**
 * A day's open intervals as [from, to] minutes after its midnight (to may pass
 * 1440: open past midnight), each with how its ends were written. null when a
 * sunrise or sunset it needs doesn't happen that day.
 */
function intervalsOn(rules, day, place) {
  let intervals = null;
  let sun = null;
  const resolve = (time) => {
    if (time.minutes != null) return { minutes: time.minutes, event: null };
    sun = sun || sunMinutes(day, place.latitude, place.longitude);
    const base = sun[time.event];
    return base == null ? null : { minutes: base + time.offset, event: time.event };
  };
  for (const rule of rules) {
    if (!applies(rule, day)) continue;
    const times = [];
    if (!rule.off) {
      for (const span of rule.times) {
        const from = resolve(span.from);
        const to = span.to ? resolve(span.to) : null;
        if (!from || (span.to && !to)) return null;
        let end = to ? to.minutes : null;
        if (end != null && end <= from.minutes) end += DAY_MINUTES;
        times.push({ from: from.minutes, to: end, openEnd: span.openEnd, toEvent: to ? to.event : null });
      }
    }
    intervals = rule.additional && intervals ? intervals.concat(times) : times;
  }
  return intervals || [];
}

// ─── Words ─────────────────────────────────────────────────────────────────

/** 420 → "7 AM", 1110 → "6:30 PM", 0 → "midnight", 720 → "noon". */
function clock(minutes) {
  const m = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  if (m === 0) return 'midnight';
  if (m === 720) return 'noon';
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

function endWords(span) {
  if (span.toEvent === 'sunset' || span.toEvent === 'dusk') return `${span.toEvent} (${clock(span.to)})`;
  return clock(span.to);
}

/** A day's hours in a few words: "7 AM–2 PM", "11 AM–3 PM, 5–9 PM". */
function dayWords(spans) {
  return spans.slice(0, 2).map((span) => (span.to == null
    ? `from ${clock(span.from)}`
    : `${clock(span.from)}–${clock(span.to)}`)).join(', ');
}

// ─── The plan's time ───────────────────────────────────────────────────────

/**
 * Whether the place is open for the plan, in the place's own time zone.
 *
 * @param {string} spec           The place's opening_hours tag.
 * @param {object} p
 * @param {string|Date} p.startsAt
 * @param {string|Date} [p.endsAt]  Defaults to an hour after the start.
 * @param {string} p.timezone      The place's IANA time zone.
 * @param {number} p.latitude      For sunrise and sunset.
 * @param {number} p.longitude
 * @returns {{ status: 'open'|'closes_early'|'opens_late'|'closed', text: string }|null}
 */
function hoursDuring(spec, { startsAt, endsAt, timezone, latitude, longitude }) {
  const rules = parse(spec);
  if (!rules) return null;
  const start = DateTime.fromJSDate(new Date(startsAt), { zone: timezone });
  let end = endsAt ? DateTime.fromJSDate(new Date(endsAt), { zone: timezone }) : start.plus({ hours: 1 });
  if (!start.isValid || !end.isValid) return null;
  if (end <= start) end = start.plus({ hours: 1 });
  const day = start.startOf('day');
  const place = { latitude: Number(latitude), longitude: Number(longitude) };

  // The day before (open past midnight), the plan's day and the next day, on one line of minutes.
  const spans = [];
  for (const shift of [-1, 0, 1]) {
    const on = intervalsOn(rules, day.plus({ days: shift }), place);
    if (on == null) return null;
    for (const span of on) {
      spans.push({ ...span, from: span.from + shift * DAY_MINUTES, to: span.to == null ? null : span.to + shift * DAY_MINUTES });
    }
  }
  spans.sort((a, b) => a.from - b.from);
  const s = start.diff(day, 'minutes').minutes;
  const e = end.diff(day, 'minutes').minutes;

  // Join spans that touch ("10:00-14:00,14:00-18:00"), keeping the later end's words.
  const joined = [];
  for (const span of spans) {
    const last = joined[joined.length - 1];
    if (last && last.to != null && span.from <= last.to) {
      if (span.to == null || span.to > last.to) Object.assign(last, { to: span.to, openEnd: span.openEnd, toEvent: span.toEvent });
    } else {
      joined.push({ ...span });
    }
  }

  const covering = joined.find((span) => span.from <= s && (span.to == null || span.to > s));
  if (covering) {
    if (covering.to == null) return { status: 'open', text: `Open from ${clock(covering.from)}` };
    if (covering.to >= e) {
      if (covering.to >= s + DAY_MINUTES && covering.from <= s - DAY_MINUTES + 1) return { status: 'open', text: 'Open 24 hours' };
      return { status: 'open', text: `Open until ${endWords(covering)}${covering.openEnd ? ' or later' : ''}` };
    }
    // "16:00-23:00+": it may stay open past the plan's end; never call that closing early.
    if (covering.openEnd) return { status: 'open', text: `Open until ${endWords(covering)} or later` };
    return { status: 'closes_early', text: `Closes at ${endWords(covering)}` };
  }
  const later = joined.find((span) => span.from > s && span.from < e);
  if (later) return { status: 'opens_late', text: `Opens at ${clock(later.from)}` };

  // A night that runs past midnight belongs to the day it started.
  const startingThatDay = joined.filter((span) => span.from >= 0 && span.from < DAY_MINUTES);
  if (startingThatDay.length === 0) return { status: 'closed', text: `Closed ${dayName(day)}` };
  return { status: 'closed', text: `Closed then · open ${dayWords(startingThatDay)}` };
}

/** "today", "tomorrow" or "on Saturday": the plan's day as the host reads it. */
function dayName(day) {
  const today = DateTime.now().setZone(day.zone).startOf('day');
  const days = Math.round(day.diff(today, 'days').days);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `on ${DAY_NAMES[day.weekday - 1]}`;
}

module.exports = { parse, hoursDuring, sunMinutes, clock };

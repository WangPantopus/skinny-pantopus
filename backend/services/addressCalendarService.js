// ============================================================
// ADDRESS CALENDAR — what recurs at THIS address (Wedge Phase 2, D6)
//
// Expands the scoped rules in AddressCalendarRule (state → county → city
// → home; narrowest scope wins per kind) into the next two weeks of
// dated events for a home: garbage day, recycling, the property-tax
// dates, council meetings, burn bans, permit hearings…
//
// Recurrence is RFC 5545 (the `rrule` package). Dates are CALENDAR days
// anchored at noon UTC so DST never shifts "Tuesday" into "Monday night";
// the API returns `YYYY-MM-DD` strings plus `days_until` computed from the
// home's local date.
//
// Honesty rules the card relies on:
//   • `confidence` rides through untouched — an 'unverified' seed says so;
//   • `needs_pickup_day` is true while garbage/recycling still come from a
//     city default rather than the household's own pickup day.
// ============================================================

const crypto = require('crypto');
const { RRule } = require('rrule');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { resolveHomeTimezone } = require('../utils/timezone');

const WINDOW_DAYS = 14;
const SCOPE_RANK = { home: 0, city: 1, county: 2, state: 3 };
const PICKUP_KINDS = new Set(['garbage', 'recycling', 'yard_waste', 'bulk_pickup']);
const HOLIDAY_PICKUP_KINDS = PICKUP_KINDS;
const WEEKDAYS = { MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU };

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function noonUtc(isoDay) {
  return new Date(`${isoDay}T12:00:00.000Z`);
}

// Use the shared geographic timezone resolver; calendar dates remain date-only.
function localToday(home, now = new Date()) {
  const tz = resolveHomeTimezone(home);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return parts; // en-CA yields YYYY-MM-DD
  } catch {
    return isoDate(now);
  }
}

function scopeKeysFor(home) {
  const keys = [];
  const state = String(home.state || '').trim().toUpperCase();
  const city = String(home.city || '').trim();
  if (home.id) keys.push({ scope_type: 'home', scope_key: String(home.id) });
  if (state && city) keys.push({ scope_type: 'city', scope_key: `${state}:${city}` });
  if (state && home.county) keys.push({ scope_type: 'county', scope_key: `${state}:${String(home.county).trim()}` });
  if (state) keys.push({ scope_type: 'state', scope_key: state });
  return keys;
}

const RULE_COLUMNS = 'id, scope_type, scope_key, kind, title, detail, rrule, dtstart, until, all_day, lead_days, source, source_url, confidence, params';

async function loadRules(home) {
  const scopes = scopeKeysFor(home);
  if (!scopes.length) return [];
  const { data, error } = await supabaseAdmin
    .from('AddressCalendarRule')
    .select(RULE_COLUMNS)
    .in('scope_key', scopes.map((s) => s.scope_key));
  if (error) throw new Error(error.message);
  const wanted = new Set(scopes.map((s) => `${s.scope_type}|${s.scope_key}`));
  return (data || []).filter((r) => wanted.has(`${r.scope_type}|${r.scope_key}`));
}

// States where no statewide property-tax date exists: the town, city,
// county or school district sets it, so the calendar says where to look
// instead of inventing a date. Each line paraphrases its state's own
// statute or tax department (checked 2026-10-15):
//   AK Alaska Stat. 29.45.240 · IL 35 ILCS 200/21-15 · ME 36 M.R.S. § 505 ·
//   NH RSA 76:13, 76:15-a · NY Dept. of Taxation and Finance, property tax
//   bills · OH Ohio Rev. Code 323.12, 323.17 · PA 72 P.S. § 5511.10 ·
//   RI Gen. Laws § 44-5-7 · VA Code § 58.1-3916 · VT 32 V.S.A. § 4773.
const LOCAL_TAX_DATE_GUIDANCE = {
  AK: 'In Alaska, your borough or city sets its own property tax due dates — check your tax statement.',
  IL: 'In Illinois, each property tax installment is due on the date printed on your county tax bill.',
  ME: 'In Maine, each city or town sets its own property tax due dates — check your tax bill or town office.',
  NH: 'In New Hampshire, your town or city sets its property tax due dates — check your tax bill or town office.',
  NY: 'In New York, your school district and your town, city or county bill separately — check the due date on each bill.',
  OH: 'In Ohio, your county treasurer sets the property tax due dates — check your tax bill.',
  PA: 'In Pennsylvania, your county, municipality and school district bill separately — check each bill or your local tax collector.',
  RI: 'In Rhode Island, each city or town sets its own property tax due dates — check your tax bill or town hall.',
  VA: 'In Virginia, each county, city or town sets its own property tax due dates — check your tax bill or local treasurer.',
  VT: 'In Vermont, each town sets its own property tax due dates — check your tax bill or town office.',
};

function taxDateGuidance(state) {
  return LOCAL_TAX_DATE_GUIDANCE[String(state || '').trim().toUpperCase()] || null;
}

// County rules. Home has no county column, so the county comes from the
// home's coordinates (the cached Census lookup the Place sections share)
// and county rows are keyed `ST:<5-digit county FIPS>`, e.g. `NE:31055`
// (county names differ between sources; FIPS codes don't). Best effort:
// without coordinates or a lookup there are simply no county rules.
async function loadCountyRules(home) {
  const state = String((home && home.state) || '').trim().toUpperCase();
  if (!state) return [];
  try {
    // Lazy: the adapters module is large and only this lookup needs it.
    const fips = await require('./placeSectionAdapters').homeCountyFips(home);
    if (!fips) return [];
    const { data, error } = await supabaseAdmin
      .from('AddressCalendarRule')
      .select(RULE_COLUMNS)
      .eq('scope_type', 'county')
      .eq('scope_key', `${state}:${fips}`);
    if (error) throw new Error(error.message);
    return data || [];
  } catch (err) {
    logger.warn('addressCalendar: county rules unavailable', { homeId: home.id, error: err.message });
    return [];
  }
}

// Narrowest scope wins per kind: a household's pickup day replaces the
// city default; a city council rule replaces a county one, etc.
function applyPrecedence(rules) {
  const bestRank = new Map();
  for (const r of rules) {
    const rank = SCOPE_RANK[r.scope_type];
    if (rank === undefined) continue;
    const cur = bestRank.get(r.kind);
    if (cur === undefined || rank < cur) bestRank.set(r.kind, rank);
  }
  return rules.filter((r) => SCOPE_RANK[r.scope_type] === bestRank.get(r.kind));
}

function expandRule(rule, fromDay, toDay, { holidays = [], moved = new Map() } = {}) {
  let options;
  try {
    options = RRule.parseString(rule.rrule);
  } catch (err) {
    logger.warn('addressCalendar: bad rrule skipped', { ruleId: rule.id, rrule: rule.rrule, error: err.message });
    return [];
  }
  const dtstart = noonUtc(String(rule.dtstart).slice(0, 10));
  const rr = new RRule({ ...options, dtstart, until: rule.until ? noonUtc(String(rule.until).slice(0, 10)) : options.until });
  // Resolve each ORIGINAL occurrence once. Overlapping holiday rows cannot
  // create two shifted dates, and an incoming shifted date survives even when
  // a regular occurrence on that date moves again.
  const applicable = [];
  if (HOLIDAY_PICKUP_KINDS.has(rule.kind)) {
    for (const holiday of holidays) {
      const params = holiday.params;
      if (holiday.scope_type !== 'city' || holiday.confidence !== 'official'
        || !params || !Array.isArray(params.kinds) || !params.kinds.includes(rule.kind)
        || typeof params.holiday !== 'string' || !params.holiday.trim()
        || !Number.isSafeInteger(params.shift_days) || params.shift_days < 1 || params.shift_days > 7) continue;
      const lookback = isoDate(new Date(noonUtc(fromDay).getTime() - 13 * 86400000));
      for (const day of expandRule(holiday, lookback, toDay)) {
        const start = noonUtc(day);
        const end = params.through === 'holiday' ? start : new Date(start.getTime() + (6 - start.getUTCDay()) * 86400000);
        applicable.push({ start, end, params, id: String(holiday.id) });
      }
    }
  }
  // Most recent applicable holiday wins; ties have stable precedence.
  applicable.sort((a, b) => b.start - a.start || a.id.localeCompare(b.id));
  const from = noonUtc(fromDay);
  const to = noonUtc(toDay);
  const lookback = new Date(from.getTime() - 7 * 86400000);
  const days = new Set();
  for (const original of rr.between(lookback, to, true)) {
    const holiday = applicable.find(h => original >= h.start && original <= h.end);
    const actual = holiday ? new Date(original.getTime() + holiday.params.shift_days * 86400000) : original;
    if (actual < from || actual > to) continue;
    const day = isoDate(actual);
    days.add(day);
    if (holiday) moved.set(day, { moved_from: isoDate(original), holiday: holiday.params.holiday, shift_days: holiday.params.shift_days });
  }
  return [...days].sort();
}

function daysBetween(fromDay, toDay) {
  return Math.round((noonUtc(toDay).getTime() - noonUtc(fromDay).getTime()) / 86400000);
}

// The household schedule a calendar shows. Every save replaces the household's
// pickup rules (new ids) and a reset removes them, so their ids identify it. A
// save that sends this back is refused if the schedule changed meanwhile. Must
// match SQL home_pickup_schedule_version: md5 of the ids in uuid order.
function pickupScheduleVersion(rules, homeId) {
  const ids = rules
    .filter((r) => r.scope_type === 'home' && String(r.scope_key) === String(homeId) && PICKUP_KINDS.has(r.kind))
    .map((r) => String(r.id).toLowerCase())
    .sort();
  return ids.length ? crypto.createHash('md5').update(ids.join(',')).digest('hex') : 'none';
}

/**
 * The address calendar for a home.
 * @returns {Promise<{upcoming: object[], next: object|null, needs_pickup_day: boolean, pickup_version: string, window_days: number, rule_count: number}>}
 */
async function composeForHome(home, { now = new Date(), windowDays = WINDOW_DAYS, rules: suppliedRules = null } = {}) {
  const today = localToday(home, now);
  const end = isoDate(new Date(noonUtc(today).getTime() + windowDays * 86400000));
  const base = suppliedRules || await loadRules(home);
  const baseIds = new Set(base.map((r) => r.id));
  const loaded = [...base, ...(await loadCountyRules(home)).filter((r) => !baseIds.has(r.id))];
  const hasHouseholdPickup = loaded.some((r) => r.scope_type === 'home' && PICKUP_KINDS.has(r.kind));
  // Once the household sets its schedule, unknown pickup kinds must not
  // silently fall back to a guessed city week (including briefing signals).
  const rules = applyPrecedence(loaded.filter((r) =>
    !hasHouseholdPickup || !PICKUP_KINDS.has(r.kind) || r.scope_type === 'home'));
  const holidays = rules.filter((r) => r.kind === 'pickup_holiday');

  const upcoming = [];
  for (const rule of rules) {
    const moved = new Map();
    for (const day of expandRule(rule, today, end, { holidays, moved })) {
      upcoming.push({
        rule_id: rule.id,
        kind: rule.kind,
        title: rule.title,
        detail: rule.detail || null,
        date: day,
        days_until: daysBetween(today, day),
        all_day: rule.all_day !== false,
        lead_days: rule.lead_days ?? 1,
        scope: rule.scope_type,
        source: rule.source || null,
        source_url: rule.source_url || null,
        confidence: rule.confidence === 'official' ? 'official' : 'unverified',
        ...moved.get(day),
      });
    }
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]));
  // Belt and braces under migration 198's unique index: two rules that say
  // the same thing on the same day are one line on the card, never two.
  const seen = new Set();
  const deduped = upcoming.filter((e) => {
    const key = `${e.kind}|${e.date}|${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  upcoming.length = 0;
  upcoming.push(...deduped);

  const garbage = rules.find((r) => r.scope_type === 'home' && r.kind === 'garbage');
  const recycling = rules.find((r) => r.scope_type === 'home' && r.kind === 'recycling');
  const collections = rules.filter(r => r.scope_type === 'home' && PICKUP_KINDS.has(r.kind)).map(collectionFromRule);
  const pickupSchedule = collections.length ? {
    weekday: /BYDAY=([A-Z]{2})/.exec(garbage?.rrule || '')?.[1] || null,
    recycling_frequency: recycling ? (/INTERVAL=2(?:;|$)/.test(recycling.rrule) ? 'biweekly' : 'weekly') : 'not_set',
    // The editor saves a recurring weekday/week, not a holiday exception.
    // Only upcoming moves; feeding its shifted date back would move every week.
    recycling_next_date: recycling ? expandRule(recycling, today, end)[0] || null : null,
    collections,
  } : null;

  return {
    homeId: home.id || null,
    upcoming,
    next: upcoming[0] || null,
    needs_pickup_day: !hasHouseholdPickup,
    pickup_schedule: pickupSchedule,
    pickup_version: pickupScheduleVersion(loaded, home.id),
    window_days: windowDays,
    rule_count: rules.length,
    today,
    // No property-tax rule here and the state sets none: say where the
    // dates are set instead of showing nothing (or an invented date).
    tax_note: rules.some((r) => r.kind === 'property_tax') ? null : taxDateGuidance(home.state),
  };
}

// Compose the caller's calendar for a home id. Used by the briefing
// orchestrator (Hub Today, morning/evening briefings). It reads through the
// same authorized pickup context as GET /api/homes/:id/calendar: household
// rules are calendar data, so a caller without calendar access gets an error
// (the orchestrator then shows no calendar). The old direct read also named
// Home.county/timezone, which do not exist, so it never returned a calendar.
async function composeForHomeId(homeId, { userId, ...options } = {}) {
  const { home, rules } = await getPickupContext(homeId, userId);
  return composeForHome(home, { ...options, rules });
}

// ── Resident override: "my pickup day is Thursday" ──────────
// Garbage is weekly. Recycling needs a known frequency AND next date;
// a weekday alone cannot establish the alternating week or even its day.
function invalidPickup(message) {
  return Object.assign(new Error(message), { code: 'INVALID_PICKUP' });
}

const COLLECTION_TITLES = { garbage: 'Garbage day', recycling: 'Recycling day', yard_waste: 'Yard waste collection', bulk_pickup: 'Bulk collection' };
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// One existing row per collection kind; BYDAY holds multiple weekly days.
// The stored DTSTART is the recurrence anchor, never a holiday-shifted date.
function collectionFromRule(rule) {
  const options = RRule.parseString(rule.rrule);
  return {
    kind: rule.kind,
    frequency: options.count === 1 ? 'once' : options.freq === RRule.MONTHLY ? 'monthly' : 'weekly',
    interval: options.interval || 1,
    weekdays: (rule.rrule.match(/(?:^|;)BYDAY=([^;]+)/)?.[1] || '').split(',').filter(day => WEEKDAYS[day]),
    anchor_date: String(rule.dtstart).slice(0, 10),
    monthly_mode: options.freq === RRule.MONTHLY && options.byweekday ? 'weekday' : 'day_of_month',
    until_date: rule.until ? String(rule.until).slice(0, 10) : null,
  };
}

function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(noonUtc(value).getTime()) && isoDate(noonUtc(value)) === value;
}

async function setPickupSchedule(home, { collections, userId, expectedVersion = null }) {
  if (!Array.isArray(collections) || collections.length < 1 || collections.length > 4) {
    throw invalidPickup('Choose at least one collection type, or clear the household schedule.');
  }
  const seen = new Set();
  const rows = collections.map(collection => {
    const { kind, frequency, anchor_date: anchor, until_date: until = null, monthly_mode: mode = 'day_of_month', interval = 1 } = collection;
    if (!PICKUP_KINDS.has(kind) || seen.has(kind)) throw invalidPickup('Choose each collection type only once.');
    seen.add(kind);
    if (!validDay(anchor) || (until != null && (!validDay(until) || until < anchor))) {
      throw invalidPickup('Use valid collection dates. The end date cannot precede the start date.');
    }
    if (!Number.isInteger(interval) || interval < 1 || interval > (frequency === 'monthly' ? 12 : 4)) {
      throw invalidPickup('Choose a weekly interval from 1 to 4 or a monthly interval from 1 to 12.');
    }
    const date = noonUtc(anchor);
    let rrule;
    if (frequency === 'weekly') {
      const days = collection.weekdays;
      if (!Array.isArray(days) || !days.length || days.length > 7 || days.some(day => !WEEKDAYS[day])
        || new Set(days).size !== days.length || !days.includes(DAY_CODES[date.getUTCDay()])) {
        throw invalidPickup('Choose collection days and a start date on one of those days.');
      }
      const ordered = Object.keys(WEEKDAYS).filter(day => days.includes(day));
      rrule = `FREQ=WEEKLY;INTERVAL=${interval};WKST=MO;BYDAY=${ordered.join(',')}`;
    } else if (frequency === 'monthly') {
      if (!['day_of_month', 'weekday'].includes(mode)) throw invalidPickup('Choose a monthly collection pattern.');
      // A fifth weekday is represented as the last weekday, so every month has an occurrence.
      const ordinal = Math.ceil(date.getUTCDate() / 7);
      const pattern = mode === 'weekday' ? `BYDAY=${ordinal === 5 ? -1 : ordinal}${DAY_CODES[date.getUTCDay()]}` : `BYMONTHDAY=${date.getUTCDate()}`;
      rrule = `FREQ=MONTHLY;INTERVAL=${interval};${pattern}`;
    } else if (frequency === 'once' && interval === 1) {
      rrule = 'FREQ=DAILY;COUNT=1';
    } else throw invalidPickup('Choose weekly, monthly, or one-time collection.');
    return {
      kind, title: COLLECTION_TITLES[kind], detail: 'On the schedule your household set. Check your provider for holiday changes.',
      rrule, dtstart: anchor, until, all_day: true, lead_days: 1,
      source: 'Set by your household', source_url: null, confidence: 'official', created_by: userId,
    };
  });
  await pickupMutation(home.id, userId, rows, expectedVersion);
  return { rules: rows.length };
}

async function setPickupDay(home, { weekday, recyclingFrequency = 'not_set', recyclingNextDate = null, userId = null, expectedVersion = null, now = new Date() }) {
  const wd = String(weekday || '').toUpperCase();
  if (!WEEKDAYS[wd]) throw invalidPickup('weekday must be one of MO TU WE TH FR SA SU');
  if (!['not_set', 'weekly', 'biweekly'].includes(recyclingFrequency)) throw invalidPickup('Choose a recycling frequency.');
  const today = localToday(home, now);
  if (recyclingFrequency !== 'not_set') {
    const date = typeof recyclingNextDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recyclingNextDate) ? noonUtc(recyclingNextDate) : null;
    if (!date || !Number.isFinite(date.getTime()) || isoDate(date) !== recyclingNextDate) {
      throw invalidPickup('Choose a valid next recycling pickup date.');
    }
    const days = daysBetween(today, recyclingNextDate);
    if (days < 0 || days >= (recyclingFrequency === 'weekly' ? 7 : 14)) {
      throw invalidPickup(`Choose the next recycling pickup within ${recyclingFrequency === 'weekly' ? 7 : 14} days, including today.`);
    }
  } else if (recyclingNextDate != null) {
    throw invalidPickup('Choose a recycling frequency for this date.');
  }
  // Preserve an unchanged rule's anchor: its original day may have passed
  // while a holiday-shifted pickup is still pending. Advancing DTSTART then
  // would silently remove that pickup when the household saves the editor.
  const { rules: currentRules } = await getPickupContext(home.id, userId);
  const householdRules = currentRules.filter(rule => rule.scope_type === 'home' && String(rule.scope_key) === String(home.id));
  // Older clients cannot represent these schedules. Refuse a lossy replacement.
  if (householdRules.some(rule => PICKUP_KINDS.has(rule.kind) && (
    ['yard_waste', 'bulk_pickup'].includes(rule.kind) || !/^FREQ=WEEKLY(?:;|$)/.test(rule.rrule)
    || (rule.rrule.match(/BYDAY=([^;]+)/)?.[1] || '').includes(',') || rule.until
    || ![1, 2].includes(RRule.parseString(rule.rrule).interval || 1)
    || (rule.kind === 'garbage' && (RRule.parseString(rule.rrule).interval || 1) !== 1)
  ))) throw invalidPickup('This schedule has additional collection settings. Open the pickup schedule editor in an updated app.');
  const currentGarbage = householdRules.find(rule => rule.kind === 'garbage');
  const currentRecycling = householdRules.find(rule => rule.kind === 'recycling');
  const unchangedGarbage = /BYDAY=([A-Z]{2})/.exec(currentGarbage?.rrule || '')?.[1] === wd;
  const currentFrequency = currentRecycling
    ? (/INTERVAL=2(?:;|$)/.test(currentRecycling.rrule) ? 'biweekly' : 'weekly') : 'not_set';
  const end = isoDate(new Date(noonUtc(today).getTime() + WINDOW_DAYS * 86400000));
  const unchangedRecycling = currentRecycling && recyclingFrequency === currentFrequency
    && recyclingNextDate === expandRule(currentRecycling, today, end)[0];
  // Changed rules start at the next occurrence chosen by the household.
  const anchor = new RRule({ freq: RRule.WEEKLY, byweekday: [WEEKDAYS[wd]], dtstart: noonUtc(today) }).after(noonUtc(today), true);
  const dtstart = unchangedGarbage ? String(currentGarbage.dtstart).slice(0, 10) : isoDate(anchor);
  const base = {
    scope_type: 'home',
    scope_key: String(home.id),
    dtstart,
    all_day: true,
    lead_days: 1,
    source: 'Set by your household',
    source_url: null,
    confidence: 'official',
    created_by: userId,
    updated_at: new Date(now).toISOString(),
  };
  const rows = [
    { ...base, kind: 'garbage', title: 'Garbage day', detail: 'Bins out the night before.', rrule: `FREQ=WEEKLY;BYDAY=${wd}` },
  ];
  if (recyclingFrequency !== 'not_set') {
    const recyclingDay = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][noonUtc(recyclingNextDate).getUTCDay()];
    rows.push({
      ...base, dtstart: unchangedRecycling ? String(currentRecycling.dtstart).slice(0, 10) : recyclingNextDate, kind: 'recycling', title: 'Recycling day',
      detail: recyclingFrequency === 'biweekly' ? 'Every other week, on the schedule your household set.' : 'Weekly, on the schedule your household set.',
      rrule: `FREQ=WEEKLY;INTERVAL=${recyclingFrequency === 'biweekly' ? 2 : 1};BYDAY=${recyclingDay}`,
    });
  }
  await pickupMutation(home.id, userId, rows.map(({ scope_type: _scopeType, scope_key: _scopeKey, ...rest }) => rest), expectedVersion);
  return { weekday: wd, dtstart, rules: rows.length };
}

function pickupError(denied = false) {
  return Object.assign(new Error(denied ? 'Not authorized to access this pickup calendar.' : 'Could not check the pickup calendar. Please retry.'), {
    code: denied ? 'HOME_ACCESS_DENIED' : 'HOME_ACCESS_UNAVAILABLE', statusCode: denied ? 403 : 503,
  });
}

async function pickupRpc(name, args) {
  let result;
  try { result = await supabaseAdmin.rpc(name, args); } catch (_) { throw pickupError(); }
  if (result.error || !result.data) throw pickupError();
  if (result.data.allowed !== true) throw pickupError(true);
  return result.data;
}

async function getPickupContext(homeId, userId) {
  const context = await pickupRpc('get_home_pickup_calendar', { p_home_id: homeId, p_user_id: userId });
  if (context.home?.id !== homeId || !Array.isArray(context.rules)) throw pickupError();
  return context;
}

function pickupChanged() {
  return Object.assign(new Error('The pickup schedule changed since you opened it. Review the current schedule and try again.'), {
    code: 'PICKUP_SCHEDULE_CHANGED', statusCode: 409,
  });
}

// With an expected version (the schedule the form loaded), nothing is written
// if another save or reset landed meanwhile. Without one, older clients keep
// the last-write-wins save.
async function pickupMutation(homeId, userId, rows, expectedVersion = null) {
  if (!userId) throw pickupError(true);
  if (expectedVersion == null) {
    return pickupRpc('mutate_home_pickup_calendar', { p_home_id: homeId, p_user_id: userId, p_rows: rows });
  }
  const result = await pickupRpc('mutate_home_pickup_calendar_if_unchanged', {
    p_home_id: homeId, p_user_id: userId, p_rows: rows, p_expected_version: expectedVersion,
  });
  if (result.changed === true) throw pickupChanged();
  return result;
}

async function clearPickupDay(home, userId, expectedVersion = null) {
  await pickupMutation(home.id, userId, null, expectedVersion);
  return true;
}

module.exports = {
  composeForHome,
  getPickupContext,
  composeForHomeId,
  setPickupDay,
  setPickupSchedule,
  clearPickupDay,
  // Exported for unit tests.
  applyPrecedence,
  expandRule,
  scopeKeysFor,
  localToday,
  taxDateGuidance,
  WINDOW_DAYS,
};

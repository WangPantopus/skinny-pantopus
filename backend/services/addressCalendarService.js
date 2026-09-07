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

const { RRule } = require('rrule');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const WINDOW_DAYS = 14;
const SCOPE_RANK = { home: 0, city: 1, county: 2, state: 3 };
const PICKUP_KINDS = new Set(['garbage', 'recycling', 'yard_waste']);
const WEEKDAYS = { MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU };

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function noonUtc(isoDay) {
  return new Date(`${isoDay}T12:00:00.000Z`);
}

// The home's "today" as a calendar date. Homes carry no timezone column
// yet; Pacific is the launch geography and the safe default.
function localToday(home, now = new Date()) {
  const tz = (home && home.timezone) || 'America/Los_Angeles';
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

async function loadRules(home) {
  const scopes = scopeKeysFor(home);
  if (!scopes.length) return [];
  const { data, error } = await supabaseAdmin
    .from('AddressCalendarRule')
    .select('id, scope_type, scope_key, kind, title, detail, rrule, dtstart, until, all_day, lead_days, source, source_url, confidence')
    .in('scope_key', scopes.map((s) => s.scope_key));
  if (error) throw new Error(error.message);
  const wanted = new Set(scopes.map((s) => `${s.scope_type}|${s.scope_key}`));
  return (data || []).filter((r) => wanted.has(`${r.scope_type}|${r.scope_key}`));
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

function expandRule(rule, fromDay, toDay) {
  let options;
  try {
    options = RRule.parseString(rule.rrule);
  } catch (err) {
    logger.warn('addressCalendar: bad rrule skipped', { ruleId: rule.id, rrule: rule.rrule, error: err.message });
    return [];
  }
  const dtstart = noonUtc(String(rule.dtstart).slice(0, 10));
  const rr = new RRule({ ...options, dtstart, until: rule.until ? noonUtc(String(rule.until).slice(0, 10)) : options.until });
  // Occurrences from the window start (inclusive) to its end (inclusive).
  const from = noonUtc(fromDay);
  const to = noonUtc(toDay);
  return rr.between(from, to, true).map(isoDate);
}

function daysBetween(fromDay, toDay) {
  return Math.round((noonUtc(toDay).getTime() - noonUtc(fromDay).getTime()) / 86400000);
}

/**
 * The address calendar for a home.
 * @returns {Promise<{upcoming: object[], next: object|null, needs_pickup_day: boolean, window_days: number, rule_count: number}>}
 */
async function composeForHome(home, { now = new Date(), windowDays = WINDOW_DAYS } = {}) {
  const today = localToday(home, now);
  const end = isoDate(new Date(noonUtc(today).getTime() + windowDays * 86400000));
  const loaded = await loadRules(home);
  const hasHouseholdPickup = loaded.some((r) => r.scope_type === 'home' && r.kind === 'garbage');
  // Once the household sets its schedule, unknown pickup kinds must not
  // silently fall back to a guessed city week (including briefing signals).
  const rules = applyPrecedence(loaded.filter((r) =>
    !hasHouseholdPickup || !PICKUP_KINDS.has(r.kind) || r.scope_type === 'home'));

  const upcoming = [];
  for (const rule of rules) {
    for (const day of expandRule(rule, today, end)) {
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
  const pickupSchedule = garbage ? {
    weekday: /BYDAY=([A-Z]{2})/.exec(garbage.rrule)?.[1] || null,
    recycling_frequency: recycling ? (/INTERVAL=2(?:;|$)/.test(recycling.rrule) ? 'biweekly' : 'weekly') : 'not_set',
    recycling_next_date: recycling ? expandRule(recycling, today, end)[0] || null : null,
  } : null;

  return {
    upcoming,
    next: upcoming[0] || null,
    needs_pickup_day: !garbage,
    pickup_schedule: pickupSchedule,
    window_days: windowDays,
    rule_count: rules.length,
    today,
  };
}

// Load the home row the calendar needs, then compose. Used by the
// briefing orchestrator, which only holds a home id.
async function composeForHomeId(homeId, options = {}) {
  const { data: home, error } = await supabaseAdmin
    .from('Home')
    .select('id, city, state, county, timezone')
    .eq('id', homeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!home) return null;
  return composeForHome(home, options);
}

// ── Resident override: "my pickup day is Thursday" ──────────
// Garbage is weekly. Recycling needs a known frequency AND next date;
// a weekday alone cannot establish the alternating week or even its day.
function invalidPickup(message) {
  return Object.assign(new Error(message), { code: 'INVALID_PICKUP' });
}

async function setPickupDay(home, { weekday, recyclingFrequency = 'not_set', recyclingNextDate = null, userId = null, now = new Date() }) {
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
  // Anchor: the next occurrence of that weekday on or after today.
  const anchor = new RRule({ freq: RRule.WEEKLY, byweekday: [WEEKDAYS[wd]], dtstart: noonUtc(today) }).after(noonUtc(today), true);
  const dtstart = isoDate(anchor);
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
      ...base, dtstart: recyclingNextDate, kind: 'recycling', title: 'Recycling day',
      detail: recyclingFrequency === 'biweekly' ? 'Every other week, on the schedule your household set.' : 'Weekly, on the schedule your household set.',
      rrule: `FREQ=WEEKLY;INTERVAL=${recyclingFrequency === 'biweekly' ? 2 : 1};BYDAY=${recyclingDay}`,
    });
  }
  // The uniqueness index on (scope_key, kind) is partial (WHERE scope_type =
  // 'home'), and PostgREST cannot express the predicate in ON CONFLICT, so an
  // upsert against it fails to resolve its conflict target. A delete then an
  // insert would leave the household with no reminders if the insert failed.
  // `set_home_pickup_rules` (migration 199) swaps the rules in one
  // transaction: either the new pair lands or nothing changes.
  const { error } = await supabaseAdmin.rpc('set_home_pickup_rules', {
    p_home_id: String(home.id),
    p_rows: rows.map(({ scope_type: _scopeType, scope_key: _scopeKey, ...rest }) => rest),
  });
  if (error) throw new Error(error.message);
  return { weekday: wd, dtstart, rules: rows.length };
}

async function clearPickupDay(home) {
  const { error } = await supabaseAdmin
    .from('AddressCalendarRule')
    .delete()
    .eq('scope_type', 'home')
    .eq('scope_key', String(home.id))
    .in('kind', ['garbage', 'recycling', 'yard_waste']);
  if (error) throw new Error(error.message);
  return true;
}

module.exports = {
  composeForHome,
  composeForHomeId,
  setPickupDay,
  clearPickupDay,
  // Exported for unit tests.
  applyPrecedence,
  expandRule,
  scopeKeysFor,
  localToday,
  WINDOW_DAYS,
};

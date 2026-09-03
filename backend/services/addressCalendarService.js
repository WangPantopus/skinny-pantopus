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
  const rules = applyPrecedence(await loadRules(home));

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

  const needsPickupDay = rules.some((r) => PICKUP_KINDS.has(r.kind) && r.scope_type !== 'home');

  return {
    upcoming,
    next: upcoming[0] || null,
    needs_pickup_day: needsPickupDay,
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
// Writes a home-scoped weekly garbage rule and a biweekly recycling rule
// anchored to the next pickup, replacing the city defaults for that home.
async function setPickupDay(home, { weekday, recyclingEveryOtherWeek = true, userId = null, now = new Date() }) {
  const wd = String(weekday || '').toUpperCase().slice(0, 2);
  if (!WEEKDAYS[wd]) throw new Error('weekday must be one of MO TU WE TH FR SA SU');
  const today = localToday(home, now);
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
  if (recyclingEveryOtherWeek) {
    rows.push({ ...base, kind: 'recycling', title: 'Recycling day', detail: 'Every other week, with the garbage.', rrule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${wd}` });
  } else {
    rows.push({ ...base, kind: 'recycling', title: 'Recycling day', detail: 'Weekly, with the garbage.', rrule: `FREQ=WEEKLY;BYDAY=${wd}` });
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

// ============================================================
// BALLOT REFERENCE DATA — dated election facts, reviewed by a person
//
// Loads and validates backend/data/ballot/{states,elections}.json
// (docs/ballot-implementation-plan-2026-09-24.md §5.1). These are reference
// data that change by election, not by user, so they live in versioned
// files instead of a table. Display labels are never identifiers: every
// deadline carries a stable `key`.
//
// Dates are CALENDAR days in the state's timezone. A file that fails
// validation disables Ballot (every lookup returns null) rather than
// showing an unchecked date; tests assert the shipped files are valid.
// ============================================================

const logger = require('../../utils/logger');

const STATES_DOC = require('../../data/ballot/states.json');
const ELECTIONS_DOC = require('../../data/ballot/elections.json');

const PHASES = ['far', 'in_season', 'election_day', 'after'];
const COVERAGE = ['supported', 'links_only'];
const WINDOW_DAYS = 120;
const IN_SEASON_DAYS = 60;
const AFTER_DAYS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isHttps(value) {
  return typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value);
}

function isTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateLinks(links, where, errors) {
  if (!Array.isArray(links) || links.length === 0) {
    errors.push(`${where}: official_links must be a non-empty array`);
    return;
  }
  const keys = new Set();
  links.forEach((link, i) => {
    const at = `${where}.official_links[${i}]`;
    for (const field of ['key', 'label', 'owner']) {
      if (typeof link[field] !== 'string' || !link[field].trim()) errors.push(`${at}: ${field} is required`);
    }
    if (!isHttps(link.url)) errors.push(`${at}: url must be https`);
    if (!Array.isArray(link.phases) || !link.phases.length || link.phases.some((p) => !PHASES.includes(p))) {
      errors.push(`${at}: phases must list ${PHASES.join('|')}`);
    }
    const id = `${link.key}|${(link.phases || []).join(',')}`;
    if (keys.has(id)) errors.push(`${at}: duplicate link ${link.key}`);
    keys.add(id);
  });
}

/**
 * Validate both reference documents. Returns a list of problems; empty
 * means the files are safe to serve.
 */
function validateReferenceData(statesDoc = STATES_DOC, electionsDoc = ELECTIONS_DOC) {
  const errors = [];
  const states = (statesDoc && statesDoc.states) || {};
  if (!Object.keys(states).length) errors.push('states.json: no states');

  const linksOnly = statesDoc && statesDoc.links_only;
  if (!linksOnly) errors.push('states.json: links_only block is required');
  else {
    validateLinks(linksOnly.official_links, 'links_only', errors);
    if (typeof linksOnly.note !== 'string' || !linksOnly.note) errors.push('links_only: note is required');
    if (typeof linksOnly.source_line !== 'string' || !linksOnly.source_line) errors.push('links_only: source_line is required');
  }

  for (const [abbr, entry] of Object.entries(states)) {
    const at = `states.${abbr}`;
    if (!/^[A-Z]{2}$/.test(abbr)) errors.push(`${at}: key must be a two-letter state code`);
    if (typeof entry.name !== 'string' || !entry.name) errors.push(`${at}: name is required`);
    if (!isTimezone(entry.timezone)) errors.push(`${at}: timezone ${entry.timezone} is not valid`);
    if (!COVERAGE.includes(entry.coverage)) errors.push(`${at}: coverage must be ${COVERAGE.join('|')}`);
    if (entry.coverage === 'supported') {
      if (!['all_mail', 'mail_or_in_person', 'in_person_with_absentee'].includes(entry.voting_method)) {
        errors.push(`${at}: voting_method is required for a supported state`);
      }
      if (typeof entry.election_office !== 'string' || !entry.election_office) errors.push(`${at}: election_office is required`);
      if (entry.election_office_phrase != null && (typeof entry.election_office_phrase !== 'string' || !entry.election_office_phrase)) {
        errors.push(`${at}: election_office_phrase must be text`);
      }
      validateLinks(entry.official_links, at, errors);
      for (const [geoid, county] of Object.entries(entry.counties || {})) {
        if (!/^\d{5}$/.test(geoid)) errors.push(`${at}.counties.${geoid}: key must be a 5-digit county GEOID`);
        if (typeof county.name !== 'string' || !county.name) errors.push(`${at}.counties.${geoid}: name is required`);
        if (typeof county.election_office !== 'string' || !county.election_office) {
          errors.push(`${at}.counties.${geoid}: election_office is required`);
        }
        validateLinks(county.official_links, `${at}.counties.${geoid}`, errors);
      }
      if (!entry.checked || !isIsoDate(entry.checked.at)) errors.push(`${at}: checked.at date is required`);
    }
  }

  const elections = (electionsDoc && electionsDoc.elections) || [];
  if (!elections.length) errors.push('elections.json: no elections');
  const ids = new Set();
  for (const election of elections) {
    const at = `elections.${election.id}`;
    if (typeof election.id !== 'string' || !election.id) errors.push('elections: id is required');
    if (ids.has(election.id)) errors.push(`${at}: duplicate id`);
    ids.add(election.id);
    if (!isIsoDate(election.date)) errors.push(`${at}: date must be YYYY-MM-DD`);
    if (typeof election.name !== 'string' || !election.name) errors.push(`${at}: name is required`);
    if (election.applies_to !== 'all_states' && !Array.isArray(election.applies_to)) {
      errors.push(`${at}: applies_to must be "all_states" or a list of states`);
    }
    if (!isHttps(election.source_url)) errors.push(`${at}: source_url must be https`);
    for (const [abbr, block] of Object.entries(election.states || {})) {
      const bat = `${at}.states.${abbr}`;
      if (!states[abbr]) errors.push(`${bat}: unknown state`);
      else if (states[abbr].coverage !== 'supported') errors.push(`${bat}: only supported states carry deadlines`);
      if (typeof block.how_it_works !== 'string' || !block.how_it_works) errors.push(`${bat}: how_it_works is required`);
      const keys = new Set();
      for (const d of block.deadlines || []) {
        const dat = `${bat}.deadlines.${d.key}`;
        if (typeof d.key !== 'string' || !/^[a-z_]+$/.test(d.key)) errors.push(`${bat}: deadline key must be snake_case`);
        if (keys.has(d.key)) errors.push(`${dat}: duplicate key`);
        keys.add(d.key);
        if (typeof d.label !== 'string' || !d.label) errors.push(`${dat}: label is required`);
        if (!isIsoDate(d.date)) errors.push(`${dat}: date must be YYYY-MM-DD`);
        else if (isIsoDate(election.date) && d.date > election.date) errors.push(`${dat}: falls after the election`);
        if (d.time_local != null && !HHMM.test(d.time_local)) errors.push(`${dat}: time_local must be HH:MM`);
        if (typeof d.cutoff !== 'string' || !d.cutoff) errors.push(`${dat}: cutoff is required`);
        if (typeof d.needs_action !== 'boolean') errors.push(`${dat}: needs_action must be a boolean`);
        if (typeof d.timeline !== 'boolean') errors.push(`${dat}: timeline must be a boolean`);
        if (!isHttps(d.source_url)) errors.push(`${dat}: source_url must be https`);
        if (d.law_url != null && !isHttps(d.law_url)) errors.push(`${dat}: law_url must be https`);
      }
      // A state with no registration deadline (register any day, including
      // Election Day) says so explicitly rather than leaving it out.
      if (block.no_registration_deadline != null && typeof block.no_registration_deadline !== 'boolean') {
        errors.push(`${bat}: no_registration_deadline must be a boolean`);
      }
      if (block.no_registration_deadline === true) {
        if (keys.has('register_online_mail')) errors.push(`${bat}: no_registration_deadline contradicts register_online_mail`);
      } else if (!keys.has('register_online_mail')) {
        errors.push(`${bat}: register_online_mail is required`);
      }
      if (!keys.has('return_by')) errors.push(`${bat}: return_by is required`);
      if (!block.election_day_notice || typeof block.election_day_notice.lead !== 'string' || !block.election_day_notice.lead) {
        errors.push(`${bat}: election_day_notice.lead is required`);
      }
      if (block.far_note != null && (typeof block.far_note !== 'string' || !block.far_note)) errors.push(`${bat}: far_note must be text`);
      if (block.mover_text !== undefined && block.mover_text !== null && (typeof block.mover_text !== 'string' || !block.mover_text)) {
        errors.push(`${bat}: mover_text must be text or null`);
      }
      for (const field of ['title_before', 'title_after']) {
        const value = block.ballot_week && block.ballot_week[field];
        if (value != null && (typeof value !== 'string' || !value)) errors.push(`${bat}: ballot_week.${field} must be text`);
      }
      // Certification keeps the card through the count (plan §11 item 7).
      const cert = block.certification;
      if (cert != null) {
        const cat = `${bat}.certification`;
        if (!isIsoDate(cert.local_date)) errors.push(`${cat}: local_date must be YYYY-MM-DD`);
        else if (isIsoDate(election.date) && cert.local_date <= election.date) errors.push(`${cat}: local_date must fall after the election`);
        if (!isIsoDate(cert.hide_after)) errors.push(`${cat}: hide_after must be YYYY-MM-DD`);
        else if (isIsoDate(cert.local_date) && cert.hide_after < cert.local_date) errors.push(`${cat}: hide_after must not precede local_date`);
        if (!['on', 'by'].includes(cert.local_date_is)) errors.push(`${cat}: local_date_is must be on|by`);
        if (typeof cert.certifier !== 'string' || !cert.certifier) errors.push(`${cat}: certifier is required`);
        if (!isHttps(cert.source_url)) errors.push(`${cat}: source_url must be https`);
      }
    }
  }
  return errors;
}

const LOAD_ERRORS = validateReferenceData();
if (LOAD_ERRORS.length) {
  logger.error('ballot: reference data failed validation — Ballot is disabled', { errors: LOAD_ERRORS.slice(0, 10) });
}

function isAvailable() {
  return LOAD_ERRORS.length === 0;
}

// Homes store the two-letter code; tolerate a full state name too.
function stateCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (STATES_DOC.states[upper]) return upper;
  const byName = Object.entries(STATES_DOC.states).find(([, s]) => s.name.toLowerCase() === raw.toLowerCase());
  return byName ? byName[0] : null;
}

function stateEntry(value) {
  const code = stateCode(value);
  return code ? { code, ...STATES_DOC.states[code] } : null;
}

function linksOnlyDefaults() {
  return STATES_DOC.links_only;
}

// The state's local calendar date, YYYY-MM-DD.
function localDate(timezone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

// The state's local wall-clock time, HH:MM (24-hour).
function localTime(timezone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    return parts.replace(/[^\d:]/g, '');
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T12:00:00.000Z`);
  const to = Date.parse(`${toIso}T12:00:00.000Z`);
  return Math.round((to - from) / 86400000);
}

// "2026-10-16" → "Oct 16" (calendar date; no timezone shift).
function monthDay(iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function phaseFor(daysUntil, afterDays = AFTER_DAYS) {
  if (daysUntil > WINDOW_DAYS) return null;
  if (daysUntil > IN_SEASON_DAYS) return 'far';
  if (daysUntil > 0) return 'in_season';
  if (daysUntil === 0) return 'election_day';
  if (daysUntil >= -afterDays) return 'after';
  return null;
}

function electionAppliesTo(election, code) {
  if (election.applies_to === 'all_states') return true;
  return Array.isArray(election.applies_to) && election.applies_to.includes(code);
}

// How long a supported state's card stays after the election: through its
// checked certification (`hide_after`), else the seven-day default.
function afterDaysFor(election, state) {
  if (state.coverage !== 'supported') return AFTER_DAYS;
  const block = election.states && election.states[state.code];
  const cert = block && block.certification;
  return cert && isIsoDate(cert.hide_after) ? daysBetween(election.date, cert.hide_after) : AFTER_DAYS;
}

/**
 * The election this state's card is about: the earliest one from its
 * after-election window (seven days, or through certification) to 120
 * days ahead. Returns null outside that window — the caller then keeps
 * its pre-Ballot behavior rather than claiming "no election".
 */
function currentElection(value, { now = new Date() } = {}) {
  if (!isAvailable()) return null;
  const state = stateEntry(value);
  if (!state) return null;
  const today = localDate(state.timezone, now);
  const candidates = ELECTIONS_DOC.elections
    .filter((e) => electionAppliesTo(e, state.code))
    .map((e) => ({ election: e, daysUntil: daysBetween(today, e.date), afterDays: afterDaysFor(e, state) }))
    .filter(({ daysUntil, afterDays }) => phaseFor(daysUntil, afterDays) !== null)
    .sort((a, b) => a.election.date.localeCompare(b.election.date));
  if (!candidates.length) return null;
  const { election, daysUntil, afterDays } = candidates[0];
  const block = (election.states && election.states[state.code]) || null;
  return {
    state,
    election,
    block: state.coverage === 'supported' ? block : null,
    today,
    daysUntil,
    phase: phaseFor(daysUntil, afterDays),
  };
}

module.exports = {
  validateReferenceData,
  isAvailable,
  stateCode,
  stateEntry,
  linksOnlyDefaults,
  localDate,
  localTime,
  daysBetween,
  monthDay,
  phaseFor,
  currentElection,
  PHASES,
  WINDOW_DAYS,
  IN_SEASON_DAYS,
  AFTER_DAYS,
};

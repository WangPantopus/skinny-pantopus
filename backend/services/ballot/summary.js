// ============================================================
// BALLOT SUMMARY (P0) — what the "Your ballot" card and the /start
// teaser show, composed on the server so every client renders the same
// words (docs/ballot-implementation-plan-2026-09-24.md §5.2–5.3, §6).
//
// Honesty rules the clients rely on:
//   • coverage is 'supported' (person-checked dates and links) or
//     'links_only' (the election date and an official link). Missing data
//     never becomes "no election" or "nothing this year";
//   • a government count is always a minimum ("at least N") in P0, and
//     `on_ballot` is true only where it is certain (every U.S. House seat
//     is on the 2026 general ballot) and null everywhere else;
//   • copy that would need data P0 does not have (decision counts,
//     "nothing this year", a personal delivery date) is never produced.
// ============================================================

const referenceData = require('./referenceData');
const governments = require('./governments');

const MOVER_WINDOW_DAYS = 365;
const MAX_LINKS = 3;

// Link order per phase, by key. County links (drop boxes, county results)
// come before generic state pages once a county is known.
const LINK_PRIORITY = {
  far: ['registration', 'election_information'],
  in_season: ['registration', 'ballot_tracking', 'drop_boxes', 'election_information'],
  election_day: ['drop_boxes', 'polling_places', 'ballot_tracking', 'election_information'],
  after: ['results'],
  // While counting continues, a voter can still check (and cure) a ballot.
  after_counting: ['results', 'ballot_tracking'],
};

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function chipFor(phase, daysUntil) {
  if (phase === 'election_day') return 'Today';
  if (phase === 'far' || phase === 'in_season') return plural(daysUntil, 'day', 'days');
  return null;
}

function pickLinks(phase, stateLinks, countyLinks, orderKey = phase) {
  const inPhase = (links) => (links || []).filter((l) => Array.isArray(l.phases) && l.phases.includes(phase));
  const county = inPhase(countyLinks);
  const state = inPhase(stateLinks);
  const order = LINK_PRIORITY[orderKey] || [];
  const picked = [];
  for (const key of order) {
    // A county link wins over a state link with the same key.
    const link = county.find((l) => l.key === key) || state.find((l) => l.key === key);
    if (link) picked.push({ key: link.key, label: link.label, owner: link.owner, url: link.url });
    if (picked.length === MAX_LINKS) break;
  }
  return picked;
}

function deadlinesFor(block, today, timezone) {
  return (block.deadlines || [])
    .map((d) => ({
      key: d.key,
      label: d.label,
      date: d.date,
      month_day: referenceData.monthDay(d.date),
      time_local: d.time_local || null,
      timezone,
      days_until: referenceData.daysBetween(today, d.date),
      needs_action: d.needs_action,
      timeline: d.timeline,
      cutoff: d.cutoff,
      detail: d.detail || null,
      source: d.source,
      source_url: d.source_url,
      teaser_lead: d.teaser_lead || null,
      teaser_detail: d.teaser_detail || null,
    }))
    .filter((d) => d.days_until >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.timeline === b.timeline ? 0 : a.timeline ? -1 : 1));
}

// "The United States, the state, Clark County, the Camas School District
// and the City of Camas." — the still view's body line.
function governmentsSentence(items) {
  const names = items.map((item) => {
    if (item.level === 'federal') return 'the United States';
    if (item.level === 'state') return 'the state';
    if (item.level === 'city') return `the ${item.name}`;
    if (item.level === 'school' && /school district/i.test(item.name)) return `the ${item.name}`;
    return item.name;
  });
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
}

// `federalOnBallot`: a federal general election puts every U.S. House seat
// on the ballot; any other election (or none) leaves every item unknown.
function governmentsBlock(result, { federalOnBallot = false } = {}) {
  if (!result || !Array.isArray(result.items) || result.items.length < 3) return null;
  const items = result.items.map((item) => ({
    level: item.level,
    geoid: item.geoid,
    name: item.name,
    on_ballot: federalOnBallot && item.level === 'federal' ? true : null,
  }));
  return {
    count: items.length,
    count_is_minimum: true,
    items,
    summary: governmentsSentence(items),
    caveat: 'Special districts, like fire, port and library districts, are not counted yet.',
    source_line: 'Boundaries: Census Bureau · Special districts are not counted yet',
  };
}

function countLine(block, subject) {
  if (!block) return null;
  const n = block.count_is_minimum ? `at least ${block.count}` : String(block.count);
  return `${subject} sits inside ${n} governments.`;
}

// After Election Day (Board: P0 after): "counting" through the day local
// results are certified (boards meet during that day), then "certified"
// until the card leaves. Null where no certification dates are checked;
// that state keeps the plain after card.
function afterStageFor(cert, today) {
  if (!cert) return null;
  return today <= cert.local_date ? 'counting' : 'certified';
}

function capitalize(text) {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// "Results can change until Clark County Elections certifies them on Nov 24."
// A known county office names itself; otherwise the state's certifier
// ("your county").
function afterNote(stage, cert, county) {
  const who = (county && county.election_office) || cert.certifier;
  const when = `${cert.local_date_is} ${referenceData.monthDay(cert.local_date)}`;
  if (stage === 'counting') return `Ballots are still being counted. Results can change until ${who} certifies them ${when}.`;
  return `${capitalize(who)} certified the results ${when}.`;
}

/**
 * Pure composition — everything the P0 surfaces need for one state on
 * one day. `governmentsResult` comes from governments.js (or null);
 * `moveInDate` is Home.move_in_date (or null).
 */
function composeSummary({ stateValue, countyGeoid = null, governmentsResult = null, moveInDate = null, now = new Date() }) {
  const current = referenceData.currentElection(stateValue, { now });
  if (!current) return null;
  const { state, election, block, today, daysUntil } = current;
  const supported = state.coverage === 'supported' && Boolean(block);
  let { phase } = current;
  // Once the return deadline has passed on Election Day evening, the card
  // stops saying "return by 8 p.m. today" and points at the results.
  if (phase === 'election_day' && supported) {
    const returnBy = (block.deadlines || []).find((d) => d.key === 'return_by');
    if (returnBy && returnBy.time_local && referenceData.localTime(state.timezone, now) >= returnBy.time_local) phase = 'after';
  }

  const base = {
    // The pre-Ballot contract, unchanged.
    name: election.name,
    date: election.date,
    days_until: Math.max(0, daysUntil),
    polling_place: null,
    ballot: [],
    // Ballot P0.
    election_id: election.id,
    coverage: supported ? 'supported' : 'links_only',
    phase,
    state: state.code,
    state_name: state.name,
    today,
    title: phase === 'election_day' ? 'Election Day' : 'Your ballot',
    subtitle: election.name,
    chip: chipFor(phase, daysUntil),
  };

  if (!supported) {
    // Links only: the election date and the official link. No count, no
    // deadlines, and no card at all once the election has passed.
    if (phase === 'after') return null;
    const defaults = referenceData.linksOnlyDefaults();
    return {
      ...base,
      line: null,
      note: defaults.note,
      how_it_works: null,
      voting_method: null,
      deadlines: [],
      election_day_notice: null,
      primary_action: null,
      official_links: pickLinksOnly(phase, defaults.official_links),
      governments: null,
      ballot_week: { show: false },
      mover_prompt: null,
      source_line: defaults.source_line,
      checked_at: null,
    };
  }

  const county = countyGeoid && state.counties ? state.counties[countyGeoid] : null;
  const deadlines = deadlinesFor(block, today, state.timezone);
  const govBlock = governmentsBlock(governmentsResult, { federalOnBallot: election.applies_to === 'all_states' });
  const registration = deadlines.find((d) => d.key === 'register_online_mail') || null;
  const cert = block.certification || null;
  const afterStage = phase === 'after' ? afterStageFor(cert, today) : null;

  // A state whose deadline isn't "online or by mail" words its own far note.
  let note = null;
  if (phase === 'far') {
    if (block.far_note) note = block.far_note;
    else if (registration) note = `Registration deadline: ${registration.month_day}, online or by mail.`;
  }
  if (afterStage) {
    note = afterNote(afterStage, cert, county);
  } else if (phase === 'after') {
    // In a sentence a state office takes "the" ("the Oregon Secretary of
    // State"); a county office's own name reads as it is.
    const office = (county && county.election_office) || state.election_office_phrase || state.election_office;
    note = `Results are published by ${office}. Pantopus doesn’t show results.`;
  }

  return {
    ...base,
    chip: afterStage === 'counting' ? 'Counting' : base.chip,
    after_stage: afterStage,
    line: phase === 'in_season' ? countLine(govBlock, 'This address') : null,
    note,
    how_it_works: phase === 'in_season' ? block.how_it_works : null,
    voting_method: state.voting_method,
    deadlines: phase === 'after' ? [] : deadlines,
    election_day_notice: phase === 'election_day' ? block.election_day_notice : null,
    primary_action: phase === 'in_season' && govBlock ? { kind: 'governments', label: 'See your governments' } : null,
    official_links: pickLinks(phase, state.official_links, county && county.official_links, afterStage === 'counting' ? 'after_counting' : phase),
    governments: govBlock,
    ballot_week: ballotWeekFor(block, deadlines, phase, today),
    mover_prompt: moverPrompt({ moveInDate, registration, today, links: state.official_links, text: block.mover_text }),
    source_line: state.election_office,
    checked_at: (block.checked && block.checked.at) || (state.checked && state.checked.at) || null,
  };
}

function pickLinksOnly(phase, links) {
  return (links || [])
    .filter((l) => l.phases.includes(phase))
    .slice(0, MAX_LINKS)
    .map((l) => ({ key: l.key, label: l.label, owner: l.owner, url: l.url }));
}

// Today's "Ballot week" card: from the day before ballots are mailed
// through Election Day. Never a personal delivery claim — only the
// county's legal mailing date.
function ballotWeekFor(block, deadlines, phase, today) {
  const week = block.ballot_week || {};
  if (phase === 'election_day') {
    return { show: true, overline: 'Ballot week', title: week.election_day_title, body: week.election_day_body };
  }
  if (phase !== 'in_season') return { show: false };
  const mailed = (block.deadlines || []).find((d) => d.key === 'ballots_mailed');
  if (!mailed) return { show: false };
  const untilMailed = referenceData.daysBetween(today, mailed.date);
  if (untilMailed > 1) return { show: false };
  const md = referenceData.monthDay(mailed.date);
  // States that mail "starting" a date, not "by" one, word their own titles.
  return {
    show: true,
    overline: 'Ballot week',
    title: untilMailed >= 0 ? week.title_before || `Ballots go out by ${md}` : week.title_after || `Ballots were mailed by ${md}`,
    body: week.body,
  };
}

// "Moved this year?" — only when the home's own move-in date (entered by
// the household) is within a year and online/mail registration is still
// open. Worded as a question: Pantopus never knows anyone's registration.
// A state's `mover_text` replaces the sentence; null turns the line off
// where one deadline can't be stated simply.
function moverPrompt({ moveInDate, registration, today, links, text }) {
  if (text === null) return null;
  if (!moveInDate || !registration) return null;
  const moved = String(moveInDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moved)) return null;
  const sinceMove = referenceData.daysBetween(moved, today);
  if (sinceMove < 0 || sinceMove > MOVER_WINDOW_DAYS) return null;
  if (registration.days_until < 0) return null;
  const link = (links || []).find((l) => l.key === 'registration');
  return {
    text: text || `Moved this year? Update your registration online by ${registration.month_day}.`,
    days_left: registration.days_until,
    url: link ? link.url : null,
  };
}

/** The Place card summary for a saved home (null ⇒ keep pre-Ballot behavior). */
async function summaryForHome(home, { now = new Date() } = {}) {
  if (!home) return null;
  const current = referenceData.currentElection(home.state, { now });
  if (!current) return null;
  const supported = current.state.coverage === 'supported' && Boolean(current.block);
  const govResult = supported ? await governments.governmentsForHome(home) : null;
  return composeSummary({
    stateValue: home.state,
    countyGeoid: govResult ? govResult.county_geoid : null,
    governmentsResult: govResult,
    moveInDate: home.move_in_date || null,
    now,
  });
}

/**
 * The anonymous /start teaser for a point. Coordinates only; the
 * geocoder call is live and nothing is written.
 */
async function teaserForPoint({ lat, lng, state }, { now = new Date() } = {}) {
  const current = referenceData.currentElection(state, { now });
  if (!current || current.phase === 'after') return null;
  const supported = current.state.coverage === 'supported' && Boolean(current.block);

  if (!supported) {
    const defaults = referenceData.linksOnlyDefaults();
    const link = pickLinksOnly(current.phase, defaults.official_links)[0] || null;
    return {
      coverage: 'links_only',
      state: current.state.code,
      election: { id: current.election.id, name: current.election.name, date: current.election.date, days_until: Math.max(0, current.daysUntil) },
      headline: `The general election is ${longMonthDay(current.election.date)}.`,
      note: defaults.note,
      next_deadline: null,
      governments: null,
      primary_action: link ? { kind: 'link', label: 'Check your registration', url: link.url } : null,
      source_line: `${defaults.source_line} · Registration and deadlines: Vote.gov`,
    };
  }

  const govResult = await governments.governmentsForPoint(lat, lng);
  const summary = composeSummary({
    stateValue: state,
    countyGeoid: govResult ? govResult.county_geoid : null,
    governmentsResult: govResult,
    now,
  });
  if (!summary) return null;
  const next = summary.deadlines.find((d) => d.needs_action && d.teaser_lead) || null;
  return {
    coverage: 'supported',
    state: summary.state,
    election: { id: summary.election_id, name: summary.name, date: summary.date, days_until: summary.days_until },
    headline: summary.governments
      ? countLine(summary.governments, 'Your address')
      : `The general election is ${longMonthDay(summary.date)}.`,
    note: null,
    next_deadline: next ? { key: next.key, lead: next.teaser_lead, days_left: next.days_until, detail: next.teaser_detail } : null,
    governments: summary.governments
      ? {
          count: summary.governments.count,
          count_is_minimum: summary.governments.count_is_minimum,
          items: summary.governments.items.map(({ level, name }) => ({ level, name })),
          summary: summary.governments.summary,
          caveat: summary.governments.caveat,
          source_line: summary.governments.source_line,
        }
      : null,
    primary_action: summary.governments ? { kind: 'governments', label: 'See your governments' } : null,
    source_line: summary.governments
      ? `Dates: ${summary.source_line} · Boundaries: Census Bureau`
      : `Dates: ${summary.source_line}`,
  };
}

const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longMonthDay(iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  return `${LONG_MONTHS[m - 1]} ${d}`;
}

/**
 * The governments view's data for the Civic page, all year (plan §11 item
 * 7): the card's block for a home in a supported state. With no election
 * in view, nothing is marked as on the ballot.
 */
async function civicGovernmentsForHome(home) {
  if (!home || !referenceData.isAvailable()) return null;
  const state = referenceData.stateEntry(home.state);
  if (!state || state.coverage !== 'supported') return null;
  return governmentsBlock(await governments.governmentsForHome(home));
}

module.exports = {
  composeSummary,
  summaryForHome,
  teaserForPoint,
  civicGovernmentsForHome,
  // Exported for unit tests.
  pickLinks,
  governmentsSentence,
  ballotWeekFor,
  moverPrompt,
};

// ============================================================
// BALLOT LIVE RESULTS — the official count for the races at an address,
// read from the state's own results site while ballots are counted
// (docs/product/ballot-live-results-plan-2026-11-03.md, Step 1).
//
// Washington (results.votewa.gov) and Utah (electionresults.utah.gov)
// publish every county's count on the same results software. A timer
// reads a site's small election summary every few seconds and its
// results data whenever the published version changes, so a card request
// never waits on the state's site: it reads the last count kept in memory.
// The site's cache serves copies up to 60 seconds old; nothing here can be
// fresher than that.
//
// Honesty rules the card relies on:
//   • only numbers read from the state's site, with the state's own publish
//     time; never "won", "leading" or "projected";
//   • a race shows only when the address's district number matches it
//     exactly, in the same state; statewide measures and Washington's
//     Supreme Court seats are on every ballot;
//   • "no votes counted yet" only from a read that saw none, and a count
//     that could not be re-checked for STALE_AFTER_MS is not shown at all;
//   • the count never steps back to one the state posted earlier.
// ============================================================

const logger = require('../../utils/logger');

// The states whose results Pantopus reads: the site's own JSON API (the
// one its public results page loads), the state's name in it, and how its
// contests name the races a card shows. Washington and Utah run the same
// results software; Washington groups its contests, Utah only names them.
const SOURCES = {
  WA: { api: 'https://results.votewa.gov/results/public/api', jurisdiction: 'washington', fips: '53', classify: classifyByGroup },
  UT: { api: 'https://electionresults.utah.gov/results/public/api', jurisdiction: 'Utah', fips: '49', classify: classifyByName },
};

const FAST_MS = 5_000; // election night (the election's own date, local time)
const SLOW_MS = 15_000; // the counting days after it
const IDLE_STOP_MS = 10 * 60_000; // no card has asked for this long: stop reading
const FRESH_MS = 60_000; // a card waits for a new read when the last one is older
const WAIT_MS = 1_500; // ...but never longer than this
const STALE_AFTER_MS = 15 * 60_000; // past this without a read, show no count
const SUMMARY_TIMEOUT_MS = 4_000;
const DATA_TIMEOUT_MS = 10_000;
const LOG_EVERY_MS = 60_000;
const USER_AGENT = 'Pantopus/1.0 (+https://pantopus.com)';

const readers = new Map();

function covers(stateCode) {
  return Boolean(SOURCES[stateCode]);
}

// Local checks only, never in production: BALLOT_RESULTS_ELECTION_ID reads
// another election on the same site (the August primary's real counts), and
// BALLOT_RESULTS_API another address (an unreachable one shows the fallback).
function sourceFor(stateCode, electionDate) {
  const source = SOURCES[stateCode];
  if (!source || !/^\d{4}-\d\d-\d\d$/.test(String(electionDate || ''))) return null;
  const local = process.env.NODE_ENV !== 'production';
  const api = (local && process.env.BALLOT_RESULTS_API) || source.api;
  // Otherwise the site's own id for the election, found by its date.
  const electionId = (local && process.env.BALLOT_RESULTS_ELECTION_ID) || null;
  if (electionId && !/^\w+$/.test(electionId)) return null;
  return {
    key: `${stateCode}:${electionDate}:${electionId || ''}:${api}`,
    api,
    jurisdiction: source.jurisdiction,
    fips: source.fips,
    classify: source.classify,
    electionDate,
    electionId,
  };
}

// The site lists its elections with their dates ("20261103" in
// Washington, "General11032026" in Utah).
async function electionIdFor(reader) {
  if (reader.electionId) return reader.electionId;
  const { api, jurisdiction, electionDate } = reader.source;
  const info = await getJson(`${api}/jurisdictions/${encodeURIComponent(jurisdiction)}`, SUMMARY_TIMEOUT_MS);
  const elections = info && Array.isArray(info.elections) ? info.elections : [];
  const match = elections.find((e) => e && String(e.electionDate || '').slice(0, 10) === electionDate);
  if (!match || typeof match.publicElectionId !== 'string' || !/^\w+$/.test(match.publicElectionId)) {
    throw new Error('the election is not on the results site');
  }
  reader.electionId = match.publicElectionId;
  return reader.electionId;
}

// The site's text fields are lists of translations.
function textOf(value) {
  if (Array.isArray(value)) {
    const entry = value.find((t) => t && t.languageId === 'en') || value[0];
    return entry && typeof entry.text === 'string' ? entry.text.trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

async function getJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// "Initiative Measure No. IP26-645" → "Initiative IP26-645".
function measureLabel(name) {
  return name.replace(/^Initiative Measure No\.?\s*/i, 'Initiative ');
}

// A race the card can show. `label` names it in a text line ("U.S. House,
// District 3"); `title` and `qualifier` are the same name in two parts for
// apps that draw the count ("U.S. House" · "District 3").
function race(kind, district, title, qualifier, label = qualifier ? `${title}, ${qualifier}` : title) {
  return { kind, district, title, qualifier, label };
}

// Washington groups its contests: "State Measures", "U.S. Congressional
// Representative" ("Congressional District 3 - U.S. Representative"),
// "Legislative" ("Legislative District 17 - State Representative Pos. 1")
// and "Judicial" ("Supreme Court - Justice Position #01"). Supreme Court
// seats are statewide; the other courts' districts aren't known here, so
// they stay on the official page.
function classifyByGroup(name, heading) {
  if (/^State Measures$/i.test(heading)) return race('measure', null, measureLabel(name), null);
  if (/^Judicial$/i.test(heading)) {
    const seat = /^Supreme Court\b.*\bPosition\s*#?\s*(\d+)/i.exec(name);
    if (!seat) return null;
    const position = `Position ${Number(seat[1])}`;
    return race('supreme_court', null, 'Supreme Court', position, `State Supreme Court, ${position}`);
  }
  if (/^U\.S\. Congressional Representative$/i.test(heading)) {
    const district = /Congressional District (\d+)/i.exec(name);
    return district ? race('house', String(Number(district[1])), 'U.S. House', `District ${Number(district[1])}`) : null;
  }
  if (/^Legislative$/i.test(heading)) {
    const district = /Legislative District (\d+)/i.exec(name);
    const position = /State Representative,?\s*Pos(?:ition|\.)?\s*(\d+)/i.exec(name);
    if (district && /State Senator/i.test(name)) {
      return race('state_senate', String(Number(district[1])), 'State Senate', `District ${Number(district[1])}`);
    }
    if (district && position) {
      return race('state_house', String(Number(district[1])), 'State House', `District ${Number(district[1])}, Position ${Number(position[1])}`);
    }
  }
  return null;
}

// Utah names them alone: "U.S. House District 3", "State Senate District 12
// (Multi-County)", "State House District 7" and "Constitutional Amendment A".
// Judicial retention and school board races stay on the official page.
function classifyByName(name) {
  const house = /^U\.S\. House District (\d+)\b/i.exec(name);
  if (house) return race('house', String(Number(house[1])), 'U.S. House', `District ${Number(house[1])}`);
  const senate = /^State Senate District (\d+)\b/i.exec(name);
  if (senate) return race('state_senate', String(Number(senate[1])), 'State Senate', `District ${Number(senate[1])}`);
  const stateHouse = /^State House District (\d+)\b/i.exec(name);
  if (stateHouse) return race('state_house', String(Number(stateHouse[1])), 'State House', `District ${Number(stateHouse[1])}`);
  if (/^Constitutional Amendment [A-Z]{1,2}$/i.test(name)) return race('measure', null, name, null);
  return null;
}

/**
 * The races a card can show, from the site's results data: statewide
 * measures, Washington's Supreme Court seats, U.S. House seats and
 * legislative seats, each with its district number. Every other contest
 * stays on the official results page.
 */
function racesFrom(data, classify = classifyByGroup) {
  const election = data && data.election;
  const items = data && data.ballotItems;
  if (!election || !Array.isArray(election.contestGroups) || !Array.isArray(items)) {
    throw new Error('unexpected results data');
  }
  const headingOf = new Map(election.contestGroups.map((g) => [g && g.id, textOf(g && g.groupHeading)]));
  const races = [];
  items.forEach((item, order) => {
    const heading = headingOf.get(item && item.contestGroupId) || '';
    const name = textOf(item && item.name);
    const options = item && item.summaryResults && item.summaryResults.ballotOptions;
    if (!name || !Array.isArray(options) || !options.length) return;
    const race = classify(name, heading);
    if (!race) return;
    const rows = options.map((o) => {
      const optionName = textOf(o && o.name);
      return {
        name: optionName,
        votes: Number(o && o.voteCount) || 0,
        writeIn: Boolean(o && o.isWriteIn) || /^write-?in$/i.test(optionName),
      };
    });
    // The site's own total: every option's votes, write-ins included.
    const total = rows.reduce((sum, row) => sum + row.votes, 0);
    races.push({ ...race, order, total, options: rows.filter((row) => row.name && !row.writeIn) });
  });
  return races;
}

// True when the site posted `iso` before `than`; false when either time is
// missing or unreadable.
function postedBefore(iso, than) {
  const at = Date.parse(iso);
  const thanAt = Date.parse(than);
  return Number.isFinite(at) && Number.isFinite(thanAt) && at < thanAt;
}

async function refresh(reader) {
  if (reader.inflight) return reader.inflight;
  reader.inflight = (async () => {
    const { api, jurisdiction, classify } = reader.source;
    const electionId = await electionIdFor(reader);
    const base = `${api}/elections/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(electionId)}`;
    const summary = await getJson(base, SUMMARY_TIMEOUT_MS);
    const version = summary && typeof summary.publishVersionId === 'string' ? summary.publishVersionId : null;
    if (!version) throw new Error('unexpected results summary');
    // While new counts come in, the site's cache hands out older copies
    // beside the newest for minutes at a time, even one from before any votes
    // (election night 2026: Washington's 8:03 p.m. copy came back after its
    // first votes). A copy posted before the count kept is skipped, so the
    // card never steps back; a correction comes as a new posting.
    const kept = reader.snapshot;
    if (kept && (kept.version === version || postedBefore(summary.publishDate, kept.postedAt))) {
      kept.checkedAt = Date.now();
      return;
    }
    const data = await getJson(`${base}/data`, DATA_TIMEOUT_MS);
    const races = racesFrom(data, classify);
    // The data names the version it holds. The site caches each address on
    // its own, so the data can lag the summary for up to a minute; keeping
    // the data's own version reads it again on the next tick until they agree.
    const dataVersion = typeof data.election.publishVersionId === 'string' ? data.election.publishVersionId : version;
    const postedAt = data.election.publishDate || summary.publishDate || null;
    if (kept && postedBefore(postedAt, kept.postedAt)) {
      kept.checkedAt = Date.now();
      return;
    }
    reader.snapshot = { version: dataVersion, postedAt, races, checkedAt: Date.now() };
  })()
    .catch((err) => {
      if (Date.now() - reader.loggedAt > LOG_EVERY_MS) {
        reader.loggedAt = Date.now();
        logger.warn('ballot: live results read failed', { source: reader.source.key, error: err.message });
      }
    })
    .finally(() => {
      reader.inflight = null;
    });
  return reader.inflight;
}

// Reads on a timer while cards keep asking; stops after IDLE_STOP_MS
// without one, and the next card starts it again.
function keepReading(reader, intervalMs) {
  reader.askedAt = Date.now();
  reader.intervalMs = intervalMs;
  if (reader.running) return;
  reader.running = true;
  const tick = async () => {
    if (Date.now() - reader.askedAt > IDLE_STOP_MS) {
      reader.running = false;
      return;
    }
    await refresh(reader);
    const timer = setTimeout(tick, reader.intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  };
  tick();
}

function readerFor(source) {
  let reader = readers.get(source.key);
  if (!reader) {
    reader = {
      source, electionId: source.electionId, snapshot: null, inflight: null, running: false, askedAt: 0, intervalMs: SLOW_MS, loggedAt: 0,
    };
    readers.set(source.key, reader);
  }
  return reader;
}

function percent(votes, total) {
  return `${(Math.round((votes / total) * 1000) / 10).toFixed(1)}%`;
}

const LOCAL_DATE = (zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const LOCAL_CLOCK = (zone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true });
const LOCAL_MONTH_DAY = (zone) => new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric' });

// "8:16 p.m." on the card's own day, "Nov 4, 5:02 p.m." on another.
function postedLabel(iso, zone, today) {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return null;
  const clock = LOCAL_CLOCK(zone).format(at).replace(/\s*AM$/i, ' a.m.').replace(/\s*PM$/i, ' p.m.');
  return LOCAL_DATE(zone).format(at) === today ? clock : `${LOCAL_MONTH_DAY(zone).format(at)}, ${clock}`;
}

const KIND_ORDER = { house: 0, state_senate: 1, state_house: 2, supreme_court: 3, measure: 4 };
const STATEWIDE = new Set(['supreme_court', 'measure']);
// Statewide races fold behind one row when there are more than this and the
// address has races of its own to show first.
const FOLD_OVER = 3;

// A measure reads Yes (or For) then No (or Against) on every card, whatever
// order the state lists them in; candidates keep the state's own order.
const MEASURE_ORDER = [/^(yes|for)\b/i, /^(no|against)\b/i];
function measureOrder(options) {
  const rank = (o) => {
    const i = MEASURE_ORDER.findIndex((re) => re.test(o.name));
    return i < 0 ? MEASURE_ORDER.length : i;
  };
  return [...options].sort((a, b) => rank(a) - rank(b));
}

// One race as apps draw it: every word and number already written, and each
// choice's share of the race's votes (write-ins included) for its bar.
function drawnRace(race) {
  const measure = race.kind === 'measure' && race.options.length === 2;
  return {
    key: `${race.kind}:${race.district || ''}:${race.order}`,
    kind: measure ? 'measure' : 'candidates',
    title: race.title,
    qualifier: race.qualifier,
    options: (measure ? measureOrder(race.options) : race.options).map((o) => ({
      name: o.name,
      votes_label: o.votes.toLocaleString('en-US'),
      percent_label: percent(o.votes, race.total),
      share: Math.round((o.votes / race.total) * 10000) / 10000,
    })),
  };
}

// The folded statewide row: "8 statewide races" over "Supreme Court and 3
// initiatives".
function foldFor(races) {
  const courts = races.some((r) => r.kind === 'supreme_court');
  const measures = races.filter((r) => r.kind === 'measure');
  let noun = ['measure', 'measures'];
  if (measures.every((r) => /^Initiative\b/i.test(r.title))) noun = ['initiative', 'initiatives'];
  else if (measures.every((r) => /^Constitutional Amendment\b/i.test(r.title))) noun = ['amendment', 'amendments'];
  const parts = [courts ? 'Supreme Court' : null, measures.length ? `${measures.length} ${noun[measures.length === 1 ? 0 : 1]}` : null];
  return { label: `${races.length} statewide races`, detail: parts.filter(Boolean).join(' and ') };
}

/**
 * The card's lines for one address from one count: `{ header, lines, count }`
 * (`count` is the same count for apps that draw it), `{ pending: true }`
 * when no votes are counted yet, or null.
 */
function cardLines(snapshot, { districts, fips, zone, today }) {
  const own = districts && districts.state_fips === fips ? districts : {};
  const wanted = snapshot.races.filter((race) => {
    if (STATEWIDE.has(race.kind)) return true;
    if (race.kind === 'house') return race.district === own.congressional;
    if (race.kind === 'state_senate') return race.district === own.state_upper;
    return race.district === own.state_lower;
  });
  if (!wanted.length) return null;
  const counted = wanted
    .filter((race) => race.total > 0 && race.options.length)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.order - b.order);
  if (!counted.length) return { pending: true };
  const posted = snapshot.postedAt ? postedLabel(snapshot.postedAt, zone, today) : null;
  if (!posted) return null;
  const local = counted.filter((race) => !STATEWIDE.has(race.kind));
  const statewide = counted.filter((race) => STATEWIDE.has(race.kind));
  const groups = [];
  if (local.length) groups.push({ key: 'districts', title: 'Your districts', races: local.map(drawnRace), fold: null });
  if (statewide.length) {
    groups.push({
      key: 'statewide',
      title: 'Statewide',
      races: statewide.map(drawnRace),
      fold: local.length && statewide.length > FOLD_OVER ? foldFor(statewide) : null,
    });
  }
  return {
    // The clock already ends in "a.m." or "p.m.".
    header: `Unofficial count, posted ${posted}`,
    lines: counted.map((race) => `${race.label}: ${race.options.map((o) => `${o.name} ${percent(o.votes, race.total)}`).join(', ')}`),
    count: { status: 'Unofficial count', posted: `posted ${posted}`, groups },
  };
}

/**
 * The live count for a card, or null when there is none to show. Waits up
 * to WAIT_MS for a read when the last one is over a minute old.
 */
async function forCard({ stateCode, electionDate, districts, zone, today, electionNight }) {
  const source = sourceFor(stateCode, electionDate);
  if (!source) return null;
  const reader = readerFor(source);
  keepReading(reader, electionNight ? FAST_MS : SLOW_MS);
  if (!reader.snapshot || Date.now() - reader.snapshot.checkedAt > FRESH_MS) {
    let timer = null;
    await Promise.race([
      refresh(reader),
      new Promise((resolve) => {
        timer = setTimeout(resolve, WAIT_MS);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
    clearTimeout(timer);
  }
  const snapshot = reader.snapshot;
  if (!snapshot || Date.now() - snapshot.checkedAt > STALE_AFTER_MS) return null;
  const result = cardLines(snapshot, { districts, fips: source.fips, zone, today });
  // "The first count will show here" belongs to election night only.
  if (result && result.pending && !electionNight) return null;
  return result;
}

module.exports = {
  covers,
  forCard,
  // Exported for unit tests.
  racesFrom,
  classifyByGroup,
  classifyByName,
  cardLines,
  postedLabel,
};

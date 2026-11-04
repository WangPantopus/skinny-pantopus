// ============================================================
// BALLOT LIVE RESULTS — the official count for the races at an address,
// read from the state's own results site while ballots are counted
// (docs/product/ballot-live-results-plan-2026-11-03.md, Step 1).
//
// Washington publishes every county's count on results.votewa.gov. A timer
// reads that site's small election summary every few seconds and its
// results data whenever the published version changes, so a card request
// never waits on the state's site: it reads the last count kept in memory.
// The site's cache serves copies up to 60 seconds old; nothing here can be
// fresher than that.
//
// Honesty rules the card relies on:
//   • only numbers read from the state's site, with the state's own publish
//     time; never "won", "leading" or "projected";
//   • a race shows only when the address's district number matches it
//     exactly, in the same state; statewide measures are on every ballot;
//   • "no votes counted yet" only from a read that saw none, and a count
//     that could not be re-checked for STALE_AFTER_MS is not shown at all.
// ============================================================

const logger = require('../../utils/logger');

// The states whose results Pantopus reads: the site's own JSON API (the
// one its public results page loads) and the state's name in it.
const SOURCES = {
  WA: { api: 'https://results.votewa.gov/results/public/api', jurisdiction: 'washington', fips: '53' },
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
  if (!source) return null;
  const local = process.env.NODE_ENV !== 'production';
  const api = (local && process.env.BALLOT_RESULTS_API) || source.api;
  const electionId = (local && process.env.BALLOT_RESULTS_ELECTION_ID) || String(electionDate || '').replace(/-/g, '');
  if (!/^\w+$/.test(electionId)) return null;
  return { key: `${stateCode}:${electionId}:${api}`, api, jurisdiction: source.jurisdiction, fips: source.fips, electionId };
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

/**
 * The races a card can show, from the site's results data: statewide
 * measures, U.S. House seats and legislative seats, each with its district
 * number. Every other contest stays on the official results page.
 */
function racesFrom(data) {
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
    let race = null;
    if (/^State Measures$/i.test(heading)) {
      race = { kind: 'measure', district: null, label: measureLabel(name) };
    } else if (/^U\.S\. Congressional Representative$/i.test(heading)) {
      const district = /Congressional District (\d+)/i.exec(name);
      if (district) race = { kind: 'house', district: String(Number(district[1])), label: `U.S. House, District ${Number(district[1])}` };
    } else if (/^Legislative$/i.test(heading)) {
      const district = /Legislative District (\d+)/i.exec(name);
      const position = /State Representative,?\s*Pos(?:ition|\.)?\s*(\d+)/i.exec(name);
      if (district && /State Senator/i.test(name)) {
        race = { kind: 'state_senate', district: String(Number(district[1])), label: `State Senate, District ${Number(district[1])}` };
      } else if (district && position) {
        race = {
          kind: 'state_house',
          district: String(Number(district[1])),
          label: `State House, District ${Number(district[1])}, Position ${Number(position[1])}`,
        };
      }
    }
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

async function refresh(reader) {
  if (reader.inflight) return reader.inflight;
  reader.inflight = (async () => {
    const { api, jurisdiction, electionId } = reader.source;
    const base = `${api}/elections/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(electionId)}`;
    const summary = await getJson(base, SUMMARY_TIMEOUT_MS);
    const version = summary && typeof summary.publishVersionId === 'string' ? summary.publishVersionId : null;
    if (!version) throw new Error('unexpected results summary');
    if (reader.snapshot && reader.snapshot.version === version) {
      reader.snapshot.checkedAt = Date.now();
      return;
    }
    const data = await getJson(`${base}/data`, DATA_TIMEOUT_MS);
    const races = racesFrom(data);
    // The data names the version it holds. The site caches each address on
    // its own, so the data can lag the summary for up to a minute; keeping
    // the data's own version reads it again on the next tick until they agree.
    const dataVersion = typeof data.election.publishVersionId === 'string' ? data.election.publishVersionId : version;
    const postedAt = data.election.publishDate || summary.publishDate || null;
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
    reader = { source, snapshot: null, inflight: null, running: false, askedAt: 0, intervalMs: SLOW_MS, loggedAt: 0 };
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

const KIND_ORDER = { house: 0, state_senate: 1, state_house: 2, measure: 3 };

/**
 * The card's lines for one address from one count: `{ header, lines }`,
 * `{ pending: true }` when no votes are counted yet, or null.
 */
function cardLines(snapshot, { districts, fips, zone, today }) {
  const own = districts && districts.state_fips === fips ? districts : {};
  const wanted = snapshot.races.filter((race) => {
    if (race.kind === 'measure') return true;
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
  return {
    // The clock already ends in "a.m." or "p.m.".
    header: `Unofficial count, posted ${posted}`,
    lines: counted.map((race) => `${race.label}: ${race.options.map((o) => `${o.name} ${percent(o.votes, race.total)}`).join(', ')}`),
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
  cardLines,
  postedLabel,
};

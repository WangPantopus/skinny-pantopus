'use strict';

/**
 * Which counties serve from the record, and which of their facts: the one place
 * that decides. A server starts from its environment's lists (config/propertyRecords.js)
 * and follows the index's switch file, read every minute, so a county moves between
 * off, shadow and live with one change, no release and no restart, and the API and the
 * worker can't disagree for long.
 *
 *   switches/<name>.json   { v: 1, counties: { "<fips>": { mode: 'off'|'shadow'|'live', withheld: [fact, ...], estimates: true } } }
 *
 * `estimates: true` shows a live county's owners a Pantopus estimate (propertyRecords/valueEstimate.js). Without it, none.
 *
 * A county the file names follows the file; any other follows the environment's lists.
 * The file is written by scripts/property-index/switch-county.cjs, by hand. If it can't
 * be read, the last good copy stands. Until a server has read it once (storage down as
 * it starts), the lists decide who looks anything up, and copies Homes already hold stay
 * on their screens, because a county's copies shouldn't vanish over a storage outage.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const reader = require('./reader');
const { stateOfCounty } = require('./addressKey');

const READ_EVERY_MS = 60 * 1000;
const CHECK_EVERY_MS = 10 * 1000;
// Storage answers the switch file's read every minute, so a server that hasn't heard from it in this long can't read it.
const ANSWERED_WITHIN_MS = 3 * 60 * 1000;
const MODES = new Set(['off', 'shadow', 'live']);

let counties = {};
let modes = config.listedModes();
let liveStates = new Set();
let anyShadowCounty = false;
let fileRead = false;
let loggedAs = null;
let missingLive = [];

function apply(file) {
  counties = file?.counties || {};
  modes = config.listedModes();
  for (const [fips, entry] of Object.entries(counties)) modes.set(fips, entry.mode);
  const listed = [...modes];
  liveStates = new Set(listed.filter(([, mode]) => mode === 'live').map(([fips]) => stateOfCounty(fips)));
  anyShadowCounty = listed.some(([, mode]) => mode === 'shadow');
  const now = JSON.stringify(listed.filter(([, mode]) => mode !== 'off').sort());
  if (now !== loggedAs && config.enabled()) {
    loggedAs = now;
    logger.info('property_records.switches', {
      live: listed.filter(([, mode]) => mode === 'live').map(([fips]) => fips),
      shadow: listed.filter(([, mode]) => mode === 'shadow').map(([fips]) => fips),
      from_file: Object.keys(counties).length,
    });
  }
}

/** Only well-formed entries count: a slip in one county's line can't change another's. */
function parseFile(bytes) {
  const data = JSON.parse(bytes.toString('utf8'));
  if (data?.v !== 1 || typeof data.counties !== 'object' || !data.counties) throw new Error('A switch file this server can\'t read');
  const found = {};
  for (const [fips, entry] of Object.entries(data.counties)) {
    if (/^\d{5}$/.test(fips) && MODES.has(entry?.mode)) {
      found[fips] = { mode: entry.mode, withheld: new Set(Array.isArray(entry.withheld) ? entry.withheld : []), estimates: entry.estimates === true };
    }
  }
  return { counties: found };
}

const readFile = reader.switchesFile(config.switchesName, parseFile, READ_EVERY_MS);

/**
 * Live counties missing from their state's file: a wrong index address, or a county switched on before it was
 * published. Read on the reader's own schedule, so after a restart a lookup finds its state's file already held.
 */
async function checkLive() {
  const live = [...modes].filter(([, mode]) => mode === 'live').map(([fips]) => fips);
  const missing = [];
  for (const state of new Set(live.map(stateOfCounty))) {
    const stateFile = await reader.stateFile(state);
    missing.push(...live.filter((fips) => stateOfCounty(fips) === state && !stateFile?.jurisdictions?.[fips]));
  }
  if (missing.join() !== missingLive.join() && missing.length) logger.warn('property_records.live_county_missing', { counties: missing });
  missingLive = missing;
}

async function follow() {
  try {
    const file = await readFile();
    fileRead = true;
    apply(file);
  } catch (err) {
    logger.info('property_records.switches_later', { error: err.name });
  }
  await checkLive().catch(() => {});
}

/** For /health, which the outside monitor reads every minute: 'ok', 'unreachable' or 'missing' (a live county isn't in its state's file). */
function health() {
  const storage = reader.health();
  if (storage.paused || storage.answered_ms_ago === null || storage.answered_ms_ago > ANSWERED_WITHIN_MS) return 'unreachable';
  return missingLive.length ? 'missing' : 'ok';
}

apply(null);
if (config.enabled()) {
  follow();
  setInterval(follow, CHECK_EVERY_MS).unref();
}

/** 'off', 'shadow' or 'live' for a county. Nothing is on without an index to read. */
const modeFor = (fips) => (config.enabled() ? modes.get(fips) || 'off' : 'off');
/** Whether a state has a live county, so a Home elsewhere never touches storage. */
const liveState = (state) => config.enabled() && liveStates.has(state);
const anyShadow = () => config.enabled() && anyShadowCounty;
/** Whether a county's stored copies are on screens now. */
const showsCopies = (fips) => modeFor(fips) === 'live' || (config.enabled() && !fileRead);

/** Whether a county's owners see a Pantopus estimate: only a live county whose line says so. */
const estimatesFor = (fips) => modeFor(fips) === 'live' && counties[fips]?.estimates === true;

function withholding(fips) {
  return counties[fips]?.withheld?.size ? counties[fips].withheld : null;
}

function without(facts, withheld) {
  return facts && Object.fromEntries(Object.entries(facts).filter(([name]) => !withheld.has(name)));
}

/** Each county named here and its mode. */
const listed = () => new Map(modes);

/** This server's lists, short enough to write down, so servers that disagree can be told apart. */
function summary() {
  const named = [...modes].filter(([, mode]) => mode !== 'off').sort();
  const withheld = Object.entries(counties).filter(([, entry]) => entry.withheld.size).map(([fips, entry]) => [fips, [...entry.withheld].sort()]).sort();
  const estimates = Object.entries(counties).filter(([, entry]) => entry.estimates).map(([fips]) => fips).sort();
  return {
    live: named.filter(([, mode]) => mode === 'live').length,
    shadow: named.filter(([, mode]) => mode === 'shadow').length,
    estimates: estimates.length,
    // Estimates join the hash only when a county has them, so servers before and after them agree on a file without any.
    hash: crypto.createHash('sha256').update(JSON.stringify(estimates.length ? [named, withheld, estimates] : [named, withheld])).digest('hex').slice(0, 12),
  };
}

/** A copy as it may be served now: facts withheld for its county left out. The copy itself is never changed. */
function served(copy) {
  const withheld = copy && withholding(copy.jurisdiction);
  if (!withheld) return copy;
  return { ...copy, facts: without(copy.facts, withheld), ...(copy.building ? { building: without(copy.building, withheld) } : {}) };
}

module.exports = { modeFor, liveState, anyShadow, showsCopies, served, estimatesFor, listed, summary, health };

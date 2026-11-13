'use strict';

/**
 * Which counties serve from the record, and which of their facts: the one place
 * that decides. A server starts from its environment's lists (config/propertyRecords.js)
 * and follows the index's switch file, read every minute, so a county moves between
 * off, shadow and live with one change, no release and no restart, and the API and the
 * worker can't disagree for long.
 *
 *   switches/<name>.json   { v: 1, counties: { "<fips>": { mode: 'off'|'shadow'|'live', withheld: [fact, ...], estimates: true } },
 *                            shared_facts: ["<fips>", ...], similar_homes: ["<fips>", ...],
 *                            appeal_packet: ["<fips>", ...], new_columns: ["<fips>", ...], derived_rows: ["<fips>", ...] }
 *
 * `estimates: true` shows a live county's owners a Pantopus estimate (propertyRecords/valueEstimate.js). Without it, none.
 * `shared_facts` names the live counties where an address with several homes on record shows what all of them agree
 * on (identity.js `agreed`). A file without the list has it off everywhere, and the counties' own lines read as before.
 * `similar_homes` names the live counties where a house's owner sees its county value beside similar houses on its street
 * (similarHomes.js). A file without the list has that off everywhere too.
 * `appeal_packet` names the counties, among those with similar homes on, where an owner whose home is valued above them
 * can get the appeal packet (services/appealPacket.js). A file without the list has it off everywhere.
 * `new_columns` and `derived_rows` name the live counties whose release's held facts show: facts a release carries
 * under `held` (format.js) because they would change what a live county shows, kept off its screens until it's named
 * here. new_columns: columns its connector newly reads (WP20), joined to the copy's facts; derived_rows: rows derived
 * from the record itself (WP19), served beside them as `copy.derived` for Property details only (joinHeld). A file
 * without the lists shows none of them, and a copy's `held` and `held_from` never leave this file.
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
let sharedFacts = new Set();
let similarHomes = new Set();
let appealPackets = new Set();
// The held facts' lists, in the order they apply (format.js `held`).
const HELD = ['new_columns', 'derived_rows'];
let held = {};
let modes = config.listedModes();
let liveStates = new Set();
let anyShadowCounty = false;
let fileRead = false;
let loggedAs = null;
let missingLive = [];

function apply(file) {
  counties = file?.counties || {};
  sharedFacts = file?.sharedFacts || new Set();
  similarHomes = file?.similarHomes || new Set();
  appealPackets = file?.appealPackets || new Set();
  held = file?.held || {};
  modes = config.listedModes();
  for (const [fips, entry] of Object.entries(counties)) modes.set(fips, entry.mode);
  const listed = [...modes];
  liveStates = new Set(listed.filter(([, mode]) => mode === 'live').map(([fips]) => stateOfCounty(fips)));
  anyShadowCounty = listed.some(([, mode]) => mode === 'shadow');
  const named = listed.filter(([, mode]) => mode !== 'off').sort();
  const shared = [...sharedFacts].sort();
  const similar = [...similarHomes].sort();
  // A list joins the line only when it names a county, so a file without one logs as before.
  let now = shared.length ? [named, shared] : named;
  if (similar.length) now = [named, shared, similar];
  const packets = [...appealPackets].sort();
  if (packets.length) now = [named, shared, similar, packets];
  const heldLists = heldNamed();
  if (heldLists.length) now = [named, shared, similar, packets, heldLists];
  now = JSON.stringify(now);
  if (now !== loggedAs && config.enabled()) {
    loggedAs = now;
    logger.info('property_records.switches', {
      live: listed.filter(([, mode]) => mode === 'live').map(([fips]) => fips),
      shadow: listed.filter(([, mode]) => mode === 'shadow').map(([fips]) => fips),
      from_file: Object.keys(counties).length,
      ...(shared.length ? { shared_facts: shared } : {}),
      ...(similar.length ? { similar_homes: similar } : {}),
      ...(packets.length ? { appeal_packet: packets } : {}),
      ...Object.fromEntries(heldLists),
    });
  }
}

/** The held facts' lists that name a county, as [name, [fips, ...]]. */
function heldNamed() {
  return HELD.map((name) => [name, [...(held[name] || [])].sort()]).filter(([, named]) => named.length);
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
  const shared = Array.isArray(data.shared_facts) ? data.shared_facts.filter((fips) => /^\d{5}$/.test(fips)) : [];
  const similar = Array.isArray(data.similar_homes) ? data.similar_homes.filter((fips) => /^\d{5}$/.test(fips)) : [];
  const packets = Array.isArray(data.appeal_packet) ? data.appeal_packet.filter((fips) => /^\d{5}$/.test(fips)) : [];
  const heldLists = Object.fromEntries(HELD.map((name) => [name, new Set(Array.isArray(data[name]) ? data[name].filter((fips) => /^\d{5}$/.test(fips)) : [])]));
  return { counties: found, sharedFacts: new Set(shared), similarHomes: new Set(similar), appealPackets: new Set(packets), held: heldLists };
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

/** Whether an address with several homes on record in this county shows what they all agree on: only a live county the file's list names. */
const sharedFactsFor = (fips) => modeFor(fips) === 'live' && sharedFacts.has(fips);

/** Whether a house's owner in this county sees its county value beside similar houses on its street: only a live county the file's list names. */
const similarHomesFor = (fips) => modeFor(fips) === 'live' && similarHomes.has(fips);

/** Whether an owner in this county can get the appeal packet: only where similar homes are on and the file's list names the county. */
const appealPacketFor = (fips) => similarHomesFor(fips) && appealPackets.has(fips);

/** The live counties with similar homes on, for the yearly watch (services/propertyTaxWatch.js). */
const similarHomesCounties = () => [...similarHomes].filter(similarHomesFor).sort();

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
  const shared = [...sharedFacts].sort();
  let lists = estimates.length ? [named, withheld, estimates] : [named, withheld];
  if (shared.length) lists = [named, withheld, estimates, shared];
  const similar = [...similarHomes].sort();
  if (similar.length) lists = [named, withheld, estimates, shared, similar];
  const packets = [...appealPackets].sort();
  if (packets.length) lists = [named, withheld, estimates, shared, similar, packets];
  const heldLists = heldNamed();
  if (heldLists.length) lists = [named, withheld, estimates, shared, similar, packets, heldLists];
  return {
    live: named.filter(([, mode]) => mode === 'live').length,
    shadow: named.filter(([, mode]) => mode === 'shadow').length,
    estimates: estimates.length,
    ...(shared.length ? { shared_facts: shared.length } : {}),
    ...(similar.length ? { similar_homes: similar.length } : {}),
    ...(packets.length ? { appeal_packet: packets.length } : {}),
    ...Object.fromEntries(heldLists.map(([name, named]) => [name, named.length])),
    // Estimates, shared facts and similar homes join the hash only when a county has them, so servers before and after them agree on a file without any.
    hash: crypto.createHash('sha256').update(JSON.stringify(lists)).digest('hex').slice(0, 12),
  };
}

/** The held facts' lists naming this county, in the order they apply: only a live county. */
const heldFor = (fips) => (modeFor(fips) === 'live' ? HELD.filter((name) => held[name]?.has(fips)) : []);

/**
 * A copy's held facts (format.js `held`) as its county's lists let them show, with `held` and `held_from` left out:
 * neither ever reaches a screen. new_columns joins the copy's own facts (the county's columns, read later); derived_rows
 * never does: it goes to `copy.derived` ({ facts, building?, from }, `from` being each fact's source words from the
 * county's `held_from`), which only Property details draws, so readers of a copy's facts (estimates, the house's
 * shape) see the county's own record. A derived 0 (a county's "None") is kept.
 * @param {object} copy     a stored copy
 * @param {string[]} names  the lists that show, in order
 */
function joinHeld(copy, names) {
  if (!copy || (!copy.held && !copy.held_from)) return copy;
  const { held: kept = {}, held_from: words = {}, ...out } = copy;
  if (names.includes('new_columns') && kept.new_columns) {
    out.facts = { ...copy.facts, ...(kept.new_columns.facts || {}) };
    if (copy.building) out.building = { ...copy.building, ...(kept.new_columns.building || {}) };
  }
  if (names.includes('derived_rows') && kept.derived_rows) {
    out.derived = {
      facts: { ...(kept.derived_rows.facts || {}) },
      ...(kept.derived_rows.building && copy.building ? { building: { ...kept.derived_rows.building } } : {}),
      from: { ...(words.derived_rows || {}) },
    };
  }
  return out;
}

/** A copy as it may be served now: the held facts its county shows (joinHeld), then facts withheld for it left out, wherever they sit. The copy itself is never changed. */
function served(stored) {
  const copy = joinHeld(stored, stored ? heldFor(stored.jurisdiction) : []);
  const withheld = copy && withholding(copy.jurisdiction);
  if (!withheld) return copy;
  return {
    ...copy,
    facts: without(copy.facts, withheld),
    ...(copy.building ? { building: without(copy.building, withheld) } : {}),
    ...(copy.derived ? { derived: { ...copy.derived, facts: without(copy.derived.facts, withheld), ...(copy.derived.building ? { building: without(copy.derived.building, withheld) } : {}) } } : {}),
  };
}

module.exports = { modeFor, liveState, anyShadow, showsCopies, served, joinHeld, heldFor, withholding, estimatesFor, sharedFactsFor, similarHomesFor, similarHomesCounties, appealPacketFor, listed, summary, health };

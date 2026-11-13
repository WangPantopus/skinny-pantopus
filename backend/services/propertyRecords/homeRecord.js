'use strict';

/**
 * A Home's copy of its county record, `niche_data.property_record`: what screens
 * answer from, at once, whatever storage is doing. It holds the facts served to
 * this Home with the release and date they came from, and only what the match
 * allows: a unit's private facts only on an exact match, building figures labeled
 * as the building's. Nothing a household entered is in it, so a refresh can't
 * write over a person's entries (those stay in Home's own columns and
 * `niche_data.household_facts`, services/householdFacts.js).
 *
 * A refresh runs in the background, from any screen that reads the copy, once the
 * county has a newer release, and the copy becomes what the Home's address finds
 * now: another record replaces it, and several records, none or a suppressed one
 * take it off, since a wrong home's facts are worse than none. Only a lookup that
 * can't say keeps the last copy, shown with its date: an outage, a timeout, a
 * release past its date. A withdrawn source's facts go.
 *
 * A lookup holds a screen for a moment at most. Past that the screen says "looking
 * up", the lookup finishes behind it, and a Home that was told so is tried again
 * until storage answers: writing to the Home tells its open screens to read again.
 */

const crypto = require('crypto');
const { changeNicheData } = require('../homeNicheData');
const config = require('../../config/propertyRecords');
const logger = require('../../utils/logger');
const { FACTS } = require('./facts');
const { parse, zip5, stateCode } = require('./addressKey');
const { lookup, StorageUnavailable } = require('./index');
const reader = require('./reader');
const registryUnits = require('./registryUnits');
const router = require('./router');
const counts = require('./counts');

const SCHEMA = 1;
const REFRESH_EVERY_MS = 60 * 60 * 1000;
// How long a lookup may hold a screen. What it read stays in memory, so the next ask answers at once.
const SCREEN_WAIT_MS = 1000;
// A follow-up may wait longer: a hiccup in storage passes with the person seeing only "Looking up…".
const FOLLOW_UP_WAIT_MS = 8000;
const FOLLOW_UP_EVERY_MS = 750;
// A Home told "looking up" is tried again, less and less often, for this long; a later visit starts it over.
const LATER_FIRST_GAP_MS = 2000;
const LATER_MOST_GAP_MS = 60 * 1000;
const LATER_FOR_MS = 30 * 60 * 1000;
const LATER_MOST_HOMES = 500;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MATCHED = new Set(['exact', 'building_only', 'parcel_only']);

const homeAddress = (home) => ({ line1: home.address, unit: home.address2, city: home.city, state: home.state, zip: home.zipcode });

// Which address a copy answers for: a Home whose address changes reads again.
function addressStamp(address) {
  const parsed = parse(address.line1, address.unit);
  if (!parsed) return null;
  return crypto.createHash('sha256')
    .update(JSON.stringify([parsed.number, parsed.pre, parsed.name, parsed.suffix, parsed.post, parsed.unit, parsed.building, zip5(address.zip)]))
    .digest('hex').slice(0, 24);
}

function factsWhere(facts, keep) {
  return Object.fromEntries(Object.entries(facts || {}).filter(([name]) => keep(FACTS[name])));
}

const BUILDING_FIGURES = (fact) => (fact.scope === 'building' || fact.scope === 'parcel') && !fact.value;

/**
 * A record's held facts (format.js `held`), and its building's, kept by the same rules as its own facts. They stay off
 * screens until router.served() finds the county on that list. Null with none.
 */
function heldCopy(record, building, keep) {
  const held = {};
  for (const [name, facts] of Object.entries(record.held || {})) {
    const kept = keep ? factsWhere(facts, keep) : facts;
    if (Object.keys(kept).length) held[name] = { facts: kept };
  }
  for (const [name, facts] of Object.entries(building?.held || {})) {
    const kept = factsWhere(facts, BUILDING_FIGURES);
    if (Object.keys(kept).length) held[name] = { ...held[name], building: kept };
  }
  return Object.keys(held).length ? held : null;
}

/** The copy a Home keeps of a lookup's answer; null when the answer has nothing to keep. */
function copyFromAnswer(answer, address) {
  if (!MATCHED.has(answer.match)) return null;
  const { county, record } = answer;
  let facts = record.facts;
  let keep = null;
  if (answer.match === 'building_only') keep = BUILDING_FIGURES;
  if (answer.match === 'parcel_only') keep = (fact) => fact.scope === 'parcel' || fact.value;
  if (keep) facts = factsWhere(facts, keep);
  const held = heldCopy(record, answer.building, keep);
  return {
    schema: SCHEMA,
    match: answer.match,
    reason: answer.reason || null,
    requested_subject: answer.requested_subject,
    subject: answer.subject,
    home_type: record.home_type || null,
    jurisdiction: answer.jurisdiction,
    release: county.release,
    as_of: county.as_of,
    publisher: county.publisher,
    dataset: county.dataset,
    method: county.method,
    title: county.title || 'County records',
    // Words a publisher's terms ask to go wherever it's named as the source ("provided as is, without warranty").
    ...(county.notice ? { notice: county.notice } : {}),
    // Where each held fact of a list came from, in words, when it isn't the county's own column (format.js `held_from`).
    ...(county.held_from ? { held_from: county.held_from } : {}),
    stored_at: new Date().toISOString(),
    address_stamp: addressStamp(address),
    facts,
    ...(answer.building ? { building: factsWhere(answer.building.facts, BUILDING_FIGURES) } : {}),
    ...(held ? { held } : {}),
  };
}

/**
 * What every record at an address with several homes agrees on (identity.js `agreed`, shared facts on for its county),
 * in a copy's shape so screens label and draw it as the county's: year built, size, bedrooms and baths at most. Never
 * stored on a Home, so its screens ask the record each time and the switch going off takes it away at once. Null otherwise.
 */
function agreedCopy(answer, address) {
  if (answer.match !== 'ambiguous' || !answer.agreed) return null;
  const { county } = answer;
  return {
    schema: SCHEMA,
    match: 'ambiguous',
    reason: answer.reason || null,
    requested_subject: answer.requested_subject,
    jurisdiction: answer.jurisdiction,
    release: county.release,
    as_of: county.as_of,
    publisher: county.publisher,
    dataset: county.dataset,
    method: county.method,
    title: county.title || 'County records',
    ...(county.notice ? { notice: county.notice } : {}),
    address_stamp: addressStamp(address),
    facts: answer.agreed,
  };
}

/** The agreed facts as they may be served now, leaving out any its county withholds. Null when nothing is left. */
function servedAgreed(answer, address) {
  const shared = router.served(agreedCopy(answer, address));
  return shared && Object.keys(shared.facts).length ? shared : null;
}

/** "Nov 3, 2026" from "2026-11-03". */
function dateLabel(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  return year && month && day ? `${MONTHS[month - 1]} ${day}, ${year}` : null;
}

/** Where a copy's facts come from, in the shape the apps read (services/recordVocabulary.js). */
function provenanceOf(copy) {
  const source = `From ${copy.publisher}'s records, updated ${dateLabel(copy.as_of)}${copy.notice ? ` \u00b7 ${copy.notice}` : ''}`;
  let lead = '';
  if (copy.match === 'building_only') {
    lead = copy.reason === 'unit_needed'
      ? 'We found the building. Add your unit to see your home\'s own details. '
      : 'We found the building. Your unit\'s details weren\'t in the county record. ';
  }
  if (copy.match === 'ambiguous') lead = 'More than one home is on record at this address, and all of its records agree on these details. Add your unit if you have one. ';
  return {
    publisher: copy.publisher,
    dataset: copy.dataset,
    as_of: copy.as_of,
    // An address's several records: "building", which the apps read as "not your own unit's record".
    scope: { exact: 'unit', building_only: 'building', parcel_only: 'parcel', ambiguous: 'building' }[copy.match],
    method: copy.method,
    label: `${lead}${source}`,
    title: copy.title || 'County records',
  };
}

function storedCopy(home) {
  const copy = home?.niche_data?.property_record;
  if (!copy || copy.schema !== SCHEMA) return null;
  return copy.address_stamp === addressStamp(homeAddress(home)) ? copy : null;
}

// True when the copy was written: the Home row's change tells its household's open screens to read again.
// Only this key changes, on the row as it stands now: an entry the household made during the lookup stays.
async function storeCopy(home, copy) {
  if (!home?.id || home.niche_data === undefined) return false;
  try {
    const nicheData = await changeNicheData(home.id, (stored) => {
      if (copy) stored.property_record = copy;
      else delete stored.property_record;
      return stored;
    });
    if (!nicheData) return false;
    home.niche_data = nicheData;
    return true;
  } catch (err) {
    logger.warn('property_records.store_failed', { error: err.message });
    return false;
  }
}

/** The county as the state's file held now says, with no wait. Null until this server has read that file. */
function countyNow(home, copy) {
  return reader.heldStateFile(stateCode(home.state))?.jurisdictions?.[copy.jurisdiction] || null;
}

/** A copy whose facts may not be shown: its county withdrew the source, or its release was taken back. */
function setAside(home, copy) {
  const county = countyNow(home, copy);
  return Boolean(county && (county.status === 'withdrawn' || county.rolled_back_from === copy.release));
}

const refreshedAt = new Map();

// Answers that don't say which home an address is: the copy stays until one does. (Storage that can't be read throws.)
const saysNothing = (answer) => answer.match === 'stale' || answer.reason === 'unreadable_address';

/**
 * Brings a stored copy up to the county's current release, in the background, as soon as this server has seen the
 * release change. It asks every live county, since a fix can file a record under another county of its source, and
 * keeps what the address finds now: never a copy the record no longer gives this address, which may be another home's.
 * A rolled-back release's facts leave the screens at once (setAside) and go once the release in its place has answered.
 * Only while the county is known to be live: before a server has read the switch file, copies stay as they are.
 */
function refreshSoon(home, copy) {
  if (!home.id || router.modeFor(copy.jurisdiction) !== 'live') return null;
  const county = countyNow(home, copy);
  if (!county || (county.release === copy.release && county.status !== 'withdrawn')) return null;
  // Once for each release a county moves to, so a refresh that finds nothing new doesn't run on every read.
  const tried = `${home.id}:${county.release}:${county.status}`;
  if (Date.now() - (refreshedAt.get(tried) || 0) < REFRESH_EVERY_MS) return null;
  refreshedAt.set(tried, Date.now());
  if (refreshedAt.size > 5000) refreshedAt.delete(refreshedAt.keys().next().value);
  return (async () => {
    if (county.status === 'withdrawn') {
      await storeCopy(home, null);
      return;
    }
    const address = homeAddress(home);
    const answer = await lookup(address);
    const next = copyFromAnswer(answer, address);
    if (next || county.rolled_back_from === copy.release || !saysNothing(answer)) await storeCopy(home, next);
  })().catch((err) => logger.info('property_records.refresh_later', { error: err.name }));
}

/** A lookup that says "still reading" rather than hold a screen. The read goes on behind the answer. */
function lookupForScreen(address) {
  const read = lookup(address);
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StorageUnavailable('Still reading')), SCREEN_WAIT_MS);
  });
  read.catch(() => {});
  return Promise.race([read, late]).finally(() => clearTimeout(timer));
}

const later = new Map();
let laterTimer = null;

function nextLaterRun() {
  if (laterTimer || !later.size) return;
  const soonest = Math.min(...[...later.values()].map((entry) => entry.due));
  laterTimer = setTimeout(runLater, Math.max(0, soonest - Date.now()));
  laterTimer.unref();
}

async function runLater() {
  laterTimer = null;
  const now = Date.now();
  await Promise.all([...later].filter(([, entry]) => entry.due <= now).map(async ([id, entry]) => {
    const address = homeAddress(entry.home);
    try {
      const answer = await lookup(address);
      later.delete(id);
      const copy = copyFromAnswer(answer, address);
      // Written even with nothing to keep, which changes nothing: the Home row moving is what tells an open screen to stop saying "looking up".
      if (copy) await storeCopy(entry.home, copy);
      else await changeNicheData(id, (stored) => stored);
    } catch (err) {
      if (!(err instanceof StorageUnavailable)) logger.warn('property_records.later_failed', { error: err.name });
      entry.gap = Math.min(entry.gap * 2, LATER_MOST_GAP_MS);
      entry.due = Date.now() + entry.gap;
      if (entry.due > entry.until) later.delete(id);
    }
  }));
  nextLaterRun();
}

/** A Home that was told "looking up" gets its answer when storage has one. */
function finishLater(home) {
  if (!home?.id || home.niche_data === undefined || later.has(home.id) || later.size >= LATER_MOST_HOMES) return;
  const now = Date.now();
  // Only what a lookup needs is held: a Home's row can carry much more.
  const { id, address, address2, city, state, zipcode } = home;
  later.set(id, { home: { id, address, address2, city, state, zipcode, niche_data: null }, gap: LATER_FIRST_GAP_MS, due: now + LATER_FIRST_GAP_MS, until: now + LATER_FOR_MS });
  nextLaterRun();
}

/** Counts a lookup for the daily report: county and outcome only. */
function noteLookup(surface, address, found) {
  let outcome = 'no_record';
  if (!found) outcome = 'off';
  else if (found.copy) outcome = 'answered';
  else if (found.lookup === 'pending') outcome = 'waiting';
  else if ((found.match || found.answer?.match) === 'ambiguous') outcome = 'ambiguous';
  try {
    counts.noteLookup(surface, { mark: addressStamp(address), zip: address.zip, state: address.state }, outcome,
      found?.copy?.jurisdiction || found?.jurisdiction || found?.answer?.jurisdiction);
  } catch (err) {
    logger.info('property_records.count_failed', { error: err.name });
  }
}

/** The copy a live county's screens answer from, with no lookup. One behind its county's release starts its refresh. */
function liveCopy(home) {
  if (!config.enabled() || !home) return null;
  const stored = storedCopy(home);
  if (!stored || !router.showsCopies(stored.jurisdiction)) return null;
  refreshSoon(home, stored);
  return setAside(home, stored) ? null : router.served(stored);
}

/**
 * What the record has for a Home, for a screen: its stored copy at once, or for a
 * Home in a live county with no copy yet, a lookup now (a few milliseconds of
 * reading), kept on the Home. Null when the record has nothing to do with this
 * Home, so the caller goes on as before.
 *
 * @returns {Promise<null|{ copy: object|null, lookup: 'pending'|'none'|null, shared?: object }>}
 *   `pending`: storage can't be read just now, so say "Looking up…"; `none`: no record. `shared`: with no copy, what
 *   all the records at the Home's address agree on (agreedCopy), where its county shows that.
 */
async function forHome(home) {
  if (!home) return null;
  const found = await readForHome(home);
  noteLookup('home', homeAddress(home), found);
  return found;
}

async function readForHome(home) {
  if (!config.enabled()) return null;
  const stored = storedCopy(home);
  // Taking a county off its live list takes its copies off the screens too; they stay on the Home for when it comes back.
  if (stored && router.showsCopies(stored.jurisdiction)) {
    refreshSoon(home, stored);
    if (!setAside(home, stored)) return { copy: router.served(stored), lookup: null };
    if (countyNow(home, stored).status === 'withdrawn') return { copy: null, lookup: 'none', reason: 'withdrawn', jurisdiction: stored.jurisdiction };
    // A release taken back: ask the release in its place, as a Home with no copy would.
  }
  if (!router.liveState(stateCode(home.state))) return null;
  try {
    const address = homeAddress(home);
    const answer = await lookupForScreen(address);
    if (answer.match === 'unsupported' && answer.reason === 'no_release') return null;
    const copy = copyFromAnswer(answer, address);
    if (!copy) {
      const shared = servedAgreed(answer, address);
      return { copy: null, lookup: 'none', match: answer.match, reason: answer.reason || null, jurisdiction: answer.jurisdiction, ...(shared ? { shared } : {}) };
    }
    await storeCopy(home, copy);
    return { copy: router.served(copy), lookup: null };
  } catch (err) {
    if (!(err instanceof StorageUnavailable)) throw err;
    finishLater(home);
    return { copy: null, lookup: 'pending' };
  }
}

/**
 * A Home no county record answers for, in a state live on the address registry: the line asking which unit is theirs, when
 * its address has several homes and it names none, in the shape the apps draw (provenanceOf). Never stored on the Home: a
 * copy would take the place of what the Home shows today. Null when there's nothing to ask, or the registry can't say in time.
 */
async function unitQuestion(home) {
  const address = homeAddress(home);
  if (!registryUnits.usesRegistry(address)) return null;
  const parsed = parse(address.line1, address.unit, { state: stateCode(address.state), zip: address.zip });
  if (!parsed || parsed.unit || parsed.building) return null;
  try {
    const units = await registryUnits.lookup({ normalizedAddress: address, submittedUnit: '' });
    if (!units?.secondary_required) return null;
    const release = String(units.provider_version || '');
    return {
      publisher: 'Public address records',
      dataset: 'address points',
      as_of: /^\d{8}/.test(release) ? `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}` : null,
      scope: 'building',
      method: 'county',
      label: units.raw?.reason === 'several_urbanizations'
        ? 'More than one home has this address. Which urbanizaci\u00f3n is yours?'
        : 'We found the building. Which unit is yours?',
    };
  } catch (err) {
    logger.info('address_registry.question_later', { error: err.name });
    return null;
  }
}

/**
 * What the record has for an address with no Home yet (Add Home). `copy` is what may be shown; `whole` is what a new
 * Home keeps, so a fact withheld today comes back without a new lookup. `shared`: with no copy, what all the records at
 * the address agree on (agreedCopy), where its county shows that; a new Home never keeps it.
 * @param {object} address
 * @param {object} [options]
 * @param {boolean} [options.patient] A follow-up: it may wait a few seconds for storage to answer.
 * @returns {Promise<null|{ copy: object|null, whole: object|null, answer: object, lookup: 'found'|'none'|'pending', shared?: object }>} null outside live counties.
 */
async function forAddress(address, options) {
  const found = await readForAddress(address, options);
  noteLookup('add_home', address, found);
  return found;
}

async function readForAddress(address, { patient = false } = {}) {
  if (!router.liveState(stateCode(address.state))) return null;
  const until = Date.now() + (patient ? FOLLOW_UP_WAIT_MS : 0);
  for (;;) {
    try {
      const answer = await lookupForScreen(address);
      if (answer.match === 'unsupported' && answer.reason === 'no_release') return null;
      const copy = copyFromAnswer(answer, address);
      const shared = copy ? null : servedAgreed(answer, address);
      return { copy: router.served(copy), whole: copy, answer, lookup: copy ? 'found' : 'none', ...(shared ? { shared } : {}) };
    } catch (err) {
      if (!(err instanceof StorageUnavailable)) throw err;
      if (Date.now() + FOLLOW_UP_EVERY_MS > until) return { copy: null, whole: null, answer: null, lookup: 'pending' };
      await new Promise((resolve) => { setTimeout(resolve, FOLLOW_UP_EVERY_MS); });
    }
  }
}

module.exports = { copyFromAnswer, provenanceOf, storedCopy, liveCopy, storeCopy, refreshSoon, forHome, forAddress, finishLater, unitQuestion, noteLookup, homeAddress, dateLabel };

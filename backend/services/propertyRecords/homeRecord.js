'use strict';

/**
 * A Home's copy of its county record, `niche_data.property_record`: what screens
 * answer from, at once, whatever storage is doing. It holds the facts served to
 * this Home with the release and date they came from, and only what the match
 * allows: a unit's private facts only on an exact match, building figures labeled
 * as the building's. Nothing a household entered is in it, so a refresh can't
 * write over a person's entries (those stay in Home's own columns).
 *
 * A refresh runs in the background when the county has a newer release. It only
 * replaces the copy with a real answer: an empty answer, a timeout or an outage
 * keeps the last copy, shown with its date. The one exception is a source that was
 * withdrawn, whose facts go.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const config = require('../../config/propertyRecords');
const logger = require('../../utils/logger');
const { FACTS } = require('./facts');
const { parse, zip5, stateCode } = require('./addressKey');
const { lookup, StorageUnavailable } = require('./index');
const reader = require('./reader');
const router = require('./router');
const counts = require('./counts');

const SCHEMA = 1;
const REFRESH_EVERY_MS = 60 * 60 * 1000;
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

/** The copy a Home keeps of a lookup's answer; null when the answer has nothing to keep. */
function copyFromAnswer(answer, address) {
  if (!MATCHED.has(answer.match)) return null;
  const { county, record } = answer;
  let facts = record.facts;
  if (answer.match === 'building_only') facts = factsWhere(facts, (fact) => (fact.scope === 'building' || fact.scope === 'parcel') && !fact.value);
  if (answer.match === 'parcel_only') facts = factsWhere(facts, (fact) => fact.scope === 'parcel' || fact.value);
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
    stored_at: new Date().toISOString(),
    address_stamp: addressStamp(address),
    facts,
    ...(answer.building ? { building: factsWhere(answer.building.facts, (fact) => (fact.scope === 'building' || fact.scope === 'parcel') && !fact.value) } : {}),
  };
}

/** "Nov 3, 2026" from "2026-11-03". */
function dateLabel(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  return year && month && day ? `${MONTHS[month - 1]} ${day}, ${year}` : null;
}

/** Where a copy's facts come from, in the shape the apps read (services/recordVocabulary.js). */
function provenanceOf(copy) {
  const source = `From ${copy.publisher}'s records, updated ${dateLabel(copy.as_of)}`;
  let lead = '';
  if (copy.match === 'building_only') {
    lead = copy.reason === 'unit_needed'
      ? 'We found the building. Add your unit to see your home\'s own details. '
      : 'We found the building. Your unit\'s details weren\'t in the county record. ';
  }
  return {
    publisher: copy.publisher,
    dataset: copy.dataset,
    as_of: copy.as_of,
    scope: { exact: 'unit', building_only: 'building', parcel_only: 'parcel' }[copy.match],
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
async function storeCopy(home, copy) {
  if (!home?.id || home.niche_data === undefined) return false;
  const nicheData = { ...(home.niche_data && typeof home.niche_data === 'object' ? home.niche_data : {}) };
  if (copy) nicheData.property_record = copy;
  else delete nicheData.property_record;
  const { error } = await supabaseAdmin.from('Home').update({ niche_data: nicheData }).eq('id', home.id);
  if (error) {
    logger.warn('property_records.store_failed', { error: error.message });
    return false;
  }
  home.niche_data = nicheData;
  return true;
}

const refreshedAt = new Map();

/** Brings a stored copy up to the county's current release, in the background. Nothing is lost if it can't. */
function refreshSoon(home, copy) {
  if (!home.id || Date.now() - (refreshedAt.get(home.id) || 0) < REFRESH_EVERY_MS) return;
  refreshedAt.set(home.id, Date.now());
  if (refreshedAt.size > 5000) refreshedAt.delete(refreshedAt.keys().next().value);
  (async () => {
    const stateFile = await reader.stateFile(stateCode(home.state));
    const county = stateFile?.jurisdictions?.[copy.jurisdiction];
    if (!county) return;
    if (county.status === 'withdrawn') {
      await storeCopy(home, null);
      return;
    }
    if (county.release === copy.release) return;
    const address = homeAddress(home);
    const answer = await lookup(address, { serves: (fips) => fips === copy.jurisdiction });
    const next = copyFromAnswer(answer, address);
    if (next) await storeCopy(home, next);
  })().catch((err) => logger.info('property_records.refresh_later', { error: err.name }));
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

/**
 * What the record has for a Home, for a screen: its stored copy at once, or for a
 * Home in a live county with no copy yet, a lookup now (a few milliseconds of
 * reading), kept on the Home. Null when the record has nothing to do with this
 * Home, so the caller goes on as before.
 *
 * @returns {Promise<null|{ copy: object|null, lookup: 'pending'|'none'|null }>}
 *   `pending`: storage can't be read just now, so say "Looking up…"; `none`: no record.
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
    return { copy: router.served(stored), lookup: null };
  }
  if (!router.liveState(stateCode(home.state))) return null;
  try {
    const address = homeAddress(home);
    const answer = await lookup(address);
    if (answer.match === 'unsupported' && answer.reason === 'no_release') return null;
    const copy = copyFromAnswer(answer, address);
    if (!copy) return { copy: null, lookup: 'none', match: answer.match, jurisdiction: answer.jurisdiction };
    await storeCopy(home, copy);
    return { copy: router.served(copy), lookup: null };
  } catch (err) {
    if (err instanceof StorageUnavailable) return { copy: null, lookup: 'pending' };
    throw err;
  }
}

/**
 * What the record has for an address with no Home yet (Add Home). `copy` is what may be shown; `whole` is what a new
 * Home keeps, so a fact withheld today comes back without a new lookup.
 * @returns {Promise<null|{ copy: object|null, whole: object|null, answer: object, lookup: 'found'|'none'|'pending' }>} null outside live counties.
 */
async function forAddress(address) {
  const found = await readForAddress(address);
  noteLookup('add_home', address, found);
  return found;
}

async function readForAddress(address) {
  if (!router.liveState(stateCode(address.state))) return null;
  try {
    const answer = await lookup(address);
    if (answer.match === 'unsupported' && answer.reason === 'no_release') return null;
    const copy = copyFromAnswer(answer, address);
    return { copy: router.served(copy), whole: copy, answer, lookup: copy ? 'found' : 'none' };
  } catch (err) {
    if (err instanceof StorageUnavailable) return { copy: null, whole: null, answer: null, lookup: 'pending' };
    throw err;
  }
}

module.exports = { copyFromAnswer, provenanceOf, storedCopy, storeCopy, forHome, forAddress, noteLookup, homeAddress, dateLabel };

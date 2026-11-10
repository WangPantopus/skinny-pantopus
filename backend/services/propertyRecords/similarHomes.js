'use strict';

/**
 * A house's county value beside similar houses on its street, from the same county release: the first check of the
 * Home Money Check. It answers one question an owner can't answer from their own record: does the county value this
 * home higher, per square foot, than the houses most like it?
 *
 *   similar   a house on the same street and in the same ZIP (or town), within 25% of this home's living area,
 *             15 years of its age and, where the record has lots, half its lot size, valued for the same year. The
 *             nearest ten by house number; fewer than five says nothing.
 *   value     the county's own market value where its record has one. An assessed value only where state law makes it
 *             market value or one fixed share of it (data/valuePractice.js): a capped or town-set assessment differs
 *             between neighbors because the law says so, which is no finding.
 *
 * Only counts and per-square-foot figures leave this file for a screen: the typical similar house, the range and how
 * many there were. Never a neighbor's address or value. A record taken down at someone's request, a restricted one and
 * a fact its county withholds are left out, as on every other screen.
 *
 * One exception, decided by the founder on November 10, 2026: the appeal packet's PDF (services/appealPacket.js), for
 * the home's confirmed owner who bought it, lists each similar house by parcel number, living area, year built and
 * county value (`{ list: true }`), because a review board asks for specific homes and these are the county's public
 * record. Never a street address or an owner's name, and never on a screen or in an API answer.
 *
 * Off until the founder turns it on for a live county, in that environment's switch file (router.js, `similar_homes`):
 * one command, no release, and off again the same way. It answers null rather than wait or fail.
 */

const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const reader = require('./reader');
const router = require('./router');
const { suppressionHash } = require('./index');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');
const { ASSESSMENT_SHARE, ASSESSED_AT_FULL_VALUE } = require('../../data/valuePractice');

const MIN_HOMES = 5;
const MAX_HOMES = 10;
const SIZE_WITHIN = 0.25;
const AGE_WITHIN_YEARS = 15;
// A county's value takes in the land, so a house on a lot twice the size isn't like this one.
const LOT_WITHIN = 0.5;
// The same band the county's own two figures are read with (exemptionCheckService.assessmentSignal).
const NEAR_PCT = 5;
// How long a screen waits. What was read stays in memory, so the next ask answers at once.
const SCREEN_WAIT_MS = 800;

const positive = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
const agrees = (a, b) => !a || !b || a === b;
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

function median(sorted) {
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Which of a record's values can be set beside a neighbor's, and which of its areas: null when neither can. */
function basisOf(facts, state) {
  const size = positive(facts.living_sqft) ? 'living_sqft' : positive(facts.usable_sqft) ? 'usable_sqft' : null;
  if (!size) return null;
  if (positive(facts.market_value)) return { value: 'market_value', size };
  if (positive(facts.assessed_value) && (ASSESSED_AT_FULL_VALUE.has(state) || ASSESSMENT_SHARE[state])) return { value: 'assessed_value', size };
  return null;
}

/** Whether a record on the street is a house like this one. */
function similarTo(own, basis, query) {
  const size = own.facts[basis.size];
  const lot = positive(own.facts.lot_sqft);
  return (record) => {
    if (record.id === own.id || record.kind !== 'property' || record.restricted) return false;
    const { address, facts } = record;
    if (!facts || !address) return false;
    if (!agrees(address.pre, query.pre) || !agrees(address.suffix, query.suffix) || !agrees(address.post, query.post)) return false;
    // The same street name in two towns of a county: ZIP decides, and the town where a source has no ZIP.
    if (address.zip ? address.zip !== query.zip : !address.city || address.city !== query.city) return false;
    if (!agrees(record.home_type, own.home_type)) return false;
    if ((facts.value_year || null) !== (own.facts.value_year || null)) return false;
    if (!positive(facts[basis.value]) || !positive(facts[basis.size])) return false;
    if (Math.abs(facts[basis.size] - size) > size * SIZE_WITHIN) return false;
    if (lot && (!positive(facts.lot_sqft) || Math.abs(facts.lot_sqft - lot) > lot * LOT_WITHIN)) return false;
    return Number.isInteger(facts.year_built) && Math.abs(facts.year_built - own.facts.year_built) <= AGE_WITHIN_YEARS;
  };
}

/**
 * @param {object} own      This home's record in the release
 * @param {object[]} street The release's records on its street
 * @param {object} query    The home's parsed address with its ZIP and town
 * @param {string} state
 * @param {object} [options]
 * @param {boolean} [options.list]  For the appeal packet's PDF only: also the houses themselves (see the note above)
 * @returns {object|null}
 */
function compare(own, street, query, state, { list = false } = {}) {
  if (own.kind !== 'property' || !own.facts || !Number.isInteger(own.facts.year_built)) return null;
  const basis = basisOf(own.facts, state);
  if (!basis) return null;
  const number = Number.parseInt(own.address?.number, 10);
  const distance = (record) => {
    const theirs = Number.parseInt(record.address.number, 10);
    return Number.isFinite(number) && Number.isFinite(theirs) ? Math.abs(theirs - number) : Infinity;
  };
  const homes = street.filter(similarTo(own, basis, query)).sort((a, b) => distance(a) - distance(b)).slice(0, MAX_HOMES);
  if (homes.length < MIN_HOMES) return null;
  const perSqft = homes.map(({ facts }) => facts[basis.value] / facts[basis.size]).sort((a, b) => a - b);
  const yours = own.facts[basis.value] / own.facts[basis.size];
  const typical = median(perSqft);
  const pct = Math.round(((yours - typical) / typical) * 100);
  let stance = 'near';
  if (pct > NEAR_PCT) stance = 'above';
  else if (pct < -NEAR_PCT) stance = 'below';
  return {
    basis: basis.value,
    value_year: own.facts.value_year || null,
    homes: homes.length,
    yours_per_sqft: Math.round(yours),
    typical_per_sqft: Math.round(typical),
    lots: Boolean(positive(own.facts.lot_sqft)),
    low_per_sqft: Math.round(perSqft[0]),
    high_per_sqft: Math.round(perSqft[perSqft.length - 1]),
    pct,
    stance,
    ...(list ? {
      list: homes.map(({ facts }) => ({
        parcel_number: typeof facts.parcel_number === 'string' && facts.parcel_number.trim() ? facts.parcel_number.trim() : null,
        size_sqft: Math.round(facts[basis.size]),
        year_built: facts.year_built,
        value: Math.round(facts[basis.value]),
        per_sqft: Math.round(facts[basis.value] / facts[basis.size]),
      })),
    } : {}),
  };
}

async function read(home, copy, options) {
  const fips = copy.jurisdiction;
  const state = stateCode(home.state);
  const parsed = parse(home.address, home.address2, { state, zip: home.zipcode });
  if (!parsed) return null;
  const stateFile = await reader.stateFile(state);
  const county = stateFile?.jurisdictions?.[fips];
  if (!county || county.status === 'withdrawn' || (county.stale_after && Date.now() > Date.parse(county.stale_after))) return null;
  const query = { ...parsed, zip: zip5(home.zipcode), city: cityKey(home.city) };
  const [street, suppressions] = await Promise.all([reader.recordsNear(fips, county.release, sortKey(parsed)), reader.suppressions()]);
  // The home's own record as this release has it, so both sides of the comparison come from one roll.
  const own = street.find((record) => record.id === copy.subject?.id && record.kind === copy.subject?.kind);
  if (!own || own.restricted) return null;
  const withheld = router.withholding(fips);
  const hidden = new Set(suppressions?.hashes || []);
  const shown = street
    .filter((record) => !hidden.size || !record.address || !hidden.has(suppressionHash(suppressions.salt, fips, { ...record.address, unit: record.address.unit || '' })))
    .map((record) => (withheld && record.facts ? { ...record, facts: Object.fromEntries(Object.entries(record.facts).filter(([name]) => !withheld.has(name))) } : record));
  const mine = shown.find((record) => record.id === own.id);
  const found = mine ? compare(mine, shown, query, state, options) : null;
  return found ? { ...found, publisher: county.publisher, as_of: county.as_of } : null;
}

/**
 * The comparison for a Home's stored copy of its county record (homeRecord.js), or null: the county isn't switched on,
 * the copy isn't one house's own record, too few houses are like it, or the index can't be read in time.
 * @param {object} home  The Home's row: address, address2, city, state, zipcode
 * @param {object|null} copy  Its served copy
 * @param {object} [options]  `{ list: true }` for the appeal packet's PDF only (see the note at the top)
 * @returns {Promise<object|null>}
 */
async function forHome(home, copy, options) {
  if (!config.enabled() || !home || !copy || copy.match !== 'exact' || copy.subject?.kind !== 'property') return null;
  if (!router.similarHomesFor(copy.jurisdiction)) return null;
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), SCREEN_WAIT_MS); });
  const answer = read(home, copy, options).catch((err) => {
    if (!(err instanceof reader.StorageUnavailable)) logger.warn('property_records.similar_homes_failed', { fips: copy.jurisdiction, error: err.name });
    return null;
  });
  try {
    return await Promise.race([answer, late]);
  } finally {
    clearTimeout(timer);
  }
}

const VALUE_WORDS = { market_value: 'market value', assessed_value: 'assessed value' };
const valueWords = (found) => `the county's ${found.value_year ? `${found.value_year} ` : ''}${VALUE_WORDS[found.basis]}`;

const standing = (found) => (found.stance === 'near' ? 'within 5% of' : `${Math.abs(found.pct)}% ${found.stance}`);

/** The value card's rows (services/homeValueCard.js): this home and the houses like it, per square foot. */
function rows(found) {
  return [
    { id: 'similar_homes_yours', label: 'This home, per square foot', value: money(found.yours_per_sqft) },
    { id: 'similar_homes_typical', label: `Typical of ${found.homes} similar homes on this street`, value: money(found.typical_per_sqft) },
    { id: 'similar_homes_range', label: 'Their range', value: `${money(found.low_per_sqft)} – ${money(found.high_per_sqft)}` },
  ];
}

/** What was compared, and what it does and doesn't mean. */
function note(found) {
  const appeal = found.stance === 'above' ? ' Counties hear appeals from owners who think their value is too high, and similar homes valued lower are a usual reason given.' : '';
  return `By ${valueWords(found)} per square foot, this home is ${standing(found)} the typical similar home on its street. Similar homes are houses on the same street, within 25% of this home's living area${found.lots ? ', 50% of its lot size' : ''} and 15 years of its age, from ${found.publisher}'s records.${appeal} This is information, not tax advice.`;
}

const CHIP_TONES = { above: 'warning', near: 'neutral', below: 'success' };

/**
 * The money page's "Property tax check" card, in words the apps draw as they come (serializers/placeIntelligenceSerializer.js
 * `money_cards`): the answer as a chip and one line, then the value card's rows and note.
 */
function card(found) {
  return {
    id: 'property_tax_check',
    title: 'Property tax check',
    chip: { tone: CHIP_TONES[found.stance], text: found.stance === 'near' ? 'Within 5%' : `${Math.abs(found.pct)}% ${found.stance}` },
    lead: `The county values this home ${standing(found)} similar homes on its street, per square foot.`,
    rows: rows(found),
    notes: [note(found)],
  };
}

/** One true line for someone who hasn't verified the address yet: how it compares only when it is above, and never a dollar figure. */
function teaser(found) {
  if (found.stance === 'above') return `The county values this home ${found.pct}% above similar homes on its street, per square foot.`;
  return `We compared the county's value for this home with ${found.homes} similar homes on its street.`;
}

module.exports = { forHome, compare, rows, note, card, teaser };

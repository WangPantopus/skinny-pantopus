'use strict';
// What a county's record says without saying it twice: the other unit of its lot, and the plain words for what its own codes
// said this home is. Nothing here looks past the record.
//
// deriveRows adds the rows the record implies but doesn't state (full-page-plan.md, section 7, WP19): a lot number or a
// subdivision its legal description plainly names, "Garage: Yes" where it gives a garage area, the class and subtype its use
// code means in a code list the state or county publishes, stories and gross area from the floor areas a county lists, and
// the city or town whose official limits hold the home's address point. Each fills only a row the county leaves empty, says what it came from, and waits in the record's
// `held.derived_rows` until the county is on the switch file's `derived_rows` list, so a republish changes no live page.

const { sortKey } = require('../../../backend/services/propertyRecords/addressKey');
const { wholeLot } = require('./legal.cjs');
const { subdivisionReader } = require('./subdivisions.cjs');
const { addMunicipalities } = require('./places.cjs');
const { useCodeWords } = require('./use-codes.cjs');
const { log } = require('./log.cjs');

const ACRE = 43560;
const TYPE_WORDS = {
  'property:house': 'Single family residence', 'property:townhouse': 'Townhouse', 'property:mobile_home': 'Manufactured or mobile home', 'property:condo': 'Condominium',
  'unit:condo': 'Condominium', 'building:condo': 'Condominium building', 'building:multi_unit': 'Multi-family building', 'building:apartment': 'Apartment building',
};
const SWITCH = 'derived_rows';
// Counts where a county's 0 is its answer: none.
const ZERO_MEANS_NONE = [['fireplaces', 'fireplace count'], ['half_baths', 'half-bath count']];
// Sources whose files list each floor's area and state neither a story count nor a gross area for homes (plan 5.5;
// measured Nov 13). 'floors': the record's ground and second floor areas must add up to its living area, so no floor goes
// unlisted (Dane County WI: 41,173 homes). 'living': the county's living area is its floors added up on every home, so the
// record carries only the first (Clark County NV: TOTSQFT = FLR1SQFT + FLR2SQFT on all 763,199 homes with a first floor).
const FLOOR_LISTS = { 'wi-madison': 'floors', 'nv-clark': 'living' };
// Split and bi-level homes: their floors don't give a story count (a lower level can sit in the county's basement columns).
const SPLIT_LEVELS = /SPLIT|BI-?LEVEL|TRI-?LEVEL|MULTI-?LEVEL/i;

/**
 * The other unit of a lot and the type's words, into the record's facts as before; with a county (build.cjs), also the
 * rows it implies (deriveRows), held off screens. Returns { held_from: { derived_rows: { <fact>: words } } } when any is
 * held, for the county's entry (format.js `held_from`); nothing otherwise.
 */
function deriveFacts(records, county = null, { work = null } = {}) {
  for (const { kind, home_type: homeType, facts, restricted } of records) {
    if (restricted || !facts) continue;
    if (facts.lot_sqft > 0 && !(facts.lot_acres > 0)) facts.lot_acres = Number((facts.lot_sqft / ACRE).toFixed(4));
    else if (facts.lot_acres > 0 && !(facts.lot_sqft > 0)) facts.lot_sqft = Math.round(facts.lot_acres * ACRE);
    const words = TYPE_WORDS[`${kind}:${homeType}`];
    if (words && !facts.property_type) facts.property_type = words;
  }
  if (!county) return undefined;
  const from = deriveRows(records, county, { work });
  return Object.keys(from).length ? { held_from: { [SWITCH]: from } } : undefined;
}

/**
 * The office that keeps the record, for "From <office>'s legal description": a state's copy names the county office it
 * copies ("Gunnison County Assessor, through the State of Colorado (OIT)", "Florida Department of Revenue and the Alachua
 * County Property Appraiser"); the copy's own publisher stays in the footer.
 */
function officeOf(publisher) {
  const name = String(publisher || '').trim();
  const through = name.split(/,\s+through\s+/i)[0];
  const and = / and (the [A-Z].*)$/.exec(through);
  return and ? and[1] : through;
}

/** A county's own name, for a jurisdiction field that names the county: "CLARK COUNTY", "Clark Co", "Clark". */
const plain = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function namesTheCounty(value, county) {
  const name = plain(county.name);
  const bare = plain(String(county.name || '').replace(/\s+(County|Parish|Borough|Census Area|Municipality|city)$/i, ''));
  const said = plain(value);
  return said === name || said === `${bare}CO` || said === `${bare}COUNTY` || /^UNINC/.test(said);
}

/**
 * The derived rows, for every county a build writes. `county` is its state file entry ({ fips, state, name, publisher }).
 * Returns { <fact>: words } for the facts held, which the county's entry carries as `held_from.derived_rows`.
 */
function deriveRows(records, county, { work = null } = {}) {
  const from = {};
  const counts = {};
  const office = officeOf(county.publisher);
  /** Holds a derived value for a fact the record leaves empty (or, for the county's own name as its city, rewords it). */
  function hold(record, fact, value, words, { rewording = false } = {}) {
    const stated = record.facts[fact] !== undefined || record.held?.new_columns?.[fact] !== undefined;
    if ((stated && !rewording) || value === null || value === undefined || value === '') return false;
    // A county's row says one source for every home: a second source for the same fact holds nothing (counted, never shown).
    if (from[fact] && from[fact] !== words) { counts[`${fact} from a second source, left out`] = (counts[`${fact} from a second source, left out`] || 0) + 1; return false; }
    record.held = record.held || {};
    record.held[SWITCH] = record.held[SWITCH] || {};
    if (record.held[SWITCH][fact] !== undefined) return false;
    record.held[SWITCH][fact] = value;
    from[fact] = words;
    counts[fact] = (counts[fact] || 0) + 1;
    return true;
  }
  /** Words for a fact a connector held itself; a second source for it is left out like any other. */
  function labelHeld(fact, words) {
    if (from[fact] && from[fact] !== words) return false;
    from[fact] = words;
    counts[fact] = (counts[fact] || 0) + 1;
    return true;
  }
  /** Holds a value beside a fact the county already states (a county's own 0), without touching its facts. */
  function holdBeside(record, fact, value, words) {
    if (!labelHeld(fact, words)) return false;
    record.held = record.held || {};
    record.held[SWITCH] = record.held[SWITCH] || {};
    record.held[SWITCH][fact] = value;
    return true;
  }
  const subdivision = subdivisionReader(records, county);
  const uses = useCodeWords({ ...county, publisher: office });
  for (const record of records) {
    const { facts } = record;
    if (record.restricted || !facts) continue;
    // A county's 0 reads "None" (decision 4), only on a building it describes. A connector holds a 0 it newly keeps in
    // held.derived_rows itself (so the record's facts, which Today's house shape reads, stay as they were); a 0 already in
    // the facts stays there too, and is held as well. Either way it shows only while the switch is on.
    const described = facts.living_sqft > 0 || facts.gross_sqft > 0;
    for (const [fact, words] of ZERO_MEANS_NONE) {
      const heldZero = record.held?.[SWITCH]?.[fact] === 0;
      if (heldZero && !described) delete record.held[SWITCH][fact];
      else if (heldZero) labelHeld(fact, `From ${office}’s ${words}`);
      else if (facts[fact] === 0 && described) holdBeside(record, fact, 0, `From ${office}’s ${words}`);
    }
    if (facts.legal_description) {
      hold(record, 'lot_number', wholeLot(facts.legal_description), `From ${office}’s legal description`);
      if (subdivision) hold(record, 'subdivision', subdivision(facts.legal_description), `From ${office}’s legal description`);
    }
    if (facts.garage_sqft > 0) hold(record, 'garage', 'Yes', `From ${office}’s garage area`);
    // Stories and gross area from the county's own floor areas, where it lists each floor (FLOOR_LISTS). One listed floor
    // holding all the living area is one story; two floors don't say whether the upper one is a full or a half story, so
    // they give none. The gross area is the floors and the basement added up (a garage isn't: the files don't say it's
    // part of the house). A house's or townhouse's own floors only: a unit's would read as its building's (facts.js).
    const floorList = FLOOR_LISTS[county.source];
    if (floorList && record.kind === 'property' && facts.ground_floor_sqft > 0 && facts.living_sqft > 0) {
      const floors = floorList === 'living' ? facts.living_sqft : facts.ground_floor_sqft + (facts.second_floor_sqft || 0);
      if (floors === facts.living_sqft) {
        const words = `From ${office}’s floor areas`;
        if (facts.ground_floor_sqft === facts.living_sqft && !SPLIT_LEVELS.test(facts.style || '')) hold(record, 'stories', 1, words);
        hold(record, 'gross_sqft', floors + (facts.basement_sqft || 0), words);
      }
    }
    if (uses) {
      const meant = uses.words(facts);
      if (meant) {
        hold(record, 'property_class', meant.class, uses.from);
        hold(record, 'property_subtype', meant.subtype, uses.from);
      }
    }
  }
  // The city or town limits that hold the home's point: for a home whose county names no municipality, and, reworded, for one
  // whose county names itself ("Clark County") where the limits agree it's in no city.
  const asks = (record) => {
    if (record.facts.municipality === undefined) return 'fill';
    return namesTheCounty(record.facts.municipality, county) ? 'reword' : null;
  };
  if (work) addMunicipalities(records, county, work, hold, sortKey, asks);
  for (const record of records) {
    if (record.held?.[SWITCH] && !Object.keys(record.held[SWITCH]).length) delete record.held[SWITCH];
    if (record.held && !Object.keys(record.held).length) delete record.held;
  }
  log(`${county.fips}: derived rows held: ${Object.entries(counts).map(([fact, n]) => `${fact} ${n}`).join(', ') || 'none'}`);
  return from;
}

module.exports = { deriveFacts, deriveRows, namesTheCounty, officeOf, SWITCH };

'use strict';
// What a county's record says without saying it twice: the other unit of its lot, and the plain words for what its own codes
// said this home is. Nothing here looks past the record.
//
// deriveRows adds the rows the record implies but doesn't state (full-page-plan.md, section 7, WP19): a lot number or a
// subdivision its legal description plainly names, "Garage: Yes" where it gives a garage area, the class and subtype its use
// code means in a code list the state or county publishes, and the city or town whose official limits hold the home's
// address point. Each fills only a row the county leaves empty, says what it came from, and waits in the record's
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

function deriveFacts(records) {
  for (const { kind, home_type: homeType, facts, restricted } of records) {
    if (restricted || !facts) continue;
    if (facts.lot_sqft > 0 && !(facts.lot_acres > 0)) facts.lot_acres = Number((facts.lot_sqft / ACRE).toFixed(4));
    else if (facts.lot_acres > 0 && !(facts.lot_sqft > 0)) facts.lot_sqft = Math.round(facts.lot_acres * ACRE);
    const words = TYPE_WORDS[`${kind}:${homeType}`];
    if (words && !facts.property_type) facts.property_type = words;
  }
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
  const office = county.publisher;
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
  const subdivision = subdivisionReader(records, county);
  const uses = useCodeWords(county);
  for (const record of records) {
    const { facts } = record;
    if (record.restricted || !facts) continue;
    // A connector keeps a county's 0 only where the county describes the building; it reads "None" (decision 4).
    for (const [fact, words] of ZERO_MEANS_NONE) {
      if (facts[fact] === 0) {
        delete facts[fact];
        hold(record, fact, 0, `From ${office}’s ${words}`);
      }
    }
    if (facts.legal_description) {
      hold(record, 'lot_number', wholeLot(facts.legal_description), `From ${office}’s legal description`);
      if (subdivision) hold(record, 'subdivision', subdivision(facts.legal_description), `From ${office}’s legal description`);
    }
    if (facts.garage_sqft > 0) hold(record, 'garage', 'Yes', `From ${office}’s garage area`);
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
  log(`${county.fips}: derived rows held: ${Object.entries(counts).map(([fact, n]) => `${fact} ${n}`).join(', ') || 'none'}`);
  return from;
}

module.exports = { deriveFacts, deriveRows, namesTheCounty, SWITCH };

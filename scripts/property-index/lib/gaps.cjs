'use strict';
// The missing-facts ledger's rule: which Property details fields apply to each kind of home record, and which of them a
// record leaves empty. gaps.cjs runs it over each county's serving release; gaps-read.cjs lists what it found.
//
// The fields are the 46 of docs/research/provider-replacement/property-fields.md, by the facts that fill each (WP5
// counted the same 41). Not counted: Pantopus ID, which Pantopus gives every exact match; the four estimate rows, model
// output that never fills a record's field (architecture.md section 7); and Occupancy, a private flag no release holds
// (evidence/subject-scopes.csv). Which fields apply to a kind follows that scope matrix and facts.js's scopes, as the
// screens do (serializers/countyRecordSerializer.js): a condo unit has no lot of its own, a building no bedrooms.
// A field is missing when Property details would show no row for it: a blank, an unknown word or a zero shows nothing.

const crypto = require('node:crypto');
const { FACTS } = require('../../../backend/services/propertyRecords/facts');
const { deriveFacts } = require('./derive.cjs');

const FIELDS = [
  ['year_built', 'Year built', ['year_built']],
  ['effective_year_built', 'Effective year built', ['effective_year_built']],
  ['living_area', 'Living area', ['living_sqft', 'usable_sqft']],
  ['gross_area', 'Gross area', ['gross_sqft']],
  ['ground_floor_area', 'Ground floor area', ['ground_floor_sqft']],
  ['stories', 'Stories', ['stories']],
  ['bedrooms', 'Bedrooms', ['bedrooms']],
  ['bathrooms', 'Bathrooms', ['bathrooms']],
  ['full_baths', 'Full baths', ['full_baths']],
  ['partial_baths', 'Partial baths', ['half_baths', 'three_quarter_baths']],
  ['fireplaces', 'Fireplaces', ['fireplaces']],
  ['style', 'Architectural style', ['style']],
  ['condition', 'Condition', ['condition']],
  ['quality', 'Quality', ['quality']],
  ['buildings_on_parcel', 'Buildings on the parcel', ['buildings_on_parcel']],
  ['exterior_walls', 'Exterior walls', ['exterior_walls']],
  ['roof_cover', 'Roof cover', ['roof_cover']],
  ['heating', 'Heating', ['heating']],
  ['cooling', 'Cooling', ['cooling']],
  ['garage', 'Garage', ['garage']],
  ['parking_type', 'Parking type', ['parking_type']],
  ['parking_spaces', 'Parking spaces', ['parking_spaces']],
  ['parking_area', 'Parking area', ['garage_sqft', 'carport_sqft']],
  ['lot_size', 'Lot size', ['lot_acres']],
  ['lot_area', 'Lot area', ['lot_sqft']],
  ['lot_number', 'Lot number', ['lot_number']],
  ['address_on_record', 'Address on record', ['address_on_record']],
  ['zip_plus4', 'ZIP+4', ['zip_plus4']],
  ['parcel_number', 'Parcel number (APN)', ['parcel_number']],
  ['county', 'County', ['county']],
  ['fips', 'County code (FIPS)', ['fips']],
  ['municipality', 'Municipality', ['municipality']],
  ['subdivision', 'Subdivision', ['subdivision']],
  ['tax_code_area', 'Tax code area', ['tax_code_area']],
  ['property_type', 'Property type', ['property_type']],
  ['property_class', 'Property class', ['property_class']],
  ['property_subtype', 'Property subtype', ['property_subtype']],
  ['land_use', 'Land use', ['land_use']],
  ['county_use_code', 'County use code', ['county_use_code']],
  ['legal_description', 'Legal description', ['legal_description']],
].map(([id, label, facts]) => ({ id, label, facts }));

const NOT_COUNTED = [
  ['Pantopus ID', 'Pantopus gives every exact match its own ID'],
  ['Estimated value', 'model output, never a record field'],
  ['Estimate range', 'model output, never a record field'],
  ['Confidence score', 'model output, never a record field'],
  ['Estimate date', 'model output, never a record field'],
  ['Occupancy', 'a private flag; no release holds it'],
];

const ids = (list) => FIELDS.map((field) => field.id).filter((id) => list.includes(id));
const ALL = FIELDS.map((field) => field.id);
const LOT = ['lot_size', 'lot_area', 'lot_number'];
// The building's own figures: what a building record has, and what a unit's page shows in its Building group.
const STRUCTURE = ['year_built', 'effective_year_built', 'gross_area', 'stories', 'style', 'quality', 'buildings_on_parcel', 'exterior_walls', 'roof_cover'];
const ACCOUNT = ['address_on_record', 'zip_plus4', 'parcel_number', 'county', 'fips', 'municipality', 'subdivision', 'tax_code_area',
  'property_type', 'property_class', 'property_subtype', 'land_use', 'county_use_code', 'legal_description'];

const KINDS = {
  house: { label: 'House', fields: ALL },
  townhouse: { label: 'Townhouse', fields: ALL },
  mobile_home: { label: 'Mobile home', fields: ALL },
  home: { label: 'Home, type not recorded', fields: ALL },
  // The complex's common land is never the unit's lot, a stacked unit has no ground floor of its own, and the parent
  // parcel's building count isn't the unit's.
  condo_unit: { label: 'Condo unit', fields: ALL.filter((id) => ![...LOT, 'ground_floor_area', 'buildings_on_parcel'].includes(id)) },
  // A building's rooms, areas, systems and parking are its units': only its own figures, its lot and its account apply.
  small_multi_unit: { label: 'Two-to-four-unit building', fields: ids([...STRUCTURE, ...LOT, ...ACCOUNT]) },
  building: { label: 'Apartment or other building', fields: ids([...STRUCTURE, ...LOT, ...ACCOUNT]) },
  // A condo's common record is no tax account (each unit is) and its land is shared.
  condo_building: { label: 'Condo building', fields: ids([...STRUCTURE.filter((id) => id !== 'buildings_on_parcel'), 'county', 'fips', 'municipality', 'property_type']) },
};

// Homes missing any one of these, counted as well: the founder's first ask, then the facts a person looks for first.
const SETS = {
  bedrooms_or_bathrooms: ['bedrooms', 'bathrooms'],
  core: ['bedrooms', 'bathrooms', 'living_area', 'year_built', 'lot_size'],
};

/** The ledger's kind for a record, or null when it isn't a home (land, a business, a public building). */
function kindOf(record) {
  if (record.kind === 'property') return { house: 'house', townhouse: 'townhouse', mobile_home: 'mobile_home', condo: 'condo_unit' }[record.home_type] || 'home';
  if (record.kind === 'unit') return 'condo_unit';
  if (record.kind === 'building') return { condo: 'condo_building', multi_unit: 'small_multi_unit' }[record.home_type] || 'building';
  return null;
}

// What Property details shows, as countyRecordSerializer.js's format() decides it.
const UNKNOWN = new Set(['', 'TYPE UNKNOWN', 'UNKNOWN', 'UNK', 'N/A', 'NA', 'NOT AVAILABLE']);
const words = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return UNKNOWN.has(text.toUpperCase()) ? null : text;
};
const positive = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function shown(format, value) {
  if (value === undefined || value === null) return false;
  if (format === 'text' || format === 'code') {
    if (typeof value === 'number') return positive(value) !== null;
    const text = words(value);
    return Boolean(text) && !(format === 'code' && text === '0');
  }
  if (format === 'name' || format === 'raw') return Boolean(words(value));
  const n = positive(value);
  return n !== null && (format !== 'year' || (n >= 1000 && n <= 2200));
}

const has = (field, facts) => field.facts.some((fact) => shown(FACTS[fact].format, facts[fact]));
// A count the county wrote as zero shows nothing, but it's the county's answer: no bedroom of its own, no fireplace.
const zero = (field, facts) => field.facts.some((fact) => ['count', 'baths'].includes(FACTS[fact].format) && (facts[fact] === 0 || facts[fact] === '0'));
const BY_ID = new Map(FIELDS.map((field) => [field.id, field]));

/** A building's facts a unit's page shows with it (homeRecord.js copyFromAnswer). */
function buildingFacts(building) {
  return Object.fromEntries(Object.entries(building.facts || {}).filter(([name]) => ['building', 'parcel'].includes(FACTS[name]?.scope) && !FACTS[name].value));
}

/** The ids of the fields these facts fill, of those in `list`. */
const filled = (list, facts) => list.filter((id) => has(BY_ID.get(id), facts));

/**
 * One home record's gaps, as its Property details shows it.
 * @param {object} record     a release's record of a home kind (kindOf), not restricted
 * @param {object} [building] the unit's building at its own address, whose figures its page shows (identity.js)
 * @returns {{ kind: string, missing: string[], zero: string[], next_build: string[] }}
 */
function gapsOf(record, building = null) {
  const kind = kindOf(record);
  const facts = building ? { ...buildingFacts(building), ...(record.facts || {}) } : (record.facts || {});
  const missing = KINDS[kind].fields.filter((id) => !has(BY_ID.get(id), facts));
  // What the next build of the county fills from the record itself (derive.cjs): one lot unit from the other, the type's words.
  const derived = { kind: record.kind, home_type: record.home_type, facts: { ...facts } };
  deriveFacts([derived]);
  return {
    kind,
    missing,
    zero: missing.filter((id) => zero(BY_ID.get(id), facts)),
    next_build: missing.filter((id) => has(BY_ID.get(id), derived.facts)),
  };
}

/** The address as the record holds it, on one line. */
function addressLine(address) {
  const street = [address.number, address.pre, address.name, address.suffix, address.post].filter(Boolean).join(' ');
  const unit = [address.building && `BLDG ${address.building}`, address.unit && `#${address.unit}`].filter(Boolean).join(' ');
  const place = [address.urbanization && `URB ${address.urbanization}`, address.city, address.zip].filter(Boolean).join(' ');
  return [[street, unit].filter(Boolean).join(' '), place].filter(Boolean).join(', ');
}

/** Whether an address was taken down at someone's request (propertyRecords/index.js suppressionHash). */
function suppressed(suppressions, fips, address) {
  if (!suppressions?.hashes?.length) return false;
  const hash = crypto.createHash('sha256')
    .update([suppressions.salt, fips, address.number, address.pre, address.name, address.suffix, address.post, address.unit].join('|')).digest('hex');
  return suppressions.hashes.includes(hash);
}

/** Which takedown list a ledger was written against (null for none): one written before the latest takedown may still list that address. */
function takedownsId(suppressions) {
  if (!suppressions?.hashes?.length) return null;
  return crypto.createHash('sha256').update(JSON.stringify([suppressions.salt, [...suppressions.hashes].sort()])).digest('hex').slice(0, 16);
}

const RULE = {
  fields: FIELDS.map(({ id, label }) => [id, label]),
  kinds: Object.fromEntries(Object.entries(KINDS).map(([id, { label, fields }]) => [id, { label, fields }])),
  not_counted: NOT_COUNTED,
  sets: SETS,
};

module.exports = { FIELDS, KINDS, SETS, RULE, kindOf, gapsOf, buildingFacts, filled, addressLine, suppressed, takedownsId, STRUCTURE };

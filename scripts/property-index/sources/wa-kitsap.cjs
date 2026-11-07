'use strict';
// Kitsap County, Washington: the Assessor's parcel data files, tab-delimited and updated weekly, each with its published layout and a code table.
// The download page and the county's website policies state no limit on use. Parcels (acres, class), dwellings (year built, living area, bedrooms,
// baths), manufactured homes, site addresses and certified values. These files carry no owner names, and none would be read (RCW 42.56.070(8)).
// The files declare no text qualifier, so quotes are ordinary characters.

const path = require('node:path');
const { download } = require('../lib/tables.cjs');
const { csvRows } = require('../lib/csv.cjs');
const { streetParts, year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '53035';
const COUNTY = 'Kitsap County';
const BASE = 'https://www.kitsap.gov/assessor/Documents';
const LAYOUTS = ['parcels', 'dwellings', 'mh', 'property_addresses', 'valuations'].map((name) => `${BASE}/${name}.pdf`);
const PARCEL_COLUMNS = ['rp_acct_id', 'acct_no', 'jurisdiction', 'acres', 'nbrhd', 'property_class'];
const DWELLING_COLUMNS = ['rp_acct_id', 'above_lvg_sf', 'lower_lvg_sf', 'bsmt_tot_sf', 'bsmt_lvg_sf', 'heating', 'air_cond', 'house_type', 'roof_material', 'bedrms', 'full_baths', 'half_baths', 'qual', 'yr_blt'];
const HOME_COLUMNS = ['rp_acct_id', 'yr_blt', 'mh_size'];
const ADDRESS_COLUMNS = ['rp_acct_id', 'st_no', 'prefix', 'street_name', 'identifier', 'suffix', 'suite_unit', 'city', 'zip_code'];
const VALUE_COLUMNS = ['rp_acct_id', 'tax_yr', 'land_mkt_av', 'impr_av', 'market_value', 'taxable_av'];
const TAB = { delimiter: '\t', encoding: 'latin1', quoted: false };

// The county's property classes, from its code table: 111 a single-family residence, 198 a cabin, 141 a residential condominium, 118 and 119 a
// manufactured home, 121-123 two to four units, 131-138 five or more, 910-990 undeveloped land (911 a common area is other).
function useOf(code, unit) {
  const c = String(code || '').trim();
  if (c === '111' || c === '198') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '141') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '118' || c === '119') return ['property', 'mobile_home'];
  if (/^12[1-3]$/.test(c)) return ['building', 'multi_unit'];
  if (/^13[1-8]$/.test(c)) return ['building', 'apartment'];
  if (/^9[1-9]\d$/.test(c) && c !== '911') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(parcel, { address: place, dwelling, home: manufactured, value }) {
  if (!place) return null;
  const unit = realUnit(word(place.suite_unit));
  const address = streetParts({ number: place.st_no, pre: word(place.prefix) || '', name: word(place.street_name) || '', suffix: word(place.identifier) || '', post: word(place.suffix) || '', unit });
  const account = word(parcel.rp_acct_id);
  if (!address || !account) return null;
  const [kind, homeType] = useOf(parcel.property_class, address.unit);
  const facts = { parcel_number: word(parcel.acct_no) || account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([place.st_no, place.prefix, place.street_name, place.identifier, place.suffix].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(parcel.property_class));
  put(facts, 'neighborhood', word(parcel.nbrhd));
  put(facts, 'municipality', word(parcel.jurisdiction));
  if (home && dwelling) {
    put(facts, 'year_built', year(dwelling.yr_blt));
    // Living area: the levels at or above grade, and a split level's lower level; a basement's finished area is its own fact.
    put(facts, 'living_sqft', (positive(dwelling.above_lvg_sf) || 0) + (positive(dwelling.lower_lvg_sf) || 0) || null);
    put(facts, 'basement_sqft', positive(dwelling.bsmt_tot_sf));
    put(facts, 'basement_finished_sqft', positive(dwelling.bsmt_lvg_sf));
    put(facts, 'bedrooms', inRange(dwelling.bedrms, 15));
    const [full, half] = [inRange(dwelling.full_baths, 12), inRange(dwelling.half_baths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'style', word(dwelling.house_type));
    // Condition is a code the county's table doesn't explain, so it's left out.
    put(facts, 'quality', word(dwelling.qual));
    put(facts, 'heating', word(dwelling.heating));
    put(facts, 'cooling', word(dwelling.air_cond));
    put(facts, 'roof_cover', word(dwelling.roof_material));
  } else if (home && manufactured) {
    put(facts, 'year_built', year(manufactured.yr_blt));
    put(facts, 'living_sqft', positive(manufactured.mh_size));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(parcel.acres));
  if (value) {
    put(facts, 'tax_year', positive(value.tax_yr));
    put(facts, 'market_value', positive(value.market_value));
    put(facts, 'market_land_value', positive(value.land_mkt_av));
    put(facts, 'market_building_value', positive(value.impr_av));
    put(facts, 'taxable_value', positive(value.taxable_av));
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(place.city) || '').toUpperCase(), zip: zipCode(place.zip_code) || null }, facts };
}

async function* build({ work, today }) {
  const dir = path.join(work, 'wa-kitsap');
  const file = (name) => {
    const local = path.join(dir, `${name}.txt`);
    download(`${BASE}/${name}.txt`, local);
    return local;
  };
  const largest = async (name, columns, area) => {
    const kept = new Map();
    for await (const row of csvRows(file(name), columns, { ...TAB, label: `${name} file` })) {
      const was = kept.get(row.rp_acct_id);
      if (!was || area(row) > area(was)) kept.set(row.rp_acct_id, row);
    }
    return kept;
  };
  const dwellings = await largest('Dwellings', DWELLING_COLUMNS, (row) => (positive(row.above_lvg_sf) || 0) + (positive(row.lower_lvg_sf) || 0));
  const homes = await largest('MH', HOME_COLUMNS, (row) => positive(row.mh_size) || 0);
  // Values for the next tax year are certified in the fall; the latest certified year stands.
  const values = await largest('Valuations', VALUE_COLUMNS, (row) => positive(row.tax_yr) || 0);
  // A parcel with several site addresses has several rows: the first stands.
  const addresses = new Map();
  for await (const row of csvRows(file('Property_addresses'), ADDRESS_COLUMNS, { ...TAB, label: 'Property_addresses file' })) if (!addresses.has(row.rp_acct_id)) addresses.set(row.rp_acct_id, row);
  const records = [];
  let noAddress = 0;
  for await (const parcel of csvRows(file('Parcels'), PARCEL_COLUMNS, { ...TAB, label: 'Parcels file' })) {
    const key = parcel.rp_acct_id;
    const record = fromRow(parcel, { address: addresses.get(key), dwelling: dwellings.get(key), home: homes.get(key), value: values.get(key) });
    if (record) records.push(record);
    else noAddress += 1;
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a site address; ${dwellings.size} dwellings, ${homes.size} manufactured homes, ${values.size} values`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'WA', name: COUNTY, publisher: 'Kitsap County Assessor', dataset: 'parcel data files', method: 'county', source: 'wa-kitsap', as_of: isoDate(today.getTime()), stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: [...new Set([...PARCEL_COLUMNS, ...DWELLING_COLUMNS, ...HOME_COLUMNS, ...ADDRESS_COLUMNS, ...VALUE_COLUMNS])],
    text: LAYOUTS,
    facts: { year_built: 'yr_blt', living_sqft: 'above_lvg_sf', basement_sqft: 'bsmt_tot_sf', basement_finished_sqft: 'bsmt_lvg_sf', bedrooms: 'bedrms', bathrooms: 'full_baths', full_baths: 'full_baths', half_baths: 'half_baths', lot_acres: 'acres', tax_year: 'tax_yr', market_value: 'market_value', market_land_value: 'land_mkt_av', market_building_value: 'impr_av', taxable_value: 'taxable_av' },
  },
};

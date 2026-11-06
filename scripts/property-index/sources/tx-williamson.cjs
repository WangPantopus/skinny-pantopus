'use strict';
// Williamson County, Texas: the Williamson Central Appraisal District's open data portal. Its property and characteristics
// tables have no owner columns (owners are a separate table, never read here). Bedrooms are on about a quarter of homes;
// year built, baths and size on nearly all. Sale prices aren't public in Texas.

const path = require('node:path');
const { parts } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48491';
const COUNTY = 'Williamson County';
const DOMAIN = 'data.wcad.org';
const PROPERTIES = 'ij43-xknu';
const CHARACTERISTICS = 'cvyp-ab5t';
const PROPERTY_COLUMNS = ['propertyid', 'quickrefid', 'legaldesc', 'legalacres', 'subunit', 'currmarketvalue', 'currlandvalue', 'currimprovmentvalue', 'squarefootage', 'nbhddesc', 'situs', 'situspredirectional', 'situsstreetnumber', 'situsstreetname', 'situsstreetsuffix', 'situspostdirectional', 'situscity', 'situszip'];
const BUILDING_COLUMNS = ['propertyid', 'segclass', 'actyrbuilt', 'feffyear', 'sqftcur', 'fbedrooms', 'fplumbing', 'fnumhalfbath', 'garagearea', 'poolarea', 'datadate'];
// The file has a few typing slips (a bedroom count of 928): nothing past these is a home's count.
const inRange = (text, most) => {
  const value = positive(text);
  return value && value <= most ? value : null;
};

function fromRow(row, building, taxYear) {
  const address = parts({ number: row.situsstreetnumber, pre: row.situspredirectional, name: row.situsstreetname, suffix: row.situsstreetsuffix, post: row.situspostdirectional, unit: realUnit(row.subunit) });
  const account = word(row.quickrefid) || word(row.propertyid);
  if (!address || !account) return null;
  const residential = /^R/i.test(String(building?.segclass ?? ''));
  const improved = positive(row.currimprovmentvalue);
  let [kind, homeType] = ['other', null];
  if (residential) [kind, homeType] = address.unit ? ['unit', 'condo'] : ['property', 'house'];
  else if (!improved && !building) kind = 'parcel';
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', word(row.situs));
  if (home) {
    put(facts, 'year_built', year(Math.trunc(Number(building.actyrbuilt))));
    put(facts, 'effective_year_built', year(Math.trunc(Number(building.feffyear))));
    put(facts, 'living_sqft', positive(building.sqftcur) || positive(row.squarefootage));
    put(facts, 'bedrooms', inRange(building.fbedrooms, 15));
    const [full, half] = [inRange(building.fplumbing, 20), inRange(building.fnumhalfbath, 10)];
    put(facts, 'full_baths', full && Math.trunc(full));
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'garage_sqft', positive(building.garagearea));
    if (positive(building.poolarea)) facts.pool = 'Yes';
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.legalacres));
  put(facts, 'neighborhood', word(row.nbhddesc));
  put(facts, 'legal_description', word(row.legaldesc)?.slice(0, 300));
  if (taxYear) facts.value_year = taxYear;
  put(facts, 'market_value', positive(row.currmarketvalue));
  put(facts, 'market_land_value', positive(row.currlandvalue));
  put(facts, 'market_building_value', improved);
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.situscity) || '').toUpperCase(), zip: zipCode(row.situszip) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`https://${DOMAIN}/api/views/${PROPERTIES}.json`, 'The dataset\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The dataset no longer says when it changed');
  const buildings = new Map();
  for await (const row of cached(path.join(work, 'tx-williamson', 'characteristics.jsonl.gz'), () => socrataRows(DOMAIN, CHARACTERISTICS, BUILDING_COLUMNS))) {
    // One row per segment: the largest is the home.
    const was = buildings.get(row.propertyid);
    if (!was || Number(row.sqftcur) > Number(was.sqftcur)) buildings.set(row.propertyid, row);
  }
  log(`${buildings.size} properties with characteristics`);
  const records = [];
  let noAddress = 0;
  const taxYear = Number(asOf.slice(0, 4));
  for await (const row of cached(path.join(work, 'tx-williamson', 'properties.jsonl.gz'), () => socrataRows(DOMAIN, PROPERTIES, PROPERTY_COLUMNS))) {
    const record = fromRow(row, buildings.get(row.propertyid), taxYear);
    if (record) records.push(record);
    else noAddress += 1;
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Williamson Central Appraisal District', dataset: 'open data', method: 'county', source: 'tx-williamson', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = { build };

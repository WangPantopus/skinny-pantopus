'use strict';
// Oklahoma County, Oklahoma: the Assessor's own public record tables on its map server. No terms are stated on the service. The owner
// table is never read; neither are the owner-occupied flag, the sales table's grantor and grantee, or mobile-home title numbers.
// total_market_value is the Assessor's fair cash value. Sale prices come from the Assessor's sales table.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '40109';
const COUNTY = 'Oklahoma County';
const BASE = 'https://okassessor.oklahomacounty.org/server/rest/services/Hosted/View_OKPublicRecord/FeatureServer';
const ACCOUNT_COLUMNS = ['account_num', 'parcel_num', 'account_type', 'house_num', 'direction', 'street_name', 'street_suffix', 'unit', 'full_address', 'city', 'full_legal', 'subdivision_description', 'land_total_acres', 'land_total_sq_foot', 'tax_district', 'total_market_value', 'total_taxable_value', 'total_assessed_value', 'status'];
const BUILDING_COLUMNS = ['account_num', 'property_type', 'occupancy_description', 'square_feet', 'condominium_square_feet', 'total_basement_square_feet', 'finished_basement_square_feet', 'garage_square_feet', 'carport_square_feet', 'percent_complete', 'condition', 'quality', 'heat_vent_air_description', 'exterior', 'number_of_stories', 'roof_cover', 'foundation_type', 'number_of_rooms', 'number_of_bedrooms', 'number_of_bathrooms', 'number_of_units', 'type_of_construction_description', 'year_built', 'adjusted_year_built'];
const SALE_COLUMNS = ['account_num', 'reception_num', 'sale_price', 'sale_date', 'valid'];
const CONDITIONS = { EX: 'Excellent', VG: 'Very good', GD: 'Good', AV: 'Average', FR: 'Fair', PR: 'Poor' };

function useOf(account, building, unit) {
  const type = String(building?.property_type || '').toUpperCase();
  if (type === 'CONDO') return ['unit', 'condo'];
  if (type === 'TOWNHOUSE') return ['property', 'townhouse'];
  if (type === 'MOBILE HOMES') return ['property', 'mobile_home'];
  if (type === 'DUPLEX') return ['building', 'multi_unit'];
  if (type === 'RESIDENTIAL') return unit ? ['unit', 'condo'] : ['property', 'house'];
  return !building && /^RESIDENTIAL$/i.test(account.account_type || '') ? ['parcel', null] : ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const STORY_WORDS = { 'Ranch 1 Story': 1, '1½ Story Fin': 1.5, '2 Story': 2 };

function fromRow(account, building, sale) {
  const unit = realUnit(word(account.unit));
  const address = streetParts({ number: account.house_num, pre: word(account.direction) || '', name: word(account.street_name) || '', suffix: word(account.street_suffix) || '', unit });
  const id = word(account.account_num);
  if (!address || !id) return null;
  const [kind, homeType] = useOf(account, building, address.unit);
  const facts = { parcel_number: id, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([account.house_num, account.direction, account.street_name, account.street_suffix].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'subdivision', word(account.subdivision_description));
  put(facts, 'tax_code_area', word(account.tax_district));
  put(facts, 'property_class', word(account.account_type));
  put(facts, 'land_use', word(building?.occupancy_description));
  put(facts, 'legal_description', word(account.full_legal)?.slice(0, 300));
  if (building && (home || kind === 'building')) {
    put(facts, 'year_built', year(building.year_built));
    put(facts, 'effective_year_built', year(building.adjusted_year_built));
    put(facts, 'style', word(building.type_of_construction_description));
    put(facts, 'stories', inRange(building.number_of_stories, 30) || STORY_WORDS[word(building.type_of_construction_description)]);
    put(facts, 'exterior_walls', word(building.exterior));
    put(facts, 'roof_cover', word(building.roof_cover));
    put(facts, 'foundation', word(building.foundation_type));
    put(facts, 'quality', word(building.quality));
    put(facts, 'condition', CONDITIONS[word(building.condition)]);
    if (kind === 'building') put(facts, 'units', positive(building.number_of_units));
  }
  if (building && home) {
    put(facts, 'living_sqft', positive(building.condominium_square_feet) || positive(building.square_feet));
    put(facts, 'bedrooms', inRange(building.number_of_bedrooms, 15));
    put(facts, 'bathrooms', inRange(building.number_of_bathrooms, 15));
    put(facts, 'rooms', inRange(building.number_of_rooms, 40));
    put(facts, 'heating', word(building.heat_vent_air_description));
    put(facts, 'basement_sqft', positive(building.total_basement_square_feet));
    put(facts, 'basement_finished_sqft', positive(building.finished_basement_square_feet));
    put(facts, 'garage_sqft', positive(building.garage_square_feet));
    put(facts, 'carport_sqft', positive(building.carport_square_feet));
  }
  if (kind !== 'unit') {
    if (positive(account.land_total_sq_foot)) facts.lot_sqft = positive(account.land_total_sq_foot);
    else put(facts, 'lot_acres', positive(account.land_total_acres));
  }
  put(facts, 'market_value', positive(account.total_market_value));
  put(facts, 'assessed_value', positive(account.total_assessed_value));
  put(facts, 'taxable_value', positive(account.total_taxable_value));
  if (sale) {
    facts.sale_price = positive(sale.sale_price);
    put(facts, 'sale_date', isoDate(sale.sale_date));
    put(facts, 'sale_document', word(sale.reception_num));
  }
  return { id: `pp:${kind}:${FIPS}:${id}`, kind, home_type: homeType, address: { ...address, city: String(word(account.city) || '').toUpperCase(), zip: '' }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'ok-oklahoma');
  const info = await getJson(`${BASE}/0?f=json`, 'The table\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const buildings = new Map();
  for await (const row of cached(path.join(dir, 'buildings.jsonl.gz'), () => layerRows(`${BASE}/1`, BUILDING_COLUMNS, { oid: 'objectid' }))) {
    const was = buildings.get(row.account_num);
    if (!was || Number(row.square_feet) > Number(was.square_feet)) buildings.set(row.account_num, row);
  }
  const sales = new Map();
  const when = (sale) => new Date(sale.sale_date).getTime() || 0;
  for await (const row of cached(path.join(dir, 'sales.jsonl.gz'), () => layerRows(`${BASE}/5`, SALE_COLUMNS, { oid: 'objectid' }))) {
    if (!(positive(row.sale_price) > 100)) continue;
    const was = sales.get(row.account_num);
    if (!was || when(row) > when(was)) sales.set(row.account_num, row);
  }
  const records = [];
  const seen = new Set();
  let [noAddress, personal] = [0, 0];
  for await (const row of cached(path.join(dir, 'accounts.jsonl.gz'), () => layerRows(`${BASE}/0`, ACCOUNT_COLUMNS, { oid: 'objectid' }))) {
    // Business equipment: never a home, and it would crowd the address of one.
    if (/^PERSONAL$/i.test(row.account_type || '') || !/^A$/i.test(row.status || '')) {
      personal += 1;
      continue;
    }
    const record = fromRow(row, buildings.get(row.account_num), sales.get(row.account_num));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${personal} personal or inactive; ${buildings.size} with buildings, ${sales.size} sales`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'OK', name: COUNTY, publisher: 'Oklahoma County Assessor', dataset: 'public record tables', method: 'county', source: 'ok-oklahoma', as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['40']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [`${BASE}/0`, `${BASE}/1`, `${BASE}/5`],
    facts: { year_built: 'year_built', effective_year_built: 'adjusted_year_built', living_sqft: 'square_feet', bedrooms: 'number_of_bedrooms', bathrooms: 'number_of_bathrooms', rooms: 'number_of_rooms', stories: 'number_of_stories', units: 'number_of_units', basement_sqft: 'total_basement_square_feet', garage_sqft: 'garage_square_feet', lot_sqft: 'land_total_sq_foot', lot_acres: 'land_total_acres', market_value: 'total_market_value', assessed_value: 'total_assessed_value', taxable_value: 'total_taxable_value', sale_price: 'sale_price', sale_date: 'sale_date' },
  },
};

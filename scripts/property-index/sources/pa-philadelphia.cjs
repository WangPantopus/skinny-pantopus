'use strict';
// Philadelphia County, Pennsylvania: the City's Office of Property Assessment table, nightly on its open data service. The
// City's terms: "use or display" at the user's own risk and with the City held harmless; it keeps title to the data. Owner,
// mailing and homestead columns are in the table and never asked for. market_value is the City's market value at full value.
// A year built the City marks as estimated is still the City's figure.

const path = require('node:path');
const { cartoRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42101';
const COUNTY = 'Philadelphia County';
const CARTO = 'https://phl.carto.com/api/v2/sql';
const COLUMNS = ['parcel_number', 'location', 'house_number', 'street_direction', 'street_name', 'street_designation', 'unit', 'zip_code', 'category_code_description', 'building_code_description_new', 'building_code_description', 'year_built', 'number_stories', 'number_of_bedrooms', 'number_of_bathrooms', 'number_of_rooms', 'total_livable_area', 'total_area', 'garage_spaces', 'fireplaces', 'central_air', 'zoning', 'market_value', 'taxable_land', 'taxable_building', 'sale_date', 'sale_price', 'assessment_date', 'census_tract'];

function useOf(row, unit) {
  const category = String(row.category_code_description || '').toUpperCase();
  const building = String(row.building_code_description_new || row.building_code_description || '').toUpperCase();
  if (/^VACANT/.test(category)) return ['parcel', null];
  if (category === 'SINGLE FAMILY') {
    if (/CONDO/.test(building) || unit) return ['unit', 'condo'];
    return ['property', /^ROW/.test(building) ? 'townhouse' : 'house'];
  }
  if (category === 'MULTI FAMILY') return unit && /CONDO/.test(building) ? ['unit', 'condo'] : ['building', 'multi_unit'];
  if (/^APARTMENTS/.test(category)) return ['building', 'apartment'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.unit));
  const address = streetParts({ number: row.house_number, pre: word(row.street_direction) || '', name: word(row.street_name) || '', suffix: word(row.street_designation) || '', unit });
  const parcel = word(row.parcel_number);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.house_number, row.street_direction, row.street_name, row.street_designation].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.category_code_description));
  put(facts, 'zoning', word(row.zoning));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.year_built));
    put(facts, 'building_type', word(row.building_code_description_new) || word(row.building_code_description));
    put(facts, 'stories', inRange(row.number_stories, kind === 'building' ? 80 : 6));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.total_livable_area));
    put(facts, 'bedrooms', inRange(row.number_of_bedrooms, 15));
    put(facts, 'bathrooms', inRange(row.number_of_bathrooms, 15));
    put(facts, 'rooms', inRange(row.number_of_rooms, 40));
    put(facts, 'parking_spaces', inRange(row.garage_spaces, 20));
    put(facts, 'fireplaces', inRange(row.fireplaces, 20));
    if (row.central_air === 'Y') facts.cooling = 'Central air';
    else if (row.central_air === 'N') facts.cooling = 'No central air';
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.total_area));
  put(facts, 'value_year', Number(String(row.assessment_date || '').slice(0, 4)) || null);
  put(facts, 'market_value', positive(row.market_value));
  put(facts, 'taxable_value', (positive(row.taxable_land) || 0) + (positive(row.taxable_building) || 0) || null);
  if (positive(row.sale_price) > 100) {
    facts.sale_price = positive(row.sale_price);
    put(facts, 'sale_date', isoDate(row.sale_date));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'PHILADELPHIA', zip: zipCode(row.zip_code) }, facts };
}

async function* build({ work }) {
  const records = [];
  const seen = new Set();
  let [noAddress, newest] = [0, ''];
  for await (const row of cached(path.join(work, 'pa-philadelphia', 'properties.jsonl.gz'), () => cartoRows(CARTO, 'opa_properties_public', COLUMNS))) {
    if (String(row.assessment_date) > newest) newest = String(row.assessment_date);
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} properties, ${noAddress} without a street number`);
  const asOf = isoDate(newest);
  if (!asOf) throw new Error('The table no longer says when it changed');
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'City of Philadelphia, Office of Property Assessment', dataset: 'properties and assessments, open data', method: 'county', source: 'pa-philadelphia', as_of: asOf, stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'year_built', living_sqft: 'total_livable_area', bedrooms: 'number_of_bedrooms', bathrooms: 'number_of_bathrooms', rooms: 'number_of_rooms', stories: 'number_stories', lot_sqft: 'total_area', market_value: 'market_value', taxable_value: 'taxable_land', sale_price: 'sale_price', sale_date: 'sale_date', fireplaces: 'fireplaces' },
  },
};

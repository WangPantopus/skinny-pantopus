'use strict';
// Henrico County, Virginia: the county's tax parcels with their assessment (CAMA) facts, the external layer on its own GIS server, which carries no owner
// columns. The county's terms of use for its data state no license and no limit on use: the data is as is, the user indemnifies and defends the County,
// and the County may end any display of its data or of a work built on it. Year built, finished area, bedrooms, baths, rooms, stories, land and building
// values (Virginia assesses at full market value), the parcel's area and last sale. The layer is in Virginia State Plane South feet, so a parcel's own
// area is its lot in square feet.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51087';
const COUNTY = 'Henrico County';
const LAYER = 'https://portal.henrico.gov/mapping/rest/services/Layers/Tax_Parcels_and_CAMA_Data_External/FeatureServer/0';
const COLUMNS = ['OBJECTID', 'GPIN', 'CAMA_GPIN', 'PARCEL_STREET_NUMBER', 'PARCEL_STREET_DIRECTION', 'PARCEL_STREET_NAME', 'PARCEL_UNIT', 'CITY', 'ZIP_CODE', 'USE_CODE', 'USE_DESCRIPTION', 'SUBDIVISION_NAME', 'LEGAL_DESCRIPTION', 'NEIGHBORHOOD_CODE', 'TAX_YEAR', 'LAND_VALUE_CURRENT', 'IMPROVEMENTS_VALUE_CURRENT', 'PARCEL_ACREAGE', 'Shape__Area', 'YEAR_BUILT', 'SQFT_FINISHED', 'NUMBER_BEDROOMS', 'NUMBER_FULL_BATHS', 'NUMBER_HALF_BATHS', 'NUMBER_ROOMS', 'NUMBER_STORIES_RESIDENTIAL', 'HOUSE_STYLE_DESCRIPTION', 'SQFT_BASEMENT', 'SQFT_FINISHED_BASEMENT', 'EXTERIOR_WALL_TYPE_DESCRIPTION', 'ROOF_MATERIAL_DESCRIPTION', 'HEATING_TYPE_DESCRIPTION', 'AIR_COOLING_DESCRIPTION', 'NUMBER_UNITS_APARTMENT', 'LAST_SALE_DATE', 'LAST_SALE_PRICE'];

// The county's use codes: 210 and 223-227 a house (by subdivision or acreage), 699 a dwelling on commercial land, 270 a townhouse, 280 a condominium,
// 260 a manufactured home, 220 and 230 two and three families, 352 and 451 apartments, 0xx and 70x vacant land; common areas and master cards are other.
const HOUSES = new Set(['210', '223', '224', '225', '226', '227', '699', '699R']);
const VACANT = new Set(['011', '013', '023', '024', '025', '026', '027', '701', '702', '703', '704', '705', '706']);
function useOf(code, unit) {
  const c = String(code || '').trim().toUpperCase();
  if (HOUSES.has(c) || c === '270') return unit ? ['unit', 'condo'] : ['property', c === '270' ? 'townhouse' : 'house'];
  if (c === '280') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '260') return ['property', 'mobile_home'];
  if (c === '220' || c === '230') return ['building', 'multi_unit'];
  if (c === '352' || c === '451') return ['building', 'apartment'];
  if (VACANT.has(c)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
// A description column now and then holds a bare code.
const said = (value) => (/[A-Z]/i.test(String(value ?? '')) ? word(value) : null);

function fromRow(row) {
  const unit = word(row.PARCEL_UNIT) || '';
  const address = streetParts({ number: row.PARCEL_STREET_NUMBER, pre: word(row.PARCEL_STREET_DIRECTION) || '', name: word(row.PARCEL_STREET_NAME) || '', unit });
  // A condominium's units share their complex's GPIN; the assessment's own GPIN tells each unit apart.
  const parcel = word(row.CAMA_GPIN) || word(row.GPIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.USE_CODE, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.PARCEL_STREET_NUMBER, row.PARCEL_STREET_DIRECTION, row.PARCEL_STREET_NAME].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(row.USE_CODE));
  put(facts, 'land_use', word(row.USE_DESCRIPTION));
  put(facts, 'subdivision', word(row.SUBDIVISION_NAME));
  put(facts, 'legal_description', word(row.LEGAL_DESCRIPTION)?.slice(0, 300));
  put(facts, 'neighborhood', word(row.NEIGHBORHOOD_CODE));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'exterior_walls', said(row.EXTERIOR_WALL_TYPE_DESCRIPTION));
    put(facts, 'roof_cover', said(row.ROOF_MATERIAL_DESCRIPTION));
    put(facts, 'heating', said(row.HEATING_TYPE_DESCRIPTION));
    put(facts, 'cooling', said(row.AIR_COOLING_DESCRIPTION));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.SQFT_FINISHED));
    put(facts, 'bedrooms', inRange(row.NUMBER_BEDROOMS, 15));
    const [full, half] = [inRange(row.NUMBER_FULL_BATHS, 12), inRange(row.NUMBER_HALF_BATHS, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.NUMBER_ROOMS, 40));
    put(facts, 'stories', inRange(row.NUMBER_STORIES_RESIDENTIAL, 6));
    put(facts, 'style', said(row.HOUSE_STYLE_DESCRIPTION));
    put(facts, 'basement_sqft', positive(row.SQFT_BASEMENT));
    put(facts, 'basement_finished_sqft', positive(row.SQFT_FINISHED_BASEMENT));
  }
  if (kind === 'building') put(facts, 'units', inRange(row.NUMBER_UNITS_APARTMENT, 2000));
  if (kind !== 'unit') {
    if (positive(row.PARCEL_ACREAGE)) put(facts, 'lot_acres', positive(row.PARCEL_ACREAGE));
    else put(facts, 'lot_sqft', positive(row.Shape__Area) >= 100 ? Math.round(positive(row.Shape__Area)) : null);
  }
  const [land, building] = [positive(row.LAND_VALUE_CURRENT), positive(row.IMPROVEMENTS_VALUE_CURRENT)];
  put(facts, 'value_year', positive(row.TAX_YEAR));
  put(facts, 'market_value', (land || 0) + (building || 0) || null);
  put(facts, 'market_land_value', land);
  put(facts, 'market_building_value', building);
  if (isHomeSale(positive(row.LAST_SALE_PRICE))) {
    put(facts, 'sale_price', positive(row.LAST_SALE_PRICE));
    put(facts, 'sale_date', isoDate(row.LAST_SALE_DATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.CITY) || '').toUpperCase(), zip: zipCode(row.ZIP_CODE) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'va-henrico', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 2000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'Henrico County', dataset: 'tax parcels and assessment data', method: 'county', source: 'va-henrico', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'SQFT_FINISHED', bedrooms: 'NUMBER_BEDROOMS', bathrooms: 'NUMBER_FULL_BATHS', full_baths: 'NUMBER_FULL_BATHS', half_baths: 'NUMBER_HALF_BATHS', rooms: 'NUMBER_ROOMS', stories: 'NUMBER_STORIES_RESIDENTIAL', basement_sqft: 'SQFT_BASEMENT', basement_finished_sqft: 'SQFT_FINISHED_BASEMENT', units: 'NUMBER_UNITS_APARTMENT', lot_acres: 'PARCEL_ACREAGE', lot_sqft: 'Shape__Area', value_year: 'TAX_YEAR', market_value: 'LAND_VALUE_CURRENT', market_land_value: 'LAND_VALUE_CURRENT', market_building_value: 'IMPROVEMENTS_VALUE_CURRENT', sale_price: 'LAST_SALE_PRICE', sale_date: 'LAST_SALE_DATE' },
  },
};

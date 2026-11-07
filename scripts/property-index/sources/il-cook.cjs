'use strict';
// Cook County, Illinois: the Assessor's open data catalog. The county's terms of use are disclaimers, with no limit on
// using what it publishes. Six tables joined on the parcel number. The address, sales and universe tables also hold owner,
// mailing, buyer and seller columns: they are never asked for. Values are assessed values (10% of market for homes), never
// market values. Condo units carry bedrooms and size where the Assessor has compiled them so far.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '17031';
const COUNTY = 'Cook County';
const DOMAIN = 'datacatalog.cookcountyil.gov';
const TABLES = { homes: 'x54s-btds', condos: '3r7i-mrz4', addresses: '3723-97qp', universe: 'pabr-t5kh', values: 'uzyt-m557', sales: 'wvhk-k5uv' };
const HOME_COLUMNS = ['pin', 'card', 'class', 'pin_num_cards', 'char_yrblt', 'char_bldg_sf', 'char_land_sf', 'char_beds', 'char_rooms', 'char_fbath', 'char_hbath', 'char_frpl', 'char_type_resd', 'char_cnst_qlty', 'char_apts', 'char_gar1_size', 'char_gar1_att', 'char_bsmt', 'char_ext_wall', 'char_heat', 'char_air', 'char_repair_cnd', 'char_roof_cnst'];
const CONDO_COLUMNS = ['pin', 'card', 'class', 'char_yrblt', 'char_building_sf', 'char_unit_sf', 'char_bedrooms', 'char_full_baths', 'char_half_baths', 'char_building_pins', 'char_land_sf', 'is_parking_space', 'is_common_area'];
const ADDRESS_COLUMNS = ['pin', 'prop_address_full', 'prop_address_city_name', 'prop_address_zipcode_1'];
const UNIVERSE_COLUMNS = ['pin', 'class', 'township_name', 'cook_municipality_name', 'nbhd_code', 'tax_code', 'school_elementary_district_name', 'school_secondary_district_name', 'school_unified_district_name'];
const VALUE_COLUMNS = ['pin', 'year', 'mailed_bldg', 'mailed_land', 'mailed_tot', 'certified_bldg', 'certified_land', 'certified_tot', 'board_bldg', 'board_land', 'board_tot'];
const SALE_COLUMNS = ['pin', 'sale_date', 'sale_price', 'doc_no', 'deed_type', 'sale_type'];

// The Assessor's class code dictionary.
const CLASS_WORDS = {
  202: 'One story residence, up to 999 sq. ft.', 203: 'One story residence, 1,000 to 1,800 sq. ft.', 204: 'One story residence, 1,801 sq. ft. and over', 205: 'Two or more story residence, over 62 years', 206: 'Two or more story residence, over 62 years', 207: 'Two or more story residence, up to 62 years', 208: 'Two or more story residence, up to 62 years', 209: 'Two or more story residence, 5,000 sq. ft. and over', 210: 'Old style townhouse, over 62 years', 211: 'Apartment building with 2 to 6 units', 212: 'Two to six mixed-use apartments', 213: 'Cooperative', 225: 'Single-room occupancy rental building', 234: 'Split level residence', 278: 'Two or more story residence, up to 62 years', 295: 'Individually owned row houses or townhouses', 299: 'Condominium', 399: 'Rental condominium',
};
const STORIES = { '1 Story': 1, '1.5 Story': 1.5, '2 Story': 2 };
const FOUNDATION = { Full: 'Full basement', Partial: 'Partial basement', Slab: 'Slab', Crawl: 'Crawl space' };
const APARTMENTS = { Two: 2, Three: 3, Four: 4, Five: 5, Six: 6 };

function useOf(code, condo) {
  const number = Number(code);
  if ([202, 203, 204, 205, 206, 207, 208, 209, 218, 219, 234, 278].includes(number)) return ['property', 'house'];
  if (number === 210 || number === 295) return ['property', 'townhouse'];
  if (number === 211 || number === 212) return ['building', 'multi_unit'];
  if (number === 225 || (number >= 313 && number <= 397 && number !== 390)) return ['building', 'apartment'];
  if (number === 213 || number === 299 || number === 399) return condo && (condo.is_parking_space === true || condo.is_common_area === true) ? ['other', null] : ['unit', 'condo'];
  if (number === 200 || number === 241 || number === 239 || number === 240 || (number >= 100 && number < 200) || number === 300) return ['parcel', null];
  return ['other', null];
}

// A few cells count a whole building or carry a slip: nothing past these is one home's count.
const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

/** Which rows are newest: these tables hold every year back to 1999. */
async function newestYear(id) {
  const rows = await getJson(`https://${DOMAIN}/resource/${id}.json?${new URLSearchParams({ $select: 'max(year) AS newest' })}`, 'A table\'s newest year');
  const newest = Math.trunc(Number(rows[0]?.newest));
  if (!newest) throw new Error('A table no longer says its newest year');
  return newest;
}

function fromRow(pin, { place, universe, home, condo, values, sale: homeSale, landSale }) {
  const text = word(place?.prop_address_full);
  const parsed = text ? parse(text) : null;
  if (!parsed) return null;
  const code = word(universe?.class) || word(home?.class) || word(condo?.class) || '';
  const [kind, homeType] = useOf(code, condo);
  const facts = { parcel_number: pin, county: COUNTY, fips: FIPS };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const isHome = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', text);
  put(facts, 'municipality', word(universe?.cook_municipality_name));
  put(facts, 'neighborhood', word(universe?.township_name));
  put(facts, 'tax_code_area', word(universe?.tax_code));
  put(facts, 'school_district', word(universe?.school_unified_district_name) || word(universe?.school_elementary_district_name));
  put(facts, 'land_use', CLASS_WORDS[Number(code)]);
  put(facts, 'county_use_code', code);
  if (on && home) {
    put(facts, 'year_built', year(Math.trunc(Number(home.char_yrblt))));
    put(facts, 'style', word(home.char_type_resd));
    put(facts, 'stories', STORIES[home.char_type_resd]);
    put(facts, 'exterior_walls', word(home.char_ext_wall));
    put(facts, 'roof_cover', word(home.char_roof_cnst));
    put(facts, 'foundation', FOUNDATION[home.char_bsmt]);
    if (positive(home.pin_num_cards) > 1) facts.buildings_on_parcel = Math.trunc(Number(home.pin_num_cards));
    if (kind === 'building') put(facts, 'units', APARTMENTS[home.char_apts]);
  }
  if (isHome && home && kind !== 'unit') {
    put(facts, 'living_sqft', positive(home.char_bldg_sf));
    put(facts, 'bedrooms', inRange(home.char_beds, 15));
    put(facts, 'rooms', inRange(home.char_rooms, 40));
    const [full, half] = [inRange(home.char_fbath, 15), inRange(home.char_hbath, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(home.char_frpl, 15));
    put(facts, 'heating', word(home.char_heat));
    put(facts, 'cooling', word(home.char_air));
    put(facts, 'condition', word(home.char_repair_cnd));
    put(facts, 'quality', word(home.char_cnst_qlty));
    const cars = /^[\d.]+ cars$/.test(home.char_gar1_size || '') && !home.char_gar1_size.startsWith('0') ? home.char_gar1_size.replace(/^1 cars$/, '1 car') : null;
    if (cars) {
      facts.garage = home.char_gar1_att === 'Yes' ? `${cars}, attached` : cars;
      facts.parking_type = home.char_gar1_att === 'Yes' ? 'Attached garage' : 'Detached garage';
      facts.parking_spaces = Number(home.char_gar1_size.split(' ')[0]);
    }
  }
  if (kind === 'unit' && condo) {
    put(facts, 'year_built', year(Math.trunc(Number(condo.char_yrblt))));
    put(facts, 'living_sqft', positive(condo.char_unit_sf));
    put(facts, 'gross_sqft', positive(condo.char_building_sf));
    put(facts, 'bedrooms', inRange(condo.char_bedrooms, 15));
    const [full, half] = [inRange(condo.char_full_baths, 15), inRange(condo.char_half_baths, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'units_in_condominium', positive(condo.char_building_pins));
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(home?.char_land_sf));
  if (values) {
    // The newest stage of the year's assessment: mailed, then certified, then the Board of Review's.
    const stage = ['board', 'certified', 'mailed'].find((name) => positive(values[`${name}_tot`]));
    if (stage) {
      facts.value_year = Math.trunc(Number(values.year));
      put(facts, 'assessed_value', positive(values[`${stage}_tot`]));
      put(facts, 'assessed_land_value', positive(values[`${stage}_land`]));
      put(facts, 'assessed_building_value', positive(values[`${stage}_bldg`]));
    }
  }
  // Vacant land has nothing but the land to sell.
  const sale = kind === 'parcel' ? landSale : homeSale;
  if (sale) {
    facts.sale_price = positive(sale.sale_price);
    put(facts, 'sale_date', isoDate(sale.sale_date));
    put(facts, 'sale_document', word(sale.doc_no));
  }
  return { id: `pp:${kind}:${FIPS}:${pin}`, kind, home_type: homeType, address: { ...parsed, city: String(word(place.prop_address_city_name) || '').toUpperCase(), zip: zipCode(place.prop_address_zipcode_1) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'il-cook');
  const about = await getJson(`https://${DOMAIN}/api/views/${TABLES.homes}.json`, 'The table\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const [homeYear, condoYear, addressYear, valueYear] = [await newestYear(TABLES.homes), await newestYear(TABLES.condos), await newestYear(TABLES.addresses), await newestYear(TABLES.values)];

  const homes = new Map();
  for await (const row of cached(path.join(dir, 'homes.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.homes, HOME_COLUMNS, { where: `year=${homeYear}` }))) {
    // One row per building: the largest is the home.
    const was = homes.get(row.pin);
    if (!was || Number(row.char_bldg_sf) > Number(was.char_bldg_sf)) homes.set(row.pin, row);
  }
  const condos = new Map();
  for await (const row of cached(path.join(dir, 'condos.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.condos, CONDO_COLUMNS, { where: `year=${condoYear}` }))) condos.set(row.pin, row);
  const universe = new Map();
  for await (const row of cached(path.join(dir, 'universe.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.universe, UNIVERSE_COLUMNS))) universe.set(row.pin, row);
  const values = new Map();
  // The newest year's assessments reach townships in turn: a parcel not yet mailed keeps last year's.
  for await (const row of cached(path.join(dir, 'values.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.values, VALUE_COLUMNS, { where: `year>=${valueYear - 1}` }))) {
    const was = values.get(row.pin);
    if (['board_tot', 'certified_tot', 'mailed_tot'].some((name) => positive(row[name])) && (!was || Number(row.year) > Number(was.year))) values.set(row.pin, row);
  }
  const sales = new Map();
  const landSales = new Map();
  const later = (map, row) => {
    const was = map.get(row.pin);
    if (!was || String(row.sale_date) > String(was.sale_date)) map.set(row.pin, row);
  };
  for await (const row of cached(path.join(dir, 'sales.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.sales, SALE_COLUMNS))) {
    // A quit claim isn't a sale, and the land alone isn't a home's sale.
    if (!isHomeSale(positive(row.sale_price), row.deed_type)) continue;
    later(landSales, row);
    if (row.sale_type !== 'LAND') later(sales, row);
  }
  log(`${homes.size} homes, ${condos.size} condo parcels, ${universe.size} parcels, ${values.size} values, ${sales.size} sales`);

  const records = [];
  let noAddress = 0;
  for await (const place of cached(path.join(dir, 'addresses.jsonl.gz'), () => socrataRows(DOMAIN, TABLES.addresses, ADDRESS_COLUMNS, { where: `year=${addressYear}` }))) {
    const { pin } = place;
    const record = fromRow(pin, { place, universe: universe.get(pin), home: homes.get(pin), condo: condos.get(pin), values: values.get(pin), sale: sales.get(pin), landSale: landSales.get(pin) });
    if (record) records.push(record);
    else noAddress += 1;
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'IL', name: COUNTY, publisher: 'Cook County Assessor', dataset: 'open data catalog', method: 'county', source: 'il-cook', as_of: asOf, stale_after_days: 120, records,
  };
}

module.exports = {
  build,
  dictionary: {
    socrata: { domain: DOMAIN, ids: Object.values(TABLES) },
    facts: { year_built: 'char_yrblt', living_sqft: ['char_bldg_sf', 'char_unit_sf'], gross_sqft: 'char_building_sf', bedrooms: ['char_beds', 'char_bedrooms'], rooms: 'char_rooms', full_baths: ['char_fbath', 'char_full_baths'], half_baths: ['char_hbath', 'char_half_baths'], fireplaces: 'char_frpl', lot_sqft: 'char_land_sf', units: 'char_apts', assessed_value: 'board_tot', assessed_land_value: 'board_land', assessed_building_value: 'board_bldg', sale_price: 'sale_price', sale_date: 'sale_date' },
    text: 'https://raw.githubusercontent.com/ccao-data/data-architecture/master/dbt/seeds/ccao/ccao.class_dict.csv',
    words: { class: { 202: { said: 'One story residence, any age, up to 999 sq. ft.' }, 210: { said: 'Old style townhouse, over 62 years' }, 211: { said: 'Apartment building with 2 to 6 units, any age' }, 213: 'Cooperative', 225: 'Single-room occupancy rental building', 295: { said: 'Individually owned row houses or townhouses, up to 62 years' }, 299: 'Condominium', 399: 'Rental condominium' } },
  },
};

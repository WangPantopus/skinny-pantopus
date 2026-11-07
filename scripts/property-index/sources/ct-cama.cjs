'use strict';
// Connecticut: the state GIS office's yearly collection of every town's computer-assisted appraisal data, by law
// (CGS 4d-90 to 92, 7-100L). The state has no county government: its county-equivalents are the nine planning regions,
// which is how the Census Bureau and this index number them. A town's appraised value is its market estimate and its
// assessment is by law 70% of that, so they're kept apart. Towns name their property uses their own way.
//
// Owner, co-owner, mailing and grantor columns aren't asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const DOMAIN = 'data.ct.gov';
const DATASET = 'ibe8-9i3q';
const DATASET_YEAR = 2026;

// The Census Bureau's 2024 county subdivisions: towns by planning region.
const REGIONS = {
  '09110': [
    'Andover', 'Avon', 'Berlin', 'Bloomfield', 'Bolton', 'Canton', 'Columbia', 'Coventry', 'East Granby', 'East Hartford', 'East Windsor', 'Ellington',
    'Enfield', 'Farmington', 'Glastonbury', 'Granby', 'Hartford', 'Hebron', 'Manchester', 'Mansfield', 'Marlborough', 'New Britain', 'Newington', 'Plainville',
    'Rocky Hill', 'Simsbury', 'Somers', 'South Windsor', 'Southington', 'Stafford', 'Suffield', 'Tolland', 'Vernon', 'West Hartford', 'Wethersfield',
    'Willington', 'Windsor', 'Windsor Locks',
  ],
  '09120': [
    'Bridgeport', 'Easton', 'Fairfield', 'Monroe', 'Stratford', 'Trumbull',
  ],
  '09130': [
    'Chester', 'Clinton', 'Cromwell', 'Deep River', 'Durham', 'East Haddam', 'East Hampton', 'Essex', 'Haddam', 'Killingworth', 'Lyme', 'Middlefield',
    'Middletown', 'Old Lyme', 'Old Saybrook', 'Portland', 'Westbrook',
  ],
  '09140': [
    'Ansonia', 'Beacon Falls', 'Bethlehem', 'Bristol', 'Cheshire', 'Derby', 'Middlebury', 'Naugatuck', 'Oxford', 'Plymouth', 'Prospect', 'Seymour', 'Shelton',
    'Southbury', 'Thomaston', 'Waterbury', 'Watertown', 'Wolcott', 'Woodbury',
  ],
  '09150': [
    'Ashford', 'Brooklyn', 'Canterbury', 'Chaplin', 'Eastford', 'Hampton', 'Killingly', 'Plainfield', 'Pomfret', 'Putnam', 'Scotland', 'Sterling', 'Thompson',
    'Union', 'Voluntown', 'Woodstock',
  ],
  '09160': [
    'Barkhamsted', 'Burlington', 'Canaan', 'Colebrook', 'Cornwall', 'Goshen', 'Hartland', 'Harwinton', 'Kent', 'Litchfield', 'Morris', 'New Hartford',
    'Norfolk', 'North Canaan', 'Roxbury', 'Salisbury', 'Sharon', 'Torrington', 'Warren', 'Washington', 'Winchester',
  ],
  '09170': [
    'Bethany', 'Branford', 'East Haven', 'Guilford', 'Hamden', 'Madison', 'Meriden', 'Milford', 'New Haven', 'North Branford', 'North Haven', 'Orange',
    'Wallingford', 'West Haven', 'Woodbridge',
  ],
  '09180': [
    'Bozrah', 'Colchester', 'East Lyme', 'Franklin', 'Griswold', 'Groton', 'Lebanon', 'Ledyard', 'Lisbon', 'Montville', 'New London', 'North Stonington',
    'Norwich', 'Preston', 'Salem', 'Sprague', 'Stonington', 'Waterford', 'Windham',
  ],
  '09190': [
    'Bethel', 'Bridgewater', 'Brookfield', 'Danbury', 'Darien', 'Greenwich', 'New Canaan', 'New Fairfield', 'New Milford', 'Newtown', 'Norwalk', 'Redding',
    'Ridgefield', 'Sherman', 'Stamford', 'Weston', 'Westport', 'Wilton',
  ],
};
const REGION_NAMES = {
  '09110': 'Capitol', '09120': 'Greater Bridgeport', '09130': 'Lower Connecticut River Valley', '09140': 'Naugatuck Valley', '09150': 'Northeastern Connecticut',
  '09160': 'Northwest Hills', '09170': 'South Central Connecticut', '09180': 'Southeastern Connecticut', '09190': 'Western Connecticut',
};
const REGION_OF = new Map(Object.entries(REGIONS).flatMap(([fips, towns]) => towns.map((town) => [town.toUpperCase(), fips])));
// The state's town codes are the towns in alphabetical order with the spaces left out: Eastford is 39, East Granby 40.
const squeezed = (town) => town.replace(/ /g, '');
const TOWN_CODES = [...REGION_OF.keys()].sort((a, b) => (squeezed(a) < squeezed(b) ? -1 : 1));
const CODE_OF = new Map(TOWN_CODES.map((town, i) => [town, i + 1]));

const COLUMNS = ['pid', 'town_id', 'location', 'address_number', 'street_name', 'unit', 'property_city', 'property_zip', 'assessed_total', 'assessed_building', 'assessed_land', 'appraised_total', 'appraised_building', 'appraised_land',
  'valuation_year', 'land_acres', 'zone', 'state_use', 'state_use_description', 'style_desc', 'grade_desc', 'condition_description', 'neighborhood', 'ayb', 'eyb', 'gross_area_of_primary_building', 'living_area', 'stories',
  'frame_type_description', 'roof_structure_description', 'roof_cover_description', 'number_of_buildings', 'total_rooms', 'number_of_bedroom', 'number_of_baths', 'number_of_half_baths', 'int_flr1_description', 'ext_wall1_description',
  'heat_type_description', 'heat_fuel_description', 'ac_type_description', 'no_of_fireplaces', 'fin_bsm_area', 'bsm_gar', 'book_page', 'sale_price', 'sale_date', 'instrument', 'number_of_units'];

/** What the town's use and style words say this record is. */
function useOf(row) {
  const text = `${row.state_use_description || ''} ${row.style_desc || ''}`.toUpperCase();
  if (/\bCONDO|CONDOMINIUM/.test(text)) return ['unit', 'condo'];
  if (/MOBILE|MANUF/.test(text)) return ['property', 'mobile_home'];
  if (/\b(TWO|2|THREE|3|FOUR|4)[ -]*(FAM|UNIT)|DUPLEX|TRIPLEX|MULTI ?FAM/.test(text)) return ['building', 'multi_unit'];
  if (/\bAPT|APARTMENT/.test(text)) return ['building', 'apartment'];
  if (/VACANT|\bVAC\b|LAND ONLY|UNDEVEL|EXCESS LAND/.test(text)) return ['parcel', null];
  if (/COMM|INDUS|EXEMPT|UTIL|MIXED|OFFICE|RETAIL|STORE|GARAGE|OUTBUILD|PUBLIC|MUNICIP|CHURCH|SCHOOL/.test(text)) return ['other', null];
  if (/SINGLE|ONE[ -]*FAM|\b1[ -]*FAM|\bRES/.test(text)) return ['property', 'house'];
  return ['other', null];
}

const said = (text) => {
  const value = word(text);
  return value && !/^(unknown|other|none|n\/a|no|na|\.)$/i.test(value) ? value : null;
};
const number = (text) => positive(String(text ?? '').replace(/,/g, ''));
// Some towns write the house number as a decimal, "12.0" (Darien, Hartland): the house is 12.
const wholeHouse = (text) => String(text ?? '').trim().replace(/^(\d+)\.0+(?=\s|$)/, '$1');
// Most towns' ZIPs reach the state's file as numbers that lost the leading zero, some as decimals: "6118.0" is 06118 and
// "61181234" is 06118-1234.
const zipOf = (text) => {
  const value = String(text ?? '').trim().replace(/\.0+$/, '');
  return zipCode(/^\d{4}(\d{4})?$/.test(value) ? `0${value}` : value);
};
// Below this share of a ZIP's rows, a town's rows with that ZIP are slips (build).
const MIN_ZIP_SHARE = 0.05;

// A row's town is the one it names. Its code is only the fallback: the 2026 file gives a town whose name holds another town's
// name that town's code (Manchester and Colchester have Chester's, West Hartford Hartford's) and leaves eight towns without one.
function townOf(row) {
  const city = String(row.property_city ?? '').trim().toUpperCase();
  if (REGION_OF.has(city)) return city;
  return TOWN_CODES[Number(row.town_id) - 1] || null;
}

function fromRow(row, fips, county, town) {
  const [kind, homeType] = useOf(row);
  const facts = { parcel_number: word(row.pid), county, fips, municipality: town.toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase()) };
  const unit = realUnit(row.unit);
  const parsed = parse(wholeHouse(row.location), unit) || parse(`${wholeHouse(row.address_number)} ${String(row.street_name ?? '').trim()}`, unit);
  if (!parsed || !facts.parcel_number) return null;
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.location, unit));
  const plus4 = /^(\d{5})-(\d{4})$/.exec(String(row.property_zip ?? '').trim());
  if (plus4 && plus4[2] !== '0000') facts.zip_plus4 = `${plus4[1]}-${plus4[2]}`;
  put(facts, 'year_built', on ? year(row.ayb) : null);
  put(facts, 'effective_year_built', on ? year(row.eyb) : null);
  put(facts, 'living_sqft', home ? number(row.living_area) : null);
  put(facts, 'gross_sqft', on ? number(row.gross_area_of_primary_building) : null);
  put(facts, 'stories', on ? number(row.stories) : null);
  put(facts, 'style', on ? said(row.style_desc) : null);
  put(facts, 'quality', on ? said(row.grade_desc) : null);
  put(facts, 'buildings_on_parcel', kind !== 'unit' && on ? number(row.number_of_buildings) : null);
  if (kind === 'building') put(facts, 'units', number(row.number_of_units));
  if (home) {
    put(facts, 'rooms', number(row.total_rooms));
    put(facts, 'bedrooms', number(row.number_of_bedroom));
    const [full, half] = [number(row.number_of_baths), number(row.number_of_half_baths)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', number(row.no_of_fireplaces));
    put(facts, 'basement_finished_sqft', number(row.fin_bsm_area));
    // The flat file has a garage only when it's in the basement: the towns keep other garages in their outbuilding tables.
    const cars = number(row.bsm_gar);
    if (cars && cars <= 6) {
      facts.garage = `${cars} car basement garage`;
      facts.parking_type = 'Basement garage';
      facts.parking_spaces = cars;
    }
    put(facts, 'condition', said(row.condition_description));
    put(facts, 'flooring', said(row.int_flr1_description));
    put(facts, 'heating', said(row.heat_type_description));
    put(facts, 'heating_fuel', said(row.heat_fuel_description));
    put(facts, 'cooling', said(row.ac_type_description));
  }
  if (on) {
    put(facts, 'frame', said(row.frame_type_description));
    put(facts, 'roof_shape', said(row.roof_structure_description));
    put(facts, 'roof_cover', said(row.roof_cover_description));
    put(facts, 'exterior_walls', said(row.ext_wall1_description));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', number(row.land_acres));
  put(facts, 'zoning', word(row.zone));
  put(facts, 'neighborhood', word(row.neighborhood));
  put(facts, 'land_use', said(row.state_use_description));
  put(facts, 'county_use_code', word(row.state_use));
  put(facts, 'value_year', number(row.valuation_year));
  put(facts, 'market_value', number(row.appraised_total));
  put(facts, 'market_land_value', number(row.appraised_land));
  put(facts, 'market_building_value', number(row.appraised_building));
  put(facts, 'assessed_value', number(row.assessed_total));
  put(facts, 'assessed_land_value', number(row.assessed_land));
  put(facts, 'assessed_building_value', number(row.assessed_building));
  const sold = isoDate(row.sale_date);
  // Most towns write the deed as their own number; a quit claim is left out where the word says it.
  if (isHomeSale(number(row.sale_price), row.instrument) && sold) {
    facts.sale_price = number(row.sale_price);
    facts.sale_date = sold;
    const document = /^(\S+)\/(\S+)$/.exec(String(row.book_page ?? '').trim());
    if (document) facts.sale_document = `Book ${document[1]}, Page ${document[2]}`;
  }
  return {
    // Parcel numbers are each town's own: the town's code keeps two towns' parcels apart.
    id: `pp:${kind}:${fips}:${CODE_OF.get(town)}-${facts.parcel_number}`, kind, home_type: homeType,
    address: { ...parsed, city: town, zip: zipOf(row.property_zip) }, facts,
  };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const about = await getJson(`https://${DOMAIN}/api/views/${DATASET}.json`, 'The dataset\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The dataset no longer says when it changed');

  const byRegion = new Map(Object.keys(REGIONS).map((fips) => [fips, []]));
  const seen = new Set();
  // Each ZIP's rows by town, over every row, so a build of a few regions judges a ZIP the same way.
  const zipTowns = new Map();
  let noTown = 0;
  let noAddress = 0;
  const rows = cached(path.join(work, 'ct-cama', 'all.jsonl.gz'), () => socrataRows(DOMAIN, DATASET, COLUMNS));
  for await (const row of rows) {
    const town = townOf(row);
    if (!town) {
      noTown += 1;
      continue;
    }
    const zip = zipOf(row.property_zip);
    if (zip) {
      if (!zipTowns.has(zip)) zipTowns.set(zip, new Map());
      zipTowns.get(zip).set(town, (zipTowns.get(zip).get(town) || 0) + 1);
    }
    const fips = REGION_OF.get(town);
    if (only.length && !only.includes(fips)) continue;
    const record = fromRow(row, fips, `${REGION_NAMES[fips]} Planning Region`, town);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      byRegion.get(fips).push(record);
    }
  }
  // A town that writes another town's ZIP on a few rows (one Stonington row has Milford's 06460) would send that ZIP's lookups
  // to its own region, so a record keeps its ZIP only where its town has a real share of that ZIP's rows.
  let strays = 0;
  for (const records of byRegion.values()) {
    for (const { address, facts } of records) {
      const towns = zipTowns.get(address.zip);
      if (!towns || towns.get(address.city) >= MIN_ZIP_SHARE * [...towns.values()].reduce((sum, n) => sum + n, 0)) continue;
      address.zip = '';
      delete facts.zip_plus4;
      strays += 1;
    }
  }
  log(`${seen.size} records, ${noTown} with no town, ${noAddress} without a street number, ${strays} with a ZIP their town barely uses left off`);

  for (const [fips, records] of byRegion) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${REGION_NAMES[fips]} Planning Region`;
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'CT', name: county, publisher: 'Connecticut Office of Policy and Management', dataset: `${DATASET_YEAR} parcel and appraisal data`, method: 'state', source: 'ct-cama', title: 'State records',
      as_of: asOf, stale_after_days: 540, records,
    };
  }
}

module.exports = { build };

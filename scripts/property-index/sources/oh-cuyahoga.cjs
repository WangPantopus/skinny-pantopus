'use strict';
// Cuyahoga County, Ohio: the Fiscal Officer's open data parcels, two layers (Cleveland, and everywhere else). No terms are stated on the
// service. Owner, grantor, grantee and mailing columns are never asked for. Ohio taxes 35% of appraised value, so these are assessed values.
// No year built or bedrooms.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39035';
const COUNTY = 'Cuyahoga County';
const SERVICE = 'https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer';
const COLUMNS = ['parcelpin', 'parcel_type', 'transfer_date', 'sales_amount', 'par_addr', 'par_predir', 'par_street', 'par_suffix', 'par_unit', 'par_city', 'par_zip', 'tax_luc', 'tax_luc_description', 'zoning_code', 'property_class', 'tax_district', 'neighborhood_code', 'tax_year', 'gross_certified_land', 'gross_certified_building', 'gross_certified_total', 'res_bldg_count', 'total_res_liv_area', 'total_res_rooms', 'com_living_units', 'total_square_ft', 'total_acreage'];

function useOf(row, unit) {
  const type = String(row.parcel_type || '').toUpperCase();
  const use = String(row.tax_luc_description || '').toUpperCase();
  if (type === 'CONDO' || /CONDO/.test(use)) return /COMM|OFFICE|STORE/.test(use) ? ['other', null] : ['unit', 'condo'];
  if (type === 'MOBILE' || /MOBILE/.test(use)) return ['property', 'mobile_home'];
  if (String(row.property_class || '').toUpperCase() !== 'R' && !/APART/.test(use)) return ['other', null];
  if (/VACANT|LAND ONLY/.test(use) || !positive(row.total_res_liv_area)) return /APART/.test(use) ? ['building', 'apartment'] : ['parcel', null];
  if (/2-FAMILY|TWO.?FAMILY|3-FAMILY|THREE.?FAMILY|DUPLEX|TRIPLEX/.test(use)) return ['building', 'multi_unit'];
  if (/APART/.test(use)) return ['building', 'apartment'];
  return unit ? ['unit', 'condo'] : ['property', 'house'];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.par_unit));
  const address = streetParts({ number: row.par_addr, pre: word(row.par_predir) || '', name: word(row.par_street) || '', suffix: word(row.par_suffix) || '', unit });
  const parcel = word(row.parcelpin);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.par_addr, row.par_predir, row.par_street, row.par_suffix].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.tax_luc_description));
  put(facts, 'county_use_code', word(row.tax_luc));
  put(facts, 'zoning', word(row.zoning_code));
  put(facts, 'tax_code_area', word(row.tax_district));
  put(facts, 'neighborhood', word(row.neighborhood_code));
  if (home) {
    put(facts, 'living_sqft', positive(row.total_res_liv_area));
    put(facts, 'rooms', inRange(row.total_res_rooms, 40));
  }
  if (kind === 'building') put(facts, 'units', positive(row.com_living_units));
  if (kind !== 'unit') {
    if (positive(row.total_square_ft)) facts.lot_sqft = positive(row.total_square_ft);
    else put(facts, 'lot_acres', positive(row.total_acreage));
  }
  put(facts, 'value_year', positive(row.tax_year));
  put(facts, 'assessed_value', positive(row.gross_certified_total));
  put(facts, 'assessed_land_value', positive(row.gross_certified_land));
  put(facts, 'assessed_building_value', positive(row.gross_certified_building));
  if (positive(row.sales_amount) > 100) {
    facts.sale_price = positive(row.sales_amount);
    put(facts, 'sale_date', isoDate(row.transfer_date));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.par_city) || '').toUpperCase(), zip: zipCode(row.par_zip) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for (const layer of [0, 1]) {
    for await (const row of cached(path.join(work, 'oh-cuyahoga', `parcels-${layer}.jsonl.gz`), () => layerRows(`${SERVICE}/${layer}`, COLUMNS))) {
      const record = fromRow(row);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Cuyahoga County Fiscal Officer', dataset: 'combined parcels, open data', method: 'county', source: 'oh-cuyahoga', as_of: isoDate(today.getTime()), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: `${SERVICE}/1`,
    facts: { living_sqft: 'total_res_liv_area', rooms: 'total_res_rooms', units: 'com_living_units', lot_sqft: 'total_square_ft', lot_acres: 'total_acreage', assessed_value: 'gross_certified_total', assessed_land_value: 'gross_certified_land', assessed_building_value: 'gross_certified_building', value_year: 'tax_year', sale_price: 'sales_amount', sale_date: 'transfer_date' },
  },
};

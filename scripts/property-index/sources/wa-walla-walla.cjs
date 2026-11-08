'use strict';
// Walla Walla County, Washington: the county's tax parcels with each account's appraisal record and main building, on its GIS ArcGIS Online.
// Its disclaimer says the data changes constantly, isn't guaranteed and is provided as is, and that users waive claims against and indemnify
// the county; it states no license and no limit on use. Year built, living area, basement and garage areas, bedrooms, baths, acres, the market
// value and its year. Owner, mailing, mortgage and exemption columns (senior and homestead values among them) are never asked for. The layer has
// no sale prices.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '53071';
const COUNTY = 'Walla Walla County';
const LAYER = 'https://services8.arcgis.com/COL6rRPkF9w28VGX/arcgis/rest/services/Tax_Parcels/FeatureServer/0';
const COLUMNS = ['prop_id', 'geo_id', 'prop_val_yr', 'situs_num', 'situs_sub_num', 'situs_street_prefix', 'situs_street', 'situs_street_sufix', 'situs_unit', 'situs_city', 'situs_zip', 'legal_desc', 'legal_acreage', 'hood_cd', 'market', 'land_acres', 'size_acres', 'dor_description', 'main_area_year_built', 'main_area_sq_ft', 'basement_area_sq_ft', 'bedrooms', 'bathrooms', 'garage_area_sq_ft'];

// Washington's Department of Revenue land use words, as the county records them.
function useOf(use, unit, row) {
  const u = String(use || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (u === 'HOUSEHOLD SINGLE FAMILY UNITS' || (u === 'VACATION & CABIN' && positive(row.main_area_sq_ft))) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/CONDOMINIUM/.test(u) && /HOUSEHOLD|RESIDENTIAL/.test(u)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (u === 'HOUSEHOLD 2-4 UNITS') return ['building', 'multi_unit'];
  if (u === 'HOUSEHOLD MULTI-UNITS (5 OR MORE)') return ['building', 'apartment'];
  if (/^UNDEVELOPED LAND|^ALL OTHER RESIDENTIAL|^VACATION & CABIN/.test(u)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const number = String(row.situs_num ?? '').trim();
  const unit = word(row.situs_unit) || '';
  const address = /^\d+[A-Z]?$/i.test(number) && word(row.situs_street) ? streetParts({ number, numberSuffix: word(row.situs_sub_num) || '', pre: word(row.situs_street_prefix) || '', name: word(row.situs_street) || '', suffix: word(row.situs_street_sufix) || '', unit }) : null;
  const account = word(row.prop_id);
  if (!address || !account) return null;
  const [kind, homeType] = useOf(row.dor_description, address.unit, row);
  const facts = { parcel_number: word(row.geo_id) || account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, row.situs_sub_num, row.situs_street_prefix, row.situs_street, row.situs_street_sufix].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.dor_description));
  put(facts, 'neighborhood', word(row.hood_cd));
  put(facts, 'legal_description', word(row.legal_desc)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.main_area_year_built));
  if (home) {
    put(facts, 'living_sqft', positive(row.main_area_sq_ft));
    put(facts, 'basement_sqft', positive(row.basement_area_sq_ft));
    put(facts, 'garage_sqft', positive(row.garage_area_sq_ft));
    put(facts, 'bedrooms', inRange(row.bedrooms, 15));
    put(facts, 'bathrooms', inRange(row.bathrooms, 12));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.land_acres) || positive(row.legal_acreage) || positive(row.size_acres));
  // Washington assesses at market value; the year is the assessment's.
  put(facts, 'market_value', positive(row.market));
  put(facts, 'value_year', positive(row.prop_val_yr));
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(row.situs_city ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), zip: zipCode(row.situs_zip) }, facts };
}

async function* build({ work }) {
  // The release is dated by the layer's last data edit: the county refreshes it from its appraisal system now and then.
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'wa-walla-walla', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'WA', name: COUNTY, publisher: 'Walla Walla County', dataset: 'tax parcels with appraisal records', method: 'county', source: 'wa-walla-walla', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'main_area_year_built', living_sqft: 'main_area_sq_ft', basement_sqft: 'basement_area_sq_ft', garage_sqft: 'garage_area_sq_ft', bedrooms: 'bedrooms', bathrooms: 'bathrooms', lot_acres: 'land_acres', market_value: 'market', value_year: 'prop_val_yr' },
  },
};

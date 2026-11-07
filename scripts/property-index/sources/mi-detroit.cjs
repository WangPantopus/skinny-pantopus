'use strict';
// Wayne County, Michigan: the City of Detroit's current parcel file on its Open Data Portal, from the Assessor. It covers the city, not the
// county's other municipalities, whose lookups get no record. Year built, floor area, style, assessed and taxable values and the last sale;
// no bedrooms or baths. Taxpayer columns are in the layer and never asked for; nor is the homestead column. Michigan's assessed value is
// half of market value.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, streetParts } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '26163';
const COUNTY = 'Wayne County';
const LAYER = 'https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/parcel_file_current/FeatureServer/0';
const COLUMNS = ['parcel_id', 'address', 'zip_code', 'street_number', 'street_prefix', 'street_name', 'property_class_description', 'use_code', 'use_code_description', 'building_style', 'year_built', 'total_floor_area', 'num_buildings', 'total_acreage', 'total_square_footage', 'amt_assessed_value', 'amt_taxable_value', 'amt_land_value', 'amt_sale_price', 'sale_date', 'zoning_district', 'subdivision', 'legal_description'];

function useOf(use, propertyClass) {
  const [u, c] = [String(use ?? '').toUpperCase(), String(propertyClass ?? '').toUpperCase()];
  if (/CONDO/.test(u) || /RESIDENTIAL CONDO/.test(c)) return ['property', 'condo'];
  if (u === 'SINGLE FAMILY' || u === 'INCOME BUNGALOW') return ['property', 'house'];
  if (u === 'ROW HOUSE') return ['property', 'townhouse'];
  if (/^(TWO|THREE|FOUR|FIVE|SIX) FAMILY$/.test(u) || /FLAT|DUPLEX/.test(u)) return ['building', 'multi_unit'];
  if (/APART|MULTIPLE RES/.test(u)) return ['building', 'apartment'];
  if (/VACANT/.test(u) || /VACANT/.test(c)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const parts = streetParts({ number: row.street_number, name: [row.street_prefix, row.street_name].filter(Boolean).join(' ') });
  const parcel = word(row.parcel_id);
  if (!parts || !parcel) return null;
  const [kind, homeType] = useOf(row.use_code_description, row.property_class_description);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', word(row.address));
  put(facts, 'municipality', 'Detroit');
  put(facts, 'land_use', word(row.use_code_description));
  put(facts, 'county_use_code', word(row.use_code));
  put(facts, 'property_class', word(row.property_class_description));
  put(facts, 'zoning', word(row.zoning_district));
  put(facts, 'subdivision', word(row.subdivision));
  put(facts, 'legal_description', word(row.legal_description)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.year_built));
    put(facts, 'style', word(row.building_style));
    put(facts, 'buildings_on_parcel', positive(row.num_buildings) > 1 ? positive(row.num_buildings) : null);
  }
  if (home) put(facts, 'living_sqft', positive(row.total_floor_area));
  else if (kind === 'building') put(facts, 'gross_sqft', positive(row.total_floor_area));
  put(facts, 'lot_acres', positive(row.total_acreage) || (positive(row.total_square_footage) ? Number((positive(row.total_square_footage) / 43560).toFixed(4)) : null));
  put(facts, 'assessed_value', positive(row.amt_assessed_value));
  put(facts, 'assessed_land_value', positive(row.amt_land_value));
  put(facts, 'taxable_value', positive(row.amt_taxable_value));
  if (positive(row.amt_sale_price) > 100 && isoDate(row.sale_date)) {
    facts.sale_price = positive(row.amt_sale_price);
    facts.sale_date = isoDate(row.sale_date);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...parts, city: 'DETROIT', zip: zipCode(row.zip_code) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mi-detroit', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'ObjectId' }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'MI', name: COUNTY, publisher: 'City of Detroit', dataset: 'current parcel file', method: 'county', source: 'mi-detroit', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'year_built', style: 'building_style', buildings_on_parcel: 'num_buildings', living_sqft: 'total_floor_area', gross_sqft: 'total_floor_area', lot_acres: 'total_acreage', assessed_value: 'amt_assessed_value', assessed_land_value: 'amt_land_value', taxable_value: 'amt_taxable_value', sale_price: 'amt_sale_price', sale_date: 'sale_date', zoning: 'zoning_district', subdivision: 'subdivision', legal_description: 'legal_description', land_use: 'use_code_description', property_class: 'property_class_description' },
  },
};

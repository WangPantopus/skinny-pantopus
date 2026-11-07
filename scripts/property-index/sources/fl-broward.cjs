'use strict';
// Broward County, Florida: the Property Appraiser's tax roll on the county's GIS (BCGIS) open service. It gives this county the bedrooms
// and baths the state's roll lacks. No terms are stated on the item. Owner, mailing and exemption columns are in the layer and never
// asked for. JUST_* is Florida's just value, its market value. The layer gives a last sale's date; its stamp tax isn't turned into a price.
// The layer has one row a parcel shape, so most condos, stacked on one shape, aren't in it. Those homes come from the state's roll.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12011';
const COUNTY = 'Broward County';
const LAYER = 'https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0';
const COLUMNS = ['FOLIO', 'USE_CODE', 'JUST_LAND_VALUE', 'JUST_BUILDING_VALUE', 'JUST_OTHER_VALUE', 'LEGAL_LINE_1', 'LEGAL_LINE_2', 'SALE_DATE_1', 'SITUS_STREET_NUMBER', 'SITUS_STREET_DIRECTION', 'SITUS_STREET_POST_DIR', 'SITUS_STREET_NAME', 'SITUS_STREET_TYPE', 'SITUS_CITY', 'SITUS_ZIP_CODE', 'SITUS_UNIT_NUMBER', 'BLDG_ADJ_SQ_FOOTAGE', 'BLDG_TOT_SQ_FOOTAGE', 'BLDG_UNITS', 'BLDG_YEAR_BUILT', 'GIS_SQUARE_FOOT', 'ACTUAL_YEAR_BUILT', 'BEDS', 'BATHS'];
// Florida's Department of Revenue use codes.
const USES = { '00': 'Vacant residential', '01': 'Single family', '02': 'Mobile home', '03': 'Multi-family, 10 units or more', '04': 'Condominium', '05': 'Cooperative', '06': 'Retirement home', '08': 'Multi-family, fewer than 10 units', '09': 'Residential common elements' };

function useOf(code, unit) {
  if (code === '01') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (code === '02') return ['property', 'mobile_home'];
  if (code === '04' || code === '05') return ['unit', 'condo'];
  if (code === '08') return ['building', 'multi_unit'];
  if (code === '03') return ['building', 'apartment'];
  if (code === '00') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.SITUS_UNIT_NUMBER));
  const address = streetParts({ number: row.SITUS_STREET_NUMBER, pre: word(row.SITUS_STREET_DIRECTION) || '', name: word(row.SITUS_STREET_NAME) || '', suffix: word(row.SITUS_STREET_TYPE) || '', post: word(row.SITUS_STREET_POST_DIR) || '', unit });
  const folio = word(row.FOLIO);
  if (!address || !folio) return null;
  const code = String(row.USE_CODE ?? '').trim().padStart(2, '0');
  const [kind, homeType] = useOf(code, address.unit);
  const facts = { parcel_number: folio, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.SITUS_STREET_NUMBER, row.SITUS_STREET_DIRECTION, row.SITUS_STREET_NAME, row.SITUS_STREET_TYPE, row.SITUS_STREET_POST_DIR].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', USES[code]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', [row.LEGAL_LINE_1, row.LEGAL_LINE_2].map(word).filter(Boolean).join(' ').slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.ACTUAL_YEAR_BUILT) || year(row.BLDG_YEAR_BUILT));
  if (home) {
    put(facts, 'living_sqft', positive(row.BLDG_ADJ_SQ_FOOTAGE));
    put(facts, 'gross_sqft', positive(row.BLDG_TOT_SQ_FOOTAGE));
    put(facts, 'bedrooms', inRange(row.BEDS, 15));
    put(facts, 'bathrooms', inRange(row.BATHS, 15));
  }
  if (kind === 'building') put(facts, 'units', positive(row.BLDG_UNITS));
  if (kind !== 'unit' && homeType !== 'mobile_home') put(facts, 'lot_sqft', positive(row.GIS_SQUARE_FOOT));
  const [land, building, other] = [positive(row.JUST_LAND_VALUE), positive(row.JUST_BUILDING_VALUE), positive(row.JUST_OTHER_VALUE)];
  put(facts, 'market_value', (land || 0) + (building || 0) + (other || 0) || null);
  put(facts, 'market_land_value', land);
  put(facts, 'market_building_value', building);
  put(facts, 'sale_date', isoDate(row.SALE_DATE_1));
  return { id: `pp:${kind}:${FIPS}:${folio}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITUS_CITY) || '').toUpperCase(), zip: zipCode(row.SITUS_ZIP_CODE) }, facts };
}

async function* build({ work, today }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'fl-broward', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'OBJECTID_12' }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} folios, ${noAddress} without a street number`);
  const folios = new Set(records.map((record) => record.facts.parcel_number));
  const fromRoll = (await countyRoll(work, FIPS, today)).records.filter((record) => !folios.has(record.facts.parcel_number) && !(record.kind === 'building' && record.home_type === 'condo'));
  for (const record of fromRoll) {
    // As in the layer's records: nothing that could hint at a homestead.
    for (const fact of ['assessed_value', 'taxable_value', 'exemptions']) delete record.facts[fact];
    records.push(record);
  }
  log(`${COUNTY}: ${fromRoll.length} more from the state's roll`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Broward County Property Appraiser', dataset: 'tax roll, with the state roll for condos', method: 'county', source: 'fl-broward', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'ACTUAL_YEAR_BUILT', living_sqft: 'BLDG_ADJ_SQ_FOOTAGE', gross_sqft: 'BLDG_TOT_SQ_FOOTAGE', bedrooms: 'BEDS', bathrooms: 'BATHS', units: 'BLDG_UNITS', lot_sqft: 'GIS_SQUARE_FOOT', market_land_value: 'JUST_LAND_VALUE', market_building_value: 'JUST_BUILDING_VALUE', sale_date: 'SALE_DATE_1' },
  },
};

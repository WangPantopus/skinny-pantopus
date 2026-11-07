'use strict';
// Miami-Dade County, Florida: the Property Appraiser's Property Point View on the county's open data site. It gives this county the
// bedrooms and baths the state's roll lacks. The county provides it "as is". Owner and mailing columns are in the layer and never asked
// for. Florida's protected people's records are the Appraiser's to withhold; none of the owner columns are read here. ASSESSED_VAL_CUR
// is the assessed value, capped by law, so it's never a market value. Florida's just value stays with the state's roll.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '12086';
const COUNTY = 'Miami-Dade County';
const LAYER = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/PaGISView_gdb/FeatureServer/0';
const COLUMNS = ['FOLIO', 'TRUE_SITE_ADDR', 'TRUE_SITE_UNIT', 'TRUE_SITE_CITY', 'TRUE_SITE_ZIP_CODE', 'CONDO_FLAG', 'DOR_CODE_CUR', 'DOR_DESC', 'SUBDIVISION', 'BEDROOM_COUNT', 'BATHROOM_COUNT', 'HALF_BATHROOM_COUNT', 'FLOOR_COUNT', 'UNIT_COUNT', 'BUILDING_ACTUAL_AREA', 'BUILDING_HEATED_AREA', 'LOT_SIZE', 'YEAR_BUILT', 'ASSESSMENT_YEAR_CUR', 'ASSESSED_VAL_CUR', 'DOS_1', 'PRICE_1', 'LEGAL'];

function useOf(row, unit) {
  const code = String(row.DOR_CODE_CUR ?? '').trim();
  const group = code.slice(0, 2);
  if (code === '0407' || group === '05' || (group === '01' && unit)) return ['unit', 'condo'];
  if (code === '0410' || code === '0470') return ['property', 'townhouse'];
  // 5001 and 5002 are farms with one home or two on them.
  if (group === '01' || code === '5001') return ['property', 'house'];
  if (group === '02') return ['property', 'mobile_home'];
  if (group === '08' || code === '5002') return ['building', 'multi_unit'];
  if (group === '03') return ['building', 'apartment'];
  if (group === '00') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const line = word(row.TRUE_SITE_ADDR);
  const address = line ? parse(line, realUnit(word(row.TRUE_SITE_UNIT))) : null;
  const folio = word(row.FOLIO);
  if (!address || !folio) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: folio, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line, row.TRUE_SITE_UNIT));
  put(facts, 'land_use', word(row.DOR_DESC));
  put(facts, 'county_use_code', word(row.DOR_CODE_CUR));
  put(facts, 'subdivision', word(row.SUBDIVISION));
  put(facts, 'legal_description', word(row.LEGAL)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'stories', inRange(row.FLOOR_COUNT, kind === 'building' ? 120 : 6));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.BUILDING_HEATED_AREA));
    put(facts, 'gross_sqft', positive(row.BUILDING_ACTUAL_AREA));
    put(facts, 'bedrooms', inRange(row.BEDROOM_COUNT, 15));
    const [full, half] = [inRange(row.BATHROOM_COUNT, 15), inRange(row.HALF_BATHROOM_COUNT, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind === 'building') put(facts, 'units', positive(row.UNIT_COUNT));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LOT_SIZE));
  put(facts, 'value_year', positive(row.ASSESSMENT_YEAR_CUR));
  put(facts, 'assessed_value', positive(row.ASSESSED_VAL_CUR));
  if (positive(row.PRICE_1) > 100) {
    facts.sale_price = positive(row.PRICE_1);
    put(facts, 'sale_date', isoDate(row.DOS_1));
  }
  return { id: `pp:${kind}:${FIPS}:${folio}`, kind, home_type: homeType, address: { ...address, city: String(word(row.TRUE_SITE_CITY) || '').toUpperCase(), zip: zipCode(row.TRUE_SITE_ZIP_CODE) }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'fl-miami-dade', 'points.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} folios, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Miami-Dade County Property Appraiser', dataset: 'Property Point View, open data', method: 'county', source: 'fl-miami-dade', as_of: asOf, stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'BUILDING_HEATED_AREA', gross_sqft: 'BUILDING_ACTUAL_AREA', bedrooms: 'BEDROOM_COUNT', full_baths: 'BATHROOM_COUNT', half_baths: 'HALF_BATHROOM_COUNT', stories: 'FLOOR_COUNT', units: 'UNIT_COUNT', lot_sqft: 'LOT_SIZE', assessed_value: 'ASSESSED_VAL_CUR', value_year: 'ASSESSMENT_YEAR_CUR', sale_price: 'PRICE_1', sale_date: 'DOS_1' },
  },
};

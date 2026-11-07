'use strict';
// Guilford County, North Carolina: the county's own GIS parcel service, with the bedrooms and baths the statewide parcels lack. No terms
// are stated on the service. Owner, mailing and exclusion columns are in the layer and never asked for. Assessed land and building values
// are the county's appraised values at its last revaluation, so they're shown as assessed.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37081';
const COUNTY = 'Guilford County';
const LAYER = 'https://gcgis.guilfordcountync.gov/arcgis/rest/services/AreaPlans/AreaPlanViewer/MapServer/7';
const COLUMNS = ['PIN', 'REID', 'PROPERTY_DESCR', 'CITY', 'ZONING', 'LAND_CLASS', 'ACREAGE', 'CALCULATED_ACRES', 'PHYADDR_STR_NUM', 'PHYADDR_DIR_PFX', 'PHYADDR_STR', 'PHYADDR_STR_TYPE', 'PHYADDR_STR_SFX', 'PHYADDR_CITY', 'PHYADDR_ZIP', 'PHYADDR_STR_MISC', 'TOTAL_LAND_VALUE_ASSESSED', 'TOTAL_BLDG_VALUE_ASSESSED', 'DEED_BOOK', 'DEED_PAGE', 'PKG_SALE_DATE', 'PKG_SALE_PRICE', 'TOTAL_UNITS', 'NEIGHBORHOOD', 'YEAR_BUILT', 'MAIN_BLDG_HEATED_AREA', 'HEATED_AREA', 'BEDROOMS', 'BATH_FULL_CNT', 'BATH_HALF_CNT', 'BLDG_DESC'];

function useOf(row, unit) {
  const use = String(row.LAND_CLASS || '').toUpperCase();
  const building = String(row.BLDG_DESC || '').toUpperCase();
  if (use === 'CONDO' || /^04-CONDO/.test(building)) return ['unit', 'condo'];
  if (use === 'TOWNHOUSE' || /^041-TOWNHOME|^05-PATIOHM/.test(building)) return ['property', 'townhouse'];
  if (/MH$|MANUFHM/.test(use) || /MANUFHM/.test(building)) return ['property', 'mobile_home'];
  if (use === 'MULTI-FAMILY<4' || /DUPLEX/.test(building)) return ['building', 'multi_unit'];
  if (use === 'APART' || use === 'MULTI-FAMILY5>') return ['building', 'apartment'];
  if (use === 'RESIDENTIAL') return building ? (unit ? ['unit', 'condo'] : ['property', 'house']) : ['parcel', null];
  if (use === 'VACANT' || use === 'COMMON AREA') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.PHYADDR_STR_MISC));
  const address = streetParts({ number: row.PHYADDR_STR_NUM, pre: word(row.PHYADDR_DIR_PFX) || '', name: word(row.PHYADDR_STR) || '', suffix: word(row.PHYADDR_STR_TYPE) || '', post: word(row.PHYADDR_STR_SFX) || '', unit });
  const parcel = word(row.REID) || word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.PHYADDR_STR_NUM, row.PHYADDR_DIR_PFX, row.PHYADDR_STR, row.PHYADDR_STR_TYPE, row.PHYADDR_STR_SFX].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.LAND_CLASS));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'neighborhood', word(row.NEIGHBORHOOD));
  put(facts, 'legal_description', word(row.PROPERTY_DESCR)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YEAR_BUILT));
  if (home) {
    put(facts, 'living_sqft', positive(row.MAIN_BLDG_HEATED_AREA) || positive(row.HEATED_AREA));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    const [full, half] = [inRange(row.BATH_FULL_CNT, 15), inRange(row.BATH_HALF_CNT, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind === 'building') put(facts, 'units', positive(row.TOTAL_UNITS));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE) || positive(row.CALCULATED_ACRES));
  const [land, building] = [positive(row.TOTAL_LAND_VALUE_ASSESSED), positive(row.TOTAL_BLDG_VALUE_ASSESSED)];
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  if (positive(row.PKG_SALE_PRICE) > 100) {
    facts.sale_price = positive(row.PKG_SALE_PRICE);
    put(facts, 'sale_date', isoDate(row.PKG_SALE_DATE));
    if (word(row.DEED_BOOK) && word(row.DEED_PAGE)) facts.sale_document = `${word(row.DEED_BOOK)}-${word(row.DEED_PAGE)}`;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.PHYADDR_CITY) || '').toUpperCase(), zip: zipCode(row.PHYADDR_ZIP) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'nc-guilford', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
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
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Guilford County Tax Department', dataset: 'parcels, county GIS', method: 'county', source: 'nc-guilford', as_of: isoDate(today.getTime()), stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'MAIN_BLDG_HEATED_AREA', bedrooms: 'BEDROOMS', full_baths: 'BATH_FULL_CNT', half_baths: 'BATH_HALF_CNT', units: 'TOTAL_UNITS', lot_acres: 'ACREAGE', assessed_land_value: 'TOTAL_LAND_VALUE_ASSESSED', assessed_building_value: 'TOTAL_BLDG_VALUE_ASSESSED', sale_price: 'PKG_SALE_PRICE', sale_date: 'PKG_SALE_DATE' },
  },
};

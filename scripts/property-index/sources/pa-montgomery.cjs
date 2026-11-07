'use strict';
// Montgomery County, Pennsylvania: the county's parcels, "a free and open resource" on its open data site. The layer carries owner
// and mailing columns; they're never asked for. Pennsylvania counties assess on an old base year, so these are assessed values,
// never market values. The layer's building columns are codes with no published words: walls, heat, fuel and style stay out until
// someone reads them off the county's page. Numbers need no words.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42091';
const COUNTY = 'Montgomery County';
const LAYER = 'https://services1.arcgis.com/kOChldNuKsox8qZD/arcgis/rest/services/Montgomery_County_Parcels/FeatureServer/6';
const COLUMNS = ['TAXPIN', 'PARCELTYPE', 'CLASS', 'LIV_UNITS', 'LAND_USE', 'TOTAL_ASSE', 'SCH_DIST', 'SUBDIVISIO', 'LEGAL1', 'LEGAL2', 'LEGAL3', 'LOC_NO', 'LOC_DIR', 'LOC_STR', 'LOC_SUF', 'LOC_SUF2', 'LOC_UNITDE', 'LOC_UNITNO', 'LOCATION1', 'LOCATION2', 'LOC_ZIP1_Z', 'SALE_DATE', 'CONSIDERAT', 'DEED_BOOK', 'DEED_PAGE', 'LAND_SF', 'LAND_ACRES', 'POOL', 'SFLA', 'FINBSMT_SF', 'STORIES', 'YEAR_BUILT', 'BEDROOMS', 'BATHS', 'HALF_BATHS', 'RM_TOT'];

function useOf(row, unit, hasBuilding) {
  const type = String(row.PARCELTYPE || '').toUpperCase();
  if (type === 'CONDOMINIUM') return ['unit', 'condo'];
  if (type === 'MOBILE HOME') return ['property', 'mobile_home'];
  if (type !== 'BASE PARCEL' || String(row.CLASS || '').trim() !== 'R') return ['other', null];
  if (!hasBuilding) return ['parcel', null];
  const units = positive(row.LIV_UNITS);
  if (units && units >= 5) return ['building', 'apartment'];
  if (units && units >= 2) return ['building', 'multi_unit'];
  return unit ? ['unit', 'condo'] : ['property', 'house'];
}

const inRange = (value, most) => {
  const count = positive(String(value ?? '').trim());
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit([word(row.LOC_UNITDE), word(row.LOC_UNITNO)].filter(Boolean).join(' '));
  const address = streetParts({ number: row.LOC_NO, pre: word(row.LOC_DIR) || '', name: word(row.LOC_STR) || '', suffix: word(row.LOC_SUF) || '', post: word(row.LOC_SUF2) || '', unit });
  const parcel = word(row.TAXPIN);
  if (!address || !parcel) return null;
  const size = positive(row.SFLA);
  const [kind, homeType] = useOf(row, address.unit, Boolean(size));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', [row.LOCATION1, row.LOCATION2].map(word).filter(Boolean).join(' '));
  put(facts, 'school_district', word(row.SCH_DIST));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  put(facts, 'county_use_code', word(row.LAND_USE));
  put(facts, 'legal_description', [row.LEGAL1, row.LEGAL2, row.LEGAL3].map(word).filter(Boolean).join(' ').slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'stories', inRange(row.STORIES, kind === 'building' ? 40 : 6));
  }
  if (home) {
    put(facts, 'living_sqft', size);
    put(facts, 'basement_finished_sqft', positive(row.FINBSMT_SF));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    put(facts, 'rooms', inRange(row.RM_TOT, 40));
    const [full, half] = [inRange(row.BATHS, 15), inRange(row.HALF_BATHS, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    if (word(row.POOL)) facts.pool = 'Yes';
  }
  if (kind === 'building') put(facts, 'units', positive(row.LIV_UNITS));
  if (kind !== 'unit') {
    if (positive(row.LAND_SF)) facts.lot_sqft = positive(row.LAND_SF);
    else put(facts, 'lot_acres', positive(row.LAND_ACRES));
  }
  put(facts, 'assessed_value', positive(row.TOTAL_ASSE));
  if (positive(row.CONSIDERAT) > 100) {
    facts.sale_price = positive(row.CONSIDERAT);
    put(facts, 'sale_date', isoDate(row.SALE_DATE));
    if (word(row.DEED_BOOK) && word(row.DEED_PAGE)) facts.sale_document = `${word(row.DEED_BOOK)}-${word(row.DEED_PAGE)}`;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.LOC_ZIP1_Z) }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'pa-montgomery', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
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
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'Montgomery County Board of Assessment', dataset: 'parcels, open data', method: 'county', source: 'pa-montgomery', as_of: asOf, stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'SFLA', basement_finished_sqft: 'FINBSMT_SF', bedrooms: 'BEDROOMS', full_baths: 'BATHS', half_baths: 'HALF_BATHS', rooms: 'RM_TOT', stories: 'STORIES', units: 'LIV_UNITS', lot_sqft: 'LAND_SF', lot_acres: 'LAND_ACRES', assessed_value: 'TOTAL_ASSE', sale_price: 'CONSIDERAT', sale_date: 'SALE_DATE' },
  },
};

'use strict';
// Adams County, Colorado: the county's open data under Creative Commons Attribution 4.0, so the county is credited. Four tables
// joined on the parcel identification number; owner, grantor and grantee columns are never asked for. Actual value is Colorado's
// market value on its reappraisal date.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08001';
const COUNTY = 'Adams County';
const BASE = 'https://services3.arcgis.com/4PNQOtAivErR7nbT/arcgis/rest/services';
const PARCELS = `${BASE}/Parcels/FeatureServer/0`;
const IMPROVEMENTS = `${BASE}/Property_Improvements/FeatureServer/0`;
const VALUES = `${BASE}/Property_Values/FeatureServer/0`;
const SALES = `${BASE}/Property_Sales/FeatureServer/0`;
const PARCEL_COLUMNS = ['PIN', 'PARCELNB', 'SUBNAME', 'STREETNO', 'STREETDIR', 'STREETNAME', 'STREETSUF', 'STREETPOSTDIR', 'STREETALP', 'LOCCITY', 'LOCZIP', 'LEGAL'];
const IMPROVEMENT_COLUMNS = ['pin', 'bltasdesc', 'proptype', 'yrblt', 'sf', 'rooms', 'bedrooms', 'baths', 'exterior', 'attgarsf', 'detgarsf', 'bsmntsf', 'finbsmntsf'];
const VALUE_COLUMNS = ['PIN', 'ACTLANDVAL', 'ACTIMPSVAL', 'ACTTOTALVAL', 'ASDLANDVAL', 'ASDIMPSVAL', 'ASDTOTALVAL', 'LOTSIZE', 'LOTMEASURE', 'SCHOOLNAME'];
const SALE_COLUMNS = ['pin', 'recptno', 'saledt', 'salep'];

function useOf(building, unit) {
  const use = String(building?.proptype || '').toUpperCase();
  if (!use) return ['parcel', null];
  if (use === 'RESIDENTIAL') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (use === 'TOWNHOUSE') return ['property', 'townhouse'];
  if (use === 'CONDO') return ['unit', 'condo'];
  if (use === 'MOBILE HOME') return ['property', 'mobile_home'];
  if (use === 'DUPLEX' || use === 'TRIPLEX') return ['building', 'multi_unit'];
  if (use === 'MULTIPLE UNIT') return ['building', 'apartment'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const STORY_WORDS = /^Ranch 1 Story$|^(Townhouse|Duplex) One Story$/;
function storiesOf(words) {
  if (STORY_WORDS.test(words || '')) return 1;
  if (/^(2 Story|Townhouse Two Story)$/.test(words || '')) return 2;
  return /^3 Story$/.test(words || '') ? 3 : null;
}

function fromRow(row, { building, value, sale }) {
  const unit = realUnit(word(row.STREETALP));
  const address = streetParts({ number: row.STREETNO, pre: word(row.STREETDIR) || '', name: word(row.STREETNAME) || '', suffix: word(row.STREETSUF) || '', post: word(row.STREETPOSTDIR) || '', unit });
  const parcel = word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(building, address.unit);
  const facts = { parcel_number: word(row.PARCELNB) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.STREETNO, row.STREETDIR, row.STREETNAME, row.STREETSUF, row.STREETPOSTDIR].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'subdivision', word(row.SUBNAME));
  put(facts, 'legal_description', word(row.LEGAL)?.slice(0, 300));
  put(facts, 'school_district', word(value?.SCHOOLNAME));
  put(facts, 'land_use', word(building?.proptype));
  if (building && (home || kind === 'building')) {
    put(facts, 'year_built', year(Math.trunc(Number(building.yrblt))));
    put(facts, 'style', word(building.bltasdesc));
    put(facts, 'stories', storiesOf(word(building.bltasdesc)));
    put(facts, 'exterior_walls', word(building.exterior));
  }
  if (building && home) {
    put(facts, 'living_sqft', positive(building.sf));
    put(facts, 'bedrooms', inRange(building.bedrooms, 15));
    put(facts, 'bathrooms', inRange(building.baths, 15));
    put(facts, 'rooms', inRange(building.rooms, 40));
    put(facts, 'basement_sqft', positive(building.bsmntsf));
    put(facts, 'basement_finished_sqft', positive(building.finbsmntsf));
    const [attached, detached] = [positive(building.attgarsf), positive(building.detgarsf)];
    put(facts, 'garage_sqft', (attached || 0) + (detached || 0) || null);
    if (attached) facts.garage = 'Attached';
    else if (detached) facts.garage = 'Detached';
  }
  if (kind !== 'unit') {
    const lot = positive(value?.LOTSIZE);
    if (lot && /AC/i.test(value.LOTMEASURE || '')) facts.lot_acres = lot;
    else if (lot && /^SF/i.test(value.LOTMEASURE || '')) facts.lot_sqft = lot;
  }
  if (value) {
    put(facts, 'market_value', positive(value.ACTTOTALVAL));
    put(facts, 'market_land_value', positive(value.ACTLANDVAL));
    put(facts, 'market_building_value', positive(value.ACTIMPSVAL));
    put(facts, 'assessed_value', positive(value.ASDTOTALVAL));
    put(facts, 'assessed_land_value', positive(value.ASDLANDVAL));
    put(facts, 'assessed_building_value', positive(value.ASDIMPSVAL));
  }
  if (sale) {
    facts.sale_price = positive(sale.salep);
    put(facts, 'sale_date', isoDate(sale.saledt));
    put(facts, 'sale_document', word(sale.recptno));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.LOCCITY) || '').toUpperCase(), zip: zipCode(row.LOCZIP) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'co-adams');
  const info = await getJson(`${VALUES}?f=json`, 'The table\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const buildings = new Map();
  for await (const row of cached(path.join(dir, 'improvements.jsonl.gz'), () => layerRows(IMPROVEMENTS, IMPROVEMENT_COLUMNS))) {
    if (/^(COMMERCIAL|OUT BUILDING)$/i.test(row.proptype || '')) continue;
    const was = buildings.get(row.pin);
    if (!was || Number(row.sf) > Number(was.sf)) buildings.set(row.pin, row);
  }
  const values = new Map();
  for await (const row of cached(path.join(dir, 'values.jsonl.gz'), () => layerRows(VALUES, VALUE_COLUMNS))) values.set(row.PIN, row);
  const sales = new Map();
  for await (const row of cached(path.join(dir, 'sales.jsonl.gz'), () => layerRows(SALES, SALE_COLUMNS))) {
    if (!(positive(row.salep) > 100)) continue;
    const was = sales.get(row.pin);
    if (!was || Number(row.saledt) > Number(was.saledt)) sales.set(row.pin, row);
  }
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(dir, 'parcels.jsonl.gz'), () => layerRows(PARCELS, PARCEL_COLUMNS))) {
    const record = fromRow(row, { building: buildings.get(row.PIN), value: values.get(row.PIN), sale: sales.get(row.PIN) });
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number; ${buildings.size} buildings, ${values.size} values, ${sales.size} sales`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'Adams County', dataset: 'parcels and property tables, open data (CC BY 4.0)', method: 'county', source: 'co-adams', as_of: asOf, stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [PARCELS, IMPROVEMENTS, VALUES, SALES],
    facts: { year_built: 'yrblt', living_sqft: 'sf', bedrooms: 'bedrooms', bathrooms: 'baths', rooms: 'rooms', basement_sqft: 'bsmntsf', basement_finished_sqft: 'finbsmntsf', garage_sqft: 'attgarsf', market_value: 'ACTTOTALVAL', market_land_value: 'ACTLANDVAL', market_building_value: 'ACTIMPSVAL', assessed_value: 'ASDTOTALVAL', assessed_land_value: 'ASDLANDVAL', assessed_building_value: 'ASDIMPSVAL', sale_price: 'salep', sale_date: 'saledt' },
  },
};

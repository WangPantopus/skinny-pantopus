'use strict';
// Denver, Colorado: the City and County's residential characteristics on its open data service, updated daily. The catalog is CC BY
// 3.0, crediting "City of Denver Open Data Catalog" (web's data sources page); each item's use constraints are disclaimers. The table
// carries owner columns; they're never asked for, and neither are exemption amounts. TOTAL_VALUE is the
// Assessor's actual value, Colorado's market value on its reappraisal date. Sale prices come from the city's own sales table.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, streetParts, onRecord, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08031';
const COUNTY = 'Denver County';
const BASE = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services';
const HOMES = `${BASE}/ODC_real_property_residential_characteristics/FeatureServer/50`;
const SALES = `${BASE}/ODC_real_property_sales_and_transfers/FeatureServer/51`;
const COLUMNS = ['PARID', 'OFCARD', 'SITE_NBR', 'SITE_DIR', 'SITE_NAME', 'SITE_MODE', 'SITE_MORE', 'TAX_DIST', 'PROP_CLASS', 'ZONE10', 'D_CLASS_CN', 'LAND_SQFT', 'AREA_ABG', 'BSMT_AREA', 'FBSMT_SQFT', 'STORY', 'STYLE_CN', 'BED_RMS', 'FULL_B', 'HLF_B', 'CCYRBLT', 'UNITS', 'ASMT_APPR_LAND', 'ASMT_APPR_IMPR', 'TOTAL_VALUE', 'ASDLAND', 'ASDIMPR', 'ASSESS_VALUE', 'NBHD_1_CN', 'LEGL_DESCRIPTION'];
const SALE_COLUMNS = ['PARID', 'RECEPTION_NUM', 'SALE_YEAR', 'SALE_MONTHDAY', 'SALE_PRICE'];
const PARCELS = `${BASE}/ODC_PROP_PARCELS_A/FeatureServer/245`;
const PARCEL_COLUMNS = ['SCHEDNUM', 'SITUS_ZIP', 'SITUS_UNIT_IDENT'];

function useOf(row, unit) {
  const use = `${row.D_CLASS_CN || ''} ${row.PROP_CLASS || ''}`.toUpperCase();
  if (/VACANT|LAND FOR LAND|LAND CONTIGUOUS/.test(use)) return ['parcel', null];
  if (/CONDOMINIUM/.test(use)) return ['unit', 'condo'];
  if (/ROWHOUSE/.test(use)) return ['property', 'townhouse'];
  if (/^MH /.test(use)) return ['other', null];
  if (positive(row.UNITS) > 1) return ['building', 'multi_unit'];
  if (/SFR|SINGLE FAMILY|RESIDENTIAL/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row, sale, parcelRow) {
  const unit = realUnit(word(row.SITE_MORE)) || realUnit(word(parcelRow?.SITUS_UNIT_IDENT));
  const address = streetParts({ number: row.SITE_NBR, pre: word(row.SITE_DIR) || '', name: word(row.SITE_NAME) || '', suffix: word(row.SITE_MODE) || '', unit });
  const parcel = word(row.PARID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.SITE_NBR, row.SITE_DIR, row.SITE_NAME, row.SITE_MODE].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.PROP_CLASS));
  put(facts, 'zoning', word(row.ZONE10));
  put(facts, 'neighborhood', word(row.NBHD_1_CN));
  put(facts, 'tax_code_area', word(row.TAX_DIST));
  put(facts, 'legal_description', word(row.LEGL_DESCRIPTION)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.CCYRBLT));
    put(facts, 'style', word(row.STYLE_CN));
    put(facts, 'stories', inRange(row.STORY, 60));
    if (positive(row.OFCARD) > 1) facts.buildings_on_parcel = Math.trunc(Number(row.OFCARD));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.AREA_ABG));
    put(facts, 'basement_sqft', positive(row.BSMT_AREA));
    put(facts, 'basement_finished_sqft', positive(row.FBSMT_SQFT));
    put(facts, 'bedrooms', inRange(row.BED_RMS, 15));
    const [full, half] = [inRange(row.FULL_B, 15), inRange(row.HLF_B, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind === 'building') put(facts, 'units', positive(row.UNITS));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LAND_SQFT));
  put(facts, 'market_value', positive(row.TOTAL_VALUE));
  put(facts, 'market_land_value', positive(row.ASMT_APPR_LAND));
  put(facts, 'market_building_value', positive(row.ASMT_APPR_IMPR));
  put(facts, 'assessed_value', positive(row.ASSESS_VALUE));
  put(facts, 'assessed_land_value', positive(row.ASDLAND));
  put(facts, 'assessed_building_value', positive(row.ASDIMPR));
  if (sale) {
    facts.sale_price = positive(sale.SALE_PRICE);
    const monthDay = String(sale.SALE_MONTHDAY ?? '').padStart(4, '0');
    put(facts, 'sale_date', isoDate(`${sale.SALE_YEAR}-${monthDay.slice(0, 2)}-${monthDay.slice(2)}`));
    put(facts, 'sale_document', word(sale.RECEPTION_NUM));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'DENVER', zip: zipCode(parcelRow?.SITUS_ZIP) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'co-denver');
  const info = await getJson(`${HOMES}?f=json`, 'The table\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const sales = new Map();
  for await (const row of cached(path.join(dir, 'sales.jsonl.gz'), () => layerRows(SALES, SALE_COLUMNS))) {
    if (!(positive(row.SALE_PRICE) > 100)) continue;
    const was = sales.get(row.PARID);
    const when = (sale) => `${sale.SALE_YEAR}${String(sale.SALE_MONTHDAY ?? '').padStart(4, '0')}`;
    if (!was || when(row) > when(was)) sales.set(row.PARID, row);
  }
  const parcels = new Map();
  for await (const row of cached(path.join(dir, 'parcels.jsonl.gz'), () => layerRows(PARCELS, PARCEL_COLUMNS))) parcels.set(row.SCHEDNUM, row);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(dir, 'homes.jsonl.gz'), () => layerRows(HOMES, COLUMNS))) {
    const record = fromRow(row, sales.get(row.PARID), parcels.get(row.PARID));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} homes, ${noAddress} without a street number, ${sales.size} sales`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'City and County of Denver, Assessor', dataset: 'residential characteristics, open data', method: 'county', source: 'co-denver', as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['08']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [HOMES, SALES],
    facts: { year_built: 'CCYRBLT', living_sqft: 'AREA_ABG', basement_sqft: 'BSMT_AREA', basement_finished_sqft: 'FBSMT_SQFT', bedrooms: 'BED_RMS', full_baths: 'FULL_B', half_baths: 'HLF_B', stories: 'STORY', units: 'UNITS', lot_sqft: 'LAND_SQFT', market_value: 'TOTAL_VALUE', market_land_value: 'ASMT_APPR_LAND', market_building_value: 'ASMT_APPR_IMPR', assessed_value: 'ASSESS_VALUE', assessed_land_value: 'ASDLAND', assessed_building_value: 'ASDIMPR', sale_price: 'SALE_PRICE', sale_date: 'SALE_YEAR' },
  },
};

'use strict';
// Contra Costa County, California: the county's public assessment parcel layer. No terms are stated on it. Its mailing and exemption columns
// are never asked for. Values are Proposition 13 assessed values, never market values. No bedrooms, baths or sale prices.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06013';
const COUNTY = 'Contra Costa County';
const LAYER = 'https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0';
const COLUMNS = ['APN', 'TRA', 'S_STR_NM', 'S_STR_SUF', 'S_STR_NBR', 'S_FRAC', 'S_APT_NBR', 's_city', 'S_ZIP', 'DESC_', 'ACREAGE', 'USE_CODE', 'Description', 'LAND_VALUE', 'IMP_VAL', 'YR_BUILT', 'BLDG_SQFT', 'C_DED_DT'];

function useOf(words, unit, built) {
  const use = String(words || '').toUpperCase();
  if (/^CONDOMINIUM/.test(use)) return ['unit', 'condo'];
  if (/^TOWNHOUSES/.test(use)) return ['property', 'townhouse'];
  if (/^MANUFACTURED/.test(use)) return ['property', 'mobile_home'];
  if (/^SINGLE FAMILY, 2 OR MORE|^DUPLEX|^TRIPLEX|^FOURPLEX|^2.?4 UNIT/.test(use)) return ['building', 'multi_unit'];
  if (/^APARTMENT|^MULTIPLE|UNITS/.test(use)) return ['building', 'apartment'];
  if (/^SINGLE FAMILY/.test(use)) return built || !/^VACANT/.test(use) ? (unit ? ['unit', 'condo'] : ['property', 'house']) : ['parcel', null];
  if (/^RURAL, RESIDENTIAL IMPROVED/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/^VACANT|^COMMON AREA/.test(use)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row, valueYear) {
  const unit = realUnit(word(row.S_APT_NBR));
  const fraction = /\//.test(row.S_FRAC || '') ? word(row.S_FRAC) : '';
  const address = streetParts({ number: row.S_STR_NBR, numberSuffix: fraction, name: word(row.S_STR_NM) || '', suffix: word(row.S_STR_SUF) || '', unit });
  const parcel = word(row.APN);
  if (!address || !parcel) return null;
  const size = positive(row.BLDG_SQFT);
  const [kind, homeType] = useOf(row.Description, address.unit, Boolean(size));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.S_STR_NBR, fraction, row.S_STR_NM, row.S_STR_SUF].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'tax_code_area', word(row.TRA));
  put(facts, 'land_use', word(row.Description));
  put(facts, 'county_use_code', word(row.USE_CODE));
  put(facts, 'legal_description', word(row.DESC_)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(String(row.YR_BUILT ?? '').trim()));
  if (home) put(facts, 'living_sqft', size);
  if (kind === 'building') put(facts, 'gross_sqft', size);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE));
  const [land, building] = [positive(row.LAND_VALUE), positive(row.IMP_VAL)];
  put(facts, 'value_year', valueYear);
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.s_city) || '').toUpperCase(), zip: zipCode(row.S_ZIP) }, facts };
}

async function* build({ work, today }) {
  const asOf = isoDate(today.getTime());
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-contra-costa', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row, Number(asOf.slice(0, 4)));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Contra Costa County Assessor', dataset: 'assessment parcels, CCMAP', method: 'county', source: 'ca-contra-costa', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YR_BUILT', living_sqft: 'BLDG_SQFT', gross_sqft: 'BLDG_SQFT', lot_acres: 'ACREAGE', assessed_land_value: 'LAND_VALUE', assessed_building_value: 'IMP_VAL' },
  },
};

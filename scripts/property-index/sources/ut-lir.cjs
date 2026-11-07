'use strict';
// Utah: UGRC's Land Information Records parcels, one layer per county, from what each county assessor agreed to share.
// Year built, size, floors, market values; no bedrooms or baths, and sale prices aren't public in Utah. Published "as
// is" under CC BY 4.0 (web's data sources page); each county's layer points to that county's own disclaimer. PRIMARY_RES (a primary-residence flag says something
// about a person) isn't asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const BASE = 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services';
const COUNTIES = {
  49001: ['Beaver', 'Beaver'], 49003: ['Box Elder', 'BoxElder'], 49005: ['Cache', 'Cache'], 49007: ['Carbon', 'Carbon'], 49009: ['Daggett', 'Daggett'], 49011: ['Davis', 'Davis'], 49013: ['Duchesne', 'Duchesne'], 49015: ['Emery', 'Emery'],
  49017: ['Garfield', 'Garfield'], 49019: ['Grand', 'Grand'], 49021: ['Iron', 'Iron'], 49023: ['Juab', 'Juab'], 49025: ['Kane', 'Kane'], 49027: ['Millard', 'Millard'], 49029: ['Morgan', 'Morgan'], 49031: ['Piute', 'Piute'], 49033: ['Rich', 'Rich'],
  49035: ['Salt Lake', 'SaltLake'], 49037: ['San Juan', 'SanJuan'], 49039: ['Sanpete', 'Sanpete'], 49041: ['Sevier', 'Sevier'], 49043: ['Summit', 'Summit'], 49045: ['Tooele', 'Tooele'], 49047: ['Uintah', 'Uintah'], 49049: ['Utah', 'Utah'],
  49051: ['Wasatch', 'Wasatch'], 49053: ['Washington', 'Washington'], 49055: ['Wayne', 'Wayne'], 49057: ['Weber', 'Weber'],
};
const COLUMNS = ['PARCEL_ID', 'SERIAL_NUM', 'PARCEL_ADD', 'PARCEL_CITY', 'TOTAL_MKT_VALUE', 'LAND_MKT_VALUE', 'PARCEL_ACRES', 'PROP_CLASS', 'PROP_TYPE', 'HOUSE_CNT', 'SUBDIV_NAME', 'BLDG_SQFT', 'FLOORS_CNT', 'BUILT_YR', 'EFFBUILT_YR', 'CURRENT_ASOF', 'TAX_DISTRICT'];

function useOf(row, unit) {
  const text = `${row.PROP_CLASS || ''} ${row.PROP_TYPE || ''}`.toUpperCase();
  if (/CONDO/.test(text) && !/APARTMENT/.test(text)) return ['unit', 'condo'];
  if (/APARTMENT/.test(text)) return unit ? ['unit', 'condo'] : ['building', 'apartment'];
  if (/VACANT|UNDEVEL|GREENBELT/.test(text)) return ['parcel', null];
  if (/MOBILE|MANUF/.test(text)) return ['property', 'mobile_home'];
  if (/TOWN ?H|PUD/.test(text)) return ['property', 'townhouse'];
  if (/RESIDENTIAL|SINGLE/.test(text)) {
    if (unit) return ['unit', 'condo'];
    return Number(row.HOUSE_CNT) > 1 ? ['building', 'multi_unit'] : ['property', 'house'];
  }
  return ['other', null];
}

function fromRow(row, fips, county) {
  const parsed = parse(row.PARCEL_ADD);
  const parcel = word(row.SERIAL_NUM) || word(row.PARCEL_ID);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'municipality', word(row.PARCEL_CITY));
  put(facts, 'address_on_record', word(row.PARCEL_ADD));
  put(facts, 'year_built', on ? year(row.BUILT_YR) : null);
  put(facts, 'effective_year_built', on ? year(row.EFFBUILT_YR) : null);
  // The state says this "typically includes above ground and basement", so it's a building's area, not its living area.
  put(facts, 'usable_sqft', kind === 'property' || kind === 'unit' ? positive(row.BLDG_SQFT) : null);
  put(facts, 'gross_sqft', kind === 'building' ? positive(row.BLDG_SQFT) : null);
  put(facts, 'stories', on ? positive(row.FLOORS_CNT) : null);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.PARCEL_ACRES));
  put(facts, 'subdivision', word(row.SUBDIV_NAME));
  put(facts, 'land_use', word(row.PROP_CLASS));
  put(facts, 'tax_code_area', word(row.TAX_DISTRICT));
  const asOf = isoDate(row.CURRENT_ASOF);
  if (asOf) facts.value_year = Number(asOf.slice(0, 4));
  put(facts, 'market_value', positive(row.TOTAL_MKT_VALUE));
  put(facts, 'market_land_value', positive(row.LAND_MKT_VALUE));
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.PARCEL_CITY) || '').toUpperCase(), zip: '' }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const zips = zipsByCounty(work, ['49']);
  for (const [fips, [name, layer]] of Object.entries(COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    let asOf = null;
    const rows = cached(path.join(work, 'ut-lir', `${fips}.jsonl.gz`), () => layerRows(`${BASE}/Parcels_${layer}_LIR/FeatureServer/0`, COLUMNS, { optional: ['PROP_TYPE'] }));
    for await (const row of rows) {
      const date = isoDate(row.CURRENT_ASOF);
      if (date && (!asOf || date > asOf)) asOf = date;
      const record = fromRow(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    if (!asOf) throw new Error(`${county}'s layer no longer says when it was current`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'UT', name: county, publisher: `${name} County and Utah UGRC`, dataset: 'land information records', method: 'state', source: 'ut-lir', title: 'State records', as_of: asOf, stale_after_days: 730, extra_zips: zips.get(fips) || [], records,
    };
  }
}

module.exports = { build };

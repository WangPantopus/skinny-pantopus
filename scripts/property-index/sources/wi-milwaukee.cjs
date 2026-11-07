'use strict';
// Milwaukee County, Wisconsin: the City of Milwaukee's Master Property File, updated daily, CC BY (credit the City). It covers the
// city, not the county's other municipalities, whose lookups get no record. Year built, bedrooms, baths, area, stories, style,
// basement and values. Bedrooms and baths on a multi-unit building aren't one home's, so they're kept for single homes. Owner,
// mailing, exemption and owner-occupied columns are never read. Most condos in a shared building have no unit number here.

const path = require('node:path');
const { getJson } = require('../lib/services.cjs');
const { download } = require('../lib/tables.cjs');
const { csvRows } = require('../lib/csv.cjs');
const { streetParts, year, zipCode, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '55079';
const COUNTY = 'Milwaukee County';
const API = 'https://data.milwaukee.gov/api/3/action/package_show?id=mprop';
const COLUMNS = ['TAXKEY', 'YR_ASSMT', 'HOUSE_NR_LO', 'HOUSE_NR_SFX', 'SDIR', 'STREET', 'STTYPE', 'C_A_LAND', 'C_A_IMPRV', 'C_A_TOTAL', 'BLDG_TYPE', 'NR_STORIES', 'BASEMENT', 'NR_UNITS', 'BLDG_AREA', 'YR_BUILT', 'FIREPLACE', 'AIR_CONDITIONING', 'BEDROOMS', 'BATHS', 'POWDER_ROOMS', 'LOT_AREA', 'ZONING', 'LAND_USE', 'GEO_ZIP_CODE'];
const STYLE = { '01': 'Ranch', '02': 'Bi-level', '03': 'Split-level', '04': 'Cape Cod', '05': 'Colonial', '06': 'Tudor', '07': 'Townhouse', '08': 'Old style', '09': 'Mansion', 10: 'Cottage', 11: 'Duplex, old style', 12: 'Duplex, new style', 13: 'Duplex cottage', 15: 'Triplex', 18: 'Milwaukee bungalow', 22: 'Bungalow, old style' };
const BASEMENT = { F: 'Full basement', P: 'Partial basement', C: 'Crawl space' };
const USE_WORDS = { 8810: 'Single-family household', 8811: 'Condominium', 8820: 'Two-family residential', 8830: 'Multi-family residential', 8880: 'Vacant lot', 8885: 'Vacant lot with improvements', 8899: 'Mixed residential and commercial' };

function useOf(code, buildingType) {
  const [c, t] = [String(code ?? '').trim(), String(buildingType ?? '').trim()];
  if (c === '8811') return ['property', 'condo'];
  if (c === '8810') return t === '07' ? ['property', 'townhouse'] : ['property', 'house'];
  if (c === '8820') return ['building', 'multi_unit'];
  if (c === '8830' || c === '8890') return /^(15)$/.test(t) ? ['building', 'multi_unit'] : ['building', 'apartment'];
  if (c === '8880' || c === '8885') return ['parcel', null];
  return ['other', null];
}

function fromRow(row, today) {
  const address = streetParts({ number: row.HOUSE_NR_LO, numberSuffix: row.HOUSE_NR_SFX, pre: row.SDIR, name: row.STREET, suffix: row.STTYPE });
  const parcel = word(row.TAXKEY);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LAND_USE, row.BLDG_TYPE);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  const on = home || kind === 'building';
  put(facts, 'address_on_record', onRecord([row.HOUSE_NR_LO, row.HOUSE_NR_SFX, row.SDIR, row.STREET, row.STTYPE].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')));
  put(facts, 'municipality', 'Milwaukee');
  put(facts, 'land_use', USE_WORDS[String(row.LAND_USE).trim()]);
  put(facts, 'county_use_code', word(row.LAND_USE));
  put(facts, 'zoning', word(row.ZONING));
  if (on) {
    const built = year(row.YR_BUILT);
    put(facts, 'year_built', built);
    put(facts, 'stories', positive(row.NR_STORIES));
    put(facts, 'style', STYLE[String(row.BLDG_TYPE).trim()]);
    put(facts, 'foundation', BASEMENT[String(row.BASEMENT).trim()]);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.BLDG_AREA));
    put(facts, 'bedrooms', positive(row.BEDROOMS) <= 15 ? positive(row.BEDROOMS) : null);
    const [full, half] = [positive(row.BATHS), positive(row.POWDER_ROOMS)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    if (String(row.FIREPLACE).trim() === '1') facts.fireplaces = 1;
    if (String(row.AIR_CONDITIONING).trim().startsWith('1')) facts.cooling = 'Central air';
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.BLDG_AREA));
    put(facts, 'units', positive(row.NR_UNITS));
  }
  if (homeType !== 'condo') put(facts, 'lot_sqft', positive(row.LOT_AREA));
  put(facts, 'value_year', positive(row.YR_ASSMT));
  put(facts, 'assessed_value', positive(row.C_A_TOTAL));
  put(facts, 'assessed_land_value', positive(row.C_A_LAND));
  put(facts, 'assessed_building_value', positive(row.C_A_IMPRV));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'MILWAUKEE', zip: zipCode(row.GEO_ZIP_CODE) }, facts };
}

async function* build({ work, today }) {
  const about = await getJson(API, 'The dataset\'s description');
  const file = (about.result?.resources || []).find((resource) => resource.format === 'CSV');
  if (!file) throw new Error('The dataset no longer has its CSV');
  const asOf = isoDate(file.last_modified) || isoDate(today.getTime());
  const csv = path.join(work, 'wi-milwaukee', 'mprop.csv');
  download(file.url, csv);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of csvRows(csv, COLUMNS)) {
    const record = fromRow(row, today);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'WI', name: COUNTY, publisher: 'City of Milwaukee', dataset: 'Master Property File', method: 'county', source: 'wi-milwaukee', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YR_BUILT', stories: 'NR_STORIES', style: 'BLDG_TYPE', foundation: 'BASEMENT', living_sqft: 'BLDG_AREA', gross_sqft: 'BLDG_AREA', bedrooms: 'BEDROOMS', full_baths: 'BATHS', half_baths: 'POWDER_ROOMS', fireplaces: 'FIREPLACE', cooling: 'AIR_CONDITIONING', units: 'NR_UNITS', lot_sqft: 'LOT_AREA', value_year: 'YR_ASSMT', assessed_value: 'C_A_TOTAL', assessed_land_value: 'C_A_LAND', assessed_building_value: 'C_A_IMPRV', zoning: 'ZONING', land_use: 'LAND_USE' },
  },
};

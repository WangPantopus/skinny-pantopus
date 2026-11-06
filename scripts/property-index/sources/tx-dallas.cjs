'use strict';
// Dallas County, Texas: the Dallas Central Appraisal District's certified data files, a free download of comma-delimited
// tables with field documents inside. Terms: its read-me disclaims accuracy and states no license; the founder asks in
// writing before this county goes live. Owner names, owner addresses, phone numbers and applicant names are in the file
// and never asked for here. Accounts marked EXCLUDE_OWNER (protected people, Texas Tax Code 25.025) become restricted
// records with no facts. Sale prices aren't public in Texas.

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parts, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable } = require('../lib/tables.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48113';
const COUNTY = 'Dallas County';
const zipUrl = (year) => `https://www.dallascad.org/ViewPDFs.aspx?type=3&id=%5C%5CDCAD.ORG%5CWEB%5CWEBDATA%5CWEBFORMS%5CDATA%20PRODUCTS%5CDCAD${year}_CURRENT.ZIP`;

// The state's property categories, as the district's land table words them.
const USES = {
  A11: ['property', 'house'], A12: ['property', 'townhouse'], A13: ['unit', 'condo'], A20: ['property', 'mobile_home'],
  B11: ['building', 'apartment'], B12: ['building', 'multi_unit'],
  C11: ['parcel', null], C12: ['parcel', null], C13: ['parcel', null], C14: ['parcel', null], D10: ['parcel', null],
};
const STORIES = { 'ONE STORY': 1, 'ONE AND ONE HALF STORIES': 1.5, 'TWO STORIES': 2, 'TWO AND ONE HALF STORIES': 2.5, 'THREE STORIES': 3 };
const GARAGES = { 'ATTACHED GARAGE': 'Attached', 'DETACHED GARAGE': 'Detached', 'BUILT-IN GARAGE': 'Built-in' };
const CARPORTS = new Set(['ATTACHED CARPORT', 'DETACHED CARPORT']);
const STRUCTURES = new Set(['STORAGE BUILDING', 'OUTDOOR LIVING AREA', 'DETACHED QUARTERS', 'DECK', 'ROOM ADDITION', 'CABANA', 'GREENHOUSE', 'BARN']);

async function build({ work, today = new Date() }) {
  const dir = path.join(work, 'tx-dallas');
  // Certification is in July: until then the last certified year is the one before.
  const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const zip = path.join(dir, 'DCAD_CURRENT.zip');
  download(zipUrl(year), zip);
  const listing = execFileSync('unzip', ['-l', zip], { encoding: 'latin1' });
  const stamp = /(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}\s+ACCOUNT_INFO\.CSV/.exec(listing);
  if (!stamp) throw new Error('The district\'s file no longer dates its account table');
  const asOf = `${stamp[3]}-${stamp[1]}-${stamp[2]}`;

  const records = new Map();
  const accounts = new Map();
  let noAddress = 0;
  for await (const row of zipTable(zip, 'ACCOUNT_INFO.CSV', ['ACCOUNT_NUM', 'DIVISION_CD', 'EXCLUDE_OWNER', 'STREET_NUM', 'STREET_HALF_NUM', 'FULL_STREET_NAME', 'BLDG_ID', 'UNIT_ID', 'PROPERTY_CITY', 'PROPERTY_ZIPCODE', 'LEGAL1', 'LEGAL2'])) {
    if (!['RES', 'COM'].includes(row.DIVISION_CD)) continue;
    const address = parts({ number: row.STREET_NUM, numberSuffix: row.STREET_HALF_NUM, name: row.FULL_STREET_NAME, unit: row.UNIT_ID, building: row.BLDG_ID });
    if (!address) {
      noAddress += 1;
      continue;
    }
    const legal = [row.LEGAL1, row.LEGAL2].map(word).filter(Boolean).join(' ').slice(0, 300);
    accounts.set(row.ACCOUNT_NUM, {
      address: { ...address, city: String(row.PROPERTY_CITY || '').trim().toUpperCase(), zip: zip5(row.PROPERTY_ZIPCODE) },
      restricted: row.EXCLUDE_OWNER === 'Y',
      line: [row.STREET_NUM, row.STREET_HALF_NUM, row.FULL_STREET_NAME, row.BLDG_ID && `BLDG ${row.BLDG_ID}`, row.UNIT_ID && `#${row.UNIT_ID}`].filter(Boolean).join(' '),
      legal,
    });
  }
  log(`accounts with an address: ${accounts.size}, without: ${noAddress}`);

  for await (const row of zipTable(zip, 'ACCOUNT_APPRL_YEAR.CSV', ['ACCOUNT_NUM', 'APPRAISAL_YR', 'IMPR_VAL', 'LAND_VAL', 'TOT_VAL', 'PREV_MKT_VAL', 'CITY_JURIS_DESC', 'ISD_JURIS_DESC', 'COUNTY_TAXABLE_VAL', 'SPTD_CODE'])) {
    const account = accounts.get(row.ACCOUNT_NUM);
    if (!account) continue;
    const [kind, homeType] = USES[row.SPTD_CODE] || ['other', null];
    if (account.restricted) {
      records.set(row.ACCOUNT_NUM, { id: `pp:${kind}:${FIPS}:${row.ACCOUNT_NUM}`, kind, address: account.address, facts: {}, restricted: true });
      continue;
    }
    const facts = { parcel_number: row.ACCOUNT_NUM, county: COUNTY, fips: FIPS, address_on_record: account.line };
    put(facts, 'legal_description', account.legal);
    put(facts, 'county_use_code', word(row.SPTD_CODE));
    put(facts, 'municipality', word(row.CITY_JURIS_DESC));
    put(facts, 'school_district', word(row.ISD_JURIS_DESC));
    put(facts, 'value_year', positive(row.APPRAISAL_YR));
    put(facts, 'market_value', positive(row.TOT_VAL));
    put(facts, 'market_building_value', positive(row.IMPR_VAL));
    put(facts, 'market_land_value', positive(row.LAND_VAL));
    put(facts, 'taxable_value', positive(row.COUNTY_TAXABLE_VAL));
    if (positive(row.PREV_MKT_VAL) && positive(row.APPRAISAL_YR)) facts.value_history = [[positive(row.APPRAISAL_YR) - 1, positive(row.PREV_MKT_VAL)]];
    facts.exemptions = [];
    records.set(row.ACCOUNT_NUM, { id: `pp:${kind}:${FIPS}:${row.ACCOUNT_NUM}`, kind, home_type: homeType, address: account.address, facts });
  }

  const usable = (id) => {
    const record = records.get(id);
    return record && !record.restricted ? record : null;
  };
  const seenMain = new Set();
  for await (const row of zipTable(zip, 'RES_DETAIL.CSV', ['ACCOUNT_NUM', 'YR_BUILT', 'EFF_YR_BUILT', 'CDU_RATING_DESC', 'TOT_MAIN_SF', 'TOT_LIVING_AREA_SF', 'PCT_COMPLETE', 'NUM_STORIES_DESC', 'CONSTR_FRAM_TYP_DESC', 'FOUNDATION_TYP_DESC', 'HEATING_TYP_DESC', 'AC_TYP_DESC', 'EXT_WALL_DESC', 'ROOF_TYP_DESC', 'ROOF_MAT_DESC', 'NUM_FIREPLACES', 'NUM_FULL_BATHS', 'NUM_HALF_BATHS', 'NUM_BEDROOMS', 'POOL_IND', 'NUM_UNITS'])) {
    const record = usable(row.ACCOUNT_NUM);
    // A few accounts list a second building: the first is the main one.
    if (!record || seenMain.has(row.ACCOUNT_NUM)) continue;
    seenMain.add(row.ACCOUNT_NUM);
    const { facts } = record;
    put(facts, 'year_built', positive(row.YR_BUILT));
    put(facts, 'effective_year_built', positive(row.EFF_YR_BUILT));
    // One of the district's ratings is a note to its own appraisers.
    if (row.CDU_RATING_DESC !== 'MANUALLY ENTER DEPRECIATION') put(facts, 'condition', word(row.CDU_RATING_DESC));
    put(facts, 'ground_floor_sqft', positive(row.TOT_MAIN_SF));
    put(facts, 'living_sqft', positive(row.TOT_LIVING_AREA_SF));
    const percent = positive(row.PCT_COMPLETE);
    if (percent && percent < 100) facts.percent_complete = percent;
    put(facts, 'stories', STORIES[String(row.NUM_STORIES_DESC).trim()] ?? null);
    put(facts, 'frame', word(row.CONSTR_FRAM_TYP_DESC));
    put(facts, 'foundation', word(row.FOUNDATION_TYP_DESC));
    put(facts, 'heating', word(row.HEATING_TYP_DESC));
    put(facts, 'cooling', word(row.AC_TYP_DESC));
    put(facts, 'exterior_walls', word(row.EXT_WALL_DESC));
    put(facts, 'roof_shape', word(row.ROOF_TYP_DESC));
    put(facts, 'roof_cover', word(row.ROOF_MAT_DESC));
    put(facts, 'fireplaces', positive(row.NUM_FIREPLACES));
    put(facts, 'bedrooms', positive(row.NUM_BEDROOMS));
    const full = positive(row.NUM_FULL_BATHS);
    const half = positive(row.NUM_HALF_BATHS);
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + 0.5 * (half || 0);
    if (row.POOL_IND === 'Y') facts.pool = 'Yes';
    if (record.kind === 'building') put(facts, 'units', positive(row.NUM_UNITS));
  }

  for await (const row of zipTable(zip, 'COM_DETAIL.CSV', ['ACCOUNT_NUM', 'YEAR_BUILT', 'GROSS_BLDG_AREA', 'NUM_STORIES', 'NUM_UNITS', 'HEATING_TYP_DESC', 'AC_TYP_DESC', 'FOUNDATION_TYP_DESC', 'CONSTR_TYP_DESC'])) {
    const record = usable(row.ACCOUNT_NUM);
    if (!record) continue;
    const { facts } = record;
    if (!facts.year_built) put(facts, 'year_built', positive(row.YEAR_BUILT));
    if (!facts.gross_sqft) put(facts, 'gross_sqft', positive(row.GROSS_BLDG_AREA));
    if (!facts.stories) put(facts, 'stories', positive(row.NUM_STORIES));
    if (!facts.units) put(facts, 'units', positive(row.NUM_UNITS));
    if (!facts.heating) put(facts, 'heating', word(row.HEATING_TYP_DESC));
    if (!facts.cooling) put(facts, 'cooling', word(row.AC_TYP_DESC));
    if (!facts.foundation) put(facts, 'foundation', word(row.FOUNDATION_TYP_DESC));
    if (!facts.frame) put(facts, 'frame', word(row.CONSTR_TYP_DESC));
  }

  const garages = new Map();
  const structures = new Map();
  for await (const row of zipTable(zip, 'RES_ADDL.CSV', ['ACCOUNT_NUM', 'IMPR_TYP_DESC', 'AREA_SIZE'])) {
    const record = usable(row.ACCOUNT_NUM);
    if (!record) continue;
    const type = String(row.IMPR_TYP_DESC).trim();
    const area = positive(row.AREA_SIZE);
    if (GARAGES[type]) {
      (garages.get(row.ACCOUNT_NUM) || garages.set(row.ACCOUNT_NUM, new Set()).get(row.ACCOUNT_NUM)).add(GARAGES[type]);
      if (area) record.facts.garage_sqft = (record.facts.garage_sqft || 0) + area;
    } else if (CARPORTS.has(type) && area) record.facts.carport_sqft = (record.facts.carport_sqft || 0) + area;
    else if (STRUCTURES.has(type)) (structures.get(row.ACCOUNT_NUM) || structures.set(row.ACCOUNT_NUM, new Set()).get(row.ACCOUNT_NUM)).add(type);
  }
  for (const [id, kinds] of garages) records.get(id).facts.garage = [...kinds].sort().join(', ');
  for (const [id, kinds] of structures) records.get(id).facts.other_structures = [...kinds].sort().join(', ');

  for await (const row of zipTable(zip, 'LAND.CSV', ['ACCOUNT_NUM', 'SPTD_DESC', 'ZONING', 'AREA_SIZE', 'AREA_UOM_DESC'])) {
    const record = usable(row.ACCOUNT_NUM);
    if (!record) continue;
    const { facts } = record;
    if (!facts.land_use) put(facts, 'land_use', word(row.SPTD_DESC)?.replace(/^SFR - /, 'SINGLE FAMILY: ').replace(/^MFR - /, 'MULTI-FAMILY: '));
    if (!facts.zoning) put(facts, 'zoning', word(row.ZONING));
    const area = positive(row.AREA_SIZE);
    const unit = String(row.AREA_UOM_DESC).trim();
    if (area && unit === 'SQUARE FEET') facts.lot_sqft = (facts.lot_sqft || 0) + area;
    if (area && unit === 'ACRE') facts.lot_acres = (facts.lot_acres || 0) + area;
  }

  for await (const row of zipTable(zip, 'ACCT_EXEMPT_VALUE.CSV', ['ACCOUNT_NUM', 'EXEMPTION'])) {
    const record = usable(row.ACCOUNT_NUM);
    const label = word(row.EXEMPTION);
    if (record && label && !record.facts.exemptions.includes(label)) record.facts.exemptions.push(label);
  }

  const output = [...records.values()];
  output.push(...condoBuildings(output, { fips: FIPS, county: COUNTY }));

  return [{
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Dallas Central Appraisal District', dataset: 'certified data files', method: 'county', source: 'tx-dallas',
    title: 'Appraisal district records', as_of: asOf, stale_after_days: 540, records: output,
  }];
}

module.exports = { build };

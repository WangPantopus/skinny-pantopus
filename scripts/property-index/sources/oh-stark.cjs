'use strict';
// Stark County, Ohio: the Auditor's CAMA export, one zip rebuilt nightly on the county's GIS downloads page, where the Auditor's policy is "to make all
// data available for public use"; the county's terms let its materials be used subject to law and any stated restriction, and state none for this
// file. Year built, living area, bedrooms, baths, stories, acres, market and assessed values, and the last transfer's stated value (Ohio's
// conveyance-fee price). Owner, billing, tax payment and delinquency columns are never asked for, nor the transfers' grantor and grantee.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipDates, zipTable } = require('../lib/tables.cjs');
const { year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39151';
const COUNTY = 'Stark County';
const FILE = 'https://scwebnet.starkcountyohio.gov/cama_public/cama_data_stark_oh.zip';
const BASE_COLUMNS = ['PARCEL_ID', 'TAX_YEAR', 'SITUS_ADDRESS', 'USE_CODE', 'USE_DESCRIPTION', 'LEGAL_DESCRIPTION', 'ALLOTMENT', 'MKT_LAND_VAL', 'MKT_BLDG_VAL', 'MKT_TOTAL_VAL', 'ASSESS_TOTAL_VAL', 'TOTAL_ACRES', 'NBHD_ID'];
const BUILDING_COLUMNS = ['PARCEL_ID', 'BLDG_TYPE', 'STORIES', 'LIVING_AREA_SQ_FT', 'BEDROOMS', 'FULL_BATHS', 'HALF_BATHS', 'ACT_YR_BUILT', 'EFF_YR_BUILT', 'CONDITION', 'CENTRAL_AIR', 'FIREPLACES', 'HEAT_TYPE'];
const TRANSFER_COLUMNS = ['PARCEL_ID', 'TRANSFER_DATE', 'STATED_VALUE', 'NUMBER_OF_PARCELS'];

// Ohio's land use codes: 510 a one-family dwelling, 550 a condominium unit, 560 a mobile home on its land, 520 and 530 two and three families,
// 500 residential vacant land.
function useOf(code, unit) {
  const c = String(code || '').trim();
  if (c === '510') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '560') return ['property', 'mobile_home'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (/^4[0-9]1$/.test(c)) return ['building', 'apartment'];
  if (c === '500') return ['parcel', null];
  return ['other', null];
}

// Transfers are dated like "15-OCT-19"; a two-digit year past next year's is in the 1900s.
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
function transferDate(text, thisYear = new Date().getFullYear()) {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{2})$/.exec(String(text || '').trim().toUpperCase());
  if (!match || !MONTHS[match[2]]) return isoDate(text);
  const yy = Number(match[3]);
  return `${(yy > (thisYear + 1) % 100 ? 1900 : 2000) + yy}-${MONTHS[match[2]]}-${match[1].padStart(2, '0')}`;
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// A site address runs on into its city, state and ZIP with single spaces: "123 MAIN ST NW CANTON OH 44703 1234". Every address in a ZIP ends with
// one of a few city names, so each ZIP's names are learned from the file: the word runs (up to three words) that end at least 2% of its addresses.
const TAIL = /^\s*(.*?)\s+OH\s+(\d{5})(?:\s+\d{4})?\s*$/;
const STREET_WORDS = new Set('ST AVE RD DR LN CT BLVD CIR PL WAY TER TRL PKWY HWY PIKE RUN XING SQ PT LOOP ROW PATH WALK CV BND CRES EXT HL HTS LNDG PASS PLZ RDG SPGS STA VW VLG XRD NE NW SE SW N S E W'.split(' '));
function cityNames(lines) {
  const counts = new Map();
  for (const line of lines) {
    const match = TAIL.exec(line);
    if (!match) continue;
    const words = match[1].split(/\s+/);
    const zip = match[2];
    if (!counts.has(zip)) counts.set(zip, { total: 0, runs: new Map() });
    const entry = counts.get(zip);
    entry.total += 1;
    for (let n = 1; n <= 3 && n < words.length - 1; n += 1) {
      const run = words.slice(-n).join(' ');
      entry.runs.set(run, (entry.runs.get(run) || 0) + 1);
    }
  }
  const names = new Map();
  for (const [zip, { total, runs }] of counts) {
    // A city name holds no street type, direction or number ("SW CANTON" is a street's quadrant and its city), and the longest one that fits wins.
    const kept = [...runs].filter(([run, n]) => n >= Math.max(3, total * 0.02) && !run.split(' ').some((part) => STREET_WORDS.has(part) || /\d/.test(part)));
    names.set(zip, kept.map(([run]) => run).sort((a, b) => b.split(' ').length - a.split(' ').length));
  }
  return names;
}

function splitLine(line, names) {
  const match = TAIL.exec(line || '');
  if (!match) return null;
  const [, rest, zip] = match;
  const city = (names.get(zip) || []).find((run) => rest.endsWith(` ${run}`));
  return { street: city ? rest.slice(0, -city.length - 1) : rest, city: city || '', zip };
}

function fromRow(row, place, { building, transfer }) {
  if (!place) return null;
  const address = parse(place.street);
  const parcel = word(row.PARCEL_ID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.USE_CODE, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(place.street, ''));
  put(facts, 'land_use', word(row.USE_DESCRIPTION));
  put(facts, 'county_use_code', word(row.USE_CODE));
  put(facts, 'subdivision', word(row.ALLOTMENT));
  put(facts, 'legal_description', word(row.LEGAL_DESCRIPTION)?.slice(0, 300));
  put(facts, 'neighborhood', word(row.NBHD_ID));
  if (building && (home || kind === 'building')) {
    put(facts, 'year_built', year(building.ACT_YR_BUILT));
    put(facts, 'effective_year_built', year(building.EFF_YR_BUILT));
    // The quality grade is a letter the export's layout doesn't explain, so it's left out.
    put(facts, 'style', word(building.BLDG_TYPE));
    put(facts, 'condition', word(building.CONDITION));
  }
  if (building && home) {
    put(facts, 'living_sqft', positive(building.LIVING_AREA_SQ_FT));
    put(facts, 'bedrooms', inRange(building.BEDROOMS, 15));
    const [full, half] = [inRange(building.FULL_BATHS, 12), inRange(building.HALF_BATHS, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(building.STORIES, 5));
    put(facts, 'fireplaces', inRange(building.FIREPLACES, 20));
    put(facts, 'heating', word(building.HEAT_TYPE));
    put(facts, 'cooling', /^Y/i.test(String(building.CENTRAL_AIR || '')) ? 'Central' : null);
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.TOTAL_ACRES));
  put(facts, 'value_year', positive(row.TAX_YEAR));
  put(facts, 'market_value', positive(row.MKT_TOTAL_VAL));
  put(facts, 'market_land_value', positive(row.MKT_LAND_VAL));
  put(facts, 'market_building_value', positive(row.MKT_BLDG_VAL));
  put(facts, 'assessed_value', positive(row.ASSESS_TOTAL_VAL));
  if (transfer) {
    facts.sale_price = positive(transfer.STATED_VALUE);
    put(facts, 'sale_date', transfer.date);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: place.city, zip: place.zip }, facts };
}

async function* build({ work }) {
  const zip = path.join(work, 'oh-stark', 'cama.zip');
  download(FILE, zip);
  const read = (member, columns) => zipTable(zip, member, columns, { delimiter: ',', quoted: true });
  // A parcel's facts come from its largest residential card.
  const buildings = new Map();
  for await (const row of read('SC_EXP_BLDG_RES.csv', BUILDING_COLUMNS)) {
    const was = buildings.get(row.PARCEL_ID);
    if (!was || (positive(row.LIVING_AREA_SQ_FT) || 0) > (positive(was.LIVING_AREA_SQ_FT) || 0)) buildings.set(row.PARCEL_ID, row);
  }
  // The latest single-parcel transfer at a home's price; a transfer of several parcels names one price for all of them.
  const transfers = new Map();
  for await (const row of read('SC_EXP_TRANSFERS.csv', TRANSFER_COLUMNS)) {
    const date = transferDate(row.TRANSFER_DATE);
    if (!date || !isHomeSale(positive(row.STATED_VALUE)) || (positive(row.NUMBER_OF_PARCELS) || 1) > 1) continue;
    const was = transfers.get(row.PARCEL_ID);
    if (!was || date > was.date) transfers.set(row.PARCEL_ID, { ...row, date });
  }
  const rows = [];
  for await (const row of read('SC_EXP_BASE.csv', BASE_COLUMNS)) rows.push(row);
  const names = cityNames(rows.map((row) => row.SITUS_ADDRESS));
  const asOf = zipDates(zip).get('SC_EXP_BASE.csv');
  if (!asOf) throw new Error('The CAMA zip no longer dates its base table');
  const records = new Map();
  let noAddress = 0;
  for (const row of rows) {
    const record = fromRow(row, splitLine(row.SITUS_ADDRESS, names), { building: buildings.get(row.PARCEL_ID), transfer: transfers.get(row.PARCEL_ID) });
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number; ${buildings.size} residential cards, ${transfers.size} transfers, ${names.size} ZIPs`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Stark County Auditor', dataset: 'CAMA export', method: 'county', source: 'oh-stark', as_of: asOf, stale_after_days: 60, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: [...new Set([...BASE_COLUMNS, ...BUILDING_COLUMNS, ...TRANSFER_COLUMNS])],
    facts: { year_built: 'ACT_YR_BUILT', effective_year_built: 'EFF_YR_BUILT', living_sqft: 'LIVING_AREA_SQ_FT', bedrooms: 'BEDROOMS', bathrooms: 'FULL_BATHS', full_baths: 'FULL_BATHS', half_baths: 'HALF_BATHS', stories: 'STORIES', fireplaces: 'FIREPLACES', lot_acres: 'TOTAL_ACRES', value_year: 'TAX_YEAR', market_value: 'MKT_TOTAL_VAL', market_land_value: 'MKT_LAND_VAL', market_building_value: 'MKT_BLDG_VAL', assessed_value: 'ASSESS_TOTAL_VAL', sale_price: 'STATED_VALUE', sale_date: 'TRANSFER_DATE' },
  },
};

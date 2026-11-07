'use strict';
// Ector County, Texas: the Ector County Appraisal District's certified real estate roll, a spreadsheet on its Downloads page, which states no limit on use.
// Year built, improvement area, acreage and values. No bedrooms or baths. Sale prices aren't public in Texas. The owner column is read only to ask whether
// the district marked a protected person's account (Tax Code 25.025), then dropped; mailing and exemption columns aren't read.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { download, zipDates, USER_AGENT } = require('../lib/tables.cjs');
const { sheetRows } = require('../lib/xlsx.cjs');
const { streetParts, year, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, useOf } = require('../lib/texas.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48135';
const COUNTY = 'Ector County';
const PAGE = 'https://www.ectorcad.org/home/downloads';
const COLUMNS = ['ACCOUNT_NUMBER', 'OWNER_NAME', 'PROPERTY_CLASSIFICATION_CODE', 'STREET_NUMBER', 'STREET_DIRECTION', 'STREET_NAME', 'STREET_SUFFIX', 'LAND_VALUE', 'BUILDING_VALUE', 'TOTAL_VALUE', 'IMPROVEMENT_TYPE', 'IMPROVEMENT_AREA', 'YEAR_BUILT', 'ACREAGE'];
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;

function useFor(code, type, unit) {
  const words = String(type || '').toUpperCase();
  if (/MOBILE|MANUF/.test(words)) return ['property', 'mobile_home'];
  // The district's own codes: A4 is sheds and other small improvements, and A5 to A7 hold several homes.
  if (code === 'A4') return ['other', null];
  if (code === 'A5' || code === 'A6' || code === 'A7') return ['building', 'multi_unit'];
  return useOf(code, unit, Boolean(type));
}

function fromRow(row, valueYear) {
  const address = streetParts({ number: row.STREET_NUMBER, pre: row.STREET_DIRECTION, name: word(row.STREET_NAME), suffix: word(row.STREET_SUFFIX) });
  const account = String(row.ACCOUNT_NUMBER || '').trim();
  if (!address || !account) return null;
  const code = String(row.PROPERTY_CLASSIFICATION_CODE || '').trim().toUpperCase();
  const [kind, homeType] = useFor(code, word(row.IMPROVEMENT_TYPE), address.unit);
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.STREET_NUMBER, row.STREET_DIRECTION, row.STREET_NAME, row.STREET_SUFFIX].map(word).filter(Boolean).join(' ')));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  if (home || kind === 'building') put(facts, 'year_built', year(row.YEAR_BUILT));
  if (home) put(facts, 'living_sqft', positive(row.IMPROVEMENT_AREA));
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.IMPROVEMENT_AREA));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE));
  put(facts, 'value_year', valueYear);
  put(facts, 'market_value', positive(row.TOTAL_VALUE));
  put(facts, 'market_land_value', positive(row.LAND_VALUE));
  put(facts, 'market_building_value', positive(row.BUILDING_VALUE));
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work }) {
  const page = await fetch(PAGE, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
  if (!page.ok) throw new Error(`The district's download page answered ${page.status}`);
  const link = /href="([^"]*CERTIFIED_RE_APPRAISAL_ROLL[^"]*\.zip)"/i.exec(await page.text())?.[1];
  if (!link) throw new Error('The district no longer lists its certified real estate roll');
  const url = new URL(link, PAGE).href;
  const zip = path.join(work, 'tx-ector', path.basename(new URL(url).pathname));
  download(url, zip);
  const member = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').find((name) => /\.xlsx$/i.test(name));
  if (!member) throw new Error('The roll is no longer a spreadsheet');
  const asOf = zipDates(zip).get(member);
  if (!asOf) throw new Error('The roll no longer says when it was made');
  const sheet = path.join(work, 'tx-ector', 'roll.xlsx');
  fs.writeFileSync(sheet, execFileSync('unzip', ['-p', zip, member], { maxBuffer: 2 ** 31 - 1 }));
  const records = new Map();
  let [noAddress, hidden] = [0, 0];
  for await (const row of sheetRows(sheet, COLUMNS)) {
    if (PROTECTED.test(row.OWNER_NAME)) {
      hidden += 1;
      continue;
    }
    const record = fromRow(row, Number(asOf.slice(0, 4)));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number, ${hidden} protected`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Ector County Appraisal District', dataset: 'certified real estate roll', method: 'county', source: 'tx-ector', as_of: asOf, stale_after_days: 450, extra_zips: zipsByCounty(work, ['48']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'IMPROVEMENT_AREA', gross_sqft: 'IMPROVEMENT_AREA', lot_acres: 'ACREAGE', market_value: 'TOTAL_VALUE', market_land_value: 'LAND_VALUE', market_building_value: 'BUILDING_VALUE', value_year: 'TOTAL_VALUE' },
  },
};

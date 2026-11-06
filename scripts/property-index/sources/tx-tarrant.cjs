'use strict';
// Tarrant County, Texas: the Tarrant Appraisal District's residential property data, a free download. Bedrooms, baths,
// year built, living area, garage, pool and central heat and air, one row per account. Exemptions aren't in it (Tax
// Code 25.027), and sale prices aren't public in Texas. The owner column is read only to ask whether the district marked a
// protected person's account (Tax Code 25.025), then dropped. Mailing columns aren't read.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable } = require('../lib/tables.cjs');
const { year, zipCode } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48439';
const COUNTY = 'Tarrant County';
const FILE = 'https://www.tad.org/content/data-download/PropertyData(Delimited)_R.ZIP';
const COLUMNS = ['Appraisal_Year', 'Account_Num', 'Owner_Name', 'Situs_Address', 'Property_Class', 'State_Use_Code', 'LegalDescription', 'City', 'School', 'Land_Value', 'Improvement_Value', 'Total_Value', 'Garage_Capacity', 'Num_Bedrooms', 'Num_Bathrooms', 'Year_Built', 'Living_Area',
  'Swimming_Pool_Ind', 'Land_Acres', 'Land_SqFt', 'Central_Heat_Ind', 'Central_Air_Ind', 'Structure_Count', 'Appraisal_Date', 'Gross_Building_Area'];
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;
const CLASS_WORDS = { A: 'Single-family residence', B: 'Multifamily residence', C: 'Vacant lot', D: 'Rural land', E: 'Farm or ranch improvements', M: 'Mobile home', O: 'Residential inventory' };

function useOf(code, hasUnit) {
  const c = code.toUpperCase();
  if (c.startsWith('M') || c === 'E2') return ['property', 'mobile_home'];
  if (c.startsWith('A')) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c.startsWith('B')) return ['building', 'multi_unit'];
  if (c.startsWith('C') || c.startsWith('D') || !c) return ['parcel', null];
  return ['other', null];
}
const yes = (text) => /^(Y|YES|1|T)$/i.test(String(text ?? '').trim());

async function* build({ work }) {
  const zip = path.join(work, 'tx-tarrant', 'r.zip');
  download(FILE, zip);
  const records = [];
  let noAddress = 0;
  let protectedAccounts = 0;
  let taxYear = 0;
  const seen = new Set();
  for await (const row of zipTable(zip, 'PropertyData(Delimited)_R.txt', COLUMNS, { delimiter: '|', quoted: false })) {
    const parsed = parse(row.Situs_Address);
    const account = word(row.Account_Num);
    if (!parsed || !account) {
      noAddress += 1;
      continue;
    }
    if (seen.has(account)) continue;
    seen.add(account);
    const located = { ...parsed, city: String(word(row.City) || '').toUpperCase(), zip: '' };
    if (PROTECTED.test(row.Owner_Name || '')) {
      protectedAccounts += 1;
      records.push({ id: `pp:property:${FIPS}:${account}`, kind: 'property', home_type: null, address: located, facts: {}, restricted: true });
      continue;
    }
    const code = String(row.Property_Class ?? '').trim();
    const [kind, homeType] = useOf(code, parsed.unit);
    const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
    const on = kind === 'property' || kind === 'unit' || kind === 'building';
    const home = kind === 'property' || kind === 'unit';
    if (positive(row.Appraisal_Year) > taxYear) taxYear = positive(row.Appraisal_Year);
    put(facts, 'address_on_record', word(row.Situs_Address));
    put(facts, 'year_built', on ? year(row.Year_Built) : null);
    if (home) {
      put(facts, 'living_sqft', positive(row.Living_Area));
      put(facts, 'bedrooms', positive(row.Num_Bedrooms));
      put(facts, 'bathrooms', positive(row.Num_Bathrooms));
      put(facts, 'parking_spaces', positive(row.Garage_Capacity));
      if (yes(row.Swimming_Pool_Ind)) facts.pool = 'Yes';
      if (yes(row.Central_Heat_Ind)) facts.heating = 'Central';
      if (yes(row.Central_Air_Ind)) facts.cooling = 'Central';
    } else if (on) put(facts, 'gross_sqft', positive(row.Gross_Building_Area));
    put(facts, 'buildings_on_parcel', on ? positive(row.Structure_Count) : null);
    if (kind !== 'unit') {
      put(facts, 'lot_acres', positive(row.Land_Acres));
      put(facts, 'lot_sqft', positive(row.Land_SqFt));
    }
    put(facts, 'land_use', CLASS_WORDS[code.charAt(0).toUpperCase()] || null);
    put(facts, 'county_use_code', word(row.State_Use_Code));
    put(facts, 'legal_description', word(row.LegalDescription)?.slice(0, 300));
    put(facts, 'value_year', positive(row.Appraisal_Year));
    put(facts, 'market_value', positive(row.Total_Value));
    put(facts, 'market_land_value', positive(row.Land_Value));
    put(facts, 'market_building_value', positive(row.Improvement_Value));
    records.push({ id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: located, facts });
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${protectedAccounts} protected`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  const zips = zipsByCounty(work, ['48']);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Tarrant Appraisal District', dataset: `${taxYear} residential property data`, method: 'county', source: 'tx-tarrant', as_of: `${taxYear}-07-25`, stale_after_days: 450, extra_zips: zips.get(FIPS) || [], records,
  };
}

module.exports = { build };

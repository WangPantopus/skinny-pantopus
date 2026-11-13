'use strict';
// Texas: the state's StratMap land parcels (TxGIO), one file per county from its appraisal district, free to anyone. What
// a county's file holds varies: some have year built and values, some an address and little else. A county with
// nothing useful isn't published, and a district with its own richer connector isn't read here. Sale prices aren't
// public in Texas. A Texas appraisal district's value is its market value by law.
//
// A district marks a protected person's account (Tax Code 25.025) in its owner column: that's read only to ask whether
// it says so, and such an account carries no facts, so the answer looks like no record at all.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download } = require('../lib/tables.cjs');
const { getJson } = require('../lib/services.cjs');
const { dbfRows } = require('../lib/dbf.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const API = 'https://api.tnris.org/api/v1';
// Districts read by their own connector.
const OWN_CONNECTOR = new Set(['48013', '48021', '48027', '48029', '48041', '48061', '48085', '48113', '48121', '48135', '48157', '48181', '48183', '48201', '48215', '48251', '48257', '48291', '48339', '48355', '48423', '48439', '48441', '48453', '48491']);
const COLUMNS = ['PROP_ID', 'OWNER_NAME', 'LEGAL_AREA', 'LGL_AREA_U', 'LEGAL_DESC', 'STAT_LAND_', 'LOC_LAND_U', 'LAND_VALUE', 'IMP_VALUE', 'MKT_VALUE', 'SITUS_ADDR', 'SITUS_NUM', 'SITUS_STRE', 'SITUS_ST_1', 'SITUS_ST_2', 'SITUS_CITY', 'SITUS_ZIP', 'DATE_ACQ', 'TAX_YEAR', 'YEAR_BUILT'];
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;

// The Comptroller's property categories. Districts add their own second character.
const CATEGORY_WORDS = { A: 'Single-family residence', B: 'Multifamily residence', C: 'Vacant lot', D: 'Rural land', E: 'Farm or ranch improvements', M: 'Mobile home', O: 'Residential inventory' };
function useOf(code, hasUnit) {
  const c = code.toUpperCase();
  if (c === 'A2' || c.startsWith('M') || c === 'E2') return ['property', 'mobile_home'];
  if (c === 'A3' || c === 'A4') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('A') || c === 'E' || c === 'E1') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === 'B2' || c === 'B3' || c === 'B4') return ['building', 'multi_unit'];
  if (c.startsWith('B')) return ['building', 'apartment'];
  if (c.startsWith('C') || c.startsWith('D') || c === 'E3' || c === 'E4' || !c) return ['parcel', null];
  return ['other', null];
}

function fromRow(row, fips, county) {
  const number = word(row.SITUS_NUM);
  const street = [row.SITUS_STRE, row.SITUS_ST_1, row.SITUS_ST_2].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const parsed = number && street ? parse(`${number} ${street}`) : parse(String(row.SITUS_ADDR ?? '').split(',')[0]);
  const account = word(row.PROP_ID);
  if (!parsed || !account) return null;
  const address = { ...parsed, city: String(word(row.SITUS_CITY) || '').toUpperCase(), zip: zipCode(row.SITUS_ZIP) };
  if (PROTECTED.test(row.OWNER_NAME || '')) return { id: `pp:property:${fips}:${account}`, kind: 'property', home_type: null, address, facts: {}, restricted: true };
  const code = String(row.STAT_LAND_ ?? '').trim();
  const [kind, homeType] = useOf(code, parsed.unit);
  const facts = { parcel_number: account, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'address_on_record', word(row.SITUS_ADDR));
  put(facts, 'year_built', on ? year(row.YEAR_BUILT) : null);
  if (kind !== 'unit' && /^A/i.test(row.LGL_AREA_U || '')) put(facts, 'lot_acres', positive(row.LEGAL_AREA));
  put(facts, 'land_use', CATEGORY_WORDS[code.charAt(0).toUpperCase()] || null);
  put(facts, 'county_use_code', word(row.LOC_LAND_U) || word(code));
  put(facts, 'legal_description', word(row.LEGAL_DESC)?.slice(0, 300));
  put(facts, 'value_year', positive(row.TAX_YEAR));
  put(facts, 'market_value', positive(row.MKT_VALUE));
  put(facts, 'market_land_value', positive(row.LAND_VALUE));
  put(facts, 'market_building_value', positive(row.IMP_VALUE));
  return { id: `pp:${kind}:${fips}:${account}`, kind, home_type: homeType, address, facts };
}

const USEFUL = (facts) => facts.year_built || facts.market_value;

async function* build({ work, compare = null }) {
  // A county build comparing its own record with this file (lib/agreement.cjs) asks for counties it otherwise leaves out.
  const only = compare || (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const catalog = await getJson(`${API}/collections_catalog/?search=land%20parcels&limit=50`, 'The state\'s catalog');
  const newest = (catalog.results || []).filter((entry) => entry.name === 'Land Parcels').sort((a, b) => String(b.acquisition_date).localeCompare(String(a.acquisition_date)))[0];
  if (!newest) throw new Error('The state\'s catalog no longer lists land parcels');
  const listed = await getJson(`${API}/resources/?collection_id=${newest.collection_id}&limit=400`, 'The state\'s file list');
  const files = (listed.results || []).map((entry) => ({ url: entry.resource, name: entry.area_type_name, fips: /_(48\d{3})_/.exec(entry.resource)?.[1] })).filter((file) => file.fips).sort((a, b) => a.fips.localeCompare(b.fips));
  log(`Vintage ${String(newest.acquisition_date).slice(0, 10)}: ${files.length} counties listed`);
  if (files.length < 250) throw new Error(`Only ${files.length} county files are listed`);

  for (const file of files) {
    if ((OWN_CONNECTOR.has(file.fips) && !compare) || (only.length && !only.includes(file.fips))) continue;
    const zip = path.join(work, 'tx-stratmap', `${file.fips}.zip`);
    download(file.url, zip);
    const member = execFileSync('unzip', ['-Z1', zip], { encoding: 'latin1', maxBuffer: 1e7 }).split('\n').find((name) => /^shp\/.*\.dbf$/i.test(name));
    if (!member) throw new Error(`County ${file.fips}'s file has no table`);
    const county = `${file.name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    let useful = 0;
    let protectedAccounts = 0;
    let asOf = null;
    for await (const row of dbfRows(zip, member, COLUMNS, { optional: ['OWNER_NAME'] })) {
      const date = isoDate(row.DATE_ACQ);
      if (date && (!asOf || date > asOf)) asOf = date;
      const record = fromRow(row, file.fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
        if (USEFUL(record.facts)) useful += 1;
        if (record.restricted) protectedAccounts += 1;
      }
    }
    fs.rmSync(zip, { force: true });
    log(`${county}: ${records.length} records, ${noAddress} without an address, ${protectedAccounts} protected, ${useful} with a year or a value`);
    if (!records.length || useful / records.length < 0.2 || !asOf) {
      log(`${county}: not published, too little in its file`);
      continue;
    }
    for (const building of condoBuildings(records, { fips: file.fips, county })) records.push(building);
    yield {
      fips: file.fips, state: 'TX', name: county, publisher: `${file.name} County's appraisal district, through the Texas Geographic Information Office`, dataset: 'StratMap land parcels', method: 'state', source: 'tx-stratmap', title: 'State records', as_of: asOf, stale_after_days: 730, records,
    };
  }
}

module.exports = { build };

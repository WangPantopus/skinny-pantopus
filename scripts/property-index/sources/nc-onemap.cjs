'use strict';
// North Carolina: NC OneMap's standardized parcels from all 100 counties, one file per county, under OneMap's free and
// unrestricted use policy. What a county supplies varies, and most files have no building facts. Values are whatever the
// county's valuation type says, so an assessment is only ever labeled one. The Eastern Band of Cherokee Indians' lands
// have their own file and aren't read here: their data is theirs. Owner and mailing columns are never decoded.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, USER_AGENT } = require('../lib/tables.cjs');
const { dbfRows } = require('../lib/dbf.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const BUCKET = 'https://dit-cgia-gis-data.s3.amazonaws.com';
const COLUMNS = ['PARNO', 'CNTYFIPS', 'CNTYNAME', 'GISACRES', 'IMPROVVAL', 'LANDVAL', 'PARVAL', 'PARVALTYPE', 'SITEADD', 'SUNIT', 'SCITY', 'SZIP', 'STRUCTYEAR', 'SALEDATE', 'SUBDIVISIO', 'PARUSEDESC', 'PARUSECODE', 'REVISEYEAR'];

function useOf(text, unit) {
  const use = String(text ?? '').toUpperCase();
  if (/CONDO|TOWN ?H/.test(use)) return /CONDO/.test(use) || unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/MOBILE|MANUFACT/.test(use)) return ['property', 'mobile_home'];
  if (/DUPLEX|TRIPLEX|TWO FAM|2 FAM|MULTI/.test(use)) return ['building', 'multi_unit'];
  if (/APART/.test(use)) return ['building', 'apartment'];
  if (/VACANT|\bLAND\b|WOODED|FARM WITH NO/.test(use)) return ['parcel', null];
  if (/SINGLE|RESID|DWELLING|HOUSE/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}

function fromRow(row, fips, county) {
  const unit = word(row.SUNIT);
  const parsed = parse(row.SITEADD, unit || '');
  const parcel = word(row.PARNO);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row.PARUSEDESC, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'address_on_record', [word(row.SITEADD), unit].filter(Boolean).join(' '));
  put(facts, 'year_built', on ? year(row.STRUCTYEAR) : null);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.GISACRES));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  put(facts, 'land_use', word(row.PARUSEDESC));
  put(facts, 'county_use_code', word(row.PARUSECODE));
  const valueType = String(row.PARVALTYPE ?? '').trim().toUpperCase();
  put(facts, valueType.startsWith('MARKET') || valueType.startsWith('APPRAIS') ? 'market_value' : 'assessed_value', positive(row.PARVAL));
  if (positive(row.PARVAL)) put(facts, 'value_year', positive(row.REVISEYEAR));
  const sold = isoDate(row.SALEDATE);
  if (sold && sold > '1800') facts.sale_date = sold;
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.SCITY) || '').toUpperCase(), zip: zipCode(row.SZIP) }, facts };
}

/** Each county's newest file, from the bucket's listing. */
async function newestFiles() {
  const newest = new Map();
  let token = null;
  do {
    const query = new URLSearchParams({ 'list-type': '2', prefix: 'NCOM-data/parcels/', 'max-keys': '1000' });
    if (token) query.set('continuation-token', token);
    const response = await fetch(`${BUCKET}/?${query}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`The file list answered ${response.status}`);
    const listing = await response.text();
    for (const [, key, name, month, day, yearText] of listing.matchAll(/<Key>(NCOM-data\/parcels\/([a-z-]+)-parcels-(\d\d)-(\d\d)-(\d{4})\.zip)<\/Key>/g)) {
      const date = `${yearText}-${month}-${day}`;
      if (!newest.has(name) || newest.get(name).date < date) newest.set(name, { key, date });
    }
    token = /<NextContinuationToken>([^<]+)/.exec(listing)?.[1] || null;
  } while (token);
  return newest;
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const files = await newestFiles();
  log(`${files.size} county files listed`);
  if (files.size < 95) throw new Error(`Only ${files.size} county files are listed`);
  for (const [name, { key, date }] of [...files].sort()) {
    if (/cherokee.*indian|ebci/.test(name)) continue;
    const zip = path.join(work, 'nc-onemap', `${name}.zip`);
    download(`${BUCKET}/${key}`, zip);
    const member = execFileSync('unzip', ['-Z1', zip], { encoding: 'latin1', maxBuffer: 1e7 }).split('\n').find((entry) => /_pt\.dbf$/i.test(entry));
    if (!member) throw new Error(`The file for ${name} has no table`);
    const byCounty = [];
    const seen = new Set();
    let fips = null;
    let county = null;
    let noAddress = 0;
    for await (const row of dbfRows(zip, member, COLUMNS)) {
      if (!fips) {
        const code = String(row.CNTYFIPS ?? '').trim();
        fips = code.length === 3 ? `37${code}` : null;
        county = `${word(row.CNTYNAME)?.toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase())} County`;
      }
      if (!fips) continue;
      const record = fromRow(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        byCounty.push(record);
      }
    }
    fs.rmSync(zip, { force: true });
    if (!fips || (only.length && !only.includes(fips))) continue;
    log(`${county}: ${byCounty.length} records, ${noAddress} without a street number`);
    for (const building of condoBuildings(byCounty, { fips, county })) byCounty.push(building);
    yield {
      fips, state: 'NC', name: county, publisher: 'NC OneMap', dataset: 'standardized county parcels', method: 'state', source: 'nc-onemap', title: 'State records', as_of: date, stale_after_days: 400, records: byCounty,
    };
  }
}

module.exports = { build };

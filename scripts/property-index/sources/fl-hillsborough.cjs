'use strict';
// Hillsborough County, Florida: the Property Appraiser's Public Downloads, its parcel file refreshed daily, with no warranty. Year built, heated area,
// bedrooms, baths, stories, units, just values and the last sale. The state's roll has no bedrooms or baths. Owner and mailing columns are in the file
// and never read. Assessed and taxable values are left out: the distance from just value can say a home has a homestead exemption. The site serves
// files through a form post on its download page, so a file's link can't be written down. The same page's gross areas, subdivision names and
// every recorded sale (its deed type and the Appraiser's qualification code; grantor and grantee are never read) fill in the rest.

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { dbfRows } = require('../lib/dbf.cjs');
const { USER_AGENT } = require('../lib/tables.cjs');
const { year, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { lotNumber } = require('../lib/legal.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '12057';
const COUNTY = 'Hillsborough County';
const SITE = 'https://downloads.hcpafl.org/';
const MEMBER = 'parcel_4_public.dbf';
const COLUMNS = ['FOLIO', 'STRAP', 'SUB', 'TAXDIST', 'MUNI', 'SITE_ADDR', 'SITE_CITY', 'SITE_ZIP', 'LEGAL1', 'LEGAL2', 'LEGAL3', 'LEGAL4', 'tBEDS', 'tBATHS', 'tSTORIES', 'tUNITS', 'tBLDGS', 'JUST', 'LAND', 'BLDG', 'ACT', 'EFF', 'HEAT_AR', 'S_DATE', 'S_AMT', 'ACREAGE', 'str', 'str_pfx', 'str_sfx', 'str_unit', 'str_num', 'DOR_CODE', 'LU_GRP'];

// The county's three cities by their tax district, and its unincorporated land.
const MUNICIPALITIES = { U: 'Unincorporated Hillsborough County', A: 'Tampa', P: 'Plant City', T: 'Temple Terrace' };
// Deeds that move no home at a price, and the Department of Revenue's qualification codes for a price that isn't this home's: several
// parcels, a corrective or nominal deed, a cemetery lot, part of an interest, part of a bulk sale, a deed in error.
const NOT_A_DEED_OF_SALE = new Set(['QC', 'QD', 'QV', 'QS']);
const NOT_THIS_SALE = new Set(['05', '11', '13', '16', '34', '43', '98']);

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '0100') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '0106') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('02')) return ['property', 'mobile_home'];
  if (c.startsWith('04')) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  // Its cooperatives.
  if (c === '0500' || c === '0508') return hasUnit ? ['unit', 'condo'] : ['building', 'multi_unit'];
  if (c.startsWith('08')) return ['building', 'multi_unit'];
  if (c.startsWith('03')) return ['building', 'apartment'];
  if (c.startsWith('00')) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const number = positive(value);
  return number && number <= most ? number : null;
};

function fromRow(row, files) {
  const address = streetParts({ number: row.str_num, pre: row.str_pfx, name: row.str, suffix: row.str_sfx, unit: realUnit(row.str_unit) });
  const parcel = word(row.FOLIO);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.DOR_CODE, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(word(row.SITE_ADDR), row.str_unit));
  put(facts, 'land_use', word(row.LU_GRP));
  put(facts, 'county_use_code', word(row.DOR_CODE));
  const legal = [row.LEGAL1, row.LEGAL2, row.LEGAL3, row.LEGAL4].map(word).filter(Boolean).join(' ');
  put(facts, 'legal_description', legal.slice(0, 300) || null);
  put(facts, 'lot_number', lotNumber(legal));
  put(facts, 'municipality', MUNICIPALITIES[String(row.MUNI ?? '').trim()]);
  put(facts, 'tax_code_area', word(row.TAXDIST));
  put(facts, 'subdivision', files.subdivisions.get(String(row.SUB ?? '').trim()));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.ACT));
    put(facts, 'effective_year_built', year(row.EFF));
    // tSTORIES adds up a parcel's buildings.
    if (positive(row.tBLDGS) > 1) facts.buildings_on_parcel = positive(row.tBLDGS);
    else put(facts, 'stories', inRange(row.tSTORIES, 120));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.HEAT_AR));
    if (!(positive(row.tBLDGS) > 1)) put(facts, 'gross_sqft', files.gross.get(String(row.STRAP ?? '').trim()));
    put(facts, 'bedrooms', inRange(row.tBEDS, 15));
    put(facts, 'bathrooms', inRange(row.tBATHS, 20));
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.HEAT_AR));
    put(facts, 'units', positive(row.tUNITS));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE));
  put(facts, 'market_value', positive(row.JUST));
  if (kind !== 'unit') put(facts, 'market_land_value', positive(row.LAND));
  put(facts, 'market_building_value', positive(row.BLDG));
  const sold = /^(\d{4})(\d{2})(\d{2})$/.exec(String(row.S_DATE ?? '').replace(/-/g, '').trim());
  const sale = files.sales.get(parcel);
  // The sales file is monthly and the parcel file daily: a sale newer than the sales file is read from the parcel file.
  const newer = sold && `${sold[1]}-${sold[2]}-${sold[3]}` > files.salesAsOf && isHomeSale(positive(row.S_AMT));
  if (newer) {
    facts.sale_price = positive(row.S_AMT);
    facts.sale_date = `${sold[1]}-${sold[2]}-${sold[3]}`;
  } else if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
    put(facts, 'sale_document', sale.document);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITE_CITY) || '').toUpperCase(), zip: zipCode(row.SITE_ZIP) }, facts };
}

// The page lists each file as a form post; it answers the post with the file. A dated file's name ends in its date.
async function downloadFile(dir, name) {
  const page = await fetch(SITE, { headers: { 'User-Agent': USER_AGENT } });
  if (!page.ok) throw new Error(`The downloads page answered ${page.status}`);
  const cookie = page.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ');
  const html = await page.text();
  const link = new RegExp(`__doPostBack\\(&#39;([^&]+)&#39;,&#39;&#39;\\)"><i[^>]*><\\/i>\\s*(${name}(?:_(\\d{2})_(\\d{2})_(\\d{4}))?\\.zip)<`).exec(html);
  if (!link) throw new Error(`The downloads page no longer lists ${name}`);
  const asOf = link[5] ? `${link[5]}-${link[3]}-${link[4]}` : null;
  const zip = path.join(dir, link[2]);
  if (!fs.existsSync(zip)) {
    const form = new URLSearchParams();
    for (const match of html.matchAll(/<input[^>]*name="(__[A-Z]+)"[^>]*?value="([^"]*)"/g)) form.set(match[1], match[2].replace(/&#x2B;/g, '+').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&'));
    form.set('__EVENTTARGET', link[1]);
    form.set('__EVENTARGUMENT', '');
    const file = await fetch(SITE, { method: 'POST', headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body: form });
    if (!file.ok || !/octet-stream|zip/i.test(file.headers.get('content-type') || '')) throw new Error(`The parcel file answered ${file.status}`);
    fs.mkdirSync(dir, { recursive: true });
    await pipeline(Readable.fromWeb(file.body), fs.createWriteStream(`${zip}.part`));
    fs.renameSync(`${zip}.part`, zip);
  }
  return { zip, asOf };
}

async function readFiles(dir) {
  const [grossFile, subdivisionFile, salesFile] = [await downloadFile(dir, 'grossarea'), await downloadFile(dir, 'subdivisions'), await downloadFile(dir, 'allsales')];
  const gross = new Map();
  for await (const row of dbfRows(grossFile.zip, 'grossarea.dbf', ['strap', 'GrossAr'])) if (positive(row.GrossAr)) gross.set(String(row.strap).trim(), positive(row.GrossAr));
  const subdivisions = new Map();
  for await (const row of dbfRows(subdivisionFile.zip, 'SUBDIVISIONS.dbf', ['SUBCODE', 'LEGAL1'])) if (word(row.LEGAL1)) subdivisions.set(String(row.SUBCODE).trim(), word(row.LEGAL1));
  const sales = new Map();
  for await (const row of dbfRows(salesFile.zip, 'allsales.dbf', ['FOLIO', 'S_DATE', 'QU', 'REA_CD', 'S_AMT', 'S_TYPE', 'OR_BK', 'OR_PG'])) {
    const sold = /^(\d{4})(\d{2})(\d{2})$/.exec(String(row.S_DATE ?? '').trim());
    const price = positive(row.S_AMT);
    if (!sold || !isHomeSale(price) || NOT_A_DEED_OF_SALE.has(String(row.S_TYPE).trim()) || NOT_THIS_SALE.has(String(row.REA_CD).trim())) continue;
    const date = `${sold[1]}-${sold[2]}-${sold[3]}`;
    const folio = String(row.FOLIO).trim();
    const held = sales.get(folio);
    if (!held || held.date < date) sales.set(folio, { date, price, document: word(row.OR_BK) && word(row.OR_PG) ? `${word(row.OR_BK)}-${word(row.OR_PG)}` : null });
  }
  log(`${gross.size} gross areas, ${subdivisions.size} subdivisions, ${sales.size} folios with a sale of the home (sales file of ${salesFile.asOf})`);
  return { gross, subdivisions, sales, salesAsOf: salesFile.asOf || '0000' };
}

async function* build({ work }) {
  const dir = path.join(work, 'fl-hillsborough');
  const { zip, asOf } = await downloadFile(dir, 'HCparcel_4_public');
  const files = await readFiles(dir);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of dbfRows(zip, MEMBER, COLUMNS)) {
    const record = fromRow(row, files);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Hillsborough County Property Appraiser', dataset: 'parcel file', method: 'county', source: 'fl-hillsborough', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: ['ACT actual year built', 'EFF effective year built', 'tSTORIES stories', 'tBLDGS buildings', 'HEAT_AR heated area', 'tBEDS bedrooms', 'tBATHS bathrooms', 'tUNITS units', 'ACREAGE', 'JUST market value', 'LAND land value', 'BLDG building value', 'S_AMT sale price', 'S_DATE sale date', 'LU_GRP land use', 'LEGAL1 legal'],
    facts: { year_built: 'ACT actual year built', effective_year_built: 'EFF effective year built', stories: 'tSTORIES stories', buildings_on_parcel: 'tBLDGS buildings', living_sqft: 'HEAT_AR heated area', gross_sqft: 'HEAT_AR heated area', bedrooms: 'tBEDS bedrooms', bathrooms: 'tBATHS bathrooms', units: 'tUNITS units', lot_acres: 'ACREAGE', market_value: 'JUST market value', market_land_value: 'LAND land value', market_building_value: 'BLDG building value', sale_price: 'S_AMT sale price', sale_date: 'S_DATE sale date', land_use: 'LU_GRP land use', legal_description: 'LEGAL1 legal' },
  },
};

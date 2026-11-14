'use strict';
// An Ohio County Auditor's "CAMADatabase.zip" on its Schneider-hosted site: MVP1_OH_*.csv tables from the county's appraisal system, with a code table.
// Year built, finished living area, rooms, bedrooms, full and half baths, stories and style (Dwelling), acres (the parcel's deeded acres, or else the
// acres its land lines state), market values, land use, and the last sale with the Auditor's valid-sale flag (Extract). Only the columns named here are
// read: owner, taxpayer and lender columns are never asked for, and the owner, tax and payment tables are never opened. Each county's connector names
// its site and states its terms.
// The Extract table isn't quoted, and some rows carry commas inside their free text (legal description, location description, owner names,
// subdivision), which pushes later columns right. A row is read only when exactly one placement of those extra commas gives every column read here its
// expected shape (a ZIP, the state, a three-digit use code, numbers, a date, the valid-sale flag); any other row is left out and counted.

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { download, zipTable, zipDates, USER_AGENT } = require('./tables.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('./addresses.cjs');
const { positive, put, word } = require('./values.cjs');
const { zipsByCounty } = require('./zcta.cjs');
const { condoBuildings } = require('./condos.cjs');
const { isHomeSale } = require('./sales.cjs');
const { log } = require('./log.cjs');

const EXTRACT = 'MVP1_OH_Extract.csv';
const DWELLING_COLUMNS = ['PropertyNumber', 'CardNumber', 'YearBuilt', 'RoomCount', 'BedroomCount', 'FullBathCount', 'HalfBathCount', 'FinishedLivingArea', 'StoryHeight', 'StyleOfHome'];
const LAND_COLUMNS = ['PropertyNumber', 'NumAcres'];
const CODE_COLUMNS = ['msysTypeCategory', 'mtypecode', 'mdescr'];
// The Extract columns read, by name; their positions come from the header.
const LEFT = ['mpropertyNumber', 'NeighborhoodCode', 'mlocStrDir', 'mlocStrNo', 'mlocStrName', 'mlocStrSuffix', 'mlocStrSuffixDir', 'msecondaryAddress', 'mlocCity', 'mlocState', 'mlocZipCode'];
const MIDDLE = ['mClassificationId', 'macres', 'Par_Deleted'];
const RIGHT = ['MKT_Land_Value', 'MKT_Impr_Value', 'MKT_Total_Value', 'SaleDate', 'ValidSale', 'SaleAmount', 'NumberOfPropertiesInSale'];
// activeYear isn't the values' tax year (most rows hold 1980), so no value year is shown.
const FREE = ['mlegalDescription', 'mlocDescription', 'DeededOwner', 'msubdivision'];

const NUMBER = /^-?\d*\.?\d*$/;
const shapes = {
  mlocState: (v) => v === '' || /^[A-Z]{2}$/.test(v),
  mlocZipCode: (v) => v === '' || /^\d{5}(-?\d{4})?$/.test(v),
  mlocStrNo: (v) => v === '' || /^\d/.test(v),
  mClassificationId: (v) => v === '' || /^\d{3}$/.test(v),
  macres: (v) => NUMBER.test(v),
  Par_Deleted: (v) => v === '' || /^[YN]$/.test(v),
  MKT_Land_Value: (v) => NUMBER.test(v),
  MKT_Impr_Value: (v) => NUMBER.test(v),
  MKT_Total_Value: (v) => NUMBER.test(v),
  SaleDate: (v) => v === '' || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(v),
  ValidSale: (v) => v === '' || /^[YN]$/.test(v),
  SaleAmount: (v) => NUMBER.test(v),
  NumberOfPropertiesInSale: (v) => /^\d*$/.test(v),
};

/** The Extract's rows as objects of the columns read, realigned where free text holds commas. */
async function* extractRows(zip) {
  const unzip = execFileSync('unzip', ['-p', zip, EXTRACT], { maxBuffer: 1 << 30 }).toString('latin1');
  const lines = unzip.split(/\r?\n/);
  const header = lines[0].split(',').map((name) => name.trim());
  const at = Object.fromEntries(header.map((name, i) => [name, i]));
  const missing = [...LEFT, ...MIDDLE, ...RIGHT, ...FREE].filter((name) => !(name in at));
  if (missing.length) throw new Error(`${EXTRACT} no longer has ${missing.join(', ')}`);
  // Commas can hide in the legal description (before the site address), the location description (before the use code), the owner columns (before
  // the values) and the subdivision (last). Each run of columns shifts by the extra commas before it.
  const fits = (fields, names, shift) => names.every((name) => !shapes[name] || shapes[name](String(fields[at[name] + shift] ?? '').trim()));
  let read = 0;
  let skipped = 0;
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const fields = line.split(',');
    const extra = fields.length - header.length;
    if (extra < 0) { skipped += 1; continue; }
    const placements = [];
    for (let legal = 0; legal <= extra; legal += 1) {
      if (!fits(fields, LEFT.filter((name) => at[name] > at.mlegalDescription), legal)) continue;
      for (let location = 0; legal + location <= extra; location += 1) {
        if (!fits(fields, MIDDLE, legal + location)) continue;
        for (let owners = 0; legal + location + owners <= extra; owners += 1) {
          if (fits(fields, RIGHT, legal + location + owners)) placements.push([legal, location, owners]);
        }
      }
    }
    if (placements.length !== 1) { skipped += 1; continue; }
    const [legal, location, owners] = placements[0];
    const value = (name, shift) => String(fields[at[name] + shift] ?? '').trim();
    const row = {};
    for (const name of LEFT) row[name] = value(name, at[name] > at.mlegalDescription ? legal : 0);
    for (const name of MIDDLE) row[name] = value(name, legal + location);
    for (const name of RIGHT) row[name] = value(name, legal + location + owners);
    read += 1;
    yield row;
  }
  log(`${EXTRACT}: ${read} rows read, ${skipped} left out (their columns couldn't be placed)`);
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// Ohio's land use codes (Ohio Administrative Code 5703-25-10), with the county's own words from its code table: 510-515 one-family dwellings, 520-535
// two- and three-family, 550-555 condominium units, 560-565 mobile homes on their land, 500-505 vacant residential land, 599 other residential; 1xx
// agricultural, 401-403 apartments. Other residential codes, 599 and farm codes are a home of no named type when the Auditor has a dwelling for the
// parcel, and land otherwise.
function useOf(code, dwelling, unit) {
  const c = String(code || '').trim();
  if (/^51[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/^55[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^56[0-5]$/.test(c)) return ['property', 'mobile_home'];
  if (/^5[23][0-5]$/.test(c)) return ['building', 'multi_unit'];
  if (/^40[1-3]$/.test(c)) return ['building', 'apartment'];
  if (/^(5\d\d|1\d\d)$/.test(c)) return dwelling ? ['property', null] : ['parcel', null];
  return ['other', null];
}

function fromParcel({ FIPS, COUNTY }, row, dwelling, landAcres, words) {
  const parcel = word(row.mpropertyNumber);
  const number = row.mlocStrNo;
  if (!parcel || !/^\d/.test(number) || /^0+$/.test(number)) return null;
  const unit = realUnit(row.msecondaryAddress.replace(/^(?:UNIT|APT|STE|#)\s*/i, ''));
  const address = streetParts({ number, pre: row.mlocStrDir, name: row.mlocStrName, suffix: row.mlocStrSuffix, post: row.mlocStrSuffixDir, unit });
  if (!address) return null;
  const [kind, homeType] = useOf(row.mClassificationId, dwelling, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, row.mlocStrDir, row.mlocStrName, row.mlocStrSuffix, row.mlocStrSuffixDir].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(words.Classification?.get(row.mClassificationId)));
  put(facts, 'county_use_code', word(row.mClassificationId));
  put(facts, 'neighborhood', word(row.NeighborhoodCode));
  if (dwelling && (home || kind === 'building')) put(facts, 'year_built', year(dwelling.YearBuilt));
  if (dwelling && home) {
    put(facts, 'living_sqft', positive(dwelling.FinishedLivingArea));
    put(facts, 'rooms', inRange(dwelling.RoomCount, 30));
    put(facts, 'bedrooms', inRange(dwelling.BedroomCount, 15));
    const [full, half] = [inRange(dwelling.FullBathCount, 12), inRange(dwelling.HalfBathCount, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(dwelling.StoryHeight, 5));
    // The code table's style "00" reads "00": a description that's only digits names nothing.
    const style = word(words.Style?.get(dwelling.StyleOfHome));
    put(facts, 'style', style && !/^\d+$/.test(style) ? style : null);
  } else if (dwelling && kind === 'building') put(facts, 'gross_sqft', positive(dwelling.FinishedLivingArea));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.macres) || positive(Math.round(landAcres * 10000) / 10000));
  put(facts, 'market_value', positive(row.MKT_Total_Value));
  put(facts, 'market_land_value', positive(row.MKT_Land_Value));
  put(facts, 'market_building_value', positive(row.MKT_Impr_Value));
  const [date, price] = [isoDate(row.SaleDate), positive(row.SaleAmount)];
  if (row.ValidSale === 'Y' && (positive(row.NumberOfPropertiesInSale) || 1) <= 1 && date && isHomeSale(price)) {
    facts.sale_price = Math.round(price);
    facts.sale_date = date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.mlocCity) || '').toUpperCase(), zip: zipCode(row.mlocZipCode) }, facts };
}

// The download's address carries a signed token the county renews from time to time, so it's read from the county's site each run.
async function fileUrl(site) {
  const page = await (await fetch(site, { headers: { 'User-Agent': USER_AGENT } })).text();
  const link = /https:\/\/beaconfiledata\.blob\.core\.windows\.net\/[^"'\s]+\/CAMADatabase\.zip\?[^"'\s]+/.exec(page);
  if (!link) throw new Error('The Auditor\'s site no longer links CAMADatabase.zip');
  return link[0].replace(/&amp;/g, '&');
}

async function* build({ FIPS, COUNTY, SITE, SOURCE, PUBLISHER }, { work }) {
  const zip = path.join(work, SOURCE, 'CAMADatabase.zip');
  download(await fileUrl(SITE), zip);
  const asOf = zipDates(zip).get(EXTRACT);
  if (!asOf) throw new Error('The zip no longer dates its Extract table');
  const words = {};
  for await (const row of zipTable(zip, 'MVP1_OH_Codes.csv', CODE_COLUMNS, { quoted: false })) {
    const category = row.msysTypeCategory;
    if (category !== 'Classification' && category !== 'Style') continue;
    if (!words[category]) words[category] = new Map();
    words[category].set(row.mtypecode, row.mdescr);
  }
  // A parcel can hold several cards: the first is its main building.
  const dwellings = new Map();
  for await (const row of zipTable(zip, 'MVP1_OH_Dwelling.csv', DWELLING_COLUMNS, { quoted: false })) {
    const held = dwellings.get(row.PropertyNumber);
    if (!held || (positive(row.CardNumber) || 1) < (positive(held.CardNumber) || 1)) dwellings.set(row.PropertyNumber, row);
  }
  const landAcres = new Map();
  for await (const row of zipTable(zip, 'MVP1_OH_Land.csv', LAND_COLUMNS, { quoted: false })) {
    landAcres.set(row.PropertyNumber, (landAcres.get(row.PropertyNumber) || 0) + (Number(row.NumAcres) || 0));
  }
  const records = new Map();
  let noAddress = 0;
  let deleted = 0;
  for await (const row of extractRows(zip)) {
    if (row.Par_Deleted === 'Y') { deleted += 1; continue; }
    const record = fromParcel({ FIPS, COUNTY }, row, dwellings.get(row.mpropertyNumber), landAcres.get(row.mpropertyNumber) || 0, words);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  // A county's site has served another county's file under its own link (Highland's held Knox's, Nov 2026): the records' ZIPs must be the county's.
  const countyZips = new Set(zipsByCounty(work, ['39']).get(FIPS) || []);
  const zipped = list.filter((record) => record.address.zip);
  const inCounty = zipped.filter((record) => countyZips.has(record.address.zip)).length;
  if (zipped.length >= 100 && inCounty < zipped.length * 0.9) throw new Error(`Only ${inCounty} of ${zipped.length} addresses with a ZIP are in ${COUNTY}'s ZIP codes: the download holds another county's records`);
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${deleted} deleted; ${dwellings.size} with a dwelling; ${inCounty} of ${zipped.length} ZIPs in the county`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: PUBLISHER, dataset: 'CAMA database download', method: 'county', source: SOURCE, as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records: list,
  };
}

// The columns read (the Auditors' downloads carry no layout; names as the tables write them).
const DICTIONARY = {
  columns: [...LEFT, ...MIDDLE, ...RIGHT, ...DWELLING_COLUMNS, ...LAND_COLUMNS, ...CODE_COLUMNS],
  facts: {
    year_built: 'YearBuilt', living_sqft: 'FinishedLivingArea', gross_sqft: 'FinishedLivingArea', rooms: 'RoomCount', bedrooms: 'BedroomCount', bathrooms: 'FullBathCount', full_baths: 'FullBathCount',
    half_baths: 'HalfBathCount', stories: 'StoryHeight', style: 'StyleOfHome', lot_acres: 'macres', market_value: 'MKT_Total_Value', market_land_value: 'MKT_Land_Value',
    market_building_value: 'MKT_Impr_Value', sale_price: 'SaleAmount', sale_date: 'SaleDate', land_use: 'mClassificationId', county_use_code: 'mClassificationId', neighborhood: 'NeighborhoodCode',
  },
};

/** A county's connector: { fips, county, site, source, publisher }. */
function mvpCounty({ fips, county, site, source, publisher }) {
  const settings = { FIPS: fips, COUNTY: county, SITE: site, SOURCE: source, PUBLISHER: publisher };
  return { build: (options) => build(settings, options), dictionary: DICTIONARY };
}

module.exports = { mvpCounty, extractRows };

'use strict';
// Colorado: the Governor's Office of Information Technology's Colorado Public Parcels, each county's parcels and assessor
// facts in one schema, collected yearly. The item page (read November 7, 2026) allows commercial use, subscription apps
// included, with credit to the State; only reselling the dataset itself is barred (web's data sources page credits it).
// The State's file geodatabase is read, as the service asks; owner and mailing columns are never decoded. Actual value is
// Colorado's market value; assessed value is its fraction of it. Adams and Denver keep their own connectors, which carry
// building facts this file lacks; so do Boulder, Mesa and Broomfield.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download } = require('../lib/tables.cjs');
const { catalog, rows } = require('../lib/fgdb.cjs');
const { isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FILE = 'https://www.arcgis.com/sharing/rest/content/items/3245c94414124882b331e35c14bb23a4/data';
const TABLE = 'Colorado_Public_Parcel_Composite';
const COLUMNS = ['countyName', 'countyFips', 'parcel_id', 'account', 'situsAdd', 'sitAddCty', 'sitAddZip', 'legalDesc', 'landSqft', 'landAcres', 'lot', 'subName', 'zoningCode', 'landUseCde', 'landUseDsc', 'saleDate', 'salePrice', 'apprValTot', 'asedValTot', 'dateReceived'];
const OWN_CONNECTOR = new Set(['08001', '08013', '08014', '08031', '08077']);

// Counties word their uses their own way. Where only the State's abstract code is given, its first digits say: 1112 and 1212
// a single-family house, 1230 a condominium, 1115, 1140 and 1215 a manufactured home, 1120, 1125, 1220 and 1225 a building
// of several units, 0100 and 1100 residential land.
const CODES = {
  1112: ['property', 'house'], 1212: ['property', 'house'], 1130: ['unit', 'condo'], 1230: ['unit', 'condo'], 1115: ['property', 'mobile_home'], 1140: ['property', 'mobile_home'], 1215: ['property', 'mobile_home'],
  1120: ['building', 'apartment'], 1125: ['building', 'apartment'], 1220: ['building', 'apartment'], 1225: ['building', 'apartment'], 100: ['parcel', null], 1100: ['parcel', null],
};

function useOf(row, unit) {
  const use = String(row.landUseDsc ?? '').toUpperCase();
  if (/CONDO/.test(use)) return ['unit', 'condo'];
  if (/TOWN ?H|ROW ?H/.test(use)) return ['property', 'townhouse'];
  if (/MOBILE|MANUF/.test(use)) return ['property', 'mobile_home'];
  if (/DUPLEX|TRIPLEX|MULTI|APART|\b[2-9] ?(UNIT|FAM)/.test(use)) return ['building', /APART|MULTI/.test(use) ? 'apartment' : 'multi_unit'];
  if (/VACANT|\bLAND\b/.test(use)) return ['parcel', null];
  if (/RESID|SINGLE|SFR|DWELL|HOUSE/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (use) return ['other', null];
  const code = Number(String(row.landUseCde ?? '').trim().slice(0, 4));
  if (CODES[code]) return unit && CODES[code][0] === 'property' ? ['unit', 'condo'] : CODES[code];
  return ['other', null];
}

function fromRow(row, fips, county) {
  const parsed = parse(row.situsAdd);
  const parcel = word(row.parcel_id) || word(row.account);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', onRecord(row.situsAdd, ''));
  if (kind !== 'unit') {
    put(facts, 'lot_acres', positive(row.landAcres));
    if (!facts.lot_acres) put(facts, 'lot_sqft', positive(row.landSqft));
  }
  put(facts, 'lot_number', word(row.lot));
  put(facts, 'subdivision', word(row.subName));
  put(facts, 'zoning', word(row.zoningCode));
  put(facts, 'land_use', String(row.landUseDsc ?? '').trim().length > 3 ? word(row.landUseDsc) : null);
  put(facts, 'county_use_code', word(row.landUseCde));
  put(facts, 'legal_description', word(row.legalDesc)?.slice(0, 300));
  put(facts, 'market_value', positive(row.apprValTot));
  put(facts, 'assessed_value', positive(row.asedValTot));
  const sold = isoDate(row.saleDate);
  if (sold && sold > '1800' && positive(row.salePrice)) {
    facts.sale_date = sold;
    facts.sale_price = positive(row.salePrice);
  }
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.sitAddCty) || '').toUpperCase(), zip: zipCode(row.sitAddZip) }, facts };
}

async function* build({ work, compare = null }) {
  // A county build comparing its own record with this file (lib/agreement.cjs) asks for counties it otherwise leaves out.
  const only = compare || (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const dir = path.join(work, 'co-parcels');
  const zip = path.join(dir, 'parcels.zip');
  download(FILE, zip);
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { maxBuffer: 1e9 });
  fs.rmSync(zip, { force: true });
  const gdb = fs.readdirSync(dir).find((name) => name.endsWith('.gdb'));
  const table = gdb && catalog(path.join(dir, gdb)).get(TABLE);
  if (!table) throw new Error('The State\'s file no longer has its composite parcel table');
  const counties = new Map();
  let newest = null;
  for (const row of rows(table, COLUMNS)) {
    const fips = `08${String(row.countyFips ?? '').trim().padStart(3, '0')}`;
    if (!/^08\d{3}$/.test(fips) || (OWN_CONNECTOR.has(fips) && !compare) || (only.length && !only.includes(fips))) continue;
    const received = isoDate(row.dateReceived);
    if (received && (!newest || received > newest)) newest = received;
    if (!counties.has(fips)) counties.set(fips, { name: `${word(row.countyName)?.replace(/([a-z])([A-Z])/g, '$1 $2') || fips} County`, records: new Map(), noAddress: 0 });
    const county = counties.get(fips);
    const record = fromRow(row, fips, county.name);
    if (!record) county.noAddress += 1;
    else if (!county.records.has(record.id)) county.records.set(record.id, record);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  if (!newest) throw new Error('The State\'s file no longer says when each county sent it');
  for (const [fips, { name, records: byId, noAddress }] of [...counties].sort()) {
    const records = [...byId.values()];
    log(`${name}: ${records.length} records, ${noAddress} without a street number`);
    if (!records.length) continue;
    for (const building of condoBuildings(records, { fips, county: name })) records.push(building);
    yield {
      fips, state: 'CO', name, publisher: `${name} Assessor, through the State of Colorado (OIT)`, dataset: 'Colorado Public Parcels', method: 'state', source: 'co-parcels', title: 'State records', as_of: newest, stale_after_days: 450, records,
    };
    counties.set(fips, null);
  }
}

module.exports = { build };

'use strict';
// Wisconsin: the Statewide Parcel Map Database (V12, State Cartographer's Office and the Department of Administration), every
// county's parcels and tax roll in one schema, "free for public consumption" (the layer's license, read November 7, 2026).
// Assessed values from the local roll, and the Department's estimated fair market value; no year built, size, bedrooms or
// baths. The file's own uncompressed geodatabase is read; owner names and the mailing address are never decoded. Milwaukee
// and Dane keep their city connectors (Milwaukee, Madison), so the statewide file skips those counties.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download } = require('../lib/tables.cjs');
const { catalog, fieldNames, rows } = require('../lib/fgdb.cjs');
const { zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FILE = 'https://web.s3.wisc.edu/parcels/v12_parcels/V12.0.0_Wisconsin_Parcels_2026_10.3_Uncompressed.zip';
const AS_OF = '2026-06-30';
const COLUMNS = ['PARCELID', 'TAXPARCELID', 'TAXROLLYEAR', 'SITEADRESS', 'UNITTYPE', 'UNITID', 'PLACENAME', 'ZIPCODE', 'SCHOOLDIST', 'CNTASSDVALUE', 'LNDVALUE', 'IMPVALUE', 'ESTFMKVALUE', 'PROPCLASS', 'AUXCLASS', 'ASSDACRES', 'GISACRES', 'CONAME', 'PARCELFIPS'];
// Cities with a connector of their own in these counties: Milwaukee (55079) and Madison (55025).
const OWN_CONNECTOR = new Set(['55079', '55025']);

// Wisconsin's property classes: 1 residential. An improvement value says something stands there; the class doesn't.
function useOf(row, unit) {
  const classes = String(row.PROPCLASS ?? '').split(',').map((part) => part.trim());
  if (!classes.includes('1')) return ['other', null];
  if (!positive(row.IMPVALUE)) return ['parcel', null];
  return unit ? ['unit', 'condo'] : ['property', null];
}

function fromRow(row, fips, county) {
  const unit = realUnit([row.UNITTYPE, row.UNITID].filter((part) => String(part ?? '').trim()).join(' '));
  const parsed = parse(row.SITEADRESS, unit);
  const parcel = word(row.TAXPARCELID) || word(row.PARCELID);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', onRecord(row.SITEADRESS, unit));
  put(facts, 'municipality', word(row.PLACENAME));
  put(facts, 'school_district', word(row.SCHOOLDIST));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ASSDACRES) || positive(row.GISACRES));
  put(facts, 'property_class', word(row.PROPCLASS));
  const value = positive(row.CNTASSDVALUE) || positive(row.ESTFMKVALUE);
  if (value) put(facts, 'value_year', positive(row.TAXROLLYEAR));
  put(facts, 'assessed_value', positive(row.CNTASSDVALUE));
  put(facts, 'assessed_land_value', positive(row.LNDVALUE));
  put(facts, 'assessed_building_value', positive(row.IMPVALUE));
  put(facts, 'market_value', positive(row.ESTFMKVALUE));
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.PLACENAME) || '').toUpperCase(), zip: zipCode(row.ZIPCODE) }, facts };
}

function geodatabase(folder) {
  for (const name of fs.readdirSync(folder, { withFileTypes: true })) {
    if (name.isDirectory() && name.name.endsWith('.gdb')) return path.join(folder, name.name);
    if (name.isDirectory()) {
      const found = geodatabase(path.join(folder, name.name));
      if (found) return found;
    }
  }
  return null;
}

async function* build({ work, compare = null }) {
  // A county build comparing its own record with this file (lib/agreement.cjs) asks for counties it otherwise leaves out.
  const only = compare || (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const dir = path.join(work, 'wi-parcels');
  const zip = path.join(dir, 'parcels.zip');
  download(FILE, zip);
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { maxBuffer: 1e9 });
  fs.rmSync(zip, { force: true });
  const gdb = geodatabase(dir);
  if (!gdb) throw new Error('The statewide file has no geodatabase');
  const table = [...catalog(gdb)].find(([name, base]) => !name.startsWith('GDB_') && fieldNames(base).includes('SITEADRESS'));
  if (!table) throw new Error('The statewide geodatabase has no parcel table');
  const counties = new Map();
  for (const row of rows(table[1], COLUMNS)) {
    const fips = String(row.PARCELFIPS ?? '').trim().padStart(3, '0');
    const code = `55${fips}`;
    if (!/^55\d{3}$/.test(code) || (OWN_CONNECTOR.has(code) && !compare) || (only.length && !only.includes(code))) continue;
    if (!counties.has(code)) counties.set(code, { name: `${String(row.CONAME || '').trim().toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase())} County`, records: new Map(), noAddress: 0 });
    const county = counties.get(code);
    const record = fromRow(row, code, county.name);
    if (!record) county.noAddress += 1;
    else if (!county.records.has(record.id)) county.records.set(record.id, record);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [fips, { name, records: byId, noAddress }] of [...counties].sort()) {
    const records = [...byId.values()];
    log(`${name}: ${records.length} records, ${noAddress} without a street number`);
    if (!records.length) continue;
    for (const building of condoBuildings(records, { fips, county: name })) records.push(building);
    yield {
      fips, state: 'WI', name, publisher: `${name} and the Wisconsin State Cartographer's Office`, dataset: 'Statewide Parcel Map Database (V12)', method: 'state', source: 'wi-parcels', title: 'State records', as_of: AS_OF, stale_after_days: 450, records,
    };
    counties.set(fips, null);
  }
}

module.exports = { build };

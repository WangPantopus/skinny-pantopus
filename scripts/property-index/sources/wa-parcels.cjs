'use strict';
// Washington: WaTech's Current Parcels (Washington State Geoportal), every county's tax parcels in one schema: situs address,
// the Department of Revenue's land use code, and the assessor's land and building values (Washington assesses at 100% of
// market value). "For informational purposes only", no use limit (read November 7, 2026). The Geoportal's file geodatabase
// is read; it holds no owner columns. King, Snohomish and Spokane limit their own files, so their rows here wait until
// someone asks whether the state's copy is different; Clark, Pierce, Skagit, Kitsap and Walla Walla keep their own connectors, which have building facts.

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

const FILE = 'https://www.arcgis.com/sharing/rest/content/items/0f4c2ca4b589499c8df7779a01bef002/data';
const ITEM = 'https://www.arcgis.com/sharing/rest/content/items/0f4c2ca4b589499c8df7779a01bef002?f=json';
const COLUMNS = ['FIPS_NR', 'COUNTY_NM', 'PARCEL_ID_NR', 'ORIG_PARCEL_ID', 'SITUS_ADDRESS', 'SUB_ADDRESS', 'SITUS_CITY_NM', 'SITUS_ZIP_NR', 'LANDUSE_CD', 'VALUE_LAND', 'VALUE_BLDG'];
const NAMES = {
  '001': 'Adams', '003': 'Asotin', '005': 'Benton', '007': 'Chelan', '009': 'Clallam', '011': 'Clark', '013': 'Columbia', '015': 'Cowlitz', '017': 'Douglas', '019': 'Ferry',
  '021': 'Franklin', '023': 'Garfield', '025': 'Grant', '027': 'Grays Harbor', '029': 'Island', '031': 'Jefferson', '033': 'King', '035': 'Kitsap', '037': 'Kittitas', '039': 'Klickitat',
  '041': 'Lewis', '043': 'Lincoln', '045': 'Mason', '047': 'Okanogan', '049': 'Pacific', '051': 'Pend Oreille', '053': 'Pierce', '055': 'San Juan', '057': 'Skagit', '059': 'Skamania',
  '061': 'Snohomish', '063': 'Spokane', '065': 'Stevens', '067': 'Thurston', '069': 'Wahkiakum', '071': 'Walla Walla', '073': 'Whatcom', '075': 'Whitman', '077': 'Yakima',
};
// Clark, Pierce, Skagit, Kitsap and Walla Walla have their own connectors; King, Snohomish and Spokane wait for an answer about their terms.
const SKIPPED = new Set(['53011', '53053', '53057', '53035', '53071', '53033', '53061', '53063']);

// The Department of Revenue's land use codes: 11 single-family homes, 12 two to four units, 13 five or more, 14 condominiums,
// 18 other residential, 19 vacation homes and cabins, 91 undeveloped land.
const USES = {
  11: ['property', 'house', 'Single-family residence'], 12: ['building', 'multi_unit', 'Two to four units'], 13: ['building', 'apartment', 'Five or more units'],
  14: ['unit', 'condo', 'Residential condominium'], 18: ['property', null, 'Other residential'], 19: ['property', 'house', 'Vacation home or cabin'], 91: ['parcel', null, 'Undeveloped land'],
};

// Chelan's and Asotin's situs is the whole mailing line, "<street> <town>, WA <ZIP>", and the reader stops at the comma, so
// the town read as the street's last word and nobody typing their street found their home. The town has its own column: it
// comes off the street when a street is left. On November 7 no other county's rows were written this way.
function streetLine(row) {
  const [street, ...after] = String(row.SITUS_ADDRESS ?? '').replace(/\s+/g, ' ').trim().split(',');
  const town = String(word(row.SITUS_CITY_NM) || '').toUpperCase();
  const upper = street.trim().toUpperCase();
  const left = after.length && town && upper.endsWith(` ${town}`) ? upper.slice(0, -town.length - 1) : null;
  return left && parse(left)?.name ? left : row.SITUS_ADDRESS;
}

function fromRow(row, fips, county) {
  const unit = realUnit(row.SUB_ADDRESS);
  const parsed = parse(streetLine(row), unit);
  const parcel = word(row.PARCEL_ID_NR) || word(row.ORIG_PARCEL_ID);
  if (!parsed || !parcel) return null;
  const code = Number(String(row.LANDUSE_CD ?? '').trim().slice(0, 2));
  let [kind, homeType, useWord] = USES[code] || ['other', null, null];
  // A unit number on a single-family code is a condominium's unit, owned on its own.
  if (parsed.unit && kind === 'property') [kind, homeType] = ['unit', 'condo'];
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', onRecord(row.SITUS_ADDRESS, unit));
  put(facts, 'land_use', useWord);
  put(facts, 'county_use_code', word(row.LANDUSE_CD));
  const land = positive(row.VALUE_LAND);
  const building = positive(row.VALUE_BLDG);
  if (land || building) facts.market_value = (land || 0) + (building || 0);
  put(facts, 'market_land_value', land);
  put(facts, 'market_building_value', building);
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.SITUS_CITY_NM) || '').toUpperCase(), zip: zipCode(row.SITUS_ZIP_NR) }, facts };
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

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const about = await (await fetch(ITEM, { signal: AbortSignal.timeout(60000) })).json();
  if (!about.modified) throw new Error('The Geoportal\'s item no longer says when it changed');
  const asOf = new Date(about.modified).toISOString().slice(0, 10);
  const dir = path.join(work, 'wa-parcels');
  const zip = path.join(dir, 'parcels.zip');
  download(FILE, zip);
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { maxBuffer: 1e9 });
  // The file's members come out read-only, and then nothing can remove them.
  execFileSync('chmod', ['-R', 'u+w', dir]);
  fs.rmSync(zip, { force: true });
  const gdb = geodatabase(dir);
  if (!gdb) throw new Error('The Geoportal\'s file has no geodatabase');
  const table = [...catalog(gdb)].find(([name, base]) => !name.startsWith('GDB_') && fieldNames(base).includes('SITUS_ADDRESS'));
  if (!table) throw new Error('The Geoportal\'s geodatabase has no parcel table');
  const counties = new Map();
  for (const row of rows(table[1], COLUMNS)) {
    // Asotin's rows have no FIPS_NR and its county number in COUNTY_NM (November 7).
    const named = String(row.COUNTY_NM ?? '').trim();
    const code = String(row.FIPS_NR ?? '').trim() || (/^\d{1,3}$/.test(named) ? named : '');
    const fips = `53${code.slice(-3).padStart(3, '0')}`;
    if (!/^53\d{3}$/.test(fips) || SKIPPED.has(fips) || (only.length && !only.includes(fips))) continue;
    if (!NAMES[fips.slice(2)]) continue;
    if (!counties.has(fips)) counties.set(fips, { name: `${NAMES[fips.slice(2)]} County`, records: new Map(), noAddress: 0 });
    const county = counties.get(fips);
    const record = fromRow(row, fips, county.name);
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
      fips, state: 'WA', name, publisher: `${name} Assessor, through the Washington State Geoportal (WaTech)`, dataset: 'Current Parcels', method: 'state', source: 'wa-parcels', title: 'State records', as_of: asOf, stale_after_days: 450, records,
    };
    counties.set(fips, null);
  }
}

module.exports = { build };

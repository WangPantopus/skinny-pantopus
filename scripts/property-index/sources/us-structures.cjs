'use strict';
// The national floor's structures, one state at a time: FEMA's USA Structures (footprints with an address and a use,
// from Oak Ridge National Laboratory; federal work) joined by location to the Army Corps of Engineers' National Structure
// Inventory (modeled size and stories, and the census block). Modeled, not observed: these go in their own index and
// slot and never in a record field. FEMA's address column is what the lookup keys on; a structure without one has no
// way to be found and isn't kept.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { parse, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { download } = require('../lib/tables.cjs');
const { catalog, fieldNames, rows } = require('../lib/fgdb.cjs');
const { log } = require('../lib/log.cjs');

const FEMA = 'https://fema-femadata.s3.us-east-1.amazonaws.com/Partners/ORNL/USA_Structures';
// FEMA's download page, read November 6, 2026. It changes yearly; a missing file stops the build.
const STATES = {
  AL: ['01', 'Alabama/Deliverable20250606AL.zip'], AK: ['02', 'Alaska/AK_Structures_20260913.zip'], AZ: ['04', 'Arizona/Deliverable20250913AZ.zip'], AR: ['05', 'Arkansas/Deliverable20250913AR.zip'],
  CA: ['06', 'California/Deliverable20250913CA.zip'], CO: ['08', 'Colorado/Deliverable20250913CO.zip'], CT: ['09', 'Connecticut/CT_Structures_20260913.zip'], DE: ['10', 'Delaware/DE_Structures_20260913.zip'],
  DC: ['11', 'District+of+Columbia/DC_Structures_20260913.zip'], FL: ['12', 'Florida/Deliverable20250606FL.zip'], GA: ['13', 'Georgia/Deliverable20250606GA.zip'], HI: ['15', 'Hawaii/HI_Structures_20260913.zip'],
  ID: ['16', 'Idaho/Deliverable20250913ID.zip'], IL: ['17', 'Illinois/Deliverable20250913IL.zip'], IN: ['18', 'Indiana/Deliverable20250913IN.zip'], IA: ['19', 'Iowa/IA_Structures_20260913.zip'],
  KS: ['20', 'Kansas/KS_Structures_20260913.zip'], KY: ['21', 'Kentucky/KY_Structures_20260913.zip'], LA: ['22', 'Louisiana/Deliverable20250606LA.zip'], ME: ['23', 'Maine/ME_Structures_20260913.zip'],
  MD: ['24', 'Maryland/Deliverable20250913MD.zip'], MA: ['25', 'Massachusetts/Deliverable20250913MA.zip'], MI: ['26', 'Michigan/MI_Structures_20260913.zip'], MN: ['27', 'Minnesota/MN_Structures_20260913.zip'],
  MS: ['28', 'Mississippi/Deliverable20250606MS.zip'], MO: ['29', 'Missouri/Deliverable20250913MO.zip'], MT: ['30', 'Montana/MT_Structures_20260913.zip'], NE: ['31', 'Nebraska/NE_Structures_20260913.zip'],
  NV: ['32', 'Nevada/Deliverable20250913NV.zip'], NH: ['33', 'New+Hampshire/NH_Structures_20260913.zip'], NJ: ['34', 'New+Jersey/Deliverable20250913NJ.zip'], NM: ['35', 'New+Mexico/NM_Structures_20260913.zip'],
  NY: ['36', 'New+York/NY_Structures_20260913.zip'], NC: ['37', 'North+Carolina/Deliverable20250606NC.zip'], ND: ['38', 'North+Dakota/ND_Structures_20260913.zip'], OH: ['39', 'Ohio/Deliverable20250913OH.zip'],
  OK: ['40', 'Oklahoma/Deliverable20250913OK.zip'], OR: ['41', 'Oregon/OR_Structures_20260913.zip'], PA: ['42', 'Pennsylvania/Deliverable20250913PA.zip'], RI: ['44', 'Rhode+Island/RI_Structures_20260913.zip'],
  SC: ['45', 'South+Carolina/Deliverable20250606SC.zip'], SD: ['46', 'South+Dakota/SD_Structures_20260913.zip'], TN: ['47', 'Tennessee/TN_Structures_20260913.zip'], TX: ['48', 'Texas/Deliverable20250606TX.zip'],
  UT: ['49', 'Utah/UT_Structures_20260913.zip'], VT: ['50', 'Vermont/VT_Structures_20260913.zip'], VA: ['51', 'Virginia/Deliverable20250606VA.zip'], WA: ['53', 'Washington/WA_Structures_20260913.zip'],
  WV: ['54', 'West+Virginia/WV_Structures_20260913.zip'], WI: ['55', 'Wisconsin/WI_Structures_20260913.zip'], WY: ['56', 'Wyoming/WY_Structures_20260913.zip'],
};
const NSI_VERSION = '2022';
const nsiUrl = (stateFips) => `https://nsi.sec.usace.army.mil/downloads/nsi_${NSI_VERSION}/nsi_${NSI_VERSION}_${stateFips}.gpkg.zip`;
const FEMA_COLUMNS = ['OCC_CLS', 'PRIM_OCC', 'PROP_ADDR', 'PROP_CITY', 'PROP_ZIP', 'SQFEET', 'FIPS', 'LONGITUDE', 'LATITUDE', 'PROD_DATE'];
const HOMES = { 'Single Family Dwelling': 'Single family', 'Multi - Family Dwelling': 'Multifamily', 'Manufactured Home': 'Manufactured home', Unclassified: null };
const NEAREST_METERS = 30;
const CELLS_PER_DEGREE = 2000;
const METERS_PER_DEGREE = 111320;

/** The inventory's residential structures in a grid, for finding the one a footprint sits on. */
function readInventory(file) {
  const database = new DatabaseSync(file, { readOnly: true });
  const [{ n: count }] = database.prepare("SELECT count(*) AS n FROM nsi WHERE st_damcat = 'RES'").all();
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  const areas = new Float32Array(count);
  const stories = new Float32Array(count);
  const blocks = new Array(count);
  const grid = new Map();
  let i = 0;
  for (const row of database.prepare("SELECT x, y, sqft, num_story, cbfips FROM nsi WHERE st_damcat = 'RES'").iterate()) {
    xs[i] = row.x;
    ys[i] = row.y;
    areas[i] = row.sqft;
    stories[i] = row.num_story;
    blocks[i] = row.cbfips ? String(row.cbfips).slice(0, 12) : '';
    const cell = Math.round(row.y * CELLS_PER_DEGREE) * 4000000 + Math.round(row.x * CELLS_PER_DEGREE);
    const held = grid.get(cell);
    if (held) held.push(i);
    else grid.set(cell, [i]);
    i += 1;
  }
  database.close();
  log(`Inventory: ${count} residential structures`);
  return { xs, ys, areas, stories, blocks, grid };
}

function nearest(inventory, x, y) {
  const row = Math.round(y * CELLS_PER_DEGREE);
  const column = Math.round(x * CELLS_PER_DEGREE);
  const cosine = Math.cos((y * Math.PI) / 180);
  let best = -1;
  let bestMeters = NEAREST_METERS;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (const i of inventory.grid.get((row + dy) * 4000000 + column + dx) || []) {
        const meters = Math.hypot((inventory.xs[i] - x) * cosine, inventory.ys[i] - y) * METERS_PER_DEGREE;
        if (meters < bestMeters) {
          best = i;
          bestMeters = meters;
        }
      }
    }
  }
  return best;
}

const round = (value, step) => Math.round(value / step) * step;

async function* buildState({ work, state }) {
  const entry = STATES[state];
  if (!entry) throw new Error(`No files listed for ${state}`);
  const [stateFips, femaPath] = entry;
  const dir = path.join(work, 'us-structures', state);
  const femaZip = path.join(dir, 'fema.zip');
  const nsiZip = path.join(dir, 'nsi.zip');
  download(`${FEMA}/${femaPath}`, femaZip);
  download(nsiUrl(stateFips), nsiZip);
  const femaDir = path.join(dir, 'fema');
  const nsiDir = path.join(dir, 'nsi');
  fs.mkdirSync(femaDir, { recursive: true });
  fs.mkdirSync(nsiDir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', femaZip, '-d', femaDir], { maxBuffer: 1e9 });
  execFileSync('unzip', ['-q', '-o', nsiZip, '-d', nsiDir], { maxBuffer: 1e9 });
  fs.rmSync(femaZip, { force: true });
  fs.rmSync(nsiZip, { force: true });
  const inventory = readInventory(path.join(nsiDir, fs.readdirSync(nsiDir).find((name) => name.endsWith('.gpkg'))));
  fs.rmSync(nsiDir, { recursive: true, force: true });

  const find = (folder) => {
    for (const name of fs.readdirSync(folder, { withFileTypes: true })) {
      if (name.isDirectory() && name.name.endsWith('.gdb')) return path.join(folder, name.name);
      if (name.isDirectory()) {
        const found = find(path.join(folder, name.name));
        if (found) return found;
      }
    }
    return null;
  };
  const gdb = find(femaDir);
  if (!gdb) throw new Error(`${state}'s file has no geodatabase`);
  const table = [...catalog(gdb)].find(([name, base]) => !name.startsWith('GDB_') && fieldNames(base).includes('PROP_ADDR'));
  if (!table) throw new Error(`${state}'s geodatabase has no structures table`);

  const counties = new Map();
  let read = 0;
  let notHomes = 0;
  let noAddress = 0;
  let joined = 0;
  let newest = 0;
  for (const row of rows(table[1], FEMA_COLUMNS)) {
    read += 1;
    const residential = row.OCC_CLS === 'Residential' || row.OCC_CLS === 'Unclassified';
    if (!residential) {
      notHomes += 1;
      continue;
    }
    const parsed = row.PROP_ADDR ? parse(row.PROP_ADDR) : null;
    const fips = String(row.FIPS ?? '');
    if (!parsed || !/^\d{5}$/.test(fips)) {
      noAddress += 1;
      continue;
    }
    if (row.PROD_DATE > newest) newest = row.PROD_DATE;
    const address = { ...parsed, unit: '', building: '', city: String(row.PROP_CITY ?? '').toUpperCase(), zip: zip5(row.PROP_ZIP) };
    const key = [address.number, address.pre, address.name, address.suffix, address.post, address.zip].join('|');
    if (!counties.has(fips)) counties.set(fips, new Map());
    const held = counties.get(fips);
    const was = held.get(key);
    if (was) {
      was.facts.structures_at_address += 1;
      if (row.SQFEET <= was.footprint) continue;
    }
    const facts = { footprint_sqft: round(row.SQFEET, 10), structures_at_address: (was?.facts.structures_at_address) || 1 };
    const use = HOMES[row.PRIM_OCC];
    if (use) facts.building_use = use;
    const match = nearest(inventory, row.LONGITUDE, row.LATITUDE);
    if (match >= 0) {
      joined += 1;
      if (inventory.areas[match] > 0) facts.modeled_sqft = round(inventory.areas[match], 50);
      if (inventory.stories[match] > 0) facts.modeled_stories = inventory.stories[match];
      if (inventory.blocks[match]) facts.block_group = inventory.blocks[match];
    }
    held.set(key, {
      id: `pp:property:${fips}:${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`, kind: 'property', home_type: null, address, facts, footprint: row.SQFEET,
    });
  }
  fs.rmSync(femaDir, { recursive: true, force: true });
  log(`${state}: ${read} structures, ${notHomes} not homes, ${noAddress} without a readable address, ${joined} joined to the inventory`);
  const asOf = new Date(newest || Date.now()).toISOString().slice(0, 10);
  for (const [fips, held] of [...counties].sort()) {
    const records = [...held.values()];
    for (const record of records) delete record.footprint;
    yield {
      fips, state, name: fips, publisher: 'FEMA, Oak Ridge National Laboratory and the U.S. Army Corps of Engineers', dataset: `USA Structures and National Structure Inventory ${NSI_VERSION}`, method: 'estimate', source: 'us-structures', title: 'Estimate', as_of: asOf, stale_after_days: 1500, records,
    };
    counties.set(fips, null);
  }
}

module.exports = { buildState, STATES };

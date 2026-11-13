'use strict';
// St. Johns County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors and heated area from
// the Property Appraiser's "CAMA Data Sup", the free daily download on its Data and Forms page ("Free download or $10 per
// CD"; no other terms stated). It is an Access database (lib/mdb.cjs); only its building and building-count tables are
// opened, never the sales table's grantor and grantee. Only parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { download, zipDates } = require('../lib/tables.cjs');
const { tableRows } = require('../lib/mdb.cjs');
const { holdFacts } = require('../lib/held.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12109';
const COUNTY = 'St. Johns County';
const FILE = 'https://sftp.sjcpa.us/CAMADataSup.zip';
const DATABASE = 'CAMADataSup.mdb';
// Improvement types that are one home (the database's BldViewLU_impr_tp): houses, townhouses, mobile and manufactured homes,
// condos, co-ops. Timeshares, day cares, apartments, duplexes and condo garages or boat slips aren't.
const DWELLING = new Set(['0100', '0101', '0102', '0130', '0131', '0201', '0202', '0203', '0204', '0210', '0400', '0500', '0801']);

async function* build({ work, today }) {
  const zip = path.join(work, 'fl-st-johns', 'cama-sup.zip');
  download(FILE, zip);
  const dir = path.join(work, 'fl-st-johns', 'db');
  execFileSync('unzip', ['-o', '-q', zip, DATABASE, '-d', dir]);
  const file = path.join(dir, DATABASE);
  const buildings = new Map();
  for (const row of tableRows(file, 'BldView', ['strap', 'num', 'impr_tp', 'heat_ar', 'status_cd', 'qa_dscr'])) {
    if (!DWELLING.has(String(row.impr_tp || '').trim()) || row.status_cd) continue;
    buildings.set(`${row.strap}|${row.num}`, { parcel: String(row.strap).trim(), heated: row.heat_ar, quality: String(row.qa_dscr || '').replace(/\s+/g, ' ').trim() || null, counts: {} });
  }
  // One line per kind of count: BR bedrooms, BT baths (a half bath as .5), SH floors. A kind said twice says nothing.
  for (const row of tableRows(file, 'StructElemViewUnit', ['strap', 'bld_num', 'tp', 'uts'])) {
    const building = buildings.get(`${row.strap}|${row.bld_num}`);
    const kind = String(row.tp || '').trim();
    if (building) building.counts[kind] = kind in building.counts ? null : row.uts;
  }
  const dwellings = new Map();
  for (const { parcel, heated, quality, counts } of buildings.values()) {
    const { BR: beds, BT: baths, SH: floors } = counts;
    const facts = {
      bedrooms: beds > 0 && beds <= 15 && Number.isInteger(beds) ? beds : null,
      ...bathFacts(baths, 20),
      stories: floors >= 1 && floors <= 6 && (floors * 2) % 1 === 0 ? floors : null,
      living_sqft: heated > 0 && heated < 30000 ? Math.round(heated) : null,
      // Read since the county went live (held below): the building's quality in the Appraiser's own words.
      quality,
    };
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${buildings.size} dwelling buildings on ${dwellings.size} parcels in the Property Appraiser's database`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  // Off the county's screens until its new_columns switch is on (lib/held.cjs).
  holdFacts(roll.records, ['quality']);
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the St. Johns County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(zipDates(zip).get(DATABASE))} building data`,
    method: 'county',
    source: 'fl-st-johns',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    file: FILE,
    facts: { bedrooms: 'StructElemViewUnit BR', bathrooms: 'StructElemViewUnit BT', stories: 'StructElemViewUnit SH', living_sqft: 'BldView heat_ar' },
  },
};

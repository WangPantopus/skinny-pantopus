'use strict';
// Osceola County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors and heated area from the
// Property Appraiser's certified roll data, the free yearly download on its Data page, which states no limit on use. Only
// the two building tables are opened; the owner, mailing, grantor, grantee and exemption tables never are. Every building
// row says it isn't confidential, and only parcels already on the roll (protected people removed) take a fact.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { download, zipTable, zipMembers, USER_AGENT } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12097';
const COUNTY = 'Osceola County';
const PAGE = 'https://www.property-appraiser.org/data/';
// Improvement types (the file's lu_impr table): 1xx houses, 2xx mobile homes, 3xx multi-family; 4xx and up aren't homes.
const DWELLING = /^[123]\d\d$/;

/** The newest "Certified Final Roll Data" file the Data page links to. */
function newestFile() {
  const page = execFileSync('curl', ['-fsSL', '-A', USER_AGENT, '--max-time', '60', '--retry', '3', PAGE], { encoding: 'utf8', maxBuffer: 1 << 25 });
  const links = [...page.matchAll(/href="([^"]*?(\d{4})_CertifiedData_OCPA\.zip[^"]*)"/g)]
    .map(([, href, year]) => ({ url: href.replace(/&#0?38;|&amp;/g, '&'), year: Number(year) }))
    .sort((a, b) => b.year - a.year);
  if (!links.length) throw new Error('The Data page no longer links a certified roll file');
  return links[0];
}

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};

async function* build({ work, today }) {
  const { url, year } = newestFile();
  const zip = path.join(work, 'fl-osceola', `${year}.zip`);
  download(url, zip);
  const members = zipMembers(zip);
  const member = (name) => {
    const found = members.find((entry) => entry.toLowerCase().endsWith(`/${name}.csv`));
    if (!found) throw new Error(`The file has no ${name} table`);
    return found;
  };
  const buildings = new Map();
  for await (const row of zipTable(zip, member('vw_mdbld'), ['strap', 'bld_num', 'impr_tp', 'heat_ar', 'conf_flg'], { delimiter: '|', quoted: false })) {
    if (row.conf_flg !== 'N' || !DWELLING.test(row.impr_tp)) continue;
    buildings.set(`${row.strap}|${row.bld_num}`, { parcel: row.strap, heated: positive(row.heat_ar), units: {} });
  }
  // One line per kind of count: STRY floors, LVUT living units, BDRM bedrooms, BATH full baths, HLFB half baths. A kind said twice says nothing.
  for await (const row of zipTable(zip, member('vw_mdbld_ut_se'), ['strap', 'bld_num', 'tp', 'uts', 'conf_flg'], { delimiter: '|', quoted: false })) {
    const building = buildings.get(`${row.strap}|${row.bld_num}`);
    if (!building || row.conf_flg !== 'N') continue;
    building.units[row.tp] = row.tp in building.units ? null : number(row.uts);
  }
  const dwellings = new Map();
  for (const { parcel, heated, units } of buildings.values()) {
    // A building with more than one living unit is a duplex or more: its rooms are no one home's.
    if (units.LVUT > 1 || !(units.LVUT >= 1 || units.BDRM > 0)) continue;
    const full = count(units.BATH, 20);
    const half = count(units.HLFB, 10);
    const facts = {
      bedrooms: count(units.BDRM, 15),
      ...(full ? bathFacts(full + (half || 0) * 0.5, 30) : {}),
      ...(full && half ? { half_baths: half } : {}),
      stories: count(units.STRY, 6),
      living_sqft: heated && heated < 30000 ? heated : null,
    };
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${buildings.size} dwelling buildings on ${dwellings.size} parcels in the Property Appraiser's ${year} file`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Osceola County Property Appraiser',
    dataset: `${roll.dataset} and ${year} certified building data`,
    method: 'county',
    source: 'fl-osceola',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    page: PAGE,
    facts: { bedrooms: 'vw_mdBld_ut_se BDRM', full_baths: 'vw_mdBld_ut_se BATH', half_baths: 'vw_mdBld_ut_se HLFB', bathrooms: 'BATH + HLFB / 2', stories: 'vw_mdBld_ut_se STRY', living_sqft: 'vw_mdBld heat_ar' },
  },
};

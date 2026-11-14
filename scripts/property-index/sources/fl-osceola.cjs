'use strict';
// Osceola County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors and heated area from the
// Property Appraiser's certified roll data, the free yearly download on its Data page, which states no limit on use. Only
// the two building tables are opened; the owner, mailing, grantor, grantee and exemption tables never are. Every building
// row says it isn't confidential, and only parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { download, zipTable, zipMembers } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12097';
const COUNTY = 'Osceola County';
const PAGE = 'https://www.property-appraiser.org/data/';
// The file the Data page links as "Certified Final Roll Data", at the link the Appraiser publishes it under. The page itself
// refuses requests from GitHub's runners, so it is never read by the build: when the Appraiser certifies the next year's
// roll each October, the new link from the page replaces this one.
const FILE = { year: 2026, url: 'https://www.dropbox.com/scl/fi/suhvqwjpait10d3u9oe1n/2026_CertifiedData_OCPA.zip?rlkey=b1fhrnljutw4hass8obqhzuv6&dl=1' };
// Improvement types (the file's lu_impr table): 1xx houses, 2xx mobile homes, 3xx multi-family; 4xx and up aren't homes.
const DWELLING = /^[123]\d\d$/;

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};

async function* build({ work, today }) {
  const { url, year } = FILE;
  // Florida certifies a roll in October: past then, a newer certified file is likely on the Data page.
  const certified = today.getMonth() >= 10 ? today.getFullYear() : today.getFullYear() - 1;
  if (year < certified) console.log(`::warning::Osceola's certified file is ${year}'s; the Data page may list ${certified}'s`);
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
      // The file's own counts (bathFacts gives the total only): a total of 3 from 2 full and 2 half baths is still 2 full baths.
      ...(full ? { full_baths: full, ...(half ? { half_baths: half } : {}) } : {}),
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

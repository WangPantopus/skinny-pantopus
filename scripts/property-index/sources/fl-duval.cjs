'use strict';
// Duval County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors and heated area from the
// Property Appraiser's own real estate roll file, the free pipe-delimited download on its Data Offerings page (the certified
// roll after October, the monthly uncertified files before). No terms limit using the data. The file holds several kinds of
// lines a parcel; only the building lines (00005), their counted elements (00007: bedrooms, baths, stories) and condominium
// unit lines (00009) are read. The parcel, owner, mailing, exemption and sales lines never are. Only parcels already on the
// roll (protected people removed) take a fact.

const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { download, zipDates, zipMembers, streamLines, USER_AGENT } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { keepSplit } = require('../lib/held.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12031';
const COUNTY = 'Duval County';
const SITE = 'https://www.jacksonville.gov';
const PAGE = `${SITE}/departments/property-appraiser/data-offerings`;
// "DCPAO-REAL-ESTATE-PIPE-DELIMITED-TEXT-CERTIFIED-AS-OF-10-13-26.zip": the real estate file, not the tangible or sales ones.
const LINK = /href="([^"]*\/DCPAO-REAL-ESTATE-PIPE-DELIMITED-TEXT-[^"]*?AS-OF-(\d{2})-(\d{2})-(\d{4}|\d{2})[^"]*\.zip[^"]*)"/gi;
// Building types (the file's BUSE codes) that are one home: houses of every style and class, townhouses, mobile homes,
// condominium units, cooperative apartments. A garage apartment or rooming house is another dwelling, not the home.
const DWELLING = new Set(['0101', '0102', '0103', '0104', '0105', '0108', '0111', '0201', '0202', '0401', '0501']);
const CONDO_UNIT = new Set(['0401', '0501']);

/** The newest real estate file the page links, with the day it's "as of". */
function newestFile(page) {
  const files = [...page.matchAll(LINK)].map(([, href, month, day, year]) => ({
    url: new URL(href.replace(/&amp;/g, '&'), SITE).href,
    asOf: `${year.length === 2 ? `20${year}` : year}-${month}-${day}`,
  }));
  if (!files.length) throw new Error('The Data Offerings page no longer links a real estate file');
  return files.sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
}

async function* lines(zip, member) {
  const unzip = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('latin1');
  for await (const line of streamLines(unzip.stdout)) {
    const kind = line.slice(0, 5);
    if (kind === '00005' || kind === '00007' || kind === '00009') yield line.split('|').map((cell) => cell.trim());
  }
}

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};
// A count the file gives twice for one building says nothing.
const once = (building, fact, value) => {
  building[fact] = fact in building ? null : value;
};

async function* build({ work, today }) {
  const page = execFileSync('curl', ['-fsSL', '-A', USER_AGENT, '--max-time', '60', '--retry', '3', PAGE], { encoding: 'utf8', maxBuffer: 1 << 25 });
  const { url, asOf } = newestFile(page);
  const zip = path.join(work, 'fl-duval', `${asOf}.zip`);
  download(url, zip);
  const [member] = zipMembers(zip).filter((name) => /\.txt$/i.test(name));
  if (!member) throw new Error('The real estate file has no table');
  const buildings = new Map();
  const counted = new Map();
  const units = new Map();
  for await (const cells of lines(zip, member)) {
    const at = `${cells[1]}|${cells[2]}`;
    if (cells[0] === '00005') {
      if (cells.length !== 13) throw new Error('The building lines no longer have 13 fields');
      if (!DWELLING.has(cells[3])) continue;
      const heated = positive(cells[12]);
      buildings.set(at, { parcel: cells[1], type: cells[3], heated: heated && heated < 30000 ? heated : null });
    } else if (cells[0] === '00007') {
      if (cells.length !== 6) throw new Error('The counted element lines no longer have 6 fields');
      if (!counted.has(at)) counted.set(at, {});
      const building = counted.get(at);
      const value = number(cells[5]);
      if (cells[3] === 'BR') once(building, 'bedrooms', count(cells[5], 15));
      else if (cells[3] === 'BT') once(building, 'baths', value > 0 && value <= 20 ? value : null);
      else if (cells[3] === 'SH') once(building, 'stories', value >= 1 && value <= 6 && (value * 2) % 1 === 0 ? value : null);
    } else if (cells[0] === '00009') {
      if (cells.length !== 12) throw new Error('The condominium unit lines no longer have 12 fields');
      // The unit's model: its bedrooms and baths as the office's condominium table states them.
      const baths = number(cells[9]);
      units.set(at, units.has(at) ? null : { bedrooms: count(cells[8], 15), baths: baths > 0 && baths <= 20 ? baths : null });
    }
  }
  const dwellings = new Map();
  let fromUnits = 0;
  for (const [at, { parcel, type, heated }] of buildings) {
    const own = counted.get(at) || {};
    // A condominium unit's rooms are on its unit line; a house's on its building's counted elements.
    const unit = CONDO_UNIT.has(type) && own.bedrooms === undefined ? units.get(at) : null;
    if (unit?.bedrooms || unit?.baths) fromUnits += 1;
    const baths = unit ? unit.baths : own.baths;
    const facts = { bedrooms: (unit ? unit.bedrooms : own.bedrooms) ?? null, ...bathFacts(baths, 20), stories: own.stories ?? null, living_sqft: heated };
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${buildings.size} dwellings on ${dwellings.size} parcels in the Property Appraiser's real estate file (${fromUnits} condominium units' rooms from their unit lines)`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  // Live: its page keeps the full and half baths it showed until its bath_totals switch is on (lib/held.cjs keepSplit).
  log(`${COUNTY}: ${keepSplit(roll.records)} homes keep the full and half baths their bath total was split into, until the county's bath_totals switch is on`);
  const day = zipDates(zip).get(member);
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Duval County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(asOf || day)} real estate file`,
    method: 'county',
    source: 'fl-duval',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    page: PAGE,
    facts: {
      bedrooms: '00007 BR units (condominium units: 00009 BEDS)', bathrooms: '00007 BT units (condominium units: 00009 BATHS)', full_baths: 'whole baths of the total',
      half_baths: 'a half in the total', stories: '00007 SH units', living_sqft: '00005 HEAT_AR',
    },
  },
};

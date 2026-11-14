'use strict';
// Hernando County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, bathrooms and floors from the Property
// Appraiser's Comprehensive CAMA Dataset, the free files its Downloads page posts and updates weekly (no terms stated). The
// Structures file gives each building's "Number of Bedrooms" and "Number of Bathrooms", a whole number: the county keeps no
// half baths, so the count is said as the county states it and never split into full and half. Its buildings name a parcel
// by the office's own key; the Parcels file's key and parcel number columns turn that into the roll's parcel number. The
// Parcels file's other columns (owner, mailing, values) are in the same fixed-width lines and are never cut out of them.
// Only parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { download, zipDates, zipMembers, streamLines } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12053';
const COUNTY = 'Hernando County';
const SITE = 'https://hernandocountypa-florida.us';
const PAGE = `${SITE}/Downloads`;
const FILES = { parcels: `${SITE}/download/PAPAR.ZIP`, structures: `${SITE}/download/STRU.ZIP` };
// The record layouts ("CCDS - PAPAR File Record Layout", "CCDS - STRU File Record Layout"): [start, end) of each field read.
const PARCEL = { length: 1339, key: [9, 17], number: [25, 50] };
const STRUCTURE = { length: 695, key: [0, 8], type: [8, 10], bedrooms: [661, 663], bathrooms: [663, 665], stories: [690, 693] };
// Structure types that are one home: a single family residence, a manufactured home, a villa, a condominium unit.
const DWELLING = new Set(['01', '02', '13', '15']);

async function* lines(zip) {
  const [member] = zipMembers(zip).filter((name) => /\.txt$/i.test(name));
  if (!member) throw new Error(`${path.basename(zip)} has no table`);
  const unzip = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('latin1');
  yield* streamLines(unzip.stdout);
}
const cut = (line, [start, end]) => line.slice(start, end).trim();
const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};

async function* build({ work, today }) {
  const zips = Object.fromEntries(Object.keys(FILES).map((name) => [name, path.join(work, 'fl-hernando', `${name}.zip`)]));
  for (const [name, url] of Object.entries(FILES)) download(url, zips[name]);
  const parcels = new Map();
  for await (const line of lines(zips.parcels)) {
    if (line.length !== PARCEL.length) continue;
    const number_ = cut(line, PARCEL.number);
    if (number_) parcels.set(cut(line, PARCEL.key), number_);
  }
  const dwellings = new Map();
  let homes = 0;
  let unread = 0;
  for await (const line of lines(zips.structures)) {
    // A line longer than the layout has shifted fields (a character the export widened): nothing in it is read.
    if (line.length !== STRUCTURE.length) {
      unread += 1;
      continue;
    }
    if (!DWELLING.has(cut(line, STRUCTURE.type))) continue;
    const parcel = parcels.get(cut(line, STRUCTURE.key));
    if (!parcel) continue;
    homes += 1;
    const stories = number(cut(line, STRUCTURE.stories));
    const facts = {
      bedrooms: count(cut(line, STRUCTURE.bedrooms), 15),
      bathrooms: count(cut(line, STRUCTURE.bathrooms), 12),
      stories: stories >= 1 && stories <= 6 ? stories : null,
    };
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${homes} dwellings on ${dwellings.size} parcels in the Property Appraiser's structures file (${unread} lines off the layout left unread)`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Hernando County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf([...zipDates(zips.structures).values()][0])} CAMA data`,
    method: 'county',
    source: 'fl-hernando',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    page: PAGE,
    facts: { bedrooms: 'STRU Number of Bedrooms', bathrooms: 'STRU Number of Bathrooms (whole baths as the county counts them)', stories: 'STRU Stories' },
  },
};

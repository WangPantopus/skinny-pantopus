'use strict';
// The area's price change: the Federal Housing Finance Agency's annual House Price Index (all-transactions, not seasonally
// adjusted) for five-digit ZIP codes and counties. Public federal data, kept with its name. A price-change index built from
// appraisals and sales behind Fannie Mae and Freddie Mac mortgages: never a home's value and never a median sale price, and
// FHFA calls these annual series developmental. FHFA leaves a thin area's year blank, and a blank stays blank.
//
// A ZIP with no number of its own uses its county's, labeled as the county's, through the Census Bureau's ZIP-to-county file.

const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { download } = require('../lib/tables.cjs');
const { largestCountiesByZip } = require('../lib/zcta.cjs');
const { stateOfCounty } = require('../../../backend/services/propertyRecords/addressKey');
const { log } = require('../lib/log.cjs');

const BASE = 'https://www.fhfa.gov/hpi/download/annual';
const FILES = {
  zip: { file: 'hpi_at_zip5.xlsx', area: 'Five-Digit ZIP Code', pad: 5 },
  county: { file: 'hpi_at_county.xlsx', area: 'FIPS code', pad: 5 },
};
const YEAR = 'Year';
const CHANGE = 'Annual Change (%)';
const CELL = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/g;
const VALUE = /<v>([^<]*)<\/v>/;
const STRING = /<si>(.*?)<\/si>/gs;
const TEXT = /<t[^>]*>([^<]*)<\/t>/g;
// One year's swing past this is a thin area's noise, and its county says more. FHFA's middle 90% runs -6% to +15%.
const LARGEST_CHANGE_PCT = 40;
// So is a ZIP this far from its own county (measured on the 2025 file: 3.7% of ZIPs; half are within 2.6 points).
const LARGEST_GAP_FROM_COUNTY = 15;
// A new file smaller than these is a changed or broken file: nothing is published and last year's stays.
const MIN_ZIPS = 10000;
const MIN_COUNTIES = 2000;

function sharedStrings(xlsx) {
  const xml = execFileSync('unzip', ['-p', xlsx, 'xl/sharedStrings.xml'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return [...xml.matchAll(STRING)].map(([, item]) => [...item.matchAll(TEXT)].map(([, text]) => text).join(''));
}

/** Rows of a workbook's first sheet as { column letter: text }, without holding the sheet in memory. */
async function* sheetRows(xlsx, strings) {
  const unzip = spawn('unzip', ['-p', xlsx, 'xl/worksheets/sheet1.xml'], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('utf8');
  let held = '';
  for await (const chunk of unzip.stdout) {
    held += chunk;
    let end = held.indexOf('</row>');
    while (end >= 0) {
      const row = {};
      for (const [, column, attributes, inner] of held.slice(0, end).matchAll(CELL)) {
        const value = inner ? VALUE.exec(inner)?.[1] : undefined;
        if (value !== undefined) row[column] = /t="s"/.test(attributes) ? strings[Number(value)] : value;
      }
      yield row;
      held = held.slice(end + 6);
      end = held.indexOf('</row>');
    }
  }
}

/** The last year most areas have a number for and each area's number, with the years before it: { year, asOf, changes: Map(area -> pct), byYear }. */
async function readIndex(work, { file, area, pad }) {
  const xlsx = path.join(work, 'us-fhfa', file);
  download(`${BASE}/${file}`, xlsx);
  const strings = sharedStrings(xlsx);
  const updated = strings.map((text) => /^Last updated: (.+?)\.?$/.exec(text.trim())).find(Boolean);
  const asOf = updated ? new Date(`${updated[1]} 12:00 UTC`).toISOString().slice(0, 10) : null;
  let columns = null;
  const byYear = new Map();
  for await (const row of sheetRows(xlsx, strings)) {
    if (!columns) {
      const names = Object.entries(row).map(([column, text]) => [String(text).trim(), column]);
      if (names.some(([name]) => name === area)) {
        columns = Object.fromEntries(names);
        if (!columns[YEAR] || !columns[CHANGE]) throw new Error(`The columns of ${file} changed`);
      }
    } else {
      const year = Number(row[columns[YEAR]]);
      const change = Number(row[columns[CHANGE]]);
      if (row[columns[CHANGE]] !== undefined && row[columns[CHANGE]] !== '.' && Number.isFinite(change) && year > 2000) {
        if (!byYear.has(year)) byYear.set(year, new Map());
        byYear.get(year).set(String(row[columns[area]]).padStart(pad, '0'), change);
      }
    }
  }
  if (!columns) throw new Error(`The header of ${file} changed`);
  const most = Math.max(...[...byYear.values()].map((changes) => changes.size));
  const year = Math.max(...[...byYear.entries()].filter(([, changes]) => changes.size >= most / 2).map(([found]) => found));
  log(`${file}: ${year}, ${byYear.get(year).size} areas with a number, updated ${asOf}`);
  return { year, asOf, changes: byYear.get(year), byYear };
}

const rounded = (pct) => Math.round(pct * 10) / 10;

/** One file per state: { v, year, as_of, zips: { zip: pct }, counties: { fips: pct }, zip_county: { zip: fips } }. */
async function buildAreaTrends({ work }) {
  const zips = await readIndex(work, FILES.zip);
  const counties = await readIndex(work, FILES.county);
  if (zips.year !== counties.year) throw new Error(`FHFA's ZIP and county files end in different years: ${zips.year}, ${counties.year}`);
  if (zips.changes.size < MIN_ZIPS || counties.changes.size < MIN_COUNTIES) throw new Error('FHFA\'s files are smaller than expected');
  const states = new Map();
  const stateFile = (state) => {
    if (!states.has(state)) states.set(state, { v: 1, year: zips.year, as_of: zips.asOf, zips: {}, counties: {}, zip_county: {} });
    return states.get(state);
  };
  const skipped = { noisy_counties: 0, zips_without_a_state: 0, counties_without_a_state: 0 };
  for (const [fips, change] of counties.changes) {
    const state = stateOfCounty(fips);
    if (!state) skipped.counties_without_a_state += 1;
    else if (Math.abs(change) > LARGEST_CHANGE_PCT) skipped.noisy_counties += 1;
    else stateFile(state).counties[fips] = rounded(change);
  }
  const placed = new Set();
  const noisyZips = new Set();
  // A ZIP across a state line is in both states' files, with each state's largest county.
  for (const [zip, fipsList] of largestCountiesByZip(work)) {
    const change = zips.changes.get(zip);
    const near = counties.changes.get(fipsList[0]);
    const noisy = change !== undefined && (Math.abs(change) > LARGEST_CHANGE_PCT || (near !== undefined && Math.abs(change - near) > LARGEST_GAP_FROM_COUNTY));
    if (noisy) noisyZips.add(zip);
    for (const fips of fipsList) {
      const state = stateOfCounty(fips);
      if (state) {
        if (change !== undefined && !noisy) {
          stateFile(state).zips[zip] = rounded(change);
          placed.add(zip);
        } else if (stateFile(state).counties[fips] !== undefined) {
          stateFile(state).zip_county[zip] = fips;
        }
      }
    }
  }
  for (const zip of zips.changes.keys()) if (!placed.has(zip) && !noisyZips.has(zip)) skipped.zips_without_a_state += 1;
  log(`Area trends: ${states.size} states, ${placed.size} ZIPs with their own number, ${[...states.values()].reduce((sum, file) => sum + Object.keys(file.zip_county).length, 0)} using their county's`);
  log(`Left out: ${JSON.stringify({ noisy_zips: noisyZips.size, ...skipped })}`);
  return states;
}

module.exports = { buildAreaTrends, readIndex, FILES };

#!/usr/bin/env node
// Writes backend/data/zipCounty.json: for each county, the ZIP codes whose area is mostly in it, from the Census Bureau's
// ZCTA-to-county relationship file (public domain). Only the report of unanswered lookups reads it, to say which county
// was asked for when no county answered, so a ZIP across a county line goes to the larger side. Connecticut is left out:
// its counties became planning regions after this file, so its lookups are counted under the state.
//
//   node scripts/property-index/build-zip-county.cjs --work <dir>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { download } = require('./lib/tables.cjs');

const FILE = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';
const work = process.argv[process.argv.indexOf('--work') + 1];
if (!work || !process.argv.includes('--work')) throw new Error('usage: build-zip-county.cjs --work <dir>');

const file = path.join(work, 'zcta-county.txt');
download(FILE, file);
const lines = fs.readFileSync(file, 'latin1').split('\n');
const header = lines[0].replace(/^﻿|^ï»¿/, '').trim().split('|');
const [zcta, county, land] = ['GEOID_ZCTA5_20', 'GEOID_COUNTY_20', 'AREALAND_PART'].map((name) => header.indexOf(name));
if (zcta < 0 || county < 0 || land < 0) throw new Error('The Census relationship file changed');

const largest = new Map();
for (const line of lines.slice(1)) {
  const fields = line.split('|');
  const [zip, fips, area] = [fields[zcta], fields[county], Number(fields[land])];
  if (!zip || !fips || fips.startsWith('09')) continue;
  if (!largest.has(zip) || area > largest.get(zip).area) largest.set(zip, { fips, area });
}
const byCounty = new Map();
for (const [zip, { fips }] of [...largest].sort()) {
  if (!byCounty.has(fips)) byCounty.set(fips, []);
  byCounty.get(fips).push(zip);
}
const out = Object.fromEntries([...byCounty].sort().map(([fips, zips]) => [fips, zips.join(' ')]));
fs.writeFileSync(path.join(__dirname, '../../backend/data/zipCounty.json'), `${JSON.stringify(out, null, 0)}\n`);
console.log(`${largest.size} ZIP codes in ${byCounty.size} counties`);

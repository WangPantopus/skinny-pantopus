'use strict';
// Which ZIP codes reach into a county, from the Census Bureau's ZCTA-to-county relationship file. For sources with no
// property ZIP: without this, a person's ZIP can't find their county. A list of places to look, never a fact on a record.

const fs = require('node:fs');
const path = require('node:path');
const { download } = require('./tables.cjs');

const FILE = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';

/** County FIPS to its ZIP codes, for the states asked for. */
function zipsByCounty(work, stateFips) {
  const file = path.join(work, 'census', 'zcta-county.txt');
  download(FILE, file);
  const lines = fs.readFileSync(file, 'latin1').split('\n');
  const header = lines[0].replace(/^﻿|^ï»¿/, '').trim().split('|');
  const [zcta, county, land] = ['GEOID_ZCTA5_20', 'GEOID_COUNTY_20', 'AREALAND_PART'].map((name) => header.indexOf(name));
  if (zcta < 0 || county < 0 || land < 0) throw new Error('The Census relationship file changed');
  const found = new Map();
  for (const line of lines.slice(1)) {
    const fields = line.split('|');
    const fips = fields[county];
    if (!fips || !fields[zcta] || !stateFips.includes(fips.slice(0, 2)) || Number(fields[land]) <= 0) continue;
    if (!found.has(fips)) found.set(fips, []);
    found.get(fips).push(fields[zcta]);
  }
  return found;
}

/** ZIP to its largest county by land in each state it reaches: Map(zip -> [fips, ...]), the largest first. */
function largestCountiesByZip(work) {
  const file = path.join(work, 'census', 'zcta-county.txt');
  download(FILE, file);
  const lines = fs.readFileSync(file, 'latin1').split('\n');
  const header = lines[0].replace(/^\uFEFF|^ï»¿/, '').trim().split('|');
  const [zcta, county, land] = ['GEOID_ZCTA5_20', 'GEOID_COUNTY_20', 'AREALAND_PART'].map((name) => header.indexOf(name));
  if (zcta < 0 || county < 0 || land < 0) throw new Error('The Census relationship file changed');
  const parts = new Map();
  for (const line of lines.slice(1)) {
    const fields = line.split('|');
    const zip = fields[zcta];
    const fips = fields[county];
    const area = Number(fields[land]);
    if (!zip || !fips || !(area > 0)) continue;
    if (!parts.has(zip)) parts.set(zip, []);
    parts.get(zip).push([fips, area]);
  }
  const found = new Map();
  for (const [zip, counties] of parts) {
    const largest = new Map();
    for (const [fips] of counties.sort((a, b) => b[1] - a[1])) {
      const state = fips.slice(0, 2);
      if (!largest.has(state)) largest.set(state, fips);
    }
    found.set(zip, [...largest.values()]);
  }
  return found;
}

module.exports = { zipsByCounty, largestCountiesByZip };

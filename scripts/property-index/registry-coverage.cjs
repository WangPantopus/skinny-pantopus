#!/usr/bin/env node
// The address registry's coverage, per county: what it holds against the Census Bureau's count of housing units, so a thin
// county shows as thin. Counts only, safe for a public log. Writes <dir>/coverage.csv.
//   node scripts/property-index/registry-coverage.cjs --dir <dir holding each state's coverage.json as <ST>.json>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { log } = require('./lib/log.cjs');

// The American Community Survey's estimate of housing units per county: one table, every geography, pipe-delimited.
const HOUSING_UNITS_URL = 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b25001.dat';

async function housingUnits() {
  const response = await fetch(HOUSING_UNITS_URL, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`The Census table answered ${response.status}`);
  const counties = new Map();
  for (const line of (await response.text()).split('\n')) {
    const [geo, estimate] = line.split('|');
    if (geo?.startsWith('0500000US')) counties.set(geo.slice(9), Number(estimate));
  }
  return counties;
}

async function main() {
  const dir = process.argv[process.argv.indexOf('--dir') + 1];
  const units = await housingUnits();
  const counties = fs.readdirSync(dir).filter((name) => /^[A-Z]{2}\.json$/.test(name)).flatMap((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const byFips = new Map(counties.map((county) => [county.fips, county]));
  const rows = [['fips', 'state', 'name', 'housing_units', 'records', 'addresses', 'buildings', 'units', 'homes_counted', 'share_of_housing_units', 'with_zip', 'sources', 'bytes'].join(',')];
  const states = new Map();
  for (const [fips, housing] of units) {
    const county = byFips.get(fips) || {};
    const state = county.state || fips.slice(0, 2);
    // Each unit is a home; a building's own record isn't one more, and an address with no units is one.
    const homes = (county.property || 0) + (county.unit || 0);
    const share = housing ? homes / housing : 0;
    rows.push([fips, state, JSON.stringify(county.name || ''), housing, county.records || 0, county.property || 0, county.building || 0, county.unit || 0, homes, share.toFixed(3),
      county.with_zip || 0, county.sources || 0, county.bytes || 0].join(','));
    if (!states.has(fips.slice(0, 2))) states.set(fips.slice(0, 2), { code: county.state, housing: 0, homes: 0, counties: 0, none: 0, thin: 0 });
    const total = states.get(fips.slice(0, 2));
    total.code ||= county.state;
    total.housing += housing;
    total.homes += homes;
    total.counties += 1;
    if (!homes) total.none += 1;
    else if (share < 0.5) total.thin += 1;
  }
  fs.writeFileSync(path.join(dir, 'coverage.csv'), `${rows.join('\n')}\n`);
  for (const [fips, total] of [...states].sort()) {
    log(`${total.code || fips}: ${total.homes} homes against ${total.housing} housing units (${Math.round((100 * total.homes) / (total.housing || 1))}%), ${total.counties} counties, ${total.none} with none, ${total.thin} under half`);
  }
  const homes = [...states.values()].reduce((sum, total) => sum + total.homes, 0);
  const housing = [...states.values()].reduce((sum, total) => sum + total.housing, 0);
  log(`All: ${homes} homes against ${housing} housing units (${Math.round((100 * homes) / (housing || 1))}%)`);
}

main().catch((err) => {
  console.error(`The coverage report failed: ${err.constructor === Error ? err.message : err.name}`);
  process.exit(1);
});

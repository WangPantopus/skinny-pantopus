#!/usr/bin/env node
// Could a home be estimated with less to go on? Pretends a county lacks data it really has, and scores each way against its
// real recorded sales. Measures only: nothing here reaches a screen. Prints counts and percentages, never a home.
//
//   Level 2, a county value but no public sale prices:
//     forward    the county's value moved from its date to the sale's by FHFA's county index
//     appraised  the county's value rescaled so its median meets FHFA's median purchase appraisal for the county, moved forward
//   Level 3, no county record:
//     zip        the Census median home value for the ZIP, moved forward by FHFA's county index
//     blockgroup the same for the home's block group, where the national floor's structures can place it (--structures)
//
// "Holds 8 in 10 at ±x%" is how wide a range around the estimate would have to be for 8 of these sales to land inside it.
//
//   node backend/scripts/eval/value-floor-test.js --root <index root> --fips 53011,25027 --work <downloads> --uad <UADAggs county zip> [--type house] [--structures <estimates root> --structures-state 24]
'use strict';

const fs = require('fs');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { download, zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { readIndex, FILES } = require('../../../scripts/property-index/sources/us-fhfa.cjs');
const { saleFrom, sorted, median, quantile, validYear } = require('../../../scripts/property-index/lib/value-model.cjs');
const { zip5 } = require('../../services/propertyRecords/addressKey');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const root = opt('--root');
const fipsList = (opt('--fips') || '').split(',').filter(Boolean);
const work = opt('--work');
if (!root || !fipsList.length || !work) throw new Error('usage: see the top of value-floor-test.js');

const ACS = 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b25077.dat';
// A five-year survey's middle: what people said their homes were worth, 2020 to 2024.
const ACS_MIDDLE = 2022.5;
const UAD_YEAR = 2023;
const TYPE = opt('--type') || 'house';
const TRIAL_RANGES = [[0.8, 1.22], [0.78, 1.27], [0.75, 1.3], [0.7, 1.4]];

const pct = (n) => (n === null || n === undefined ? '-' : n.toFixed(1));

function acsValues() {
  const file = path.join(work, 'us-acs', 'b25077.dat');
  download(ACS, file);
  const lines = fs.readFileSync(file, 'latin1').split('\n');
  const header = lines[0].split('|');
  const [geo, estimate] = [header.indexOf('GEO_ID'), header.indexOf('B25077_E001')];
  if (geo < 0 || estimate < 0) throw new Error('The Census table changed');
  const zips = new Map();
  const blockGroups = new Map();
  for (const line of lines.slice(1)) {
    const fields = line.split('|');
    const value = Number(fields[estimate]);
    if (value > 0) {
      const id = fields[geo] || '';
      if (id.startsWith('860Z200US')) zips.set(id.slice(9), value);
      else if (id.startsWith('1500000US')) blockGroups.set(id.slice(9), value);
    }
  }
  return { zips, blockGroups };
}

/** The county's price level at a moment, from FHFA's yearly changes: each year's level sits at its middle. */
function priceLevels(byYear, fips) {
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const levels = [];
  let level = 1;
  for (const year of years) {
    const change = byYear.get(year).get(fips);
    if (change !== undefined) level *= 1 + change / 100;
    levels.push([year + 0.5, level]);
  }
  return (moment) => {
    if (moment <= levels[0][0]) return levels[0][1];
    for (let i = 1; i < levels.length; i += 1) {
      if (moment <= levels[i][0]) {
        const [from, a] = levels[i - 1];
        const [to, b] = levels[i];
        return a * (b / a) ** ((moment - from) / (to - from));
      }
    }
    return levels[levels.length - 1][1];
  };
}

const momentOf = (date) => Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 0.5) / 12;

function scored(errors) {
  if (errors.length < 50) return null;
  const absolute = sorted(errors.map(Math.abs));
  return {
    sales: errors.length,
    median_error: 100 * median(absolute),
    within_10: (100 * absolute.filter((error) => error <= 0.1).length) / absolute.length,
    bias: 100 * median(sorted(errors)),
    holds_8_in_10: 100 * quantile(absolute, 0.8),
    // Sale price over estimate: a range of estimate x these would hold 8 in 10 of these sales.
    low: quantile(sorted(errors.map((error) => 1 / (1 + error))), 0.1),
    high: quantile(sorted(errors.map((error) => 1 / (1 + error))), 0.9),
    errors,
  };
}

async function uadMedians(zip) {
  const medians = new Map();
  if (!zip) return medians;
  for await (const row of zipTable(zip, 'UADAggs_ent_sf_county_v3_3.csv', ['SERIESID', 'FIPS', 'PURPOSE', 'YEAR', 'QUARTER', 'FREQUENCY', 'CHARACTERISTIC1', 'VALUE'], { encoding: 'latin1' })) {
    if (row.SERIESID === 'MEDIAN' && row.PURPOSE === 'Purchase' && row.CHARACTERISTIC1 === 'No Characteristic' && Number(row.YEAR) === UAD_YEAR && Number(row.QUARTER) === 5 && Number(row.VALUE) > 0) medians.set(row.FIPS, Number(row.VALUE));
  }
  return medians;
}

// Every structure the national floor holds, by street and number: its counties needn't be the record's (Connecticut's aren't).
function structurePlaces() {
  const dir = opt('--structures');
  if (!dir) return null;
  const places = new Map();
  for (const name of fs.readdirSync(path.join(dir, 'counties'))) {
    for (const record of openRelease(dir, name.replace('.json', '')).records()) {
      if (record.facts.block_group) places.set(`${record.key}|${record.address.number}`, record.facts.block_group);
    }
  }
  return places;
}

async function main() {
  const counties = await readIndex(work, FILES.county);
  const acs = acsValues();
  const uad = await uadMedians(opt('--uad'));
  const places = structurePlaces();
  const ways = ['forward', 'appraised', 'zip', 'blockgroup', 'county_sales_factor'];
  console.log(['county', 'way', 'sales', 'typical miss %', 'within 10 %', 'bias %', 'holds 8 in 10 at +-%'].join('\t'));
  const pooled = Object.fromEntries(ways.map((way) => [way, []]));
  for (const fips of fipsList) {
    const release = openRelease(root, fips);
    const level = priceLevels(counties.byYear, fips);
    const bases = [];
    const sales = [];
    for (const record of release.records()) {
      const base = record.facts.market_value || record.facts.assessed_value;
      // The county's own level is read from its houses, whichever kind of home is being tested.
      if (base && record.kind === 'property' && record.home_type === 'house') bases.push(base);
      if ((record.kind === 'property' || record.kind === 'unit') && record.home_type === TYPE) {
        const { sale } = saleFrom(record, fips, release.county.as_of);
        if (sale) sales.push({ ...sale, valueDate: validYear(record.facts.value_year), key: `${record.key}|${record.address.number}` });
      }
    }
    const medianBase = median(sorted(bases));
    const errors = Object.fromEntries(ways.map((way) => [way, []]));
    const appraised = uad.get(fips);
    const ratios = sorted(sales.map((sale) => sale.price / sale.base));
    const factor = median(ratios);
    for (const sale of sales) {
      const now = level(momentOf(sale.date));
      const miss = (estimate) => (estimate - sale.price) / sale.price;
      if (sale.valueDate) errors.forward.push(miss(sale.base * (now / level(sale.valueDate))));
      errors.county_sales_factor.push(miss(sale.base * factor));
      if (appraised && medianBase) errors.appraised.push(miss(sale.base * (appraised / medianBase) * (now / level(UAD_YEAR + 0.5))));
      const zipValue = acs.zips.get(zip5(sale.zip));
      if (zipValue) errors.zip.push(miss(zipValue * (now / level(ACS_MIDDLE))));
      // A street's key says nothing about its state, so only the structures' own state is looked up.
      const blockGroup = fips.slice(0, 2) === opt('--structures-state') ? places?.get(sale.key) : null;
      const groupValue = blockGroup ? acs.blockGroups.get(blockGroup) : null;
      if (groupValue) errors.blockgroup.push(miss(groupValue * (now / level(ACS_MIDDLE))));
    }
    for (const way of ways) {
      const score = scored(errors[way]);
      if (score) {
        pooled[way].push({ ...score, fips });
        console.log([fips, way, score.sales, pct(score.median_error), pct(score.within_10), pct(score.bias), pct(score.holds_8_in_10)].join('\t'));
      }
    }
  }
  console.log('\nAcross counties (median of their numbers), and how a range set from the other counties held in each:');
  for (const way of ways) {
    const rows = pooled[way];
    if (rows.length) {
      const of = (pick, list = rows) => median(sorted(list.map(pick)));
      // Each county judged by a range from the others, as a county with no local sales would be.
      const held = rows.map((row) => {
        const others = rows.filter((other) => other !== row);
        if (!others.length) return null;
        const [low, high] = [of((other) => other.low, others), of((other) => other.high, others)];
        const inside = row.errors.filter((error) => { const ratio = 1 / (1 + error); return ratio >= low && ratio <= high; }).length;
        return (100 * inside) / row.errors.length;
      }).filter((share) => share !== null);
      const spread = sorted(held);
      if (way === 'appraised' || way === 'forward') {
        for (const [low, high] of TRIAL_RANGES) {
          const shares = sorted(rows.map((row) => (100 * row.errors.filter((error) => { const ratio = 1 / (1 + error); return ratio >= low && ratio <= high; }).length) / row.errors.length));
          console.log([`  ${way} x${low} to x${high}`, `held ${pct(shares[0])}-${pct(shares[shares.length - 1])}%, median ${pct(median(shares))}%, counties at 70%+: ${shares.filter((share) => share >= 70).length} of ${shares.length}`].join('\t'));
        }
        console.log(`  ${way} worst counties (typical miss %, bias %): ${[...rows].sort((a, b) => b.median_error - a.median_error).slice(0, 5).map((row) => `${row.fips} ${pct(row.median_error)}/${pct(row.bias)}`).join(', ')}`);
      }
      console.log([way, `${rows.length} counties`, `typical miss ${pct(of((row) => row.median_error))}%`, `within 10 ${pct(of((row) => row.within_10))}%`, `bias ${pct(of((row) => row.bias))}%`,
        `holds 8 in 10 at +-${pct(of((row) => row.holds_8_in_10))}%`, `range x${of((row) => row.low).toFixed(2)} to x${of((row) => row.high).toFixed(2)}`,
        spread.length ? `that range held ${pct(spread[0])}-${pct(spread[spread.length - 1])}%, median ${pct(median(spread))}%` : ''].join('\t'));
    }
  }
}

main().catch((err) => {
  console.error(`The test failed: ${err.name}: ${err.message}`);
  process.exit(1);
});

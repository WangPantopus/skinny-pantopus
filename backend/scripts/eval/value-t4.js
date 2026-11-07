#!/usr/bin/env node
// T4 (docs/research/provider-replacement/parity-and-acceptance.md): what a Pantopus value estimate would score, measured
// on held-out recorded sales, and how the FHFA trend line compares with county sale medians. Each release's build keeps the
// same numbers for the card to say. Nothing here switches anything on.
//
// The candidate is scripts/property-index/lib/value-model.cjs. Prints counts and percentages, never a home.
//
//   node backend/scripts/eval/value-t4.js --root <local index root> [--states CT,MA | --fips 53011,25017] [--report <file>] [--clark <PACS zip>] [--work <dir>] [--trend]
//     --root    a folder of releases (counties/<fips>.json, releases/...), as build.cjs writes or a copy from storage
//     --report  writes the table of every market there, and prints the summaries
//     --clark   Clark County's weekly file: every sale with the assessor's own validity word, against the value of its year
//     --work    where FHFA's files are kept for --trend
'use strict';

const fs = require('fs');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { readIndex, FILES } = require('../../../scripts/property-index/sources/us-fhfa.cjs');
const { BAR, saleFrom, likelySales, measure, passes, sorted: sortedBy, median } = require('../../../scripts/property-index/lib/value-model.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const root = opt('--root');
if (!root) throw new Error('usage: see the top of value-t4.js');
const wanted = (opt('--states') || '').split(',').filter(Boolean);
const fipsList = opt('--fips')
  ? opt('--fips').split(',').filter(Boolean)
  : fs.readdirSync(path.join(root, 'counties')).map((name) => name.replace('.json', ''))
    .filter((fips) => !wanted.length || wanted.includes(JSON.parse(fs.readFileSync(path.join(root, 'counties', `${fips}.json`), 'utf8')).state)).sort();
const reportFile = opt('--report');

const LOWEST_PRICE = 10000;
const MIN_ZIP_SALES = 50;
const TREND_YEARS = 5;
const CLARK_YEARS = [2022, 2023, 2024, 2025];
const TABLE = { delimiter: '|', quoted: false };

const pct = (n) => (n === null || n === undefined ? '-' : n.toFixed(1));

function bump(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

/** Every home's last sale after its value's date, from a release; and every last sale, for the trend check. */
function salesFromRelease(fips) {
  const release = openRelease(root, fips);
  const sales = [];
  const counts = {};
  const trendSales = [];
  let homes = 0;
  for (const record of release.records()) {
    if (record.kind === 'property' || record.kind === 'unit') {
      homes += 1;
      const { facts } = record;
      if (facts.sale_price >= LOWEST_PRICE && facts.sale_date) trendSales.push({ price: facts.sale_price, date: facts.sale_date, zip: record.address.zip || '' });
      const { sale, why } = saleFrom(record, fips, release.county.as_of);
      if (sale) sales.push(sale);
      else if (why) bump(counts, why);
    }
  }
  const likely = likelySales(sales);
  counts['price far from any value'] = sales.length - likely.length;
  return { sales: likely, counts, trendSales, homes };
}

/** Clark County: every valid sale of a year against that year's value, joined to the release for the kind of home. */
async function salesFromClark(zip) {
  const release = openRelease(root, '53011');
  const homes = new Map();
  for (const record of release.records()) {
    if (record.kind === 'property' || record.kind === 'unit') homes.set(record.id.split(':').pop(), { type: record.home_type || 'other', town: record.address.city || '', zip: record.address.zip || '' });
  }
  const values = new Map();
  for await (const row of zipTable(zip, 'ValueMktTaxVw.txt', ['prop_id', 'Prop_val_yr', 'MarketVal'], TABLE)) {
    const year = Number(row.Prop_val_yr);
    const value = Number(row.MarketVal);
    if (homes.has(row.prop_id) && value > 0 && CLARK_YEARS.includes(year)) values.set(`${row.prop_id}:${year}`, value);
  }
  const counts = {};
  const sales = [];
  for await (const row of zipTable(zip, 'PropSalesInfoOnlyVw.txt', ['prop_id', 'SalePrice', 'SaleDate', 'SalesType', 'invalid_sale'], TABLE)) {
    const home = homes.get(row.prop_id);
    const price = Number(row.SalePrice);
    const date = String(row.SaleDate || '').slice(0, 10);
    const year = Number(date.slice(0, 4));
    if (home && price > 0 && CLARK_YEARS.includes(year)) {
      const base = values.get(`${row.prop_id}:${year}`);
      if (row.invalid_sale === '1' || row.SalesType === 'INVALID') bump(counts, 'assessor marks the sale invalid');
      else if (!base) bump(counts, 'no value for that year');
      else if (price < LOWEST_PRICE || price / base < 0.25 || price / base > 4) bump(counts, 'price far from any value');
      else sales.push({ ...home, price, date, base, baseKind: 'market', valueYear: year });
    }
  }
  return { sales, counts, homes: homes.size };
}

const COLUMNS = ['market', 'state', 'type', 'county value', 'fit sales', 'test sales', 'test from', 'test to', 'factor', 'own-factor groups',
  'as is: median err %', 'as is within 10 %', 'as is bias %', 'estimate: median err %', 'within 10 %', 'bias %', '80% range holds %', 'passes'];

function report(label, state, sales, lines, summary) {
  const byType = new Map();
  for (const sale of sales) {
    if (!byType.has(sale.type)) byType.set(sale.type, []);
    byType.get(sale.type).push(sale);
  }
  for (const [type, list] of [...byType].sort((a, b) => b[1].length - a[1].length)) {
    const m = measure(list);
    if (m && m.test_sales >= 20) {
      const verdict = m.test_sales >= BAR.min_test_sales ? (passes(m) ? 'PASS' : 'no') : 'too few';
      lines.push([label, state, type, list[0].baseKind, m.fit_sales, m.test_sales, m.test_from, m.test_to, m.factor, m.groups,
        pct(m.as_is.median_error), pct(m.as_is.within_10), pct(m.as_is.bias),
        pct(m.model.median_error), pct(m.model.within_10), pct(m.model.bias), pct(m.coverage), verdict].join('\t'));
      if (verdict !== 'too few') summary.push({ state, type, ...m, verdict });
    }
  }
}

/** Direction and rough size of FHFA's number against the median sale price of each year in the same place. */
async function trendCheck(work, byCounty) {
  const counties = await readIndex(work, FILES.county);
  const zips = await readIndex(work, FILES.zip);
  console.log('\nFHFA county change against the median recorded sale price, year on year (the last sale of each home; every valid sale in Clark)');
  console.log(['county', 'year', 'sales', 'prior sales', 'median change %', 'FHFA change %', 'same direction'].join('\t'));
  const totals = { years: 0, same: 0, gaps: [] };
  for (const [fips, sales] of byCounty) {
    const byYear = new Map();
    for (const sale of sales) {
      const year = Number(sale.date.slice(0, 4));
      byYear.set(year, [...(byYear.get(year) || []), sale.price]);
    }
    for (const [year, prices] of [...byYear].sort((a, b) => a[0] - b[0])) {
      const prior = byYear.get(year - 1);
      const fhfa = counties.byYear.get(year)?.get(fips);
      if (year > counties.year - TREND_YEARS && prior && prior.length >= 100 && prices.length >= 100 && fhfa !== undefined) {
        const change = 100 * (median(sortedBy(prices)) / median(sortedBy(prior)) - 1);
        const same = Math.sign(change) === Math.sign(fhfa) || Math.abs(change - fhfa) < 2;
        totals.years += 1;
        totals.same += same ? 1 : 0;
        totals.gaps.push(Math.abs(change - fhfa));
        console.log([fips, year, prices.length, prior.length, pct(change), pct(fhfa), same ? 'yes' : 'NO'].join('\t'));
      }
    }
  }
  const gaps = sortedBy(totals.gaps);
  console.log(`County-years compared: ${totals.years}; same direction, or within 2 points: ${totals.same}; median gap ${pct(median(gaps))} points`);

  // The same for ZIPs, in FHFA's last year: thin areas, so noisier.
  const zipGaps = [];
  let zipSame = 0;
  for (const sales of byCounty.values()) {
    const byZip = new Map();
    for (const sale of sales) {
      const year = Number(sale.date.slice(0, 4));
      if (sale.zip && (year === zips.year || year === zips.year - 1)) {
        if (!byZip.has(sale.zip)) byZip.set(sale.zip, { now: [], before: [] });
        byZip.get(sale.zip)[year === zips.year ? 'now' : 'before'].push(sale.price);
      }
    }
    for (const [zip, { now, before }] of byZip) {
      const fhfa = zips.changes.get(zip);
      if (fhfa !== undefined && now.length >= MIN_ZIP_SALES && before.length >= MIN_ZIP_SALES) {
        const change = 100 * (median(sortedBy(now)) / median(sortedBy(before)) - 1);
        zipGaps.push(Math.abs(change - fhfa));
        if (Math.sign(change) === Math.sign(fhfa) || Math.abs(change - fhfa) < 2) zipSame += 1;
      }
    }
  }
  console.log(`ZIPs compared for ${zips.year} (${MIN_ZIP_SALES}+ sales in each year): ${zipGaps.length}; same direction, or within 2 points: ${zipSame}; median gap ${pct(median(sortedBy(zipGaps)))} points`);
}

function printSummary(summary, homesByState) {
  console.log('\nBy state, markets (county and kind of home) with 200+ test sales:');
  console.log(['state', 'homes', 'markets', 'pass', 'estimate: median of median err %', 'as is: median of median err %', 'range holds, median %', 'range holds 75-85 %', 'err <= 8 %'].join('\t'));
  for (const state of [...new Set(summary.map((row) => row.state))].sort()) {
    const rows = summary.filter((row) => row.state === state);
    const of = (pick) => median(sortedBy(rows.map(pick)));
    console.log([state, homesByState[state] || 0, rows.length, rows.filter((row) => row.verdict === 'PASS').length, pct(of((row) => row.model.median_error)), pct(of((row) => row.as_is.median_error)), pct(of((row) => row.coverage)),
      rows.filter((row) => row.coverage >= BAR.coverage_low && row.coverage <= BAR.coverage_high).length, rows.filter((row) => row.model.median_error <= BAR.median_error).length].join('\t'));
  }
  console.log('\nBy kind of home:');
  for (const type of [...new Set(summary.map((row) => row.type))]) {
    const rows = summary.filter((row) => row.type === type);
    console.log([type, `markets ${rows.length}`, `pass ${rows.filter((row) => row.verdict === 'PASS').length}`, `median err ${pct(median(sortedBy(rows.map((row) => row.model.median_error))))}%`, `range holds ${pct(median(sortedBy(rows.map((row) => row.coverage))))}%`].join('\t'));
  }
}

async function main() {
  console.log(`The bar first proposed (decision D9; the founder has since chosen to show an estimate everywhere, its accuracy in its range): median error <= ${BAR.median_error}%, range holds ${BAR.coverage_low}-${BAR.coverage_high}%, at least ${BAR.min_test_sales} test sales.`);
  const lines = [COLUMNS.join('\t')];
  const summary = [];
  const byCounty = new Map();
  const dropped = {};
  const homesByState = {};
  for (const fips of fipsList) {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'counties', `${fips}.json`), 'utf8')).state;
    if (fips === '53011' && opt('--clark')) {
      const { sales, counts, homes } = await salesFromClark(opt('--clark'));
      dropped[fips] = { ...counts, kept: sales.length };
      homesByState[state] = (homesByState[state] || 0) + homes;
      byCounty.set(fips, sales);
      for (const year of CLARK_YEARS) report(`${fips} ${year}`, state, sales.filter((sale) => sale.valueYear === year), lines, summary);
    } else {
      const { sales, counts, trendSales, homes } = salesFromRelease(fips);
      dropped[fips] = { ...counts, kept: sales.length };
      homesByState[state] = (homesByState[state] || 0) + homes;
      if (opt('--trend') !== null || process.argv.includes('--trend')) byCounty.set(fips, trendSales);
      report(fips, state, sales, lines, summary);
    }
  }
  if (reportFile) fs.writeFileSync(reportFile, `${lines.join('\n')}\n`);
  else console.log(lines.join('\n'));
  printSummary(summary, homesByState);
  if (!reportFile) {
    console.log('\nLeft out of the test, by county:');
    for (const [fips, counts] of Object.entries(dropped)) console.log(`  ${fips} ${JSON.stringify(counts)}`);
  }
  if (process.argv.includes('--trend')) await trendCheck(opt('--work') || path.join(root, 'work'), byCounty);
}

main().catch((err) => {
  console.error(`T4 failed: ${err.name}: ${err.message}`);
  process.exit(1);
});

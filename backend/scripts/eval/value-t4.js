#!/usr/bin/env node
// T4 (docs/research/provider-replacement/parity-and-acceptance.md): what a Pantopus value estimate would score, measured
// on held-out recorded sales, and how the FHFA trend line compares with county sale medians. Nothing here switches an
// estimate on: the founder decides (D9), and the card shows one only for a county on VALUE_ESTIMATE_MARKETS.
//
// The candidate is the explainable one: the county's own value times what recent sales say about the county's values
// (the median of price / value, in the town when it has enough sales), with an 80% range from those ratios.
// Time-separated: only sales after the value's own date count, because assessors set values from the sales before it. The
// factor is fit on the earlier of those sales and tested on the later ones. Prints counts and percentages, never a home.
//
//   node backend/scripts/eval/value-t4.js --root <local index root> --fips 53011,25017 [--clark <PACS zip>] [--work <dir>] [--trend]
//     --root   a folder of releases (counties/<fips>.json, releases/...), as build.cjs writes or a copy from storage
//     --clark  Clark County's weekly file: every sale with the assessor's own validity word, against the value of its year
//     --work   where FHFA's files are kept for --trend
'use strict';

const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { readIndex, FILES } = require('../../../scripts/property-index/sources/us-fhfa.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const root = opt('--root');
const fipsList = (opt('--fips') || '').split(',').filter(Boolean);
if (!root || !fipsList.length) throw new Error('usage: see the top of value-t4.js');

// The proposed bar (decision D9). The founder sets the bar.
const BAR = { median_error: 8, coverage_low: 75, coverage_high: 85, min_test_sales: 200 };
const LOWEST_PRICE = 10000;
// Outside these a price wasn't for this value: a family transfer, several parcels on one deed, a shell.
const RATIO_LOW = 0.25;
const RATIO_HIGH = 4;
const MIN_TOWN_SALES = 30;
const MIN_ZIP_SALES = 50;
const TREND_YEARS = 5;
const CLARK_YEARS = [2022, 2023, 2024, 2025];
// A fiscal-year value is set on January 1 of the year before it (Massachusetts).
const VALUE_YEAR_LAG = { 25: 1 };
const TABLE = { delimiter: '|', quoted: false };

const median = (sorted) => (sorted.length ? sorted[Math.floor(sorted.length / 2)] : null);
const sortedBy = (values) => [...values].sort((a, b) => a - b);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const pct = (n) => (n === null ? '-' : n.toFixed(1));

function validYear(year) {
  return Number.isInteger(year) && year >= 1990 && year <= new Date().getFullYear() + 1 ? year : null;
}

function bump(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function arm(sales, counts) {
  return sales.filter((sale) => {
    if (sale.price < LOWEST_PRICE) {
      bump(counts, 'price too low');
      return false;
    }
    const ratio = sale.price / sale.base;
    if (ratio < RATIO_LOW || ratio > RATIO_HIGH) {
      bump(counts, 'price far from any value');
      return false;
    }
    return true;
  });
}

/** Every home's last sale after its value's date, from a release. */
function salesFromRelease(fips) {
  const release = openRelease(root, fips);
  const lag = VALUE_YEAR_LAG[fips.slice(0, 2)] || 0;
  // A release with no readable value year: its file's date less a year and a half.
  const fallbackDate = new Date(Date.parse(release.county.as_of) - 548 * 86400000).toISOString().slice(0, 10);
  const sales = [];
  const counts = {};
  const trendSales = [];
  for (const record of release.records()) {
    if (record.kind !== 'property' && record.kind !== 'unit') continue;
    const { facts } = record;
    if (facts.sale_price >= LOWEST_PRICE && facts.sale_date) trendSales.push({ price: facts.sale_price, date: facts.sale_date, zip: record.address.zip || '' });
    const base = facts.market_value || facts.assessed_value;
    if (!facts.sale_price || !facts.sale_date || !base) continue;
    const year = validYear(facts.value_year);
    const valueDate = year ? `${year - lag}-01-01` : fallbackDate;
    if (facts.sale_date <= valueDate) bump(counts, 'sold before the value was set');
    else {
      sales.push({
        price: facts.sale_price,
        date: facts.sale_date,
        base,
        baseKind: facts.market_value ? 'market' : 'assessed',
        type: record.home_type || 'other',
        town: facts.municipality || record.address.city || '',
      });
    }
  }
  return { sales, counts, trendSales };
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
      else sales.push({ ...home, price, date, base, baseKind: 'market', rollYear: year });
    }
  }
  return { sales, counts, trendSales: sales };
}

const medianRatio = (sales) => median(sortedBy(sales.map((sale) => sale.price / sale.base)));

/** The county's factor, and each town's with enough sales: (sale) => factor. */
function factorsFrom(sales) {
  const everywhere = medianRatio(sales);
  const towns = new Map();
  for (const sale of sales) towns.set(sale.town, [...(towns.get(sale.town) || []), sale]);
  const own = new Map([...towns].filter(([, list]) => list.length >= MIN_TOWN_SALES).map(([town, list]) => [town, medianRatio(list)]));
  const factorFor = (sale) => own.get(sale.town) || everywhere;
  factorFor.everywhere = everywhere;
  factorFor.towns = own.size;
  return factorFor;
}

/**
 * Fit on the earlier half by date and test on the later half. The 80% range also comes from before the test: how far the
 * last third of the fitted sales landed from a factor set on the first two thirds, so it has seen prices move.
 */
function measure(sales) {
  const byDate = [...sales].sort((a, b) => a.date.localeCompare(b.date));
  const middle = Math.floor(byDate.length / 2);
  const fit = byDate.slice(0, middle);
  const test = byDate.slice(middle);
  if (!test.length || fit.length < 3) return null;
  const third = Math.floor((fit.length * 2) / 3);
  const earlier = factorsFrom(fit.slice(0, third));
  const misses = sortedBy(fit.slice(third).map((sale) => sale.price / (sale.base * earlier(sale))));
  const [low, high] = [quantile(misses, 0.1), quantile(misses, 0.9)];
  const factorFor = factorsFrom(fit);
  const errors = { asIs: [], model: [] };
  let inRange = 0;
  for (const sale of test) {
    const estimate = sale.base * factorFor(sale);
    errors.asIs.push((sale.base - sale.price) / sale.price);
    errors.model.push((estimate - sale.price) / sale.price);
    if (sale.price >= estimate * low && sale.price <= estimate * high) inRange += 1;
  }
  const scored = (list) => {
    const absolute = sortedBy(list.map(Math.abs));
    return {
      median_error: 100 * median(absolute),
      within_10: (100 * absolute.filter((error) => error <= 0.1).length) / absolute.length,
      bias: 100 * median(sortedBy(list)),
    };
  };
  return {
    fit: fit.length,
    test: test.length,
    cutoff: test[0].date,
    last: test[test.length - 1].date,
    factor: factorFor.everywhere,
    towns: factorFor.towns,
    asIs: scored(errors.asIs),
    model: scored(errors.model),
    coverage: (100 * inRange) / test.length,
  };
}

const passes = (m) => m.test >= BAR.min_test_sales && m.model.median_error <= BAR.median_error && m.coverage >= BAR.coverage_low && m.coverage <= BAR.coverage_high;

function report(label, sales) {
  const byType = new Map();
  for (const sale of sales) byType.set(sale.type, [...(byType.get(sale.type) || []), sale]);
  for (const [type, list] of [...byType].sort((a, b) => b[1].length - a[1].length)) {
    const m = measure(list);
    if (m && m.test >= 20) {
      const enough = m.test >= BAR.min_test_sales ? (passes(m) ? 'PASS' : 'no') : 'too few';
      console.log([label, type, list[0].baseKind, m.fit, m.test, `${m.cutoff}..${m.last}`, m.factor.toFixed(3), m.towns,
        pct(m.asIs.median_error), pct(m.asIs.within_10), pct(m.asIs.bias),
        pct(m.model.median_error), pct(m.model.within_10), pct(m.model.bias), pct(m.coverage), enough].join('\t'));
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

async function main() {
  const onList = (process.env.VALUE_ESTIMATE_MARKETS || '').split(',').filter(Boolean);
  console.log(`On VALUE_ESTIMATE_MARKETS now: ${onList.length ? onList.join(', ') : 'none'}. Bar: median error <= ${BAR.median_error}%, coverage ${BAR.coverage_low}-${BAR.coverage_high}%, at least ${BAR.min_test_sales} test sales.`);
  console.log(['market', 'type', 'county value', 'fit sales', 'test sales', 'test dates', 'factor', 'towns with own factor',
    'as is: median err %', 'within 10 %', 'bias %', 'estimate: median err %', 'within 10 %', 'bias %', '80% range holds %', 'passes'].join('\t'));
  const byCounty = new Map();
  const dropped = {};
  for (const fips of fipsList) {
    if (fips === '53011' && opt('--clark')) {
      const { sales, counts } = await salesFromClark(opt('--clark'));
      const kept = arm(sales, counts);
      dropped[fips] = counts;
      byCounty.set(fips, kept);
      for (const year of CLARK_YEARS) report(`${fips} ${year}`, kept.filter((sale) => sale.rollYear === year));
    } else {
      const { sales, counts, trendSales } = salesFromRelease(fips);
      const kept = arm(sales, counts);
      dropped[fips] = { ...counts, kept: kept.length };
      byCounty.set(fips, trendSales);
      report(fips, kept);
    }
  }
  console.log('\nLeft out of the test, by county:');
  for (const [fips, counts] of Object.entries(dropped)) console.log(`  ${fips} ${JSON.stringify(counts)}`);
  if (process.argv.includes('--trend')) await trendCheck(opt('--work') || path.join(root, 'work'), byCounty);
}

main().catch((err) => {
  console.error(`T4 failed: ${err.name}: ${err.message}`);
  process.exit(1);
});

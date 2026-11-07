'use strict';
// A Pantopus value estimate, the explainable kind: the county's own value times what sales since that value say about the
// county's values, with a range from how far later sales landed. Only sales after the value's own date count, because
// assessors set values from the sales before it. T4 (backend/scripts/eval/value-t4.js) measures this and each release's
// build keeps the result, so it moves with the release (services/propertyRecords/valueEstimate.js reads it). No dependencies, like the build.

const { validYear, groupOf, tierOf, groupFactor, factorFor } = require('../../../backend/services/propertyRecords/valueModel');

const LOWEST_PRICE = 10000;
// Outside these a price wasn't for this value: a family transfer, several parcels on one deed, a shell.
const RATIO_LOW = 0.25;
const RATIO_HIGH = 4;
const MIN_GROUP_SALES = 30;
// Enough sales to say anything about a county's homes of one kind.
const MIN_FIT_SALES = 100;
// A range set to hold 8 in 10 on a period after its factors, and tested on the period after that.
const RANGE_LOW = 0.1;
const RANGE_HIGH = 0.9;
const TARGET_HELD = 0.8;
const WIDEN_LEAST = 0.8;
const WIDEN_MOST = 1.6;
// The proposed bar (decision D9). The founder sets the bar.
const BAR = { median_error: 8, coverage_low: 75, coverage_high: 85, min_test_sales: 200 };

// Value tiers within a county and kind of home: a third of its sales each.
const TIER_CUTS = [1 / 3, 2 / 3];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// When a value year's value is set, where it isn't January 1 of that year: a Massachusetts fiscal year's is January 1 of the
// year before; a Connecticut grand list's is October 1.
const VALUE_DATES = { 25: (year) => `${year - 1}-01-01`, '09': (year) => `${year}-10-01` };
const NO_YEAR_MONTHS_BACK = 30;

const sorted = (values) => [...values].sort((a, b) => a - b);
const median = (list) => (list.length ? list[Math.floor(list.length / 2)] : null);
const quantile = (list, q) => list[Math.min(list.length - 1, Math.floor(list.length * q))];

/** A sale's date, YYYY-MM-DD: the record's own, or the middle of its month. Null with no month. */
function saleDateOf(facts) {
  if (facts.sale_date) return facts.sale_date;
  const month = /^([A-Z][a-z]{2}) (\d{4})$/.exec(facts.sale_month || '');
  return month ? `${month[2]}-${String(MONTHS.indexOf(month[1]) + 1).padStart(2, '0')}-15` : null;
}

function valueDateOf(facts, fips, asOf) {
  const year = validYear(facts.value_year);
  if (year) return (VALUE_DATES[fips.slice(0, 2)] || ((y) => `${y}-01-01`))(year);
  const date = new Date(`${asOf}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - NO_YEAR_MONTHS_BACK);
  return date.toISOString().slice(0, 10);
}

const baseOf = (facts) => facts.market_value || facts.assessed_value || null;
const kindOf = (record) => record.home_type || 'other';
const townOf = (record) => record.facts.municipality || record.address?.city || '';

/** The sale a record can teach from, or a word for why not. */
function saleFrom(record, fips, asOf) {
  const { facts } = record;
  const base = baseOf(facts);
  const date = saleDateOf(facts);
  if (!base || !facts.sale_price || !date) return { why: null };
  if (date > asOf) return { why: 'a date after the file\'s own' };
  if (date <= valueDateOf(facts, fips, asOf)) return { why: 'sold before the value was set' };
  if (facts.sale_price < LOWEST_PRICE) return { why: 'price too low' };
  const ratio = facts.sale_price / base;
  if (ratio < RATIO_LOW || ratio > RATIO_HIGH) return { why: 'price far from any value' };
  return {
    sale: {
      price: facts.sale_price,
      date,
      base,
      baseKind: facts.market_value ? 'market' : 'assessed',
      type: kindOf(record),
      town: townOf(record),
      valueYear: validYear(facts.value_year),
      zip: record.address?.zip || '',
    },
  };
}

const medianRatio = (sales) => median(sorted(sales.map((sale) => sale.price / sale.base)));

/** Factors from sales: each town and value year with enough of them, each value year, the county, and each value tier's lean. */
function factorsFrom(sales) {
  const byGroup = new Map();
  const byYear = new Map();
  for (const sale of sales) {
    const group = groupOf(sale.town, sale.valueYear);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(sale);
    const year = String(sale.valueYear || '');
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(sale);
  }
  const rated = (map) => Object.fromEntries([...map].filter(([, list]) => list.length >= MIN_GROUP_SALES).map(([key, list]) => [key, Math.round(medianRatio(list) * 1000) / 1000]));
  const factors = { county: Math.round(medianRatio(sales) * 1000) / 1000, years: rated(byYear), groups: rated(byGroup) };
  // Cheaper homes tend to sell further above a county's value than dearer ones.
  const bases = sorted(sales.map((sale) => sale.base));
  const cuts = TIER_CUTS.map((q) => quantile(bases, q));
  const tiers = TIER_CUTS.concat(1).map(() => []);
  for (const sale of sales) tiers[tierOf(cuts, sale.base)].push(sale.price / (sale.base * groupFactor(factors, sale.town, sale.valueYear)));
  return { ...factors, cuts, leans: tiers.map((list) => Math.round(1000 * (median(sorted(list)) || 1)) / 1000) };
}

/** How far a set of later sales landed from factors set before them. */
function missesAgainst(factors, sales) {
  return sorted(sales.map((sale) => sale.price / (sale.base * factorFor(factors, sale.town, sale.valueYear, sale.base))));
}

function scored(errors) {
  const absolute = sorted(errors.map(Math.abs));
  return {
    median_error: Math.round(1000 * median(absolute)) / 10,
    within_10: Math.round((1000 * absolute.filter((error) => error <= 0.1).length) / absolute.length) / 10,
    bias: Math.round(1000 * median(sorted(errors))) / 10,
  };
}

// How much wider a range must be to hold 8 in 10 when one set the plain way held `held`: both sides of a bell curve, roughly.
const sidesOf = (share) => Math.log((0.5 + share / 2) / (0.5 - share / 2)) / 1.702;

function rangeWidener(held) {
  const share = Math.min(0.98, Math.max(0.3, held));
  return Math.min(WIDEN_MOST, Math.max(WIDEN_LEAST, sidesOf(TARGET_HELD) / sidesOf(share)));
}

function rangeFrom(misses, widen) {
  return [quantile(misses, RANGE_LOW) ** widen, quantile(misses, RANGE_HIGH) ** widen];
}

const heldShare = (factors, sales, low, high) => sales.filter((sale) => {
  const estimate = sale.base * factorFor(factors, sale.town, sale.valueYear, sale.base);
  return sale.price >= estimate * low && sale.price <= estimate * high;
}).length / sales.length;

/**
 * Time-separated, in four periods by date. A range set the plain way on the second, from factors on the first, is tried on
 * the third, which says how much wider or narrower ranges need to be in this market. The test is the fourth, against factors
 * on the first three and a range from the third: sales nothing has seen, as they will be.
 */
function periodsOf(sales) {
  const byDate = [...sales].sort((a, b) => a.date.localeCompare(b.date));
  const cut = (share) => Math.floor(byDate.length * share);
  return { byDate, first: cut(0.4), second: cut(0.6), third: cut(0.8) };
}

function widenerFrom({ byDate, first, second, third }) {
  const [low, high] = rangeFrom(missesAgainst(factorsFrom(byDate.slice(0, first)), byDate.slice(first, second)), 1);
  return rangeWidener(heldShare(factorsFrom(byDate.slice(0, second)), byDate.slice(second, third), low, high));
}

function measure(sales) {
  const periods = periodsOf(sales);
  const { byDate, first, second, third } = periods;
  if (first < 30 || third === byDate.length) return null;
  const widen = widenerFrom(periods);
  const [low, high] = rangeFrom(missesAgainst(factorsFrom(byDate.slice(0, second)), byDate.slice(second, third)), widen);
  const factors = factorsFrom(byDate.slice(0, third));
  const test = byDate.slice(third);
  const asIs = [];
  const model = [];
  for (const sale of test) {
    const estimate = sale.base * factorFor(factors, sale.town, sale.valueYear, sale.base);
    asIs.push((sale.base - sale.price) / sale.price);
    model.push((estimate - sale.price) / sale.price);
  }
  return {
    fit_sales: third,
    test_sales: test.length,
    test_from: test[0].date,
    test_to: test[test.length - 1].date,
    factor: factors.county,
    groups: Object.keys(factors.groups).length,
    widen: Math.round(widen * 100) / 100,
    as_is: scored(asIs),
    model: scored(model),
    coverage: Math.round(1000 * heldShare(factors, test, low, high)) / 10,
  };
}

const passes = (m) => m.test_sales >= BAR.min_test_sales && m.model.median_error <= BAR.median_error
  && m.coverage >= BAR.coverage_low && m.coverage <= BAR.coverage_high;

/**
 * What a release keeps for one kind of home: the measured numbers, then factors from all its sales and a range from how far
 * the last period landed from factors on the rest, widened as this market's ranges have needed.
 */
function fitType(sales) {
  const measured = measure(sales);
  if (!measured || measured.fit_sales < MIN_FIT_SALES) return null;
  const periods = periodsOf(sales);
  const { byDate, third } = periods;
  const [low, high] = rangeFrom(missesAgainst(factorsFrom(byDate.slice(0, third)), byDate.slice(third)), widenerFrom(periods));
  return {
    ...factorsFrom(sales),
    low: Math.round(low * 1000) / 1000,
    high: Math.round(high * 1000) / 1000,
    typical_miss: measured.model.median_error,
    range_held: measured.coverage,
    within_10: measured.model.within_10,
    test_sales: measured.test_sales,
    test_to: measured.test_to,
  };
}

/**
 * A release's value model: each kind of home with enough sales, fitted, and each kind's median county value, which is how a
 * county with no sales to learn from is rescaled to a federal figure. Null when the file has neither.
 */
function buildModel(records, fips, asOf) {
  const byType = new Map();
  const bases = new Map();
  for (const record of records) {
    if (record.kind === 'property' || record.kind === 'unit') {
      const base = baseOf(record.facts);
      if (base) {
        const type = kindOf(record);
        if (!bases.has(type)) bases.set(type, []);
        bases.get(type).push(base);
      }
      const { sale } = saleFrom(record, fips, asOf);
      if (sale) {
        if (!byType.has(sale.type)) byType.set(sale.type, []);
        byType.get(sale.type).push(sale);
      }
    }
  }
  const types = {};
  for (const [type, sales] of byType) {
    const fitted = fitType(sales);
    if (fitted) types[type] = fitted;
  }
  const medians = Object.fromEntries([...bases].filter(([, list]) => list.length >= MIN_FIT_SALES).map(([type, list]) => [type, Math.round(median(sorted(list)))]));
  return Object.keys(types).length || Object.keys(medians).length ? { types, medians } : null;
}

module.exports = { BAR, saleFrom, measure, passes, buildModel, factorFor, sorted, median, quantile, validYear };

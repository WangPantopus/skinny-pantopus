'use strict';
// A Pantopus value estimate, the explainable kind: the county's own value times what sales since that value say about the
// county's values, with a range from how far later sales landed. Only sales after the value's own date count, because
// assessors set values from the sales before it. T4 (backend/scripts/eval/value-t4.js) measures this and each release's
// build keeps the result, so it moves with the release (services/propertyRecords/valueEstimate.js reads it). No dependencies, like the build.

const { validYear, valueDateOf, groupOf, tierOf, groupFactor, factorFor, momentOf } = require('../../../backend/services/propertyRecords/valueModel');

const LOWEST_PRICE = 10000;
// Outside these, against the county's usual price over value, a price wasn't for this value: a family transfer, several
// parcels on one deed, a shell.
const RATIO_LOW = 0.25;
const RATIO_HIGH = 4;
const MIN_GROUP_SALES = 30;
// Enough sales to say anything about a county's homes of one kind.
const MIN_FIT_SALES = 100;
// A range set to hold 8 in 10 on two periods, each after its factors, and tested on the period after them. Ranges come out
// a little short when tested later, more so where errors are growing: T4 (172 markets) chose these. Nothing here is that sure of a home.
const RANGE_LOW = 0.1;
const RANGE_HIGH = 0.9;
const WIDEN = 1.05;
const GROWTH_POWER = 0.5;
const GROWTH_MOST = 1.3;
const NARROWEST_LOW = 0.88;
const NARROWEST_HIGH = 1.14;
// Sales over this many years have the market's own drift taken out, so a value set long ago reads today's prices. Over a
// shorter span a drift is mostly noise.
const DRIFT_YEARS = 3;
const DRIFT_MOST = 0.2;
// The proposed bar (decision D9). The founder sets the bar.
const BAR = { median_error: 8, coverage_low: 75, coverage_high: 85, min_test_sales: 200 };

// Value tiers within a county and kind of home: a third of its sales each.
const TIER_CUTS = [1 / 3, 2 / 3];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sorted = (values) => [...values].sort((a, b) => a - b);
const median = (list) => (list.length ? list[Math.floor(list.length / 2)] : null);
const quantile = (list, q) => list[Math.min(list.length - 1, Math.floor(list.length * q))];

/** A sale's date, YYYY-MM-DD: the record's own, or the middle of its month. Null with no month. */
function saleDateOf(facts) {
  if (facts.sale_date) return facts.sale_date;
  const month = /^([A-Z][a-z]{2}) (\d{4})$/.exec(facts.sale_month || '');
  return month ? `${month[2]}-${String(MONTHS.indexOf(month[1]) + 1).padStart(2, '0')}-15` : null;
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
  const valueDate = valueDateOf(facts, fips, asOf);
  if (date <= valueDate) return { why: 'sold before the value was set' };
  // A home finished after its value was set sells for far more than a value of its lot and frame.
  if (validYear(facts.year_built) >= Number(valueDate.slice(0, 4))) return { why: 'built after its value was set' };
  if (facts.sale_price < LOWEST_PRICE) return { why: 'price too low' };
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

/**
 * A county's sales without those whose price wasn't for this value. "Far" is from what's usual here, because some counties'
 * values are a fraction of market (Cook's, 10%): the most crowded half-octave of price over value, so that deeds covering
 * many units can't move it, where a town's condo sales list a whole building's price.
 */
function likelySales(sales) {
  const bin = (sale) => Math.floor(Math.log2(sale.price / sale.base) * 2);
  const counts = new Map();
  for (const sale of sales) counts.set(bin(sale), (counts.get(bin(sale)) || 0) + 1);
  let top = null;
  let most = -1;
  for (const [key, count] of counts) {
    const around = count + (counts.get(key - 1) || 0) + (counts.get(key + 1) || 0);
    if (around > most) {
      most = around;
      top = key;
    }
  }
  const usual = medianRatio(sales.filter((sale) => Math.abs(bin(sale) - top) <= 1));
  return sales.filter((sale) => {
    const ratio = sale.price / sale.base / usual;
    return ratio >= RATIO_LOW && ratio <= RATIO_HIGH;
  });
}

/** The market's yearly drift against its values, from its oldest and newest thirds of sales by date, over a long enough span. */
function driftOf(sales) {
  if (!sales.length || momentOf(sales[sales.length - 1].date) - momentOf(sales[0].date) < DRIFT_YEARS) return 0;
  const third = Math.floor(sales.length / 3);
  const [oldest, newest] = [sales.slice(0, third), sales.slice(-third)];
  const middle = (list, pick) => median(sorted(list.map(pick)));
  const [from, to] = [middle(oldest, (sale) => momentOf(sale.date)), middle(newest, (sale) => momentOf(sale.date))];
  const yearly = (middle(newest, (sale) => Math.log(sale.price / sale.base)) - middle(oldest, (sale) => Math.log(sale.price / sale.base))) / (to - from);
  return Math.max(-DRIFT_MOST, Math.min(DRIFT_MOST, yearly));
}

/**
 * Factors from sales in date order, as of the last or a date given: each town and value year with enough of them, each value
 * year, the county, and each value tier's lean.
 */
function factorsFrom(sales, asOf = sales[sales.length - 1].date) {
  const drift = driftOf(sales);
  const now = momentOf(asOf);
  const ratioOf = (sale) => (sale.price / sale.base) * Math.exp(drift * (now - momentOf(sale.date)));
  const medianOf = (list) => median(sorted(list.map(ratioOf)));
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
  const rated = (map) => Object.fromEntries([...map].filter(([, list]) => list.length >= MIN_GROUP_SALES).map(([key, list]) => [key, Math.round(medianOf(list) * 1000) / 1000]));
  const factors = { county: Math.round(medianOf(sales) * 1000) / 1000, years: rated(byYear), groups: rated(byGroup) };
  // Cheaper homes tend to sell further above a county's value than dearer ones.
  const bases = sorted(sales.map((sale) => sale.base));
  const cuts = TIER_CUTS.map((q) => quantile(bases, q));
  const tiers = TIER_CUTS.concat(1).map(() => []);
  for (const sale of sales) tiers[tierOf(cuts, sale.base)].push(ratioOf(sale) / groupFactor(factors, sale.town, sale.valueYear));
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

/** A range from how far two periods' sales landed from factors before each, the later period saying whether errors are growing. */
function rangeFrom(earlier, later) {
  const spread = (misses) => Math.log(quantile(misses, RANGE_HIGH) / quantile(misses, RANGE_LOW));
  const growth = Math.min(GROWTH_MOST, Math.max(1, (spread(later) / spread(earlier)) ** GROWTH_POWER));
  const pooled = sorted([...earlier, ...later]);
  const widen = WIDEN * growth;
  return [Math.min(NARROWEST_LOW, quantile(pooled, RANGE_LOW) ** widen), Math.max(NARROWEST_HIGH, quantile(pooled, RANGE_HIGH) ** widen)];
}

const heldShare = (factors, sales, low, high) => sales.filter((sale) => {
  const estimate = sale.base * factorFor(factors, sale.town, sale.valueYear, sale.base);
  return sale.price >= estimate * low && sale.price <= estimate * high;
}).length / sales.length;

/**
 * Time-separated, in four periods by date. A range from how the second and third landed from factors before each is tested on
 * the fourth, against factors on the first three: sales nothing has seen, as they will be.
 */
function periodsOf(sales) {
  const byDate = [...sales].sort((a, b) => a.date.localeCompare(b.date));
  const cut = (share) => Math.floor(byDate.length * share);
  return { byDate, first: cut(0.4), second: cut(0.6), third: cut(0.8) };
}

function measure(sales) {
  const { byDate, first, second, third } = periodsOf(sales);
  if (first < 30 || third === byDate.length) return null;
  const [low, high] = rangeFrom(
    missesAgainst(factorsFrom(byDate.slice(0, first)), byDate.slice(first, second)),
    missesAgainst(factorsFrom(byDate.slice(0, second)), byDate.slice(second, third)),
  );
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
    as_is: scored(asIs),
    model: scored(model),
    coverage: Math.round(1000 * heldShare(factors, test, low, high)) / 10,
  };
}

const passes = (m) => m.test_sales >= BAR.min_test_sales && m.model.median_error <= BAR.median_error
  && m.coverage >= BAR.coverage_low && m.coverage <= BAR.coverage_high;

/**
 * What a release keeps for one kind of home: the measured numbers, then factors from all its sales as of its file's date and a
 * range from how the last two periods landed from factors before each.
 */
function fitType(sales, asOf) {
  const measured = measure(sales);
  if (!measured || measured.fit_sales < MIN_FIT_SALES) return null;
  const { byDate, second, third } = periodsOf(sales);
  const [low, high] = rangeFrom(
    missesAgainst(factorsFrom(byDate.slice(0, second)), byDate.slice(second, third)),
    missesAgainst(factorsFrom(byDate.slice(0, third)), byDate.slice(third)),
  );
  return {
    ...factorsFrom(byDate, asOf),
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
 * A release's value model: each kind of home with enough sales, fitted, and what a county with no sales to learn from has to go
 * on: each kind's median county value and how spread out its values are, for homes of every kind too.
 * Null when the file has neither.
 */
function buildModel(records, fips, asOf) {
  const candidates = [];
  const bases = new Map();
  const everyBase = [];
  for (const record of records) {
    if (record.kind === 'property' || record.kind === 'unit') {
      const base = baseOf(record.facts);
      if (base) {
        const type = kindOf(record);
        if (!bases.has(type)) bases.set(type, []);
        bases.get(type).push(base);
        everyBase.push(base);
      }
      const { sale } = saleFrom(record, fips, asOf);
      if (sale) candidates.push(sale);
    }
  }
  const byType = new Map();
  for (const sale of likelySales(candidates)) {
    if (!byType.has(sale.type)) byType.set(sale.type, []);
    byType.get(sale.type).push(sale);
  }
  const types = {};
  for (const [type, sales] of byType) {
    const fitted = fitType(sales, asOf);
    if (fitted) types[type] = fitted;
  }
  const enough = [...bases].filter(([, list]) => list.length >= MIN_FIT_SALES).map(([type, list]) => [type, sorted(list)]);
  if (everyBase.length >= MIN_FIT_SALES) enough.push(['all', sorted(everyBase)]);
  const medians = Object.fromEntries(enough.map(([type, list]) => [type, Math.round(median(list))]));
  const spreads = Object.fromEntries(enough.map(([type, list]) => [type, Math.round(100 * Math.log(quantile(list, 0.75) / quantile(list, 0.25))) / 100]));
  return Object.keys(types).length || Object.keys(medians).length ? { types, medians, spreads } : null;
}

module.exports = { BAR, saleFrom, likelySales, measure, passes, buildModel, factorFor, sorted, median, quantile, validYear };

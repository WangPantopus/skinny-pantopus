'use strict';

/**
 * How a release's value model turns a county's value into a factor (scripts/property-index/lib/value-model.cjs fits
 * them): a town and value year's own when it has enough sales, else the value year's, else the county's, times the lean
 * of the home's value tier. No dependencies, so the index build runs without the backend's packages.
 */

function validYear(year) {
  return Number.isInteger(year) && year >= 1990 && year <= 2100 ? year : null;
}

// When a value year's value is set, where it isn't January 1 of that year: a Massachusetts fiscal year's is January 1 of the
// year before; a Connecticut grand list's is October 1.
const VALUE_DATES = { 25: (year) => `${year - 1}-01-01`, '09': (year) => `${year}-10-01` };
const NO_YEAR_MONTHS_BACK = 30;

/** The date a county's value was set, YYYY-MM-DD: from its value year, or a guess from the file's date when it has none. */
function valueDateOf(facts, fips, asOf) {
  let year = validYear(facts.value_year);
  if (year) {
    const dateOf = VALUE_DATES[fips.slice(0, 2)] || ((y) => `${y}-01-01`);
    // Some counties name a value by the tax year it's for, which can be next year. It was set before the file was.
    while (dateOf(year) >= asOf) year -= 1;
    return dateOf(year);
  }
  const date = new Date(`${asOf}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - NO_YEAR_MONTHS_BACK);
  return date.toISOString().slice(0, 10);
}

const groupOf = (town, valueYear) => `${String(town || '').trim().toUpperCase()}|${valueYear || ''}`;

function tierOf(cuts, base) {
  const tier = cuts.findIndex((cut) => base < cut);
  return tier < 0 ? cuts.length : tier;
}

function groupFactor(model, town, valueYear) {
  return model.groups[groupOf(town, valueYear)] || model.years[String(valueYear || '')] || model.county;
}

function factorFor(model, town, valueYear, base) {
  return groupFactor(model, town, valueYear) * model.leans[tierOf(model.cuts, base)];
}

/** A moment as a year and its fraction, from YYYY-MM-DD: the middle of its month. */
const momentOf = (date) => Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 0.5) / 12;

/** A price level at a moment, from one level for each year, each at its year's middle. Past the last year it holds there. */
function levelAt(years, levels, moment) {
  const at = (i) => years[i] + 0.5;
  if (moment <= at(0)) return levels[0];
  for (let i = 1; i < years.length; i += 1) {
    if (moment <= at(i)) return levels[i - 1] * (levels[i] / levels[i - 1]) ** ((moment - at(i - 1)) / (at(i) - at(i - 1)));
  }
  return levels[levels.length - 1];
}

module.exports = { validYear, valueDateOf, groupOf, tierOf, groupFactor, factorFor, momentOf, levelAt };

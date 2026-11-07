'use strict';

/**
 * A Pantopus value estimate for a Home's copy of its county record, the best we can give it, and how sure we are shows in
 * the range's width and in plain words:
 *   level 1  county value and local sales: the model its release measured on held-out sales (scripts/property-index/lib/value-model.cjs)
 *   level 2  a county's market value but no local sales to learn from: the mean of two public anchors, FHFA's (rescaled to its
 *            median purchase appraisal for the county and moved forward by its price index, or only moved forward where that
 *            rescale is missing or too large) and the Census Bureau's (what owners said homes here are worth), with a range by how
 *            spread out the county's values are, from tests in other counties (backend/scripts/eval/value-floor-test.js). A
 *            fractional assessment can't be moved, so it gets none.
 * Off unless VALUE_ESTIMATES=on, and then it follows the county: a copy only reaches a screen in a live county. Unsetting it is
 * the quick way back.
 * It answers null rather than wait or fail.
 */

const config = require('../../config/propertyRecords');
const logger = require('../../utils/logger');
const reader = require('./reader');
const areaTrend = require('./areaTrend');
const { stateCode } = require('./addressKey');
const { factorFor, validYear, levelAt, momentOf, valueDateOf } = require('./valueModel');
const { SALE_PRICES_NOT_PUBLIC } = require('../../data/valuePractice');

const ROUND_TO = 1000;
const ROUGH_ROUND_TO = 5000;
// From value-floor-test.js on 94 counties with market values and real sales, pretending they had none (November 2026): a
// typical miss of 11.6% at the median, and half the county-wide lean of FHFA's figures alone (3.7% against 6.5%).
// A rescale this large says the county's mortgaged buyers aren't its typical home (an uneven city, or a county of second
// homes), where moving the value forward alone did better.
const RESCALE_TOO_FAR = 1.3;
// Moved forward alone, the same test read 12% low, so it leans up.
const FORWARD_ONLY_LEAN = 1.12;
// Owners say their homes are worth about 7% more than they sell for.
const CENSUS_LEAN = 1.07;
// Ranges by how spread out the county's house values are (the log of their upper over lower quartile). Each held a median of
// 81% of sales in its counties, judged by a range from the others.
const ROUGH_BANDS = [
  { spread: 0.5, low: 0.84, high: 1.21, typical_miss: 9 },
  { spread: 0.62, low: 0.79, high: 1.26, typical_miss: 11 },
  { spread: 0.75, low: 0.75, high: 1.26, typical_miss: 12 },
  { spread: Infinity, low: 0.68, high: 1.47, typical_miss: 18 },
];
// Where the two anchors disagree by more than this, the county is uneven in a way neither sees (Baltimore City). In the 10 such
// counties of 94 a typical miss was 18%, and this range lifted those holding 7 sales in 10 from 83 counties to 86.
const ANCHORS_DISAGREE = 0.15;
const DISAGREE_BAND = { low: 0.62, high: 1.5, typical_miss: 18 };

const rounded = (amount, to = ROUND_TO) => Math.round(amount / to) * to;

function levelOne(fitted, facts, home, base, asOf) {
  const value = rounded(base * factorFor(fitted, facts.municipality || home.city, validYear(facts.value_year), base));
  return {
    level: 1,
    value,
    low: rounded(value * Math.min(fitted.low, 1)),
    high: rounded(value * Math.max(fitted.high, 1)),
    as_of: asOf,
    typical_miss: fitted.typical_miss,
    range_held: fitted.range_held,
  };
}

function levelTwo(copy, model, file, state) {
  const { facts } = copy;
  const levels = file?.county_levels?.[copy.jurisdiction];
  if (!levels) return null;
  const level = (moment) => levelAt(file.level_years, levels, moment);
  const now = level(momentOf(copy.as_of));
  const anchors = [];
  const appraisal = file.appraisals?.[copy.jurisdiction];
  const houses = model?.medians?.house;
  const year = validYear(facts.value_year);
  if (appraisal && houses && appraisal / houses <= RESCALE_TOO_FAR) anchors.push(facts.market_value * (appraisal / houses) * (now / level(file.appraisal_year + 0.5)));
  else if (year) anchors.push(facts.market_value * FORWARD_ONLY_LEAN * (now / level(year)));
  const census = file.county_values?.[copy.jurisdiction]?.[0];
  const everyHome = model?.medians?.all;
  if (census && everyHome && file.census_middle) anchors.push(facts.market_value * (census / CENSUS_LEAN / everyHome) * (now / level(file.census_middle)));
  if (!anchors.length) return null;
  const value = Math.exp(anchors.reduce((sum, anchor) => sum + Math.log(anchor), 0) / anchors.length);
  const spread = model?.spreads?.house ?? model?.spreads?.all;
  let band = spread == null ? ROUGH_BANDS[2] : ROUGH_BANDS.find((each) => spread <= each.spread);
  if (anchors.length === 2 && Math.abs(Math.log(anchors[0] / anchors[1])) > ANCHORS_DISAGREE) band = DISAGREE_BAND;
  const middle = rounded(value, ROUGH_ROUND_TO);
  return {
    level: 2,
    value: middle,
    low: rounded(middle * band.low, ROUGH_ROUND_TO),
    high: rounded(middle * band.high, ROUGH_ROUND_TO),
    as_of: copy.as_of,
    typical_miss: band.typical_miss,
    // Why it couldn't be checked here, where that's the reason.
    ...(SALE_PRICES_NOT_PUBLIC[state] ? { prices_not_public: SALE_PRICES_NOT_PUBLIC[state] } : {}),
  };
}

/** @returns {Promise<null|{ level: 1|2, value: number, low: number, high: number, as_of: string, typical_miss: number, range_held?: number }>} */
async function forCopy(copy, home) {
  if (!config.estimatesOn() || !copy || copy.match !== 'exact') return null;
  const { facts } = copy;
  const base = facts.market_value || facts.assessed_value;
  if (!base) return null;
  // A home finished after its county value was set has a value of its lot and frame: nothing can rest on it.
  if (validYear(facts.year_built) >= Number(valueDateOf(facts, copy.jurisdiction, copy.as_of).slice(0, 4))) return null;
  try {
    const state = stateCode(home.state);
    const stateFile = await reader.stateFile(state);
    const model = stateFile?.jurisdictions?.[copy.jurisdiction]?.value_model;
    const fitted = model?.types?.[copy.home_type || 'other'];
    if (fitted) return levelOne(fitted, facts, home, base, copy.as_of);
    if (!facts.market_value) return null;
    return levelTwo(copy, model, await areaTrend.stateFile(state), state);
  } catch (err) {
    logger.info('property_records.estimate_later', { error: err.name });
    return null;
  }
}

module.exports = { forCopy, levelTwo };

'use strict';

/**
 * A Pantopus value estimate for a Home's copy of its county record, the best we can give it, and how sure we are shows in
 * the range's width and in plain words:
 *   level 1  county value and local sales: the model its release measured on held-out sales (scripts/property-index/lib/value-model.cjs)
 *   level 2  a county's market value but no local sales to learn from: rescaled to FHFA's median purchase appraisal for the
 *            county and moved forward by its price index, or only moved forward where FHFA has no appraisals, with a range from
 *            tests in other counties (backend/scripts/eval/value-floor-test.js). A fractional assessment can't be moved, so it gets none.
 * Off until the founder turns it on for a live county, in that environment's switch file (router.js, `estimates: true`):
 * one command, no release, and off again the same way.
 * It answers null rather than wait or fail.
 */

const router = require('./router');
const logger = require('../../utils/logger');
const reader = require('./reader');
const areaTrend = require('./areaTrend');
const { stateCode } = require('./addressKey');
const { factorFor, validYear, levelAt, momentOf } = require('./valueModel');

const ROUND_TO = 1000;
const ROUGH_ROUND_TO = 5000;
// From value-floor-test.js on 21 counties with market values and real sales, pretending they had none (November 2026): the
// range held a median of 82%, and at least 70% in 20 of them.
const ROUGH_RANGE = { low: 0.78, high: 1.27 };
const ROUGH_TYPICAL_MISS = 10;
// A rescale this large says the county's mortgaged buyers aren't its typical home (an uneven city, or a county of second
// homes): in the three of those counties that had one, moving the value forward alone did better in each.
const RESCALE_TOO_FAR = 1.3;
// Moved forward alone, the same test read 12% low, so it leans up. Typical miss 10.5%; the range held a median of 87%.
const FORWARD_ONLY_LEAN = 1.12;
const FORWARD_ONLY_RANGE = { low: 0.75, high: 1.35 };
const FORWARD_ONLY_TYPICAL_MISS = 11;

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

function levelTwo(copy, model, file) {
  const { facts } = copy;
  const levels = file?.county_levels?.[copy.jurisdiction];
  if (!levels) return null;
  const level = (moment) => levelAt(file.level_years, levels, moment);
  const now = level(momentOf(copy.as_of));
  const appraisal = file.appraisals?.[copy.jurisdiction];
  const countyMedian = model?.medians?.house;
  const year = validYear(facts.value_year);
  let value;
  let range = ROUGH_RANGE;
  let typicalMiss = ROUGH_TYPICAL_MISS;
  if (appraisal && countyMedian && appraisal / countyMedian <= RESCALE_TOO_FAR) {
    value = facts.market_value * (appraisal / countyMedian) * (now / level(file.appraisal_year + 0.5));
  } else if (year) {
    value = facts.market_value * FORWARD_ONLY_LEAN * (now / level(year));
    range = FORWARD_ONLY_RANGE;
    typicalMiss = FORWARD_ONLY_TYPICAL_MISS;
  } else return null;
  const middle = rounded(value, ROUGH_ROUND_TO);
  return {
    level: 2,
    value: middle,
    low: rounded(middle * range.low, ROUGH_ROUND_TO),
    high: rounded(middle * range.high, ROUGH_ROUND_TO),
    as_of: copy.as_of,
    typical_miss: typicalMiss,
  };
}

/** @returns {Promise<null|{ level: 1|2, value: number, low: number, high: number, as_of: string, typical_miss: number, range_held?: number }>} */
async function forCopy(copy, home) {
  if (!copy || copy.match !== 'exact' || !router.estimatesFor(copy.jurisdiction)) return null;
  const { facts } = copy;
  const base = facts.market_value || facts.assessed_value;
  if (!base) return null;
  try {
    const state = stateCode(home.state);
    const stateFile = await reader.stateFile(state);
    const model = stateFile?.jurisdictions?.[copy.jurisdiction]?.value_model;
    const fitted = model?.types?.[copy.home_type || 'other'];
    if (fitted) return levelOne(fitted, facts, home, base, copy.as_of);
    if (!facts.market_value) return null;
    return levelTwo(copy, model, await areaTrend.stateFile(state));
  } catch (err) {
    logger.info('property_records.estimate_later', { error: err.name });
    return null;
  }
}

module.exports = { forCopy };

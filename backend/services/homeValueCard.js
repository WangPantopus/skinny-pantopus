'use strict';

/**
 * The Home's value card, in words the apps draw as they come, as they do Property
 * details' sections. It always shows what is known, and each number says what it is:
 *   1. the county's values, with their year: market value as the card's number; an
 *      assessment is only ever called an assessment, whatever the state's share of value;
 *   2. the last recorded sale, or that prices aren't public in this state;
 *   3. the area's price change, from an index, labeled as the area's (propertyRecords/areaTrend.js);
 *   4. a Pantopus estimate, with its range and what was measured (propertyRecords/valueEstimate.js);
 *   5. with no estimate, the Census Bureau's figures for the ZIP, called the neighborhood's.
 *
 * Only for the confirmed owner: callers check before they send it. An answer from
 * ATTOM's stored copy has its own fields and no card.
 */

const { stateCode } = require('./propertyRecords/addressKey');
const { dateLabel } = require('./propertyRecords/homeRecord');
const areaTrend = require('./propertyRecords/areaTrend');
const { SALE_PRICES_NOT_PUBLIC, ASSESSMENT_SHARE, ASSESSED_VALUE_NOTE } = require('../data/valuePractice');

const TAXABLE_VALUE_NOTE = 'Taxable value is what the county uses to figure property tax, not what the home would sell for.';
// Below this a deed's price is a formality, not a sale ($1, $10, "love and affection").
const LOWEST_SALE_PRICE = 1000;
// Above this many times the county's market value, a deed's price is for more than this home: some towns list a whole
// condo building's sale on every unit.
const MOST_SALE_TIMES_VALUE = 8;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const EMPTY_MESSAGES = {
  pending: "Looking up this home's county record. It fills in here by itself.",
  building: 'We found the building, but the county doesn\'t list a value for your unit.',
  record: 'The county\'s record for this home doesn\'t include a value.',
  none: 'We don\'t have county records for this home yet.',
};

function lastSale(facts, state) {
  const many = facts.market_value > 0 && facts.sale_price > MOST_SALE_TIMES_VALUE * facts.market_value;
  const price = facts.sale_price >= LOWEST_SALE_PRICE && !many ? money(facts.sale_price) : null;
  const when = (facts.sale_date && dateLabel(facts.sale_date)) || facts.sale_month || null;
  // A price too small to be a sale means the date is a transfer's too.
  const row = price || (when && (!facts.sale_price || many))
    ? { id: 'last_sale', label: 'Last sale', value: [price, when].filter(Boolean).join(' · ') }
    : null;
  if (many) return { row, note: 'The recorded price for this sale covers more than this home, so it isn\'t shown.' };
  const place = price ? null : SALE_PRICES_NOT_PUBLIC[state];
  return { row, note: place ? `Sale prices aren't public in ${place}.` : null };
}

function countyValues(facts, state) {
  const year = Number.isInteger(facts.value_year) && facts.value_year >= 1900 && facts.value_year <= 2100 ? facts.value_year : null;
  const named = (label) => (year ? `${label}, ${year}` : label);
  const rows = [];
  const notes = [];
  const market = facts.market_value;
  const assessed = facts.assessed_value;
  const taxable = facts.taxable_value;
  let headline = null;
  if (market) {
    headline = { title: named('County market value'), value: money(market), summary: `county value ${money(market)}` };
    if (assessed) rows.push({ id: 'assessed_value', label: named('Assessed value'), value: money(assessed) });
  } else if (assessed) {
    headline = { title: named('Assessed value'), value: money(assessed), summary: `assessed value ${money(assessed)}` };
  } else if (taxable) {
    headline = { title: named('Taxable value'), value: money(taxable), summary: `taxable value ${money(taxable)}` };
    notes.push(TAXABLE_VALUE_NOTE);
  }
  if (taxable && taxable !== market && taxable !== assessed && (market || assessed)) {
    rows.push({ id: 'taxable_value', label: named('Taxable value'), value: money(taxable) });
  }
  if (assessed) notes.push(ASSESSMENT_SHARE[state] || ASSESSED_VALUE_NOTE);
  else if (market && ASSESSMENT_SHARE[state]) notes.push(ASSESSMENT_SHARE[state]);
  return { headline, rows, notes };
}

/** An estimate's rows, for this card and Property details. */
function estimateRows(estimate) {
  return [
    { id: 'estimated_value', label: estimate.level === 1 ? 'Estimated value' : 'Rough estimate', value: money(estimate.value) },
    { id: 'estimate_range', label: 'Estimate range', value: `${money(estimate.low)} – ${money(estimate.high)}` },
    { id: 'estimate_date', label: 'Estimate date', value: dateLabel(estimate.as_of) },
  ];
}

/** What was measured, in place of a confidence score. */
function estimateNote(estimate) {
  if (estimate.level !== 1) {
    const why = estimate.prices_not_public ? `, because sale prices aren't public in ${estimate.prices_not_public}` : '';
    const wide = estimate.typical_miss >= 15 ? ', so its range is wide' : '';
    return `A rough estimate from the county's value and federal housing figures, not an appraisal. It couldn't be checked against local sales here${why}. In counties like this one it typically missed by about ${Math.round(estimate.typical_miss)}%${wide}.`;
  }
  return `An estimate from the county's value and recent sales, not an appraisal. Against sales held back to test it, here it typically missed by about ${Math.round(estimate.typical_miss)}%, and its range held about ${Math.round(estimate.range_held / 10)} times in 10.`;
}

/**
 * @param {object} profile  From propertyIntelligenceService.getProfile: a county record's, or the household's alone.
 * @param {{ trend: object|null, lookup?: string|null, neighborhood?: object|null }} [context]
 * @returns {object|null} Null for an answer the card doesn't describe.
 */
function build(profile, { trend = null, lookup = null, neighborhood = null } = {}) {
  if (!profile || !['record', 'fallback'].includes(profile.source)) return null;
  const facts = profile.county_values || {};
  const state = stateCode(profile.area?.state);
  const { headline, rows, notes } = countyValues(facts, state);
  if (headline && profile.value_match === 'parcel_only') notes.push("This is the county's value for the parcel. Its record doesn't list a home.");
  const sale = lastSale(facts, state);
  const { estimate } = profile;
  if (sale.row) rows.push(sale.row);
  // A rough estimate says for itself that prices aren't public here.
  if (sale.note && !estimate?.prices_not_public) notes.push(sale.note);
  if (estimate) {
    rows.push(...estimateRows(estimate));
    notes.push(estimateNote(estimate));
  }
  // Any home we can't estimate: no county record, or one that has only an assessment to go on, or no value at all.
  if (neighborhood && !estimate) {
    rows.push(
      { id: 'neighborhood_value', label: 'Typical home value in this ZIP', value: money(neighborhood.median) },
      { id: 'neighborhood_range', label: 'Middle half of homes here', value: `${money(neighborhood.low)} – ${money(neighborhood.high)}` },
    );
    notes.push(`What owners here told the Census Bureau their homes are worth (${neighborhood.source}). These are the neighborhood's figures, not this home's.`);
  }
  let emptyMessage = null;
  if (!headline) {
    if (lookup === 'pending') emptyMessage = EMPTY_MESSAGES.pending;
    else if (profile.value_match === 'building_only') emptyMessage = EMPTY_MESSAGES.building;
    else emptyMessage = EMPTY_MESSAGES[profile.source === 'record' ? 'record' : 'none'];
  }
  return {
    title: headline?.title || 'Home value',
    value: headline?.value || null,
    summary: (estimate ? `${estimate.level === 1 ? 'est.' : 'rough est.'} value ${money(estimate.value)}` : headline?.summary) || null,
    empty_message: emptyMessage,
    rows,
    notes,
    area_trend: areaTrend.describe(trend),
    source: profile.source === 'record' ? profile.value_card_source || null : null,
  };
}

module.exports = { build, estimateRows, estimateNote };

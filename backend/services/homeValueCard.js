'use strict';

/**
 * The Home's value card, in words the apps draw as they come, as they do Property
 * details' sections. It always shows what is known, and each number says what it is:
 *   1. the county's values, with their year: market value as the card's number; an
 *      assessment is only ever called an assessment, whatever the state's share of value;
 *   2. the last recorded sale, or that prices aren't public in this state;
 *   3. the area's price change, from an index, labeled as the area's (propertyRecords/areaTrend.js);
 *   4. a Pantopus estimate joins this only for a market on VALUE_ESTIMATE_MARKETS, after
 *      T4 (backend/scripts/eval/value-t4.js) has measured it. The list is empty and no model is wired.
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

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const EMPTY_MESSAGES = {
  pending: "Looking up this home's county record. It fills in here by itself.",
  building: 'We found the building, but the county doesn\'t list a value for your unit.',
  record: 'The county\'s record for this home doesn\'t include a value.',
  none: 'We don\'t have county records for this home yet.',
};

function lastSale(facts, state) {
  const price = facts.sale_price >= LOWEST_SALE_PRICE ? money(facts.sale_price) : null;
  const when = (facts.sale_date && dateLabel(facts.sale_date)) || facts.sale_month || null;
  // A price too small to be a sale means the date is a transfer's too.
  const row = price || (when && !facts.sale_price)
    ? { id: 'last_sale', label: 'Last sale', value: [price, when].filter(Boolean).join(' · ') }
    : null;
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

/**
 * @param {object} profile  From propertyIntelligenceService.getProfile: a county record's, or the household's alone.
 * @param {{ trend: object|null, lookup?: string|null }} [context]
 * @returns {object|null} Null for an answer the card doesn't describe.
 */
function build(profile, { trend = null, lookup = null } = {}) {
  if (!profile || !['record', 'fallback'].includes(profile.source)) return null;
  const facts = profile.county_values || {};
  const state = stateCode(profile.area?.state);
  const { headline, rows, notes } = countyValues(facts, state);
  if (headline && profile.value_match === 'parcel_only') notes.push("This is the county's value for the parcel. Its record doesn't list a home.");
  const sale = lastSale(facts, state);
  if (sale.row) rows.push(sale.row);
  if (sale.note) notes.push(sale.note);
  let emptyMessage = null;
  if (!headline) {
    if (lookup === 'pending') emptyMessage = EMPTY_MESSAGES.pending;
    else if (profile.value_match === 'building_only') emptyMessage = EMPTY_MESSAGES.building;
    else emptyMessage = EMPTY_MESSAGES[profile.source === 'record' ? 'record' : 'none'];
  }
  return {
    title: headline?.title || 'Home value',
    value: headline?.value || null,
    summary: headline?.summary || null,
    empty_message: emptyMessage,
    rows,
    notes,
    area_trend: areaTrend.describe(trend),
    source: profile.source === 'record' ? profile.value_card_source || null : null,
  };
}

module.exports = { build };

'use strict';
// One deed for several homes, whose price is the deed's and not any one home's: the same price, date and document on 3 or
// more homes, or, where a county publishes no document, the same price and date on 5 or more homes at one address (one
// building's units; across a county the same price on the same day is mostly chance). And the price must be at least 3 times
// what one of those homes would sell for: the county's usual price over value times their middle value. A developer's
// same-day sales of identical units are real prices and stay; so do Cook's unit-and-parking pairs, which need 3 homes.
// Each home on such a deed gets `sale_parcels` (services/propertyRecords/salePrice.js keeps its price off screens).
// No dependencies, like the build.

const WITH_DOCUMENT = 3;
const WITHOUT_DOCUMENT = 5;
const TIMES_ONE_HOME = 3;
const LOWEST_PRICE = 1000;

const baseOf = (facts) => facts.market_value || facts.assessed_value || 0;
const middle = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

/** Marks the records in place and says how many homes it marked. */
function markSharedDeeds(records) {
  const groups = new Map();
  const ratios = [];
  for (const record of records) {
    const { facts } = record;
    const date = facts?.sale_date || facts?.sale_month;
    if ((record.kind === 'property' || record.kind === 'unit') && facts.sale_price >= LOWEST_PRICE && date) {
      if (baseOf(facts)) ratios.push(facts.sale_price / baseOf(facts));
      const key = facts.sale_document ? `${facts.sale_price}|${date}|${facts.sale_document}` : `${facts.sale_price}|${date}|@${record.key}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
  }
  const usual = ratios.length ? middle(ratios) : null;
  let marked = 0;
  for (const list of groups.values()) {
    const withDocument = Boolean(list[0].facts.sale_document);
    if (list.length >= (withDocument ? WITH_DOCUMENT : WITHOUT_DOCUMENT)) {
      const bases = list.map((record) => baseOf(record.facts)).filter(Boolean);
      // With no value to compare, only a document says it's one deed.
      const far = bases.length && usual ? list[0].facts.sale_price >= TIMES_ONE_HOME * usual * middle(bases) : withDocument;
      if (far) {
        for (const record of list) record.facts.sale_parcels = list.length;
        marked += list.length;
      }
    }
  }
  return marked;
}

module.exports = { markSharedDeeds };

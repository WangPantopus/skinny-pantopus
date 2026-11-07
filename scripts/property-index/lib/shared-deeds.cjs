'use strict';
// One deed for several homes: a sale whose price, date and document are on 3 or more homes in a county's file, or price and
// date on 5 or more where the county publishes no document. Its price is the deed's, not any one home's, so each of those
// homes gets `sale_parcels` (services/propertyRecords/salePrice.js keeps the price off its screens). Two homes on one deed are
// left alone: in Cook they're mostly a condo and its parking, where the price is about the home's. No dependencies, like the build.

const WITH_DOCUMENT = 3;
const WITHOUT_DOCUMENT = 5;
const LOWEST_PRICE = 1000;

/** Marks the records in place and says how many homes it marked. */
function markSharedDeeds(records) {
  const groups = new Map();
  for (const record of records) {
    const { facts } = record;
    const date = facts?.sale_date || facts?.sale_month;
    if ((record.kind === 'property' || record.kind === 'unit') && facts.sale_price >= LOWEST_PRICE && date) {
      const key = `${facts.sale_price}|${date}|${facts.sale_document || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
  }
  let marked = 0;
  for (const [key, list] of groups) {
    if (list.length >= (key.endsWith('|') ? WITHOUT_DOCUMENT : WITH_DOCUMENT)) {
      for (const record of list) record.facts.sale_parcels = list.length;
      marked += list.length;
    }
  }
  return marked;
}

module.exports = { markSharedDeeds };

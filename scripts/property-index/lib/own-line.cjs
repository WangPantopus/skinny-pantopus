'use strict';
// A county can publish where a home is twice: in its address columns and in its own address line, and the two can disagree. A person
// who writes the line would get whatever record sits there, a neighbor's or the house beside a mobile home: the worst answer there is.
// So a home is also filed at its own line. Alone there, it's found; beside another home, the identity contract asks which one.

const { parse, sortKey } = require('../../../backend/services/propertyRecords/addressKey');
const { resolve } = require('../../../backend/services/propertyRecords/identity');

/** The extra records: each home its own line finds nothing for, or finds another record for, filed again at that line. */
function alsoAtOwnLine(records) {
  const byKey = new Map();
  for (const record of records) {
    const key = sortKey(record.address);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(record);
  }
  const twins = [];
  for (const record of records) {
    if ((record.kind !== 'property' && record.kind !== 'unit') || record.restricted) continue;
    const own = record.facts.address_on_record ? parse(record.facts.address_on_record) : null;
    if (!own) continue;
    const answer = resolve({ ...own, zip: record.address.zip, city: record.address.city }, byKey.get(sortKey(own)) || []);
    // Found, or already asked which home: nothing to add.
    if ((answer.match === 'exact' && answer.record.id === record.id) || answer.match === 'ambiguous') continue;
    delete own.form;
    twins.push({ ...record, address: { ...own, city: record.address.city, zip: record.address.zip } });
  }
  return twins;
}

module.exports = { alsoAtOwnLine };

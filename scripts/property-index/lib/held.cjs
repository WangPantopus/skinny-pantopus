'use strict';
// Facts a connector newly reads for a county that's live: they ride in the release under `held.new_columns` (format.js)
// and stay off its screens until the founder names the county on the switch file's new_columns list (router.js). A fact
// the record already states keeps the county's word as it is: a newly read column only fills an empty one.

/** Holds `value` as the record's `fact` when it says something and the record doesn't state that fact already. */
function hold(record, fact, value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return;
  const stated = record.facts?.[fact];
  if (stated !== null && stated !== undefined && stated !== '') return;
  record.held = record.held || {};
  record.held.new_columns = record.held.new_columns || {};
  record.held.new_columns[fact] = value;
}

/**
 * For connectors that fill a base file's records (lib/fill.cjs): moves the named facts, newly read, from each record's
 * facts to its held ones. Only for facts the county's page never showed before the read was added.
 */
function holdFacts(records, names) {
  for (const record of records) {
    for (const name of names) {
      if (record.facts?.[name] === undefined) continue;
      const value = record.facts[name];
      delete record.facts[name];
      hold(record, name, value);
    }
  }
}

module.exports = { hold, holdFacts };

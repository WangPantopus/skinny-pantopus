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

/**
 * For a live county whose file gives only a bath total: the full and half baths its page showed before a total stopped
 * being split into them (the whole number as full baths, and one half bath for a .5), kept in each record's facts so the
 * page stays as it was, and marked under `held.bath_totals` so the server leaves them out once the founder names the
 * county on the switch file's bath_totals list (router.js). A total doesn't say them: two full and two half baths is 3.0.
 * Only a record with a whole or half total and neither count. Texas's readers also wrote 0 full baths for a total of a half
 * (`zeroFull`). Returns how many records kept one, for the log.
 */
function keepSplit(records, { zeroFull = false } = {}) {
  let kept = 0;
  for (const record of records) {
    const facts = record.facts;
    const total = facts?.bathrooms;
    if (!(total > 0) || (total * 2) % 1 || facts.full_baths !== undefined || facts.half_baths !== undefined) continue;
    const split = { ...(Math.floor(total) || zeroFull ? { full_baths: Math.floor(total) } : {}), ...(total % 1 ? { half_baths: 1 } : {}) };
    Object.assign(facts, split);
    record.held = record.held || {};
    record.held.bath_totals = split;
    kept += 1;
  }
  return kept;
}

module.exports = { hold, holdFacts, keepSplit };

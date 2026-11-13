'use strict';
// A county's placeholder text where a fact has no value: "[NONE]", "[EMPTY] - [EMPTY]", "N/A", "UNKNOWN", a lone "-". Property
// details would show it as if it were the county's answer, so the build reads it as empty, for every connector (build.cjs).
// A fact that answers whether a home has something (cooling, a garage, a pool...) keeps a plain "None": that is an answer,
// and its "NOT APPLICABLE" reads as "None" too (Henrico writes it for a home with no heating system).

const { FACTS } = require('../../../backend/services/propertyRecords/facts');

const TOKEN = /^[\s[(]*(NONE|EMPTY|NULL|N\/?A|NA|UNKNOWN|UNK|NOT AVAILABLE|NOT APPLICABLE|TBD|UNASSIGNED|BLANK|MISSING|-+|\.+|\?+)[\s\])]*$/i;
const WORDS = new Set(['text', 'name', 'code', 'raw']);
const ANSWERS = new Set(['cooling', 'heating', 'heating_fuel', 'garage', 'parking_type', 'pool', 'sewer', 'water_source', 'utilities', 'other_structures', 'foundation']);

/** Whether `value` of `fact` is only placeholder text. */
function isPlaceholder(fact, value) {
  if (typeof value !== 'string' || !WORDS.has(FACTS[fact]?.format)) return false;
  const text = value.trim();
  if (!text) return true;
  if (ANSWERS.has(fact) && /^none$/i.test(text)) return false;
  return text.split(/\s+-\s+|\s*,\s*/).every((part) => TOKEN.test(part));
}

/** Whether `value` of a has-it answer says the home has none of it in other words ("NOT APPLICABLE"). */
const saysNone = (fact, value) => ANSWERS.has(fact) && typeof value === 'string' && /^\s*not applicable\s*$/i.test(value);

/** Drops placeholder facts from every record (held ones too); a has-it answer's "NOT APPLICABLE" becomes "None". @returns counts by fact, for the log */
function dropPlaceholders(records) {
  const dropped = {};
  const sweep = (facts) => {
    for (const [fact, value] of Object.entries(facts || {})) {
      if (saysNone(fact, value)) {
        facts[fact] = 'None';
        dropped[`${fact} as None`] = (dropped[`${fact} as None`] || 0) + 1;
        continue;
      }
      if (!isPlaceholder(fact, value)) continue;
      delete facts[fact];
      dropped[fact] = (dropped[fact] || 0) + 1;
    }
  };
  for (const record of records) {
    sweep(record.facts);
    for (const facts of Object.values(record.held || {})) sweep(facts);
  }
  return dropped;
}

module.exports = { isPlaceholder, dropPlaceholders };

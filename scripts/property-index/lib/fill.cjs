'use strict';
// A county's own building facts added to the records another file already gives that county (Florida's roll, or the county's
// own parcel layer), matched by parcel number. Only homes take them (a house, a mobile home, a condo unit), only facts a record lacks, and only from a
// parcel with one dwelling: a guest house's rooms or a duplex's sum isn't the home's own count. Every record and account
// stays as it was, so a county already serving loses nothing it had.

const HOMES = new Set(['property', 'unit']);

/**
 * @param {object[]} records                  The county's records, changed in place
 * @param {Map<string, object[]>} dwellings   Each parcel's dwellings, each as the facts its building gives
 * @param {object} [options]
 * @param {(record: object) => string} [options.keyOf]   A record's key in `dwellings`: its parcel number, unless the file needs more
 *   (a parcel number that repeats from town to town)
 * @param {(facts: object, found: object) => boolean} [options.agrees]   Whether the file's dwelling is the record's home: a count both
 *   give that differs means one of them is about another building, so neither is changed
 * @param {string[]} [options.only]   The facts this file may add, when it's trusted for some and not others (an older file's bath counts
 *   but not its bedrooms); its other counts still decide whether it agrees
 * @returns {{ homes: number, filled: number, several: number, differ: number, facts: Object<string, number> }} counts for the log
 */
function fillHomes(records, dwellings, { keyOf = (record) => record.facts.parcel_number, agrees = () => true, only = null } = {}) {
  const counts = { homes: 0, filled: 0, several: 0, differ: 0, facts: {} };
  for (const record of records) {
    const { kind, facts, restricted } = record;
    if (!HOMES.has(kind) || restricted || !facts) continue;
    counts.homes += 1;
    const found = dwellings.get(keyOf(record));
    if (!found?.length) continue;
    if (found.length > 1) {
      counts.several += 1;
      continue;
    }
    if (!agrees(facts, found[0])) {
      counts.differ += 1;
      continue;
    }
    let added = 0;
    for (const [fact, value] of Object.entries(found[0])) {
      if (value === null || value === undefined || facts[fact] !== undefined || (only && !only.includes(fact))) continue;
      if (fact === 'stories' && kind === 'unit') continue;
      facts[fact] = value;
      counts.facts[fact] = (counts.facts[fact] || 0) + 1;
      added += 1;
    }
    if (added) counts.filled += 1;
  }
  return counts;
}

/** "2.5" baths as the facts a record keeps: a half is one half bath. Odd fractions and placeholders say nothing. */
function bathFacts(total, most = 12) {
  if (!(total > 0) || total > most || (total * 2) % 1) return {};
  const full = Math.floor(total);
  return { bathrooms: total, ...(full ? { full_baths: full } : {}), ...(total % 1 ? { half_baths: 1 } : {}) };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "November 2026" from "2026-11-04", for a dataset line people read. */
const monthOf = (iso) => (/^(\d{4})-(\d{2})/.test(iso || '') ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : 'current');
/** "October 30, 2026" from "2026-10-30". */
const dayOf = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : 'an unknown date');

/** One line for the build log: counts only. */
const describe = (county, { homes, filled, several, differ = 0, facts }) => `${county}: ${filled} of ${homes} homes gained facts from the county's file`
  + ` (${Object.entries(facts).map(([fact, n]) => `${fact} ${n}`).join(', ') || 'none'}); ${several} parcels with more than one dwelling left as they were`
  + (differ ? `; ${differ} whose counts differ from the file's left as they were` : '');

module.exports = { fillHomes, bathFacts, describe, monthOf, dayOf };

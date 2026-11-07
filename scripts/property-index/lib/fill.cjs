'use strict';
// A county's own building facts added to the records another file already gives that county (Florida's roll), matched by
// parcel number. Only homes take them (a house, a mobile home, a condo unit), only facts a record lacks, and only from a
// parcel with one dwelling: a guest house's rooms or a duplex's sum isn't the home's own count. Every record and account
// stays as it was, so a county already serving loses nothing it had.

const HOMES = new Set(['property', 'unit']);

/**
 * @param {object[]} records                  The county's records, changed in place
 * @param {Map<string, object[]>} dwellings   Each parcel's dwellings, each as the facts its building gives
 * @returns {{ homes: number, filled: number, several: number, facts: Object<string, number> }} counts for the log
 */
function fillHomes(records, dwellings) {
  const counts = { homes: 0, filled: 0, several: 0, facts: {} };
  for (const { kind, facts, restricted } of records) {
    if (!HOMES.has(kind) || restricted || !facts) continue;
    counts.homes += 1;
    const found = dwellings.get(facts.parcel_number);
    if (!found?.length) continue;
    if (found.length > 1) {
      counts.several += 1;
      continue;
    }
    let added = 0;
    for (const [fact, value] of Object.entries(found[0])) {
      if (value === null || value === undefined || facts[fact] !== undefined) continue;
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

/** One line for the build log: counts only. */
const describe = (county, { homes, filled, several, facts }) => `${county}: ${filled} of ${homes} homes gained facts from the county's file`
  + ` (${Object.entries(facts).map(([fact, n]) => `${fact} ${n}`).join(', ') || 'none'}); ${several} parcels with more than one dwelling left as they were`;

module.exports = { fillHomes, bathFacts, describe };

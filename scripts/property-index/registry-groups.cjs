#!/usr/bin/env node
// Splits an address registry run's states into groups of about the same size, one job each, so no job nears GitHub's
// 350-minute limit: the whole country in one job measured about 330 minutes on an average runner (11-07). Every job reads
// the National Address Database and Overture whole (about 50 minutes) before its own states, so more groups save little.
// Prints the workflow's matrix as JSON: [{"group":1,"of":4,"states":"AK,CA,..."}, ...]
//   node scripts/property-index/registry-groups.cjs [--states WA,OR]   (none: every state and territory)
'use strict';

const MAX_GROUPS = 4;
// Size: the Census Bureau's housing units, in thousands (ACS 2024 5-year, table B25001). The territories it leaves out count as 50.
const HOUSING_UNITS = {
  AK: 328, AL: 2337, AR: 1395, AZ: 3193, CA: 14645, CO: 2589, CT: 1542, DC: 361, DE: 464, FL: 10256, GA: 4542, HI: 568, IA: 1438,
  ID: 795, IL: 5457, IN: 2977, KS: 1294, KY: 2023, LA: 2109, MA: 3030, MD: 2561, ME: 752, MI: 4622, MN: 2545, MO: 2825, MS: 1341,
  MT: 528, NC: 4896, ND: 377, NE: 863, NH: 648, NJ: 3791, NM: 957, NV: 1326, NY: 8585, OH: 5292, OK: 1775, OR: 1858, PA: 5806,
  PR: 1634, RI: 486, SC: 2443, SD: 409, TN: 3144, TX: 12129, UT: 1223, VA: 3685, VT: 339, WA: 3307, WI: 2779, WV: 861, WY: 277,
  VI: 50, GU: 50, AS: 50, MP: 50,
};
const TOTAL = Object.values(HOUSING_UNITS).reduce((sum, n) => sum + n, 0);

function groups(asked) {
  const states = asked ? [...new Set(asked.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean))] : Object.keys(HOUSING_UNITS);
  const unknown = states.filter((code) => !HOUSING_UNITS[code]);
  if (unknown.length) throw new Error(`Not a state code: ${unknown.join(', ')}`);
  if (!states.length) throw new Error('No states named');
  const size = states.reduce((sum, code) => sum + HOUSING_UNITS[code], 0);
  const count = Math.min(MAX_GROUPS, states.length, Math.ceil((size * MAX_GROUPS) / TOTAL));
  const bins = Array.from({ length: count }, () => ({ size: 0, states: [] }));
  // Largest first, each into the smallest group so far.
  for (const code of states.sort((a, b) => HOUSING_UNITS[b] - HOUSING_UNITS[a] || (a < b ? -1 : 1))) {
    const smallest = bins.reduce((min, bin) => (bin.size < min.size ? bin : min));
    smallest.states.push(code);
    smallest.size += HOUSING_UNITS[code];
  }
  return bins.map((bin, i) => ({ group: i + 1, of: count, states: bin.states.sort().join(',') }));
}

try {
  const at = process.argv.indexOf('--states');
  console.log(JSON.stringify(groups(at > 0 ? process.argv[at + 1] || '' : '')));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

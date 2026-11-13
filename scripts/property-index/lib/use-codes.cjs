'use strict';
// What a county's use code means, only from a code list the state or the county publishes: never guessed, never a code
// near one that's listed. Each list says where it was read. A county uses a list only once its connector's column has been
// checked to hold that list's codes (SOURCES below). A code a list doesn't name says nothing.

// Washington: WAC 458-53-030(5), the standard two-digit land use code every county assessor uses ("counties may elect to
// use a more detailed land use code system using additional digits"). Read 2026-11-13 at
// https://app.leg.wa.gov/WAC/default.aspx?cite=458-53-030
const WA_CATEGORIES = [
  [11, 19, 'Residential'], [21, 39, 'Manufacturing'], [41, 49, 'Transportation, communication and utilities'], [50, 59, 'Trade'],
  [61, 69, 'Services'], [71, 79, 'Cultural, entertainment and recreational'], [81, 89, 'Resource production and extraction'],
  [91, 99, 'Undeveloped land and water areas'],
];
const WA_CODES = {
  11: 'Household, single family units', 12: 'Household, 2-4 units', 13: 'Household, multiunits (5 or more)', 14: 'Residential condominiums',
  15: 'Mobile home parks or courts', 16: 'Hotels/motels', 17: 'Institutional lodging', 18: 'All other residential not elsewhere coded', 19: 'Vacation and cabin',
  21: 'Food and kindred products', 22: 'Textile mill products', 23: 'Apparel and other finished products made from fabrics, leather, and similar materials',
  24: 'Lumber and wood products (except furniture)', 25: 'Furniture and fixtures', 26: 'Paper and allied products', 27: 'Printing and publishing', 28: 'Chemicals',
  29: 'Petroleum refining and related industries', 30: 'Rubber and miscellaneous plastic products', 31: 'Leather and leather products',
  32: 'Stone, clay and glass products', 33: 'Primary metal industries', 34: 'Fabricated metal products',
  35: 'Professional scientific, and controlling instruments; photographic and optical goods; watches and clocks-manufacturing', 39: 'Miscellaneous manufacturing',
  41: 'Railroad/transit transportation', 42: 'Motor vehicle transportation', 43: 'Aircraft transportation', 44: 'Marine craft transportation',
  45: 'Highway and street right of way', 46: 'Automobile parking', 47: 'Communication', 48: 'Utilities', 49: 'Other transportation, communication, and utilities not classified elsewhere',
  50: 'Condominiums - Other than residential condominiums', 51: 'Wholesale trade', 52: 'Retail trade - Building materials, hardware, and farm equipment',
  53: 'Retail trade - General merchandise', 54: 'Retail trade - Food', 55: 'Retail trade - Automotive, marine craft, aircraft, and accessories',
  56: 'Retail trade - Apparel and accessories', 57: 'Retail trade - Furniture, home furnishings and equipment', 58: 'Retail trade - Eating and drinking',
  59: 'Other retail trade', 61: 'Finance, insurance, and real estate services', 62: 'Personal services', 63: 'Business services', 64: 'Repair services',
  65: 'Professional services', 66: 'Contract construction services', 67: 'Governmental services', 68: 'Educational services', 69: 'Miscellaneous services',
  71: 'Cultural activities and nature exhibitions', 72: 'Public assembly', 73: 'Amusements', 74: 'Recreational activities', 75: 'Resorts and group camps',
  76: 'Parks', 79: 'Other cultural, entertainment, and recreational', 81: 'Agriculture (not classified under current use law)', 82: 'Agriculture related activities',
  83: 'Agriculture classified under current use chapter 84.34 RCW', 84: 'Fishing activities and related services', 85: 'Mining activities and related services',
  86: 'Cannabis grow operations', 88: 'Designated forest land under chapter 84.33 RCW', 89: 'Other resource production', 91: 'Undeveloped land',
  92: 'Noncommercial forest', 93: 'Water areas', 94: 'Open space land classified under chapter 84.34 RCW', 95: 'Timberland classified under chapter 84.34 RCW',
  99: 'Other undeveloped land',
};
function washington(code) {
  const two = /^(\d{2})\d*$/.exec(String(code || '').trim());
  const n = two && Number(two[1]);
  const subtype = n && WA_CODES[n];
  const category = subtype && WA_CATEGORIES.find(([low, high]) => n >= low && n <= high);
  return category ? { class: category[2], subtype } : null;
}

// New York: the statewide property type classification codes every assessor assigns (use-codes/ny-orps.json, with where
// it was read). Three digits; the hundreds say the category. A local code beyond them ("A1" in New York City) says nothing.
const NY = require('./use-codes/ny-orps.json');
function newYork(code) {
  const text = String(code || '').trim();
  const subtype = /^\d{3}$/.test(text) && NY.codes[text];
  const category = subtype && NY.categories[`${text[0]}00`];
  return category ? { class: category, subtype } : null;
}

// Texas: the Comptroller's property categories (the property value study's category codes). Read 2026-11-13 at
// https://comptroller.texas.gov/auto-data/PT2/PVS/2023F/ALL0000001Y.php. Appraisal districts add their own digits after a
// letter ("A1", "E2"); only the letter, or the letter and digit the Comptroller itself names, says anything, so there is
// a class and no subtype.
const TX_CATEGORIES = {
  A: 'Single-family', B: 'Multifamily', C1: 'Vacant lots', C2: 'Colonia lots', D1: 'Qualified open-space land', D2: 'Farm and ranch improvements',
  E: 'Non-agricultural land and improvements', F1: 'Commercial real property', F2: 'Industrial real property', G: 'Minerals', J: 'Utilities',
  L1: 'Commercial personal property', L2: 'Industrial personal property', M1: 'Mobile homes', N: 'Intangible personal property', O: 'Residential inventory',
  S: 'Special inventory',
};
function texas(code) {
  const text = String(code || '').trim().toUpperCase();
  const two = TX_CATEGORIES[text.slice(0, 2)];
  if (two && /^[CDFLM]\d/.test(text)) return { class: two };
  const one = /^[ABEGJNOS]/.test(text) && TX_CATEGORIES[text[0]];
  return one ? { class: one } : null;
}

// New Jersey: N.J.A.C. 18:12-2.2, the property classes every assessor uses (MOD IV). Read 2026-11-13 at
// https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-18-12-2-2. The class is the whole code: no subtype.
const NJ_CLASSES = {
  1: 'Vacant land', 2: 'Residential property', '3A': 'Farm property (regular)', '3B': 'Farm property (qualified)', '4A': 'Commercial property',
  '4B': 'Industrial property', '4C': 'Apartments', '5A': 'Railroad class I', '5B': 'Railroad class II', '6A': 'Personal property telephone',
  '6B': 'Machinery, apparatus, or equipment of petroleum refineries', '15A': 'Public school property', '15B': 'Other school property', '15C': 'Public property',
  '15D': 'Church and charitable property', '15E': 'Cemeteries and graveyards', '15F': 'Other exempt',
};
function newJersey(code) {
  const name = NJ_CLASSES[String(code || '').trim().toUpperCase()];
  return name ? { class: name } : null;
}

// Florida: the Department of Revenue's land use codes (Field 8, DOR_UC, of the 2023 user's guide to its property tax data
// files, read 2026-11-13 at https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/User%20Guides/
// 2023%20Users%20guide%20and%20quick%20reference/2023_NAL_SDF_NAP_Users_Guide.pdf). Codes 000-099; property appraisers keep
// them as the first two digits of their own four-digit codes ("0100", "0407"), which is how the four counties below write
// them. The residential codes' own words for the subtype; the other groups by the guide's headings, a class only.
const FL_GROUPS = [[0, 9, 'Residential'], [10, 39, 'Commercial'], [40, 49, 'Industrial'], [50, 69, 'Agricultural'], [70, 79, 'Institutional'],
  [80, 89, 'Governmental'], [90, 99, 'Miscellaneous']];
const FL_RESIDENTIAL = {
  0: 'Vacant residential', 1: 'Single family', 2: 'Mobile homes', 3: 'Multi-family, 10 units or more', 4: 'Condominiums', 5: 'Cooperatives',
  6: 'Retirement homes not eligible for exemption', 7: 'Miscellaneous residential (migrant camps, boarding homes, etc.)', 8: 'Multi-family, fewer than 10 units',
  9: 'Residential common elements or areas',
};
function florida(code) {
  const text = String(code || '').trim();
  const m = /^(\d{2})(\d{2})?$|^0(\d{2})$/.exec(text);
  if (!m) return null;
  const n = Number(m[1] ?? m[3]);
  const group = FL_GROUPS.find(([low, high]) => n >= low && n <= high);
  if (!group) return null;
  return FL_RESIDENTIAL[n] !== undefined && group[2] === 'Residential' ? { class: group[2], subtype: FL_RESIDENTIAL[n] } : { class: group[2] };
}

const LISTS = {
  'wa-dor': { read: washington, list: 'the Washington Department of Revenue’s land use codes', field: 'land use code' },
  'ny-orps': { read: newYork, list: 'New York State’s property class codes', field: 'property class code' },
  'tx-ptad': { read: texas, list: 'the Texas Comptroller’s property categories', field: 'state category code' },
  'nj-modiv': { read: newJersey, list: 'New Jersey’s property classes', field: 'property class' },
  'fl-dor': { read: florida, list: 'the Florida Department of Revenue’s land use codes', field: 'land use code' },
};

// Connectors whose use code column holds a list's codes, checked against each county's own values (VXDERIVE sample).
// Checked: the share of each source's home codes the list reads, in the VXDERIVE sample of Nov 13 (a code a list doesn't name says nothing).
const SOURCES = {
  ...Object.fromEntries(['wa-parcels', 'wa-kitsap', 'wa-skagit', 'wa-pierce', 'wa-clark'].map((source) => [source, 'wa-dor'])),
  ...Object.fromEntries(['ny-parcels', 'ny-rolls', 'ny-county-files', 'ny-monroe'].map((source) => [source, 'ny-orps'])),
  'nj-modiv': 'nj-modiv',
  // Florida: only where the code's first two digits match each home's own type in the sample (single family 01, mobile 02,
  // condominium 04, cooperative 05). fl-roll, fl-broward and the other appraiser files carry a county's own code ("00" on
  // single family homes), so they get none.
  ...Object.fromEntries(['fl-hillsborough', 'fl-miami-dade', 'fl-sarasota', 'fl-seminole'].map((source) => [source, 'fl-dor'])),
  ...Object.fromEntries(['tx-atascosa', 'tx-bastrop', 'tx-bell', 'tx-bexar', 'tx-brazos', 'tx-cameron', 'tx-collin', 'tx-dallas', 'tx-denton', 'tx-ector',
    'tx-fort-bend', 'tx-grayson', 'tx-gregg', 'tx-harris', 'tx-hidalgo', 'tx-johnson', 'tx-kaufman', 'tx-liberty', 'tx-montgomery', 'tx-nueces', 'tx-smith',
    'tx-tarrant', 'tx-taylor', 'tx-travis'].map((source) => [source, 'tx-ptad'])),
};

/**
 * @returns {{ words: (facts) => ({ class, subtype }|null), from: string }|null} for a county whose connector's use code is a published list's
 */
function useCodeWords(county) {
  const listId = SOURCES[county.source];
  const list = listId && LISTS[listId];
  if (!list) return null;
  return {
    words: (facts) => (facts.county_use_code === undefined ? null : list.read(facts.county_use_code)),
    from: `From ${county.publisher}’s ${list.field}, in ${list.list}`,
  };
}

module.exports = { useCodeWords, LISTS, SOURCES };

/**
 * Resolve a US state from a typed address string, locally.
 *
 * WHY THIS EXISTS. The anonymous Unlisted route (`GET /api/public/unlisted`)
 * needs exactly one thing out of the address someone types: the two-letter
 * state, because the answer it returns is identical for everyone in that
 * state. It used to get that by geocoding through Mapbox — while the panel
 * directly above the input told the reader "we do not save this address, and
 * we do not send it anywhere else."
 *
 * That sentence is the basis on which a frightened person decides to type at
 * all, and it was false. This module makes it true. The audience for that
 * page is disproportionately someone hiding from a specific person; a
 * third-party hop they were told did not happen is exactly the kind of
 * promise that must not be approximate.
 *
 * PRECISION OVER COVERAGE. A wrong state is worse here than no state: it
 * would show someone the wrong state's confidentiality program, and for the
 * three states with none it would tell them no help exists. So an explicit
 * state token always wins over a ZIP inference, ambiguous input resolves to
 * null, and null is a first-class answer the caller renders as "we could not
 * place that" — never as "you are outside the United States."
 */

const STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

const STATE_NAME_TO_CODE = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d c': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

// ZIP 3-digit prefix ranges → state. USPS assigns these geographically and
// they have been stable for decades. Ranges that belong to territories
// (PR/VI/GU/MP), to military APO/FPO (340, 090–098), or that are unassigned
// are deliberately ABSENT: they must resolve to null, not to a neighbour.
const ZIP_PREFIX_RANGES = [
  [5, 5, 'NY'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'],
  [50, 59, 'VT'], [60, 69, 'CT'], [70, 89, 'NJ'], [100, 149, 'NY'],
  [150, 196, 'PA'], [197, 199, 'DE'], [200, 200, 'DC'], [201, 201, 'VA'],
  [202, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'],
  [270, 289, 'NC'], [290, 299, 'SC'], [300, 319, 'GA'], [320, 339, 'FL'],
  [341, 349, 'FL'], [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'],
  [398, 399, 'GA'], [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'],
  [480, 499, 'MI'], [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'],
  [570, 577, 'SD'], [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'],
  [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'], [700, 714, 'LA'],
  [716, 729, 'AR'], [730, 749, 'OK'], [750, 799, 'TX'], [800, 816, 'CO'],
  [820, 831, 'WY'], [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'],
  [870, 884, 'NM'], [885, 885, 'TX'], [889, 898, 'NV'], [900, 961, 'CA'],
  [967, 968, 'HI'], [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
];

function stateFromZip(zip5) {
  const prefix = Number(zip5.slice(0, 3));
  if (!Number.isInteger(prefix)) return null;
  for (const [lo, hi, code] of ZIP_PREFIX_RANGES) {
    if (prefix >= lo && prefix <= hi) return code;
  }
  return null;
}

/**
 * Best-effort two-letter US state for a typed address, or null.
 *
 * Order matters. An explicit state written by the person beats a ZIP
 * inference, and a ZIP that disagrees with a stated state is ignored rather
 * than allowed to override it — someone who wrote "Portland, OR" gets Oregon
 * even if they mistyped the ZIP.
 *
 * @param {string} raw the address exactly as typed
 * @returns {string|null} e.g. 'OR'
 */
function resolveUsState(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  // Normalize once for name matching: lowercase, punctuation → space.
  const flat = text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. A two-letter code in the trailing position US addresses put it —
  //    after the city, before an optional ZIP.
  //
  //    This runs BEFORE the full-name rule, and that order is load-bearing:
  //    plenty of US cities are named after other states. "Kansas City, MO"
  //    must resolve to Missouri, and "Indiana, PA" to Pennsylvania. The
  //    trailing slot is where a US address puts its state, so a code found
  //    there beats a state name found in the city.
  //
  //    Scanning the WHOLE string for any two-letter token would misfire
  //    constantly — "IN", "OR", "ME", "HI", "OK", "DE" and "LA" are all
  //    ordinary English words — so this only looks at the tail, and only at
  //    a token that is either last or followed by a ZIP.
  const tokens = flat.split(' ');
  for (let i = tokens.length - 1; i >= 0 && i >= tokens.length - 3; i -= 1) {
    const token = tokens[i].toUpperCase();
    if (!STATE_CODES.has(token)) continue;
    const rest = tokens.slice(i + 1);
    if (rest.length === 0 || (rest.length === 1 && /^\d{5}(-\d{4})?$/.test(rest[0]))) {
      return token;
    }
  }

  // 2. A full state name. The LAST one in the string wins, for the same
  //    reason: "Kansas City, Missouri" ends in the state, and the city name
  //    that happens to be another state comes earlier. Ties break on the
  //    longer name, so "West Virginia" is never read as "Virginia".
  //    Compared on where each match ENDS, not where it starts: "West
  //    Virginia" and "Virginia" end at the same place, so only the
  //    length tie-break separates them, and the longer name wins.
  let bestName = null;
  let bestEnd = -1;
  for (const name of Object.keys(STATE_NAME_TO_CODE)) {
    const hit = new RegExp(`(^|\\s)(${name})(\\s|$)`).exec(flat);
    if (!hit) continue;
    const end = hit.index + hit[0].length;
    if (end > bestEnd || (end === bestEnd && bestName && name.length > bestName.length)) {
      bestEnd = end;
      bestName = name;
    }
  }
  if (bestName) return STATE_NAME_TO_CODE[bestName];

  // 3. A ZIP, last. Least trusted, because a transposed digit lands in a
  //    different state silently — but far better than a third-party round
  //    trip for someone who typed only "97214".
  const zip = flat.match(/(^|\s)(\d{5})(-\d{4})?(\s|$)/);
  if (zip) return stateFromZip(zip[2]);

  return null;
}

module.exports = { resolveUsState, STATE_CODES };

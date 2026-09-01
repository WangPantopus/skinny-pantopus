// ============================================================
// Address redaction — what an OUTSIDER may see of a home's address.
//
// The privacy promise on the front door reads: "Neighbors see a first
// name and a street at most. Never a house number or unit." These
// helpers make that true on the two routes that let a signed-in
// non-member look at a home (home discover + the public profile).
//
//   redactStreet('1214 NE Birch St Apt 3')  → 'NE Birch St'
//   redactStreet('1214-1216 NE Birch St')   → 'NE Birch St'
//   redactStreet('PO Box 88')               → 'PO Box'
//   houseNumberOf('1214A NE Birch St')      → '1214a'
//   queryKnowsNumber(['1214','birch'], '1214 NE Birch St') → true
//   firstNameOnly('Yingpeng Wang')          → 'Yingpeng'
//
// `queryKnowsNumber` is the knowledge proof used by discover: a
// searcher who typed the house number already knows it, so the join /
// claim flow still shows them the exact match; everyone else gets the
// street. Pure functions, no I/O.
// ============================================================

const LEADING_NUMBER = /^\s*\d+[A-Za-z]?(?:\s*[-–/]\s*\d+[A-Za-z]?)?\s+/;
const PO_BOX = /^\s*p\.?\s*o\.?\s*box\b/i;
const UNIT_DESIGNATORS = '(?:#|apt\\.?|apartment|unit|suite|ste\\.?|fl\\.?|floor|bldg\\.?|building|lot|rm\\.?|room|space|spc\\.?|trlr\\.?|trailer|dept\\.?|no\\.?)';
// ", Apt 3" / " #12" / " Unit B" / " Suite 200" at the end of the line.
const TRAILING_UNIT = new RegExp(`\\s*,?\\s*${UNIT_DESIGNATORS}\\s*[\\w-]+\\s*$`, 'i');

function clean(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** The house number token (lower-cased), or null when the address has none. */
function houseNumberOf(address) {
  const a = clean(address);
  if (!a || PO_BOX.test(a)) return null;
  const m = a.match(/^(\d+[A-Za-z]?)(?:\s*[-–/]\s*\d+[A-Za-z]?)?\s+/);
  return m ? m[1].toLowerCase() : null;
}

/** Street (and street only) for outsiders: no house number, no unit. */
function redactStreet(address) {
  const a = clean(address);
  if (!a) return null;
  if (PO_BOX.test(a)) return 'PO Box';
  let out = a.replace(LEADING_NUMBER, '');
  // Strip a unit designator at the end (repeat once for "Apt 3, #2").
  out = out.replace(TRAILING_UNIT, '').replace(TRAILING_UNIT, '');
  // A bare "#12"-style suffix without a designator word.
  out = out.replace(/\s*#\s*[\w-]+\s*$/, '');
  out = out.replace(/[,\s]+$/, '').trim();
  return out || null;
}

/** True when the searcher's tokens include this address's house number. */
function queryKnowsNumber(tokens, address) {
  const n = houseNumberOf(address);
  if (!n || !Array.isArray(tokens)) return false;
  return tokens.some((t) => String(t).toLowerCase() === n);
}

/** "Yingpeng Wang" → "Yingpeng"; null-safe. */
function firstNameOnly(name) {
  const n = clean(name);
  if (!n) return null;
  return n.split(' ')[0];
}

module.exports = { redactStreet, houseNumberOf, queryKnowsNumber, firstNameOnly };

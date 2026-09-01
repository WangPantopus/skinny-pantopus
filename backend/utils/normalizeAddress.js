/**
 * Address Normalization Utility
 *
 * Single source of truth for address normalization and hashing.
 * Every address comparison and deduplication in the system must use
 * computeAddressHash() — never raw pipe-joined strings.
 */

const crypto = require('crypto');

// Street/direction abbreviation expansions
const ABBREVS = {
  st:  'street',
  ave: 'avenue',
  blvd: 'boulevard',
  dr:  'drive',
  ln:  'lane',
  rd:  'road',
  ct:  'court',
  pl:  'place',
  cir: 'circle',
  apt: 'apartment',
  ste: 'suite',
  n:   'north',
  s:   'south',
  e:   'east',
  w:   'west',
  ne:  'northeast',
  nw:  'northwest',
  se:  'southeast',
  sw:  'southwest',
};

/**
 * Expand known abbreviations in a string.
 * Matches whole words only (word-boundary delimited).
 *
 * @param {string} str
 * @returns {string}
 */
function expandAbbreviations(str) {
  return str.replace(/\b([a-z]+)\b/g, (match) => ABBREVS[match] || match);
}

/**
 * Normalize a single address part: trim, lowercase, collapse whitespace,
 * and expand abbreviations.
 *
 * @param {*} part - any value (string, number, null, undefined)
 * @returns {string}
 */
function normalizePart(part) {
  const str = (part == null ? '' : String(part)).trim().toLowerCase();
  // Collapse multiple spaces to single space
  const collapsed = str.replace(/\s+/g, ' ');
  return expandAbbreviations(collapsed);
}

/**
 * Build a normalized pipe-joined address string.
 *
 * @param {string} address  - street address (e.g. "123 Main St")
 * @param {string} unit     - unit/apt number (e.g. "Apt 2B"), can be null/empty
 * @param {string} city
 * @param {string} state
 * @param {string} zip
 * @param {string} [country='US']
 * @returns {string} normalized pipe-joined string
 */
function normalizeAddress(address, unit, city, state, zip, country = 'US') {
  const parts = [address, unit || '', city, state, zip, country];
  return parts.map(normalizePart).join('|');
}

/**
 * Compute a SHA-256 hex digest of the normalized address.
 * This is the value stored in Home.address_hash and HomeAddress.address_hash.
 *
 * @param {string} address
 * @param {string} unit
 * @param {string} city
 * @param {string} state
 * @param {string} zip
 * @param {string} [country='US']
 * @returns {string} 64-char hex SHA-256 hash
 */
function computeAddressHash(address, unit, city, state, zip, country = 'US') {
  const normalized = normalizeAddress(address, unit, city, state, zip, country);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = { normalizeAddress, computeAddressHash, expandAbbreviations };

// ============================================================
// TEST: Address Normalization Utility
// Validates normalization, abbreviation expansion, and SHA-256
// hashing for address deduplication.
// ============================================================

const {
  normalizeAddress,
  computeAddressHash,
  expandAbbreviations,
} = require('../../utils/normalizeAddress');

// ── expandAbbreviations ─────────────────────────────────────
describe('expandAbbreviations', () => {
  test('expands street abbreviations', () => {
    expect(expandAbbreviations('123 main st')).toBe('123 main street');
    expect(expandAbbreviations('456 oak ave')).toBe('456 oak avenue');
    expect(expandAbbreviations('789 elm blvd')).toBe('789 elm boulevard');
    expect(expandAbbreviations('10 pine dr')).toBe('10 pine drive');
    expect(expandAbbreviations('22 maple ln')).toBe('22 maple lane');
    expect(expandAbbreviations('33 cedar rd')).toBe('33 cedar road');
    expect(expandAbbreviations('44 birch ct')).toBe('44 birch court');
    expect(expandAbbreviations('55 willow pl')).toBe('55 willow place');
    expect(expandAbbreviations('66 ash cir')).toBe('66 ash circle');
  });

  test('expands unit abbreviations', () => {
    expect(expandAbbreviations('apt 2b')).toBe('apartment 2b');
    expect(expandAbbreviations('ste 100')).toBe('suite 100');
  });

  test('expands directional abbreviations', () => {
    expect(expandAbbreviations('n main st')).toBe('north main street');
    expect(expandAbbreviations('s oak ave')).toBe('south oak avenue');
    expect(expandAbbreviations('e elm blvd')).toBe('east elm boulevard');
    expect(expandAbbreviations('w pine dr')).toBe('west pine drive');
    expect(expandAbbreviations('ne 42nd st')).toBe('northeast 42nd street');
    expect(expandAbbreviations('nw broadway')).toBe('northwest broadway');
    expect(expandAbbreviations('se division st')).toBe('southeast division street');
    expect(expandAbbreviations('sw harbor blvd')).toBe('southwest harbor boulevard');
  });

  test('does not expand abbreviations inside longer words', () => {
    expect(expandAbbreviations('street')).toBe('street');
    expect(expandAbbreviations('nest')).toBe('nest');
    expect(expandAbbreviations('dryer')).toBe('dryer');
    expect(expandAbbreviations('estate')).toBe('estate');
  });

  test('handles empty and already-expanded words', () => {
    expect(expandAbbreviations('')).toBe('');
    expect(expandAbbreviations('main street')).toBe('main street');
  });
});

// ── normalizeAddress ────────────────────────────────────────
describe('normalizeAddress', () => {
  test('basic normalization: lowercases, trims, expands abbreviations', () => {
    const result = normalizeAddress('123 Main St', '', 'Portland', 'OR', '97201');
    expect(result).toBe('123 main street||portland|or|97201|us');
  });

  test('handles null/undefined unit as empty string', () => {
    const withNull = normalizeAddress('123 Main St', null, 'Portland', 'OR', '97201');
    const withUndefined = normalizeAddress('123 Main St', undefined, 'Portland', 'OR', '97201');
    const withEmpty = normalizeAddress('123 Main St', '', 'Portland', 'OR', '97201');
    expect(withNull).toBe(withEmpty);
    expect(withUndefined).toBe(withEmpty);
  });

  test('normalizes unit with abbreviation expansion', () => {
    const result = normalizeAddress('123 Main St', 'Apt 2B', 'Portland', 'OR', '97201');
    expect(result).toBe('123 main street|apartment 2b|portland|or|97201|us');
  });

  test('collapses multiple spaces', () => {
    const result = normalizeAddress('123   Main    St', '', 'Portland', 'OR', '97201');
    expect(result).toBe('123 main street||portland|or|97201|us');
  });

  test('trims leading and trailing whitespace', () => {
    const result = normalizeAddress('  123 Main St  ', '  ', '  Portland  ', ' OR ', ' 97201 ');
    expect(result).toBe('123 main street||portland|or|97201|us');
  });

  test('handles custom country', () => {
    const result = normalizeAddress('123 Main St', '', 'Toronto', 'ON', 'M5V 2T6', 'CA');
    expect(result).toBe('123 main street||toronto|on|m5v 2t6|ca');
  });

  test('defaults country to US', () => {
    const result = normalizeAddress('123 Main St', '', 'Portland', 'OR', '97201');
    expect(result).toContain('|us');
  });

  test('handles numeric zip codes', () => {
    const result = normalizeAddress('123 Main St', '', 'Portland', 'OR', 97201);
    expect(result).toBe('123 main street||portland|or|97201|us');
  });

  test('full directional address', () => {
    const result = normalizeAddress('456 NE Sandy Blvd', 'Ste 200', 'Portland', 'OR', '97232');
    expect(result).toBe('456 northeast sandy boulevard|suite 200|portland|or|97232|us');
  });
});

// ── computeAddressHash ──────────────────────────────────────
describe('computeAddressHash', () => {
  test('returns a 64-character hex string (SHA-256)', () => {
    const hash = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('same input produces the same hash every time', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash3 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  test('different addresses produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('456 Oak Ave', '', 'Portland', 'OR', '97201');
    expect(hash1).not.toBe(hash2);
  });

  test('different units produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', 'Apt 1A', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', 'Apt 1B', 'Portland', 'OR', '97201');
    expect(hash1).not.toBe(hash2);
  });

  test('different cities produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Seattle', 'WA', '98101');
    expect(hash1).not.toBe(hash2);
  });

  test('abbreviation vs expanded form produce the SAME hash', () => {
    const hashAbbrev = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashExpanded = computeAddressHash('123 Main Street', '', 'Portland', 'OR', '97201');
    expect(hashAbbrev).toBe(hashExpanded);
  });

  test('case differences produce the SAME hash', () => {
    const hashUpper = computeAddressHash('123 MAIN ST', '', 'PORTLAND', 'OR', '97201');
    const hashLower = computeAddressHash('123 main st', '', 'portland', 'or', '97201');
    expect(hashUpper).toBe(hashLower);
  });

  test('extra whitespace produces the SAME hash', () => {
    const hashNormal = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashSpaces = computeAddressHash('  123  Main  St  ', '  ', '  Portland  ', ' OR ', ' 97201 ');
    expect(hashNormal).toBe(hashSpaces);
  });

  test('null unit and empty unit produce the SAME hash', () => {
    const hashNull = computeAddressHash('123 Main St', null, 'Portland', 'OR', '97201');
    const hashEmpty = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hashNull).toBe(hashEmpty);
  });
});

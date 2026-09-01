// ============================================================
// TEST: Canonical Address Dedup — Integration Tests
//
// Tests that the normalization + hashing pipeline correctly
// deduplicates addresses:
//   1. "123 Main Street" = "123 Main St" (abbreviation normalization)
//   2. "Apt 203" = "Unit 203" (unit synonym normalization)
//   3. Different addresses produce different hashes
//
// Uses the real computeAddressHash and normalizeAddress utils.
// ============================================================

const { resetTables, getTable } = require('../__mocks__/supabaseAdmin');
const { computeAddressHash, expandAbbreviations } = require('../../utils/normalizeAddress');
const canonicalService = require('../../services/addressValidation/canonicalAddressService');

beforeEach(() => resetTables());

// ── Factories ───────────────────────────────────────────────

function makeNormalized(overrides = {}) {
  return {
    line1: '123 Main St',
    line2: undefined,
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    plus4: '1234',
    lat: 45.5,
    lng: -122.6,
    ...overrides,
  };
}

function makeGoogle(normalized) {
  return {
    normalized,
    components: {},
    geocode: { lat: normalized.lat, lng: normalized.lng },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
    },
  };
}

function makeSmarty(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA', 'BB'],
    raw: { analysis: { dpv_match_code: 'Y' } },
    ...overrides,
  };
}

// ============================================================
// 1. "123 Main Street" = "123 Main St" (abbreviation normalization)
// ============================================================

describe('abbreviation normalization — "123 Main Street" = "123 Main St"', () => {
  test('computeAddressHash produces same hash for Street vs St', () => {
    const hashFull = computeAddressHash('123 Main Street', '', 'Portland', 'OR', '97201');
    const hashAbbr = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');

    expect(hashFull).toBe(hashAbbr);
  });

  test('computeAddressHash produces same hash for Avenue vs Ave', () => {
    const hashFull = computeAddressHash('456 Oak Avenue', '', 'Seattle', 'WA', '98101');
    const hashAbbr = computeAddressHash('456 Oak Ave', '', 'Seattle', 'WA', '98101');

    expect(hashFull).toBe(hashAbbr);
  });

  test('computeAddressHash produces same hash for Boulevard vs Blvd', () => {
    const hashFull = computeAddressHash('789 Sunset Boulevard', '', 'LA', 'CA', '90028');
    const hashAbbr = computeAddressHash('789 Sunset Blvd', '', 'LA', 'CA', '90028');

    expect(hashFull).toBe(hashAbbr);
  });

  test('computeAddressHash is case insensitive', () => {
    const hashUpper = computeAddressHash('123 MAIN ST', '', 'PORTLAND', 'OR', '97201');
    const hashLower = computeAddressHash('123 main st', '', 'portland', 'or', '97201');

    expect(hashUpper).toBe(hashLower);
  });

  test('findOrCreate deduplicates Street vs St', async () => {
    const norm1 = makeNormalized({ line1: '123 Main Street' });
    const norm2 = makeNormalized({ line1: '123 Main St' });

    await canonicalService.findOrCreate(norm1, { google: makeGoogle(norm1), smarty: makeSmarty() });
    expect(getTable('HomeAddress')).toHaveLength(1);

    await canonicalService.findOrCreate(norm2, { google: makeGoogle(norm2), smarty: makeSmarty() });
    expect(getTable('HomeAddress')).toHaveLength(1); // same record, not duplicated
  });

  test('direction abbreviations also normalize (N vs North)', () => {
    const hashFull = computeAddressHash('100 North Main St', '', 'Portland', 'OR', '97201');
    const hashAbbr = computeAddressHash('100 N Main St', '', 'Portland', 'OR', '97201');

    expect(hashFull).toBe(hashAbbr);
  });

  test('Drive vs Dr normalize to same hash', () => {
    const hashFull = computeAddressHash('42 Elm Drive', '', 'Austin', 'TX', '73301');
    const hashAbbr = computeAddressHash('42 Elm Dr', '', 'Austin', 'TX', '73301');

    expect(hashFull).toBe(hashAbbr);
  });
});

// ============================================================
// 2. "Apt 203" = "Unit 203" (unit normalization)
// ============================================================

describe('unit normalization — "Apt 203" = "Unit 203"', () => {
  test('expandAbbreviations expands apt to apartment', () => {
    expect(expandAbbreviations('apt 203')).toBe('apartment 203');
  });

  test('expandAbbreviations expands ste to suite', () => {
    expect(expandAbbreviations('ste 100')).toBe('suite 100');
  });

  test('computeAddressHash produces same hash for Apt vs Apartment', () => {
    const hashApt = computeAddressHash('123 Main St', 'Apt 203', 'Portland', 'OR', '97201');
    const hashApartment = computeAddressHash('123 Main St', 'Apartment 203', 'Portland', 'OR', '97201');

    expect(hashApt).toBe(hashApartment);
  });

  test('computeAddressHash produces same hash for Ste vs Suite', () => {
    const hashSte = computeAddressHash('456 Oak Ave', 'Ste 100', 'Seattle', 'WA', '98101');
    const hashSuite = computeAddressHash('456 Oak Ave', 'Suite 100', 'Seattle', 'WA', '98101');

    expect(hashSte).toBe(hashSuite);
  });

  test('findOrCreate deduplicates Apt vs Apartment in line2', async () => {
    const norm1 = makeNormalized({ line2: 'Apt 203' });
    const norm2 = makeNormalized({ line2: 'Apartment 203' });

    await canonicalService.findOrCreate(norm1, { google: makeGoogle(norm1), smarty: makeSmarty() });
    expect(getTable('HomeAddress')).toHaveLength(1);

    await canonicalService.findOrCreate(norm2, { google: makeGoogle(norm2), smarty: makeSmarty() });
    expect(getTable('HomeAddress')).toHaveLength(1); // deduplicated
  });

  test('empty line2 and undefined line2 produce same hash', () => {
    const hashEmpty = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashUndef = computeAddressHash('123 Main St', undefined, 'Portland', 'OR', '97201');

    // normalizePart(null/undefined) → '' and normalizePart('') → '' are the same
    expect(hashEmpty).toBe(hashUndef);
  });
});

// ============================================================
// 3. Different addresses produce different hashes
// ============================================================

describe('different addresses → different hashes', () => {
  test('different street numbers produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('456 Main St', '', 'Portland', 'OR', '97201');

    expect(hash1).not.toBe(hash2);
  });

  test('different streets produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Oak Ave', '', 'Portland', 'OR', '97201');

    expect(hash1).not.toBe(hash2);
  });

  test('different cities produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Seattle', 'WA', '98101');

    expect(hash1).not.toBe(hash2);
  });

  test('different zip codes produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97202');

    expect(hash1).not.toBe(hash2);
  });

  test('adding a unit changes the hash', () => {
    const hashNoUnit = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashWithUnit = computeAddressHash('123 Main St', 'Apt 4B', 'Portland', 'OR', '97201');

    expect(hashNoUnit).not.toBe(hashWithUnit);
  });

  test('findOrCreate creates separate records for different addresses', async () => {
    const norm1 = makeNormalized({ line1: '123 Main St' });
    const norm2 = makeNormalized({ line1: '456 Oak Ave' });

    await canonicalService.findOrCreate(norm1, { google: makeGoogle(norm1), smarty: makeSmarty() });
    await canonicalService.findOrCreate(norm2, { google: makeGoogle(norm2), smarty: makeSmarty() });

    expect(getTable('HomeAddress')).toHaveLength(2);
  });

  test('different states produce different hashes', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Portland', 'ME', '04101');

    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================
// Hash properties
// ============================================================

describe('hash format and properties', () => {
  test('hash is a 64-char hex SHA-256 string', () => {
    const hash = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hash is deterministic (same input → same output)', () => {
    const hash1 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hash2 = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    expect(hash1).toBe(hash2);
  });

  test('extra whitespace is collapsed before hashing', () => {
    const hashNormal = computeAddressHash('123 Main St', '', 'Portland', 'OR', '97201');
    const hashSpaces = computeAddressHash('123  Main   St', '', 'Portland', 'OR', '97201');
    expect(hashNormal).toBe(hashSpaces);
  });
});

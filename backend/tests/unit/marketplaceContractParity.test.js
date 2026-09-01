/**
 * marketplaceContractParity.test.js
 *
 * Ensures backend marketplace constants stay in sync with the frontend
 * canonical contract (frontend/packages/ui-utils/src/marketplace-contract.ts).
 *
 * Would have caught every mismatch from the Phase 0B audit:
 *   - baby_kids vs kids_baby
 *   - sports vs sports_outdoors
 *   - books vs books_media
 *   - pets in frontend but not backend
 *   - poor vs for_parts
 *   - toys in API types
 */

const fs = require('fs');
const path = require('path');

const {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_LAYERS,
  LISTING_TYPES,
  LOCATION_PRECISIONS,
  REVEAL_POLICIES,
  VISIBILITY_SCOPES,
} = require('../../constants/marketplace');

// ---------------------------------------------------------------------------
// Parse the frontend contract file
// ---------------------------------------------------------------------------

const CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../frontend/packages/ui-utils/src/marketplace-contract.ts',
);

const contractSource = fs.readFileSync(CONTRACT_PATH, 'utf-8');

/**
 * Extract keys from a TS `as const` array of { key: '...' } objects.
 * Matches patterns like: { key: 'furniture', label: 'Furniture' }
 */
function extractObjectKeys(source, arrayName) {
  // Match the array declaration up to its closing bracket
  const arrayRegex = new RegExp(
    `export\\s+const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
  );
  const match = source.match(arrayRegex);
  if (!match) {
    throw new Error(`Could not find array '${arrayName}' in contract file`);
  }
  const body = match[1];
  const keys = [];
  const keyRegex = /key:\s*'([^']+)'/g;
  let m;
  while ((m = keyRegex.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Extract values from a TS `as const` simple string array.
 * Matches patterns like: ['goods', 'gigs', 'rentals', 'vehicles'] as const
 */
function extractStringArray(source, arrayName) {
  const arrayRegex = new RegExp(
    `export\\s+const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
  );
  const match = source.match(arrayRegex);
  if (!match) {
    throw new Error(`Could not find array '${arrayName}' in contract file`);
  }
  const body = match[1];
  const values = [];
  const valRegex = /'([^']+)'/g;
  let m;
  while ((m = valRegex.exec(body)) !== null) {
    values.push(m[1]);
  }
  return values;
}

const frontendCategories = extractObjectKeys(contractSource, 'LISTING_CATEGORIES');
const frontendConditions = extractObjectKeys(contractSource, 'LISTING_CONDITIONS');
const frontendLayers = extractStringArray(contractSource, 'LISTING_LAYERS');
const frontendTypes = extractStringArray(contractSource, 'LISTING_TYPES');
const frontendPrecisions = extractStringArray(contractSource, 'LOCATION_PRECISIONS');
const frontendRevealPolicies = extractStringArray(contractSource, 'REVEAL_POLICIES');
const frontendVisibilityScopes = extractStringArray(contractSource, 'VISIBILITY_SCOPES');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertArrayParity(backendArr, frontendArr, label) {
  const backendSet = new Set(backendArr);
  const frontendSet = new Set(frontendArr);

  for (const val of frontendArr) {
    if (!backendSet.has(val)) {
      throw new Error(`${label} '${val}' exists in frontend contract but not in backend`);
    }
  }
  for (const val of backendArr) {
    if (!frontendSet.has(val)) {
      throw new Error(`${label} '${val}' exists in backend but not in frontend contract`);
    }
  }
}

function assertNoDuplicates(arr, label) {
  const seen = new Set();
  for (const val of arr) {
    if (seen.has(val)) {
      throw new Error(`Duplicate ${label} '${val}' found`);
    }
    seen.add(val);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Marketplace contract parity', () => {
  describe('LISTING_CATEGORIES', () => {
    test('backend and frontend have identical categories', () => {
      assertArrayParity(LISTING_CATEGORIES, frontendCategories, 'Category');
    });

    test('no duplicates in backend', () => {
      assertNoDuplicates(LISTING_CATEGORIES, 'backend category');
    });

    test('no duplicates in frontend', () => {
      assertNoDuplicates(frontendCategories, 'frontend category');
    });
  });

  describe('LISTING_CONDITIONS', () => {
    test('backend and frontend have identical conditions', () => {
      assertArrayParity(LISTING_CONDITIONS, frontendConditions, 'Condition');
    });

    test('no duplicates in backend', () => {
      assertNoDuplicates(LISTING_CONDITIONS, 'backend condition');
    });

    test('no duplicates in frontend', () => {
      assertNoDuplicates(frontendConditions, 'frontend condition');
    });
  });

  describe('LISTING_LAYERS', () => {
    test('backend and frontend have identical layers', () => {
      assertArrayParity(LISTING_LAYERS, frontendLayers, 'Layer');
    });

    test('no duplicates', () => {
      assertNoDuplicates(LISTING_LAYERS, 'layer');
    });
  });

  describe('LISTING_TYPES', () => {
    test('backend and frontend have identical listing types', () => {
      assertArrayParity(LISTING_TYPES, frontendTypes, 'ListingType');
    });

    test('no duplicates', () => {
      assertNoDuplicates(LISTING_TYPES, 'listing type');
    });
  });

  describe('LOCATION_PRECISIONS', () => {
    test('backend and frontend have identical precisions', () => {
      assertArrayParity(LOCATION_PRECISIONS, frontendPrecisions, 'LocationPrecision');
    });

    test('no duplicates', () => {
      assertNoDuplicates(LOCATION_PRECISIONS, 'precision');
    });
  });

  describe('REVEAL_POLICIES', () => {
    test('backend and frontend have identical reveal policies', () => {
      assertArrayParity(REVEAL_POLICIES, frontendRevealPolicies, 'RevealPolicy');
    });

    test('no duplicates', () => {
      assertNoDuplicates(REVEAL_POLICIES, 'reveal policy');
    });
  });

  describe('VISIBILITY_SCOPES', () => {
    test('backend and frontend have identical visibility scopes', () => {
      assertArrayParity(VISIBILITY_SCOPES, frontendVisibilityScopes, 'VisibilityScope');
    });

    test('no duplicates', () => {
      assertNoDuplicates(VISIBILITY_SCOPES, 'visibility scope');
    });
  });

  describe('Autocomplete categories match validation', () => {
    test('marketplaceService uses the same LISTING_CATEGORIES as route validation', () => {
      // The marketplaceService now imports LISTING_CATEGORIES from constants/marketplace.js
      // (the same module used by routes/listings.js). Verify it's the same reference.
      const servicePath = path.resolve(__dirname, '../../services/marketplace/marketplaceService.js');
      const serviceSource = fs.readFileSync(servicePath, 'utf-8');

      // Verify no local LISTING_CATEGORIES redefinition inside autocomplete
      const localRedefinition = serviceSource.match(
        /(?:const|let|var)\s+LISTING_CATEGORIES\s*=/,
      );
      expect(localRedefinition).toBeNull();

      // Verify the import from shared constants exists
      expect(serviceSource).toMatch(/require\(.*constants\/marketplace.*\)/);
    });
  });
});

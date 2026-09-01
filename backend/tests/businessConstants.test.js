// ============================================================
// TEST: Business Constants
// Validates reserved usernames and verification multipliers.
// ============================================================

const {
  RESERVED_USERNAMES,
  VERIFICATION_MULTIPLIERS,
} = require('../utils/businessConstants');

// ── RESERVED_USERNAMES ──────────────────────────────────────
describe('RESERVED_USERNAMES', () => {
  test('contains critical route-conflicting names', () => {
    const critical = ['search', 'map', 'new', 'api', 'admin', 'dashboard', 'businesses'];
    for (const name of critical) {
      expect(RESERVED_USERNAMES.has(name)).toBe(true);
    }
  });

  test('does not contain normal business names', () => {
    const normalNames = ['joes-plumbing', 'acme', 'portland-pizza'];
    for (const name of normalNames) {
      expect(RESERVED_USERNAMES.has(name)).toBe(false);
    }
  });
});

// ── VERIFICATION_MULTIPLIERS ────────────────────────────────
describe('VERIFICATION_MULTIPLIERS', () => {
  test('unverified gets penalty', () => {
    expect(VERIFICATION_MULTIPLIERS.unverified).toBeLessThan(1.0);
  });

  test('self_attested is baseline', () => {
    expect(VERIFICATION_MULTIPLIERS.self_attested).toBe(1.0);
  });

  test('verified gets boost', () => {
    expect(VERIFICATION_MULTIPLIERS.document_verified).toBeGreaterThan(1.0);
    expect(VERIFICATION_MULTIPLIERS.government_verified).toBeGreaterThan(1.0);
    expect(VERIFICATION_MULTIPLIERS.government_verified).toBeGreaterThan(VERIFICATION_MULTIPLIERS.document_verified);
  });
});

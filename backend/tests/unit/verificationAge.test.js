/**
 * §5.1 / LIF-04 — verification was a single bit with no timestamp, so the
 * system could not express "this verification is 29 months old" and every trust
 * decision treated a three-year-old verification and this morning's as
 * identical.
 *
 * These cover the measurement. Enforcement is deliberately behind a flag: the
 * mechanism ships before the policy, because expiring the existing verified
 * base is a product decision.
 */

const { resetTables } = require('../__mocks__/supabaseAdmin');
const verificationAge = require('../../utils/verificationAge');
const flags = require('../../utils/addressRolloutFlags');

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

beforeEach(() => {
  resetTables();
  flags.__setOverrides(null);
});

afterAll(() => flags.stopRolloutFlagRefresh());

describe('age is measurable', () => {
  test('reports whole days since verification', () => {
    expect(verificationAge.ageInDays(daysAgo(30))).toBe(30);
    expect(verificationAge.ageInDays(daysAgo(0))).toBe(0);
  });

  test('an unknown timestamp reports null rather than zero', () => {
    // Zero would read as "verified today", which is the opposite of the truth.
    expect(verificationAge.ageInDays(null)).toBeNull();
    expect(verificationAge.ageInDays('not-a-date')).toBeNull();
  });

  test('expiry is one validity window past verification', () => {
    const at = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const expiry = new Date(verificationAge.expiryFor(at));
    const days = (expiry.getTime() - new Date(at).getTime()) / 86400000;
    expect(days).toBe(verificationAge.validityDays());
  });
});

describe('staleness', () => {
  test('a verification past the window is stale', () => {
    expect(verificationAge.isStale(daysAgo(400))).toBe(true);
  });

  test('a recent verification is not', () => {
    expect(verificationAge.isStale(daysAgo(10))).toBe(false);
  });

  test('an unknown timestamp is NOT stale', () => {
    // Rows predating the column must not have trust revoked on deploy.
    expect(verificationAge.isStale(null)).toBe(false);
  });
});

describe('enforcement is separate from measurement', () => {
  test('staleness costs nothing while the flag is off', () => {
    expect(verificationAge.isStale(daysAgo(400))).toBe(true);
    expect(verificationAge.staleAffectsTrust(daysAgo(400))).toBe(false);
  });

  test('and costs something once it is on', () => {
    flags.__setOverrides({ enforceVerificationExpiry: true });
    expect(verificationAge.staleAffectsTrust(daysAgo(400))).toBe(true);
    expect(verificationAge.staleAffectsTrust(daysAgo(10))).toBe(false);
  });
});

describe('describe()', () => {
  test('surfaces age, staleness and whether it is enforced', () => {
    const out = verificationAge.describe(daysAgo(400));
    expect(out.age_days).toBe(400);
    expect(out.stale).toBe(true);
    expect(out.enforced).toBe(false);
  });
});

describe('enforcement has read sites (the flag changes real behaviour)', () => {
  const { seedTable } = require('../__mocks__/supabaseAdmin');
  const { getAccessibleHomeIds } = require('../../utils/homeMailAccess');

  function seedOccupancy(verifiedAt) {
    seedTable('HomeOccupancy', [{
      id: 'occ-age-1',
      home_id: 'home-age-1',
      user_id: 'user-age-1',
      is_active: true,
      verification_status: 'verified',
      verified_at: verifiedAt,
    }]);
  }

  test('mail access: a stale verification loses the surface when the flag is on', async () => {
    seedOccupancy(daysAgo(verificationAge.validityDays() + 30));

    flags.__setOverrides({ enforceVerificationExpiry: false });
    expect(await getAccessibleHomeIds('user-age-1')).toEqual(['home-age-1']);

    flags.__setOverrides({ enforceVerificationExpiry: true });
    expect(await getAccessibleHomeIds('user-age-1')).toEqual([]);
  });

  test('mail access: a fresh verification is unaffected by the flag', async () => {
    seedOccupancy(daysAgo(3));
    flags.__setOverrides({ enforceVerificationExpiry: true });
    expect(await getAccessibleHomeIds('user-age-1')).toEqual(['home-age-1']);
  });

  test('mail access: a legacy row with no verified_at is never demoted', async () => {
    seedOccupancy(null);
    flags.__setOverrides({ enforceVerificationExpiry: true });
    expect(await getAccessibleHomeIds('user-age-1')).toEqual(['home-age-1']);
  });

  test('mail access: provisional_bootstrap has no verification to age', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-age-2',
      home_id: 'home-age-2',
      user_id: 'user-age-1',
      is_active: true,
      verification_status: 'provisional_bootstrap',
      verified_at: null,
    }]);
    flags.__setOverrides({ enforceVerificationExpiry: true });
    expect(await getAccessibleHomeIds('user-age-1')).toEqual(['home-age-2']);
  });
});

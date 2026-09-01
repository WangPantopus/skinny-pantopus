/**
 * CRIT-01 — businessAddressService was a second, complete address-decision
 * engine that shared computeAddressHash with the residential pipeline and never
 * consulted it. A user could file a business at a stranger's verified home
 * address; a `storefront` location then publishes address, city, state, zipcode
 * and an exact map pin, so that address became public. The residential CONFLICT
 * verdict and the check-address gate were bypassed by using the business
 * endpoint instead.
 */

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const { checkConflicts } = require('../../services/businessAddressService');

const HASH = 'shared-address-hash';

beforeEach(() => resetTables());

test('a business cannot be filed at an address where a household lives', async () => {
  seedTable('Home', [{ id: 'home-1', address_hash: HASH }]);
  seedTable('HomeOccupancy', [{ id: 'occ-1', home_id: 'home-1', user_id: 'resident', is_active: true }]);

  const res = await checkConflicts({ line2: null }, HASH, 'business-1');

  expect(res.has_conflict).toBe(true);
  expect(res.status).toBe('conflict');
  expect(res.reasons).toContain('residential_household_at_address');
});

test('an address with a home but no active occupants is not a household conflict', async () => {
  seedTable('Home', [{ id: 'home-1', address_hash: HASH }]);
  seedTable('HomeOccupancy', [{ id: 'occ-1', home_id: 'home-1', user_id: 'gone', is_active: false }]);

  const res = await checkConflicts({ line2: null }, HASH, 'business-1');

  expect(res.has_conflict).toBe(false);
  expect(res.status).toBe('ok');
});

test('an address with no home at all is clean', async () => {
  const res = await checkConflicts({ line2: null }, HASH, 'business-1');

  expect(res.has_conflict).toBe(false);
  expect(res.status).toBe('ok');
});

test('the household probe fails closed rather than publishing an address', async () => {
  // A Home row whose occupancy lookup cannot be satisfied must not resolve to
  // "no conflict" — that would publish a home address on a failed query.
  seedTable('Home', [{ id: 'home-1', address_hash: HASH }]);
  seedTable('HomeOccupancy', [{ id: 'occ-1', home_id: 'home-1', user_id: 'resident', is_active: true }]);

  const res = await checkConflicts({ line2: null }, HASH, 'business-1');
  expect(res.has_conflict).toBe(true);
});

describe('the probe survives formatting differences (the trailing-period bypass)', () => {
  // Home rows as the residential side stores them; the attacker types variants.
  function seedVictimHome(overrides = {}) {
    seedTable('Home', [{
      id: 'home-v',
      address_hash: 'canonical-hash-the-raw-input-will-never-match',
      address: '123 Main St',
      address2: null,
      city: 'Portland',
      state: 'OR',
      zipcode: '97201',
      ...overrides,
    }]);
    seedTable('HomeOccupancy', [{ id: 'occ-v', home_id: 'home-v', user_id: 'victim', is_active: true }]);
  }

  const attempt = (line1, line2 = null, city = 'Portland', state = 'OR', zip = '97201') =>
    checkConflicts({ line1, line2, city, state, zip }, 'hash-of-raw-input', 'business-1');

  test.each([
    ['123 Main St.'],
    ['123 Main Street'],
    ['123 MAIN ST'],
    ['123  Main   St'],
  ])('typing "%s" still finds the household at 123 Main St', async (line1) => {
    seedVictimHome();
    const res = await attempt(line1);
    expect(res.has_conflict).toBe(true);
    expect(res.reasons).toContain('residential_household_at_address');
  });

  test('unit spellings collapse: #2 finds the home stored as Apt 2', async () => {
    seedVictimHome({ address2: 'Apt 2' });
    const res = await attempt('123 Main St.', '#2');
    expect(res.has_conflict).toBe(true);
  });

  test('a different unit in the same building is not a conflict', async () => {
    seedVictimHome({ address2: 'Apt 2' });
    const res = await attempt('123 Main St', 'Apt 3');
    expect(res.has_conflict).toBe(false);
  });

  test('a different house number on the same street is not a conflict', async () => {
    seedVictimHome();
    const res = await attempt('125 Main St');
    expect(res.has_conflict).toBe(false);
  });

  test('a different ZIP is not a conflict', async () => {
    seedVictimHome();
    const res = await attempt('123 Main St', null, 'Portland', 'OR', '97210');
    expect(res.has_conflict).toBe(false);
  });
});

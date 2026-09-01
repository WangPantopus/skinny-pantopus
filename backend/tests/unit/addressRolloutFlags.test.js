/**
 * CRIT-06 — the address enforcement flags were a frozen process.env snapshot,
 * invisible to the admin-flippable, audit-logged feature-flag service in the
 * same codebase. The only way to change enforcement posture was an environment
 * change plus a full redeploy: no gradual ramp, no instant rollback, no record
 * of who changed it.
 */

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const flags = require('../../utils/addressRolloutFlags');
const featureFlagService = require('../../services/featureFlagService');

beforeEach(() => {
  resetTables();
  flags.__setOverrides(null);
  featureFlagService.invalidateFlagCache();
});

afterAll(() => flags.stopRolloutFlagRefresh());

describe('reads stay synchronous', () => {
  test('falls back to the environment value when no row exists', () => {
    // config defaults are all false in production
    expect(flags.getRolloutFlag('enforceMixedUseStepUp')).toBe(false);
  });

  test('every known flag resolves to a boolean', () => {
    const all = flags.getAllRolloutFlags();
    expect(Object.keys(all)).toEqual(Object.keys(flags.FLAG_NAMES));
    for (const value of Object.values(all)) {
      expect(typeof value).toBe('boolean');
    }
  });

  test('an unknown flag throws rather than reporting disabled', () => {
    // A typo must not silently read as "enforcement off".
    expect(() => flags.getRolloutFlag('enforceTypoStepUp')).toThrow(/Unknown address rollout flag/);
  });
});

describe('database overrides win over the environment', () => {
  test('an enabled row turns enforcement on without a redeploy', async () => {
    seedTable('FeatureFlag', [{
      id: 'f1',
      flag_name: 'address.enforce_mixed_use_step_up',
      enabled_globally: true,
      enabled_for_internal_team: false,
      beta_user_ids: [],
    }]);

    await flags.refreshRolloutFlags();

    expect(flags.getRolloutFlag('enforceMixedUseStepUp')).toBe(true);
    // untouched flags stay on their environment value
    expect(flags.getRolloutFlag('enableParcelProvider')).toBe(false);
  });

  test('a disabled row is an explicit off, not an absence', async () => {
    seedTable('FeatureFlag', [{
      id: 'f1',
      flag_name: 'address.enable_place_provider',
      enabled_globally: false,
      enabled_for_internal_team: false,
      beta_user_ids: [],
    }]);

    await flags.refreshRolloutFlags();
    expect(flags.getRolloutFlag('enablePlaceProvider')).toBe(false);
  });
});

describe('flag names', () => {
  test('every rollout key in config has a registered flag name', () => {
    const addressConfig = require('../../config/addressVerification');
    expect(Object.keys(flags.FLAG_NAMES).sort())
      .toEqual(Object.keys(addressConfig.rollout).sort());
  });
});

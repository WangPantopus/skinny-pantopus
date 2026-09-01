jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const reconcileHomeHouseholdResolution = require('../../jobs/reconcileHomeHouseholdResolution');

describe('reconcileHomeHouseholdResolution', () => {
  beforeEach(() => {
    resetTables();
  });

  test('reconciles stale household resolution state', async () => {
    seedTable('Home', [{
      id: 'home-1',
      household_resolution_state: 'contested',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      owner_status: 'verified',
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      state: 'submitted',
      claim_phase_v2: 'under_review',
      challenge_state: 'none',
      merged_into_claim_id: null,
    }]);

    const result = await reconcileHomeHouseholdResolution({ dryRun: false });

    expect(result.changed).toBe(1);
    expect(getTable('Home')[0].household_resolution_state).toBe('verified_household');
  });

  test('is idempotent when no change is needed', async () => {
    seedTable('Home', [{
      id: 'home-1',
      household_resolution_state: 'unclaimed',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOwnershipClaim', []);

    const result = await reconcileHomeHouseholdResolution({ dryRun: false });

    expect(result.changed).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(getTable('Home')[0].household_resolution_state).toBe('unclaimed');
  });
});

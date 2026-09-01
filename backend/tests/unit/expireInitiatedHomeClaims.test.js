jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const expireInitiatedHomeClaims = require('../../jobs/expireInitiatedHomeClaims');

describe('expireInitiatedHomeClaims', () => {
  beforeEach(() => {
    resetTables();
  });

  test('expires initiated claims and reconciles home resolution', async () => {
    seedTable('Home', [{
      id: 'home-1',
      household_resolution_state: 'pending_single_claim',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      state: 'draft',
      claim_phase_v2: 'initiated',
      terminal_reason: 'none',
      challenge_state: 'none',
      merged_into_claim_id: null,
      expires_at: '2026-04-04T00:00:00.000Z',
    }]);

    const result = await expireInitiatedHomeClaims({
      dryRun: false,
      now: '2026-04-05T00:00:00.000Z',
    });

    expect(result.expired).toBe(1);
    expect(getTable('HomeOwnershipClaim')[0].state).toBe('revoked');
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('expired');
    expect(getTable('HomeOwnershipClaim')[0].terminal_reason).toBe('expired_no_evidence');
    expect(getTable('Home')[0].household_resolution_state).toBe('unclaimed');
  });

  test('supports dry-run mode without mutating rows', async () => {
    seedTable('Home', [{ id: 'home-1', household_resolution_state: 'pending_single_claim' }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      state: 'draft',
      claim_phase_v2: 'initiated',
      terminal_reason: 'none',
      challenge_state: 'none',
      merged_into_claim_id: null,
      expires_at: '2026-04-04T00:00:00.000Z',
    }]);

    const result = await expireInitiatedHomeClaims({
      dryRun: true,
      now: '2026-04-05T00:00:00.000Z',
    });

    expect(result.expired).toBe(1);
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('initiated');
  });
});

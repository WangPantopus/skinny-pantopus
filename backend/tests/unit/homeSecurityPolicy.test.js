jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('homeSecurityPolicy.canSubmitOwnerClaim', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION;

    const supabaseMock = require('../__mocks__/supabaseAdmin');
    supabaseMock.resetTables();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadPolicy() {
    return require('../../utils/homeSecurityPolicy');
  }

  function seedBaseTables() {
    const { seedTable } = require('../__mocks__/supabaseAdmin');
    seedTable('Home', [{
      id: 'home-1',
      security_state: 'normal',
      tenure_mode: 'owner_occupied',
      owner_claim_policy: 'open',
      home_status: 'active',
    }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOwnershipClaim', []);
  }

  test('returns routing classification for an allowed standalone submission', async () => {
    seedBaseTables();
    const policy = loadPolicy();

    await expect(policy.canSubmitOwnerClaim('home-1', 'user-1')).resolves.toMatchObject({
      allowed: true,
      blockCode: null,
      routingClassification: 'standalone_claim',
    });
  });

  test('preserves current block while exposing parallel classification metadata when flag is off', async () => {
    seedBaseTables();
    const { seedTable, getTable } = require('../__mocks__/supabaseAdmin');
    seedTable('HomeOwnershipClaim', [
      ...getTable('HomeOwnershipClaim'),
      {
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-2',
        state: 'submitted',
        claim_phase_v2: 'under_review',
        merged_into_claim_id: null,
        created_at: '2026-04-04T00:00:00.000Z',
      },
    ]);
    const policy = loadPolicy();

    await expect(policy.canSubmitOwnerClaim('home-1', 'user-1')).resolves.toMatchObject({
      allowed: false,
      blockCode: 'EXISTING_IN_FLIGHT_CLAIM',
      routingClassification: 'parallel_claim',
      flags: expect.objectContaining({
        parallelSubmission: false,
      }),
    });
  });

  test('allows competing claimant through when parallel submission flag is on', async () => {
    seedBaseTables();
    const { seedTable, getTable } = require('../__mocks__/supabaseAdmin');
    seedTable('HomeOwnershipClaim', [
      ...getTable('HomeOwnershipClaim'),
      {
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-2',
        state: 'submitted',
        claim_phase_v2: 'under_review',
        merged_into_claim_id: null,
        created_at: '2026-04-04T00:00:00.000Z',
      },
    ]);
    process.env.HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION = 'true';

    const policy = loadPolicy();

    await expect(policy.canSubmitOwnerClaim('home-1', 'user-1')).resolves.toMatchObject({
      allowed: true,
      blockCode: null,
      routingClassification: 'parallel_claim',
      flags: expect.objectContaining({
        parallelSubmission: true,
      }),
    });
  });
});

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeClaimComparisonService');

describe('homeClaimComparisonService', () => {
  beforeEach(() => {
    resetTables();
  });

  test('builds comparison payload with incumbents, active claims, and evidence', async () => {
    seedTable('Home', [{
      id: 'home-1',
      name: 'Test Home',
      address: '123 Test St',
      city: 'Testville',
      state: 'CA',
      zipcode: '90210',
      security_state: 'normal',
      household_resolution_state: 'contested',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    }]);
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'user-owner',
      owner_status: 'verified',
      is_primary_owner: true,
      verification_tier: 'strong',
      added_via: 'claim',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    }]);
    seedTable('HomeOwnershipClaim', [
      {
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-claimant',
        claim_type: 'owner',
        state: 'submitted',
        claim_phase_v2: 'under_review',
        terminal_reason: 'none',
        challenge_state: 'none',
        claim_strength: 'owner_legal',
        routing_classification: 'standalone_claim',
        identity_status: 'not_started',
        merged_into_claim_id: null,
        method: 'doc_upload',
        risk_score: 10,
        created_at: '2026-04-02T00:00:00.000Z',
        updated_at: '2026-04-02T00:00:00.000Z',
      },
      {
        id: 'claim-2',
        home_id: 'home-1',
        claimant_user_id: 'user-old',
        claim_type: 'owner',
        state: 'rejected',
        claim_phase_v2: 'rejected',
        terminal_reason: 'rejected_review',
        challenge_state: 'none',
        merged_into_claim_id: null,
      },
    ]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-1',
      claim_id: 'claim-1',
      evidence_type: 'deed',
      provider: 'manual',
      status: 'verified',
      confidence_level: 'high',
      metadata: {},
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    }]);
    seedTable('User', [
      {
        id: 'user-owner',
        username: 'owner',
        name: 'Owner User',
        email: 'owner@example.com',
        profile_picture_url: null,
        created_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'user-claimant',
        username: 'claimant',
        name: 'Claimant User',
        email: 'claimant@example.com',
        profile_picture_url: null,
        created_at: '2026-03-05T00:00:00.000Z',
      },
    ]);

    const result = await service.buildHomeClaimComparison('home-1');

    expect(result.home_id).toBe('home-1');
    expect(result.household_resolution_state).toBe('contested');
    expect(result.incumbent.has_verified_owner).toBe(true);
    expect(result.incumbent.owners).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].id).toBe('claim-1');
    expect(result.claims[0].claimant.name).toBe('Claimant User');
    expect(result.claims[0].evidence).toHaveLength(1);
  });

  test('returns null when home does not exist', async () => {
    seedTable('Home', []);
    await expect(service.buildHomeClaimComparison('missing-home')).resolves.toBeNull();
  });
});

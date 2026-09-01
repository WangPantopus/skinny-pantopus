jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

const service = require('../../services/homeClaimRoutingService');

describe('homeClaimRoutingService', () => {
  beforeEach(() => {
    resetTables();
  });

  describe('mapLegacyStateToPhaseV2', () => {
    test.each([
      ['draft', 'initiated'],
      ['submitted', 'evidence_submitted'],
      ['needs_more_info', 'under_review'],
      ['pending_review', 'under_review'],
      ['pending_challenge_window', 'under_review'],
      ['approved', 'verified'],
      ['rejected', 'rejected'],
      ['disputed', 'challenged'],
      ['revoked', 'rejected'],
    ])('maps %s to %s', (legacyState, expected) => {
      expect(service.mapLegacyStateToPhaseV2(legacyState)).toBe(expected);
    });

    test('returns null for unknown legacy states', () => {
      expect(service.mapLegacyStateToPhaseV2('under_review')).toBeNull();
    });
  });

  describe('isLegacyStateActive', () => {
    test.each([
      'draft',
      'submitted',
      'needs_more_info',
      'pending_review',
      'pending_challenge_window',
    ])('treats %s as active', (state) => {
      expect(service.isLegacyStateActive(state)).toBe(true);
    });

    test.each([
      'approved',
      'rejected',
      'disputed',
      'revoked',
    ])('treats %s as inactive', (state) => {
      expect(service.isLegacyStateActive(state)).toBe(false);
    });
  });

  describe('isClaimPhaseActive', () => {
    test.each([
      'initiated',
      'evidence_submitted',
      'under_review',
      'challenged',
    ])('treats %s as active', (phase) => {
      expect(service.isClaimPhaseActive(phase)).toBe(true);
    });

    test.each([
      'verified',
      'expired',
      'merged_into_household',
      'rejected',
    ])('treats %s as inactive', (phase) => {
      expect(service.isClaimPhaseActive(phase)).toBe(false);
    });
  });

  describe('isClaimActiveRecord', () => {
    test('prefers claim_phase_v2 when present', () => {
      expect(service.isClaimActiveRecord({
        state: 'draft',
        claim_phase_v2: 'expired',
        merged_into_claim_id: null,
      })).toBe(false);
    });

    test('ignores merged claims', () => {
      expect(service.isClaimActiveRecord({
        state: 'submitted',
        claim_phase_v2: 'under_review',
        merged_into_claim_id: 'claim-parent',
      })).toBe(false);
    });
  });

  describe('deriveHomeResolutionState', () => {
    test('returns disputed when verified owner and active challenge exist', () => {
      expect(service.deriveHomeResolutionState({
        activeClaims: 0,
        hasVerifiedOwner: true,
        hasActiveChallenge: true,
      })).toBe('disputed');
    });

    test('returns verified_household when verified owner and no active challenge exist', () => {
      expect(service.deriveHomeResolutionState({
        activeClaims: 3,
        hasVerifiedOwner: true,
        hasActiveChallenge: false,
      })).toBe('verified_household');
    });

    test('returns pending_single_claim when one active claim exists', () => {
      expect(service.deriveHomeResolutionState({
        activeClaims: 1,
        hasVerifiedOwner: false,
        hasActiveChallenge: false,
      })).toBe('pending_single_claim');
    });

    test('returns contested when multiple active claims exist', () => {
      expect(service.deriveHomeResolutionState({
        activeClaims: 2,
        hasVerifiedOwner: false,
        hasActiveChallenge: false,
      })).toBe('contested');
    });

    test('returns unclaimed when no verified owner or active claim exists', () => {
      expect(service.deriveHomeResolutionState({
        activeClaims: 0,
        hasVerifiedOwner: false,
        hasActiveChallenge: false,
      })).toBe('unclaimed');
    });
  });

  describe('deriveInitialRoutingClassification', () => {
    test('defaults new claims to standalone_claim', () => {
      expect(service.deriveInitialRoutingClassification()).toBe('standalone_claim');
    });

    test('classifies as parallel when another active claimant exists', () => {
      expect(service.deriveInitialRoutingClassification({
        hasOtherActiveIndependentClaim: true,
      })).toBe('parallel_claim');
    });

    test('classifies as challenge when a verified owner exists', () => {
      expect(service.deriveInitialRoutingClassification({
        hasVerifiedOwner: true,
      })).toBe('challenge_claim');
    });

    test('keeps invite-style claims standalone', () => {
      expect(service.deriveInitialRoutingClassification({
        method: 'invite',
        hasVerifiedOwner: true,
        hasOtherActiveIndependentClaim: true,
      })).toBe('standalone_claim');
    });
  });

  describe('deriveInitialIdentityStatus', () => {
    test('defaults to not_started for Phase 2', () => {
      expect(service.deriveInitialIdentityStatus({ method: 'doc_upload' })).toBe('not_started');
    });
  });

  describe('deriveClaimStrength', () => {
    test('returns null when no evidence exists', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'owner',
      }]);
      seedTable('HomeVerificationEvidence', []);

      await expect(service.deriveClaimStrength('claim-1')).resolves.toBeNull();
    });

    test('derives owner_legal from deed evidence', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'owner',
      }]);
      seedTable('HomeVerificationEvidence', [{
        id: 'evidence-1',
        claim_id: 'claim-1',
        evidence_type: 'deed',
        status: 'verified',
      }]);

      await expect(service.deriveClaimStrength('claim-1')).resolves.toBe('owner_legal');
    });

    test('keeps the strongest obvious evidence classification', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'owner',
      }]);
      seedTable('HomeVerificationEvidence', [
        {
          id: 'evidence-1',
          claim_id: 'claim-1',
          evidence_type: 'tax_bill',
          status: 'verified',
        },
        {
          id: 'evidence-2',
          claim_id: 'claim-1',
          evidence_type: 'closing_disclosure',
          status: 'verified',
        },
      ]);

      await expect(service.deriveClaimStrength('claim-1')).resolves.toBe('owner_strong');
    });

    test('derives resident_standard for resident proof', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'resident',
      }]);
      seedTable('HomeVerificationEvidence', [{
        id: 'evidence-1',
        claim_id: 'claim-1',
        evidence_type: 'lease',
        status: 'verified',
      }]);

      await expect(service.deriveClaimStrength('claim-1')).resolves.toBe('resident_standard');
    });

    test('ignores unverified evidence when deriving strength', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'owner',
      }]);
      seedTable('HomeVerificationEvidence', [{
        id: 'evidence-1',
        claim_id: 'claim-1',
        evidence_type: 'deed',
        status: 'pending',
      }]);

      await expect(service.deriveClaimStrength('claim-1')).resolves.toBeNull();
    });

    test('can include uploaded but unverified evidence when explicitly requested', async () => {
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        claim_type: 'owner',
      }]);
      seedTable('HomeVerificationEvidence', [{
        id: 'evidence-1',
        claim_id: 'claim-1',
        evidence_type: 'deed',
        status: 'pending',
      }]);

      await expect(service.deriveClaimStrength('claim-1', { includeUnverified: true })).resolves.toBe('owner_legal');
    });
  });

  describe('classifySubmission', () => {
    test('returns standalone when no owners or competing active claims exist', async () => {
      seedTable('HomeOwner', []);
      seedTable('HomeOwnershipClaim', []);

      await expect(service.classifySubmission({
        homeId: 'home-1',
        userId: 'user-1',
      })).resolves.toMatchObject({
        routingClassification: 'standalone_claim',
        hasVerifiedOwner: false,
        hasOtherActiveIndependentClaim: false,
        activeIndependentClaimCount: 0,
      });
    });

    test('returns parallel when another active claimant exists', async () => {
      seedTable('HomeOwner', []);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-2',
        state: 'submitted',
        claim_phase_v2: 'under_review',
        merged_into_claim_id: null,
      }]);

      await expect(service.classifySubmission({
        homeId: 'home-1',
        userId: 'user-1',
      })).resolves.toMatchObject({
        routingClassification: 'parallel_claim',
        hasVerifiedOwner: false,
        hasOtherActiveIndependentClaim: true,
        activeIndependentClaimCount: 1,
      });
    });

    test('returns challenge when a verified owner exists', async () => {
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', []);

      await expect(service.classifySubmission({
        homeId: 'home-1',
        userId: 'user-1',
      })).resolves.toMatchObject({
        routingClassification: 'challenge_claim',
        hasVerifiedOwner: true,
      });
    });

    test('keeps invite submissions standalone even with verified owners', async () => {
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', []);

      await expect(service.classifySubmission({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'invite',
      })).resolves.toMatchObject({
        routingClassification: 'standalone_claim',
      });
    });
  });

  describe('syncClaimChallengeState', () => {
    test('promotes strong challenge claims into challenged state', async () => {
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        state: 'submitted',
        claim_phase_v2: 'evidence_submitted',
        routing_classification: 'challenge_claim',
        claim_strength: 'owner_legal',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.syncClaimChallengeState('claim-1')).resolves.toBe(true);

      expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('challenged');
      expect(getTable('HomeOwnershipClaim')[0].challenge_state).toBe('challenged');
    });

    test('does not promote weak challenge claims', async () => {
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        state: 'submitted',
        claim_phase_v2: 'evidence_submitted',
        routing_classification: 'challenge_claim',
        claim_strength: 'owner_standard',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.syncClaimChallengeState('claim-1')).resolves.toBe(false);

      expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('evidence_submitted');
      expect(getTable('HomeOwnershipClaim')[0].challenge_state).toBe('none');
    });
  });

  describe('recalculateHomeResolutionState', () => {
    test('stores pending_single_claim for one active claim', async () => {
      seedTable('Home', [{ id: 'home-1' }]);
      seedTable('HomeOwner', []);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'submitted',
        challenge_state: 'none',
      }]);

      await expect(service.recalculateHomeResolutionState('home-1')).resolves.toBe('pending_single_claim');

      expect(getTable('Home')[0].household_resolution_state).toBe('pending_single_claim');
      expect(getTable('Home')[0].household_resolution_updated_at).toBeTruthy();
    });

    test('stores verified_household when verified owner exists without active challenge', async () => {
      seedTable('Home', [{ id: 'home-1' }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'submitted',
        challenge_state: 'none',
      }]);

      await expect(service.recalculateHomeResolutionState('home-1')).resolves.toBe('verified_household');
      expect(getTable('Home')[0].household_resolution_state).toBe('verified_household');
    });

    test('stores disputed when verified owner exists and a challenged claim is active', async () => {
      seedTable('Home', [{ id: 'home-1', security_state: 'normal', claim_window_ends_at: null }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'approved',
        challenge_state: 'challenged',
      }]);

      await expect(service.recalculateHomeResolutionState('home-1')).resolves.toBe('disputed');
      expect(getTable('Home')[0].household_resolution_state).toBe('disputed');
      expect(getTable('Home')[0].security_state).toBe('normal');
    });

    test('ignores expired initiated claims when recalculating', async () => {
      seedTable('Home', [{ id: 'home-1' }]);
      seedTable('HomeOwner', []);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'draft',
        claim_phase_v2: 'expired',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.recalculateHomeResolutionState('home-1')).resolves.toBe('unclaimed');
      expect(getTable('Home')[0].household_resolution_state).toBe('unclaimed');
    });

    test('preserves existing operational security_state when no qualifying challenge remains', async () => {
      seedTable('Home', [{
        id: 'home-1',
        security_state: 'disputed',
        household_resolution_state: 'disputed',
        claim_window_ends_at: null,
      }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'rejected',
        claim_phase_v2: 'rejected',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.recalculateHomeResolutionState('home-1')).resolves.toBe('verified_household');
      expect(getTable('Home')[0].household_resolution_state).toBe('verified_household');
      expect(getTable('Home')[0].security_state).toBe('disputed');
    });
  });

  describe('reconcileOperationalDisputeState', () => {
    test('clears claim-driven disputed security when the home is no longer disputed', async () => {
      seedTable('Home', [{
        id: 'home-1',
        security_state: 'disputed',
        ownership_state: 'disputed',
        claim_window_ends_at: null,
      }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'rejected',
        claim_phase_v2: 'rejected',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.reconcileOperationalDisputeState('home-1')).resolves.toBe(true);
      expect(getTable('Home')[0].security_state).toBe('normal');
      expect(getTable('Home')[0].ownership_state).toBe('owner_verified');
    });

    test('preserves manual disputed security when ownership_state is not claim-disputed', async () => {
      seedTable('Home', [{
        id: 'home-1',
        security_state: 'disputed',
        ownership_state: 'owner_verified',
        claim_window_ends_at: null,
      }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'rejected',
        claim_phase_v2: 'rejected',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.reconcileOperationalDisputeState('home-1')).resolves.toBe(false);
      expect(getTable('Home')[0].security_state).toBe('disputed');
      expect(getTable('Home')[0].ownership_state).toBe('owner_verified');
    });

    test('can clear a resolved claim dispute explicitly after challenge adjudication', async () => {
      seedTable('Home', [{
        id: 'home-1',
        security_state: 'disputed',
        ownership_state: 'owner_verified',
        claim_window_ends_at: null,
      }]);
      seedTable('HomeOwner', [{
        id: 'owner-1',
        home_id: 'home-1',
        owner_status: 'verified',
      }]);
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-1',
        home_id: 'home-1',
        state: 'approved',
        claim_phase_v2: 'verified',
        challenge_state: 'none',
        merged_into_claim_id: null,
      }]);

      await expect(service.reconcileOperationalDisputeState('home-1', { force: true })).resolves.toBe(true);
      expect(getTable('Home')[0].security_state).toBe('normal');
      expect(getTable('Home')[0].ownership_state).toBe('owner_verified');
    });
  });
});

const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async () => ({ hasAccess: true })),
  writeAuditLog: jest.fn(async () => {}),
  applyOccupancyTemplate: jest.fn(async () => ({ occupancy: { id: 'occ-1' } })),
  mapLegacyRole: jest.fn((role) => role),
}));
jest.mock('../../utils/homeSecurityPolicy', () => ({
  canSubmitOwnerClaim: jest.fn(async () => ({ allowed: true, errors: [], blockCode: null })),
  evaluateRentalFirewall: jest.fn(() => ({ blocked: false })),
  getClaimRiskScore: jest.fn(async () => 0),
  isClaimWindowActive: jest.fn(() => false),
  recalculateTier: jest.fn(async () => 'weak'),
  shouldTriggerDispute: jest.fn(() => false),
  getClaimWindowEndsAt: jest.fn(() => new Date('2026-04-30T00:00:00.000Z')),
}));
jest.mock('../../services/propertyDataService', () => ({
  isAvailable: jest.fn(() => false),
  verifyPropertyOwnership: jest.fn(),
}));
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(async () => ({ id: 'notification-1' })),
  notifyHomeInvite: jest.fn(async () => ({ id: 'notification-2' })),
  notifyHomeInviteAccepted: jest.fn(async () => ({ id: 'notification-3' })),
  notifyOwnershipDispute: jest.fn(async () => ({ id: 'notification-4' })),
}));
jest.mock('../../middleware/rateLimiter', () => ({
  ownershipClaimLimiter: (_req, _res, next) => next(),
  postcardLimiter: (_req, _res, next) => next(),
  verificationAttemptLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn(async () => ({ success: true, occupancy: { id: 'occ-1' } })),
}));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const policy = require('../../utils/homeSecurityPolicy');
const propertyDataService = require('../../services/propertyDataService');
const householdClaimConfig = require('../../config/householdClaims');
const occupancyAttachService = require('../../services/occupancyAttachService');
const notificationService = require('../../services/notificationService');
const homeClaimCompatService = require('../../services/homeClaimCompatService');

const router = require('../../routes/homeOwnership');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', router);
  return app;
}

function seedBaseHome(overrides = {}) {
  seedTable('Home', [{
    id: 'home-1',
    address: '123 Test St',
    city: 'Testville',
    state: 'CA',
    zipcode: '90210',
    security_state: 'normal',
    tenure_mode: 'owner_occupied',
    owner_claim_policy: 'open',
    claim_window_ends_at: null,
    home_status: 'active',
    owner_id: null,
    ...overrides,
  }]);
}

function futureIso(days = 1) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe('homeOwnership Phase 2 compatibility writes', () => {
  const app = createApp();

  beforeEach(() => {
    resetTables();
    Object.assign(householdClaimConfig.flags, {
      v2ReadPaths: false,
      parallelSubmission: false,
      inviteMerge: false,
      challengeFlow: false,
      adminCompare: false,
    });
    policy.shouldTriggerDispute.mockReturnValue(false);
    propertyDataService.isAvailable.mockReturnValue(false);
    propertyDataService.verifyPropertyOwnership.mockReset();
    occupancyAttachService.attach.mockClear();
    notificationService.createNotification.mockClear();
    notificationService.notifyHomeInvite.mockClear();
    notificationService.notifyHomeInviteAccepted.mockClear();
    notificationService.notifyOwnershipDispute.mockClear();
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', []);
    seedTable('HomeVerificationEvidence', []);
    seedTable('HomeOwnershipClaim', []);
    seedTable('HomeInvite', []);
    seedTable('User', []);
  });

  test('claim creation writes Phase 2 compatibility fields', async () => {
    seedBaseHome();

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims')
      .set('x-test-user-id', 'user-1')
      .send({
        claim_type: 'owner',
        method: 'doc_upload',
      });

    expect(res.status).toBe(201);

    const claim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];

    expect(claim.state).toBe('submitted');
    expect(claim.claim_phase_v2).toBe('evidence_submitted');
    expect(claim.routing_classification).toBe('standalone_claim');
    expect(claim.identity_status).toBe('not_started');
    expect(claim.terminal_reason).toBe('none');
    expect(claim.challenge_state).toBe('none');
    expect(home.household_resolution_state).toBe('pending_single_claim');
    expect(home.household_resolution_updated_at).toBeTruthy();
  });

  test('evidence upload updates v2 lifecycle metadata', async () => {
    seedBaseHome({
      household_resolution_state: 'unclaimed',
      household_resolution_updated_at: null,
    });
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'user-1',
      claim_type: 'owner',
      state: 'draft',
      method: 'doc_upload',
      claim_phase_v2: 'initiated',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'standalone_claim',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-1/evidence')
      .set('x-test-user-id', 'user-1')
      .send({
        evidence_type: 'deed',
        provider: 'manual',
        metadata: {},
      });

    expect(res.status).toBe(201);

    const claim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];

    expect(claim.state).toBe('submitted');
    expect(claim.claim_phase_v2).toBe('evidence_submitted');
    expect(claim.claim_strength).toBeNull();
    expect(claim.terminal_reason).toBe('none');
    expect(claim.challenge_state).toBe('none');
    expect(home.household_resolution_state).toBe('pending_single_claim');
  });

  test('review rejection updates v2 terminal metadata and home resolution', async () => {
    seedBaseHome({
      household_resolution_state: 'pending_single_claim',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
    });
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'user-1',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'evidence_submitted',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'standalone_claim',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-1/review')
      .set('x-test-user-id', 'owner-1')
      .send({
        action: 'reject',
        note: 'Insufficient evidence',
      });

    expect(res.status).toBe(200);

    const claim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];

    expect(claim.state).toBe('rejected');
    expect(claim.claim_phase_v2).toBe('rejected');
    expect(claim.terminal_reason).toBe('rejected_review');
    expect(claim.challenge_state).toBe('none');
    expect(home.household_resolution_state).toBe('unclaimed');
    expect(home.household_resolution_updated_at).toBeTruthy();
  });

  test('rejecting a challenged claim clears claim-driven disputed security when no active challenge remains', async () => {
    seedBaseHome({
      security_state: 'disputed',
      ownership_state: 'disputed',
      household_resolution_state: 'disputed',
      owner_id: 'owner-incumbent',
    });
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-incumbent',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'user-1',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'challenged',
      terminal_reason: 'none',
      challenge_state: 'challenged',
      identity_status: 'not_started',
      routing_classification: 'challenge_claim',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-1/review')
      .set('x-test-user-id', 'owner-incumbent')
      .send({
        action: 'reject',
        note: 'Challenge denied',
      });

    expect(res.status).toBe(200);

    const home = getTable('Home')[0];
    expect(home.household_resolution_state).toBe('verified_household');
    expect(home.security_state).toBe('normal');
    expect(home.ownership_state).toBe('owner_verified');
  });

  test('second owner approval verifies claim without auto dispute or security escalation', async () => {
    policy.shouldTriggerDispute.mockReturnValue(true);

    seedBaseHome({
      security_state: 'normal',
      household_resolution_state: 'verified_household',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
      owner_id: 'owner-incumbent',
    });
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-incumbent',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'user-1',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'evidence_submitted',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'standalone_claim',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-1',
      claim_id: 'claim-1',
      evidence_type: 'deed',
      status: 'verified',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-1/review')
      .set('x-test-user-id', 'owner-1')
      .send({
        action: 'approve',
        note: 'Second verified co-owner',
      });

    expect(res.status).toBe(200);

    const claim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];

    expect(claim.state).toBe('approved');
    expect(claim.claim_phase_v2).toBe('verified');
    expect(claim.challenge_state).toBe('none');
    expect(claim.claim_strength).toBe('owner_legal');
    expect(home.household_resolution_state).toBe('verified_household');
    expect(home.security_state).toBe('normal');

    const claimsRes = await request(app)
      .get('/api/homes/my-ownership-claims')
      .set('x-test-user-id', 'user-1');

    expect(claimsRes.status).toBe(200);
    expect(claimsRes.body.claims[0].status).toBe('approved');
  });

  test('flag-off preserves existing in-flight claimant block', async () => {
    seedBaseHome();
    policy.canSubmitOwnerClaim.mockResolvedValueOnce({
      allowed: false,
      errors: ['Another ownership verification is already in progress for this home'],
      blockCode: 'EXISTING_IN_FLIGHT_CLAIM',
      routingClassification: 'parallel_claim',
      flags: { parallelSubmission: false },
    });

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims')
      .set('x-test-user-id', 'user-2')
      .send({
        claim_type: 'owner',
        method: 'doc_upload',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EXISTING_IN_FLIGHT_CLAIM');
    expect(getTable('HomeOwnershipClaim')).toHaveLength(0);
  });

  test('flag-on allows second claimant and marks home contested', async () => {
    seedBaseHome();
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-existing',
      home_id: 'home-1',
      claimant_user_id: 'user-1',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'evidence_submitted',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'standalone_claim',
      merged_into_claim_id: null,
    }]);
    policy.canSubmitOwnerClaim.mockResolvedValueOnce({
      allowed: true,
      errors: [],
      blockCode: null,
      routingClassification: 'parallel_claim',
      flags: { parallelSubmission: true },
    });

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims')
      .set('x-test-user-id', 'user-2')
      .send({
        claim_type: 'owner',
        method: 'doc_upload',
      });

    expect(res.status).toBe(201);
    expect(res.body.claim.routing_classification).toBe('parallel_claim');
    expect(res.body.home_resolution).toBe('contested');
    expect(res.body.next_step).toBe('upload_evidence');

    const insertedClaim = getTable('HomeOwnershipClaim').find((claim) => claim.claimant_user_id === 'user-2');
    expect(insertedClaim.routing_classification).toBe('parallel_claim');
    expect(getTable('Home')[0].household_resolution_state).toBe('contested');
  });

  test('strong property-data challenge claim moves verified household to disputed', async () => {
    householdClaimConfig.flags.challengeFlow = true;

    seedBaseHome({
      security_state: 'normal',
      household_resolution_state: 'verified_household',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
      owner_id: 'owner-incumbent',
    });
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-incumbent',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('User', [{
      id: 'user-2',
      name: 'Challenger User',
      first_name: 'Challenger',
      last_name: 'User',
    }]);
    policy.canSubmitOwnerClaim.mockResolvedValueOnce({
      allowed: true,
      errors: [],
      blockCode: null,
      routingClassification: 'challenge_claim',
      flags: { parallelSubmission: true },
    });
    propertyDataService.isAvailable.mockReturnValue(true);
    propertyDataService.verifyPropertyOwnership.mockResolvedValue({
      matched: true,
      confidence: 92,
      provider: 'attom',
      details: { source: 'public-record' },
      apn: 'APN-123',
    });

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims')
      .set('x-test-user-id', 'user-2')
      .send({
        claim_type: 'owner',
        method: 'property_data_match',
      });

    expect(res.status).toBe(201);
    expect(res.body.claim.routing_classification).toBe('challenge_claim');
    expect(res.body.claim.claim_phase_v2).toBe('challenged');
    expect(res.body.home_resolution).toBe('disputed');

    const insertedClaim = getTable('HomeOwnershipClaim').find((claim) => claim.claimant_user_id === 'user-2');
    expect(insertedClaim.routing_classification).toBe('challenge_claim');
    expect(insertedClaim.claim_phase_v2).toBe('challenged');
    expect(insertedClaim.challenge_state).toBe('challenged');
    expect(insertedClaim.claim_strength).toBe('owner_legal');
    expect(getTable('Home')[0].household_resolution_state).toBe('disputed');
    expect(getTable('Home')[0].security_state).toBe('normal');
  });

  test('property-data evidence does not activate challenge flow while the flag is off', async () => {
    seedBaseHome({
      security_state: 'normal',
      household_resolution_state: 'verified_household',
      household_resolution_updated_at: '2026-04-04T00:00:00.000Z',
      owner_id: 'owner-incumbent',
    });
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-incumbent',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('User', [{
      id: 'user-2',
      name: 'Challenger User',
      first_name: 'Challenger',
      last_name: 'User',
    }]);
    policy.canSubmitOwnerClaim.mockResolvedValueOnce({
      allowed: true,
      errors: [],
      blockCode: null,
      routingClassification: 'challenge_claim',
      flags: { parallelSubmission: true },
    });
    propertyDataService.isAvailable.mockReturnValue(true);
    propertyDataService.verifyPropertyOwnership.mockResolvedValue({
      matched: true,
      confidence: 92,
      provider: 'attom',
      details: { source: 'public-record' },
      apn: 'APN-123',
    });

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims')
      .set('x-test-user-id', 'user-2')
      .send({
        claim_type: 'owner',
        method: 'property_data_match',
      });

    expect(res.status).toBe(201);
    expect(res.body.claim.claim_phase_v2).toBe('evidence_submitted');

    const insertedClaim = getTable('HomeOwnershipClaim').find((claim) => claim.claimant_user_id === 'user-2');
    expect(insertedClaim.claim_phase_v2).toBe('evidence_submitted');
    expect(insertedClaim.challenge_state).toBe('none');
    expect(getTable('Home')[0].household_resolution_state).toBe('verified_household');
    expect(getTable('Home')[0].security_state).toBe('normal');
  });

  test('claimant-specific evidence path is preserved when multiple claims exist', async () => {
    seedBaseHome();
    seedTable('HomeOwnershipClaim', [
      {
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        claim_phase_v2: 'evidence_submitted',
        terminal_reason: 'none',
        challenge_state: 'none',
        identity_status: 'not_started',
        routing_classification: 'standalone_claim',
        merged_into_claim_id: null,
      },
      {
        id: 'claim-2',
        home_id: 'home-1',
        claimant_user_id: 'user-2',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        claim_phase_v2: 'evidence_submitted',
        terminal_reason: 'none',
        challenge_state: 'none',
        identity_status: 'not_started',
        routing_classification: 'parallel_claim',
        merged_into_claim_id: null,
      },
    ]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/evidence')
      .set('x-test-user-id', 'user-1')
      .send({
        evidence_type: 'deed',
        provider: 'manual',
        metadata: {},
      });

    expect(res.status).toBe(403);
    expect(getTable('HomeVerificationEvidence')).toHaveLength(0);
  });

  test('verified household authority can issue a merge invite to another active claimant', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'parallel_claim',
      merged_into_claim_id: null,
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/resolve-relationship')
      .set('x-test-user-id', 'owner-1')
      .send({
        action: 'invite_to_household',
        note: 'Join as a co-owner',
      });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('invite_to_household');
    expect(getTable('HomeOwnershipClaim')[0].routing_classification).toBe('merge_candidate');
    expect(getTable('HomeInvite')).toHaveLength(1);
    expect(getTable('HomeInvite')[0].invitee_user_id).toBe('user-2');
    expect(getTable('HomeInvite')[0].proposed_preset_key).toBe('claim_merge:claim-2');
    expect(getTable('HomeInvite')[0].proposed_role).toBe('owner');
    expect(getTable('HomeInvite')[0].proposed_role_base).toBe('owner');
    expect(notificationService.notifyHomeInvite).toHaveBeenCalledTimes(1);
  });

  test('resident relationship invite preserves lease-resident identity', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Resident', first_name: 'Pending', username: 'resident' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-resident',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'resident',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'parallel_claim',
      merged_into_claim_id: null,
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-resident/resolve-relationship')
      .set('x-test-user-id', 'owner-1')
      .send({ action: 'invite_to_household' });

    expect(res.status).toBe(200);
    expect(getTable('HomeInvite')).toHaveLength(1);
    expect(getTable('HomeInvite')[0].proposed_role).toBe('renter');
    expect(getTable('HomeInvite')[0].proposed_role_base).toBe('lease_resident');
  });

  test('owner relationship invite requires verified owner authority at creation time', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-manager-1',
      home_id: 'home-1',
      user_id: 'manager-1',
      role: 'manager',
      role_base: 'manager',
      is_active: true,
      verification_status: 'verified',
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'parallel_claim',
      merged_into_claim_id: null,
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/resolve-relationship')
      .set('x-test-user-id', 'manager-1')
      .send({ action: 'invite_to_household' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNER_INVITE_AUTHORITY_REQUIRED');
    expect(getTable('HomeInvite')).toHaveLength(0);
    expect(getTable('HomeOwnershipClaim')[0].routing_classification).toBe('parallel_claim');
    expect(notificationService.notifyHomeInvite).not.toHaveBeenCalled();
  });

  test('flagging an unknown claimant opens dispute review on the home', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      security_state: 'normal',
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'parallel_claim',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-1',
      claim_id: 'claim-2',
      evidence_type: 'deed',
      status: 'pending',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/resolve-relationship')
      .set('x-test-user-id', 'owner-1')
      .send({
        action: 'flag_unknown_person',
        note: 'I do not recognize this claimant',
      });

    expect(res.status).toBe(200);
    expect(res.body.home_resolution_state).toBe('disputed');

    const claim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];
    expect(claim.routing_classification).toBe('challenge_claim');
    expect(claim.claim_phase_v2).toBe('challenged');
    expect(claim.challenge_state).toBe('challenged');
    expect(claim.claim_strength).toBe('owner_legal');
    expect(home.household_resolution_state).toBe('disputed');
    expect(home.security_state).toBe('normal');
    expect(notificationService.notifyOwnershipDispute).toHaveBeenCalledTimes(0);
  });

  test('claimant can accept merge after identity confirmation and keep evidence archived on the claim', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [
      {
        id: 'claim-owner',
        home_id: 'home-1',
        claimant_user_id: 'owner-1',
        claim_type: 'owner',
        state: 'approved',
        method: 'doc_upload',
        claim_phase_v2: 'verified',
        terminal_reason: 'none',
        challenge_state: 'none',
        identity_status: 'verified',
        routing_classification: 'standalone_claim',
        merged_into_claim_id: null,
      },
      {
        id: 'claim-2',
        home_id: 'home-1',
        claimant_user_id: 'user-2',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        claim_phase_v2: 'under_review',
        terminal_reason: 'none',
        challenge_state: 'none',
        identity_status: 'verified',
        routing_classification: 'merge_candidate',
        merged_into_claim_id: null,
      },
    ]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-merge-1',
      claim_id: 'claim-2',
      evidence_type: 'deed',
      status: 'pending',
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000001',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000001',
      });

    expect(res.status).toBe(200);
    expect(res.body.claim.claim_phase_v2).toBe('verified');
    expect(res.body.claim.terminal_reason).toBe('none');
    expect(res.body.accepted_as_owner).toBe(true);

    const mergedClaim = getTable('HomeOwnershipClaim').find((claim) => claim.id === 'claim-2');
    expect(mergedClaim.state).toBe('approved');
    expect(mergedClaim.claim_phase_v2).toBe('verified');
    expect(mergedClaim.terminal_reason).toBe('none');
    expect(mergedClaim.merged_into_claim_id).toBe(null);
    expect(getTable('HomeInvite')[0].status).toBe('accepted');
    expect(getTable('HomeVerificationEvidence')).toHaveLength(1);
    const ownerRows = getTable('HomeOwner');
    const invitedOwner = ownerRows.find((owner) => owner.subject_id === 'user-2');
    expect(invitedOwner).toEqual(expect.objectContaining({
      owner_status: 'verified',
      is_primary_owner: false,
      verification_tier: 'weak',
      added_via: 'claim',
    }));
    expect(getTable('Home')[0].owner_id).toBe('owner-1');
    expect(occupancyAttachService.attach).toHaveBeenCalledWith(expect.objectContaining({
      homeId: 'home-1',
      userId: 'user-2',
      method: 'owner_invite',
      claimType: 'owner',
      roleOverride: 'owner',
    }));
    expect(notificationService.notifyHomeInviteAccepted).toHaveBeenCalledTimes(1);
  });

  test('owner claim merge treats stale member-role claim invites as owner accepts', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'verified',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000005',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'member',
      proposed_role_base: 'member',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000005',
      });

    expect(res.status).toBe(200);
    expect(res.body.accepted_as_owner).toBe(true);
    expect(res.body.accepted_role_base).toBe('owner');
    expect(res.body.claim.claim_phase_v2).toBe('verified');

    const invitedOwner = getTable('HomeOwner').find((owner) => owner.subject_id === 'user-2');
    expect(invitedOwner).toEqual(expect.objectContaining({
      owner_status: 'verified',
      verification_tier: 'weak',
    }));
    expect(getTable('HomeInvite')[0]).toEqual(expect.objectContaining({
      status: 'accepted',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
    }));
    expect(occupancyAttachService.attach).toHaveBeenCalledWith(expect.objectContaining({
      method: 'owner_invite',
      claimType: 'owner',
      roleOverride: 'owner',
    }));
  });

  test('resident claim merge clamps malformed owner-role invites to lease-resident', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Resident', first_name: 'Pending', username: 'resident' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-resident',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'resident',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'verified',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000006',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-resident',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-resident/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000006',
      });

    expect(res.status).toBe(200);
    expect(res.body.accepted_as_owner).toBe(false);
    expect(res.body.accepted_role_base).toBe('lease_resident');
    expect(res.body.claim.claim_phase_v2).toBe('merged_into_household');
    expect(getTable('HomeOwner').find((owner) => owner.subject_id === 'user-2')).toBeUndefined();
    expect(getTable('HomeInvite')[0]).toEqual(expect.objectContaining({
      status: 'accepted',
      proposed_role: 'renter',
      proposed_role_base: 'lease_resident',
    }));
    expect(occupancyAttachService.attach).toHaveBeenCalledWith(expect.objectContaining({
      method: 'owner_bootstrap',
      claimType: 'resident',
      roleOverride: 'lease_resident',
    }));
  });

  test('owner claim merge rejects invites not issued by a verified owner', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'manager-1', name: 'Manager User', first_name: 'Manager', username: 'manager' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'verified',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000003',
      home_id: 'home-1',
      invited_by: 'manager-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000003',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNER_INVITE_AUTHORITY_REQUIRED');
    expect(getTable('HomeOwner').find((owner) => owner.subject_id === 'user-2')).toBeUndefined();
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('under_review');
    expect(getTable('HomeInvite')[0].status).toBe('pending');
    expect(occupancyAttachService.attach).not.toHaveBeenCalled();
  });

  test('owner claim merge rolls back owner promotion when occupancy attach fails', async () => {
    householdClaimConfig.flags.inviteMerge = true;
    occupancyAttachService.attach.mockResolvedValueOnce({ success: false, error: 'attach failed' });

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'verified',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000004',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000004',
      });

    expect(res.status).toBe(500);
    expect(getTable('HomeOwner').find((owner) => owner.subject_id === 'user-2')).toBeUndefined();
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('under_review');
    expect(getTable('HomeInvite')[0].status).toBe('pending');
    expect(getTable('Home')[0].owner_id).toBe('owner-1');
    expect(notificationService.notifyHomeInviteAccepted).not.toHaveBeenCalled();
  });

  test('owner claim merge rolls back owner and occupancy side effects after late failure', async () => {
    householdClaimConfig.flags.inviteMerge = true;
    const recalcSpy = jest
      .spyOn(homeClaimCompatService, 'recalculateHouseholdResolutionState')
      .mockRejectedValueOnce(new Error('recalculate failed'));
    occupancyAttachService.attach.mockImplementationOnce(async () => {
      seedTable('HomeOccupancy', [
        ...getTable('HomeOccupancy'),
        {
          id: 'occ-created',
          home_id: 'home-1',
          user_id: 'user-2',
          role: 'owner',
          role_base: 'owner',
          is_active: true,
          verification_status: 'verified',
          can_manage_home: false,
          can_manage_finance: false,
          can_manage_access: false,
          can_manage_tasks: true,
          can_view_sensitive: true,
        },
      ]);
      return { success: true, status: 'attached', occupancy: { id: 'occ-created' } };
    });

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('User', [
      { id: 'owner-1', name: 'Verified Owner', first_name: 'Verified', username: 'owner' },
      { id: 'user-2', name: 'Pending Claimant', first_name: 'Pending', username: 'claimant' },
    ]);
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'verified',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000007',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    let res;
    try {
      res = await request(app)
        .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
        .set('x-test-user-id', 'user-2')
        .send({
          invitation_id: '00000000-0000-4000-8000-000000000007',
        });
    } finally {
      recalcSpy.mockRestore();
    }

    expect(res.status).toBe(500);
    expect(getTable('HomeOwner').find((owner) => owner.subject_id === 'user-2')).toBeUndefined();
    expect(getTable('HomeOccupancy').find((occupancy) => occupancy.user_id === 'user-2')).toBeUndefined();
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('under_review');
    expect(getTable('HomeInvite')[0]).toEqual(expect.objectContaining({
      status: 'pending',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
    }));
    expect(notificationService.notifyHomeInviteAccepted).not.toHaveBeenCalled();
  });

  test('accept-merge requires identity confirmation before closing the claim', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedBaseHome({
      household_resolution_state: 'verified_household',
      owner_id: 'owner-1',
    });
    seedTable('HomeOwner', [{
      id: 'home-owner-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'merge_candidate',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeInvite', [{
      id: '00000000-0000-4000-8000-000000000002',
      home_id: 'home-1',
      invited_by: 'owner-1',
      invitee_user_id: 'user-2',
      proposed_role: 'owner',
      proposed_role_base: 'owner',
      proposed_preset_key: 'claim_merge:claim-2',
      token: 'invite-token',
      token_hash: 'invite-hash',
      status: 'pending',
      expires_at: futureIso(2),
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
      .set('x-test-user-id', 'user-2')
      .send({
        invitation_id: '00000000-0000-4000-8000-000000000002',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDENTITY_CONFIRMATION_REQUIRED');
    expect(getTable('HomeOwnershipClaim')[0].claim_phase_v2).toBe('under_review');
    expect(getTable('HomeInvite')[0].status).toBe('pending');
  });

  test('claimant can explicitly challenge a verified household with strong uploaded ownership proof', async () => {
    householdClaimConfig.flags.challengeFlow = true;

    seedBaseHome({
      security_state: 'normal',
      household_resolution_state: 'verified_household',
      owner_id: 'owner-incumbent',
    });
    seedTable('HomeOwner', [{
      id: 'owner-1',
      home_id: 'home-1',
      subject_id: 'owner-incumbent',
      owner_status: 'verified',
      verification_tier: 'strong',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-2',
      home_id: 'home-1',
      claimant_user_id: 'user-2',
      claim_type: 'owner',
      state: 'submitted',
      method: 'doc_upload',
      claim_phase_v2: 'under_review',
      terminal_reason: 'none',
      challenge_state: 'none',
      identity_status: 'not_started',
      routing_classification: 'parallel_claim',
      merged_into_claim_id: null,
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'evidence-1',
      claim_id: 'claim-2',
      evidence_type: 'deed',
      status: 'pending',
    }]);

    const res = await request(app)
      .post('/api/homes/home-1/ownership-claims/claim-2/challenge')
      .set('x-test-user-id', 'user-2')
      .send({
        note: 'I am the rightful owner',
      });

    expect(res.status).toBe(200);
    expect(res.body.home_resolution_state).toBe('disputed');

    const challengeClaim = getTable('HomeOwnershipClaim')[0];
    const home = getTable('Home')[0];
    expect(challengeClaim.routing_classification).toBe('challenge_claim');
    expect(challengeClaim.claim_phase_v2).toBe('challenged');
    expect(challengeClaim.challenge_state).toBe('challenged');
    expect(challengeClaim.claim_strength).toBe('owner_legal');
    expect(home.household_resolution_state).toBe('disputed');
    expect(home.security_state).toBe('normal');
  });

  describe('claimant DELETE ownership claim', () => {
    test('hard-deletes in-progress claim row', async () => {
      seedBaseHome();
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-del-1',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        claim_phase_v2: 'under_review',
        terminal_reason: 'none',
        challenge_state: 'none',
      }]);

      const res = await request(app)
        .delete('/api/homes/home-1/ownership-claims/claim-del-1')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(getTable('HomeOwnershipClaim').length).toBe(0);
    });

    test('returns 403 when another user attempts delete', async () => {
      seedBaseHome();
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-x',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        claim_type: 'owner',
        state: 'submitted',
        method: 'doc_upload',
        claim_phase_v2: 'under_review',
        terminal_reason: 'none',
        challenge_state: 'none',
      }]);

      const res = await request(app)
        .delete('/api/homes/home-1/ownership-claims/claim-x')
        .set('x-test-user-id', 'user-2');

      expect(res.status).toBe(403);
      expect(getTable('HomeOwnershipClaim').length).toBe(1);
    });

    test('returns 400 for approved claim', async () => {
      seedBaseHome();
      seedTable('HomeOwnershipClaim', [{
        id: 'claim-appr',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        claim_type: 'owner',
        state: 'approved',
        method: 'doc_upload',
        claim_phase_v2: 'verified',
        terminal_reason: 'none',
        challenge_state: 'none',
      }]);

      const res = await request(app)
        .delete('/api/homes/home-1/ownership-claims/claim-appr')
        .set('x-test-user-id', 'user-1');

      expect(res.status).toBe(400);
      expect(getTable('HomeOwnershipClaim').length).toBe(1);
    });
  });
});

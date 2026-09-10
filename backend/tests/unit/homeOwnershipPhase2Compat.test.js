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
jest.mock('../../middleware/rateLimiter', () => {
  const passthrough = (_req, _res, next) => next();
  // Any limiter name resolves to a passthrough, so adding a new limiter to the
  // real module never breaks this suite with "handler must be a function".
  return new Proxy({}, {
    get: (_target, prop) => (prop === '__esModule' ? false : passthrough),
  });
});
jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn(async () => ({ success: true, occupancy: { id: 'occ-1' } })),
}));

const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
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









  // Mutation semantics now run against actual canonical PostgreSQL in the
  // home-claim-merge-transactions contract; routes verify exact RPC bindings.
  test.each([['owner','owner'],['lease_resident','renter'],['admin','admin']])(
    'relationship invitation projects committed %s role without local authority writes', async (role,legacy) => {
      householdClaimConfig.flags.inviteMerge=true;
      const rpc=jest.fn(async (_name,args)=>({data:{ok:true,replayed:false,homeId:'home-1',claimId:'claim-2',
        invitation:{id:'invite-1',invitee_user_id:'user-2',proposed_role_base:role,proposed_role:legacy,status:'pending'},
        token:args.p_token,actor_name:'Owner',home_label:'Home'}}));
      setRpcMock(rpc);
      const res=await request(app).post('/api/homes/home-1/ownership-claims/claim-2/resolve-relationship')
        .set('x-test-user-id','owner-1').send({action:'invite_to_household',note:'Exact claim'});
      expect(res.status).toBe(200); expect(res.body.invitation.proposed_role_base).toBe(role);
      expect(res.body).not.toHaveProperty('token');
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('mutate_home_claim_invitation',expect.objectContaining({
        p_home_id:'home-1',p_claim_id:'claim-2',p_actor_id:'owner-1',p_action:'issue',p_note:'Exact claim',p_invitation_id:null}));
      expect(getTable('HomeOwner')).toEqual([]);expect(getTable('HomeOwnershipClaim')).toEqual([]);
      expect(occupancyAttachService.attach).not.toHaveBeenCalled();
      expect(notificationService.notifyHomeInvite).toHaveBeenCalledTimes(1);
    });
  test.each([['owner','verified','none'],['lease_resident','merged_into_household','merged_via_invite'],['admin','merged_into_household','merged_via_invite']])(
    'claim acceptance returns committed %s receipt through exact claimant gateway', async(role,phase,terminal)=>{
      householdClaimConfig.flags.inviteMerge=true;
      const invitationId='00000000-0000-4000-8000-000000000001';
      const rpc=jest.fn(async()=>({data:{ok:true,replayed:false,homeId:'home-1',claimId:'claim-2',invitation:{id:invitationId},
        occupancy:{id:'occ-1',home_id:'home-1',user_id:'user-2',role_base:role},acceptedRoleBase:role,acceptedAsOwner:role==='owner',
        claimPhaseV2:phase,terminalReason:terminal,mergedIntoClaimId:null,homeResolutionState:'verified_household'}}));
      setRpcMock(rpc);
      const res=await request(app).post('/api/homes/home-1/ownership-claims/claim-2/accept-merge')
        .set('x-test-user-id','user-2').send({invitation_id:invitationId});
      expect(res.status).toBe(200);expect(res.body.claim.claim_phase_v2).toBe(phase);
      expect(res.body.accepted_as_owner).toBe(role==='owner');
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('mutate_home_claim_invitation',expect.objectContaining({
        p_home_id:'home-1',p_claim_id:'claim-2',p_actor_id:'user-2',p_action:'accept',p_invitation_id:invitationId}));
      expect(occupancyAttachService.attach).not.toHaveBeenCalled();
      expect(getTable('HomeOwner')).toEqual([]);expect(getTable('HomeOccupancy')).toEqual([]);
    });
  test.each([
    ['resolve-relationship',{action:'invite_to_household'},'OWNER_INVITE_AUTHORITY_REQUIRED',403],
    ['accept-merge',{},'IDENTITY_CONFIRMATION_REQUIRED',409],
    ['accept-merge',{},'CLAIM_INVITE_CHANGED',409],
    ['accept-merge',{},'CLAIM_RECIPIENT_MISMATCH',403],
    ['accept-merge',{},'CLAIM_INVITE_EXPIRED',410],
    ['accept-merge',{},'PROPOSED_ROLE_FORBIDDEN',403],
  ])('%s preserves transactional %s denial',async(path,body,code,status)=>{
    householdClaimConfig.flags.inviteMerge=true;
    setRpcMock(async()=>({data:{ok:false,code,status}}));
    const res=await request(app).post(`/api/homes/home-1/ownership-claims/claim-2/${path}`)
      .set('x-test-user-id','user-2').send(body);
    expect(res.status).toBe(status);expect(res.body.code).toBe(code);
    expect(occupancyAttachService.attach).not.toHaveBeenCalled();
    expect(notificationService.notifyHomeInviteAccepted).not.toHaveBeenCalled();
  });
  test.each(['resolve-relationship','accept-merge'])('%s fails retryably without local compensation after RPC failure',async path=>{
    householdClaimConfig.flags.inviteMerge=true;
    setRpcMock(async()=>({error:{code:'XX000',message:'private database detail'}}));
    const res=await request(app).post(`/api/homes/home-1/ownership-claims/claim-2/${path}`)
      .set('x-test-user-id','user-2').send(path==='resolve-relationship'?{action:'invite_to_household'}:{});
    expect(res.status).toBe(503);expect(res.body.code).toBe('CLAIM_MERGE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('private database detail');
    expect(getTable('HomeOwner')).toEqual([]);expect(getTable('HomeOccupancy')).toEqual([]);
    expect(occupancyAttachService.attach).not.toHaveBeenCalled();
  });
  test.each(['resolve-relationship','accept-merge'])('%s flag-off never reaches claim transaction',async path=>{
    const rpc=jest.fn();setRpcMock(rpc);
    const res=await request(app).post(`/api/homes/home-1/ownership-claims/claim-2/${path}`)
      .set('x-test-user-id','user-2').send(path==='resolve-relationship'?{action:'invite_to_household'}:{});
    expect(res.status).toBe(404);expect(rpc).not.toHaveBeenCalled();
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

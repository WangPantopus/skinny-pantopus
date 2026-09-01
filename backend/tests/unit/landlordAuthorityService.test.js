// ============================================================
// TEST: LandlordAuthorityService
//
// Unit tests for all 7 methods:
//   requestAuthority, verifyAuthority, inviteTenant,
//   acceptInvite, approveTenantRequest, denyTenantRequest,
//   endLease
//
// Uses the in-memory supabaseAdmin mock.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock writeAuditLog ──────────────────────────────────────
jest.mock('../../utils/homePermissions', () => ({
  writeAuditLog: jest.fn(),
  applyOccupancyTemplate: jest.fn().mockResolvedValue({
    occupancy: { id: 'mock-occ-template' },
    template: {},
  }),
  VERIFIED_TEMPLATES: {},
  ALL_FALSE_TEMPLATE: {},
}));

// ── Mock notificationService ────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

// ── Mock occupancyAttachService (tested separately) ─────────
const mockOccAttach = jest.fn().mockResolvedValue({
  success: true,
  occupancy: { id: 'mock-occ-id', role: 'lease_resident', role_base: 'lease_resident', verification_status: 'verified', is_active: true, home_id: 'home-1' },
  status: 'attached',
});
const mockOccDetach = jest.fn().mockResolvedValue({ success: true });
jest.mock('../../services/occupancyAttachService', () => ({
  attach: (...args) => mockOccAttach(...args),
  detach: (...args) => mockOccDetach(...args),
}));

const { writeAuditLog } = require('../../utils/homePermissions');
const notificationService = require('../../services/notificationService');
const { LandlordAuthorityService } = require('../../services/addressValidation/landlordAuthorityService');

let service;

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockOccAttach.mockResolvedValue({
    success: true,
    occupancy: { id: 'mock-occ-id', role: 'lease_resident', role_base: 'lease_resident', verification_status: 'verified', is_active: true, home_id: 'home-1' },
    status: 'attached',
  });
  mockOccDetach.mockResolvedValue({ success: true });
  service = new LandlordAuthorityService();
});

// ── Seed helpers ────────────────────────────────────────────

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: 'home-1',
    name: 'Test Home',
    home_type: 'unit',
    address_id: 'addr-1',
    ...overrides,
  }]);
}

function seedAuthority(overrides = {}) {
  seedTable('HomeAuthority', [{
    id: 'auth-1',
    home_id: 'home-1',
    subject_type: 'user',
    subject_id: 'landlord-1',
    role: 'owner',
    status: 'verified',
    verification_tier: 'standard',
    added_via: 'landlord_portal',
    ...overrides,
  }]);
}

function seedLease(overrides = {}) {
  seedTable('HomeLease', [{
    id: 'lease-1',
    home_id: 'home-1',
    primary_resident_user_id: 'tenant-1',
    start_at: new Date().toISOString(),
    state: 'pending',
    source: 'tenant_request',
    metadata: {},
    ...overrides,
  }]);
}

// ============================================================
// requestAuthority
// ============================================================

describe('requestAuthority', () => {
  test('creates a pending HomeAuthority record', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    expect(result.success).toBe(true);
    expect(result.authority).toBeDefined();
    expect(result.authority.status).toBe('pending');
    expect(result.authority.role).toBe('owner');
    expect(result.authority.subject_type).toBe('user');
    expect(result.authority.subject_id).toBe('landlord-1');
  });

  test('persists authority to HomeAuthority table', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    const records = getTable('HomeAuthority');
    expect(records).toHaveLength(1);
    expect(records[0].home_id).toBe('home-1');
  });

  test('creates claim + evidence when evidence provided', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed', {
      storage_ref: 's3://bucket/deed.pdf',
      metadata: { pages: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.claim).toBeDefined();
    expect(result.claim.claim_type).toBe('owner');
    expect(result.claim.state).toBe('submitted');
    expect(result.claim.claim_phase_v2).toBe('evidence_submitted');
    expect(result.claim.routing_classification).toBe('standalone_claim');
    expect(result.claim.identity_status).toBe('not_started');
    expect(result.claim.terminal_reason).toBe('none');
    expect(result.claim.challenge_state).toBe('none');

    const evidence = getTable('HomeVerificationEvidence');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].evidence_type).toBe('deed');
    expect(evidence[0].storage_ref).toBe('s3://bucket/deed.pdf');
    expect(getTable('Home')[0].household_resolution_state).toBe('pending_single_claim');
  });

  test('returns null claim when no evidence provided', async () => {
    seedHome();
    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'utility_bill');

    expect(result.success).toBe(true);
    expect(result.claim).toBeNull();
    expect(getTable('HomeVerificationEvidence')).toHaveLength(0);
  });

  test('writes audit log', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'AUTHORITY_REQUESTED', 'HomeAuthority',
      expect.any(String),
      expect.objectContaining({ subject_type: 'user', evidence_type: 'deed' }),
    );
  });

  test('returns error when home not found', async () => {
    const result = await service.requestAuthority('user', 'landlord-1', 'missing-home', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Home not found');
  });

  test('returns error when active authority already exists (pending)', async () => {
    seedHome();
    seedAuthority({ status: 'pending' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('pending authority request');
  });

  test('returns error when verified authority already exists', async () => {
    seedHome();
    seedAuthority({ status: 'verified' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('verified authority');
  });

  test('allows request when existing authority is revoked', async () => {
    seedHome();
    seedAuthority({ status: 'revoked' });

    const result = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed');
    expect(result.success).toBe(true);
  });

  test('supports business subject type', async () => {
    seedHome();
    const result = await service.requestAuthority('business', 'biz-1', 'home-1', 'lease');

    expect(result.success).toBe(true);
    expect(result.authority.subject_type).toBe('business');
  });

  test('evidence provider defaults to manual', async () => {
    seedHome();
    await service.requestAuthority('user', 'landlord-1', 'home-1', 'tax_bill', {
      storage_ref: 's3://bucket/tax.pdf',
    });

    const evidence = getTable('HomeVerificationEvidence');
    expect(evidence[0].provider).toBe('manual');
  });
});

// ============================================================
// verifyAuthority
// ============================================================

describe('verifyAuthority', () => {
  beforeEach(() => {
    seedHome();
    seedAuthority({ status: 'pending' });
  });

  test('verifies authority to verified status', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');

    expect(result.success).toBe(true);
    expect(result.authority.status).toBe('verified');
  });

  test('revokes authority', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'revoked', 'Insufficient evidence');

    expect(result.success).toBe(true);
    expect(result.authority.status).toBe('revoked');
  });

  test('updates verification_tier from evidence quality', async () => {
    // Seed a claim with strong evidence
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'landlord-1',
      claim_type: 'owner',
      state: 'submitted',
    }]);
    seedTable('HomeVerificationEvidence', [{
      id: 'ev-1',
      claim_id: 'claim-1',
      evidence_type: 'deed',
      provider: 'manual',
      status: 'verified',
    }]);

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');

    expect(result.success).toBe(true);
    expect(result.authority.verification_tier).toBe('strong');
  });

  test('uses highest tier when multiple evidence types', async () => {
    seedTable('HomeOwnershipClaim', [{
      id: 'claim-1',
      home_id: 'home-1',
      claimant_user_id: 'landlord-1',
      claim_type: 'owner',
      state: 'submitted',
    }]);
    seedTable('HomeVerificationEvidence', [
      { id: 'ev-1', claim_id: 'claim-1', evidence_type: 'utility_bill', provider: 'manual', status: 'verified' },
      { id: 'ev-2', claim_id: 'claim-1', evidence_type: 'escrow_attestation', provider: 'manual', status: 'verified' },
    ]);

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.authority.verification_tier).toBe('legal');
  });

  test('defaults to weak tier when no evidence', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.authority.verification_tier).toBe('weak');
  });

  test('writes audit log with reviewer info', async () => {
    await service.verifyAuthority('auth-1', 'reviewer-1', 'verified', 'Looks good');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'reviewer-1', 'AUTHORITY_VERIFIED', 'HomeAuthority', 'auth-1',
      expect.objectContaining({ reviewer_id: 'reviewer-1', note: 'Looks good' }),
    );
  });

  test('returns error for invalid decision', async () => {
    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'maybe');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Decision must be');
  });

  test('returns error when authority not found', async () => {
    const result = await service.verifyAuthority('missing-auth', 'reviewer-1', 'verified');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('returns error when authority already verified', async () => {
    // Change status to verified
    getTable('HomeAuthority')[0].status = 'verified';

    const result = await service.verifyAuthority('auth-1', 'reviewer-1', 'verified');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already verified');
  });
});

// ============================================================
// inviteTenant
// ============================================================

describe('inviteTenant', () => {
  beforeEach(() => {
    seedHome();
    seedAuthority({ status: 'verified' });
  });

  test('creates invite with token hash', async () => {
    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com',
      '2026-04-01T00:00:00.000Z',
    );

    expect(result.success).toBe(true);
    expect(result.invite).toBeDefined();
    expect(result.invite.status).toBe('pending');
    expect(result.invite.invitee_email).toBe('tenant@example.com');
    expect(result.invite.token_hash).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(64); // 32 bytes hex
  });

  test('token hash matches SHA-256 of raw token', async () => {
    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    const expectedHash = crypto.createHash('sha256').update(result.token).digest('hex');
    expect(result.invite.token_hash).toBe(expectedHash);
  });

  test('sets expires_at to 14 days', async () => {
    const before = Date.now();
    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );
    const after = Date.now();

    const expiry = new Date(result.invite.expires_at).getTime();
    const expectedMin = before + 14 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 14 * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry).toBeLessThanOrEqual(expectedMax);
  });

  test('stores proposed_start and proposed_end', async () => {
    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com',
      '2026-04-01', '2027-03-31',
    );

    expect(result.invite.proposed_start).toBe('2026-04-01');
    expect(result.invite.proposed_end).toBe('2027-03-31');
  });

  test('sends notification to existing user', async () => {
    seedTable('User', [{ id: 'tenant-user-1', email: 'tenant@example.com' }]);

    await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-user-1',
        type: 'lease_invite',
      }),
    );
  });

  test('links invite to existing user', async () => {
    seedTable('User', [{ id: 'tenant-user-1', email: 'tenant@example.com' }]);

    await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    const invites = getTable('HomeLeaseInvite');
    expect(invites[0].invitee_user_id).toBe('tenant-user-1');
  });

  test('does not crash when invitee not in system', async () => {
    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'unknown@example.com', '2026-04-01',
    );

    expect(result.success).toBe(true);
  });

  test('writes audit log', async () => {
    await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'TENANT_INVITED', 'HomeLeaseInvite',
      expect.any(String),
      expect.objectContaining({ invitee_email: 'tenant@example.com' }),
    );
  });

  test('returns error when authority not verified', async () => {
    getTable('HomeAuthority')[0].status = 'pending';

    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be verified');
  });

  test('returns error when authority not found', async () => {
    const result = await service.inviteTenant(
      'missing-auth', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('returns error when authority does not match home', async () => {
    const result = await service.inviteTenant(
      'auth-1', 'other-home', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not match');
  });

  test('returns error when home is a building', async () => {
    getTable('Home')[0].home_type = 'building';

    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('building');
  });

  test('returns error when pending invite already exists', async () => {
    seedTable('HomeLeaseInvite', [{
      id: 'existing-invite',
      home_id: 'home-1',
      invitee_email: 'tenant@example.com',
      token_hash: 'hash',
      status: 'pending',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      landlord_subject_type: 'user',
      landlord_subject_id: 'landlord-1',
    }]);

    const result = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Pending invite already exists');
  });
});

// ============================================================
// acceptInvite
// ============================================================

describe('acceptInvite', () => {
  let rawToken;

  beforeEach(() => {
    seedHome();
    rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    seedTable('HomeLeaseInvite', [{
      id: 'invite-1',
      home_id: 'home-1',
      landlord_subject_type: 'user',
      landlord_subject_id: 'landlord-1',
      invitee_email: 'tenant@example.com',
      token_hash: tokenHash,
      proposed_start: '2026-04-01T00:00:00.000Z',
      proposed_end: null,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
  });

  test('creates active lease from invite', async () => {
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(result.success).toBe(true);
    expect(result.lease).toBeDefined();
    expect(result.lease.state).toBe('active');
    expect(result.lease.source).toBe('landlord_invite');
    expect(result.lease.primary_resident_user_id).toBe('tenant-1');
  });

  test('creates HomeOccupancy with lease_resident role', async () => {
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(result.occupancy).toBeDefined();
    expect(result.occupancy.role).toBe('lease_resident');
    expect(result.occupancy.verification_status).toBe('verified');
    expect(result.occupancy.is_active).toBe(true);
  });

  test('creates HomeLeaseResident record', async () => {
    await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    const residents = getTable('HomeLeaseResident');
    expect(residents).toHaveLength(1);
    expect(residents[0].user_id).toBe('tenant-1');
  });

  test('updates invite status to accepted', async () => {
    await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    const invites = getTable('HomeLeaseInvite');
    expect(invites[0].status).toBe('accepted');
    expect(invites[0].invitee_user_id).toBe('tenant-1');
  });

  test('uses proposed_start from invite', async () => {
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');
    expect(result.lease.start_at).toBe('2026-04-01T00:00:00.000Z');
  });

  test('writes audit log', async () => {
    await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'tenant-1', 'LEASE_INVITE_ACCEPTED', 'HomeLease',
      expect.any(String),
      expect.objectContaining({ invite_id: 'invite-1', source: 'landlord_invite' }),
    );
  });

  test('returns error for invalid token', async () => {
    const result = await service.acceptInvite('bad-token', 'tenant-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('returns error when invite already accepted', async () => {
    getTable('HomeLeaseInvite')[0].status = 'accepted';

    const result = await service.acceptInvite(rawToken, 'tenant-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('accepted');
  });

  test('returns error when invite revoked', async () => {
    getTable('HomeLeaseInvite')[0].status = 'revoked';

    const result = await service.acceptInvite(rawToken, 'tenant-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('revoked');
  });

  test('marks invite expired when past expiry date', async () => {
    getTable('HomeLeaseInvite')[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const result = await service.acceptInvite(rawToken, 'tenant-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');

    expect(getTable('HomeLeaseInvite')[0].status).toBe('expired');
  });

  // ── Email identity binding (AUTH-1.3) ──────────────────────

  test('matching email can accept invite', async () => {
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(result.success).toBe(true);
    expect(result.lease).toBeDefined();
    expect(result.lease.state).toBe('active');
  });

  test('non-matching email is rejected', async () => {
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'intruder@evil.com');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/different email/i);
  });

  test('case-insensitive email comparison works', async () => {
    // Invite has invitee_email: 'tenant@example.com'
    const result = await service.acceptInvite(rawToken, 'tenant-1', 'Tenant@EXAMPLE.COM');

    expect(result.success).toBe(true);
    expect(result.lease).toBeDefined();
  });

  test('expired invite is rejected regardless of matching email', async () => {
    getTable('HomeLeaseInvite')[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  test('already-accepted invite is rejected regardless of matching email', async () => {
    getTable('HomeLeaseInvite')[0].status = 'accepted';

    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/accepted/i);
  });

  test('updates existing occupancy instead of creating duplicate', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-existing',
      home_id: 'home-1',
      user_id: 'tenant-1',
      role: 'member',
      role_base: 'member',
      is_active: true,
      verification_status: 'unverified',
    }]);

    // Mock returns upgraded result
    mockOccAttach.mockResolvedValueOnce({
      success: true,
      occupancy: { id: 'occ-existing', role: 'lease_resident', verification_status: 'verified', is_active: true },
      status: 'upgraded',
    });

    const result = await service.acceptInvite(rawToken, 'tenant-1', 'tenant@example.com');
    expect(result.success).toBe(true);

    // Verify delegation to occupancyAttachService with correct params
    expect(mockOccAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        method: 'landlord_invite',
        roleOverride: 'lease_resident',
      }),
    );
    expect(result.occupancy.role).toBe('lease_resident');
    expect(result.occupancy.verification_status).toBe('verified');
  });
});

// ============================================================
// approveTenantRequest
// ============================================================

describe('approveTenantRequest', () => {
  beforeEach(() => {
    seedHome();
    seedAuthority({ status: 'verified' });
    seedLease({ state: 'pending' });
  });

  test('activates pending lease', async () => {
    const result = await service.approveTenantRequest('lease-1', 'auth-1');

    expect(result.success).toBe(true);
    expect(result.lease.state).toBe('active');
    expect(result.lease.approved_by_subject_type).toBe('user');
    expect(result.lease.approved_by_subject_id).toBe('landlord-1');
  });

  test('creates HomeOccupancy', async () => {
    const result = await service.approveTenantRequest('lease-1', 'auth-1');

    expect(result.occupancy).toBeDefined();
    expect(result.occupancy.role).toBe('lease_resident');
    expect(result.occupancy.verification_status).toBe('verified');

    // Verify delegation to occupancyAttachService
    expect(mockOccAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        method: 'landlord_approval',
        roleOverride: 'lease_resident',
      }),
    );
  });

  test('notifies tenant', async () => {
    await service.approveTenantRequest('lease-1', 'auth-1');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_approved',
      }),
    );
  });

  test('writes audit log', async () => {
    await service.approveTenantRequest('lease-1', 'auth-1');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'LEASE_APPROVED', 'HomeLease', 'lease-1',
      expect.objectContaining({ authority_id: 'auth-1', tenant_user_id: 'tenant-1' }),
    );
  });

  test('returns error when authority not verified', async () => {
    getTable('HomeAuthority')[0].status = 'pending';

    const result = await service.approveTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('verified authority');
  });

  test('returns error when lease not found', async () => {
    const result = await service.approveTenantRequest('missing-lease', 'auth-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Lease not found');
  });

  test('returns error when lease not pending', async () => {
    getTable('HomeLease')[0].state = 'active';

    const result = await service.approveTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });

  test('returns error when authority does not match home', async () => {
    getTable('HomeAuthority')[0].home_id = 'other-home';

    const result = await service.approveTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not match');
  });
});

// ============================================================
// denyTenantRequest
// ============================================================

describe('denyTenantRequest', () => {
  beforeEach(() => {
    seedHome();
    seedAuthority({ status: 'verified' });
    seedLease({ state: 'pending' });
  });

  test('cancels pending lease', async () => {
    const result = await service.denyTenantRequest('lease-1', 'auth-1', 'Not a valid tenant');

    expect(result.success).toBe(true);

    const leases = getTable('HomeLease');
    expect(leases[0].state).toBe('canceled');
  });

  test('stores denial reason in metadata', async () => {
    await service.denyTenantRequest('lease-1', 'auth-1', 'Background check failed');

    const leases = getTable('HomeLease');
    expect(leases[0].metadata.denial_reason).toBe('Background check failed');
  });

  test('notifies tenant with reason', async () => {
    await service.denyTenantRequest('lease-1', 'auth-1', 'Insufficient income');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_denied',
        body: expect.stringContaining('Insufficient income'),
      }),
    );
  });

  test('notifies tenant with generic message when no reason', async () => {
    await service.denyTenantRequest('lease-1', 'auth-1');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('denied by the property authority'),
      }),
    );
  });

  test('writes audit log', async () => {
    await service.denyTenantRequest('lease-1', 'auth-1', 'Reason here');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'LEASE_DENIED', 'HomeLease', 'lease-1',
      expect.objectContaining({ reason: 'Reason here' }),
    );
  });

  test('returns error when authority not verified', async () => {
    getTable('HomeAuthority')[0].status = 'pending';

    const result = await service.denyTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
  });

  test('returns error when lease not pending', async () => {
    getTable('HomeLease')[0].state = 'active';

    const result = await service.denyTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('active');
  });

  test('returns error when authority home does not match', async () => {
    getTable('HomeAuthority')[0].home_id = 'other-home';

    const result = await service.denyTenantRequest('lease-1', 'auth-1');
    expect(result.success).toBe(false);
  });
});

// ============================================================
// endLease
// ============================================================

describe('endLease', () => {
  beforeEach(() => {
    seedHome();
    seedLease({ state: 'active' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'tenant-1',
      role: 'lease_resident',
      role_base: 'lease_resident',
      is_active: true,
      verification_status: 'verified',
    }]);
  });

  test('ends active lease', async () => {
    const result = await service.endLease('lease-1', 'landlord-1');

    expect(result.success).toBe(true);

    const leases = getTable('HomeLease');
    expect(leases[0].state).toBe('ended');
    expect(leases[0].end_at).toBeTruthy();
  });

  test('deactivates HomeOccupancy via occupancyAttachService', async () => {
    await service.endLease('lease-1', 'landlord-1');

    // Verify detach was called for the primary resident
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        reason: 'lease_ended',
        actorId: 'landlord-1',
      }),
    );
  });

  test('deactivates co-resident occupancies via occupancyAttachService', async () => {
    seedTable('HomeLeaseResident', [
      { id: 'lr-1', lease_id: 'lease-1', user_id: 'tenant-1' },
      { id: 'lr-2', lease_id: 'lease-1', user_id: 'co-resident-1' },
    ]);
    seedTable('HomeOccupancy', [{
      id: 'occ-2',
      home_id: 'home-1',
      user_id: 'co-resident-1',
      role: 'lease_resident',
      role_base: 'lease_resident',
      is_active: true,
      verification_status: 'verified',
    }]);

    await service.endLease('lease-1', 'landlord-1');

    // Primary resident detach
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tenant-1', reason: 'lease_ended' }),
    );
    // Co-resident detach
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'co-resident-1', reason: 'lease_ended' }),
    );
  });

  test('notifies tenant', async () => {
    await service.endLease('lease-1', 'landlord-1');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_ended',
        body: expect.stringContaining('retain your own content history'),
      }),
    );
  });

  test('writes audit log', async () => {
    await service.endLease('lease-1', 'landlord-1');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'LEASE_ENDED', 'HomeLease', 'lease-1',
      expect.objectContaining({ tenant_user_id: 'tenant-1', initiated_by: 'landlord-1' }),
    );
  });

  test('returns error when lease not found', async () => {
    const result = await service.endLease('missing-lease', 'landlord-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Lease not found');
  });

  test('returns error when lease is not active', async () => {
    getTable('HomeLease')[0].state = 'ended';

    const result = await service.endLease('lease-1', 'landlord-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ended');
  });

  test('returns error when lease is pending', async () => {
    getTable('HomeLease')[0].state = 'pending';

    const result = await service.endLease('lease-1', 'landlord-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('pending');
  });

  test('tenant can initiate end lease', async () => {
    const result = await service.endLease('lease-1', 'tenant-1');

    expect(result.success).toBe(true);
    const leases = getTable('HomeLease');
    expect(leases[0].state).toBe('ended');
  });
});

// ============================================================
// _tierRank (private helper)
// ============================================================

describe('_tierRank', () => {
  test('ranks weak < standard < strong < legal', () => {
    expect(service._tierRank('weak')).toBeLessThan(service._tierRank('standard'));
    expect(service._tierRank('standard')).toBeLessThan(service._tierRank('strong'));
    expect(service._tierRank('strong')).toBeLessThan(service._tierRank('legal'));
  });

  test('returns 0 for unknown tiers', () => {
    expect(service._tierRank('unknown')).toBe(0);
  });
});

// ============================================================
// Constants
// ============================================================

describe('Constants', () => {
  test('INVITE_EXPIRY_DAYS is 14', () => {
    expect(LandlordAuthorityService.INVITE_EXPIRY_DAYS).toBe(14);
  });

  test('EVIDENCE_TIER_MAP has expected mappings', () => {
    const map = LandlordAuthorityService.EVIDENCE_TIER_MAP;
    expect(map.deed).toBe('strong');
    expect(map.escrow_attestation).toBe('legal');
    expect(map.utility_bill).toBe('weak');
    expect(map.lease).toBe('standard');
  });
});

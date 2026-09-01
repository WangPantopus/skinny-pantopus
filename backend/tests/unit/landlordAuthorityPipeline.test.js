// ============================================================
// TEST: Landlord Authority Pipeline — Integration Tests
//
// End-to-end flow tests covering the landlord-tenant lifecycle
// with 5 scenarios:
//   1. Invite → accept → occupancy created
//   2. Request → approve → occupancy created
//   3. Request → deny (lease canceled)
//   4. Lease end → deactivation of all residents
//   5. Unverified authority cannot approve
//
// Uses in-memory supabaseAdmin mock with mocked occupancy and
// notification services.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock homePermissions ────────────────────────────────────
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

// ── Mock occupancyAttachService ─────────────────────────────
const mockOccAttach = jest.fn().mockResolvedValue({
  success: true,
  occupancy: {
    id: 'occ-1',
    role: 'lease_resident',
    role_base: 'lease_resident',
    verification_status: 'verified',
    is_active: true,
    home_id: 'home-1',
  },
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
    occupancy: {
      id: 'occ-1',
      role: 'lease_resident',
      role_base: 'lease_resident',
      verification_status: 'verified',
      is_active: true,
      home_id: 'home-1',
    },
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

function seedVerifiedAuthority(overrides = {}) {
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

function seedPendingLease(overrides = {}) {
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
// 1. Invite → accept → occupancy created
// ============================================================

describe('invite → accept → occupancy', () => {
  test('full landlord invite flow creates active lease and occupancy', async () => {
    seedHome();
    seedVerifiedAuthority();

    // Step 1: Landlord invites tenant
    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com',
      '2026-04-01T00:00:00.000Z', '2027-03-31T00:00:00.000Z',
    );

    expect(inviteResult.success).toBe(true);
    expect(inviteResult.token).toBeTruthy();
    expect(inviteResult.invite.status).toBe('pending');

    // Step 2: Tenant accepts invite with token
    const acceptResult = await service.acceptInvite(inviteResult.token, 'tenant-1', 'tenant@example.com');

    expect(acceptResult.success).toBe(true);
    expect(acceptResult.lease).toBeDefined();
    expect(acceptResult.lease.state).toBe('active');
    expect(acceptResult.lease.source).toBe('landlord_invite');
    expect(acceptResult.lease.primary_resident_user_id).toBe('tenant-1');
  });

  test('accepting invite creates lease_resident occupancy', async () => {
    seedHome();
    seedVerifiedAuthority();

    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    const acceptResult = await service.acceptInvite(inviteResult.token, 'tenant-1', 'tenant@example.com');

    expect(acceptResult.occupancy).toBeDefined();
    expect(acceptResult.occupancy.role).toBe('lease_resident');
    expect(acceptResult.occupancy.verification_status).toBe('verified');

    // Verify occupancyAttachService called with landlord_invite method
    expect(mockOccAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        method: 'landlord_invite',
        roleOverride: 'lease_resident',
      }),
    );
  });

  test('invite updates to accepted status after acceptance', async () => {
    seedHome();
    seedVerifiedAuthority();

    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    await service.acceptInvite(inviteResult.token, 'tenant-1', 'tenant@example.com');

    const invites = getTable('HomeLeaseInvite');
    expect(invites[0].status).toBe('accepted');
    expect(invites[0].invitee_user_id).toBe('tenant-1');
  });

  test('invite creates HomeLeaseResident record', async () => {
    seedHome();
    seedVerifiedAuthority();

    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    await service.acceptInvite(inviteResult.token, 'tenant-1', 'tenant@example.com');

    const residents = getTable('HomeLeaseResident');
    expect(residents).toHaveLength(1);
    expect(residents[0].user_id).toBe('tenant-1');
  });

  test('invite token expires after 14 days', async () => {
    seedHome();
    seedVerifiedAuthority();

    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    const expiry = new Date(inviteResult.invite.expires_at);
    const minExpiry = Date.now() + 13.5 * 24 * 60 * 60 * 1000;
    const maxExpiry = Date.now() + 14.5 * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThan(minExpiry);
    expect(expiry.getTime()).toBeLessThan(maxExpiry);
  });

  test('expired invite cannot be accepted', async () => {
    seedHome();
    seedVerifiedAuthority();

    const inviteResult = await service.inviteTenant(
      'auth-1', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    // Manually expire the invite
    const invites = getTable('HomeLeaseInvite');
    invites[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const acceptResult = await service.acceptInvite(inviteResult.token, 'tenant-1', 'tenant@example.com');

    expect(acceptResult.success).toBe(false);
    expect(acceptResult.error).toContain('expired');
  });

  test('invite triggers notification for existing user', async () => {
    seedHome();
    seedVerifiedAuthority();
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
});

// ============================================================
// 2. Request → approve → occupancy created
// ============================================================

describe('request → approve → occupancy', () => {
  test('approving tenant request activates lease and creates occupancy', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    const result = await service.approveTenantRequest('lease-1', 'auth-1');

    expect(result.success).toBe(true);
    expect(result.lease.state).toBe('active');
    expect(result.lease.approved_by_subject_type).toBe('user');
    expect(result.lease.approved_by_subject_id).toBe('landlord-1');
  });

  test('approved request creates occupancy via occupancyAttachService', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    const result = await service.approveTenantRequest('lease-1', 'auth-1');

    expect(result.occupancy).toBeDefined();
    expect(mockOccAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        method: 'landlord_approval',
        roleOverride: 'lease_resident',
      }),
    );
  });

  test('approved request sends notification to tenant', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    await service.approveTenantRequest('lease-1', 'auth-1');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_approved',
      }),
    );
  });

  test('approved request writes audit log', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    await service.approveTenantRequest('lease-1', 'auth-1');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'LEASE_APPROVED', 'HomeLease', 'lease-1',
      expect.objectContaining({ authority_id: 'auth-1' }),
    );
  });
});

// ============================================================
// 3. Request → deny (lease canceled)
// ============================================================

describe('request → deny', () => {
  test('denying request cancels lease and stores reason', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    const result = await service.denyTenantRequest('lease-1', 'auth-1', 'Failed background check');

    expect(result.success).toBe(true);

    const leases = getTable('HomeLease');
    expect(leases[0].state).toBe('canceled');
    expect(leases[0].metadata.denial_reason).toBe('Failed background check');
  });

  test('denial notifies tenant with reason', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    await service.denyTenantRequest('lease-1', 'auth-1', 'Insufficient income proof');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_denied',
        body: expect.stringContaining('Insufficient income proof'),
      }),
    );
  });

  test('denial works without reason (generic message)', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    const result = await service.denyTenantRequest('lease-1', 'auth-1');

    expect(result.success).toBe(true);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('denied by the property authority'),
      }),
    );
  });

  test('denial does not create any occupancy', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    await service.denyTenantRequest('lease-1', 'auth-1');

    expect(mockOccAttach).not.toHaveBeenCalled();
    expect(getTable('HomeOccupancy')).toHaveLength(0);
  });

  test('denial writes audit log with reason', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    await service.denyTenantRequest('lease-1', 'auth-1', 'Credit check failed');

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'landlord-1', 'LEASE_DENIED', 'HomeLease', 'lease-1',
      expect.objectContaining({ reason: 'Credit check failed' }),
    );
  });
});

// ============================================================
// 4. Lease end → deactivation of all residents
// ============================================================

describe('lease end → deactivation', () => {
  beforeEach(() => {
    seedHome();
    seedPendingLease({ state: 'active' });
    seedTable('HomeOccupancy', [{
      id: 'occ-primary',
      home_id: 'home-1',
      user_id: 'tenant-1',
      role: 'lease_resident',
      role_base: 'lease_resident',
      is_active: true,
      verification_status: 'verified',
    }]);
  });

  test('ending lease marks it as ended with end_at timestamp', async () => {
    const result = await service.endLease('lease-1', 'landlord-1');

    expect(result.success).toBe(true);

    const leases = getTable('HomeLease');
    expect(leases[0].state).toBe('ended');
    expect(leases[0].end_at).toBeTruthy();
  });

  test('ending lease deactivates primary resident occupancy', async () => {
    await service.endLease('lease-1', 'landlord-1');

    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({
        homeId: 'home-1',
        userId: 'tenant-1',
        reason: 'lease_ended',
        actorId: 'landlord-1',
      }),
    );
  });

  test('ending lease deactivates co-residents too', async () => {
    // Add co-residents
    seedTable('HomeLeaseResident', [
      { id: 'lr-1', lease_id: 'lease-1', user_id: 'tenant-1' },
      { id: 'lr-2', lease_id: 'lease-1', user_id: 'co-resident-1' },
      { id: 'lr-3', lease_id: 'lease-1', user_id: 'co-resident-2' },
    ]);
    seedTable('HomeOccupancy', [
      {
        id: 'occ-co1',
        home_id: 'home-1',
        user_id: 'co-resident-1',
        role: 'lease_resident',
        role_base: 'lease_resident',
        is_active: true,
        verification_status: 'verified',
      },
      {
        id: 'occ-co2',
        home_id: 'home-1',
        user_id: 'co-resident-2',
        role: 'lease_resident',
        role_base: 'lease_resident',
        is_active: true,
        verification_status: 'verified',
      },
    ]);

    await service.endLease('lease-1', 'landlord-1');

    // Primary + 2 co-residents = 3 detach calls
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tenant-1', reason: 'lease_ended' }),
    );
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'co-resident-1', reason: 'lease_ended' }),
    );
    expect(mockOccDetach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'co-resident-2', reason: 'lease_ended' }),
    );
  });

  test('ending lease notifies tenant about content retention', async () => {
    await service.endLease('lease-1', 'landlord-1');

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tenant-1',
        type: 'lease_ended',
        body: expect.stringContaining('retain your own content history'),
      }),
    );
  });

  test('tenant can also initiate lease end', async () => {
    const result = await service.endLease('lease-1', 'tenant-1');

    expect(result.success).toBe(true);
    expect(getTable('HomeLease')[0].state).toBe('ended');
  });

  test('cannot end an already-ended lease', async () => {
    getTable('HomeLease')[0].state = 'ended';

    const result = await service.endLease('lease-1', 'landlord-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ended');
  });
});

// ============================================================
// 5. Unverified authority cannot approve
// ============================================================

describe('unverified authority cannot approve', () => {
  test('pending authority cannot approve tenant request', async () => {
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-pending',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'pending',
      verification_tier: 'weak',
      added_via: 'landlord_portal',
    }]);
    seedPendingLease();

    const result = await service.approveTenantRequest('lease-1', 'auth-pending');

    expect(result.success).toBe(false);
    expect(result.error).toContain('verified authority');
  });

  test('revoked authority cannot approve tenant request', async () => {
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-revoked',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'revoked',
      verification_tier: 'standard',
      added_via: 'landlord_portal',
    }]);
    seedPendingLease();

    const result = await service.approveTenantRequest('lease-1', 'auth-revoked');

    expect(result.success).toBe(false);
    expect(result.error).toContain('verified authority');
  });

  test('pending authority cannot deny tenant request', async () => {
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-pending',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'pending',
      verification_tier: 'weak',
      added_via: 'landlord_portal',
    }]);
    seedPendingLease();

    const result = await service.denyTenantRequest('lease-1', 'auth-pending');

    expect(result.success).toBe(false);
  });

  test('unverified authority cannot invite tenants', async () => {
    seedHome();
    seedTable('HomeAuthority', [{
      id: 'auth-pending',
      home_id: 'home-1',
      subject_type: 'user',
      subject_id: 'landlord-1',
      role: 'owner',
      status: 'pending',
      verification_tier: 'weak',
      added_via: 'landlord_portal',
    }]);

    const result = await service.inviteTenant(
      'auth-pending', 'home-1', 'tenant@example.com', '2026-04-01',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be verified');
  });

  test('verified authority CAN approve tenant request', async () => {
    seedHome();
    seedVerifiedAuthority();
    seedPendingLease();

    const result = await service.approveTenantRequest('lease-1', 'auth-1');

    expect(result.success).toBe(true);
    expect(result.lease.state).toBe('active');
  });
});

// ============================================================
// Authority verification flow
// ============================================================

describe('authority request → verification', () => {
  test('request creates pending authority, verify activates it', async () => {
    seedHome();

    // Step 1: Request authority
    const reqResult = await service.requestAuthority('user', 'landlord-1', 'home-1', 'deed', {
      storage_ref: 's3://bucket/deed.pdf',
      metadata: { pages: 3 },
    });
    expect(reqResult.success).toBe(true);
    expect(reqResult.authority.status).toBe('pending');

    // Step 2: Admin verifies
    const verifyResult = await service.verifyAuthority(
      reqResult.authority.id, 'reviewer-1', 'verified',
    );
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.authority.status).toBe('verified');
    expect(verifyResult.authority.verification_tier).toBe('strong'); // deed = strong
  });

  test('evidence tier reflects strongest document', async () => {
    seedHome();

    const reqResult = await service.requestAuthority('user', 'landlord-1', 'home-1', 'utility_bill', {
      storage_ref: 's3://bucket/bill.pdf',
    });

    // Add stronger evidence
    seedTable('HomeVerificationEvidence', [{
      id: 'ev-strong',
      claim_id: reqResult.claim?.id || 'fallback',
      evidence_type: 'escrow_attestation',
      provider: 'manual',
      status: 'verified',
    }]);

    const verifyResult = await service.verifyAuthority(
      reqResult.authority.id, 'reviewer-1', 'verified',
    );

    // Should use highest tier (escrow_attestation = legal)
    expect(verifyResult.authority.verification_tier).toBe('legal');
  });
});

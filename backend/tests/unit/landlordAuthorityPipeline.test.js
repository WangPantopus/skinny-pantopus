// ============================================================
// TEST: Landlord service orchestration
//
// Invitation creation, authority verification and lease end use mocks here.
// Admission persistence, authorization, dates and retry behavior execute the
// real function in scripts/db/contracts/home-lease-decisions.sql.
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

// Admission persistence is verified by the real home-lease-decisions SQL contract.
describe('invitation creation', () => {
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

describe('invitation authority', () => {
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
});

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

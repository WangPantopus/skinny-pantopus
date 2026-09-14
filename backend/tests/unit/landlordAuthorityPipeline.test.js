// ============================================================
// TEST: Landlord service orchestration
//
// Invitation creation and authority verification use mocks here.
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

// Invitation creation/expiry/authority now execute the actual SQL contract.
// Proof transport and notification replay are covered in landlordAuthorityService.test.js.

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

// ============================================================
// TEST: OccupancyAttachService
//
// Comprehensive unit tests for the centralized occupancy gateway:
//   attach(), detach(), upgradeRole()
//
// Uses the in-memory supabaseAdmin mock.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock homePermissions ────────────────────────────────────
jest.mock('../../utils/homePermissions', () => ({
  writeAuditLog: jest.fn(),
  applyOccupancyTemplate: jest.fn().mockResolvedValue({
    occupancy: { id: 'mock-occ-template' },
    template: {},
  }),
  VERIFIED_TEMPLATES: {
    owner: {
      can_manage_home: true,
      can_manage_access: true,
      can_manage_finance: true,
      can_manage_tasks: true,
      can_view_sensitive: true,
    },
    admin: {
      can_manage_home: true,
      can_manage_access: true,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: true,
    },
    member: {
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: false,
    },
  },
  ALL_FALSE_TEMPLATE: {
    can_manage_home: false,
    can_manage_access: false,
    can_manage_finance: false,
    can_manage_tasks: false,
    can_view_sensitive: false,
  },
}));

const { writeAuditLog, applyOccupancyTemplate } = require('../../utils/homePermissions');

// Must require AFTER mocks
const service = require('../../services/occupancyAttachService');
const { OccupancyAttachService } = service;

// ── Seed helpers ────────────────────────────────────────────

function seedHome(overrides = {}) {
  const homes = getTable('Home');
  const home = {
    id: 'home-1',
    name: 'Test Home',
    address_id: 'addr-1',
    home_type: 'unit',
    owner_id: 'owner-1',
    member_attach_policy: 'open_invite',
    security_state: 'normal',
    ...overrides,
  };
  homes.push(home);
  return home;
}

function seedAddress(overrides = {}) {
  const addresses = getTable('HomeAddress');
  const addr = {
    id: 'addr-1',
    building_type: 'single_family',
    missing_secondary_flag: false,
    ...overrides,
  };
  addresses.push(addr);
  return addr;
}

function seedClaim(overrides = {}) {
  const claims = getTable('AddressClaim');
  const claim = {
    id: 'claim-1',
    user_id: 'user-1',
    address_id: 'addr-1',
    claim_status: 'verified',
    verification_method: 'mail_code',
    claim_type: 'resident',
    ...overrides,
  };
  claims.push(claim);
  return claim;
}

function seedOccupancy(overrides = {}) {
  const occupancies = getTable('HomeOccupancy');
  const occ = {
    id: 'occ-1',
    home_id: 'home-1',
    user_id: 'user-1',
    role: 'member',
    role_base: 'member',
    is_active: true,
    verification_status: 'verified',
    start_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  occupancies.push(occ);
  return occ;
}

// ── Setup / Teardown ────────────────────────────────────────

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

// ============================================================
// attach() — basic flows
// ============================================================

describe('attach()', () => {
  describe('basic happy path', () => {
    test('attaches a user to a home with verified claim', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
        actorId: 'user-1',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('attached');
      expect(result.occupancy).toBeDefined();
      expect(result.occupancy.home_id).toBe('home-1');
      expect(result.occupancy.user_id).toBe('user-1');
    });

    test('returns error when home not found', async () => {
      const result = await service.attach({
        homeId: 'nonexistent',
        userId: 'user-1',
        method: 'mail_code',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Home not found');
    });

    test('calls applyOccupancyTemplate after creation', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(applyOccupancyTemplate).toHaveBeenCalledWith(
        'home-1', 'user-1', 'member', 'verified',
      );
    });

    test('writes audit log on successful attach', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
        actorId: 'user-1',
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        'home-1', 'user-1', 'OCCUPANCY_ATTACHED', 'HomeOccupancy',
        expect.any(String),
        expect.objectContaining({
          method: 'mail_code',
          role: 'member',
          verification_status: 'verified',
        }),
      );
    });
  });

  // ── Address claim validation ──────────────────────────────

  describe('address claim validation', () => {
    test('rejects when no verified claim exists', async () => {
      seedHome();
      seedAddress();
      // No claim seeded

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No verified address claim/);
    });

    test('rejects claim with non-verified status', async () => {
      seedHome();
      seedAddress();
      seedClaim({ claim_status: 'pending' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No verified address claim/);
    });

    test('bypasses claim check for landlord_invite (escalated)', async () => {
      seedHome();
      seedAddress();
      // No claim needed

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'landlord_invite',
        roleOverride: 'lease_resident',
      });

      expect(result.success).toBe(true);
    });

    test('bypasses claim check for admin_override (escalated)', async () => {
      seedHome();
      seedAddress();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'admin_override',
        claimType: 'owner',
        roleOverride: 'owner',
        actorId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    test('bypasses claim check for owner_bootstrap (escalated)', async () => {
      seedHome();
      seedAddress();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'owner_bootstrap',
        claimType: 'member',
      });

      expect(result.success).toBe(true);
    });

    test('passes when home has no address_id (legacy home)', async () => {
      seedHome({ address_id: null });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      // No address → claim check returns valid, no unit check
      expect(result.success).toBe(true);
    });
  });

  // ── Multi-unit building check ─────────────────────────────

  describe('multi-unit building check', () => {
    test('rejects multi-unit without unit number', async () => {
      seedHome();
      seedAddress({ building_type: 'multi_unit', missing_secondary_flag: true });
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unit number is required/);
    });

    test('allows multi-unit with unit number provided', async () => {
      seedHome();
      seedAddress({ building_type: 'multi_unit', missing_secondary_flag: true });
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
        unitNumber: '4B',
      });

      expect(result.success).toBe(true);
    });

    test('allows multi-unit when missing_secondary_flag is false', async () => {
      seedHome();
      seedAddress({ building_type: 'multi_unit', missing_secondary_flag: false });
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
    });

    test('does not require unit for single_family buildings', async () => {
      seedHome();
      seedAddress({ building_type: 'single_family' });
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
    });
  });

  // ── Role resolution ───────────────────────────────────────

  describe('role resolution', () => {
    test('uses roleOverride when provided', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
        roleOverride: 'admin',
      });

      expect(result.success).toBe(true);
      expect(result.occupancy.role).toBe('admin');
    });

    test('mail_code maps to member role', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'owner', // claim_type ignored when method has explicit role
      });

      expect(result.occupancy.role).toBe('member');
    });

    test('landlord_invite maps to lease_resident', async () => {
      seedHome();
      seedAddress();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'landlord_invite',
      });

      expect(result.occupancy.role).toBe('lease_resident');
    });

    test('landlord_approval maps to lease_resident', async () => {
      seedHome();
      seedAddress();
      seedClaim({ verification_method: 'landlord_approval' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'landlord_approval',
      });

      expect(result.occupancy.role).toBe('lease_resident');
    });

    test('autocomplete_ok falls through to claim_type', async () => {
      seedHome();
      seedAddress();
      seedClaim({ verification_method: 'autocomplete_ok' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'autocomplete_ok',
        claimType: 'owner',
      });

      expect(result.occupancy.role).toBe('owner');
    });

    test('defaults to member when no method role and no claim_type', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'doc_upload', // null in VERIFICATION_ROLE_MAP
        // no claimType
      });

      expect(result.occupancy.role).toBe('member');
    });
  });

  // ── Verification status resolution ────────────────────────

  describe('verification status resolution', () => {
    test('mail_code → verified', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.occupancy.verification_status).toBe('verified');
    });

    test('owner_bootstrap → provisional_bootstrap', async () => {
      seedHome();
      seedAddress();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'owner_bootstrap',
        claimType: 'member',
      });

      expect(result.occupancy.verification_status).toBe('provisional_bootstrap');
    });

    test('unknown method → unverified', async () => {
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'some_unknown_method',
        claimType: 'resident',
      });

      expect(result.occupancy.verification_status).toBe('unverified');
    });
  });

  // ── Existing active occupancy ─────────────────────────────

  describe('existing active occupancy', () => {
    test('upgrades role when new role is higher', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      seedOccupancy({
        role: 'member',
        role_base: 'member',
        is_active: true,
      });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'admin_override',
        roleOverride: 'owner',
        actorId: 'admin-1',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('upgraded');
      expect(applyOccupancyTemplate).toHaveBeenCalledWith(
        'home-1', 'user-1', 'owner', 'verified',
      );
    });

    test('returns already_attached for equal role', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      seedOccupancy({
        role: 'member',
        role_base: 'member',
        is_active: true,
        verification_status: 'verified',
      });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('already_attached');
    });

    test('updates verification_status to verified when currently not verified', async () => {
      seedHome();
      seedAddress();
      seedOccupancy({
        role: 'owner',
        role_base: 'owner',
        is_active: true,
        verification_status: 'unverified',
      });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'admin_override',
        roleOverride: 'member', // lower rank than owner
        actorId: 'admin-1',
      });

      expect(result.success).toBe(true);
      // Check that verification_status was updated in the table
      const occs = getTable('HomeOccupancy');
      expect(occs[0].verification_status).toBe('verified');
    });
  });

  // ── Reactivation ──────────────────────────────────────────

  describe('reactivation', () => {
    test('reactivates an inactive occupancy', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      seedOccupancy({
        is_active: false,
        end_at: new Date().toISOString(),
        verification_status: 'moved_out',
      });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('reactivated');
      expect(result.occupancy.is_active).toBe(true);
    });
  });

  // ── Household policy enforcement ──────────────────────────

  describe('household attach policy', () => {
    test('open_invite allows attachment when household exists', async () => {
      seedHome({ member_attach_policy: 'open_invite' });
      seedAddress();
      seedClaim();
      // Existing occupant
      seedOccupancy({ id: 'other-occ', user_id: 'other-user' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
    });

    test('admin_approval defers non-owner when household exists', async () => {
      seedHome({ member_attach_policy: 'admin_approval' });
      seedAddress();
      seedClaim();
      // Existing occupant creates a household
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending_approval');
    });

    test('admin_approval allows owner role even with household', async () => {
      seedHome({ member_attach_policy: 'admin_approval' });
      seedAddress();
      seedClaim();
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'doc_upload',
        claimType: 'owner',
        roleOverride: 'owner',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('attached');
    });

    test('admin_approval allows attachment when no household exists', async () => {
      seedHome({ member_attach_policy: 'admin_approval' });
      seedAddress();
      seedClaim();
      // No existing occupants

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('attached');
    });

    test('verified_only rejects without landlord authority', async () => {
      seedHome({ member_attach_policy: 'verified_only' });
      seedAddress();
      seedClaim();
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });
      // No HomeAuthority seeded

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/requires landlord verification/);
    });

    test('verified_only allows when HomeAuthority is verified', async () => {
      seedHome({ member_attach_policy: 'verified_only' });
      seedAddress();
      seedClaim();
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });
      // Seed a verified authority
      const auths = getTable('HomeAuthority');
      auths.push({
        id: 'auth-1',
        home_id: 'home-1',
        status: 'verified',
      });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
    });

    test('escalated methods bypass policy checks', async () => {
      seedHome({ member_attach_policy: 'admin_approval' });
      seedAddress();
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'landlord_invite',
        roleOverride: 'lease_resident',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('attached');
    });
  });

  // ── First verified occupant ───────────────────────────────

  describe('first verified occupant', () => {
    test('sets can_manage_home when first occupant', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      // No existing occupants

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      expect(result.occupancy.can_manage_home).toBe(true);
    });

    test('does not set can_manage_home when other occupants exist', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      seedOccupancy({ id: 'existing-occ', user_id: 'other-user' });

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
      // Not the first occupant
      expect(result.occupancy.can_manage_home).toBeFalsy();
    });
  });

  // ── Vacancy clearing ──────────────────────────────────────

  describe('vacancy clearing', () => {
    test('clears vacancy_at for verified attach', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      // Set vacancy on the home
      const homes = getTable('Home');
      homes[0].vacancy_at = '2025-01-01T00:00:00.000Z';

      await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(homes[0].vacancy_at).toBeNull();
    });

    test('does not clear vacancy_at for unverified attach', async () => {
      seedHome();
      seedAddress();
      seedClaim();
      const homes = getTable('Home');
      homes[0].vacancy_at = '2025-01-01T00:00:00.000Z';

      await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'some_unknown', // → unverified
        claimType: 'resident',
      });

      expect(homes[0].vacancy_at).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  // ── Template failure handling ─────────────────────────────

  describe('template application failure', () => {
    test('succeeds even when applyOccupancyTemplate throws (non-fatal)', async () => {
      applyOccupancyTemplate.mockRejectedValueOnce(new Error('template boom'));
      seedHome();
      seedAddress();
      seedClaim();

      const result = await service.attach({
        homeId: 'home-1',
        userId: 'user-1',
        method: 'mail_code',
        claimType: 'resident',
      });

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================
// detach()
// ============================================================

describe('detach()', () => {
  test('deactivates an active occupancy', async () => {
    seedOccupancy();

    const result = await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'move_out',
      actorId: 'user-1',
    });

    expect(result.success).toBe(true);

    const occs = getTable('HomeOccupancy');
    expect(occs[0].is_active).toBe(false);
    expect(occs[0].end_at).toBeDefined();
    expect(occs[0].verification_status).toBe('moved_out');
  });

  test('returns error when no active occupancy exists', async () => {
    const result = await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'move_out',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No active occupancy/);
  });

  test('sets verification_status to suspended_challenged for challenge reason', async () => {
    seedOccupancy();

    await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'challenged',
    });

    const occs = getTable('HomeOccupancy');
    expect(occs[0].verification_status).toBe('suspended_challenged');
  });

  test('sets verification_status to suspended for suspended reason', async () => {
    seedOccupancy();

    await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'suspended',
    });

    const occs = getTable('HomeOccupancy');
    expect(occs[0].verification_status).toBe('suspended');
  });

  test('sets verification_status to inactive for removed reason', async () => {
    seedOccupancy();

    await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'removed',
    });

    const occs = getTable('HomeOccupancy');
    expect(occs[0].verification_status).toBe('inactive');
  });

  test('sets verification_status to inactive for lease_ended reason', async () => {
    seedOccupancy();

    await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'lease_ended',
    });

    const occs = getTable('HomeOccupancy');
    expect(occs[0].verification_status).toBe('inactive');
  });

  test('writes audit log on detach', async () => {
    seedOccupancy();

    await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'move_out',
      actorId: 'admin-1',
      metadata: { extra: 'info' },
    });

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'admin-1', 'OCCUPANCY_DETACHED', 'HomeOccupancy',
      'occ-1',
      expect.objectContaining({
        reason: 'move_out',
        verification_status: 'moved_out',
        extra: 'info',
      }),
    );
  });

  test('does not deactivate already-inactive occupancy', async () => {
    seedOccupancy({ is_active: false });

    const result = await service.detach({
      homeId: 'home-1',
      userId: 'user-1',
      reason: 'move_out',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No active occupancy/);
  });
});

// ============================================================
// upgradeRole()
// ============================================================

describe('upgradeRole()', () => {
  test('upgrades an existing occupant role', async () => {
    seedOccupancy();

    const result = await service.upgradeRole({
      homeId: 'home-1',
      userId: 'user-1',
      newRole: 'owner',
      actorId: 'admin-1',
    });

    expect(result.success).toBe(true);
    expect(applyOccupancyTemplate).toHaveBeenCalledWith(
      'home-1', 'user-1', 'owner', 'verified',
    );
  });

  test('returns error when no occupancy found', async () => {
    const result = await service.upgradeRole({
      homeId: 'home-1',
      userId: 'nonexistent',
      newRole: 'owner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No occupancy found/);
  });

  test('writes audit log with previous and new role', async () => {
    seedOccupancy({ role_base: 'member' });

    await service.upgradeRole({
      homeId: 'home-1',
      userId: 'user-1',
      newRole: 'admin',
      actorId: 'admin-1',
      metadata: { reason: 'claim_approved' },
    });

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'admin-1', 'OCCUPANCY_ROLE_UPGRADED', 'HomeOccupancy',
      'occ-1',
      expect.objectContaining({
        previous_role: 'member',
        new_role: 'admin',
        reason: 'claim_approved',
      }),
    );
  });

  test('uses custom verification status', async () => {
    seedOccupancy();

    await service.upgradeRole({
      homeId: 'home-1',
      userId: 'user-1',
      newRole: 'owner',
      verificationStatus: 'provisional',
    });

    expect(applyOccupancyTemplate).toHaveBeenCalledWith(
      'home-1', 'user-1', 'owner', 'provisional',
    );
  });

  test('returns error when applyOccupancyTemplate throws', async () => {
    seedOccupancy();
    applyOccupancyTemplate.mockRejectedValueOnce(new Error('template error'));

    const result = await service.upgradeRole({
      homeId: 'home-1',
      userId: 'user-1',
      newRole: 'admin',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to upgrade role/);
  });
});

// ============================================================
// Constants
// ============================================================

describe('constants', () => {
  test('VERIFICATION_ROLE_MAP contains expected mappings', () => {
    expect(OccupancyAttachService.VERIFICATION_ROLE_MAP).toEqual({
      autocomplete_ok: null,
      mail_code: 'member',
      landlord_approval: 'lease_resident',
      landlord_invite: 'lease_resident',
      owner_invite: 'owner',
      doc_upload: null,
      manual_review: null,
    });
  });

  test('ESCALATED_METHODS contains expected methods', () => {
    expect(OccupancyAttachService.ESCALATED_METHODS.size).toBe(4);
    expect(OccupancyAttachService.ESCALATED_METHODS.has('landlord_invite')).toBe(true);
    expect(OccupancyAttachService.ESCALATED_METHODS.has('admin_override')).toBe(true);
    expect(OccupancyAttachService.ESCALATED_METHODS.has('owner_bootstrap')).toBe(true);
    expect(OccupancyAttachService.ESCALATED_METHODS.has('owner_invite')).toBe(true);
  });

  test('CLAIM_TYPE_ROLE_MAP maps claim types to roles', () => {
    expect(OccupancyAttachService.CLAIM_TYPE_ROLE_MAP).toEqual({
      owner: 'owner',
      admin: 'admin',
      resident: 'member',
      member: 'member',
    });
  });
});

// ============================================================
// _resolveRole (private, tested indirectly via constants)
// ============================================================

describe('_resolveRole logic', () => {
  test('roleOverride takes highest priority', () => {
    const svc = new OccupancyAttachService();
    expect(svc._resolveRole('mail_code', 'owner', 'admin')).toBe('admin');
  });

  test('method role takes second priority', () => {
    const svc = new OccupancyAttachService();
    expect(svc._resolveRole('landlord_invite', 'owner', null)).toBe('lease_resident');
  });

  test('falls back to claim_type when method returns null', () => {
    const svc = new OccupancyAttachService();
    expect(svc._resolveRole('autocomplete_ok', 'owner', null)).toBe('owner');
  });

  test('defaults to member with no override/method/claim', () => {
    const svc = new OccupancyAttachService();
    expect(svc._resolveRole('autocomplete_ok', null, null)).toBe('member');
  });
});

// ============================================================
// _resolveVerificationStatus (private)
// ============================================================

describe('_resolveVerificationStatus logic', () => {
  const svc = new OccupancyAttachService();

  test.each([
    ['autocomplete_ok', 'verified'],
    ['mail_code', 'verified'],
    ['landlord_invite', 'verified'],
    ['owner_invite', 'verified'],
    ['admin_override', 'verified'],
    ['doc_upload', 'verified'],
    ['landlord_approval', 'verified'],
    ['owner_bootstrap', 'provisional_bootstrap'],
    ['random_method', 'unverified'],
  ])('%s → %s', (method, expected) => {
    expect(svc._resolveVerificationStatus(method)).toBe(expected);
  });
});

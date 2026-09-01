// ============================================================
// TEST: OccupancyAttach Pipeline — Integration Tests
//
// End-to-end flow tests for the centralized occupancy gateway
// with 5 scenarios:
//   1. No claim = no occupancy (non-escalated methods require claim)
//   2. Multi-unit requires unit number
//   3. Mail-verified user is never admin (always member)
//   4. First verified occupant = household_creator (can_manage_home)
//   5. Second user on admin_approval policy = pending
//
// Uses in-memory supabaseAdmin mock with mocked homePermissions.
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
    lease_resident: {
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
    id: 'occ-existing',
    home_id: 'home-1',
    user_id: 'user-existing',
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
// 1. No claim = no occupancy (non-escalated requires verified claim)
// ============================================================

describe('no claim = no occupancy', () => {
  test('mail_code without verified claim is rejected', async () => {
    seedHome();
    seedAddress();
    // No AddressClaim seeded

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No verified address claim/);
  });

  test('autocomplete_ok without verified claim is rejected', async () => {
    seedHome();
    seedAddress();
    // No claim

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'autocomplete_ok',
      claimType: 'resident',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No verified address claim/);
  });

  test('pending claim status is insufficient', async () => {
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

  test('escalated method (landlord_invite) bypasses claim check', async () => {
    seedHome();
    seedAddress();
    // No claim needed for escalated method

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
    });

    expect(result.success).toBe(true);
  });

  test('escalated method (admin_override) bypasses claim check', async () => {
    seedHome();
    seedAddress();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'admin_override',
      roleOverride: 'owner',
      actorId: 'admin-1',
    });

    expect(result.success).toBe(true);
  });

  test('escalated method (owner_bootstrap) bypasses claim check', async () => {
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
});

// ============================================================
// 2. Multi-unit requires unit number
// ============================================================

describe('multi-unit requires unit number', () => {
  test('multi-unit building without unit is rejected', async () => {
    seedHome();
    seedAddress({ building_type: 'multi_unit', missing_secondary_flag: true });
    seedClaim();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
      // No unitNumber
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unit number is required/i);
  });

  test('multi-unit building with unit succeeds', async () => {
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

  test('single_family building does not require unit', async () => {
    seedHome();
    seedAddress({ building_type: 'single_family', missing_secondary_flag: false });
    seedClaim();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.success).toBe(true);
  });

  test('multi-unit with missing_secondary_flag false does not require unit', async () => {
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
});

// ============================================================
// 3. Mail-verified user is never admin (always member)
// ============================================================

describe('mail-verified user is never admin', () => {
  test('mail_code maps to member role regardless of claim_type', async () => {
    seedHome();
    seedAddress();
    seedClaim({ claim_type: 'owner' });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'owner', // Attempting to claim as owner
    });

    expect(result.success).toBe(true);
    expect(result.occupancy.role).toBe('member'); // Never admin/owner
  });

  test('mail_code with admin claim_type still gets member role', async () => {
    seedHome();
    seedAddress();
    seedClaim({ claim_type: 'admin' });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'admin',
    });

    expect(result.success).toBe(true);
    expect(result.occupancy.role).toBe('member');
  });

  test('mail_code with resident claim_type gets member role', async () => {
    seedHome();
    seedAddress();
    seedClaim();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.occupancy.role).toBe('member');
  });

  test('landlord_invite gets lease_resident (not member)', async () => {
    seedHome();
    seedAddress();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
    });

    expect(result.occupancy.role).toBe('lease_resident');
  });

  test('landlord_approval gets lease_resident (not member)', async () => {
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

  test('autocomplete_ok falls through to claim_type for role', async () => {
    seedHome();
    seedAddress();
    seedClaim({ verification_method: 'autocomplete_ok', claim_type: 'owner' });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'autocomplete_ok',
      claimType: 'owner',
    });

    expect(result.occupancy.role).toBe('owner');
  });

  test('roleOverride can still override mail_code role', async () => {
    seedHome();
    seedAddress();
    seedClaim();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
      roleOverride: 'admin', // Explicit override
    });

    expect(result.occupancy.role).toBe('admin');
  });
});

// ============================================================
// 4. First verified occupant = household_creator (can_manage_home)
// ============================================================

describe('first verified occupant = household_creator', () => {
  test('first occupant gets can_manage_home = true', async () => {
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
    expect(result.occupancy.can_manage_home).toBe(true);
  });

  test('second occupant gets can_manage_home = false', async () => {
    seedHome();
    seedAddress();
    seedClaim();

    // First occupant already exists
    seedOccupancy({
      id: 'occ-first',
      user_id: 'user-first',
      can_manage_home: true,
    });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.success).toBe(true);
    // Second occupant should not get can_manage_home
    const newOcc = getTable('HomeOccupancy').find(o => o.user_id === 'user-1');
    expect(newOcc.can_manage_home).toBeFalsy();
  });

  test('first occupant with landlord_invite also gets can_manage_home', async () => {
    seedHome();
    seedAddress();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
    });

    expect(result.success).toBe(true);
    expect(result.occupancy.can_manage_home).toBe(true);
  });

  test('applies occupancy template after creation', async () => {
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
});

// ============================================================
// 5. Second user on admin_approval policy = pending
// ============================================================

describe('admin_approval policy = pending occupancy', () => {
  test('admin_approval policy creates pending occupancy for non-first user', async () => {
    seedHome({ member_attach_policy: 'admin_approval' });
    seedAddress();
    seedClaim();

    // First occupant already exists (household creator)
    seedOccupancy({
      id: 'occ-first',
      user_id: 'user-first',
      can_manage_home: true,
    });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('pending_approval');
    // Occupancy created but not active
    expect(result.occupancy.is_active).toBe(false);
  });

  test('open_invite policy immediately attaches second user', async () => {
    seedHome({ member_attach_policy: 'open_invite' });
    seedAddress();
    seedClaim();

    // First occupant already exists
    seedOccupancy({
      id: 'occ-first',
      user_id: 'user-first',
      can_manage_home: true,
    });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('attached');
  });

  test('first user on admin_approval policy is immediately attached', async () => {
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
    // First occupant should be immediately attached regardless of policy
    expect(result.occupancy.can_manage_home).toBe(true);
  });

  test('escalated method bypasses admin_approval policy', async () => {
    seedHome({ member_attach_policy: 'admin_approval' });
    seedAddress();

    // First occupant exists
    seedOccupancy({
      id: 'occ-first',
      user_id: 'user-first',
      can_manage_home: true,
    });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
    });

    expect(result.success).toBe(true);
    // Escalated methods should not be deferred
    expect(result.status).not.toBe('pending_approval');
  });
});

// ============================================================
// Verification status resolution
// ============================================================

describe('verification status resolution', () => {
  test('mail_code → verified status', async () => {
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

  test('owner_bootstrap → provisional_bootstrap status', async () => {
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

  test('landlord_invite → verified status', async () => {
    seedHome();
    seedAddress();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
    });

    expect(result.occupancy.verification_status).toBe('verified');
  });

  test('admin_override → verified status', async () => {
    seedHome();
    seedAddress();

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'admin_override',
      roleOverride: 'owner',
      actorId: 'admin-1',
    });

    expect(result.occupancy.verification_status).toBe('verified');
  });
});

// ============================================================
// Existing occupancy handling
// ============================================================

describe('existing occupancy handling', () => {
  test('returns already_attached when active occupancy exists with same/higher role', async () => {
    seedHome();
    seedAddress();
    seedClaim();
    seedOccupancy({
      id: 'occ-1',
      user_id: 'user-1',
      role: 'member',
      is_active: true,
      verification_status: 'verified',
    });

    const result = await service.attach({
      homeId: 'home-1',
      userId: 'user-1',
      method: 'mail_code',
      claimType: 'resident',
    });

    // Should detect existing and return appropriate status
    expect(result.success).toBe(true);
  });

  test('home not found returns error', async () => {
    const result = await service.attach({
      homeId: 'nonexistent',
      userId: 'user-1',
      method: 'mail_code',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Home not found');
  });
});

// ============================================================
// Audit logging
// ============================================================

describe('audit logging', () => {
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

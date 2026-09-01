// ============================================================
// TEST: Home IAM Permissions
// Validates permission resolution: role hierarchy, overrides,
// legacy flag mapping, and ownership checks.
// ============================================================

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const {
  hasPermission,
  getUserAccess,
  checkHomePermission,
  getActiveOccupancy,
  mapLegacyRole,
  getRoleRank,
  ROLE_RANK,
} = require('../utils/homePermissions');

beforeEach(() => resetTables());

// ── mapLegacyRole (pure logic) ──────────────────────────────
describe('mapLegacyRole', () => {
  test('maps known legacy roles correctly', () => {
    expect(mapLegacyRole('owner')).toBe('owner');
    expect(mapLegacyRole('admin')).toBe('admin');
    expect(mapLegacyRole('property_manager')).toBe('manager');
    expect(mapLegacyRole('manager')).toBe('manager');
    expect(mapLegacyRole('tenant')).toBe('lease_resident');
    expect(mapLegacyRole('roommate')).toBe('member');
    expect(mapLegacyRole('renter')).toBe('lease_resident');
    expect(mapLegacyRole('family')).toBe('member');
    expect(mapLegacyRole('member')).toBe('member');
    expect(mapLegacyRole('caregiver')).toBe('restricted_member');
    expect(mapLegacyRole('guest')).toBe('guest');
  });

  test('unknown role defaults to member', () => {
    expect(mapLegacyRole('banana')).toBe('member');
    expect(mapLegacyRole(undefined)).toBe('member');
    expect(mapLegacyRole(null)).toBe('member');
  });
});

// ── getRoleRank ─────────────────────────────────────────────
describe('getRoleRank', () => {
  test('ranks are in correct order', () => {
    expect(getRoleRank('guest')).toBeLessThan(getRoleRank('restricted_member'));
    expect(getRoleRank('restricted_member')).toBeLessThan(getRoleRank('member'));
    expect(getRoleRank('member')).toBeLessThan(getRoleRank('manager'));
    expect(getRoleRank('manager')).toBeLessThan(getRoleRank('admin'));
    expect(getRoleRank('admin')).toBeLessThan(getRoleRank('owner'));
  });

  test('unknown role returns 0', () => {
    expect(getRoleRank('banana')).toBe(0);
  });

  test('every ROLE_RANK entry has a positive value', () => {
    for (const [role, rank] of Object.entries(ROLE_RANK)) {
      expect(rank).toBeGreaterThan(0);
    }
  });
});

// ── getActiveOccupancy ──────────────────────────────────────
describe('getActiveOccupancy', () => {
  const homeId = 'home-1';
  const userId = 'user-1';

  test('returns occupancy when active and in time window', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: homeId,
      user_id: userId,
      is_active: true,
      role: 'member',
      role_base: 'member',
      start_at: null,
      end_at: null,
    }]);

    const occ = await getActiveOccupancy(homeId, userId);
    expect(occ).not.toBeNull();
    expect(occ.id).toBe('occ-1');
  });

  test('returns null for inactive occupancy', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: homeId,
      user_id: userId,
      is_active: false,
      role: 'member',
      role_base: 'member',
    }]);

    const occ = await getActiveOccupancy(homeId, userId);
    expect(occ).toBeNull();
  });

  test('returns null when start_at is in the future', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: homeId,
      user_id: userId,
      is_active: true,
      role_base: 'member',
      start_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      end_at: null,
    }]);

    const occ = await getActiveOccupancy(homeId, userId);
    expect(occ).toBeNull();
  });

  test('returns null when end_at has passed', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: homeId,
      user_id: userId,
      is_active: true,
      role_base: 'member',
      start_at: null,
      end_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
    }]);

    const occ = await getActiveOccupancy(homeId, userId);
    expect(occ).toBeNull();
  });
});

// ── hasPermission ───────────────────────────────────────────
describe('hasPermission', () => {
  const homeId = 'home-1';
  const userId = 'user-1';

  test('returns false when user has no occupancy', async () => {
    seedTable('HomeOccupancy', []);
    const result = await hasPermission(homeId, userId, 'home.edit');
    expect(result).toBe(false);
  });

  test('returns true when role has the permission', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: homeId, user_id: userId, is_active: true,
      role_base: 'admin', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', [{
      id: 'rp-1', role_base: 'admin', permission: 'home.edit', allowed: true,
    }]);

    const result = await hasPermission(homeId, userId, 'home.edit');
    expect(result).toBe(true);
  });

  test('returns false when role does not have the permission', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: homeId, user_id: userId, is_active: true,
      role_base: 'guest', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', []);

    const result = await hasPermission(homeId, userId, 'finance.manage');
    expect(result).toBe(false);
  });

  test('override grants permission even if role denies', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: homeId, user_id: userId, is_active: true,
      role_base: 'guest', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', [{
      id: 'ov-1', home_id: homeId, user_id: userId,
      permission: 'finance.view', allowed: true,
    }]);
    seedTable('HomeRolePermission', []);

    const result = await hasPermission(homeId, userId, 'finance.view');
    expect(result).toBe(true);
  });

  test('override denies permission even if role grants', async () => {
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: homeId, user_id: userId, is_active: true,
      role_base: 'admin', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', [{
      id: 'ov-1', home_id: homeId, user_id: userId,
      permission: 'home.edit', allowed: false,
    }]);
    seedTable('HomeRolePermission', [{
      id: 'rp-1', role_base: 'admin', permission: 'home.edit', allowed: true,
    }]);

    const result = await hasPermission(homeId, userId, 'home.edit');
    expect(result).toBe(false);
  });
});

// ── getUserAccess ───────────────────────────────────────────
describe('getUserAccess', () => {
  const homeId = 'home-1';
  const legacyOwnerId = 'owner-legacy';
  const coOwnerId = 'owner-co';

  test('sets isOwner true for verified HomeOwner even when Home.owner_id is someone else', async () => {
    seedTable('Home', [{ id: homeId, owner_id: legacyOwnerId }]);
    seedTable('HomeOwner', [{
      id: 'ho-co',
      home_id: homeId,
      subject_id: coOwnerId,
      subject_type: 'user',
      owner_status: 'verified',
      verification_tier: 'standard',
      is_primary_owner: false,
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-co',
      home_id: homeId,
      user_id: coOwnerId,
      is_active: true,
      role_base: 'owner',
      start_at: null,
      end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', [{
      id: 'rp-o', role_base: 'owner', permission: 'home.view', allowed: true,
    }]);

    const access = await getUserAccess(homeId, coOwnerId);
    expect(access.isOwner).toBe(true);
    expect(access.role_base).toBe('owner');
  });

  test('sets isOwner true for IAM role_base owner without HomeOwner row or legacy owner_id', async () => {
    const promotedId = 'promoted-owner';
    seedTable('Home', [{ id: homeId, owner_id: legacyOwnerId }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', [{
      id: 'occ-prom',
      home_id: homeId,
      user_id: promotedId,
      is_active: true,
      role: 'member',
      role_base: 'owner',
      start_at: null,
      end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', [{
      id: 'rp-o2', role_base: 'owner', permission: 'home.view', allowed: true,
    }]);

    const access = await getUserAccess(homeId, promotedId);
    expect(access.isOwner).toBe(true);
    expect(access.role_base).toBe('owner');
  });
});

// ── checkHomePermission ─────────────────────────────────────
describe('checkHomePermission', () => {
  const homeId = 'home-1';
  const ownerId = 'owner-1';
  const memberId = 'member-1';

  test('owner always has all permissions', async () => {
    seedTable('Home', [{ id: homeId, owner_id: ownerId }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1', home_id: homeId, user_id: ownerId, is_active: true,
      role_base: 'owner', start_at: null, end_at: null,
    }]);
    seedTable('HomeOwner', []);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', []);

    const result = await checkHomePermission(homeId, ownerId, 'finance.manage');
    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(true);
  });

  test('non-member gets no access', async () => {
    seedTable('Home', [{ id: homeId, owner_id: ownerId }]);
    seedTable('HomeOccupancy', []);
    seedTable('HomeOwner', []);

    const result = await checkHomePermission(homeId, 'stranger', 'home.edit');
    expect(result.hasAccess).toBe(false);
    expect(result.isOwner).toBe(false);
  });

  test('member has access but permission depends on role', async () => {
    seedTable('Home', [{ id: homeId, owner_id: ownerId }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', [{
      id: 'occ-2', home_id: homeId, user_id: memberId, is_active: true,
      role_base: 'member', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', []);

    // No permission = just access check
    const accessOnly = await checkHomePermission(homeId, memberId);
    expect(accessOnly.hasAccess).toBe(true);
    expect(accessOnly.isOwner).toBe(false);

    // Specific permission = depends on role table
    const permCheck = await checkHomePermission(homeId, memberId, 'finance.manage');
    expect(permCheck.hasAccess).toBe(false);
  });

  test('legacy flag "can_manage_home" maps to home.edit', async () => {
    seedTable('Home', [{ id: homeId, owner_id: ownerId }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', [{
      id: 'occ-2', home_id: homeId, user_id: memberId, is_active: true,
      role_base: 'admin', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', [{
      id: 'rp-1', role_base: 'admin', permission: 'home.edit', allowed: true,
    }]);

    const result = await checkHomePermission(homeId, memberId, 'can_manage_home');
    expect(result.hasAccess).toBe(true);
  });

  test('HomeOwner verified ownership also grants access', async () => {
    seedTable('Home', [{ id: homeId, owner_id: 'someone-else' }]);
    seedTable('HomeOwner', [{
      id: 'ho-1', home_id: homeId, subject_id: memberId,
      owner_status: 'verified', verification_tier: 'deed',
      is_primary_owner: true,
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-2', home_id: homeId, user_id: memberId, is_active: true,
      role_base: 'member', start_at: null, end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', []);

    const result = await checkHomePermission(homeId, memberId, 'finance.manage');
    expect(result.isOwner).toBe(true);
    expect(result.hasAccess).toBe(true);
  });

  test('IAM role_base owner without HomeOwner row gets owner permission bypass', async () => {
    const iamOwnerId = 'iam-owner';
    seedTable('Home', [{ id: homeId, owner_id: ownerId }]);
    seedTable('HomeOwner', []);
    seedTable('HomeOccupancy', [{
      id: 'occ-iam',
      home_id: homeId,
      user_id: iamOwnerId,
      is_active: true,
      role_base: 'owner',
      start_at: null,
      end_at: null,
    }]);
    seedTable('HomePermissionOverride', []);
    seedTable('HomeRolePermission', []);

    const result = await checkHomePermission(homeId, iamOwnerId, 'finance.manage');
    expect(result.isOwner).toBe(true);
    expect(result.hasAccess).toBe(true);
  });
});

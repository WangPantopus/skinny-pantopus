// ============================================================
// TEST: Business IAM Permissions
// Validates permission resolution: owner all-access, role-based
// permissions, per-user overrides, and membership checks.
// ============================================================

const { resetTables, seedTable } = require('./__mocks__/supabaseAdmin');
const {
  hasPermission,
  getUserAccess,
  checkBusinessPermission,
  getActiveMembership,
  getRoleRank,
  BUSINESS_ROLE_RANK,
} = require('../utils/businessPermissions');

beforeEach(() => resetTables());

// ── getRoleRank (pure logic) ────────────────────────────────
describe('getRoleRank', () => {
  test('ranks are in correct order', () => {
    expect(getRoleRank('viewer')).toBeLessThan(getRoleRank('staff'));
    expect(getRoleRank('staff')).toBeLessThan(getRoleRank('editor'));
    expect(getRoleRank('editor')).toBeLessThan(getRoleRank('admin'));
    expect(getRoleRank('admin')).toBeLessThan(getRoleRank('owner'));
  });

  test('unknown role returns 0', () => {
    expect(getRoleRank('banana')).toBe(0);
  });
});

// ── getActiveMembership ─────────────────────────────────────
describe('getActiveMembership', () => {
  test('returns membership when active', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'editor',
    }]);

    const m = await getActiveMembership('biz-1', 'user-1');
    expect(m).not.toBeNull();
    expect(m.role_base).toBe('editor');
  });

  test('returns null for inactive membership', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: false, role_base: 'editor',
    }]);

    const m = await getActiveMembership('biz-1', 'user-1');
    expect(m).toBeNull();
  });

  test('returns null for non-member', async () => {
    seedTable('BusinessTeam', []);
    const m = await getActiveMembership('biz-1', 'user-1');
    expect(m).toBeNull();
  });
});

// ── hasPermission ───────────────────────────────────────────
describe('hasPermission', () => {
  test('owner always has permission', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'owner-1',
      is_active: true, role_base: 'owner',
    }]);

    const result = await hasPermission('biz-1', 'owner-1', 'team.manage');
    expect(result).toBe(true);
  });

  test('non-member has no permission', async () => {
    seedTable('BusinessTeam', []);
    const result = await hasPermission('biz-1', 'stranger', 'profile.view');
    expect(result).toBe(false);
  });

  test('role grants permission when allowed', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'staff',
    }]);
    seedTable('BusinessPermissionOverride', []);
    seedTable('BusinessRolePermission', [{
      id: 'brp-1', role_base: 'staff', permission: 'catalog.view', allowed: true,
    }]);

    const result = await hasPermission('biz-1', 'user-1', 'catalog.view');
    expect(result).toBe(true);
  });

  test('role denies permission when not defined', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'viewer',
    }]);
    seedTable('BusinessPermissionOverride', []);
    seedTable('BusinessRolePermission', []);

    const result = await hasPermission('biz-1', 'user-1', 'team.manage');
    expect(result).toBe(false);
  });

  test('override grants permission even when role denies', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'viewer',
    }]);
    seedTable('BusinessPermissionOverride', [{
      id: 'bpo-1', business_user_id: 'biz-1', user_id: 'user-1',
      permission: 'catalog.edit', allowed: true,
    }]);
    seedTable('BusinessRolePermission', []);

    const result = await hasPermission('biz-1', 'user-1', 'catalog.edit');
    expect(result).toBe(true);
  });

  test('override denies permission even when role grants', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'admin',
    }]);
    seedTable('BusinessPermissionOverride', [{
      id: 'bpo-1', business_user_id: 'biz-1', user_id: 'user-1',
      permission: 'finance.manage', allowed: false,
    }]);
    seedTable('BusinessRolePermission', [{
      id: 'brp-1', role_base: 'admin', permission: 'finance.manage', allowed: true,
    }]);

    const result = await hasPermission('biz-1', 'user-1', 'finance.manage');
    expect(result).toBe(false);
  });
});

// ── getUserAccess ───────────────────────────────────────────
describe('getUserAccess', () => {
  test('owner gets all permissions', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'owner-1',
      is_active: true, role_base: 'owner',
    }]);

    const access = await getUserAccess('biz-1', 'owner-1');
    expect(access.isOwner).toBe(true);
    expect(access.hasAccess).toBe(true);
    expect(access.permissions.length).toBeGreaterThan(10);
    expect(access.permissions).toContain('team.manage');
    expect(access.permissions).toContain('finance.manage');
  });

  test('non-member gets empty access', async () => {
    seedTable('BusinessTeam', []);
    const access = await getUserAccess('biz-1', 'stranger');
    expect(access.hasAccess).toBe(false);
    expect(access.permissions).toEqual([]);
  });

  test('staff gets role-based permissions merged with overrides', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'staff',
    }]);
    seedTable('BusinessRolePermission', [
      { id: 'brp-1', role_base: 'staff', permission: 'catalog.view', allowed: true },
      { id: 'brp-2', role_base: 'staff', permission: 'hours.view', allowed: true },
    ]);
    seedTable('BusinessPermissionOverride', [
      // Add extra permission
      { id: 'bpo-1', business_user_id: 'biz-1', user_id: 'user-1', permission: 'catalog.edit', allowed: true },
      // Revoke one
      { id: 'bpo-2', business_user_id: 'biz-1', user_id: 'user-1', permission: 'hours.view', allowed: false },
    ]);

    const access = await getUserAccess('biz-1', 'user-1');
    expect(access.hasAccess).toBe(true);
    expect(access.isOwner).toBe(false);
    expect(access.permissions).toContain('catalog.view');
    expect(access.permissions).toContain('catalog.edit');
    expect(access.permissions).not.toContain('hours.view');
  });
});

// ── checkBusinessPermission ─────────────────────────────────
describe('checkBusinessPermission', () => {
  test('owner always has access + permission', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'owner-1',
      is_active: true, role_base: 'owner',
    }]);

    const result = await checkBusinessPermission('biz-1', 'owner-1', 'team.manage');
    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(true);
  });

  test('non-member has no access', async () => {
    seedTable('BusinessTeam', []);
    const result = await checkBusinessPermission('biz-1', 'stranger', 'profile.view');
    expect(result.hasAccess).toBe(false);
  });

  test('null permission = access check only', async () => {
    seedTable('BusinessTeam', [{
      id: 'bt-1', business_user_id: 'biz-1', user_id: 'user-1',
      is_active: true, role_base: 'viewer',
    }]);

    const result = await checkBusinessPermission('biz-1', 'user-1', null);
    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(false);
  });
});

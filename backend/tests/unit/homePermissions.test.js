// ============================================================
// TEST: homePermissions utility functions
// - applyOccupancyTemplate + mapLegacyRole (dryRun, no DB)
// - assertCanMutateTarget (pure rank enforcement)
// - assertCanGrantPermission (DB-backed permission grant check)
// ============================================================

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  applyOccupancyTemplate,
  mapLegacyRole,
  assertCanMutateTarget,
  assertCanGrantPermission,
  VERIFIED_TEMPLATES,
  ALL_FALSE_TEMPLATE,
  ROLE_RANK,
} = require('../../utils/homePermissions');

const { seedTable, resetTables } = require('../__mocks__/supabaseAdmin');

const FAKE_HOME = 'home-test-000';
const FAKE_USER = 'user-test-000';

// Helper: extract the 5 booleans from a template result
function bools(template) {
  return {
    can_manage_home: template.can_manage_home,
    can_manage_access: template.can_manage_access,
    can_manage_finance: template.can_manage_finance,
    can_manage_tasks: template.can_manage_tasks,
    can_view_sensitive: template.can_view_sensitive,
  };
}

// ── Verified roles ──────────────────────────────────────────

describe('applyOccupancyTemplate — verified roles', () => {
  test('verified owner → all booleans true', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'owner', 'verified', { dryRun: true });
    expect(bools(template)).toEqual({
      can_manage_home: true,
      can_manage_access: true,
      can_manage_finance: true,
      can_manage_tasks: true,
      can_view_sensitive: true,
    });
    expect(template.role_base).toBe('owner');
    expect(template.verification_status).toBe('verified');
  });

  test('verified admin → can_manage_home true, can_manage_finance false', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'admin', 'verified', { dryRun: true });
    expect(bools(template)).toEqual({
      can_manage_home: true,
      can_manage_access: true,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: true,
    });
    expect(template.role_base).toBe('admin');
  });

  test('verified lease_resident → can_manage_tasks + can_view_sensitive only', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'lease_resident', 'verified', { dryRun: true });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: true,
    });
    expect(template.role_base).toBe('lease_resident');
  });

  test('verified member → same as lease_resident', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'member', 'verified', { dryRun: true });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: true,
    });
    expect(template.role_base).toBe('member');
  });

  test('verified guest → all booleans false', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'guest', 'verified', { dryRun: true });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: false,
      can_view_sensitive: false,
    });
    expect(template.role_base).toBe('guest');
  });
});

// ── Non-verified statuses ───────────────────────────────────

describe('applyOccupancyTemplate — non-verified statuses', () => {
  test('provisional_bootstrap any role → only can_manage_tasks true', async () => {
    for (const role of ['owner', 'admin', 'member', 'lease_resident', 'guest']) {
      const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, role, 'provisional_bootstrap', { dryRun: true });
      expect(bools(template)).toEqual({
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: true,
        can_view_sensitive: false,
      });
      // provisional_bootstrap keeps role_base as passed
      expect(template.role_base).toBe(role);
    }
  });

  test('provisional any role → all booleans false', async () => {
    for (const role of ['owner', 'admin', 'member', 'lease_resident', 'guest']) {
      const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, role, 'provisional', { dryRun: true });
      expect(bools(template)).toEqual({
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: false,
        can_view_sensitive: false,
      });
      // non-verified (except provisional_bootstrap) downgrades to restricted_member
      expect(template.role_base).toBe('restricted_member');
    }
  });

  test('pending_postcard any role → all booleans false', async () => {
    for (const role of ['owner', 'member', 'lease_resident']) {
      const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, role, 'pending_postcard', { dryRun: true });
      expect(bools(template)).toEqual({
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: false,
        can_view_sensitive: false,
      });
      expect(template.role_base).toBe('restricted_member');
    }
  });

  test('pending_approval any role → all booleans false', async () => {
    for (const role of ['owner', 'member', 'guest']) {
      const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, role, 'pending_approval', { dryRun: true });
      expect(bools(template)).toEqual({
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: false,
        can_view_sensitive: false,
      });
      expect(template.role_base).toBe('restricted_member');
    }
  });
});

// ── Age band overrides ──────────────────────────────────────

describe('applyOccupancyTemplate — age band overrides', () => {
  test('child age_band with owner role → all booleans false', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'owner', 'verified', { dryRun: true, ageBand: 'child' });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: false,
      can_view_sensitive: false,
    });
  });

  test('teen age_band with member role → can_manage_tasks true, others false', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'member', 'verified', { dryRun: true, ageBand: 'teen' });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: false,
    });
  });

  test('teen age_band with owner role → only can_manage_tasks true (from owner template)', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'owner', 'verified', { dryRun: true, ageBand: 'teen' });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: true,
      can_view_sensitive: false,
    });
  });

  test('teen age_band with guest role → all false (guest has no can_manage_tasks)', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'guest', 'verified', { dryRun: true, ageBand: 'teen' });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: false,
      can_view_sensitive: false,
    });
  });

  test('child age_band with provisional_bootstrap → all false (child overrides can_manage_tasks)', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'member', 'provisional_bootstrap', { dryRun: true, ageBand: 'child' });
    expect(bools(template)).toEqual({
      can_manage_home: false,
      can_manage_access: false,
      can_manage_finance: false,
      can_manage_tasks: false,
      can_view_sensitive: false,
    });
  });
});

// ── Unknown role fallback ───────────────────────────────────

describe('applyOccupancyTemplate — unknown role', () => {
  test('unknown role defaults to member template', async () => {
    const { template: unknownResult } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'banana', 'verified', { dryRun: true });
    const { template: memberResult } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'member', 'verified', { dryRun: true });
    expect(bools(unknownResult)).toEqual(bools(memberResult));
  });
});

// ── dryRun semantics ────────────────────────────────────────

describe('applyOccupancyTemplate — dryRun', () => {
  test('dryRun returns null occupancy', async () => {
    const { occupancy } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'owner', 'verified', { dryRun: true });
    expect(occupancy).toBeNull();
  });

  test('dryRun template includes is_active and verification_status', async () => {
    const { template } = await applyOccupancyTemplate(FAKE_HOME, FAKE_USER, 'member', 'provisional', { dryRun: true });
    expect(template.is_active).toBe(true);
    expect(template.verification_status).toBe('provisional');
  });
});

// ── mapLegacyRole ───────────────────────────────────────────

describe('mapLegacyRole', () => {
  test('tenant → lease_resident (not member)', () => {
    expect(mapLegacyRole('tenant')).toBe('lease_resident');
  });

  test('renter → lease_resident (not member)', () => {
    expect(mapLegacyRole('renter')).toBe('lease_resident');
  });

  test('property_manager → manager', () => {
    expect(mapLegacyRole('property_manager')).toBe('manager');
  });

  test('roommate → member', () => {
    expect(mapLegacyRole('roommate')).toBe('member');
  });

  test('family → member', () => {
    expect(mapLegacyRole('family')).toBe('member');
  });

  test('caregiver → restricted_member', () => {
    expect(mapLegacyRole('caregiver')).toBe('restricted_member');
  });

  test('identity roles pass through unchanged', () => {
    expect(mapLegacyRole('owner')).toBe('owner');
    expect(mapLegacyRole('admin')).toBe('admin');
    expect(mapLegacyRole('manager')).toBe('manager');
    expect(mapLegacyRole('member')).toBe('member');
    expect(mapLegacyRole('guest')).toBe('guest');
    expect(mapLegacyRole('lease_resident')).toBe('lease_resident');
    expect(mapLegacyRole('service_provider')).toBe('service_provider');
    expect(mapLegacyRole('restricted_member')).toBe('restricted_member');
  });

  test('unknown role defaults to member', () => {
    expect(mapLegacyRole('banana')).toBe('member');
    expect(mapLegacyRole('')).toBe('member');
    expect(mapLegacyRole(undefined)).toBe('member');
  });
});

// ── assertCanMutateTarget ───────────────────────────────────

describe('assertCanMutateTarget', () => {
  test('admin cannot mutate another admin (denied)', () => {
    const result = assertCanMutateTarget('admin', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('admin cannot mutate owner (denied)', () => {
    const result = assertCanMutateTarget('admin', 'owner');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/owner/i);
  });

  test('owner can mutate admin (allowed)', () => {
    const result = assertCanMutateTarget('owner', 'admin');
    expect(result.allowed).toBe(true);
  });

  test('owner can mutate another owner (allowed)', () => {
    const result = assertCanMutateTarget('owner', 'owner');
    expect(result.allowed).toBe(true);
  });

  test('manager cannot mutate admin (denied)', () => {
    const result = assertCanMutateTarget('manager', 'admin');
    expect(result.allowed).toBe(false);
  });

  test('manager cannot mutate another manager (denied — equal rank)', () => {
    const result = assertCanMutateTarget('manager', 'manager');
    expect(result.allowed).toBe(false);
  });

  test('admin can mutate manager (allowed — lower rank)', () => {
    const result = assertCanMutateTarget('admin', 'manager');
    expect(result.allowed).toBe(true);
  });

  test('admin can mutate member (allowed)', () => {
    const result = assertCanMutateTarget('admin', 'member');
    expect(result.allowed).toBe(true);
  });

  test('member cannot mutate guest (denied — member rank 30, guest rank 10, but member != owner and guest rank < member rank — actually allowed)', () => {
    // member(30) > guest(10), and guest is not owner, so this should be allowed
    const result = assertCanMutateTarget('member', 'guest');
    expect(result.allowed).toBe(true);
  });

  test('guest cannot mutate member (denied)', () => {
    const result = assertCanMutateTarget('guest', 'member');
    expect(result.allowed).toBe(false);
  });

  test('unknown role cannot mutate any known role', () => {
    const result = assertCanMutateTarget('banana', 'guest');
    // unknown role has rank 0, guest has rank 10, so 10 >= 0 => denied
    expect(result.allowed).toBe(false);
  });
});

// ── assertCanGrantPermission ────────────────────────────────

describe('assertCanGrantPermission', () => {
  beforeEach(() => {
    resetTables();
    // Seed HomeRolePermission with realistic data
    seedTable('HomeRolePermission', [
      { role_base: 'admin', permission: 'home.edit', allowed: true },
      { role_base: 'admin', permission: 'tasks.manage', allowed: true },
      { role_base: 'admin', permission: 'members.manage', allowed: true },
      { role_base: 'manager', permission: 'home.edit', allowed: true },
      { role_base: 'manager', permission: 'tasks.manage', allowed: true },
      { role_base: 'member', permission: 'tasks.edit', allowed: true },
    ]);
  });

  test('admin cannot grant ownership.transfer permission (denied)', async () => {
    const result = await assertCanGrantPermission('admin', 'ownership.transfer');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/ownership\.transfer/);
  });

  test('owner can grant any permission (allowed)', async () => {
    const result = await assertCanGrantPermission('owner', 'ownership.transfer');
    expect(result.allowed).toBe(true);
  });

  test('owner can grant ownership.manage (allowed)', async () => {
    const result = await assertCanGrantPermission('owner', 'ownership.manage');
    expect(result.allowed).toBe(true);
  });

  test('admin can grant home.edit (in their role set)', async () => {
    const result = await assertCanGrantPermission('admin', 'home.edit');
    expect(result.allowed).toBe(true);
  });

  test('admin cannot grant finance.manage (not in their role set)', async () => {
    const result = await assertCanGrantPermission('admin', 'finance.manage');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/finance\.manage/);
  });

  test('manager cannot grant members.manage (not in their role set)', async () => {
    const result = await assertCanGrantPermission('manager', 'members.manage');
    expect(result.allowed).toBe(false);
  });

  test('manager can grant tasks.manage (in their role set)', async () => {
    const result = await assertCanGrantPermission('manager', 'tasks.manage');
    expect(result.allowed).toBe(true);
  });

  test('member cannot grant home.edit (not in their role set)', async () => {
    const result = await assertCanGrantPermission('member', 'home.edit');
    expect(result.allowed).toBe(false);
  });
});

// ============================================================
// TEST: businessPermissions rank enforcement helpers
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
  assertCanMutateTarget,
  assertCanGrantPermission,
  getRoleRank,
  BUSINESS_ROLE_RANK,
} = require('../../utils/businessPermissions');

const { seedTable, resetTables } = require('../__mocks__/supabaseAdmin');

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

  test('editor cannot mutate admin (denied)', () => {
    const result = assertCanMutateTarget('editor', 'admin');
    expect(result.allowed).toBe(false);
  });

  test('editor cannot mutate another editor (denied — equal rank)', () => {
    const result = assertCanMutateTarget('editor', 'editor');
    expect(result.allowed).toBe(false);
  });

  test('admin can mutate editor (allowed — lower rank)', () => {
    const result = assertCanMutateTarget('admin', 'editor');
    expect(result.allowed).toBe(true);
  });

  test('admin can mutate staff (allowed)', () => {
    const result = assertCanMutateTarget('admin', 'staff');
    expect(result.allowed).toBe(true);
  });

  test('staff cannot mutate editor (denied)', () => {
    const result = assertCanMutateTarget('staff', 'editor');
    expect(result.allowed).toBe(false);
  });

  test('staff can mutate viewer (allowed)', () => {
    const result = assertCanMutateTarget('staff', 'viewer');
    expect(result.allowed).toBe(true);
  });

  test('viewer cannot mutate staff (denied)', () => {
    const result = assertCanMutateTarget('viewer', 'staff');
    expect(result.allowed).toBe(false);
  });

  test('viewer cannot mutate another viewer (denied — equal rank)', () => {
    const result = assertCanMutateTarget('viewer', 'viewer');
    expect(result.allowed).toBe(false);
  });

  test('unknown role cannot mutate any known role', () => {
    const result = assertCanMutateTarget('banana', 'viewer');
    // unknown role has rank 0, viewer has rank 10, so 10 >= 0 => denied
    expect(result.allowed).toBe(false);
  });
});

// ── assertCanGrantPermission ────────────────────────────────

describe('assertCanGrantPermission', () => {
  beforeEach(() => {
    resetTables();
    // Seed BusinessRolePermission with realistic data
    seedTable('BusinessRolePermission', [
      { role_base: 'admin', permission: 'profile.edit', allowed: true },
      { role_base: 'admin', permission: 'team.manage', allowed: true },
      { role_base: 'admin', permission: 'catalog.manage', allowed: true },
      { role_base: 'editor', permission: 'profile.edit', allowed: true },
      { role_base: 'editor', permission: 'catalog.edit', allowed: true },
      { role_base: 'staff', permission: 'catalog.view', allowed: true },
    ]);
  });

  test('admin cannot grant finance.manage (not in their role set)', async () => {
    const result = await assertCanGrantPermission('admin', 'finance.manage');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/finance\.manage/);
  });

  test('owner can grant any permission (allowed)', async () => {
    const result = await assertCanGrantPermission('owner', 'finance.manage');
    expect(result.allowed).toBe(true);
  });

  test('owner can grant sensitive.view (allowed)', async () => {
    const result = await assertCanGrantPermission('owner', 'sensitive.view');
    expect(result.allowed).toBe(true);
  });

  test('admin can grant team.manage (in their role set)', async () => {
    const result = await assertCanGrantPermission('admin', 'team.manage');
    expect(result.allowed).toBe(true);
  });

  test('editor cannot grant team.manage (not in their role set)', async () => {
    const result = await assertCanGrantPermission('editor', 'team.manage');
    expect(result.allowed).toBe(false);
  });

  test('editor can grant catalog.edit (in their role set)', async () => {
    const result = await assertCanGrantPermission('editor', 'catalog.edit');
    expect(result.allowed).toBe(true);
  });

  test('staff cannot grant catalog.edit (not in their role set)', async () => {
    const result = await assertCanGrantPermission('staff', 'catalog.edit');
    expect(result.allowed).toBe(false);
  });

  test('staff can grant catalog.view (in their role set)', async () => {
    const result = await assertCanGrantPermission('staff', 'catalog.view');
    expect(result.allowed).toBe(true);
  });
});

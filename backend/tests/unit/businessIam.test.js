// ============================================================
// TEST: Business IAM Routes – Rank Enforcement (AUTH-1.5)
//
// Verifies that mutation routes enforce actor-vs-target rank
// checks via assertCanMutateTarget and assertCanGrantPermission.
// ============================================================

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

// ── Mock businessPermissions ────────────────────────────────
const mockCheckBusinessPermission = jest.fn();
const mockAssertCanMutateTarget = jest.fn();
const mockAssertCanGrantPermission = jest.fn();

jest.mock('../../utils/businessPermissions', () => ({
  checkBusinessPermission: (...args) => mockCheckBusinessPermission(...args),
  getUserAccess: jest.fn().mockResolvedValue({ hasAccess: true, isOwner: false, role_base: 'staff', permissions: {}, membership: { id: 'tm-1' } }),
  hasPermission: jest.fn().mockResolvedValue(true),
  getRoleRank: jest.fn((r) => ({ viewer: 10, staff: 20, editor: 30, admin: 40, owner: 50 }[r] || 0)),
  writeAuditLog: jest.fn(),
  assertCanMutateTarget: (...args) => mockAssertCanMutateTarget(...args),
  assertCanGrantPermission: (...args) => mockAssertCanGrantPermission(...args),
  BUSINESS_ROLE_RANK: { viewer: 10, staff: 20, editor: 30, admin: 40, owner: 50 },
}));

// ── Mock verifyToken ────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'actor-id', email: 'actor@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

// ── Mock logger ─────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// ── Import router + extract handlers ────────────────────────
const router = require('../../routes/businessIam');

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      const stack = layer.route.stack;
      return stack[stack.length - 1].handle;
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

const changeRoleHandler = findHandler('POST', '/:businessId/members/:userId/role');
const togglePermHandler = findHandler('POST', '/:businessId/members/:userId/permissions');
const removeMemberHandler = findHandler('DELETE', '/:businessId/members/:userId');

// ── Helpers ─────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    params: { businessId: 'biz-1', userId: 'target-id' },
    body: {},
    user: { id: 'actor-id', email: 'actor@example.com' },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();

  mockCheckBusinessPermission.mockResolvedValue({ hasAccess: true, isOwner: false });
  mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
  mockAssertCanGrantPermission.mockResolvedValue({ allowed: true });

  seedTable('BusinessTeam', [
    { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
    { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'staff', is_active: true },
  ]);
});

// ============================================================
// POST /:businessId/members/:userId/role
// ============================================================

describe('POST /:businessId/members/:userId/role – rank enforcement', () => {
  test('admin cannot change another admin\'s role (403)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Cannot modify a member with a role equal to or higher than your own' });

    const req = mockReq({ body: { role_base: 'staff' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockAssertCanMutateTarget).toHaveBeenCalledWith('admin', 'admin');
  });

  test('admin cannot change owner\'s role (403)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'owner', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Only an owner can modify another owner' });

    const req = mockReq({ body: { role_base: 'staff' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('owner can change admin\'s role (200)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'owner', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockCheckBusinessPermission.mockResolvedValue({ hasAccess: true, isOwner: true });
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });

    const req = mockReq({ body: { role_base: 'staff' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.message).toMatch(/role updated/i);
  });
});

// ============================================================
// DELETE /:businessId/members/:userId
// ============================================================

describe('DELETE /:businessId/members/:userId – rank enforcement', () => {
  test('admin cannot remove owner (403)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'owner', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Only an owner can modify another owner' });

    const req = mockReq();
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('editor cannot remove admin (403)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'editor', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Cannot modify a member with a role equal to or higher than your own' });

    const req = mockReq();
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('self-removal is always allowed regardless of rank', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'staff', is_active: true },
    ]);

    const { getUserAccess } = require('../../utils/businessPermissions');
    getUserAccess.mockResolvedValueOnce({ hasAccess: true, isOwner: false, role_base: 'staff' });

    const req = mockReq({ params: { businessId: 'biz-1', userId: 'actor-id' } });
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockAssertCanMutateTarget).not.toHaveBeenCalled();
  });
});

// ============================================================
// POST /:businessId/members/:userId/permissions
// ============================================================

describe('POST /:businessId/members/:userId/permissions – rank enforcement', () => {
  test('admin cannot grant ownership.transfer permission (403)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'staff', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
    mockAssertCanGrantPermission.mockResolvedValue({ allowed: false, reason: "Cannot grant permission 'ownership.transfer' that exceeds your own role's permission set" });

    const req = mockReq({ body: { permission: 'ownership.transfer', allowed: true } });
    const res = mockRes();
    await togglePermHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockAssertCanGrantPermission).toHaveBeenCalledWith('admin', 'ownership.transfer');
  });

  test('admin CAN grant team.view to a staff member (200)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'staff', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
    mockAssertCanGrantPermission.mockResolvedValue({ allowed: true });

    const req = mockReq({ body: { permission: 'team.view', allowed: true } });
    const res = mockRes();
    await togglePermHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.message).toMatch(/permission updated/i);
  });

  test('owner CAN grant ownership.transfer to anyone (200)', async () => {
    seedTable('BusinessTeam', [
      { id: 'tm-actor', business_user_id: 'biz-1', user_id: 'actor-id', role_base: 'owner', is_active: true },
      { id: 'tm-target', business_user_id: 'biz-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
    mockAssertCanGrantPermission.mockResolvedValue({ allowed: true });

    const req = mockReq({ body: { permission: 'ownership.transfer', allowed: true } });
    const res = mockRes();
    await togglePermHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.permission).toBe('ownership.transfer');
  });
});

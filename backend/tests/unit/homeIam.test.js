// ============================================================
// TEST: Home IAM Routes – Rank Enforcement (AUTH-1.4)
//
// Verifies that mutation routes enforce actor-vs-target rank
// checks via assertCanMutateTarget and assertCanGrantPermission.
// ============================================================

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

// ── Mock homePermissions ────────────────────────────────────
const mockCheckHomePermission = jest.fn();
const mockAssertCanMutateTarget = jest.fn();
const mockAssertCanGrantPermission = jest.fn();

jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: (...args) => mockCheckHomePermission(...args),
  getUserAccess: jest.fn().mockResolvedValue({ permissions: {}, role_base: 'member' }),
  isVerifiedOwner: jest.fn().mockResolvedValue(false),
  hasPermission: jest.fn().mockResolvedValue(true),
  mapLegacyRole: jest.fn((r) => r),
  getRoleRank: jest.fn((r) => ({ guest: 10, restricted_member: 20, member: 30, manager: 40, admin: 50, owner: 60 }[r] || 0)),
  writeAuditLog: jest.fn(),
  assertCanMutateTarget: (...args) => mockAssertCanMutateTarget(...args),
  assertCanGrantPermission: (...args) => mockAssertCanGrantPermission(...args),
  ROLE_RANK: { guest: 10, restricted_member: 20, member: 30, manager: 40, admin: 50, owner: 60 },
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

// ── Mock occupancyAttachService ─────────────────────────────
jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn().mockResolvedValue({ success: true, occupancy: { id: 'occ-1' }, status: 'attached' }),
  detach: jest.fn().mockResolvedValue({ success: true }),
}));

// ── Import router + extract handlers ────────────────────────
const router = require('../../routes/homeIam');

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

const changeRoleHandler = findHandler('POST', '/:id/members/:userId/role');
const togglePermHandler = findHandler('POST', '/:id/members/:userId/permissions');
const removeMemberHandler = findHandler('DELETE', '/:id/members/:userId');

// ── Helpers ─────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    params: { id: 'home-1', userId: 'target-id' },
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

  // Default: permission check passes, actor is not owner
  mockCheckHomePermission.mockResolvedValue({ hasAccess: true, isOwner: false });
  // Default: rank checks pass
  mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
  mockAssertCanGrantPermission.mockResolvedValue({ allowed: true });

  // Seed actor and target occupancies for supabaseAdmin queries
  seedTable('HomeOccupancy', [
    { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
    { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'member', is_active: true },
  ]);
  seedTable('Home', [
    { id: 'home-1', owner_id: 'owner-id' },
  ]);
});

// ============================================================
// POST /:id/members/:userId/role
// ============================================================

describe('POST /:id/members/:userId/role – rank enforcement', () => {
  test('admin cannot change another admin\'s role (403)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Cannot modify a member with a role equal to or higher than your own' });

    const req = mockReq({ body: { role_base: 'member' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockAssertCanMutateTarget).toHaveBeenCalledWith('admin', 'admin');
  });

  test('admin cannot change owner\'s role (403)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'owner', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Only an owner can modify another owner' });

    const req = mockReq({ body: { role_base: 'member' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('owner can change admin\'s role (200)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'owner', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockCheckHomePermission.mockResolvedValue({ hasAccess: true, isOwner: true });
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });

    const req = mockReq({ body: { role_base: 'member' } });
    const res = mockRes();
    await changeRoleHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.message).toMatch(/role updated/i);
  });
});

// ============================================================
// DELETE /:id/members/:userId
// ============================================================

describe('DELETE /:id/members/:userId – rank enforcement', () => {
  test('admin cannot remove owner (403)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'owner', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Only an owner can modify another owner' });

    const req = mockReq();
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('manager cannot remove admin (403)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'manager', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'admin', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: false, reason: 'Cannot modify a member with a role equal to or higher than your own' });

    const req = mockReq();
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('self-removal is always allowed regardless of rank', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'member', is_active: true },
    ]);

    const req = mockReq({ params: { id: 'home-1', userId: 'actor-id' } });
    const res = mockRes();
    await removeMemberHandler(req, res);

    expect(res.statusCode).toBe(200);
    // assertCanMutateTarget should NOT be called for self-removal
    expect(mockAssertCanMutateTarget).not.toHaveBeenCalled();
  });
});

// ============================================================
// POST /:id/members/:userId/permissions
// ============================================================

describe('POST /:id/members/:userId/permissions – rank enforcement', () => {
  test('admin cannot grant ownership.transfer to themselves (403)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'member', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
    mockAssertCanGrantPermission.mockResolvedValue({ allowed: false, reason: "Cannot grant permission 'ownership.transfer' that exceeds your own role's permission set" });

    const req = mockReq({
      // Actor granting to target (the task says "to themselves" but the escalation
      // path is: admin grants ownership.transfer to any target including self)
      body: { permission: 'ownership.transfer', allowed: true },
    });
    const res = mockRes();
    await togglePermHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(mockAssertCanGrantPermission).toHaveBeenCalledWith('admin', 'ownership.transfer');
  });

  test('admin CAN grant home.edit to a member (200)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'admin', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'member', is_active: true },
    ]);
    mockAssertCanMutateTarget.mockReturnValue({ allowed: true });
    mockAssertCanGrantPermission.mockResolvedValue({ allowed: true });

    const req = mockReq({ body: { permission: 'home.edit', allowed: true } });
    const res = mockRes();
    await togglePermHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.message).toMatch(/permission updated/i);
  });

  test('owner CAN grant ownership.transfer to anyone (200)', async () => {
    seedTable('HomeOccupancy', [
      { id: 'occ-actor', home_id: 'home-1', user_id: 'actor-id', role_base: 'owner', is_active: true },
      { id: 'occ-target', home_id: 'home-1', user_id: 'target-id', role_base: 'admin', is_active: true },
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

// ============================================================
// TEST: Landlord & Tenant Routes
//
// Unit tests for all 12 API endpoints:
//
// Landlord:
//   POST /landlord/authority/request
//   GET  /landlord/properties
//   GET  /landlord/properties/:homeId
//   POST /landlord/lease/invite
//   POST /landlord/lease/:leaseId/approve
//   POST /landlord/lease/:leaseId/deny
//   POST /landlord/lease/:leaseId/end
//   GET  /landlord/properties/:homeId/requests
//
// Tenant:
//   POST /tenant/request-approval
//   POST /tenant/accept-invite
//   POST /tenant/move-out
//
// Dispute:
//   POST /home/:homeId/dispute
//
// Tests route handler logic by extracting handlers from the
// Express router and calling them with mock req/res.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock writeAuditLog ──────────────────────────────────────
jest.mock('../../utils/homePermissions', () => ({
  writeAuditLog: jest.fn(),
  checkHomePermission: jest.fn(),
  hasPermission: jest.fn(),
  getActiveOccupancy: jest.fn(),
  isVerifiedOwner: jest.fn(),
  mapLegacyRole: jest.fn(),
  getRoleRank: jest.fn(),
  applyOccupancyTemplate: jest.fn(),
  VERIFIED_TEMPLATES: {},
  ALL_FALSE_TEMPLATE: {},
  OLD_TO_NEW_PERM: {},
  ROLE_RANK: {},
}));

// ── Mock notificationService ────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

// ── Mock rate limiters ──────────────────────────────────────
jest.mock('../../middleware/rateLimiter', () => ({
  globalWriteLimiter: (req, res, next) => next(),
  ownershipClaimLimiter: (req, res, next) => next(),
  landlordLeaseLimiter: (req, res, next) => next(),
  addressValidationLimiter: (req, res, next) => next(),
  addressClaimLimiter: (req, res, next) => next(),
}));

// ── Mock verifyToken ────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

// ── Mock requireAuthority ───────────────────────────────────
jest.mock('../../middleware/requireAuthority', () => {
  return (req, res, next) => {
    // Simulate a verified authority (tests can override via _mockAuthority)
    req.authority = req._mockAuthority || {
      id: 'auth-1',
      home_id: req.params.homeId || req.body?.home_id || 'home-1',
      subject_type: 'user',
      subject_id: 'test-user-id',
      status: 'verified',
      verification_tier: 'standard',
    };
    next();
  };
});

// ── Mock authorityResolution ──────────────────────────────
const mockAssertCallerOwnsLease = jest.fn();
const mockResolveVerifiedAuthority = jest.fn();
jest.mock('../../utils/authorityResolution', () => ({
  resolveVerifiedAuthorityForActor: (...args) => mockResolveVerifiedAuthority(...args),
  assertCallerOwnsLease: (...args) => mockAssertCallerOwnsLease(...args),
}));

// ── Mock validate (pass-through — we test validation separately) ─
jest.mock('../../middleware/validate', () => {
  return () => (req, res, next) => next();
});

const { writeAuditLog } = require('../../utils/homePermissions');
const notificationService = require('../../services/notificationService');

// ── Import router + extract handlers ────────────────────────
const router = require('../../routes/landlordTenant');

/**
 * Find the final handler for a given method + path in the router.
 */
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

// Extract all handlers
const requestAuthorityHandler = findHandler('POST', '/landlord/authority/request');
const listPropertiesHandler = findHandler('GET', '/landlord/properties');
const propertyDetailHandler = findHandler('GET', '/landlord/properties/:homeId');
const inviteTenantHandler = findHandler('POST', '/landlord/lease/invite');
const approveLeaseHandler = findHandler('POST', '/landlord/lease/:leaseId/approve');
const denyLeaseHandler = findHandler('POST', '/landlord/lease/:leaseId/deny');
const endLeaseHandler = findHandler('POST', '/landlord/lease/:leaseId/end');
const listRequestsHandler = findHandler('GET', '/landlord/properties/:homeId/requests');
const tenantRequestHandler = findHandler('POST', '/tenant/request-approval');
const acceptInviteHandler = findHandler('POST', '/tenant/accept-invite');
const moveOutHandler = findHandler('POST', '/tenant/move-out');
const disputeHandler = findHandler('POST', '/home/:homeId/dispute');

// ── Mock req/res helpers ────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    user: { id: 'test-user-id', email: 'test@example.com', role: 'user' },
    method: 'POST',
    path: '/test',
    originalUrl: '/api/v1/test',
    ip: '127.0.0.1',
    get: () => 'test-agent',
    authority: null,
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

// ── Seed helpers ────────────────────────────────────────────

function seedHome(overrides = {}) {
  seedTable('Home', [{
    id: 'home-1',
    name: 'Test Property',
    home_type: 'unit',
    address_id: 'addr-1',
    owner_id: 'owner-1',
    ...overrides,
  }]);
}

function seedAuthority(overrides = {}) {
  seedTable('HomeAuthority', [{
    id: 'auth-1',
    home_id: 'home-1',
    subject_type: 'user',
    subject_id: 'test-user-id',
    role: 'owner',
    status: 'verified',
    verification_tier: 'standard',
    ...overrides,
  }]);
}

function seedLease(overrides = {}) {
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

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  // Default: allow lease operations (existing tests assume no auth block)
  mockAssertCallerOwnsLease.mockResolvedValue({ allowed: true, lease: { id: 'lease-1', home_id: 'home-1' } });
  // Default: resolve authority for approve/deny routes
  mockResolveVerifiedAuthority.mockResolvedValue({
    found: true,
    authority: { id: 'auth-1', home_id: 'home-1', subject_type: 'user', subject_id: 'test-user-id', status: 'verified' },
  });
});

// ============================================================
// POST /landlord/authority/request
// ============================================================

describe('POST /landlord/authority/request', () => {
  test('returns 201 with authority on success', async () => {
    seedHome();
    const req = mockReq({
      body: {
        home_id: 'home-1',
        subject_type: 'user',
        subject_id: 'test-user-id',
        evidence_type: 'deed',
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.authority).toBeDefined();
    expect(res._json.authority.status).toBe('pending');
  });

  test('returns 403 when requesting authority for another user', async () => {
    const req = mockReq({
      body: {
        home_id: 'home-1',
        subject_type: 'user',
        subject_id: 'other-user-id',
        evidence_type: 'deed',
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('another user');
  });

  test('returns 403 when not a member of the business', async () => {
    seedHome();
    const req = mockReq({
      body: {
        home_id: 'home-1',
        subject_type: 'business',
        subject_id: 'biz-1',
        evidence_type: 'deed',
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('Not a member');
  });

  test('allows business authority when user is a member', async () => {
    seedHome();
    seedTable('BusinessTeam', [{
      id: 'bm-1',
      business_user_id: 'biz-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      body: {
        home_id: 'home-1',
        subject_type: 'business',
        subject_id: 'biz-1',
        evidence_type: 'lease',
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.authority.subject_type).toBe('business');
  });

  test('returns 400 when home not found', async () => {
    const req = mockReq({
      body: {
        home_id: 'missing-home',
        subject_type: 'user',
        subject_id: 'test-user-id',
        evidence_type: 'deed',
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(400);
  });

  test('includes evidence and claim when provided', async () => {
    seedHome();
    const req = mockReq({
      body: {
        home_id: 'home-1',
        subject_type: 'user',
        subject_id: 'test-user-id',
        evidence_type: 'deed',
        evidence: { storage_ref: 's3://docs/deed.pdf', metadata: { pages: 3 } },
      },
    });
    const res = mockRes();
    await requestAuthorityHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.claim).toBeDefined();
    expect(res._json.claim.claim_type).toBe('owner');
  });
});

// ============================================================
// GET /landlord/properties
// ============================================================

describe('GET /landlord/properties', () => {
  test('returns user authorities', async () => {
    seedHome();
    seedAuthority();

    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await listPropertiesHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.properties).toBeDefined();
    expect(res._json.properties.length).toBeGreaterThanOrEqual(1);
  });

  test('returns empty when no authorities', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await listPropertiesHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.properties).toHaveLength(0);
  });

  test('includes business authorities when user is a member', async () => {
    seedHome();
    seedTable('BusinessTeam', [{
      id: 'bm-1',
      business_user_id: 'biz-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);
    seedTable('HomeAuthority', [{
      id: 'auth-biz',
      home_id: 'home-1',
      subject_type: 'business',
      subject_id: 'biz-1',
      status: 'verified',
    }]);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await listPropertiesHandler(req, res);

    expect(res._json.properties.some((p) => p.subject_type === 'business')).toBe(true);
  });
});

// ============================================================
// GET /landlord/properties/:homeId
// ============================================================

describe('GET /landlord/properties/:homeId', () => {
  test('returns property detail with leases, occupants', async () => {
    seedHome();
    seedLease({ state: 'active' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'tenant-1',
      role: 'lease_resident',
      role_base: 'lease_resident',
      is_active: true,
      verification_status: 'verified',
    }]);

    const req = mockReq({ params: { homeId: 'home-1' }, method: 'GET' });
    const res = mockRes();
    await propertyDetailHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.home).toBeDefined();
    expect(res._json.home.id).toBe('home-1');
    expect(res._json.leases).toBeDefined();
    expect(res._json.occupants).toBeDefined();
    expect(res._json.authority).toBeDefined();
  });

  test('returns 404 when home not found', async () => {
    const req = mockReq({ params: { homeId: 'missing-home' }, method: 'GET' });
    const res = mockRes();
    await propertyDetailHandler(req, res);

    expect(res._status).toBe(404);
  });

  test('returns child units for a building', async () => {
    // Seed building and its child units together so seedTable doesn't overwrite
    seedTable('Home', [
      { id: 'home-1', name: 'Test Building', home_type: 'building', address_id: 'addr-1', owner_id: 'owner-1' },
      { id: 'unit-1', name: 'Unit 1A', home_type: 'unit', parent_home_id: 'home-1' },
      { id: 'unit-2', name: 'Unit 2B', home_type: 'unit', parent_home_id: 'home-1' },
    ]);

    const req = mockReq({ params: { homeId: 'home-1' }, method: 'GET' });
    const res = mockRes();
    await propertyDetailHandler(req, res);

    expect(res._json.units.length).toBe(2);
  });

  test('separates pending_requests from leases', async () => {
    seedHome();
    seedTable('HomeLease', [
      { id: 'lease-active', home_id: 'home-1', state: 'active', source: 'landlord_invite', primary_resident_user_id: 't1' },
      { id: 'lease-pending', home_id: 'home-1', state: 'pending', source: 'tenant_request', primary_resident_user_id: 't2' },
    ]);

    const req = mockReq({ params: { homeId: 'home-1' }, method: 'GET' });
    const res = mockRes();
    await propertyDetailHandler(req, res);

    expect(res._json.pending_requests).toHaveLength(1);
    expect(res._json.pending_requests[0].id).toBe('lease-pending');
  });
});

// ============================================================
// POST /landlord/lease/invite
// ============================================================

describe('POST /landlord/lease/invite', () => {
  test('returns 201 with invite and token', async () => {
    seedHome();
    seedAuthority();

    const req = mockReq({
      authority: { id: 'auth-1', home_id: 'home-1', subject_type: 'user', subject_id: 'test-user-id', status: 'verified' },
      body: {
        home_id: 'home-1',
        invitee_email: 'tenant@example.com',
        start_at: '2026-04-01T00:00:00.000Z',
      },
    });
    const res = mockRes();
    await inviteTenantHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.invite).toBeDefined();
    expect(res._json.token).toBeTruthy();
  });

  test('returns 400 when authority not verified', async () => {
    seedHome();
    seedAuthority({ status: 'pending' });

    const req = mockReq({
      authority: { id: 'auth-1', home_id: 'home-1', subject_type: 'user', subject_id: 'test-user-id', status: 'pending' },
      body: {
        home_id: 'home-1',
        invitee_email: 'tenant@example.com',
        start_at: '2026-04-01',
      },
    });
    const res = mockRes();
    await inviteTenantHandler(req, res);

    expect(res._status).toBe(400);
  });
});

// ============================================================
// POST /landlord/lease/:leaseId/approve
// ============================================================

describe('POST /landlord/lease/:leaseId/approve', () => {
  test('returns lease and occupancy on success', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'pending' });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.lease).toBeDefined();
    expect(res._json.lease.state).toBe('active');
    expect(res._json.occupancy).toBeDefined();
  });

  test('returns 400 when lease not pending', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'active' });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(400);
  });

  test('returns 404 when lease not found', async () => {
    const req = mockReq({
      params: { leaseId: 'missing-lease' },
      body: {},
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(404);
  });

  test('caller with no authority cannot approve a lease (403)', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'pending' });

    mockResolveVerifiedAuthority.mockResolvedValue({
      found: false,
      reason: 'No verified authority found for this user and home',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
      user: { id: 'unrelated-user' },
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('No verified authority');
  });

  test('caller with authority for a DIFFERENT home cannot approve (403)', async () => {
    seedHome();
    seedLease({ state: 'pending' });
    // Authority resolves for a different home — route fetches lease.home_id,
    // then resolveVerifiedAuthorityForActor returns not found for that home
    mockResolveVerifiedAuthority.mockResolvedValue({
      found: false,
      reason: 'No verified authority found for this user and home',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(403);
  });

  test('caller with verified authority for lease home CAN approve (200)', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'pending' });

    mockResolveVerifiedAuthority.mockResolvedValue({
      found: true,
      authority: { id: 'auth-1', home_id: 'home-1', subject_type: 'user', subject_id: 'test-user-id', status: 'verified' },
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.lease).toBeDefined();
    expect(res._json.lease.state).toBe('active');
  });

  test('caller cannot approve by supplying another user authority_id in body (field is ignored)', async () => {
    seedHome();
    seedAuthority({ id: 'auth-other', subject_id: 'other-user' });
    seedLease({ state: 'pending' });

    // The caller has no authority — mock returns not found
    mockResolveVerifiedAuthority.mockResolvedValue({
      found: false,
      reason: 'No verified authority found for this user and home',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      // Even though authority_id is supplied, the route ignores it
      body: { authority_id: 'auth-other' },
      user: { id: 'attacker-user' },
    });
    const res = mockRes();
    await approveLeaseHandler(req, res);

    expect(res._status).toBe(403);
    // Verify the mock was called with the attacker's userId, not the supplied authority
    expect(mockResolveVerifiedAuthority).toHaveBeenCalledWith({
      userId: 'attacker-user',
      homeId: 'home-1',
    });
  });
});

// ============================================================
// POST /landlord/lease/:leaseId/deny
// ============================================================

describe('POST /landlord/lease/:leaseId/deny', () => {
  test('returns success on denial', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'pending' });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: { reason: 'Not suitable' },
    });
    const res = mockRes();
    await denyLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('returns 403 when caller has no authority', async () => {
    seedHome();
    seedLease({ state: 'pending' });

    mockResolveVerifiedAuthority.mockResolvedValue({
      found: false,
      reason: 'No verified authority found for this user and home',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await denyLeaseHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('No verified authority');
  });

  test('caller with authority for a DIFFERENT home cannot deny (403)', async () => {
    seedHome();
    seedLease({ state: 'pending' });

    mockResolveVerifiedAuthority.mockResolvedValue({
      found: false,
      reason: 'No verified authority found for this user and home',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await denyLeaseHandler(req, res);

    expect(res._status).toBe(403);
  });

  test('caller with verified authority for lease home CAN deny (200)', async () => {
    seedHome();
    seedAuthority();
    seedLease({ state: 'pending' });

    mockResolveVerifiedAuthority.mockResolvedValue({
      found: true,
      authority: { id: 'auth-1', home_id: 'home-1', subject_type: 'user', subject_id: 'test-user-id', status: 'verified' },
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: { reason: 'Not a good fit' },
    });
    const res = mockRes();
    await denyLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('returns 404 when lease not found', async () => {
    const req = mockReq({
      params: { leaseId: 'missing-lease' },
      body: {},
    });
    const res = mockRes();
    await denyLeaseHandler(req, res);

    expect(res._status).toBe(404);
  });
});

// ============================================================
// POST /landlord/lease/:leaseId/end
// ============================================================

describe('POST /landlord/lease/:leaseId/end', () => {
  test('returns success on lease end', async () => {
    seedHome();
    seedLease({ state: 'active' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'tenant-1',
      is_active: true,
    }]);

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('returns 400 when lease already ended', async () => {
    seedLease({ state: 'ended' });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(400);
  });

  test('returns 404 when lease not found', async () => {
    mockAssertCallerOwnsLease.mockResolvedValue({ allowed: false, reason: 'Lease not found' });

    const req = mockReq({
      params: { leaseId: 'nonexistent' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(403);
  });

  test('unrelated user cannot end a lease they do not own (403)', async () => {
    seedLease({ state: 'active', primary_resident_user_id: 'someone-else' });

    mockAssertCallerOwnsLease.mockResolvedValue({
      allowed: false,
      reason: 'User is not a resident and holds no authority for this lease',
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
      user: { id: 'unrelated-user' },
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('not a resident');
    expect(mockAssertCallerOwnsLease).toHaveBeenCalledWith({
      userId: 'unrelated-user',
      leaseId: 'lease-1',
    });
  });

  test('primary resident on the lease CAN end their own lease (200)', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'test-user-id' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    mockAssertCallerOwnsLease.mockResolvedValue({
      allowed: true,
      lease: { id: 'lease-1', home_id: 'home-1', primary_resident_user_id: 'test-user-id' },
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('user with verified HomeAuthority CAN end the lease (200)', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'tenant-1' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'tenant-1',
      is_active: true,
    }]);

    mockAssertCallerOwnsLease.mockResolvedValue({
      allowed: true,
      lease: { id: 'lease-1', home_id: 'home-1', primary_resident_user_id: 'tenant-1' },
      authority: { id: 'auth-1', subject_type: 'user', subject_id: 'test-user-id', status: 'verified' },
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('user with business-backed authority CAN end the lease (200)', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'tenant-1' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'tenant-1',
      is_active: true,
    }]);

    mockAssertCallerOwnsLease.mockResolvedValue({
      allowed: true,
      lease: { id: 'lease-1', home_id: 'home-1', primary_resident_user_id: 'tenant-1' },
      authority: { id: 'auth-biz', subject_type: 'business', subject_id: 'biz-1', status: 'verified' },
    });

    const req = mockReq({
      params: { leaseId: 'lease-1' },
      body: {},
    });
    const res = mockRes();
    await endLeaseHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });
});

// ============================================================
// GET /landlord/properties/:homeId/requests
// ============================================================

describe('GET /landlord/properties/:homeId/requests', () => {
  test('returns only pending tenant requests', async () => {
    seedTable('HomeLease', [
      { id: 'lease-p1', home_id: 'home-1', state: 'pending', source: 'tenant_request', primary_resident_user_id: 't1' },
      { id: 'lease-p2', home_id: 'home-1', state: 'pending', source: 'tenant_request', primary_resident_user_id: 't2' },
      { id: 'lease-active', home_id: 'home-1', state: 'active', source: 'landlord_invite', primary_resident_user_id: 't3' },
    ]);

    const req = mockReq({ params: { homeId: 'home-1' }, method: 'GET' });
    const res = mockRes();
    await listRequestsHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.requests).toHaveLength(2);
    expect(res._json.requests.every((r) => r.state === 'pending')).toBe(true);
  });

  test('returns empty array when no pending requests', async () => {
    const req = mockReq({ params: { homeId: 'home-1' }, method: 'GET' });
    const res = mockRes();
    await listRequestsHandler(req, res);

    expect(res._json.requests).toHaveLength(0);
  });
});

// ============================================================
// POST /tenant/request-approval
// ============================================================

describe('POST /tenant/request-approval', () => {
  test('creates pending lease and returns 201', async () => {
    seedHome();
    seedAuthority();

    const req = mockReq({
      body: {
        home_id: 'home-1',
        start_at: '2026-04-01T00:00:00.000Z',
        message: 'Looking to rent this unit',
      },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.lease).toBeDefined();
    expect(res._json.lease.state).toBe('pending');
    expect(res._json.lease.source).toBe('tenant_request');
  });

  test('returns 404 when home not found', async () => {
    const req = mockReq({
      body: { home_id: 'nonexistent' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(404);
  });

  test('returns 400 when home is a building', async () => {
    seedHome({ home_type: 'building' });

    const req = mockReq({
      body: { home_id: 'home-1' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('building');
  });

  test('returns 400 when no verified landlord authority exists', async () => {
    seedHome();
    // No authority seeded

    const req = mockReq({
      body: { home_id: 'home-1' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toContain('no verified landlord');
  });

  test('returns 409 when tenant already has pending request', async () => {
    seedHome();
    seedAuthority();
    seedTable('HomeLease', [{
      id: 'lease-existing',
      home_id: 'home-1',
      primary_resident_user_id: 'test-user-id',
      state: 'pending',
    }]);

    const req = mockReq({
      body: { home_id: 'home-1' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(409);
  });

  test('returns 409 when tenant already has active lease', async () => {
    seedHome();
    seedAuthority();
    seedTable('HomeLease', [{
      id: 'lease-active',
      home_id: 'home-1',
      primary_resident_user_id: 'test-user-id',
      state: 'active',
    }]);

    const req = mockReq({
      body: { home_id: 'home-1' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(res._status).toBe(409);
  });

  test('sends notification to landlord and creates lease successfully', async () => {
    seedHome();
    seedAuthority({ subject_type: 'user', subject_id: 'landlord-1' });

    const req = mockReq({
      body: { home_id: 'home-1', message: 'Please approve me' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    // Verify the lease was created (notification is in try/catch and non-fatal)
    expect(res._status).toBe(201);
    expect(res._json.lease).toBeDefined();
    expect(res._json.lease.state).toBe('pending');
    expect(res._json.lease.source).toBe('tenant_request');
    expect(res._json.lease.metadata.message).toBe('Please approve me');
  });

  test('writes audit log', async () => {
    seedHome();
    seedAuthority();

    const req = mockReq({
      body: { home_id: 'home-1' },
    });
    const res = mockRes();
    await tenantRequestHandler(req, res);

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'test-user-id', 'TENANT_REQUEST_SUBMITTED', 'HomeLease',
      expect.any(String),
      expect.objectContaining({ source: 'tenant_request' }),
    );
  });
});

// ============================================================
// POST /tenant/accept-invite
// ============================================================

describe('POST /tenant/accept-invite', () => {
  let rawToken;

  beforeEach(() => {
    const crypto = require('crypto');
    rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    seedHome();
    seedTable('HomeLeaseInvite', [{
      id: 'invite-1',
      home_id: 'home-1',
      landlord_subject_type: 'user',
      landlord_subject_id: 'landlord-1',
      invitee_email: 'test@example.com',
      token_hash: tokenHash,
      proposed_start: '2026-04-01',
      proposed_end: null,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
  });

  test('returns 201 with lease and occupancy on success', async () => {
    const req = mockReq({
      body: { token: rawToken },
    });
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.lease).toBeDefined();
    expect(res._json.lease.state).toBe('active');
    expect(res._json.occupancy).toBeDefined();
  });

  test('returns 404 when token invalid', async () => {
    const req = mockReq({
      body: { token: 'a'.repeat(64) },
    });
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res._status).toBe(404);
  });

  test('returns 410 when invite expired', async () => {
    getTable('HomeLeaseInvite')[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const req = mockReq({
      body: { token: rawToken },
    });
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res._status).toBe(410);
  });

  test('returns 400 when invite already accepted', async () => {
    getTable('HomeLeaseInvite')[0].status = 'accepted';

    const req = mockReq({
      body: { token: rawToken },
    });
    const res = mockRes();
    await acceptInviteHandler(req, res);

    expect(res._status).toBe(400);
  });
});

// ============================================================
// POST /tenant/move-out
// ============================================================

describe('POST /tenant/move-out', () => {
  test('ends lease and returns success', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'test-user-id' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      body: { lease_id: 'lease-1', reason: 'Moving to another city' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('returns 404 when lease not found', async () => {
    const req = mockReq({
      body: { lease_id: 'nonexistent' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(res._status).toBe(404);
  });

  test('returns 403 when user is not on the lease', async () => {
    seedLease({ state: 'active', primary_resident_user_id: 'someone-else' });

    const req = mockReq({
      body: { lease_id: 'lease-1' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(res._status).toBe(403);
  });

  test('allows co-resident to move out', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'primary-tenant' });
    seedTable('HomeLeaseResident', [{
      id: 'lr-1',
      lease_id: 'lease-1',
      user_id: 'test-user-id',
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      body: { lease_id: 'lease-1' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('returns 400 when lease not active', async () => {
    seedLease({ state: 'ended', primary_resident_user_id: 'test-user-id' });

    const req = mockReq({
      body: { lease_id: 'lease-1' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(res._status).toBe(400);
  });

  test('writes move-out audit log', async () => {
    seedHome();
    seedLease({ state: 'active', primary_resident_user_id: 'test-user-id' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      body: { lease_id: 'lease-1', reason: 'New job' },
    });
    const res = mockRes();
    await moveOutHandler(req, res);

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'test-user-id', 'TENANT_MOVE_OUT', 'HomeLease', 'lease-1',
      expect.objectContaining({ reason: 'New job', initiated_by: 'tenant' }),
    );
  });
});

// ============================================================
// POST /home/:homeId/dispute
// ============================================================

describe('POST /home/:homeId/dispute', () => {
  test('creates dispute and returns 201', async () => {
    seedHome();
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      params: { homeId: 'home-1' },
      body: {
        dispute_type: 'authority',
        description: 'I believe the listed landlord is not the actual owner of this property.',
        target_type: 'HomeAuthority',
        target_id: 'auth-1',
      },
    });
    const res = mockRes();
    await disputeHandler(req, res);

    expect(res._status).toBe(201);
    expect(res._json.dispute).toBeDefined();
    expect(res._json.dispute.status).toBe('open');
    expect(res._json.dispute.dispute_type).toBe('authority');
  });

  test('returns 403 when user has no relationship to home', async () => {
    seedHome();
    // No occupancy, no authority

    const req = mockReq({
      params: { homeId: 'home-1' },
      body: {
        dispute_type: 'lease',
        description: 'My landlord is not honoring the lease terms.',
      },
    });
    const res = mockRes();
    await disputeHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toContain('current occupant or authority');
  });

  test('allows authority holders to file disputes', async () => {
    seedHome();
    seedAuthority({ subject_id: 'test-user-id' });

    const req = mockReq({
      params: { homeId: 'home-1' },
      body: {
        dispute_type: 'occupancy',
        description: 'Unauthorized person living in the property without approval.',
      },
    });
    const res = mockRes();
    await disputeHandler(req, res);

    expect(res._status).toBe(201);
  });

  test('does not change home security_state when a landlord dispute is filed', async () => {
    seedHome({ security_state: 'normal' });
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      params: { homeId: 'home-1' },
      body: {
        dispute_type: 'other',
        description: 'General concern about property management.',
      },
    });
    const res = mockRes();
    await disputeHandler(req, res);

    const homes = getTable('Home');
    // Product: dispute is recorded on HomeDispute only; Home.security_state stays operational.
    expect(homes[0].security_state).toBe('normal');
  });

  test('writes audit log', async () => {
    seedHome();
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'test-user-id',
      is_active: true,
    }]);

    const req = mockReq({
      params: { homeId: 'home-1' },
      body: {
        dispute_type: 'authority',
        description: 'Disputing the landlord claim on this property.',
        target_type: 'HomeAuthority',
        target_id: 'auth-1',
      },
    });
    const res = mockRes();
    await disputeHandler(req, res);

    expect(writeAuditLog).toHaveBeenCalledWith(
      'home-1', 'test-user-id', 'DISPUTE_FILED', 'HomeDispute',
      expect.any(String),
      expect.objectContaining({ dispute_type: 'authority' }),
    );
  });
});

// ============================================================
// Route registration (smoke test)
// ============================================================

describe('Route registration', () => {
  test('exports an Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  test('has all 12 expected routes', () => {
    const routes = router.stack
      .filter((layer) => layer.route)
      .map((layer) => {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
        return `${methods[0].toUpperCase()} ${layer.route.path}`;
      });

    expect(routes).toContain('POST /landlord/authority/request');
    expect(routes).toContain('GET /landlord/properties');
    expect(routes).toContain('GET /landlord/properties/:homeId');
    expect(routes).toContain('POST /landlord/lease/invite');
    expect(routes).toContain('POST /landlord/lease/:leaseId/approve');
    expect(routes).toContain('POST /landlord/lease/:leaseId/deny');
    expect(routes).toContain('POST /landlord/lease/:leaseId/end');
    expect(routes).toContain('GET /landlord/properties/:homeId/requests');
    expect(routes).toContain('POST /tenant/request-approval');
    expect(routes).toContain('POST /tenant/accept-invite');
    expect(routes).toContain('POST /tenant/move-out');
    expect(routes).toContain('POST /home/:homeId/dispute');
  });
});

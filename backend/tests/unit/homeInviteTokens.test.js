// ============================================================
// TEST: HomeInvite Token Hashing (AUTH-3.1)
//
// Verifies that invite creation stores a SHA-256 hash in
// token_hash, and that lookups work via hash comparison.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const householdClaimConfig = require('../../config/householdClaims');

// ── Mock dependencies ──────────────────────────────────────

jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn().mockResolvedValue({
    hasAccess: true, isOwner: true, role: 'owner',
    permissions: { can_manage_access: true },
  }),
  writeAuditLog: jest.fn(),
  mapLegacyRole: jest.fn((r) => r),
  applyOccupancyTemplate: jest.fn(),
  isVerifiedOwner: jest.fn().mockResolvedValue(false),
  hasPermission: jest.fn().mockResolvedValue(true),
  getRoleRank: jest.fn(() => 60),
  getUserAccess: jest.fn().mockResolvedValue({ permissions: {}, role_base: 'owner' }),
  assertCanMutateTarget: jest.fn().mockReturnValue({ allowed: true }),
  assertCanGrantPermission: jest.fn().mockReturnValue({ allowed: true }),
  ROLE_RANK: { guest: 10, member: 30, owner: 60 },
}));

jest.mock('../../utils/homeSecurityPolicy', () => ({
  getClaimRiskScore: jest.fn().mockResolvedValue({ score: 0, factors: [] }),
}));

jest.mock('../../middleware/validate', () => {
  return () => (req, res, next) => next();
});

jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'user-1', email: 'test@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

jest.mock('../../services/occupancyAttachService', () => ({
  attach: jest.fn().mockResolvedValue({ success: true, occupancy: { id: 'occ-1' }, status: 'attached' }),
  detach: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
  notifyHomeInviteAccepted: jest.fn(),
}));

jest.mock('../../services/emailService', () => ({
  sendHomeInviteEmail: jest.fn(),
}));

// ── Import router + extract handlers ───────────────────────

const router = require('../../routes/home');

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
  return null;
}

const getInviteHandler = findHandler('GET', '/invitations/token/:token');
const acceptInviteHandler = findHandler('POST', '/invitations/token/:token/accept');
const declineInviteHandler = findHandler('POST', '/invitations/token/:token/decline');
const createInviteHandler = findHandler('POST', '/:id/invite');

// ── Helpers ─────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    query: {},
    user: { id: 'user-1', email: 'test@example.com' },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
  Object.assign(householdClaimConfig.flags, {
    inviteMerge: false,
  });
});

// ── Tests ───────────────────────────────────────────────────

describe('HomeInvite token hashing (AUTH-3.1)', () => {
  const rawToken = 'a'.repeat(64); // simulated hex token
  const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  test('invite lookup by token works via hash comparison', async () => {
    seedTable('HomeInvite', [
      {
        id: 'inv-1',
        home_id: 'home-1',
        invited_by: 'user-1',
        status: 'pending',
        token: null, // plaintext removed (post-migration scenario)
        token_hash: expectedHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    seedTable('Home', [{ id: 'home-1', name: 'Test Home' }]);
    seedTable('User', [{ id: 'user-1', username: 'alice', name: 'Alice' }]);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await getInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.id).toBe('inv-1');
    expect(res.body.invitation.status).toBe('pending');
  });

  test('invite lookup falls back to plaintext for un-migrated rows', async () => {
    seedTable('HomeInvite', [
      {
        id: 'inv-2',
        home_id: 'home-1',
        invited_by: 'user-1',
        status: 'pending',
        token: rawToken,
        token_hash: null, // no hash yet
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    seedTable('Home', [{ id: 'home-1', name: 'Test Home' }]);
    seedTable('User', [{ id: 'user-1', username: 'alice', name: 'Alice' }]);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await getInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.id).toBe('inv-2');
  });

  test('invalid token returns 404', async () => {
    seedTable('HomeInvite', [
      {
        id: 'inv-1',
        home_id: 'home-1',
        invited_by: 'user-1',
        status: 'pending',
        token_hash: expectedHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    const req = mockReq({ params: { token: 'bad-token-value' } });
    const res = mockRes();

    await getInviteHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('accept-invite lookup works via token hash', async () => {
    seedTable('HomeInvite', [
      {
        id: 'inv-3',
        home_id: 'home-1',
        invited_by: 'owner-1',
        invitee_user_id: 'user-1',
        status: 'pending',
        token: null,
        token_hash: expectedHash,
        proposed_role: 'member',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    seedTable('User', [{ id: 'user-1', email: 'test@example.com' }]);
    seedTable('Home', [{ id: 'home-1', name: 'Test Home' }]);
    seedTable('HomeOccupancy', []);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await acceptInviteHandler(req, res);

    // Should either accept (200/201) or get past the token lookup
    // (may fail downstream due to missing occupancy data, but should NOT be 404)
    expect(res.statusCode).not.toBe(404);
  });

  test('accept-invite token route completes claim merge when the invite is merge-bound', async () => {
    householdClaimConfig.flags.inviteMerge = true;

    seedTable('HomeInvite', [
      {
        id: 'inv-merge-1',
        home_id: 'home-1',
        invited_by: 'owner-1',
        invitee_user_id: 'user-1',
        status: 'pending',
        token: null,
        token_hash: expectedHash,
        proposed_role: 'owner',
        proposed_role_base: 'owner',
        proposed_preset_key: 'claim_merge:claim-2',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    seedTable('Home', [{
      id: 'home-1',
      name: 'Test Home',
      owner_id: 'owner-1',
      security_state: 'claim_window',
      ownership_state: 'owner_verified',
      household_resolution_state: 'verified_household',
    }]);
    seedTable('User', [
      { id: 'user-1', email: 'test@example.com', name: 'Claimant User' },
      { id: 'owner-1', email: 'owner@example.com', name: 'Owner User' },
    ]);
    seedTable('HomeOwner', [{
      id: 'owner-row-1',
      home_id: 'home-1',
      subject_id: 'owner-1',
      owner_status: 'verified',
      is_primary_owner: true,
    }]);
    seedTable('HomeOwnershipClaim', [
      {
        id: 'claim-1',
        home_id: 'home-1',
        claimant_user_id: 'owner-1',
        claim_type: 'owner',
        state: 'approved',
        claim_phase_v2: 'verified',
        created_at: '2026-04-04T00:00:00.000Z',
      },
      {
        id: 'claim-2',
        home_id: 'home-1',
        claimant_user_id: 'user-1',
        claim_type: 'owner',
        state: 'submitted',
        claim_phase_v2: 'under_review',
        identity_status: 'verified',
        challenge_state: 'none',
        routing_classification: 'parallel_claim',
        created_at: '2026-04-04T01:00:00.000Z',
      },
    ]);
    seedTable('HomeVerificationEvidence', []);
    seedTable('HomeOccupancy', []);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.merged).toBe(true);
    expect(res.body.claim?.id).toBe('claim-2');
    expect(res.body.claim?.claim_phase_v2).toBe('verified');
    expect(res.body.claim?.terminal_reason).toBe('none');
    expect(res.body.accepted_as_owner).toBe(true);

    const mergedClaim = getTable('HomeOwnershipClaim').find((claim) => claim.id === 'claim-2');
    expect(mergedClaim.claim_phase_v2).toBe('verified');
    expect(mergedClaim.terminal_reason).toBe('none');
    expect(mergedClaim.merged_into_claim_id).toBe(null);
    const invitedOwner = getTable('HomeOwner').find((owner) => owner.subject_id === 'user-1');
    expect(invitedOwner).toEqual(expect.objectContaining({
      owner_status: 'verified',
      is_primary_owner: false,
      verification_tier: 'weak',
    }));
    expect(getTable('HomeInvite')[0].status).toBe('accepted');
  });

  test('generic invite creation rejects reserved claim-merge preset keys', async () => {
    seedTable('HomeInvite', []);

    const req = mockReq({
      params: { id: 'home-1' },
      body: {
        user_id: 'user-2',
        relationship: 'owner',
        preset_key: 'claim_merge:claim-2',
      },
    });
    const res = mockRes();

    await createInviteHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLAIM_MERGE_PRESET_FORBIDDEN');
    expect(getTable('HomeInvite')).toHaveLength(0);
  });

  test('decline-invite lookup works via token hash', async () => {
    seedTable('HomeInvite', [
      {
        id: 'inv-4',
        home_id: 'home-1',
        invited_by: 'owner-1',
        status: 'pending',
        token: null,
        token_hash: expectedHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await declineInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/declined/i);

    // Verify status was updated
    const invites = getTable('HomeInvite');
    expect(invites[0].status).toBe('revoked');
  });
});

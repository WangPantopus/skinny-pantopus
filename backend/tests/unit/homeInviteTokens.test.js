// ============================================================
// TEST: HomeInvite Token Hashing (AUTH-3.1)
//
// Route transport regression; the real hash/legacy lookup and admission
// decisions run in scripts/db/contracts/home-invitation-transactions.sql.
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
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
    set: jest.fn().mockReturnThis(),
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

    const rpc=jest.fn(async()=>({data:{ok:true,invitation:{id:'inv-1',status:'pending'}}}));
    setRpcMock(rpc);

    await getInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.id).toBe('inv-1');
    expect(res.body.invitation.status).toBe('pending');
    expect(rpc).toHaveBeenCalledWith('act_on_home_invitation',expect.objectContaining({p_token:rawToken,p_invite_id:null,p_actor_id:null,p_action:'preview'}));
    expect(res.set).toHaveBeenCalledWith('Cache-Control','no-store');
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

    const rpc=jest.fn(async()=>({data:{ok:true,invitation:{id:'inv-2',status:'pending'}}}));
    setRpcMock(rpc);

    await getInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.id).toBe('inv-2');
    expect(rpc).toHaveBeenCalledWith('act_on_home_invitation',expect.objectContaining({p_token:rawToken,p_action:'preview'}));
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
    setRpcMock(async()=>({data:{ok:false,code:'INVITE_NOT_FOUND',status:404}}));

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

    const rpc=jest.fn(async()=>({data:{ok:true,replayed:false,homeId:'home-1',occupancy:{id:'occ-1'}}}));
    setRpcMock(rpc);

    const req = mockReq({ params: { token: rawToken } });
    const res = mockRes();

    await acceptInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.occupancy.id).toBe('occ-1');
    expect(rpc).toHaveBeenCalledWith('act_on_home_invitation',expect.objectContaining({p_token:rawToken,p_actor_id:'user-1',p_action:'accept'}));
  });

  test('accept-invite token route delegates exact claim and invitation to the ownership transaction', async () => {
    householdClaimConfig.flags.inviteMerge=true;
    const invite={id:'inv-merge-1',home_id:'home-1',proposed_preset_key:'claim_merge:claim-2'};
    const rpc=jest.fn(async(name)=> name==='act_on_home_invitation'
      ? {data:{ok:true,kind:'claim_merge',invitation:invite}}
      : {data:{ok:true,replayed:false,homeId:'home-1',claimId:'claim-2',invitation:{id:invite.id},
        occupancy:{id:'occ-1',home_id:'home-1',user_id:'user-1',role_base:'owner'},acceptedRoleBase:'owner',
        acceptedAsOwner:true,claimPhaseV2:'verified',terminalReason:'none',mergedIntoClaimId:null}});
    setRpcMock(rpc);
    const req=mockReq({params:{token:rawToken}});const res=mockRes();
    await acceptInviteHandler(req,res);
    expect(res.statusCode).toBe(200);expect(res.body.merged).toBe(true);
    expect(res.body.claim).toMatchObject({id:'claim-2',claim_phase_v2:'verified',terminal_reason:'none'});
    expect(res.body.accepted_as_owner).toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(2,'mutate_home_claim_invitation',expect.objectContaining({
      p_home_id:'home-1',p_claim_id:'claim-2',p_actor_id:'user-1',p_action:'accept',p_invitation_id:invite.id}));
    expect(getTable('HomeOwner')).toEqual([]);expect(getTable('HomeOccupancy')).toEqual([]);
  });

  test('generic invite creation rejects reserved claim-merge preset keys', async () => {
    seedTable('HomeInvite', []);
    const rpc=jest.fn(async()=>({data:{ok:false,code:'CLAIM_MERGE_PRESET_FORBIDDEN',status:400}}));
    setRpcMock(rpc);

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
    expect(rpc).toHaveBeenCalledWith('write_home_invitation',expect.objectContaining({p_home_id:'home-1',p_actor_id:'user-1',p_action:'create',p_payload:req.body}));
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

    const rpc=jest.fn(async()=>({data:{ok:true,replayed:false}}));
    setRpcMock(rpc);

    await declineInviteHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/declined/i);

    expect(rpc).toHaveBeenCalledWith('act_on_home_invitation',expect.objectContaining({p_token:rawToken,p_actor_id:'user-1',p_action:'decline'}));
    // SQL owns the transition; the route must not independently rewrite it.
    expect(getTable('HomeInvite')[0].status).toBe('pending');
  });
});

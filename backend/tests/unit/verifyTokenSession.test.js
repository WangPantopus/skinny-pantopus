// ============================================================
// TEST: verifyToken – persistent-login session checks (design §6.4)
//
// After supabase.auth.getUser accepts the token the middleware decodes the
// JWT (session_id / iat / aal) into req.session, refuses revoked AuthSession
// rows (15-s cache, evicted in-process on revoke) and JWTs issued before the
// user's sessions_valid_after watermark (folded into the 60-s role cache).
// Pre-registry sessions and non-JWT tokens keep working unchanged.
// ============================================================

const { resetTables, seedTable, setAuthMocks } = require('../__mocks__/supabaseAdmin');
const verifyToken = require('../../middleware/verifyToken');
const { _roleCache, decodeSessionClaims, checkSessionPolicy } = require('../../middleware/verifyToken');
const authSessionService = require('../../services/authSessionService');
const optionalAuth = require('../../middleware/optionalAuth');

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const NOW = Math.floor(Date.now() / 1000);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwtFor({ sub = UID, session_id = SID, iat = NOW, aal = 'aal1' } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: iat + 3600, aal })}.sig`;
}

function mockReq(overrides = {}) {
  return { method: 'GET', path: '/test', headers: {}, cookies: {}, ...overrides };
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
function bearer(token) {
  return mockReq({ headers: { authorization: `Bearer ${token}` } });
}
function sessionRow(overrides = {}) {
  return {
    id: SID, user_id: UID, device_id: null, context: 'interactive', auth_method: 'password', bound_at_issue: false,
    refresh_token_hash: null, prev_refresh_token_hash: null, issued_at: new Date().toISOString(), last_refresh_at: null,
    last_seen_at: null, last_ip: null, user_agent: null, revoked_at: null, revoked_reason: null, ...overrides,
  };
}

beforeEach(() => {
  resetTables();
  _roleCache.clear();
  authSessionService.invalidateSessionStateCache();
  optionalAuth._tokenCache.clear();
  setAuthMocks({
    getUser: async (token) => {
      const parts = String(token).split('.');
      let sub = 'mock-user-id';
      if (parts.length === 3) {
        try { sub = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).sub || sub; } catch { /* legacy */ }
      }
      return { data: { user: { id: sub, email: 'a@b.com', email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null };
    },
  });
  seedTable('User', [{ id: UID, role: 'user', account_type: 'individual', email: 'a@b.com', sessions_valid_after: null }]);
});

describe('decodeSessionClaims', () => {
  test('decodes session_id / iat / aal / sub from a JWT payload; null for non-JWTs', () => {
    expect(decodeSessionClaims(jwtFor({ iat: 1700 }))).toEqual({ id: SID, iat: 1700, exp: 1700 + 3600, sub: UID, aal: 'aal1' });
    expect(decodeSessionClaims('opaque-token')).toBeNull();
    expect(decodeSessionClaims(null)).toBeNull();
  });
});

describe('verifyToken session policy', () => {
  test('JWT with session_id and no AuthSession row (pre-registry) → allowed, req.session attached with context null', async () => {
    const req = bearer(jwtFor());
    const res = mockRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(UID);
    expect(req.session).toEqual({ id: SID, iat: NOW, aal: 'aal1', context: null });
  });

  test('non-JWT token (legacy tests / opaque) → allowed, req.session has null id', async () => {
    const req = bearer('opaque-token');
    const res = mockRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.session).toEqual({ id: null, iat: null, aal: null, context: null });
  });

  test('active AuthSession row → allowed, context attached (restored)', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'restored' })]);
    const req = bearer(jwtFor());
    const next = jest.fn();
    await verifyToken(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.session.context).toBe('restored');
  });

  test('revoked AuthSession row → 401 SESSION_REVOKED, req.user not set', async () => {
    seedTable('AuthSession', [sessionRow({ revoked_at: new Date().toISOString(), revoked_reason: 'device_revoked' })]);
    const req = bearer(jwtFor());
    const res = mockRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: 'SESSION_REVOKED' });
    expect(req.user).toBeUndefined();
  });

  test('cookie transport is subject to the same check', async () => {
    seedTable('AuthSession', [sessionRow({ revoked_at: new Date().toISOString(), revoked_reason: 'logout' })]);
    const req = mockReq({ cookies: { pantopus_access: jwtFor() } });
    const res = mockRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
    expect(next).not.toHaveBeenCalled();
  });

  test('revocation in this process takes effect immediately despite the 15-s cache', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const first = jest.fn();
    await verifyToken(bearer(jwtFor()), mockRes(), first);
    expect(first).toHaveBeenCalled();
    expect(authSessionService._sessionStateCache.has(SID)).toBe(true);

    await authSessionService.revokeSessionRow(SID, 'user', { userId: UID });

    const res = mockRes();
    const second = jest.fn();
    await verifyToken(bearer(jwtFor()), res, second);
    expect(second).not.toHaveBeenCalled();
    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  test('a stale cache entry hides a revocation made elsewhere for at most the TTL (soft read)', async () => {
    seedTable('AuthSession', [sessionRow()]);
    await verifyToken(bearer(jwtFor()), mockRes(), jest.fn());
    // Another instance revoked the row (no in-process event).
    seedTable('AuthSession', [sessionRow({ revoked_at: new Date().toISOString(), revoked_reason: 'user' })]);
    const cachedNext = jest.fn();
    await verifyToken(bearer(jwtFor()), mockRes(), cachedNext);
    expect(cachedNext).toHaveBeenCalled(); // still cached
    authSessionService.invalidateSessionStateCache(SID); // TTL elapsed
    const res = mockRes();
    const next = jest.fn();
    await verifyToken(bearer(jwtFor()), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  test('sessions_valid_after watermark: iat before it → 401 SESSION_REVOKED; iat after it → allowed', async () => {
    const watermark = new Date((NOW - 60) * 1000).toISOString();
    seedTable('User', [{ id: UID, role: 'admin', account_type: 'business', sessions_valid_after: watermark }]);

    const stale = bearer(jwtFor({ iat: NOW - 120 }));
    const staleRes = mockRes();
    const staleNext = jest.fn();
    await verifyToken(stale, staleRes, staleNext);
    expect(staleNext).not.toHaveBeenCalled();
    expect(staleRes.body.code).toBe('SESSION_REVOKED');

    const fresh = bearer(jwtFor({ iat: NOW }));
    const freshNext = jest.fn();
    await verifyToken(fresh, mockRes(), freshNext);
    expect(freshNext).toHaveBeenCalled();
    // role/account_type still come through the same (now 3-column) lookup
    expect(fresh.user).toMatchObject({ role: 'admin', accountType: 'business' });
  });

  test('watermark rides in the 60-s role cache and is evicted immediately when set in this process', async () => {
    const req = bearer(jwtFor({ iat: NOW - 120 }));
    const okNext = jest.fn();
    await verifyToken(req, mockRes(), okNext);
    expect(okNext).toHaveBeenCalled();
    expect(_roleCache.get(UID).sessionsValidAfter).toBeNull();

    await authSessionService.setSessionsValidAfter(UID, new Date((NOW - 60) * 1000));
    expect(_roleCache.has(UID)).toBe(false); // 'watermark_updated' evicted it

    const res = mockRes();
    const next = jest.fn();
    await verifyToken(bearer(jwtFor({ iat: NOW - 120 })), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  test('checkSessionPolicy helper (used by socket layer / tests) mirrors the middleware', async () => {
    seedTable('AuthSession', [sessionRow({ revoked_at: new Date().toISOString(), revoked_reason: 'reuse' })]);
    const refused = await checkSessionPolicy(jwtFor(), { userId: UID });
    expect(refused).toMatchObject({ ok: false, code: 'SESSION_REVOKED', reason: 'reuse' });
    const okPolicy = await checkSessionPolicy('opaque', { userId: UID, sessionsValidAfter: new Date().toISOString() });
    expect(okPolicy.ok).toBe(true);
  });
});

describe('optionalAuth session policy (soft)', () => {
  test('revoked session reads as anonymous; active session populates req.user', async () => {
    seedTable('AuthSession', [sessionRow({ revoked_at: new Date().toISOString(), revoked_reason: 'logout' })]);
    const req = bearer(jwtFor());
    await optionalAuth(req, {}, jest.fn());
    expect(req.user).toBeNull();

    optionalAuth._tokenCache.clear();
    authSessionService.invalidateSessionStateCache();
    seedTable('AuthSession', [sessionRow()]); // replaces the revoked row
    const req2 = bearer(jwtFor());
    await optionalAuth(req2, {}, jest.fn());
    expect(req2.user).toEqual({ id: UID, email: 'a@b.com' });
  });
});

// ============================================================
// middleware/stepUp.js — X-Step-Up tokens (CONTRACT.md "New router" footnote)
//   mint/verify, HMAC tamper, expiry, wrong purpose, generic wildcard,
//   one-shot consumption, uid/session binding, restored-session rule for
//   device_key, 403 envelope { code:'STEP_UP_REQUIRED', purpose, methods }
// ============================================================

const crypto = require('crypto');
const { resetTables, seedTable, getTable, setAuthMocks } = require('./__mocks__/supabaseAdmin');
const authPolicy = require('../config/authPolicy');
const stepUp = require('../middleware/stepUp');

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const OTHER_SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const DEVICE_ROW = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

/** A fake Supabase access token whose payload carries session_id. */
function jwtFor({ sub = UID, session_id = SID, iat = Math.floor(Date.now() / 1000) } = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: iat + 3600, aal: 'aal1' })}.sig`;
}

function fakeReq({ user = { id: UID, email: 'u@example.com' }, headers = {}, session, sessionRow, token = jwtFor() } = {}) {
  const lower = {};
  Object.entries(headers).forEach(([k, v]) => { lower[k.toLowerCase()] = v; });
  if (token && !lower.authorization) lower.authorization = `Bearer ${token}`;
  const req = {
    method: 'POST',
    originalUrl: '/api/auth/devices/x',
    headers: lower,
    ip: '198.51.100.9',
    user,
    get(name) { return lower[String(name).toLowerCase()]; },
  };
  if (session !== undefined) req.session = session;
  if (sessionRow !== undefined) req.sessionRow = sessionRow;
  return req;
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function run(middleware, req) {
  const res = fakeRes();
  const next = jest.fn();
  await middleware(req, res, next);
  return { res, next };
}

function sessionRow(overrides = {}) {
  return {
    id: SID,
    user_id: UID,
    device_id: null,
    context: 'interactive',
    auth_method: 'password',
    bound_at_issue: false,
    refresh_token_hash: null,
    prev_refresh_token_hash: null,
    issued_at: new Date().toISOString(),
    last_refresh_at: null,
    last_seen_at: null,
    last_ip: null,
    user_agent: null,
    revoked_at: null,
    revoked_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetTables();
  process.env.STEP_UP_SECRET = 'test-step-up-secret';
  authPolicy._resetForTests();
});

// ---------------------------------------------------------------------------
// mint / verify
// ---------------------------------------------------------------------------

describe('mintStepUpToken / verifyStepUpToken', () => {
  test('mints a two-part base64url token with a 5-minute expiry and verifies it', () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresAt, payload } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    expect(token.split('.')).toHaveLength(2);
    expect(token).not.toMatch(/[+/=]/);
    expect(payload).toMatchObject({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.exp).toBeGreaterThanOrEqual(before + authPolicy.STEP_UP_TTL_SEC - 1);
    expect(payload.exp).toBeLessThanOrEqual(before + authPolicy.STEP_UP_TTL_SEC + 1);
    expect(new Date(expiresAt).getTime()).toBe(payload.exp * 1000);
    expect(stepUp.verifyStepUpToken(token)).toEqual(payload);
  });

  test('payload is exactly the CONTRACT shape { uid, sid, purpose, method, jti, exp }', () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
    const json = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    expect(Object.keys(json).sort()).toEqual(['exp', 'jti', 'method', 'purpose', 'sid', 'uid']);
    const sig = crypto.createHmac('sha256', 'test-step-up-secret').update(JSON.stringify(json)).digest('base64url');
    expect(token.split('.')[1]).toBe(sig);
  });

  test('rejects tampered payload / signature / different secret', () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    const [p, s] = token.split('.');
    // flip purpose in the payload
    const tampered = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    tampered.purpose = 'delete_account';
    expect(stepUp.verifyStepUpToken(`${Buffer.from(JSON.stringify(tampered)).toString('base64url')}.${s}`)).toBeNull();
    // damaged signature
    expect(stepUp.verifyStepUpToken(`${p}.${s.slice(0, -2)}xx`)).toBeNull();
    // other secret
    process.env.STEP_UP_SECRET = 'another-secret';
    authPolicy._resetForTests();
    expect(stepUp.verifyStepUpToken(token)).toBeNull();
  });

  test('rejects expired tokens and malformed input', () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password', ttlSec: 30 });
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 1000);
    try {
      expect(stepUp.verifyStepUpToken(token)).toBeNull();
    } finally {
      spy.mockRestore();
    }
    expect(stepUp.verifyStepUpToken('')).toBeNull();
    expect(stepUp.verifyStepUpToken('nodot')).toBeNull();
    expect(stepUp.verifyStepUpToken(`${Buffer.from('{}').toString('base64url')}.abc`)).toBeNull();
    expect(stepUp.verifyStepUpToken(null)).toBeNull();
  });

  test('refuses to mint invalid purposes / methods', () => {
    expect(() => stepUp.mintStepUpToken({ uid: UID, purpose: 'nope', method: 'password' })).toThrow();
    expect(() => stepUp.mintStepUpToken({ uid: UID, purpose: 'revoke_device', method: 'magic' })).toThrow();
    expect(() => stepUp.mintStepUpToken({ purpose: 'revoke_device', method: 'password' })).toThrow();
    expect(() => stepUp.requireStepUp('generic')).toThrow();
    expect(() => stepUp.requireStepUp('bogus')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// requireStepUp
// ---------------------------------------------------------------------------

describe('requireStepUp(purpose)', () => {
  test('valid token for the purpose → next(), req.stepUp set', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const { token, payload } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    const req = fakeReq({ headers: { 'X-Step-Up': token } });
    const { res, next } = await run(stepUp.requireStepUp('revoke_device'), req);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeNull();
    expect(req.stepUp).toEqual({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password', jti: payload.jti });
  });

  test('missing header → 403 STEP_UP_REQUIRED with purpose + methods', async () => {
    const { res, next } = await run(stepUp.requireStepUp('revoke_sessions'), fakeReq());
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'revoke_sessions', reason: 'missing' });
    expect(res.body.methods).toEqual(['password']);
  });

  test('no req.user → 401 UNAUTHORIZED', async () => {
    const { res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq({ user: null }));
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('expired token → 403 invalid', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password', ttlSec: 30 });
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 1000);
    try {
      const { res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq({ headers: { 'X-Step-Up': token } }));
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', reason: 'invalid' });
    } finally {
      spy.mockRestore();
    }
  });

  test('wrong purpose → 403 purpose_mismatch', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    const { res, next } = await run(stepUp.requireStepUp('delete_account'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'delete_account', reason: 'purpose_mismatch' });
  });

  test('generic (from /reauthenticate) is a wildcard for every purpose', async () => {
    for (const purpose of ['delete_account', 'revoke_device', 'revoke_sessions', 'change_security_prefs']) {
      const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
      const { next } = await run(stepUp.requireStepUp(purpose), fakeReq({ headers: { 'X-Step-Up': token } }));
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  test('token minted for another user → 403 user_mismatch', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', sid: SID, purpose: 'revoke_device', method: 'password' });
    const { res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(res.body.reason).toBe('user_mismatch');
  });

  test('token bound to another session than the Bearer → 403 session_mismatch', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: OTHER_SID, purpose: 'revoke_device', method: 'password' });
    const { res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(res.body.reason).toBe('session_mismatch');
  });

  test('token bound to the session set by verifyToken (req.session.id) is accepted', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: OTHER_SID, purpose: 'revoke_device', method: 'password' });
    const req = fakeReq({ headers: { 'X-Step-Up': token }, session: { id: OTHER_SID, context: 'interactive' } });
    const { next } = await run(stepUp.requireStepUp('revoke_device'), req);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('one-shot purposes: the same token cannot be used twice', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_sessions', method: 'password' });
    const first = await run(stepUp.requireStepUp('revoke_sessions'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(first.next).toHaveBeenCalledTimes(1);
    const consumed = getTable('AuthChallenge');
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toMatchObject({ purpose: 'stepup_used' });
    expect(consumed[0].id.startsWith('stepup:')).toBe(true);

    const second = await run(stepUp.requireStepUp('revoke_sessions'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(second.next).not.toHaveBeenCalled();
    expect(second.res.statusCode).toBe(403);
    expect(second.res.body.reason).toBe('used');
  });

  test('a generic token spent on a one-shot purpose is consumed too', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
    expect((await run(stepUp.requireStepUp('delete_account'), fakeReq({ headers: { 'X-Step-Up': token } }))).next).toHaveBeenCalledTimes(1);
    expect((await run(stepUp.requireStepUp('delete_account'), fakeReq({ headers: { 'X-Step-Up': token } }))).res.body.reason).toBe('used');
  });

  test('change_security_prefs is NOT one-shot (reusable within its lifetime)', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'change_security_prefs', method: 'password' });
    expect((await run(stepUp.requireStepUp('change_security_prefs'), fakeReq({ headers: { 'X-Step-Up': token } }))).next).toHaveBeenCalledTimes(1);
    expect((await run(stepUp.requireStepUp('change_security_prefs'), fakeReq({ headers: { 'X-Step-Up': token } }))).next).toHaveBeenCalledTimes(1);
    expect(getTable('AuthChallenge')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// restored-session rule (design §7.10)
// ---------------------------------------------------------------------------

describe('restored sessions', () => {
  test('device_key token is refused when the current session is restored (context via req.session)', async () => {
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'device_key' });
    const req = fakeReq({ headers: { 'X-Step-Up': token }, session: { id: SID, context: 'restored' } });
    const { res, next } = await run(stepUp.requireStepUp('revoke_device'), req);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', reason: 'restored_session' });
    // no jti burnt on refusal
    expect(getTable('AuthChallenge')).toHaveLength(0);
  });

  test('device_key token is refused when the AuthSession row says restored (looked up by sid)', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'restored', device_id: DEVICE_ROW })]);
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'device_key' });
    const { res } = await run(stepUp.requireStepUp('delete_account'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(res.body.reason).toBe('restored_session');
  });

  test('password token IS accepted from a restored session', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'restored', device_id: DEVICE_ROW })]);
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'password' });
    const { next } = await run(stepUp.requireStepUp('delete_account'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('device_key token from an interactive session with an interactively-enrolled key passes', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'interactive', device_id: DEVICE_ROW })]);
    const { token } = stepUp.mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'device_key' });
    const { next } = await run(stepUp.requireStepUp('revoke_device'), fakeReq({ headers: { 'X-Step-Up': token } }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('403 methods list advertises device_key only for interactive sessions with an interactive step key', async () => {
    seedTable('AuthDevice', [{
      id: DEVICE_ROW, user_id: UID, device_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', platform: 'ios',
      key_thumbprint: 't', trust_level: 'trusted', revoked_at: null,
      step_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, step_key_enrolled_via: 'interactive',
    }]);
    seedTable('AuthSession', [sessionRow({ context: 'interactive', device_id: DEVICE_ROW })]);
    let { res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq());
    expect(res.body.methods).toEqual(['password', 'device_key']);

    // restored → password only
    seedTable('AuthSession', [sessionRow({ context: 'restored', device_id: DEVICE_ROW })]);
    ({ res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq()));
    expect(res.body.methods).toEqual(['password']);

    // OAuth-only account (no password provider), interactive + enrolled → device_key only
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: 'o@example.com', app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] } }, error: null }),
    });
    seedTable('AuthSession', [sessionRow({ context: 'interactive', device_id: DEVICE_ROW })]);
    ({ res } = await run(stepUp.requireStepUp('revoke_device'), fakeReq()));
    expect(res.body.methods).toEqual(['device_key']);
  });
});

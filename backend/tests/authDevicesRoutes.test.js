// ============================================================
// routes/authDevices.js — the /api/auth router (CONTRACT.md "New router")
//
// Drives the REAL router with supertest. jest.config maps supabaseAdmin /
// verifyToken / logger / pushService to the in-memory mocks; the anon
// Supabase client (config/supabaseClient) and the mailer are stubbed here.
// express-rate-limit is replaced by a pass-through that records its options so
// the configured limits are asserted without burning the in-memory buckets.
//
//   1. /challenge          shape + validation
//   2. /devices/register   DPoP required, 409 unbound, 401 mismatch, ok (+ android grant)
//   3. /devices            list shape (isCurrent)
//   4. /devices/:id        step-up gate (403 STEP_UP_REQUIRED + methods), one-shot token
//   5. /sessions/*         revoke-others (generic token) / revoke-all (watermark)
//   6. /resume             DPoP required, grant → restored session, single-use
//   7. /step-up            password ok / wrong / oauth-only, device_key ok / restored
//   8. /step-up-key        409 unbound, ok
//   9. /security-prefs     GET defaults, PATCH gated by step-up
//  10. /security-events    shape
// ============================================================

// (jest clearMocks wipes mock.calls before each test, so the options are kept
// on a module-level list instead of on the mock function.)
const RL_OPTS = [];
jest.mock('express-rate-limit', () => (opts) => {
  RL_OPTS.push(opts);
  return (_req, _res, next) => next();
});
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test' }),
}));
const mockAnonAuth = {
  verifyOtp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
};
jest.mock('../config/supabaseClient', () => ({
  createServerSupabaseClient: jest.fn(() => ({ auth: mockAnonAuth })),
  withNodeRealtimeTransport: (o) => o,
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jose = require('jose');
const { resetTables, seedTable, getTable, setAuthMocks } = require('./__mocks__/supabaseAdmin');
const pushService = require('./__mocks__/pushService');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('../services/authSessionService');
const { mintStepUpToken } = require('../middleware/stepUp');
const authRoutes = require('../routes/authDevices');

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const BASE = 'https://api.test.local';
const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const SID3 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const DEVICE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const DEVICE_ID2 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const DEV_ROW = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const DEV_ROW2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwtFor({ sub = UID, session_id = SID, iat = Math.floor(Date.now() / 1000) } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: iat + 3600 })}.sig`;
}

async function makeKey() {
  const kp = await jose.generateKeyPair('ES256', { extractable: true });
  const pub = await jose.exportJWK(kp.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y };
  const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');
  return { kp, jwk, thumbprint };
}

async function proof(key, path, { htm = 'POST', rth } = {}) {
  const payload = { jti: crypto.randomUUID(), htm, htu: `${BASE}${path}`, iat: Math.floor(Date.now() / 1000), ...(rth ? { rth } : {}) };
  return new jose.SignJWT(payload)
    .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk: key.jwk })
    .sign(key.kp.privateKey);
}

/** Raw r||s ES256 signature over bytes (what the native step-up key produces). */
function signRaw(key, bytes) {
  return crypto.sign('sha256', bytes, { key: key.kp.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

function descriptor(overrides = {}) {
  return {
    deviceId: DEVICE_ID,
    platform: 'ios',
    installId: 'inst00000001',
    name: "Ying's iPhone",
    model: 'iPhone16,2',
    osVersion: '18.5',
    appVersion: '1.4.0 (312)',
    hasOsLock: true,
    keyBacking: 'secure_enclave',
    attestation: null,
    ...overrides,
  };
}

function deviceRow(overrides = {}) {
  return {
    id: DEV_ROW,
    user_id: UID,
    device_id: DEVICE_ID,
    platform: 'ios',
    public_key_jwk: null,
    key_thumbprint: null,
    key_backing: 'secure_enclave',
    attestation_level: 'none',
    attestation: null,
    trust_level: 'trusted',
    step_key_jwk: null,
    step_key_enrolled_via: null,
    require_step_up: false,
    install_id: 'inst00000001',
    name: "Ying's iPhone",
    model: 'iPhone16,2',
    os_version: '18.5',
    app_version: '1.4.0 (312)',
    trusted_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    last_ip: null,
    last_user_agent: null,
    last_resumed_at: null,
    resumed_from_device: null,
    revoked_at: null,
    revoked_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
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
    last_seen_at: new Date().toISOString(),
    last_ip: null,
    user_agent: null,
    revoked_at: null,
    revoked_reason: null,
    ...overrides,
  };
}

const findRow = (table, id) => getTable(table).find((r) => r.id === id);

let KEY;
let KEY2;
let STEP_KEY;
let app;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/auth', authRoutes);
  return a;
}

/** Authenticated request builder: Bearer JWT (session SID by default) + test-user headers. */
function authed(method, path, { sessionId = SID, email = 'ying@example.com' } = {}) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${jwtFor({ session_id: sessionId })}`)
    .set('x-test-user-id', UID)
    .set('x-test-user-email', email)
    .set('x-client-platform', 'ios');
}

/** A bound, interactive iOS session on KEY. */
function seedBoundSession({ context = 'interactive', platform = 'ios', keyBacking = 'secure_enclave', deviceOverrides = {} } = {}) {
  seedTable('AuthDevice', [deviceRow({ platform, key_backing: keyBacking, public_key_jwk: KEY.jwk, key_thumbprint: KEY.thumbprint, ...deviceOverrides })]);
  seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, context })]);
}

beforeAll(async () => {
  KEY = await makeKey();
  KEY2 = await makeKey();
  STEP_KEY = await makeKey();
  app = buildApp();
});

beforeEach(() => {
  resetTables();
  delete process.env.AUTH_DEVICE_BINDING;
  delete process.env.AUTH_RESUME_GRANTS;
  process.env.PUBLIC_API_BASE_URL = BASE;
  process.env.STEP_UP_SECRET = 'route-test-secret';
  authPolicy._resetForTests();
  seedTable('User', [{ id: UID, email: 'ying@example.com', first_name: 'Ying', username: 'ying', security_prefs: {} }]);
  mockAnonAuth.verifyOtp.mockReset();
  mockAnonAuth.signInWithPassword.mockReset();
  mockAnonAuth.signOut.mockClear();
  setAuthMocks({
    adminGetUserById: async (id) => ({
      data: { user: { id, email: 'ying@example.com', app_metadata: { provider: 'email', providers: ['email'] }, identities: [{ provider: 'email' }] } },
      error: null,
    }),
    adminSignOut: async () => ({ data: null, error: null }),
  });
});

// ===========================================================================
// 0. limiter configuration (CONTRACT: 30/15m/IP challenge, 5/15m/IP resume,
//    10/15m/user step-up)
// ===========================================================================

describe('rate limiter configuration', () => {
  test('challenge 30/15m, resume 5/15m per IP + per grant, step-up 10/15m per user', () => {
    const byLimit = (n) => RL_OPTS.filter((o) => o.limit === n);
    expect(byLimit(30).some((o) => o.windowMs === 15 * 60 * 1000)).toBe(true);
    expect(byLimit(5).some((o) => o.windowMs === 15 * 60 * 1000)).toBe(true);
    const grantLimiter = byLimit(3)[0];
    expect(grantLimiter).toBeDefined();
    expect(grantLimiter.keyGenerator({ body: { grant: 'g'.repeat(43) }, ip: '1.2.3.4' })).toMatch(/^grant:/);
    expect(grantLimiter.keyGenerator({ body: {}, ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    const stepUp = byLimit(10)[0];
    expect(stepUp.keyGenerator({ user: { id: 'u1' }, ip: '1.2.3.4' })).toBe('u1');
    expect(stepUp.keyGenerator({ ip: '1.2.3.4' })).toBe('1.2.3.4');
  });
});

// ===========================================================================
// 1. POST /challenge
// ===========================================================================

describe('POST /api/auth/challenge', () => {
  test('returns {challengeId, challenge (32 B b64url), expiresAt} and stores the row (10-min TTL)', async () => {
    const res = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    expect(res.status).toBe(200);
    expect(res.body.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const ttl = new Date(res.body.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000);
    const row = findRow('AuthChallenge', res.body.challengeId);
    expect(row.purpose).toBe('step_up');
    expect(row.challenge).toBe(res.body.challenge);
  });

  test('unknown purpose → 400', async () => {
    const res = await request(app).post('/api/auth/challenge').send({ purpose: 'login' });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 2. POST /devices/register
// ===========================================================================

describe('POST /api/auth/devices/register', () => {
  test('missing DPoP → 401 DPOP_REQUIRED (even in optional mode)', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/devices/register').send({ device: descriptor() });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('malformed body → 400 before the proof is checked (no jti burned)', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/devices/register')
      .set('DPoP', await proof(KEY, '/api/auth/devices/register'))
      .send({ device: { deviceId: 'nope' } });
    expect(res.status).toBe(400);
    expect(getTable('AuthDpopJti')).toHaveLength(0);
  });

  test('unbound session (no row / web) → 409 DEVICE_NOT_BOUND; never creates a device', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const res = await authed('post', '/api/auth/devices/register')
      .set('DPoP', await proof(KEY, '/api/auth/devices/register'))
      .send({ device: descriptor() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEVICE_NOT_BOUND');
    expect(getTable('AuthDevice')).toHaveLength(0);
  });

  test('DPoP from a different key than the bound one → 401 DEVICE_MISMATCH', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/devices/register')
      .set('DPoP', await proof(KEY2, '/api/auth/devices/register'))
      .send({ device: descriptor() });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(findRow('AuthDevice', DEV_ROW).key_thumbprint).toBe(KEY.thumbprint);
  });

  test('bound key: metadata + push token linked; iOS gets no grant', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/devices/register')
      .set('DPoP', await proof(KEY, '/api/auth/devices/register'))
      .send({ device: descriptor({ appVersion: '1.5.0 (400)', name: 'Ying iPhone 16' }), pushToken: 'apns-token-1', pushProvider: 'apns' });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({ id: DEV_ROW, deviceId: DEVICE_ID, trustLevel: 'trusted' });
    expect(res.body.device.trustedAt).toBeTruthy();
    expect(res.body.resumeGrant).toBeUndefined();
    const row = findRow('AuthDevice', DEV_ROW);
    expect(row.app_version).toBe('1.5.0 (400)');
    expect(row.name).toBe('Ying iPhone 16');
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'apns-token-1', expect.objectContaining({ platform: 'ios', provider: 'apns', deviceId: DEVICE_ID }));
  });

  test('android trusted strongbox device → resumeGrant returned (43-char b64url), hash stored', async () => {
    seedBoundSession({ platform: 'android', keyBacking: 'strongbox' });
    const res = await authed('post', '/api/auth/devices/register')
      .set('x-client-platform', 'android')
      .set('DPoP', await proof(KEY, '/api/auth/devices/register'))
      .send({ device: descriptor({ platform: 'android', keyBacking: 'strongbox', model: 'Pixel 9' }) });
    expect(res.status).toBe(200);
    expect(res.body.resumeGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const grants = getTable('AuthResumeGrant');
    expect(grants).toHaveLength(1);
    expect(grants[0].grant_hash).toBe(authSessionService.hashToken(res.body.resumeGrant));
    expect(grants[0].device_id).toBe(DEV_ROW);
  });
});

// ===========================================================================
// 3. GET /devices
// ===========================================================================

describe('GET /api/auth/devices', () => {
  test('devices (current first), unbound sessions, events', async () => {
    seedBoundSession();
    seedTable('AuthDevice', [
      deviceRow(),
      deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, platform: 'android', name: 'Pixel 9', model: 'Pixel 9', trust_level: 'unverified' }),
    ]);
    seedTable('AuthSession', [
      sessionRow({ device_id: DEV_ROW, bound_at_issue: true }),
      sessionRow({ id: SID2, device_id: DEV_ROW2, bound_at_issue: true }),
      sessionRow({ id: SID3, user_agent: 'Mozilla/5.0 Chrome' }),
    ]);
    seedTable('AuthSecurityEvent', [{ id: 1, user_id: UID, type: 'login', created_at: new Date().toISOString(), device_id: DEV_ROW, meta: { method: 'password' } }]);

    const res = await authed('get', '/api/auth/devices');
    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(2);
    expect(res.body.devices[0]).toMatchObject({ id: DEV_ROW, deviceId: DEVICE_ID, platform: 'ios', isCurrent: true, trustLevel: 'trusted' });
    expect(res.body.devices[1]).toMatchObject({ id: DEV_ROW2, isCurrent: false, platform: 'android' });
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).toMatchObject({ id: SID3, platform: 'web', isCurrent: false });
    expect(res.body.events[0]).toMatchObject({ type: 'login', deviceId: DEV_ROW });
  });
});

// ===========================================================================
// 4. DELETE /devices/:id — step-up gate + one-shot
// ===========================================================================

describe('DELETE /api/auth/devices/:id', () => {
  test('without X-Step-Up → 403 STEP_UP_REQUIRED {purpose:revoke_device, methods}', async () => {
    seedBoundSession();
    const res = await authed('delete', `/api/auth/devices/${DEV_ROW}`);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'revoke_device' });
    expect(res.body.methods).toEqual(['password']);
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
  });

  test('with a valid token → 200 ok; the same token cannot be used twice (one-shot); wrong purpose refused', async () => {
    seedBoundSession();
    seedTable('AuthDevice', [deviceRow(), deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, platform: 'android' })]);
    seedTable('AuthSession', [
      sessionRow({ device_id: DEV_ROW, bound_at_issue: true }),
      sessionRow({ id: SID2, device_id: DEV_ROW2, bound_at_issue: true }),
    ]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });

    const ok = await authed('delete', `/api/auth/devices/${DEV_ROW2}`).set('X-Step-Up', token);
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(findRow('AuthDevice', DEV_ROW2).revoked_at).toBeTruthy();
    expect(findRow('AuthSession', SID2).revoked_reason).toBe('device_revoked');
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID2);

    const replay = await authed('delete', `/api/auth/devices/${DEV_ROW}`).set('X-Step-Up', token);
    expect(replay.status).toBe(403);
    expect(replay.body.reason).toBe('used');
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();

    const wrong = mintStepUpToken({ uid: UID, sid: SID, purpose: 'change_security_prefs', method: 'password' }).token;
    const bad = await authed('delete', `/api/auth/devices/${DEV_ROW}`).set('X-Step-Up', wrong);
    expect(bad.status).toBe(403);
    expect(bad.body.reason).toBe('purpose_mismatch');
  });

  test('device of another user → 404; malformed id → 400', async () => {
    seedBoundSession();
    seedTable('AuthDevice', [deviceRow(), deviceRow({ id: DEV_ROW2, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', device_id: DEVICE_ID2 })]);
    const t = () => mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' }).token;
    expect((await authed('delete', `/api/auth/devices/${DEV_ROW2}`).set('X-Step-Up', t())).status).toBe(404);
    expect((await authed('delete', '/api/auth/devices/not-a-uuid').set('X-Step-Up', t())).status).toBe(400);
  });
});

// ===========================================================================
// 5. /sessions/revoke-others + /sessions/revoke-all
// ===========================================================================

describe('POST /api/auth/sessions/*', () => {
  test('revoke-others with the wildcard token from /reauthenticate → other sessions/devices revoked, current kept', async () => {
    seedTable('AuthDevice', [
      deviceRow({ public_key_jwk: KEY.jwk, key_thumbprint: KEY.thumbprint }),
      deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, platform: 'android' }),
    ]);
    seedTable('AuthSession', [
      sessionRow({ device_id: DEV_ROW, bound_at_issue: true }),
      sessionRow({ id: SID2, device_id: DEV_ROW2, bound_at_issue: true }),
      sessionRow({ id: SID3, user_agent: 'Mozilla' }),
    ]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
    const res = await authed('post', '/api/auth/sessions/revoke-others').set('X-Step-Up', token).send({});
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthSession', SID2).revoked_at).toBeTruthy();
    expect(findRow('AuthSession', SID3).revoked_at).toBeTruthy();
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW2).revoked_at).toBeTruthy();
  });

  test('revoke-all → {ok:true}, everything revoked, sessions_valid_after set, cookies cleared', async () => {
    seedBoundSession();
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true }), sessionRow({ id: SID3 })]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_sessions', method: 'password' });
    const res = await authed('post', '/api/auth/sessions/revoke-all').set('X-Step-Up', token).send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(getTable('AuthSession').every((s) => s.revoked_at)).toBe(true);
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeTruthy();
    expect(findRow('User', UID).sessions_valid_after).toBeTruthy();
    expect(pushService.removeAllTokens).toHaveBeenCalledWith(UID);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('pantopus_access=;'))).toBe(true);
  });

  test('revoke-all without step-up → 403', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/sessions/revoke-all').send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STEP_UP_REQUIRED');
  });
});

// ===========================================================================
// 6. POST /resume
// ===========================================================================

describe('POST /api/auth/resume', () => {
  function seedIssuingDevice() {
    seedTable('AuthDevice', [deviceRow({ platform: 'android', key_backing: 'strongbox', public_key_jwk: KEY.jwk, key_thumbprint: KEY.thumbprint, model: 'Pixel 9' })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true })]);
  }
  function mockMint() {
    setAuthMocks({
      adminGenerateLink: async ({ type, email }) => ({ data: { user: { id: UID, email }, properties: { hashed_token: `hashed-${type}` } }, error: null }),
    });
    const session = { access_token: jwtFor({ session_id: SID2 }), refresh_token: 'rt-restored', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 };
    mockAnonAuth.verifyOtp.mockResolvedValue({ data: { session, user: { id: UID, email: 'ying@example.com' } }, error: null });
    return session;
  }
  const androidDesc = () => descriptor({ deviceId: DEVICE_ID2, platform: 'android', installId: 'inst00000002', name: 'Pixel 9', model: 'Pixel 9', osVersion: '15', keyBacking: 'strongbox' });

  test('missing DPoP → 401 DPOP_REQUIRED', async () => {
    seedIssuingDevice();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    const res = await request(app).post('/api/auth/resume').send({ grant, device: androidDesc() });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
    expect(getTable('AuthResumeGrant')[0].used_at).toBeNull();
  });

  test('valid grant + DPoP → login-shaped response with session.context restored + new grant; the grant is single-use', async () => {
    seedIssuingDevice();
    mockMint();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    const res = await request(app)
      .post('/api/auth/resume')
      .set('x-client-platform', 'android')
      .set('DPoP', await proof(KEY2, '/api/auth/resume'))
      .send({ grant, device: androidDesc() });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: 'rt-restored',
      expiresIn: 3600,
      sessionId: SID2,
      session: { id: SID2, context: 'restored' },
      device: { deviceId: DEVICE_ID2, isNew: true, trustLevel: 'trusted' },
    });
    expect(res.body.user).toMatchObject({ id: UID, email: 'ying@example.com', firstName: 'Ying' });
    expect(res.body.resumeGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.resumeGrant).not.toBe(grant);
    const restored = findRow('AuthSession', SID2);
    expect(restored).toMatchObject({ context: 'restored', auth_method: 'resume_grant', bound_at_issue: true });
    const newDevice = getTable('AuthDevice').find((d) => d.device_id === DEVICE_ID2);
    expect(newDevice.key_thumbprint).toBe(KEY2.thumbprint);
    expect(newDevice.resumed_from_device).toBe(DEV_ROW);
    expect(restored.device_id).toBe(newDevice.id);
    expect(findRow('AuthDevice', DEV_ROW).revoked_reason).toBe('superseded');

    // replay
    const again = await request(app)
      .post('/api/auth/resume')
      .set('DPoP', await proof(KEY2, '/api/auth/resume'))
      .send({ grant, device: androidDesc() });
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('RESUME_GRANT_INVALID');
  });

  test('software-backed key → RESUME_GRANT_INVALID and the grant is NOT consumed', async () => {
    seedIssuingDevice();
    mockMint();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    const res = await request(app)
      .post('/api/auth/resume')
      .set('DPoP', await proof(KEY2, '/api/auth/resume'))
      .send({ grant, device: androidDesc() && descriptor({ deviceId: DEVICE_ID2, platform: 'android', keyBacking: 'software' }) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('RESUME_GRANT_INVALID');
    expect(getTable('AuthResumeGrant')[0].used_at).toBeNull();
    expect(mockAnonAuth.verifyOtp).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 7. POST /step-up
// ===========================================================================

describe('POST /api/auth/step-up', () => {
  test('password: correct → {stepUpToken, expiresAt, purpose}; temp session dropped; token accepted by requireStepUp', async () => {
    seedBoundSession();
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp' } }, error: null });
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_device', method: 'password', password: 'correct horse' });
    expect(res.status).toBe(200);
    expect(res.body.purpose).toBe('revoke_device');
    expect(res.body.stepUpToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(new Date(res.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(mockAnonAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ying@example.com', password: 'correct horse' });
    expect(mockAnonAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(getTable('AuthSecurityEvent').some((e) => e.type === 'step_up')).toBe(true);

    seedTable('AuthDevice', [deviceRow({ public_key_jwk: KEY.jwk, key_thumbprint: KEY.thumbprint }), deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2 })]);
    const del = await authed('delete', `/api/auth/devices/${DEV_ROW2}`).set('X-Step-Up', res.body.stepUpToken);
    expect(del.status).toBe(200);
  });

  test('password: wrong → 401 UNAUTHORIZED, no token', async () => {
    seedBoundSession();
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_device', method: 'password', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.stepUpToken).toBeUndefined();
  });

  test('password on an OAuth-only account → 403 STEP_UP_REQUIRED with the available methods', async () => {
    seedBoundSession();
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: 'ying@example.com', app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] } }, error: null }),
    });
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'delete_account', method: 'password', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STEP_UP_REQUIRED');
    expect(res.body.methods).toEqual([]);
    expect(mockAnonAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  test('password from a restored session promotes it to interactive', async () => {
    seedBoundSession({ context: 'restored', deviceOverrides: { trusted_at: null } });
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp' } }, error: null });
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'delete_account', method: 'password', password: 'pw' });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID).context).toBe('interactive');
    expect(findRow('AuthDevice', DEV_ROW).trusted_at).toBeTruthy();
  });

  test('device_key: enrol via /step-up-key, sign the challenge → token; restored session refused; DER signature refused', async () => {
    seedBoundSession();
    // enrol
    const enrol = await authed('post', '/api/auth/step-up-key')
      .set('DPoP', await proof(KEY, '/api/auth/step-up-key'))
      .send({ publicKeyJwk: STEP_KEY.jwk, keyBacking: 'secure_enclave' });
    expect(enrol.status).toBe(200);
    expect(findRow('AuthDevice', DEV_ROW).step_key_enrolled_via).toBe('interactive');

    // methods now advertise device_key
    const gate = await authed('delete', `/api/auth/devices/${DEV_ROW}`);
    expect(gate.body.methods).toEqual(['password', 'device_key']);

    // challenge → sign → step-up
    const ch = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    const sig = signRaw(STEP_KEY, Buffer.from(ch.body.challenge, 'base64url'));
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_sessions', method: 'device_key', challengeId: ch.body.challengeId, signature: sig });
    expect(res.status).toBe(200);
    expect(res.body.stepUpToken).toBeTruthy();

    // the challenge is consumed
    const replay = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_sessions', method: 'device_key', challengeId: ch.body.challengeId, signature: sig });
    expect(replay.status).toBe(401);

    // restored session: the token is refused by requireStepUp even though it was minted
    findRow('AuthSession', SID).context = 'restored';
    const useOnRestored = await authed('post', '/api/auth/sessions/revoke-others').set('X-Step-Up', res.body.stepUpToken).send({});
    expect(useOnRestored.status).toBe(403);
    expect(useOnRestored.body.reason).toBe('restored_session');

    // and a restored session cannot mint one in the first place
    const ch2 = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    const sig2 = signRaw(STEP_KEY, Buffer.from(ch2.body.challenge, 'base64url'));
    const restoredMint = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_sessions', method: 'device_key', challengeId: ch2.body.challengeId, signature: sig2 });
    expect(restoredMint.status).toBe(403);
    expect(restoredMint.body.code).toBe('STEP_UP_REQUIRED');
    expect(restoredMint.body.methods).toEqual(['password']);
  });

  test('device_key without an enrolled key → 403 STEP_UP_REQUIRED {methods:[password]}', async () => {
    seedBoundSession();
    const ch = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'revoke_device', method: 'device_key', challengeId: ch.body.challengeId, signature: 'A'.repeat(86) });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', methods: ['password'] });
  });

  test('device_key cannot mint the generic wildcard', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/auth/step-up').send({ purpose: 'generic', method: 'device_key', challengeId: crypto.randomUUID(), signature: 'A'.repeat(86) });
    expect(res.status).toBe(403);
  });

  test('delete_account is password-first: device_key refused for an account that has a password (methods:[password]); accepted for OAuth-only', async () => {
    seedBoundSession({ deviceOverrides: { step_key_jwk: { kty: 'EC', crv: 'P-256', x: STEP_KEY.jwk.x, y: STEP_KEY.jwk.y }, step_key_enrolled_via: 'interactive' } });
    const ch = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    const sig = signRaw(STEP_KEY, Buffer.from(ch.body.challenge, 'base64url'));
    const denied = await authed('post', '/api/auth/step-up').send({ purpose: 'delete_account', method: 'device_key', challengeId: ch.body.challengeId, signature: sig });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'delete_account', methods: ['password'] });
    // other purposes still offer both
    expect((await authed('delete', `/api/auth/devices/${DEV_ROW}`)).body.methods).toEqual(['password', 'device_key']);

    // OAuth-only account (no email provider) → device_key is the strongest method available
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: 'ying@example.com', app_metadata: { provider: 'apple', providers: ['apple'] }, identities: [{ provider: 'apple' }] } }, error: null }),
    });
    const ch2 = await request(app).post('/api/auth/challenge').send({ purpose: 'step_up' });
    const sig2 = signRaw(STEP_KEY, Buffer.from(ch2.body.challenge, 'base64url'));
    const ok = await authed('post', '/api/auth/step-up').send({ purpose: 'delete_account', method: 'device_key', challengeId: ch2.body.challengeId, signature: sig2 });
    expect(ok.status).toBe(200);
    expect(ok.body.stepUpToken).toBeTruthy();
  });
});

// ===========================================================================
// 8. POST /step-up-key refusals
// ===========================================================================

describe('POST /api/auth/step-up-key', () => {
  test('unbound session → 409; restored session → 403; DPoP from another key → 401; missing DPoP → 401', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const body = { publicKeyJwk: STEP_KEY.jwk, keyBacking: 'secure_enclave' };
    let res = await authed('post', '/api/auth/step-up-key').set('DPoP', await proof(KEY, '/api/auth/step-up-key')).send(body);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEVICE_NOT_BOUND');

    resetTables();
    seedTable('User', [{ id: UID, email: 'ying@example.com', security_prefs: {} }]);
    seedBoundSession({ context: 'restored' });
    res = await authed('post', '/api/auth/step-up-key').set('DPoP', await proof(KEY, '/api/auth/step-up-key')).send(body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INTERACTIVE_SESSION_REQUIRED');

    resetTables();
    seedTable('User', [{ id: UID, email: 'ying@example.com', security_prefs: {} }]);
    seedBoundSession();
    res = await authed('post', '/api/auth/step-up-key').set('DPoP', await proof(KEY2, '/api/auth/step-up-key')).send(body);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(findRow('AuthDevice', DEV_ROW).step_key_jwk).toBeNull();

    res = await authed('post', '/api/auth/step-up-key').send(body);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });
});

// ===========================================================================
// 9. security prefs
// ===========================================================================

describe('/api/auth/security-prefs', () => {
  test('GET returns defaults; PATCH needs step-up (change_security_prefs, reusable); switching grants off revokes open grants', async () => {
    seedBoundSession({ platform: 'android', keyBacking: 'strongbox' });
    await authSessionService.mintResumeGrant(UID, DEV_ROW);

    let res = await authed('get', '/api/auth/security-prefs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ allowRestoreGrants: true, newDeviceEmail: true });

    res = await authed('patch', '/api/auth/security-prefs').send({ newDeviceEmail: false });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'change_security_prefs' });

    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'change_security_prefs', method: 'password' });
    res = await authed('patch', '/api/auth/security-prefs').set('X-Step-Up', token).send({ newDeviceEmail: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ allowRestoreGrants: true, newDeviceEmail: false });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeNull();

    // not one-shot: the same token can patch again
    res = await authed('patch', '/api/auth/security-prefs').set('X-Step-Up', token).send({ allowRestoreGrants: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ allowRestoreGrants: false, newDeviceEmail: false });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(findRow('User', UID).security_prefs).toEqual({ allowRestoreGrants: false, newDeviceEmail: false });

    res = await authed('patch', '/api/auth/security-prefs').set('X-Step-Up', token).send({});
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 10. security events
// ===========================================================================

describe('GET /api/auth/security-events', () => {
  test('returns the user’s events only, newest first, limit clamped', async () => {
    seedTable('AuthSecurityEvent', [
      { id: 1, user_id: UID, type: 'login', created_at: '2026-08-01T00:00:00.000Z', device_id: DEV_ROW, session_id: SID, meta: null },
      { id: 2, user_id: UID, type: 'logout', created_at: '2026-08-02T00:00:00.000Z', device_id: null, session_id: SID, meta: { scope: 'local' } },
      { id: 3, user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', type: 'login', created_at: '2026-08-03T00:00:00.000Z', device_id: null, session_id: null, meta: null },
    ]);
    const res = await authed('get', '/api/auth/security-events?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({ type: expect.any(String), createdAt: expect.any(String) });
    const all = await authed('get', '/api/auth/security-events');
    expect(all.body.events.map((e) => e.id).sort()).toEqual([1, 2]);
  });
});

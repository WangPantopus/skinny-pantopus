// ============================================================
// routes/users.js — persistent-login hooks (CONTRACT.md "Existing routes",
// design §6.3). Drives the REAL users router with supertest.
//
// jest.config maps supabaseAdmin / config/supabase / verifyToken (stub that
// sets req.user from x-test-* headers) / logger / pushService to the in-memory
// mocks; the anon Supabase client (config/supabaseClient), the mailer and
// express-rate-limit are stubbed here.
//
//   1. /login             bind-at-issue (bearer / cookie / DPoP modes)
//   2. /refresh           binding matrix through the route
//   3. /logout            scopes + proof rules
//   4. /reauthenticate    stepUpToken (generic / password)
//   5. /password          others revoked
//   6. /reset-password    everything revoked + watermark
//   7. DELETE /account    step-up gate (+ strongest-method rule)
//   8. /oauth/native, /oauth/callback, /oauth/token  bind + response shape
// ============================================================

jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());
jest.mock('../middleware/rateLimiter', () => {
  const noop = (_r, _s, n) => n();
  return new Proxy({}, { get: () => noop });
});
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test' }),
}));
jest.mock('../config/auth', () => ({ signUp: jest.fn(), signIn: jest.fn() }));

const mockAnonAuth = {
  signInWithPassword: jest.fn(),
  signInWithIdToken: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  refreshSession: jest.fn(),
  getUser: jest.fn(),
  verifyOtp: jest.fn(),
  setSession: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
};
jest.mock('../config/supabaseClient', () => ({
  createServerSupabaseClient: jest.fn(() => ({ auth: mockAnonAuth })),
  withNodeRealtimeTransport: (o) => o,
}));

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jose = require('jose');
const { resetTables, seedTable, getTable, setAuthMocks } = require('./__mocks__/supabaseAdmin');
const pushService = require('./__mocks__/pushService');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('../services/authSessionService');
const { mintStepUpToken, verifyStepUpToken } = require('../middleware/stepUp');
const usersRouter = require('../routes/users');

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const BASE = 'https://api.test.local';
const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const UID2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const SID3 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const DEVICE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const DEVICE_ID2 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const DEV_ROW = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const DEV_ROW2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
const EMAIL = 'ying@example.com';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwtFor({ sub = UID, session_id = SID, iat = Math.floor(Date.now() / 1000), exp } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: exp || iat + 3600, aal: 'aal1' })}.sig`;
}
function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function makeKey() {
  const kp = await jose.generateKeyPair('ES256', { extractable: true });
  const pub = await jose.exportJWK(kp.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y };
  const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');
  return { kp, jwk, thumbprint };
}

async function proof(key, path, { htm = 'POST', rth, refreshToken } = {}) {
  const payload = {
    jti: crypto.randomUUID(),
    htm,
    htu: `${BASE}${path}`,
    iat: Math.floor(Date.now() / 1000),
  };
  if (refreshToken) payload.rth = authSessionService.hashToken(refreshToken);
  if (rth) payload.rth = rth;
  return new jose.SignJWT(payload)
    .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk: key.jwk })
    .sign(key.kp.privateKey);
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

function userRow(overrides = {}) {
  return {
    id: UID,
    email: EMAIL,
    username: 'ying',
    name: 'Ying W',
    first_name: 'Ying',
    middle_name: null,
    last_name: 'W',
    phone_number: null,
    address: null,
    city: null,
    state: null,
    zipcode: null,
    account_type: 'individual',
    role: 'user',
    verified: true,
    created_at: new Date().toISOString(),
    sessions_valid_after: null,
    security_prefs: {},
    ...overrides,
  };
}

const findRow = (table, id) => getTable(table).find((r) => r.id === id);
const events = (type) => getTable('AuthSecurityEvent').filter((e) => e.type === type);
/** seedTable REPLACES a table; addRows appends. */
const addRows = (table, rows) => seedTable(table, [...getTable(table), ...rows]);

function supaSession({ sub = UID, session_id = SID, refresh = 'rt-1' } = {}) {
  const access_token = jwtFor({ sub, session_id });
  return { access_token, refresh_token: refresh, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: sub, email: EMAIL } };
}

let KEY;
let KEY2;
let app;
let adminSignOut;

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use(cookieParser());
  a.use('/api/users', usersRouter);
  return a;
}

/** getUser mock that trusts our fake JWTs (sub/email) — like GoTrue would for real ones. */
function installGetUser() {
  const getUser = jest.fn(async (token) => {
    const payload = decodeJwt(token);
    if (!payload?.sub || String(token).endsWith('.bad')) return { data: { user: null }, error: { message: 'invalid' } };
    return { data: { user: { id: payload.sub, email: EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} } }, error: null };
  });
  setAuthMocks({ getUser });
  mockAnonAuth.getUser.mockImplementation(getUser);
  return getUser;
}

/** Bearer request builder (verifyToken stub reads x-test-user-*; the routes decode the JWT for session_id). */
function authed(method, path, { sessionId = SID, userId = UID, email = EMAIL } = {}) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${jwtFor({ sub: userId, session_id: sessionId })}`)
    .set('x-test-user-id', userId)
    .set('x-test-user-email', email)
    .set('x-client-platform', 'ios');
}

function seedBoundSession({ context = 'interactive', refresh = 'rt-1', deviceOverrides = {}, sessionOverrides = {} } = {}) {
  seedTable('AuthDevice', [deviceRow({ public_key_jwk: KEY.jwk, key_thumbprint: KEY.thumbprint, ...deviceOverrides })]);
  seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, context, refresh_token_hash: authSessionService.hashToken(refresh), ...sessionOverrides })]);
}

beforeAll(async () => {
  KEY = await makeKey();
  KEY2 = await makeKey();
  app = buildApp();
});

beforeEach(() => {
  resetTables();
  authSessionService.invalidateSessionStateCache();
  authPolicy._resetForTests();
  process.env.PUBLIC_API_BASE_URL = BASE;
  process.env.AUTH_DEVICE_BINDING = 'optional';
  delete process.env.DPOP_CUTOVER;
  process.env.STEP_UP_SECRET = 'test-step-up-secret';
  Object.values(mockAnonAuth).forEach((fn) => fn.mockReset && fn.mockReset());
  mockAnonAuth.signOut.mockResolvedValue({ error: null });
  adminSignOut = jest.fn().mockResolvedValue({ data: null, error: null });
  setAuthMocks({ adminSignOut });
  installGetUser();
  seedTable('User', [userRow()]);
});

afterAll(() => {
  delete process.env.PUBLIC_API_BASE_URL;
  delete process.env.AUTH_DEVICE_BINDING;
  delete process.env.DPOP_CUTOVER;
  delete process.env.STEP_UP_SECRET;
});

// ---------------------------------------------------------------------------
// 1. POST /login
// ---------------------------------------------------------------------------
describe('POST /api/users/login — bind at issue', () => {
  function loginOk(sess = supaSession()) {
    mockAnonAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: sess.user.id, email: EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z' }, session: sess },
      error: null,
    });
    return sess;
  }

  test('bearer login without device: sessionId + session{interactive} + device null; unbound AuthSession row', async () => {
    const sess = loginOk();
    const res = await request(app).post('/api/users/login').send({ email: EMAIL, password: 'pw' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: sess.access_token,
      refreshToken: 'rt-1',
      sessionId: SID,
      session: { id: SID, context: 'interactive' },
      device: null,
      user: { id: UID, email: EMAIL },
    });
    const row = findRow('AuthSession', SID);
    expect(row).toMatchObject({ user_id: UID, device_id: null, bound_at_issue: false, auth_method: 'password', context: 'interactive' });
    expect(row.refresh_token_hash).toBe(authSessionService.hashToken('rt-1'));
    expect(events('login')).toHaveLength(1);
  });

  test('bearer login with device + DPoP: device bound (isNew, trusted), AuthSession bound_at_issue', async () => {
    loginOk();
    const res = await request(app)
      .post('/api/users/login')
      .set('DPoP', await proof(KEY, '/api/users/login'))
      .set('x-client-platform', 'ios')
      .send({ email: EMAIL, password: 'pw', device: descriptor() });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({ deviceId: DEVICE_ID, isNew: true, trustLevel: 'trusted' });
    expect(res.body.session).toEqual({ id: SID, context: 'interactive' });
    const dev = getTable('AuthDevice')[0];
    expect(dev).toMatchObject({ user_id: UID, device_id: DEVICE_ID, key_thumbprint: KEY.thumbprint, platform: 'ios' });
    const row = findRow('AuthSession', SID);
    expect(row).toMatchObject({ device_id: dev.id, bound_at_issue: true });
    // new device ⇒ security email
    expect(require('../services/emailService').sendEmail).toHaveBeenCalled();
  });

  test('cookie transport (web): sessionId only, tokens in cookies, unbound row', async () => {
    loginOk();
    const res = await request(app)
      .post('/api/users/login')
      .set('x-token-transport', 'cookie')
      .send({ email: EMAIL, password: 'pw' });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(SID);
    expect(res.body.session).toBeUndefined();
    expect(res.body.device).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie'].join(';')).toContain('pantopus_access=');
    expect(findRow('AuthSession', SID)).toMatchObject({ device_id: null, bound_at_issue: false });
  });

  test('AUTH_DEVICE_BINDING=required: bearer without DPoP → 401 DPOP_REQUIRED; cookie transport still logs in', async () => {
    process.env.AUTH_DEVICE_BINDING = 'required';
    loginOk();
    const denied = await request(app).post('/api/users/login').send({ email: EMAIL, password: 'pw' });
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('DPOP_REQUIRED');
    expect(mockAnonAuth.signInWithPassword).not.toHaveBeenCalled();

    const web = await request(app).post('/api/users/login').set('x-token-transport', 'cookie').send({ email: EMAIL, password: 'pw' });
    expect(web.status).toBe(200);
  });

  test('malformed DPoP → 401 DPOP_INVALID before the credential is tried', async () => {
    loginOk();
    const res = await request(app).post('/api/users/login').set('DPoP', 'garbage').send({ email: EMAIL, password: 'pw' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_INVALID');
    expect(mockAnonAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  test('registry failure never fails the login (bindAtIssue is best effort)', async () => {
    loginOk();
    const spy = jest.spyOn(require('../services/authDeviceService'), 'bindAtIssue').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/users/login').send({ email: EMAIL, password: 'pw' });
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.sessionId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. POST /refresh
// ---------------------------------------------------------------------------
describe('POST /api/users/refresh — binding matrix', () => {
  const NEW_RT = 'rt-2';
  function refreshOk({ sub = UID, session_id = SID, refresh = NEW_RT } = {}) {
    const sess = supaSession({ sub, session_id, refresh });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: sess, user: { id: sub } }, error: null });
    return sess;
  }

  test('legacy pre-registry session (no row): accepted, row created, sessionId returned', async () => {
    const sess = refreshOk();
    const res = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, accessToken: sess.access_token, refreshToken: NEW_RT, sessionId: SID, session: { id: SID, context: 'interactive' } });
    const row = findRow('AuthSession', SID);
    expect(row).toMatchObject({ auth_method: 'legacy', device_id: null });
    expect(row.refresh_token_hash).toBe(authSessionService.hashToken(NEW_RT));
    expect(row.prev_refresh_token_hash).toBe(authSessionService.hashToken('rt-1'));
  });

  test('bound session + proof from the bound key with rth → 200, hashes rotated, last_refresh_at set', async () => {
    seedBoundSession();
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, sessionId: SID });
    expect(res.status).toBe(200);
    expect(res.body.session).toEqual({ id: SID, context: 'interactive' });
    const row = findRow('AuthSession', SID);
    expect(row.refresh_token_hash).toBe(authSessionService.hashToken(NEW_RT));
    expect(row.prev_refresh_token_hash).toBe(authSessionService.hashToken('rt-1'));
    expect(row.last_refresh_at).toBeTruthy();
    expect(row.revoked_at).toBeNull();
  });

  test('bound session resolved by prev_refresh_token_hash (crash between rotate and persist) → 200', async () => {
    seedBoundSession({ refresh: 'rt-current', sessionOverrides: { prev_refresh_token_hash: authSessionService.hashToken('rt-1') } });
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(SID);
  });

  test('bound session without any proof → 401 DEVICE_MISMATCH, row revoked (mismatch), device suspect, GoTrue not called', async () => {
    seedBoundSession();
    refreshOk();
    const res = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(mockAnonAuth.refreshSession).not.toHaveBeenCalled();
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'mismatch' });
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ trust_level: 'suspect', require_step_up: true });
    expect(events('device_mismatch')).toHaveLength(1);
  });

  test('bound session + proof from a DIFFERENT key → 401 DEVICE_MISMATCH', async () => {
    seedBoundSession();
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY2, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
  });

  test('proof whose rth does not match the presented refresh token → 401 DPOP_INVALID (nothing revoked)', async () => {
    seedBoundSession();
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'some-other-token' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_INVALID');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('proof without rth on /refresh → 401 DPOP_INVALID', async () => {
    seedBoundSession();
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh'))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_INVALID');
  });

  test('revoked session → 401 with the reason-specific code (SESSION_REVOKED / DEVICE_REVOKED)', async () => {
    seedTable('AuthSession', [
      sessionRow({ id: SID, revoked_at: new Date().toISOString(), revoked_reason: 'logout', refresh_token_hash: authSessionService.hashToken('rt-1') }),
      sessionRow({ id: SID2, revoked_at: new Date().toISOString(), revoked_reason: 'device_revoked', refresh_token_hash: authSessionService.hashToken('rt-dev') }),
    ]);
    refreshOk();
    const a = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-1' });
    expect(a.status).toBe(401);
    expect(a.body.code).toBe('SESSION_REVOKED');
    const b = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-dev' });
    expect(b.status).toBe(401);
    expect(b.body.code).toBe('DEVICE_REVOKED');
    expect(mockAnonAuth.refreshSession).not.toHaveBeenCalled();
  });

  test('inactive session (idle > 90 d trusted) → 401 SESSION_EXPIRED_INACTIVE, row revoked, event', async () => {
    const old = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString();
    seedBoundSession({ sessionOverrides: { issued_at: old, last_refresh_at: old } });
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED_INACTIVE');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'inactivity' });
    expect(events('inactivity_expired')).toHaveLength(1);
  });

  test('TOKEN_REUSE from GoTrue: 401 TOKEN_REUSE + row revoked (reuse) + device require_step_up + event + cookies cleared', async () => {
    seedBoundSession();
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid Refresh Token: Already Used' } });
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSE');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'reuse' });
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ require_step_up: true, trust_level: 'suspect' });
    expect(events('refresh_reuse')).toHaveLength(1);
    expect(res.headers['set-cookie'].join(';')).toContain('pantopus_access=;');
  });

  test('other GoTrue refresh failures → 401 UNAUTHORIZED (no registry side effects)', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'network' } });
    const res = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('required mode: unbound legacy row without proof → 401 DPOP_REQUIRED (bearer); web cookie transport still refreshes', async () => {
    process.env.AUTH_DEVICE_BINDING = 'required';
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const native = await request(app).post('/api/users/refresh').send({ refreshToken: 'rt-1' });
    expect(native.status).toBe(401);
    expect(native.body.code).toBe('DPOP_REQUIRED');

    const web = await request(app)
      .post('/api/users/refresh')
      .set('x-token-transport', 'cookie')
      .set('Cookie', ['pantopus_refresh=rt-1'])
      .send({});
    expect(web.status).toBe(200);
    expect(web.body).toEqual({ ok: true, sessionId: SID, session: { id: SID, context: 'interactive' } });
    expect(web.headers['set-cookie'].join(';')).toContain(`pantopus_refresh=${NEW_RT}`);
  });

  test('legacy adoption: unbound row issued before DPOP_CUTOVER + proof + deviceId → bound onto the presenting key', async () => {
    process.env.DPOP_CUTOVER = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    seedTable('AuthSession', [sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('x-client-platform', 'ios')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, device: descriptor() });
    expect(res.status).toBe(200);
    const dev = getTable('AuthDevice')[0];
    expect(dev).toMatchObject({ device_id: DEVICE_ID, key_thumbprint: KEY.thumbprint });
    expect(findRow('AuthSession', SID).device_id).toBe(dev.id);
  });

  test('legacy adoption with the default DPOP_CUTOVER (far future): every unbound pre-cutover session is adoptable', async () => {
    // Stage-1 semantics (design §6.3): sessions issued BEFORE the cutover were
    // minted by clients that could not bind, so the first DPoP-capable refresh
    // adopts them. The default cutover is far in the future ⇒ all legacy
    // sessions qualify; set DPOP_CUTOVER to the client ship date to stop
    // adopting anything issued after it.
    seedTable('AuthSession', [sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('x-client-platform', 'ios')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, device: descriptor() });
    expect(res.status).toBe(200);
    expect(getTable('AuthDevice')).toHaveLength(1);
    expect(findRow('AuthSession', SID).device_id).toBe(getTable('AuthDevice')[0].id);
  });

  test('legacy adoption is refused for a session issued AFTER DPOP_CUTOVER (unbound stays unbound)', async () => {
    process.env.DPOP_CUTOVER = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    seedTable('AuthSession', [sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('x-client-platform', 'ios')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, device: descriptor() });
    expect(res.status).toBe(200);
    expect(getTable('AuthDevice')).toHaveLength(0);
    expect(findRow('AuthSession', SID).device_id).toBeNull();
  });

  test('legacy adoption never happens without a client deviceId (proof alone is not enough)', async () => {
    seedTable('AuthSession', [sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(getTable('AuthDevice')).toHaveLength(0);
  });

  test('foreign refresh token: session resolved by body sessionId belongs to user A but GoTrue rotates user B → 401 DEVICE_MISMATCH, minted pair signed out, A row NOT punished (hint-resolved)', async () => {
    seedBoundSession(); // A = UID, bound to KEY, hash(rt-1)
    const stolen = supaSession({ sub: UID2, session_id: SID2, refresh: 'victim-rt-2' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: stolen, user: { id: UID2 } }, error: null });
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'victim-rt-1' }))
      .send({ refreshToken: 'victim-rt-1', sessionId: SID });
    // The proof was verified against A's key (session resolved by sessionId),
    // GoTrue returned B's pair.
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(res.body.accessToken).toBeUndefined();
    expect(adminSignOut).toHaveBeenCalledWith(stolen.access_token, 'local');
    // SECURITY (S1): `sessionId` is an unauthenticated hint, so A's row is
    // never revoked on its strength — the pair is refused, nothing is punished.
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_at: null, revoked_reason: null });
    expect(events('device_mismatch')).toHaveLength(0);
  });

  test('foreign refresh token whose hash DOES resolve the row → 401 DEVICE_MISMATCH and the row IS revoked', async () => {
    seedBoundSession({ refresh: 'rt-1' });
    const stolen = supaSession({ sub: UID2, session_id: SID2, refresh: 'rt-2' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: stolen, user: { id: UID2 } }, error: null });
    const res = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'mismatch' });
    expect(events('device_mismatch')).toHaveLength(1);
  });

  // ── S1 regression: the `sessionId` body hint must not be a weapon ────────
  test('S1: bound session + attacker-supplied sessionId + junk refresh token → 401 UNAUTHORIZED, victim untouched', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/refresh')
      .send({ refreshToken: 'not-the-victims-token', sessionId: SID });
    expect(res.status).toBe(401);
    // Generic code: never DEVICE_MISMATCH, which clients treat as a security
    // sign-out, and never a hint that this session id exists and is bound.
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_at: null, revoked_reason: null });
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ require_step_up: false, trust_level: 'trusted' });
    expect(events('device_mismatch')).toHaveLength(0);
    expect(require('../services/emailService').sendEmail).not.toHaveBeenCalled();
    expect(mockAnonAuth.refreshSession).not.toHaveBeenCalled();
  });

  test('S1: unbound session + attacker-supplied sessionId + GoTrue "already used" → no reuse punishment', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid Refresh Token: Already Used' } });
    const res = await request(app)
      .post('/api/users/refresh')
      .send({ refreshToken: 'attacker-guess', sessionId: SID });
    expect(res.status).toBe(401);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_at: null, revoked_reason: null });
    expect(events('refresh_reuse')).toHaveLength(0);
    expect(require('../services/emailService').sendEmail).not.toHaveBeenCalled();
  });

  test('S1: an unverified access token claiming a foreign session_id cannot revoke it either', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/refresh')
      .send({ refreshToken: 'not-the-victims-token', accessToken: jwtFor({ sub: UID2, session_id: SID }) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_at: null, revoked_reason: null });
  });

  test('S1: inactivity / device-revoked verdicts still report, but only a token-resolved refresh writes the revocation', async () => {
    const idle = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();
    seedBoundSession({ sessionOverrides: { issued_at: idle, last_refresh_at: idle } });
    const hinted = await request(app).post('/api/users/refresh').send({ refreshToken: 'junk', sessionId: SID });
    expect(hinted.body.code).toBe('SESSION_EXPIRED_INACTIVE');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(events('inactivity_expired')).toHaveLength(0);

    const real = await request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
    expect(real.body.code).toBe('SESSION_EXPIRED_INACTIVE');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'inactivity' });
    expect(events('inactivity_expired')).toHaveLength(1);
  });

  // ── S2 regression: /refresh must never rotate an existing binding ────────
  test('S2: legacy adoption must not take an existing (user, deviceId) row away from its key', async () => {
    // The victim's device row already exists and is bound to KEY, with a
    // biometric step-up key enrolled and a live bound session.
    seedTable('AuthDevice', [deviceRow({
      public_key_jwk: KEY.jwk,
      key_thumbprint: KEY.thumbprint,
      step_key_jwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
      step_key_enrolled_via: 'interactive',
    })]);
    seedTable('AuthSession', [
      sessionRow({ id: SID2, device_id: DEV_ROW, bound_at_issue: true, refresh_token_hash: authSessionService.hashToken('bound-rt') }),
      sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') }),
    ]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('x-client-platform', 'ios')
      .set('DPoP', await proof(KEY2, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, device: descriptor() });
    expect(res.status).toBe(200);
    // Binding untouched, step-up key intact, the bound session still alive.
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({
      key_thumbprint: KEY.thumbprint,
      step_key_enrolled_via: 'interactive',
      revoked_at: null,
    });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_at: null });
    // The adopting session stays unbound rather than being bound to a foreign key.
    expect(findRow('AuthSession', SID).device_id).toBeNull();
  });

  test('S2: adoption of a NEW deviceId still works and does not mark the device interactively trusted', async () => {
    seedTable('AuthSession', [sessionRow({ bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await request(app)
      .post('/api/users/refresh')
      .set('x-client-platform', 'ios')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1', deviceId: DEVICE_ID, device: descriptor() });
    expect(res.status).toBe(200);
    const dev = getTable('AuthDevice')[0];
    expect(dev).toMatchObject({ device_id: DEVICE_ID, key_thumbprint: KEY.thumbprint });
    // A refresh is not a credential event.
    expect(dev.trusted_at).toBeNull();
    expect(findRow('AuthSession', SID).device_id).toBe(dev.id);
  });

  test('missing refresh token → 400 (unchanged)', async () => {
    const res = await request(app).post('/api/users/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 3. POST /logout
// ---------------------------------------------------------------------------
describe('POST /api/users/logout — scopes + proof', () => {
  test('local without any proof: cookies cleared, presented JWT revoked (local), no row side effects, exact {success:true}', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('Cookie', ['pantopus_access=some-cookie-token'])
      .send({ deviceId: DEVICE_ID });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(adminSignOut).toHaveBeenCalledWith('some-cookie-token', 'local');
    expect(res.headers['set-cookie'].join(';')).toContain('pantopus_access=;');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(pushService.removeTokensForDevice).not.toHaveBeenCalled();
  });

  test('local with a valid Bearer whose session is bound to deviceId → row revoked (logout), push tokens + grants of that device removed, event', async () => {
    seedBoundSession();
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'x', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 1e9).toISOString(), used_at: null, revoked_at: null }]);
    const res = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${jwtFor()}`)
      .send({ scope: 'local', deviceId: DEVICE_ID });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'logout' });
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(events('logout')).toHaveLength(1);
    expect(events('logout')[0].meta).toMatchObject({ proof: 'bearer', scope: 'local' });
  });

  // ── S3 regression: proof (a) must be resolved BEFORE the JWT is revoked ──
  test('S3: GoTrue answering session_not_found after admin.signOut must not forfeit the registry side effects', async () => {
    seedBoundSession();
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'x', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 1e9).toISOString(), used_at: null, revoked_at: null }]);
    // Production behaviour: `admin.signOut(jwt,'local')` deletes the GoTrue
    // session row, so every later `auth.getUser(jwt)` answers 403.
    const signedOut = new Set();
    adminSignOut = jest.fn(async (token) => {
      signedOut.add(token);
      return { data: null, error: null };
    });
    const getUser = jest.fn(async (token) => {
      if (signedOut.has(token)) return { data: { user: null }, error: { message: 'Session from session_id claim in JWT does not exist', status: 403 } };
      const payload = decodeJwt(token);
      if (!payload?.sub) return { data: { user: null }, error: { message: 'invalid' } };
      return { data: { user: { id: payload.sub, email: EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} } }, error: null };
    });
    setAuthMocks({ adminSignOut, getUser });
    mockAnonAuth.getUser.mockImplementation(getUser);

    const res = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${jwtFor()}`)
      .send({ scope: 'local', deviceId: DEVICE_ID });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'logout' });
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(events('logout')[0].meta).toMatchObject({ proof: 'bearer' });
  });

  test('local with a Bearer bound to ANOTHER deviceId → session revoked but no device side effects', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${jwtFor()}`)
      .send({ deviceId: DEVICE_ID2 });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'logout' });
    expect(pushService.removeTokensForDevice).not.toHaveBeenCalled();
  });

  test('local with an INVALID Bearer → still {success:true}, nothing revoked', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${jwtFor()}.bad`)
      .send({ deviceId: DEVICE_ID });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('local with refreshToken + DPoP(rth) from the bound key (no Bearer, expired app) → row + device side effects', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('DPoP', await proof(KEY, '/api/users/logout', { refreshToken: 'rt-1' }))
      .send({ scope: 'local', deviceId: DEVICE_ID, refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'logout' });
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);
    expect(events('logout')[0].meta).toMatchObject({ proof: 'refresh' });
  });

  test('local with refreshToken + DPoP from the WRONG key → success but nothing revoked', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('DPoP', await proof(KEY2, '/api/users/logout', { refreshToken: 'rt-1' }))
      .send({ deviceId: DEVICE_ID, refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(pushService.removeTokensForDevice).not.toHaveBeenCalled();
  });

  test('local with refreshToken but NO DPoP → success, nothing revoked (bearer secret alone is not proof)', async () => {
    seedBoundSession();
    const res = await request(app).post('/api/users/logout').send({ deviceId: DEVICE_ID, refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('local with an invalid/replayed DPoP → logout still succeeds, no side effects (proof never required)', async () => {
    seedBoundSession();
    const res = await request(app)
      .post('/api/users/logout')
      .set('DPoP', 'not-a-proof')
      .send({ deviceId: DEVICE_ID, refreshToken: 'rt-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('scope others without X-Step-Up → 403 STEP_UP_REQUIRED (purpose revoke_sessions, methods)', async () => {
    seedBoundSession();
    const res = await authed('post', '/api/users/logout').send({ scope: 'others' });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'revoke_sessions' });
    expect(res.body.methods).toContain('password');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('scope others with a step-up token → other sessions/devices revoked, current kept, admin.signOut(others), {success, revoked}', async () => {
    seedBoundSession();
    addRows('AuthDevice', [deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, key_thumbprint: KEY2.thumbprint, public_key_jwk: KEY2.jwk })]);
    addRows('AuthSession', [
      sessionRow({ id: SID2, device_id: DEV_ROW2, bound_at_issue: true }),
      sessionRow({ id: SID3, device_id: null, user_agent: 'Mozilla/5.0' }),
    ]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_sessions', method: 'password' });
    const res = await authed('post', '/api/users/logout').set('X-Step-Up', token).send({ scope: 'others' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, revoked: 2 });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthSession', SID2).revoked_at).toBeTruthy();
    expect(findRow('AuthSession', SID3).revoked_at).toBeTruthy();
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW2).revoked_at).toBeTruthy();
    expect(adminSignOut).toHaveBeenCalledWith(expect.any(String), 'others');
    // the caller's cookies are NOT cleared for scope others
    expect(res.headers['set-cookie'] || []).toEqual([]);
  });

  test('scope global with a step-up token → everything revoked + watermark + admin.signOut(global) + cookies cleared', async () => {
    seedBoundSession();
    addRows('AuthSession', [sessionRow({ id: SID2 })]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_sessions', method: 'password' });
    const res = await authed('post', '/api/users/logout').set('X-Step-Up', token).send({ scope: 'global' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, revoked: 2 });
    expect(findRow('AuthSession', SID).revoked_at).toBeTruthy();
    expect(findRow('AuthSession', SID2).revoked_at).toBeTruthy();
    expect(findRow('User', UID).sessions_valid_after).toBeTruthy();
    expect(pushService.removeAllTokens).toHaveBeenCalledWith(UID);
    expect(adminSignOut).toHaveBeenCalledWith(expect.any(String), 'global');
    expect(res.headers['set-cookie'].join(';')).toContain('pantopus_access=;');
  });

  test('step-up token minted for another purpose is refused for scope others', async () => {
    seedBoundSession();
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'revoke_device', method: 'password' });
    const res = await authed('post', '/api/users/logout').set('X-Step-Up', token).send({ scope: 'others' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STEP_UP_REQUIRED');
  });

  test('unknown scope → 400', async () => {
    const res = await request(app).post('/api/users/logout').send({ scope: 'everything' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. POST /reauthenticate
// ---------------------------------------------------------------------------
describe('POST /api/users/reauthenticate — step-up token', () => {
  test('correct password → verified + stepUpToken (generic/password, bound to the caller session) + expiresAt', async () => {
    seedTable('AuthSession', [sessionRow()]);
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp', refresh_token: 'tmp-r' } }, error: null });
    const res = await authed('post', '/api/users/reauthenticate').send({ password: 'correct horse' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verified: true, purpose: 'generic' });
    expect(res.body.expiresAt).toBeTruthy();
    const payload = verifyStepUpToken(res.body.stepUpToken);
    expect(payload).toMatchObject({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
    // the temporary session minted by signInWithPassword is dropped
    expect(mockAnonAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(events('step_up')).toHaveLength(1);
  });

  test('the wildcard token is accepted by requireStepUp(revoke_sessions) on /logout others', async () => {
    seedTable('AuthSession', [sessionRow(), sessionRow({ id: SID2 })]);
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp', refresh_token: 'tmp-r' } }, error: null });
    const re = await authed('post', '/api/users/reauthenticate').send({ password: 'pw' });
    const res = await authed('post', '/api/users/logout').set('X-Step-Up', re.body.stepUpToken).send({ scope: 'others' });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(1);
  });

  test('a restored session that shows its password is promoted to interactive', async () => {
    seedBoundSession({ context: 'restored', deviceOverrides: { trusted_at: null } });
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp', refresh_token: 'tmp-r' } }, error: null });
    const res = await authed('post', '/api/users/reauthenticate').send({ password: 'pw' });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID).context).toBe('interactive');
    expect(findRow('AuthDevice', DEV_ROW).trusted_at).toBeTruthy();
  });

  test('wrong password → 401 and no token', async () => {
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
    const res = await authed('post', '/api/users/reauthenticate').send({ password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.stepUpToken).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. POST /password
// ---------------------------------------------------------------------------
describe('POST /api/users/password — other sessions revoked', () => {
  test('password change: other sessions + devices + grants revoked, current session/device kept, admin.signOut(others), email', async () => {
    seedBoundSession();
    addRows('AuthDevice', [deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, key_thumbprint: KEY2.thumbprint })]);
    addRows('AuthSession', [sessionRow({ id: SID2, device_id: DEV_ROW2, bound_at_issue: true }), sessionRow({ id: SID3 })]);
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: UID }, session: { access_token: 'tmp', refresh_token: 'tmp-r' } }, error: null });
    const res = await authed('post', '/api/users/password').send({ currentPassword: 'old-password-123', newPassword: 'new-password-12345' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasPassword: true });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'password_change' });
    expect(findRow('AuthSession', SID3)).toMatchObject({ revoked_reason: 'password_change' });
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW2).revoked_at).toBeTruthy();
    expect(adminSignOut).toHaveBeenCalledWith(expect.any(String), 'others');
    expect(events('password_changed')).toHaveLength(1);
    expect(require('../services/emailService').sendEmail).toHaveBeenCalled();
  });

  test('a failed password change (wrong current password) revokes nothing', async () => {
    seedTable('AuthSession', [sessionRow(), sessionRow({ id: SID2 })]);
    mockAnonAuth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'bad' } });
    const res = await authed('post', '/api/users/password').send({ currentPassword: 'wrong-password-123', newPassword: 'new-password-12345' });
    expect(res.status).toBe(401);
    expect(findRow('AuthSession', SID2).revoked_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. POST /reset-password
// ---------------------------------------------------------------------------
describe('POST /api/users/reset-password — everything revoked + watermark', () => {
  test('recovery token branch: all sessions/devices/grants revoked, watermark set, recovery session revoked afterwards', async () => {
    seedBoundSession();
    addRows('AuthSession', [sessionRow({ id: SID2 })]);
    const recovery = supaSession({ session_id: SID3, refresh: 'rec-rt' });
    mockAnonAuth.verifyOtp.mockResolvedValue({ data: { session: recovery, user: { id: UID } }, error: null });
    mockAnonAuth.setSession.mockResolvedValue({ error: null });
    mockAnonAuth.updateUser.mockResolvedValue({ error: null });
    const res = await request(app).post('/api/users/reset-password').send({ token: 'recovery-hash-token', newPassword: 'brand-new-password-1' });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeTruthy();
    expect(findRow('User', UID).sessions_valid_after).toBeTruthy();
    expect(pushService.removeAllTokens).toHaveBeenCalledWith(UID);
    expect(adminSignOut).toHaveBeenCalledWith(recovery.access_token, 'global');
    expect(adminSignOut).toHaveBeenCalledWith(recovery.access_token, 'local');
    expect(events('password_reset')).toHaveLength(1);
  });

  test('JWT branch: same revocation through admin.updateUserById', async () => {
    seedTable('AuthSession', [sessionRow(), sessionRow({ id: SID2 })]);
    const jwt = jwtFor({ session_id: SID3 });
    const res = await request(app).post('/api/users/reset-password').send({ token: jwt, newPassword: 'brand-new-password-1' });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('User', UID).sessions_valid_after).toBeTruthy();
    expect(adminSignOut).toHaveBeenCalledWith(jwt, 'global');
  });
});

// ---------------------------------------------------------------------------
// 7. DELETE /account
// ---------------------------------------------------------------------------
describe('DELETE /api/users/account — step-up gate', () => {
  test('without X-Step-Up → 403 STEP_UP_REQUIRED (delete_account, methods) and nothing deleted', async () => {
    seedBoundSession();
    const res = await authed('delete', '/api/users/account');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'delete_account' });
    expect(res.body.methods).toEqual(['password']);
    expect(findRow('User', UID)).toBeTruthy();
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('403 advertises password only for delete_account even when a step-up key is enrolled (strongest method); other purposes list both', async () => {
    seedBoundSession({ deviceOverrides: { step_key_jwk: { kty: 'EC', crv: 'P-256', x: KEY2.jwk.x, y: KEY2.jwk.y }, step_key_enrolled_via: 'interactive' } });
    const del = await authed('delete', '/api/users/account');
    expect(del.status).toBe(403);
    expect(del.body.methods).toEqual(['password']);
    const others = await authed('post', '/api/users/logout').send({ scope: 'others' });
    expect(others.body.methods).toEqual(['password', 'device_key']);
  });

  test('with a password step-up token → sessions revoked, push tokens removed, event, User row + auth user deleted; token is one-shot', async () => {
    seedBoundSession();
    addRows('AuthSession', [sessionRow({ id: SID2 })]);
    const supabaseAdmin = require('./__mocks__/supabaseAdmin');
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'password' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    expect(findRow('User', UID)).toBeUndefined();
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(UID);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'account_deleted' });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'account_deleted' });
    expect(pushService.removeAllTokens).toHaveBeenCalledWith(UID);
    expect(events('account_deleted')).toHaveLength(1);
    expect(adminSignOut).toHaveBeenCalledWith(expect.any(String), 'global');

    // one-shot: the same token cannot be replayed
    seedTable('User', [userRow()]);
    const again = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(again.status).toBe(403);
    expect(again.body.reason).toBe('used');
  });

  test('the wildcard token from /reauthenticate is accepted', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'generic', method: 'password' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(200);
  });

  test('device_key step-up is refused for an account that HAS a password (strongest method rule)', async () => {
    seedBoundSession();
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'device_key' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'STEP_UP_REQUIRED', purpose: 'delete_account', methods: ['password'], reason: 'password_required' });
    expect(findRow('User', UID)).toBeTruthy();
  });

  test('device_key step-up from an interactive session IS accepted for an OAuth-only account', async () => {
    seedBoundSession();
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: EMAIL, app_metadata: { provider: 'apple', providers: ['apple'] }, identities: [{ provider: 'apple' }] } }, error: null }),
    });
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'device_key' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(200);
    expect(findRow('User', UID)).toBeUndefined();
  });

  test('device_key step-up from a RESTORED session is refused even for an OAuth-only account', async () => {
    seedBoundSession({ context: 'restored' });
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: EMAIL, app_metadata: { provider: 'apple', providers: ['apple'] }, identities: [{ provider: 'apple' }] } }, error: null }),
    });
    const { token } = mintStepUpToken({ uid: UID, sid: SID, purpose: 'delete_account', method: 'device_key' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('restored_session');
  });

  test('a token bound to a different session is refused', async () => {
    seedTable('AuthSession', [sessionRow(), sessionRow({ id: SID2 })]);
    const { token } = mintStepUpToken({ uid: UID, sid: SID2, purpose: 'delete_account', method: 'password' });
    const res = await authed('delete', '/api/users/account').set('X-Step-Up', token);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('session_mismatch');
  });
});

// ---------------------------------------------------------------------------
// 8. OAuth routes
// ---------------------------------------------------------------------------
describe('OAuth routes — bind at issue', () => {
  const OAUTH_UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9';
  const oauthUser = (id = OAUTH_UID) => ({ id, email: 'apple@example.com', user_metadata: { given_name: 'A', family_name: 'B' }, app_metadata: { provider: 'apple', providers: ['apple'] } });

  test('POST /oauth/native (apple) → signInWithIdToken, profile created, session bound with device + DPoP', async () => {
    const sess = supaSession({ sub: OAUTH_UID, session_id: SID2, refresh: 'oauth-rt' });
    mockAnonAuth.signInWithIdToken.mockResolvedValue({ data: { session: sess, user: oauthUser() }, error: null });
    const res = await request(app)
      .post('/api/users/oauth/native')
      .set('DPoP', await proof(KEY, '/api/users/oauth/native'))
      .set('x-client-platform', 'ios')
      .send({ provider: 'apple', idToken: 'apple-identity-token-xyz', nonce: 'n0nce', device: descriptor() });
    expect(res.status).toBe(200);
    expect(mockAnonAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-identity-token-xyz', nonce: 'n0nce' });
    expect(res.body).toMatchObject({
      accessToken: sess.access_token,
      refreshToken: 'oauth-rt',
      sessionId: SID2,
      session: { id: SID2, context: 'interactive' },
      device: { deviceId: DEVICE_ID, isNew: true },
      user: { id: OAUTH_UID, email: 'apple@example.com', verified: true },
    });
    expect(findRow('User', OAUTH_UID)).toBeTruthy();
    expect(findRow('AuthSession', SID2)).toMatchObject({ auth_method: 'siwa_native', bound_at_issue: true });
  });

  test('POST /oauth/native rejects a bad identity token (401) and validates the body (400)', async () => {
    mockAnonAuth.signInWithIdToken.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'bad id token' } });
    const bad = await request(app).post('/api/users/oauth/native').send({ provider: 'google', idToken: 'google-identity-token' });
    expect(bad.status).toBe(401);
    const invalid = await request(app).post('/api/users/oauth/native').send({ provider: 'facebook', idToken: 'x' });
    expect(invalid.status).toBe(400);
  });

  test('POST /oauth/callback binds the exchanged session (auth_method oauth_apple)', async () => {
    const sess = supaSession({ sub: OAUTH_UID, session_id: SID2, refresh: 'cb-rt' });
    mockAnonAuth.exchangeCodeForSession.mockResolvedValue({ data: { session: sess, user: oauthUser() }, error: null });
    const res = await request(app)
      .post('/api/users/oauth/callback')
      .set('DPoP', await proof(KEY, '/api/users/oauth/callback'))
      .send({ code: 'auth-code', device: descriptor() });
    expect(res.status).toBe(200);
    expect(res.body.session).toEqual({ id: SID2, context: 'interactive' });
    expect(res.body.device).toMatchObject({ deviceId: DEVICE_ID });
    expect(findRow('AuthSession', SID2)).toMatchObject({ auth_method: 'oauth_apple', bound_at_issue: true });
  });

  test('POST /oauth/token refreshes the supplied pair, binds the NEW session and returns the rotated tokens', async () => {
    const supplied = jwtFor({ sub: OAUTH_UID, session_id: SID2 });
    setAuthMocks({ getUser: async () => ({ data: { user: oauthUser() }, error: null }) });
    const rotated = supaSession({ sub: OAUTH_UID, session_id: SID2, refresh: 'rotated-rt' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: rotated, user: { id: OAUTH_UID } }, error: null });
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY, '/api/users/oauth/token'))
      .send({ accessToken: supplied, refreshToken: 'supplied-rt', device: descriptor() });
    expect(res.status).toBe(200);
    expect(mockAnonAuth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'supplied-rt' });
    expect(res.body).toMatchObject({ accessToken: rotated.access_token, refreshToken: 'rotated-rt', sessionId: SID2, device: { deviceId: DEVICE_ID } });
    const row = findRow('AuthSession', SID2);
    expect(row).toMatchObject({ bound_at_issue: true });
    expect(row.refresh_token_hash).toBe(authSessionService.hashToken('rotated-rt'));
  });
});

// ---------------------------------------------------------------------------
// 9. Security review — S6: /oauth/token must not become a binding bypass.
//    Its "credential" is an access+refresh pair, i.e. exactly what a token
//    thief holds. A re-presented pair may not re-point an already-bound
//    session at another key, nor rotate the device row onto that key.
// ---------------------------------------------------------------------------
describe('POST /api/users/oauth/token — cannot rebind an existing bound session (S6)', () => {
  const STEP_KEY = { kty: 'EC', crv: 'P-256', x: 'step-x', y: 'step-y' };

  function stolenPair() {
    // A session that was bound to KEY at login and is already in the registry.
    seedBoundSession({
      refresh: 'victim-rt',
      deviceOverrides: { step_key_jwk: STEP_KEY, step_key_enrolled_via: 'interactive' },
    });
    const rotated = supaSession({ sub: UID, session_id: SID, refresh: 'rotated-rt' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: rotated, user: { id: UID } }, error: null });
    return { supplied: jwtFor({ sub: UID, session_id: SID }), rotated };
  }

  test('attacker key + victim deviceId → 401 DEVICE_MISMATCH; binding, step-up key and device row survive', async () => {
    const { supplied, rotated } = stolenPair();
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY2, '/api/users/oauth/token'))
      .set('x-client-platform', 'ios')
      .send({ accessToken: supplied, refreshToken: 'victim-rt', device: descriptor() });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'DEVICE_MISMATCH' });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    // The device row keeps the legitimate key, its enrolled step-up key and its id.
    const device = findRow('AuthDevice', DEV_ROW);
    expect(device.key_thumbprint).toBe(KEY.thumbprint);
    expect(device.step_key_jwk).toEqual(STEP_KEY);
    expect(device.revoked_at).toBeNull();
    // No second device row was created for the attacker's key.
    expect(getTable('AuthDevice')).toHaveLength(1);
    // The session stays pointed at the real device (mismatch handling revokes it).
    const session = findRow('AuthSession', SID);
    expect(session.device_id).toBe(DEV_ROW);
    expect(session.revoked_reason).toBe('mismatch');
    // The pair GoTrue minted for the attacker is revoked, not handed out.
    expect(adminSignOut).toHaveBeenCalledWith(rotated.access_token, 'local');
    expect(events('device_mismatch')).toHaveLength(1);
  });

  test('no DPoP proof at all is refused the same way', async () => {
    const { supplied } = stolenPair();
    const res = await request(app)
      .post('/api/users/oauth/token')
      .send({ accessToken: supplied, refreshToken: 'victim-rt', device: descriptor() });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
    expect(findRow('AuthDevice', DEV_ROW).key_thumbprint).toBe(KEY.thumbprint);
  });

  test('a brand-new deviceId cannot take the session either', async () => {
    const { supplied } = stolenPair();
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY2, '/api/users/oauth/token'))
      .send({ accessToken: supplied, refreshToken: 'victim-rt', device: descriptor({ deviceId: DEVICE_ID2 }) });
    expect(res.status).toBe(401);
    expect(findRow('AuthSession', SID).device_id).toBe(DEV_ROW);
    expect(getTable('AuthDevice')).toHaveLength(1);
  });

  test('the device that really holds the key still refreshes its pair through /oauth/token', async () => {
    const { supplied, rotated } = stolenPair();
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY, '/api/users/oauth/token'))
      .send({ accessToken: supplied, refreshToken: 'victim-rt', device: descriptor() });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe(rotated.access_token);
    const session = findRow('AuthSession', SID);
    expect(session.device_id).toBe(DEV_ROW);
    expect(session.revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW).key_thumbprint).toBe(KEY.thumbprint);
  });

  test('a restored session is not promoted to interactive by re-presenting its pair', async () => {
    seedBoundSession({ context: 'restored', refresh: 'victim-rt' });
    const rotated = supaSession({ sub: UID, session_id: SID, refresh: 'rotated-rt' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: rotated, user: { id: UID } }, error: null });
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY, '/api/users/oauth/token'))
      .send({ accessToken: jwtFor({ sub: UID, session_id: SID }), refreshToken: 'victim-rt', device: descriptor() });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID).context).toBe('restored');
    expect(res.body.session).toEqual({ id: SID, context: 'restored' });
  });

  test('AUTH_DEVICE_BINDING=off: the kill switch still lets the pair through and keeps the existing binding', async () => {
    process.env.AUTH_DEVICE_BINDING = 'off';
    const { supplied } = stolenPair();
    const res = await request(app)
      .post('/api/users/oauth/token')
      .send({ accessToken: supplied, refreshToken: 'victim-rt', device: descriptor() });
    expect(res.status).toBe(200);
    const session = findRow('AuthSession', SID);
    expect(session.device_id).toBe(DEV_ROW);
    expect(session.bound_at_issue).toBe(true);
  });

  test('a fresh OAuth pair (no registry row yet) still binds normally', async () => {
    seedTable('AuthDevice', []);
    seedTable('AuthSession', []);
    const rotated = supaSession({ sub: UID, session_id: SID2, refresh: 'rotated-rt' });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: rotated, user: { id: UID } }, error: null });
    const res = await request(app)
      .post('/api/users/oauth/token')
      .set('DPoP', await proof(KEY, '/api/users/oauth/token'))
      .set('x-client-platform', 'ios')
      .send({ accessToken: jwtFor({ sub: UID, session_id: SID2 }), refreshToken: 'fresh-rt', device: descriptor() });
    expect(res.status).toBe(200);
    expect(res.body.device).toMatchObject({ deviceId: DEVICE_ID, isNew: true });
    expect(findRow('AuthSession', SID2)).toMatchObject({ bound_at_issue: true });
  });
});

// ---------------------------------------------------------------------------
// 10. Security review — S7: `X-Token-Transport: cookie` is client-declared and
//     must not, on its own, buy an opt-out from AUTH_DEVICE_BINDING=required.
// ---------------------------------------------------------------------------
describe('POST /api/users/refresh — the web exemption cannot be spoofed (S7)', () => {
  const NEW_RT2 = 'rt-2';

  function refreshOk(sessionId = SID) {
    const next = supaSession({ session_id: sessionId, refresh: NEW_RT2 });
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: next, user: { id: UID } }, error: null });
    return next;
  }

  /** Presents the stolen token exactly as a browser would (cookie + header). */
  function asWeb(extraHeaders = {}) {
    let r = request(app)
      .post('/api/users/refresh')
      .set('x-token-transport', 'cookie')
      .set('Cookie', ['pantopus_refresh=rt-1']);
    Object.entries(extraHeaders).forEach(([k, v]) => { r = r.set(k, v); });
    return r;
  }

  beforeEach(() => {
    process.env.AUTH_DEVICE_BINDING = 'required';
  });

  test('a session issued to a native client is refused even when the caller declares cookie transport', async () => {
    seedTable('AuthSession', [sessionRow({
      refresh_token_hash: authSessionService.hashToken('rt-1'),
      user_agent: 'okhttp/4.12.0',
    })]);
    refreshOk();
    const res = await asWeb().send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
    expect(mockAnonAuth.refreshSession).not.toHaveBeenCalled();
  });

  test('same for an iOS user agent (CFNetwork/Darwin)', async () => {
    seedTable('AuthSession', [sessionRow({
      refresh_token_hash: authSessionService.hashToken('rt-1'),
      user_agent: 'Pantopus/1.4.0 CFNetwork/1494 Darwin/23.4.0',
    })]);
    refreshOk();
    const res = await asWeb().send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('native markers on the request deny the exemption: X-Client-Platform', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await asWeb({ 'x-client-platform': 'ios' }).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('native markers on the request deny the exemption: X-Device-Id', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await asWeb({ 'x-device-id': DEVICE_ID }).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('native markers in the body deny the exemption: deviceId', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt-1') })]);
    refreshOk();
    const res = await asWeb().send({ deviceId: DEVICE_ID });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('a pre-registry session (no row) with native markers is refused too', async () => {
    seedTable('AuthSession', []);
    refreshOk();
    const res = await asWeb({ 'x-client-platform': 'android' }).send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DPOP_REQUIRED');
  });

  test('a genuine browser session still refreshes (browser user agent, no native markers)', async () => {
    seedTable('AuthSession', [sessionRow({
      refresh_token_hash: authSessionService.hashToken('rt-1'),
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    })]);
    refreshOk();
    const res = await asWeb().send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, sessionId: SID });
  });

  test('a bound session is refused with DEVICE_MISMATCH regardless of the declared transport', async () => {
    seedBoundSession();
    refreshOk();
    const res = await asWeb().send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('DEVICE_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// 11. Security review — S8: POST /reset-password accepts a JWT, but only the
//     one a recovery link mints. An ordinary application access token must not
//     be a "set a new password" credential (that is what /password is, and it
//     asks for the current password).
// ---------------------------------------------------------------------------
describe('POST /api/users/reset-password — the JWT branch only accepts recovery sessions (S8)', () => {
  const NEW_PW = 'brand-new-password-1';
  let updateUserById;

  function jwtWith({ session_id = SID3, amr } = {}) {
    const iat = Math.floor(Date.now() / 1000);
    const payload = { sub: UID, session_id, iat, exp: iat + 3600 };
    if (amr) payload.amr = amr;
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
  }

  beforeEach(() => {
    updateUserById = jest.fn().mockResolvedValue({ data: { user: { id: UID } }, error: null });
    setAuthMocks({ adminUpdateUserById: updateUserById });
    seedTable('AuthSession', [sessionRow(), sessionRow({ id: SID2 })]);
  });

  test('a stolen access token whose session is in the registry is refused; nothing is changed', async () => {
    const stolen = jwtWith({ session_id: SID });
    const res = await request(app).post('/api/users/reset-password').send({ token: stolen, newPassword: NEW_PW });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired reset token');
    expect(updateUserById).not.toHaveBeenCalled();
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('User', UID).sessions_valid_after).toBeFalsy();
  });

  test('an amr that names a normal sign-in method is refused even for an unregistered session', async () => {
    for (const method of ['password', 'oauth', 'id_token', 'totp']) {
      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ token: jwtWith({ amr: [{ method, timestamp: Math.floor(Date.now() / 1000) }] }), newPassword: NEW_PW });
      expect(res.status).toBe(400);
    }
    expect(updateUserById).not.toHaveBeenCalled();
  });

  test('a resume-grant (restored) session token is refused', async () => {
    addRows('AuthSession', [sessionRow({ id: SID3, context: 'restored', auth_method: 'resume_grant' })]);
    const res = await request(app)
      .post('/api/users/reset-password')
      .send({ token: jwtWith({ session_id: SID3, amr: [{ method: 'magiclink' }] }), newPassword: NEW_PW });
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  test('a genuine recovery JWT still resets the password and signs everything out', async () => {
    const recoveryJwt = jwtWith({ session_id: SID3, amr: [{ method: 'recovery', timestamp: Math.floor(Date.now() / 1000) }] });
    const res = await request(app).post('/api/users/reset-password').send({ token: recoveryJwt, newPassword: NEW_PW });
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(UID, { password: NEW_PW });
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'password_reset' });
    expect(findRow('User', UID).sessions_valid_after).toBeTruthy();
  });

  test('the token_hash (verifyOtp) branch is unaffected', async () => {
    const recovery = supaSession({ session_id: SID3, refresh: 'rec-rt' });
    mockAnonAuth.verifyOtp.mockResolvedValue({ data: { session: recovery, user: { id: UID } }, error: null });
    mockAnonAuth.setSession.mockResolvedValue({ error: null });
    mockAnonAuth.updateUser.mockResolvedValue({ error: null });
    const res = await request(app).post('/api/users/reset-password').send({ token: 'recovery-hash-token', newPassword: NEW_PW });
    expect(res.status).toBe(200);
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'password_reset' });
  });
});

// ---------------------------------------------------------------------------
// 12. Security review — S4 follow-up: reuse detection must key off GoTrue's
//     structured `code`, and the legacy message regex must not fire when a
//     code is present (it is both fragile and far too broad — "... not found"
//     appears in plenty of unrelated errors, and each false positive revokes a
//     live session, flags the device and mails the user).
// ---------------------------------------------------------------------------
describe('POST /api/users/refresh — TOKEN_REUSE keys off the structured code (S4)', () => {
  function refreshFails(error) {
    mockAnonAuth.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error });
  }

  async function refresh() {
    return request(app)
      .post('/api/users/refresh')
      .set('DPoP', await proof(KEY, '/api/users/refresh', { refreshToken: 'rt-1' }))
      .send({ refreshToken: 'rt-1' });
  }

  test.each(['refresh_token_already_used', 'refresh_token_not_found'])(
    'code %s → TOKEN_REUSE whatever the message says',
    async (code) => {
      seedBoundSession();
      refreshFails({ code, message: 'an unrelated wording the regex would miss' });
      const res = await refresh();
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_REUSE');
      expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'reuse' });
    }
  );

  test('a non-reuse code whose message merely contains "not found" is NOT punished', async () => {
    seedBoundSession();
    refreshFails({ code: 'over_request_rate_limit', message: 'upstream user profile not found' });
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ require_step_up: false, trust_level: 'trusted' });
    expect(events('refresh_reuse')).toHaveLength(0);
  });

  test('older GoTrue releases with no code still fall back to the message regex', async () => {
    seedBoundSession();
    refreshFails({ message: 'Invalid Refresh Token: Already Used' });
    const res = await refresh();
    expect(res.body.code).toBe('TOKEN_REUSE');
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'reuse' });
  });
});

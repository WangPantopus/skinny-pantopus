// ============================================================
// services/authDeviceService.js + services/authSessionService.js
// (docs/persistent-login/CONTRACT.md, design §6.3 / §7 / §12 / §13)
//
//   1. bindAtIssue        — bound / unbound / mode off / new-device email /
//                            key rotation supersedes old sessions
//   2. refresh matrix     — pre-registry, unbound-legacy before/after
//                            DPOP_CUTOVER, bound-match, mismatch (wrong key /
//                            no proof / rth), revoked (per reason), device
//                            revoked, inactive (trusted 90 d / unverified 30 d),
//                            mode off/required, resolution order, TOKEN_REUSE
//                            side effects, recordRefresh persistence + adoption
//   3. resume grants      — mint → redeem (restored context, lineage,
//                            supersede, new grant) → single-use, expiry,
//                            revoked, software key, iOS, prefs off, env off,
//                            banned user
//   4. step-up device_key — enrol rules, signature over challenge, one-shot
//                            challenge, restored session / restored-enrolled
//                            key refused, methods list
//   5. registry ops       — registerDevice (409 unbound / mismatch / ok +
//                            push linkage + android grant), revokeDevice,
//                            revokeOthers, revokeAll (watermark), logoutLocal
//                            proof rules, security prefs
// ============================================================

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
const jose = require('jose');
const { resetTables, seedTable, getTable, setAuthMocks } = require('./__mocks__/supabaseAdmin');
const pushService = require('./__mocks__/pushService');
const emailService = require('../services/emailService');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('../services/authSessionService');
const authDeviceService = require('../services/authDeviceService');
const dpopMw = require('../middleware/dpop');

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const OTHER_UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const SID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const SID3 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const DEVICE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';   // client uuid
const DEVICE_ID2 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const DEV_ROW = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';     // AuthDevice.id
const DEV_ROW2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwtFor({ sub = UID, session_id = SID, iat = Math.floor(Date.now() / 1000) } = {}) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, session_id, iat, exp: iat + 3600, aal: 'aal1' })}.sig`;
}

function supabaseSession({ sub = UID, session_id = SID, refresh = 'rt-' + crypto.randomBytes(8).toString('hex') } = {}) {
  return {
    access_token: jwtFor({ sub, session_id }),
    refresh_token: refresh,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

async function makeKey() {
  const kp = await jose.generateKeyPair('ES256', { extractable: true });
  const pub = await jose.exportJWK(kp.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y };
  const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');
  return { kp, jwk, thumbprint };
}

/** A verified-proof object as middleware/dpop.js would set on req.dpop. */
function dpopFor(key, { rth = null, refreshToken } = {}) {
  return {
    jwk: key.jwk,
    thumbprint: key.thumbprint,
    jti: crypto.randomUUID(),
    htm: 'POST',
    htu: 'https://api.test.local/x',
    rth: refreshToken ? dpopMw.refreshTokenHash(refreshToken) : rth,
  };
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

function fakeReq({ headers = {}, ip = '203.0.113.7' } = {}) {
  const lower = { 'user-agent': 'Pantopus/1.4 CFNetwork Darwin', 'x-client-platform': 'ios' };
  Object.entries(headers).forEach(([k, v]) => { lower[k.toLowerCase()] = v; });
  return {
    method: 'POST',
    originalUrl: '/api/users/refresh',
    ip,
    headers: lower,
    cookies: {},
    get(name) { return lower[String(name).toLowerCase()]; },
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

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
const findRow = (table, id) => getTable(table).find((r) => r.id === id);
const events = () => getTable('AuthSecurityEvent').map((e) => e.type);

let KEY;
let KEY2;

beforeAll(async () => {
  KEY = await makeKey();
  KEY2 = await makeKey();
});

beforeEach(() => {
  resetTables();
  delete process.env.AUTH_DEVICE_BINDING;
  delete process.env.AUTH_RESUME_GRANTS;
  delete process.env.DPOP_CUTOVER;
  delete process.env.AUTH_INACTIVITY_DAYS_TRUSTED;
  delete process.env.AUTH_INACTIVITY_DAYS_UNVERIFIED;
  process.env.STEP_UP_SECRET = 'test-step-up-secret';
  authPolicy._resetForTests();
  seedTable('User', [{ id: UID, email: 'ying@example.com', first_name: 'Ying', security_prefs: {} }]);
  mockAnonAuth.verifyOtp.mockReset();
  mockAnonAuth.signInWithPassword.mockReset();
});

// ===========================================================================
// 1. bindAtIssue
// ===========================================================================

describe('bindAtIssue', () => {
  test('device + DPoP → AuthDevice upserted, AuthSession bound_at_issue, event, new-device email', async () => {
    const session = supabaseSession();
    const out = await authDeviceService.bindAtIssue({
      userId: UID, session, device: descriptor(), dpop: dpopFor(KEY), req: fakeReq(), authMethod: 'password',
    });
    expect(out.sessionId).toBe(SID);
    expect(out.session).toEqual({ id: SID, context: 'interactive' });
    expect(out.device).toMatchObject({ deviceId: DEVICE_ID, isNew: true, trustLevel: 'trusted' });
    expect(out.device.id).toBeTruthy();

    const dev = getTable('AuthDevice')[0];
    expect(dev).toMatchObject({
      user_id: UID, device_id: DEVICE_ID, platform: 'ios', key_thumbprint: KEY.thumbprint,
      key_backing: 'secure_enclave', trust_level: 'trusted', attestation_level: 'none', revoked_at: null,
    });
    expect(dev.public_key_jwk).toEqual(KEY.jwk);
    expect(dev.trusted_at).toBeTruthy();

    const row = findRow('AuthSession', SID);
    expect(row).toMatchObject({
      user_id: UID, device_id: dev.id, context: 'interactive', auth_method: 'password', bound_at_issue: true,
      refresh_token_hash: authSessionService.hashToken(session.refresh_token), revoked_at: null,
    });
    expect(row.last_ip).toBe('203.0.113.7');

    expect(events()).toEqual(expect.arrayContaining(['login', 'new_device_email_sent']));
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail.mock.calls[0][0]).toMatchObject({ to: 'ying@example.com' });
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/New sign-in/);
    expect(emailService.sendEmail.mock.calls[0][0].html).toContain('https://pantopus.com/app/settings/security');
    // push goes to the OTHER devices only
    expect(pushService.sendToUserExcludingDevice).toHaveBeenCalledWith(UID, DEVICE_ID, expect.any(Object));
  });

  test('software key / no OS lock → trust unverified', async () => {
    const out = await authDeviceService.bindAtIssue({
      userId: UID, session: supabaseSession(), device: descriptor({ keyBacking: 'software' }), dpop: dpopFor(KEY), req: fakeReq(),
    });
    expect(out.device.trustLevel).toBe('unverified');
    const out2 = await authDeviceService.bindAtIssue({
      userId: UID, session: supabaseSession({ session_id: SID2 }), device: descriptor({ deviceId: DEVICE_ID2, hasOsLock: false }), dpop: dpopFor(KEY2), req: fakeReq(),
    });
    expect(out2.device.trustLevel).toBe('unverified');
  });

  test('no device descriptor (web / legacy) → unbound AuthSession row, no device', async () => {
    const out = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), req: fakeReq(), authMethod: 'password' });
    expect(out.device).toBeNull();
    expect(getTable('AuthDevice')).toHaveLength(0);
    expect(findRow('AuthSession', SID)).toMatchObject({ device_id: null, bound_at_issue: false });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('device without a DPoP proof is NOT bound (bind requires the key)', async () => {
    const out = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), device: descriptor(), dpop: null, req: fakeReq() });
    expect(out.device).toBeNull();
    expect(getTable('AuthDevice')).toHaveLength(0);
    expect(findRow('AuthSession', SID).bound_at_issue).toBe(false);
  });

  test('AUTH_DEVICE_BINDING=off → never binds, still records the session', async () => {
    process.env.AUTH_DEVICE_BINDING = 'off';
    const out = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    expect(out.device).toBeNull();
    expect(getTable('AuthDevice')).toHaveLength(0);
    expect(findRow('AuthSession', SID)).toBeTruthy();
  });

  test('second login on the same key → isNew=false, no second email; new key on the same deviceId supersedes old sessions', async () => {
    await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    const again = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession({ session_id: SID2 }), device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    expect(again.device.isNew).toBe(false);
    expect(getTable('AuthDevice')).toHaveLength(1);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    // Same client deviceId, different key (e.g. SE blob lost → regenerated)
    const rotated = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession({ session_id: SID3 }), device: descriptor(), dpop: dpopFor(KEY2), req: fakeReq() });
    expect(rotated.device.isNew).toBe(true);
    expect(getTable('AuthDevice')).toHaveLength(1);
    expect(getTable('AuthDevice')[0].key_thumbprint).toBe(KEY2.thumbprint);
    expect(findRow('AuthSession', SID).revoked_reason).toBe('superseded');
    expect(findRow('AuthSession', SID2).revoked_reason).toBe('superseded');
    expect(findRow('AuthSession', SID3).revoked_at).toBeNull();
    expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
  });

  test('a revoked device signing in again with a credential re-enrols (revoked_at cleared)', async () => {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, revoked_at: daysAgo(1), revoked_reason: 'user', trust_level: 'suspect', require_step_up: true })]);
    const out = await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    expect(out.device.isNew).toBe(true);
    const dev = findRow('AuthDevice', DEV_ROW);
    expect(dev.revoked_at).toBeNull();
    expect(dev.require_step_up).toBe(false);
    expect(dev.trust_level).toBe('trusted');
  });

  test('security_prefs.newDeviceEmail=false suppresses the email but keeps the event + push', async () => {
    seedTable('User', [{ id: UID, email: 'ying@example.com', first_name: 'Ying', security_prefs: { newDeviceEmail: false } }]);
    await authDeviceService.bindAtIssue({ userId: UID, session: supabaseSession(), device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(events()).toContain('login');
    expect(pushService.sendToUserExcludingDevice).toHaveBeenCalled();
  });

  test('never throws: a registry failure does not fail the login', async () => {
    const out = await authDeviceService.bindAtIssue({ userId: UID, session: { access_token: 'garbage' }, device: descriptor(), dpop: dpopFor(KEY), req: fakeReq() });
    expect(out.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.session.context).toBe('interactive');
  });
});

// ===========================================================================
// 2. refresh matrix
// ===========================================================================

describe('checkRefresh — resolution', () => {
  test('resolves by refresh_token_hash first, then prev hash, then sessionId, then access token claim', async () => {
    const rt = 'rt-current';
    const prev = 'rt-previous';
    seedTable('AuthSession', [
      sessionRow({ id: SID, refresh_token_hash: authSessionService.hashToken(rt), prev_refresh_token_hash: authSessionService.hashToken(prev) }),
      sessionRow({ id: SID2 }),
    ]);
    expect(await authDeviceService.resolveSessionForRefresh({ refreshToken: rt })).toMatchObject({ matchedBy: 'hash', session: { id: SID } });
    expect(await authDeviceService.resolveSessionForRefresh({ refreshToken: prev })).toMatchObject({ matchedBy: 'prev_hash', session: { id: SID } });
    expect(await authDeviceService.resolveSessionForRefresh({ refreshToken: 'unknown', sessionId: SID2 })).toMatchObject({ matchedBy: 'session_id', session: { id: SID2 } });
    expect(await authDeviceService.resolveSessionForRefresh({ refreshToken: 'unknown', accessToken: jwtFor({ session_id: SID2 }) })).toMatchObject({ matchedBy: 'access_token', session: { id: SID2 } });
    expect(await authDeviceService.resolveSessionForRefresh({ refreshToken: 'unknown', sessionId: 'not-a-uuid' })).toEqual({ session: null, matchedBy: null });
  });
});

describe('checkRefresh — legacy / unbound', () => {
  test('pre-registry session (no row): optional → ok legacy; required → DPOP_REQUIRED; off → ok', async () => {
    const r1 = await authDeviceService.checkRefresh({ refreshToken: 'x', req: fakeReq() });
    expect(r1).toMatchObject({ ok: true, session: null, device: null, legacy: true, adopt: false });

    process.env.AUTH_DEVICE_BINDING = 'required';
    const r2 = await authDeviceService.checkRefresh({ refreshToken: 'x', req: fakeReq() });
    expect(r2).toMatchObject({ ok: false, status: 401, code: 'DPOP_REQUIRED' });

    process.env.AUTH_DEVICE_BINDING = 'off';
    expect((await authDeviceService.checkRefresh({ refreshToken: 'x', req: fakeReq() })).ok).toBe(true);
  });

  test('unbound row without DPoP is accepted while optional (web / legacy mobile)', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt') })]);
    const r = await authDeviceService.checkRefresh({ refreshToken: 'rt', req: fakeReq() });
    expect(r).toMatchObject({ ok: true, legacy: true, adopt: false, matchedBy: 'hash' });
    expect(r.session.id).toBe(SID);
  });

  test('unbound row + DPoP: adoption only when bound_at_issue=false AND issued_at < DPOP_CUTOVER', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt'), issued_at: daysAgo(10) })]);
    // default cutover = far future → nothing adopted... wait: issued_at < 9999 is true → adopt allowed by default?
    // CONTRACT: "default = far future so nothing is adopted until set" — the default cutover therefore
    // means adoption is allowed for sessions issued before it, i.e. all pre-registry sessions.
    // We pin the behaviour explicitly by env in the assertions below.
    process.env.DPOP_CUTOVER = daysAgo(20); // cutover before issuance → NOT adoptable
    let r = await authDeviceService.checkRefresh({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), req: fakeReq() });
    expect(r).toMatchObject({ ok: true, legacy: true, adopt: false });

    process.env.DPOP_CUTOVER = daysAgo(5); // cutover after issuance → adoptable
    r = await authDeviceService.checkRefresh({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), req: fakeReq() });
    expect(r).toMatchObject({ ok: true, legacy: true, adopt: true });

    // bound_at_issue=true is never adopted even before the cutover
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt'), issued_at: daysAgo(10), bound_at_issue: true })]);
    r = await authDeviceService.checkRefresh({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), req: fakeReq() });
    expect(r.adopt).toBe(false);
  });

  test('unbound row in required mode → DPOP_REQUIRED', async () => {
    process.env.AUTH_DEVICE_BINDING = 'required';
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('rt') })]);
    const r = await authDeviceService.checkRefresh({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, code: 'DPOP_REQUIRED' });
  });
});

describe('checkRefresh — bound sessions', () => {
  const RT = 'rt-bound';
  function seedBound(devOverrides = {}, sessOverrides = {}) {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, ...devOverrides })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, refresh_token_hash: authSessionService.hashToken(RT), ...sessOverrides })]);
  }

  test('bound-match: proof from the bound key with matching rth → ok, no side effects', async () => {
    seedBound();
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
    expect(r).toMatchObject({ ok: true, legacy: false, adopt: false });
    expect(r.device.id).toBe(DEV_ROW);
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(events()).toEqual([]);
  });

  test('mismatch (different key) → 401 DEVICE_MISMATCH, session revoked, device suspect + require_step_up, grants revoked, event, email', async () => {
    seedBound();
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'h', expires_at: daysAgo(-10), used_at: null, revoked_at: null }]);
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY2, { refreshToken: RT }), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, status: 401, code: 'DEVICE_MISMATCH' });
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'mismatch' });
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ trust_level: 'suspect', require_step_up: true });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(events()).toEqual(expect.arrayContaining(['device_mismatch', 'security_signout_email_sent']));
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/signed out a device/);
  });

  test('bound session with NO proof at all → DEVICE_MISMATCH (a bound client always proves)', async () => {
    seedBound();
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: null, req: fakeReq() });
    expect(r.code).toBe('DEVICE_MISMATCH');
    expect(findRow('AuthSession', SID).revoked_reason).toBe('mismatch');
  });

  test('right key but rth for a different token / missing rth → DEVICE_MISMATCH', async () => {
    seedBound();
    let r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: 'someone-elses-token' }), req: fakeReq() });
    expect(r.code).toBe('DEVICE_MISMATCH');
    seedBound();
    r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY), req: fakeReq() });
    expect(r.code).toBe('DEVICE_MISMATCH');
  });

  test('revoked session → code derived from the reason', async () => {
    const cases = [
      ['logout', 'SESSION_REVOKED'], ['user', 'SESSION_REVOKED'], ['lockdown', 'SESSION_REVOKED'], ['password_change', 'SESSION_REVOKED'],
      ['reuse', 'TOKEN_REUSE'], ['device_revoked', 'DEVICE_REVOKED'], ['superseded', 'DEVICE_REVOKED'], ['inactivity', 'SESSION_EXPIRED_INACTIVE'],
    ];
    for (const [reason, code] of cases) {
      seedBound({}, { revoked_at: daysAgo(1), revoked_reason: reason });
      const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
      expect(r).toMatchObject({ ok: false, status: 401, code });
    }
  });

  test('device revoked → DEVICE_REVOKED and the session row is revoked with reason device_revoked', async () => {
    seedBound({ revoked_at: daysAgo(1), revoked_reason: 'user' });
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
    expect(r.code).toBe('DEVICE_REVOKED');
    expect(findRow('AuthSession', SID).revoked_reason).toBe('device_revoked');
  });

  test('bound row whose device cannot be loaded → 503 AUTH_UNAVAILABLE (never a security wipe, never legacy)', async () => {
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW2, bound_at_issue: true, refresh_token_hash: authSessionService.hashToken(RT) })]);
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, status: 503, code: 'AUTH_UNAVAILABLE' });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('inactivity: trusted 90 d / unverified 30 d, measured from last_refresh_at (or issued_at)', async () => {
    // trusted, idle 89 d → ok
    seedBound({ trust_level: 'trusted' }, { last_refresh_at: daysAgo(89) });
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() })).ok).toBe(true);
    // trusted, idle 91 d → SESSION_EXPIRED_INACTIVE + row revoked + event
    seedBound({ trust_level: 'trusted' }, { last_refresh_at: daysAgo(91) });
    let r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, code: 'SESSION_EXPIRED_INACTIVE' });
    expect(findRow('AuthSession', SID).revoked_reason).toBe('inactivity');
    expect(events()).toContain('inactivity_expired');
    // unverified, idle 31 d → expired
    seedBound({ trust_level: 'unverified' }, { last_refresh_at: daysAgo(31) });
    r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() });
    expect(r.code).toBe('SESSION_EXPIRED_INACTIVE');
    // unverified, idle 29 d → ok
    seedBound({ trust_level: 'unverified' }, { last_refresh_at: daysAgo(29) });
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() })).ok).toBe(true);
    // never refreshed → issued_at is the reference
    seedBound({ trust_level: 'trusted' }, { last_refresh_at: null, issued_at: daysAgo(100) });
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() })).code).toBe('SESSION_EXPIRED_INACTIVE');
    // env override
    process.env.AUTH_INACTIVITY_DAYS_TRUSTED = '7';
    seedBound({ trust_level: 'trusted' }, { last_refresh_at: daysAgo(8) });
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY, { refreshToken: RT }), req: fakeReq() })).code).toBe('SESSION_EXPIRED_INACTIVE');
    // unbound web session is measured with the unverified window
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken(RT), last_refresh_at: daysAgo(31) })]);
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, req: fakeReq() })).code).toBe('SESSION_EXPIRED_INACTIVE');
  });

  test('inactivity is checked BEFORE the proof (order: revoked → inactivity → proof)', async () => {
    seedBound({}, { last_refresh_at: daysAgo(200) });
    const r = await authDeviceService.checkRefresh({ refreshToken: RT, dpop: dpopFor(KEY2, { refreshToken: RT }), req: fakeReq() });
    expect(r.code).toBe('SESSION_EXPIRED_INACTIVE');
    expect(findRow('AuthDevice', DEV_ROW).trust_level).toBe('trusted'); // no mismatch side effects
  });

  test('AUTH_DEVICE_BINDING=off: bound session refreshes without any proof (kill switch) but revocation still applies', async () => {
    process.env.AUTH_DEVICE_BINDING = 'off';
    seedBound();
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, req: fakeReq() })).ok).toBe(true);
    seedBound({}, { revoked_at: daysAgo(1), revoked_reason: 'logout' });
    expect((await authDeviceService.checkRefresh({ refreshToken: RT, req: fakeReq() })).code).toBe('SESSION_REVOKED');
  });
});

describe('markReuse (TOKEN_REUSE branch)', () => {
  test('revokes the session (reuse), flags the device suspect + require_step_up, revokes grants, event, email + push to others', async () => {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true })]);
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'h', expires_at: daysAgo(-10), used_at: null, revoked_at: null }]);
    const listener = jest.fn();
    authSessionService.authEvents.on('session_revoked', listener);
    try {
      await authDeviceService.markReuse({ session: findRow('AuthSession', SID), req: fakeReq() });
    } finally {
      authSessionService.authEvents.off('session_revoked', listener);
    }
    expect(findRow('AuthSession', SID).revoked_reason).toBe('reuse');
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ trust_level: 'suspect', require_step_up: true });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(events()).toEqual(expect.arrayContaining(['refresh_reuse', 'security_signout_email_sent']));
    expect(listener).toHaveBeenCalledWith({ userId: UID, sessionIds: [SID], reason: 'reuse' });
    expect(pushService.sendToUserExcludingDevice).toHaveBeenCalledWith(UID, DEVICE_ID, expect.objectContaining({ data: expect.objectContaining({ event: 'security_signout' }) }));
  });

  test('is a no-op for an unresolved (pre-registry) session', async () => {
    await expect(authDeviceService.markReuse({ session: null, req: fakeReq() })).resolves.toBeUndefined();
    expect(events()).toEqual([]);
  });
});

describe('recordRefresh', () => {
  test('bound session: persists prev/current hashes, last_refresh_at, ip; touches the device', async () => {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, last_seen_at: daysAgo(3) })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, refresh_token_hash: authSessionService.hashToken('old') })]);
    const newSession = supabaseSession({ refresh: 'new' });
    const out = await authDeviceService.recordRefresh({ session: findRow('AuthSession', SID), newSession, oldRefreshToken: 'old', req: fakeReq({ ip: '198.51.100.2' }) });
    expect(out).toEqual({ sessionId: SID, session: { id: SID, context: 'interactive' }, device: null });
    const row = findRow('AuthSession', SID);
    expect(row.refresh_token_hash).toBe(authSessionService.hashToken('new'));
    expect(row.prev_refresh_token_hash).toBe(authSessionService.hashToken('old'));
    expect(row.last_refresh_at).toBeTruthy();
    expect(row.last_ip).toBe('198.51.100.2');
    expect(new Date(findRow('AuthDevice', DEV_ROW).last_seen_at).getTime()).toBeGreaterThan(Date.now() - 5000);
    // the old token is still resolvable (crash-between-rotate-and-persist tolerance)
    expect((await authDeviceService.resolveSessionForRefresh({ refreshToken: 'old' })).matchedBy).toBe('prev_hash');
  });

  test('restored session keeps its context in the response', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'restored', refresh_token_hash: authSessionService.hashToken('old') })]);
    const out = await authDeviceService.recordRefresh({ session: findRow('AuthSession', SID), newSession: supabaseSession({ refresh: 'new' }), oldRefreshToken: 'old', req: fakeReq() });
    expect(out.session).toEqual({ id: SID, context: 'restored' });
  });

  test('pre-registry session: creates a legacy row keyed by the new JWT session_id', async () => {
    const newSession = supabaseSession({ refresh: 'new' });
    const out = await authDeviceService.recordRefresh({ session: null, newSession, oldRefreshToken: 'old', req: fakeReq() });
    expect(out.sessionId).toBe(SID);
    const row = findRow('AuthSession', SID);
    expect(row).toMatchObject({ user_id: UID, device_id: null, auth_method: 'legacy', bound_at_issue: false, refresh_token_hash: authSessionService.hashToken('new'), prev_refresh_token_hash: authSessionService.hashToken('old') });
  });

  test('adoption: legacy session + adopt + deviceId → device upserted and the session becomes bound (bound_at_issue stays false)', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('old'), issued_at: daysAgo(10) })]);
    const out = await authDeviceService.recordRefresh({
      session: findRow('AuthSession', SID), newSession: supabaseSession({ refresh: 'new' }), oldRefreshToken: 'old',
      dpop: dpopFor(KEY, { refreshToken: 'old' }), adopt: true, deviceId: DEVICE_ID,
      device: { keyBacking: 'secure_enclave', hasOsLock: true, model: 'iPhone16,2', name: 'Ying' }, req: fakeReq(),
    });
    expect(out.device).toMatchObject({ deviceId: DEVICE_ID, isNew: true, trustLevel: 'trusted' });
    const dev = getTable('AuthDevice')[0];
    expect(dev.key_thumbprint).toBe(KEY.thumbprint);
    expect(dev.platform).toBe('ios'); // from X-Client-Platform
    const row = findRow('AuthSession', SID);
    expect(row.device_id).toBe(dev.id);
    expect(row.bound_at_issue).toBe(false);
    expect(events()).toContain('login');
    // From now on this session needs the proof
    seedTable('AuthDevice', getTable('AuthDevice'));
    const next = await authDeviceService.checkRefresh({ refreshToken: 'new', dpop: null, req: fakeReq() });
    expect(next.code).toBe('DEVICE_MISMATCH');
  });

  test('adoption is skipped without a client deviceId or without a proof', async () => {
    seedTable('AuthSession', [sessionRow({ refresh_token_hash: authSessionService.hashToken('old') })]);
    const out = await authDeviceService.recordRefresh({ session: findRow('AuthSession', SID), newSession: supabaseSession({ refresh: 'new' }), oldRefreshToken: 'old', dpop: dpopFor(KEY), adopt: true, req: fakeReq() });
    expect(out.device).toBeNull();
    expect(getTable('AuthDevice')).toHaveLength(0);
    expect(findRow('AuthSession', SID).device_id).toBeNull();
  });
});

// ===========================================================================
// 3. resume grants
// ===========================================================================

describe('resume grants', () => {
  const ANDROID_KEYS = ['strongbox', 'tee'];
  function androidDescriptor(overrides = {}) {
    return descriptor({ deviceId: DEVICE_ID2, platform: 'android', installId: 'inst00000002', name: 'Pixel 9', model: 'Pixel 9', osVersion: '15', keyBacking: 'strongbox', ...overrides });
  }
  function seedIssuingDevice() {
    seedTable('AuthDevice', [deviceRow({ device_id: DEVICE_ID, platform: 'android', key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, key_backing: 'strongbox', model: 'Pixel 9', install_id: 'inst00000001' })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true })]);
  }
  function mockMint({ sub = UID, session_id = SID2 } = {}) {
    setAuthMocks({
      adminGetUserById: async (id) => ({ data: { user: { id, email: 'ying@example.com', app_metadata: { provider: 'email', providers: ['email'] }, identities: [] } }, error: null }),
      adminGenerateLink: async ({ type, email }) => ({ data: { user: { id: UID, email }, properties: { hashed_token: `hashed-${type}` } }, error: null }),
    });
    const session = supabaseSession({ sub, session_id, refresh: 'rt-restored' });
    mockAnonAuth.verifyOtp.mockResolvedValue({ data: { session, user: { id: sub, email: 'ying@example.com' } }, error: null });
    return session;
  }

  test('mintResumeGrant: 32-byte b64url secret, only the sha256 stored, one live grant per device, 90-day expiry', async () => {
    seedIssuingDevice();
    const first = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    expect(first.grant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.row.grant_hash).toBe(authSessionService.hashToken(first.grant));
    expect(getTable('AuthResumeGrant').some((g) => g.grant_hash === first.grant)).toBe(false);
    const exp = new Date(first.row.expires_at).getTime() - Date.now();
    expect(exp).toBeGreaterThan(89 * 24 * 3600 * 1000);
    expect(exp).toBeLessThan(91 * 24 * 3600 * 1000);

    const second = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    const rows = getTable('AuthResumeGrant');
    expect(rows).toHaveLength(2);
    expect(rows.find((g) => g.id === first.row.id).revoked_at).toBeTruthy();
    expect(rows.find((g) => g.id === second.row.id).revoked_at).toBeNull();
  });

  test('redeem: restored session bound to the new hardware key, lineage recorded, old device superseded, grant used, new grant issued, event, email deduped on lineage+model', async () => {
    seedIssuingDevice();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    const minted = mockMint();
    const res = await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq({ headers: { 'x-client-platform': 'android' } }) });
    expect(res.ok).toBe(true);
    expect(res.supabaseSession).toBe(minted);
    expect(res.sessionId).toBe(SID2);
    expect(res.device).toMatchObject({ deviceId: DEVICE_ID2, isNew: true, trustLevel: 'trusted' });
    expect(res.resumeGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.resumeGrant).not.toBe(grant);

    const newDev = getTable('AuthDevice').find((d) => d.device_id === DEVICE_ID2);
    expect(newDev).toMatchObject({ platform: 'android', key_thumbprint: KEY2.thumbprint, key_backing: 'strongbox', resumed_from_device: DEV_ROW, trusted_at: null });
    expect(newDev.last_resumed_at).toBeTruthy();
    expect(findRow('AuthDevice', DEV_ROW)).toMatchObject({ revoked_reason: 'superseded' });
    expect(findRow('AuthSession', SID)).toMatchObject({ revoked_reason: 'superseded' });
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);

    const sess = findRow('AuthSession', SID2);
    expect(sess).toMatchObject({ user_id: UID, device_id: newDev.id, context: 'restored', auth_method: 'resume_grant', bound_at_issue: true, refresh_token_hash: authSessionService.hashToken('rt-restored') });

    const grants = getTable('AuthResumeGrant');
    expect(grants.find((g) => g.grant_hash === authSessionService.hashToken(grant)).used_at).toBeTruthy();
    expect(grants.find((g) => g.grant_hash === authSessionService.hashToken(res.resumeGrant))).toMatchObject({ device_id: newDev.id, used_at: null, revoked_at: null });
    expect(events()).toContain('resume');
    // same model + proven lineage → no new-device email
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    // verifyOtp used the magiclink hashed token from generateLink
    expect(mockAnonAuth.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hashed-magiclink' });
  });

  test('redeem on a different model emails (lineage alone never dedupes on model mismatch)', async () => {
    seedIssuingDevice();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    mockMint();
    const res = await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor({ model: 'Pixel 10', name: 'Pixel 10' }), dpop: dpopFor(KEY2), req: fakeReq() });
    expect(res.ok).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/New sign-in on Pixel 10/);
  });

  test('single-use: the same grant cannot be redeemed twice', async () => {
    seedIssuingDevice();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    mockMint();
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).ok).toBe(true);
    const again = await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() });
    expect(again).toMatchObject({ ok: false, status: 401, code: 'RESUME_GRANT_INVALID' });
    expect(getTable('AuthSession').filter((s) => s.context === 'restored')).toHaveLength(1);
  });

  test('expired / revoked / unknown grants → RESUME_GRANT_INVALID without minting', async () => {
    seedIssuingDevice();
    mockMint();
    const { grant: expired, row: er } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    getTable('AuthResumeGrant').find((g) => g.id === er.id).expires_at = daysAgo(1);
    expect((await authDeviceService.redeemResumeGrant({ grant: expired, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');

    const { grant: revoked } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    await authSessionService.revokeGrantsForUser(UID);
    expect((await authDeviceService.redeemResumeGrant({ grant: revoked, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');

    expect((await authDeviceService.redeemResumeGrant({ grant: crypto.randomBytes(32).toString('base64url'), device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');
    expect(mockAnonAuth.verifyOtp).not.toHaveBeenCalled();
  });

  test('software key, iOS, or missing DPoP can never redeem a grant', async () => {
    seedIssuingDevice();
    mockMint();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor({ keyBacking: 'software' }), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor({ platform: 'ios', keyBacking: 'secure_enclave' }), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: null, req: fakeReq() })).code).toBe('DPOP_REQUIRED');
    // the grant is still unused after the refusals
    expect(getTable('AuthResumeGrant')[0].used_at).toBeNull();
    for (const kb of ANDROID_KEYS) {
      expect(authDeviceService.RESUME_BACKINGS).toContain(kb);
    }
  });

  test('security_prefs.allowRestoreGrants=false → invalid and every open grant is revoked; AUTH_RESUME_GRANTS=off → invalid', async () => {
    seedIssuingDevice();
    mockMint();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    seedTable('User', [{ id: UID, email: 'ying@example.com', security_prefs: { allowRestoreGrants: false } }]);
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();

    seedTable('User', [{ id: UID, email: 'ying@example.com', security_prefs: {} }]);
    const { grant: g2 } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    process.env.AUTH_RESUME_GRANTS = 'off';
    expect((await authDeviceService.redeemResumeGrant({ grant: g2, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');
  });

  test('banned auth user → invalid; a minted session for a different user is signed out and refused', async () => {
    seedIssuingDevice();
    const { grant } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    setAuthMocks({ adminGetUserById: async (id) => ({ data: { user: { id, email: 'ying@example.com', banned_until: daysAgo(-1) } }, error: null }) });
    expect((await authDeviceService.redeemResumeGrant({ grant, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() })).code).toBe('RESUME_GRANT_INVALID');

    seedTable('AuthResumeGrant', []);
    const { grant: g2 } = await authSessionService.mintResumeGrant(UID, DEV_ROW);
    mockMint({ sub: OTHER_UID });
    const signOutSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    setAuthMocks({ adminSignOut: signOutSpy });
    const res = await authDeviceService.redeemResumeGrant({ grant: g2, device: androidDescriptor(), dpop: dpopFor(KEY2), req: fakeReq() });
    expect(res).toMatchObject({ ok: false, status: 503, code: 'RESUME_UNAVAILABLE' });
    expect(signOutSpy).toHaveBeenCalled();
  });

  test('grantEligible: android + trusted + tee/strongbox + prefs on + env on', async () => {
    const base = deviceRow({ platform: 'android', key_backing: 'strongbox', trust_level: 'trusted' });
    expect(await authDeviceService.grantEligible(UID, base)).toBe(true);
    expect(await authDeviceService.grantEligible(UID, { ...base, platform: 'ios', key_backing: 'secure_enclave' })).toBe(false);
    expect(await authDeviceService.grantEligible(UID, { ...base, trust_level: 'unverified' })).toBe(false);
    expect(await authDeviceService.grantEligible(UID, { ...base, key_backing: 'software' })).toBe(false);
    expect(await authDeviceService.grantEligible(UID, { ...base, revoked_at: daysAgo(1) })).toBe(false);
    expect(await authDeviceService.grantEligible(UID, base, { allowRestoreGrants: false })).toBe(false);
    process.env.AUTH_RESUME_GRANTS = 'off';
    expect(await authDeviceService.grantEligible(UID, base)).toBe(false);
  });
});

// ===========================================================================
// 4. step-up device key
// ===========================================================================

describe('step-up device_key', () => {
  let stepKey; // node KeyObject pair
  let stepJwk;
  beforeAll(() => {
    stepKey = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = stepKey.publicKey.export({ format: 'jwk' });
    stepJwk = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
  });
  const signRaw = (bytes, key = stepKey.privateKey) => crypto.sign('sha256', bytes, { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');

  function seedBoundInteractive(devOverrides = {}, sessOverrides = {}) {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, ...devOverrides })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, context: 'interactive', ...sessOverrides })]);
    return findRow('AuthSession', SID);
  }

  test('enrolStepUpKey: interactive bound session + DPoP from the bound key → step_key_jwk stored with enrolled_via interactive', async () => {
    const sess = seedBoundInteractive();
    const r = await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: stepJwk, keyBacking: 'secure_enclave' });
    expect(r).toEqual({ ok: true });
    const dev = findRow('AuthDevice', DEV_ROW);
    expect(dev.step_key_enrolled_via).toBe('interactive');
    expect(dev.step_key_jwk).toMatchObject({ kty: 'EC', crv: 'P-256', x: stepJwk.x, y: stepJwk.y, keyBacking: 'secure_enclave' });
    expect(events()).toContain('step_up_key_enrolled');
  });

  test('enrolStepUpKey refusals: unbound (409), restored session (403), DPoP from another key (401), bad jwk (400), oauth context is interactive', async () => {
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sessionRow(), dpop: dpopFor(KEY), publicKeyJwk: stepJwk, keyBacking: 'tee' })).code).toBe('DEVICE_NOT_BOUND');
    let sess = seedBoundInteractive({}, { context: 'restored' });
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: stepJwk, keyBacking: 'tee' })).code).toBe('INTERACTIVE_SESSION_REQUIRED');
    sess = seedBoundInteractive();
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY2), publicKeyJwk: stepJwk, keyBacking: 'tee' })).code).toBe('DEVICE_MISMATCH');
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: { kty: 'RSA' }, keyBacking: 'tee' })).status).toBe(400);
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: { ...stepJwk, d: 'secret' }, keyBacking: 'tee' })).status).toBe(400);
    sess = seedBoundInteractive({}, { context: 'oauth' });
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: stepJwk, keyBacking: 'tee' })).ok).toBe(true);
    // A revoked device cannot enrol
    sess = seedBoundInteractive({ revoked_at: daysAgo(1) });
    expect((await authDeviceService.enrolStepUpKey({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), publicKeyJwk: stepJwk, keyBacking: 'tee' })).code).toBe('DEVICE_NOT_BOUND');
  });

  test('challenge: created with purpose + 10-min TTL; consumed once; wrong purpose / expired refused', async () => {
    const c = await authDeviceService.createChallenge('step_up');
    expect(c.challengeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Buffer.from(c.challenge, 'base64url')).toHaveLength(32);
    expect(new Date(c.expiresAt).getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    expect(await authDeviceService.consumeChallenge(c.challengeId, 'resume')).toBeNull();
    expect(await authDeviceService.consumeChallenge(c.challengeId, 'step_up')).toMatchObject({ challenge: c.challenge });
    expect(await authDeviceService.consumeChallenge(c.challengeId, 'step_up')).toBeNull();
    const c2 = await authDeviceService.createChallenge('step_up');
    getTable('AuthChallenge').find((r) => r.id === c2.challengeId).expires_at = daysAgo(1);
    expect(await authDeviceService.consumeChallenge(c2.challengeId, 'step_up')).toBeNull();
  });

  test('verifyStepUpDeviceKey: valid ES256 (raw r||s) signature over the challenge bytes from an interactive session with an interactively-enrolled key', async () => {
    const sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' });
    const c = await authDeviceService.createChallenge('step_up');
    const sig = signRaw(Buffer.from(c.challenge, 'base64url'));
    const r = await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: sig });
    expect(r.ok).toBe(true);
    expect(r.deviceRow.id).toBe(DEV_ROW);
    // challenge is single-use
    const again = await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: sig });
    expect(again).toEqual({ ok: false, reason: 'challenge' });
  });

  test('verifyStepUpDeviceKey refusals: wrong key, wrong bytes, DER signature, restored session, restored-enrolled key, no key, unbound, other user, revoked device', async () => {
    const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    let sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' });
    let c = await authDeviceService.createChallenge('step_up');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: signRaw(Buffer.from(c.challenge, 'base64url'), other.privateKey) })).reason).toBe('signature');
    c = await authDeviceService.createChallenge('step_up');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: signRaw(Buffer.from('other bytes')) })).reason).toBe('signature');
    c = await authDeviceService.createChallenge('step_up');
    const der = crypto.sign('sha256', Buffer.from(c.challenge, 'base64url'), stepKey.privateKey).toString('base64url');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: der })).reason).toBe('signature');

    // restored session → refused before touching the challenge
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' }, { context: 'restored' });
    c = await authDeviceService.createChallenge('step_up');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: signRaw(Buffer.from(c.challenge, 'base64url')) })).reason).toBe('restored_session');
    expect(await authDeviceService.consumeChallenge(c.challengeId, 'step_up')).toBeTruthy(); // untouched

    // key enrolled from a restored session → refused
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'restored' });
    c = await authDeviceService.createChallenge('step_up');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: signRaw(Buffer.from(c.challenge, 'base64url')) })).reason).toBe('no_step_key');

    sess = seedBoundInteractive();
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: 'x' })).reason).toBe('no_step_key');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sessionRow(), challengeId: c.challengeId, signature: 'x' })).reason).toBe('unbound');
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: OTHER_UID, sessionRow: sess, challengeId: c.challengeId, signature: 'x' })).reason).toBe('session_user');
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive', revoked_at: daysAgo(1) });
    expect((await authDeviceService.verifyStepUpDeviceKey({ userId: UID, sessionRow: sess, challengeId: c.challengeId, signature: 'x' })).reason).toBe('device');
  });

  test('availableStepUpMethods: password when the account has one; device_key only for interactive sessions with an interactive key', async () => {
    let sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' });
    expect(await authDeviceService.availableStepUpMethods({ userId: UID, sessionRow: sess })).toEqual(['password', 'device_key']);
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'restored' });
    expect(await authDeviceService.availableStepUpMethods({ userId: UID, sessionRow: sess })).toEqual(['password']);
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' }, { context: 'restored' });
    expect(await authDeviceService.availableStepUpMethods({ userId: UID, sessionRow: sess })).toEqual(['password']);
    setAuthMocks({ adminGetUserById: async (id) => ({ data: { user: { id, app_metadata: { provider: 'apple', providers: ['apple'] }, identities: [{ provider: 'apple' }] } }, error: null }) });
    sess = seedBoundInteractive({ step_key_jwk: stepJwk, step_key_enrolled_via: 'interactive' });
    expect(await authDeviceService.availableStepUpMethods({ userId: UID, sessionRow: sess })).toEqual(['device_key']);
    expect(await authDeviceService.availableStepUpMethods({ userId: UID, sessionRow: null })).toEqual([]);
  });

  test('promoteSessionToInteractive flips restored → interactive only', async () => {
    seedTable('AuthSession', [sessionRow({ context: 'restored' })]);
    expect(await authDeviceService.promoteSessionToInteractive(findRow('AuthSession', SID))).toBe(true);
    expect(findRow('AuthSession', SID).context).toBe('interactive');
    expect(await authDeviceService.promoteSessionToInteractive(findRow('AuthSession', SID))).toBe(false);
  });
});

// ===========================================================================
// 5. registry ops
// ===========================================================================

describe('registerDevice', () => {
  function seedBound(devOverrides = {}) {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, ...devOverrides })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true })]);
    return findRow('AuthSession', SID);
  }

  test('unbound session → 409 DEVICE_NOT_BOUND (never creates a binding)', async () => {
    seedTable('AuthSession', [sessionRow()]);
    const r = await authDeviceService.registerDevice({ userId: UID, sessionRow: findRow('AuthSession', SID), dpop: dpopFor(KEY), device: descriptor(), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, status: 409, code: 'DEVICE_NOT_BOUND' });
    expect(getTable('AuthDevice')).toHaveLength(0);
    const r2 = await authDeviceService.registerDevice({ userId: UID, sessionRow: null, dpop: dpopFor(KEY), device: descriptor(), req: fakeReq() });
    expect(r2.code).toBe('DEVICE_NOT_BOUND');
  });

  test('DPoP thumbprint != bound key → 401 DEVICE_MISMATCH + event, nothing changed', async () => {
    const sess = seedBound();
    const r = await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY2), device: descriptor({ name: 'Evil' }), req: fakeReq() });
    expect(r).toMatchObject({ ok: false, status: 401, code: 'DEVICE_MISMATCH' });
    expect(findRow('AuthDevice', DEV_ROW).name).toBe("Ying's iPhone");
    expect(events()).toContain('device_mismatch');
  });

  test('deviceId that is not the bound device → 400; revoked device → 401 DEVICE_REVOKED', async () => {
    let sess = seedBound();
    expect((await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), device: descriptor({ deviceId: DEVICE_ID2 }), req: fakeReq() })).status).toBe(400);
    sess = seedBound({ revoked_at: daysAgo(1) });
    expect((await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), device: descriptor(), req: fakeReq() })).code).toBe('DEVICE_REVOKED');
  });

  test('ok: metadata updated, push token linked to the device, trust/key untouched, no grant for iOS', async () => {
    const sess = seedBound({ trust_level: 'unverified' });
    const r = await authDeviceService.registerDevice({
      userId: UID, sessionRow: sess, dpop: dpopFor(KEY), pushToken: 'apns-token-1', pushProvider: 'apns',
      device: descriptor({ appVersion: '1.5.0 (400)', installId: 'inst00000009', keyBacking: 'software', hasOsLock: true }), req: fakeReq(),
    });
    expect(r.ok).toBe(true);
    expect(r.device).toMatchObject({ id: DEV_ROW, deviceId: DEVICE_ID, trustLevel: 'unverified' });
    expect(r.resumeGrant).toBeNull();
    const dev = findRow('AuthDevice', DEV_ROW);
    expect(dev.app_version).toBe('1.5.0 (400)');
    expect(dev.install_id).toBe('inst00000009');
    expect(dev.key_backing).toBe('secure_enclave'); // metadata-only endpoint: key fields decided at issuance
    expect(dev.key_thumbprint).toBe(KEY.thumbprint);
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'apns-token-1', { platform: 'ios', provider: 'apns', deviceId: DEVICE_ID });
  });

  test('android trusted strongbox device → a resume grant is minted; not when prefs disable grants', async () => {
    let sess = seedBound({ platform: 'android', key_backing: 'strongbox', trust_level: 'trusted' });
    const r = await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), device: descriptor({ platform: 'android', keyBacking: 'strongbox' }), req: fakeReq() });
    expect(r.ok).toBe(true);
    expect(r.resumeGrant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(getTable('AuthResumeGrant')).toHaveLength(1);
    // idempotent: a second register re-issues (old grant revoked, one live grant)
    const r2 = await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), device: descriptor({ platform: 'android', keyBacking: 'strongbox' }), req: fakeReq() });
    expect(r2.resumeGrant).not.toBe(r.resumeGrant);
    expect(getTable('AuthResumeGrant').filter((g) => !g.revoked_at)).toHaveLength(1);

    seedTable('User', [{ id: UID, email: 'ying@example.com', security_prefs: { allowRestoreGrants: false } }]);
    sess = seedBound({ platform: 'android', key_backing: 'strongbox', trust_level: 'trusted' });
    expect((await authDeviceService.registerDevice({ userId: UID, sessionRow: sess, dpop: dpopFor(KEY), device: descriptor({ platform: 'android', keyBacking: 'strongbox' }), req: fakeReq() })).resumeGrant).toBeNull();
  });
});

describe('listDevices', () => {
  test('devices with active sessions (current first), unbound sessions, last events', async () => {
    seedTable('AuthDevice', [
      deviceRow({ id: DEV_ROW, device_id: DEVICE_ID, name: 'iPhone', last_seen_at: daysAgo(1) }),
      deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, name: 'Pixel', platform: 'android', last_seen_at: daysAgo(0) }),
      deviceRow({ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', device_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', name: 'Old', last_seen_at: daysAgo(40) }),
    ]);
    seedTable('AuthSession', [
      sessionRow({ id: SID, device_id: DEV_ROW }),
      sessionRow({ id: SID2, device_id: DEV_ROW2 }),
      sessionRow({ id: SID3, device_id: null, user_agent: 'Mozilla/5.0 Chrome' }),
      sessionRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', device_id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', revoked_at: daysAgo(1), revoked_reason: 'logout' }),
      sessionRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', user_id: OTHER_UID }),
    ]);
    seedTable('AuthSecurityEvent', [{ id: 1, user_id: UID, type: 'login', created_at: daysAgo(1), device_id: DEV_ROW, meta: { method: 'password' } }]);
    const out = await authDeviceService.listDevices(UID, SID);
    expect(out.devices.map((d) => d.name)).toEqual(['iPhone', 'Pixel']); // 'Old' has no active session
    expect(out.devices[0]).toMatchObject({ id: DEV_ROW, deviceId: DEVICE_ID, platform: 'ios', isCurrent: true, trustLevel: 'trusted' });
    expect(out.devices[1].isCurrent).toBe(false);
    expect(out.sessions).toEqual([expect.objectContaining({ id: SID3, platform: 'web', isCurrent: false, userAgent: 'Mozilla/5.0 Chrome' })]);
    expect(out.events).toEqual([expect.objectContaining({ id: 1, type: 'login', deviceId: DEV_ROW })]);
  });
});

describe('revocation', () => {
  function seedTwoDevices() {
    seedTable('AuthDevice', [
      deviceRow({ id: DEV_ROW, device_id: DEVICE_ID, name: 'iPhone' }),
      deviceRow({ id: DEV_ROW2, device_id: DEVICE_ID2, name: 'Pixel', platform: 'android' }),
    ]);
    seedTable('AuthSession', [
      sessionRow({ id: SID, device_id: DEV_ROW }),
      sessionRow({ id: SID2, device_id: DEV_ROW2 }),
      sessionRow({ id: SID3, device_id: null }), // web
      sessionRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9', user_id: OTHER_UID }),
    ]);
    seedTable('AuthResumeGrant', [
      { id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'h1', expires_at: daysAgo(-10), used_at: null, revoked_at: null },
      { id: 'g2', user_id: UID, device_id: DEV_ROW2, grant_hash: 'h2', expires_at: daysAgo(-10), used_at: null, revoked_at: null },
    ]);
  }

  test('revokeDevice: sessions revoked (device_revoked), row revoked, push tokens deleted, grants revoked, silent push first, event, email + push to others', async () => {
    seedTwoDevices();
    const listener = jest.fn();
    authSessionService.authEvents.on('session_revoked', listener);
    let r;
    try {
      r = await authDeviceService.revokeDevice({ userId: UID, deviceRowId: DEV_ROW2, reason: 'user', req: fakeReq(), actorSessionId: SID });
    } finally {
      authSessionService.authEvents.off('session_revoked', listener);
    }
    expect(r).toEqual({ ok: true, revokedSessions: 1 });
    expect(findRow('AuthSession', SID2)).toMatchObject({ revoked_reason: 'device_revoked' });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW2)).toMatchObject({ revoked_reason: 'user' });
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
    expect(getTable('AuthResumeGrant').find((g) => g.id === 'g2').revoked_at).toBeTruthy();
    expect(getTable('AuthResumeGrant').find((g) => g.id === 'g1').revoked_at).toBeNull();
    expect(pushService.sendToDevice).toHaveBeenCalledWith(UID, DEVICE_ID2, expect.objectContaining({ data: expect.objectContaining({ type: 'session_revoked' }) }));
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID2);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sessionIds: [SID2], reason: 'device_revoked' }));
    expect(events()).toEqual(expect.arrayContaining(['device_revoked', 'device_removed_email_sent']));
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/Pixel/);
    // idempotent + ownership
    expect(await authDeviceService.revokeDevice({ userId: UID, deviceRowId: DEV_ROW2, req: fakeReq() })).toMatchObject({ ok: true, already: true });
    expect(await authDeviceService.revokeDevice({ userId: OTHER_UID, deviceRowId: DEV_ROW, req: fakeReq() })).toMatchObject({ ok: false, status: 404 });
    // the revoked device's next refresh is refused
    seedTable('AuthDevice', getTable('AuthDevice').map((d) => (d.id === DEV_ROW2 ? { ...d, key_thumbprint: KEY.thumbprint } : d)));
    seedTable('AuthSession', [sessionRow({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6', device_id: DEV_ROW2, refresh_token_hash: authSessionService.hashToken('rt') })]);
    expect((await authDeviceService.checkRefresh({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), req: fakeReq() })).code).toBe('DEVICE_REVOKED');
  });

  test('revokeOthers: keeps the current session + its device, revokes everything else of this user (incl. web), GoTrue signOut others', async () => {
    seedTwoDevices();
    const signOutSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    setAuthMocks({ adminSignOut: signOutSpy });
    const r = await authDeviceService.revokeOthers({ userId: UID, currentSessionId: SID, accessToken: 'jwt', req: fakeReq() });
    expect(r).toEqual({ revoked: 2, revokedDevices: 1 });
    expect(signOutSpy).toHaveBeenCalledWith('jwt', 'others');
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthSession', SID2).revoked_reason).toBe('user');
    expect(findRow('AuthSession', SID3).revoked_reason).toBe('user');
    expect(findRow('AuthSession', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9').revoked_at).toBeNull(); // other user untouched
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull();
    expect(findRow('AuthDevice', DEV_ROW2).revoked_reason).toBe('user');
    expect(getTable('AuthResumeGrant').find((g) => g.id === 'g1').revoked_at).toBeNull();
    expect(getTable('AuthResumeGrant').find((g) => g.id === 'g2').revoked_at).toBeTruthy();
    expect(events()).toContain('revoke_others');
  });

  test('revokeAll (lockdown): everything revoked, all devices, all push tokens, all grants, sessions_valid_after set, email', async () => {
    seedTwoDevices();
    const before = Date.now();
    const r = await authDeviceService.revokeAll({ userId: UID, accessToken: 'jwt', req: fakeReq() });
    expect(r).toMatchObject({ ok: true, revoked: 3, revokedDevices: 2 });
    for (const id of [SID, SID2, SID3]) expect(findRow('AuthSession', id).revoked_reason).toBe('lockdown');
    expect(findRow('AuthDevice', DEV_ROW).revoked_reason).toBe('lockdown');
    expect(pushService.removeAllTokens).toHaveBeenCalledWith(UID);
    expect(getTable('AuthResumeGrant').every((g) => g.revoked_at)).toBe(true);
    const wm = new Date(getTable('User')[0].sessions_valid_after).getTime();
    expect(wm).toBeGreaterThanOrEqual(before - 1000);
    expect(await authSessionService.getSessionsValidAfter(UID)).toBeInstanceOf(Date);
    expect(events()).toEqual(expect.arrayContaining(['lockdown', 'lockdown_email_sent']));
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/All devices were signed out/);
  });

  test('onPasswordChanged / onPasswordReset / onAccountDeleted composite hooks', async () => {
    seedTwoDevices();
    await authDeviceService.onPasswordChanged({ userId: UID, currentSessionId: SID, accessToken: 'jwt', req: fakeReq() });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(findRow('AuthSession', SID2).revoked_reason).toBe('password_change');
    expect(findRow('AuthDevice', DEV_ROW2).revoked_reason).toBe('password_change');
    expect(events()).toEqual(expect.arrayContaining(['password_changed', 'password_changed_email_sent']));
    expect(pushService.sendToUserExcludingDevice).toHaveBeenCalledWith(UID, DEVICE_ID, expect.objectContaining({ data: expect.objectContaining({ event: 'password_changed' }) }));

    seedTwoDevices();
    await authDeviceService.onPasswordReset({ userId: UID, req: fakeReq() });
    expect(findRow('AuthSession', SID).revoked_reason).toBe('password_reset');
    expect(getTable('User')[0].sessions_valid_after).toBeTruthy();
    expect(events()).toContain('password_reset');

    seedTwoDevices();
    emailService.sendEmail.mockClear();
    await authDeviceService.onAccountDeleted({ userId: UID, accessToken: 'jwt', req: fakeReq() });
    expect(findRow('AuthSession', SID).revoked_reason).toBe('account_deleted');
    expect(events()).toContain('account_deleted');
    expect(emailService.sendEmail).not.toHaveBeenCalled(); // no lockdown mail on deletion
  });
});

describe('logoutLocal (proof rules)', () => {
  function seedBound(devOverrides = {}) {
    seedTable('AuthDevice', [deviceRow({ key_thumbprint: KEY.thumbprint, public_key_jwk: KEY.jwk, ...devOverrides })]);
    seedTable('AuthSession', [sessionRow({ device_id: DEV_ROW, bound_at_issue: true, refresh_token_hash: authSessionService.hashToken('rt') })]);
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'h1', expires_at: daysAgo(-10), used_at: null, revoked_at: null }]);
  }

  test('no proof (no Bearer, no refreshToken+DPoP) → nothing happens', async () => {
    seedBound();
    const out = await authDeviceService.logoutLocal({ deviceId: DEVICE_ID, req: fakeReq() });
    expect(out).toEqual({ proof: null, revokedSession: false, deviceRowId: null });
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
    expect(pushService.removeTokensForDevice).not.toHaveBeenCalled();
    // refresh token without a proof is not enough
    const out2 = await authDeviceService.logoutLocal({ refreshToken: 'rt', dpop: null, deviceId: DEVICE_ID, req: fakeReq() });
    expect(out2.proof).toBeNull();
    // refresh token with a proof from the WRONG key is not enough
    const out3 = await authDeviceService.logoutLocal({ refreshToken: 'rt', dpop: dpopFor(KEY2, { refreshToken: 'rt' }), req: fakeReq() });
    expect(out3.proof).toBeNull();
    expect(findRow('AuthSession', SID).revoked_at).toBeNull();
  });

  test('Bearer proof: own session revoked (logout), device push tokens deleted, grants revoked, event', async () => {
    seedBound();
    const out = await authDeviceService.logoutLocal({ userId: UID, bearerSessionId: SID, deviceId: DEVICE_ID, req: fakeReq() });
    expect(out).toEqual({ proof: 'bearer', revokedSession: true, deviceRowId: DEV_ROW });
    expect(findRow('AuthSession', SID).revoked_reason).toBe('logout');
    expect(findRow('AuthDevice', DEV_ROW).revoked_at).toBeNull(); // device row stays (iOS keeps its key)
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(events()).toContain('logout');
  });

  test('Bearer for another user\'s session → no effect; Bearer bound to a different deviceId → session revoked but no device effects', async () => {
    seedBound();
    expect((await authDeviceService.logoutLocal({ userId: OTHER_UID, bearerSessionId: SID, deviceId: DEVICE_ID, req: fakeReq() })).proof).toBeNull();
    const out = await authDeviceService.logoutLocal({ userId: UID, bearerSessionId: SID, deviceId: DEVICE_ID2, req: fakeReq() });
    expect(out).toEqual({ proof: 'bearer', revokedSession: true, deviceRowId: null });
    expect(pushService.removeTokensForDevice).not.toHaveBeenCalled();
  });

  test('refreshToken + DPoP (rth) from the bound key → same effects as Bearer proof', async () => {
    seedBound();
    const out = await authDeviceService.logoutLocal({ refreshToken: 'rt', dpop: dpopFor(KEY, { refreshToken: 'rt' }), deviceId: DEVICE_ID, req: fakeReq() });
    expect(out).toEqual({ proof: 'refresh', revokedSession: true, deviceRowId: DEV_ROW });
    expect(findRow('AuthSession', SID).revoked_reason).toBe('logout');
    expect(pushService.removeTokensForDevice).toHaveBeenCalledWith(UID, DEVICE_ID);
  });
});

describe('security prefs', () => {
  test('defaults, patch, and grant revocation when allowRestoreGrants is switched off', async () => {
    expect(await authDeviceService.getSecurityPrefs(UID)).toEqual({ allowRestoreGrants: true, newDeviceEmail: true });
    seedTable('AuthResumeGrant', [{ id: 'g1', user_id: UID, device_id: DEV_ROW, grant_hash: 'h1', expires_at: daysAgo(-10), used_at: null, revoked_at: null }]);
    expect(await authDeviceService.patchSecurityPrefs(UID, { newDeviceEmail: false, ignored: 'x' })).toEqual({ allowRestoreGrants: true, newDeviceEmail: false });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeNull();
    expect(await authDeviceService.patchSecurityPrefs(UID, { allowRestoreGrants: false })).toEqual({ allowRestoreGrants: false, newDeviceEmail: false });
    expect(getTable('AuthResumeGrant')[0].revoked_at).toBeTruthy();
    expect(getTable('User')[0].security_prefs).toEqual({ allowRestoreGrants: false, newDeviceEmail: false });
  });
});

describe('descriptor + helpers', () => {
  test('normalizeDeviceDescriptor validates + trims; platformFromRequest; evaluateTrustLevel', () => {
    expect(authDeviceService.normalizeDeviceDescriptor(null).ok).toBe(false);
    expect(authDeviceService.normalizeDeviceDescriptor({ deviceId: 'nope', platform: 'ios' }).ok).toBe(false);
    expect(authDeviceService.normalizeDeviceDescriptor({ deviceId: DEVICE_ID, platform: 'web' }).ok).toBe(false);
    expect(authDeviceService.normalizeDeviceDescriptor({ deviceId: DEVICE_ID, platform: 'ios', keyBacking: 'hsm' }).ok).toBe(false);
    expect(authDeviceService.normalizeDeviceDescriptor({ deviceId: DEVICE_ID, platform: 'ios', installId: 'x' }).ok).toBe(false);
    expect(authDeviceService.normalizeDeviceDescriptor({ deviceId: DEVICE_ID, platform: 'ios', attestation: 'str' }).ok).toBe(false);
    const ok = authDeviceService.normalizeDeviceDescriptor({ deviceId: DEVICE_ID.toUpperCase(), platform: 'IOS', name: '  My phone  ', hasOsLock: 'yes', attestation: { type: 'app_attest' } });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({ platform: 'ios', name: 'My phone', hasOsLock: false, keyBacking: 'software', attestation: { type: 'app_attest' } });

    // S9: control characters are stripped — device names reach log lines,
    // push bodies, e-mail subjects and the security-event feed.
    const CR = String.fromCharCode(13);
    const LF = String.fromCharCode(10);
    const NUL = String.fromCharCode(0);
    const injected = authDeviceService.normalizeDeviceDescriptor({
      deviceId: DEVICE_ID,
      platform: 'ios',
      name: `Ying${CR}${LF}Bcc: evil@example.com`,
      model: `iPhone${NUL}16,2`,
      osVersion: `18.5${LF}fake: 1`,
    });
    expect(injected.ok).toBe(true);
    expect(injected.value.name).toBe('Ying Bcc: evil@example.com');
    expect(injected.value.model).toBe('iPhone 16,2');
    expect(injected.value.osVersion).toBe('18.5 fake: 1');
    expect(/[\u0000-\u001f\u007f-\u009f]/.test(JSON.stringify(injected.value))).toBe(false);

    expect(authDeviceService.platformFromRequest(fakeReq({ headers: { 'x-client-platform': 'android' } }))).toBe('android');
    expect(authDeviceService.platformFromRequest(fakeReq({ headers: { 'x-client-platform': 'iOS 18.5' } }))).toBe('ios');
    expect(authDeviceService.platformFromRequest(fakeReq({ headers: { 'x-client-platform': 'web' } }))).toBeNull();

    expect(authDeviceService.evaluateTrustLevel({ keyBacking: 'secure_enclave', hasOsLock: true })).toBe('trusted');
    expect(authDeviceService.evaluateTrustLevel({ keyBacking: 'strongbox', hasOsLock: true })).toBe('trusted');
    expect(authDeviceService.evaluateTrustLevel({ keyBacking: 'tee', hasOsLock: true })).toBe('trusted');
    expect(authDeviceService.evaluateTrustLevel({ keyBacking: 'software', hasOsLock: true })).toBe('unverified');
    expect(authDeviceService.evaluateTrustLevel({ keyBacking: 'secure_enclave', hasOsLock: false })).toBe('unverified');
    expect(authDeviceService.isInteractiveContext('interactive')).toBe(true);
    expect(authDeviceService.isInteractiveContext('oauth')).toBe(true);
    expect(authDeviceService.isInteractiveContext('restored')).toBe(false);
  });

  test('sessionClaimsFromAccessToken / hashToken / isUuid', () => {
    const claims = authSessionService.sessionClaimsFromAccessToken(jwtFor());
    expect(claims).toMatchObject({ id: SID, sub: UID, aal: 'aal1' });
    expect(authSessionService.sessionClaimsFromAccessToken('garbage')).toBeNull();
    expect(authSessionService.hashToken('x')).toBe(crypto.createHash('sha256').update('x').digest('base64url'));
    expect(authSessionService.isUuid(SID)).toBe(true);
    expect(authSessionService.isUuid('nope')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Security review — S10: `req.ip` comes from X-Forwarded-For when `trust proxy`
// is on and is NOT validated by Express. The registry's IP columns are `inet`,
// so a non-address value would make the whole row write fail (22P02).
// ---------------------------------------------------------------------------
describe('clientIp — only real addresses reach the inet columns (S10)', () => {
  const ip = (value) => authSessionService.clientIp({ ip: value });

  test('valid addresses pass through unchanged', () => {
    expect(ip('203.0.113.7')).toBe('203.0.113.7');
    expect(ip('2001:db8::1')).toBe('2001:db8::1');
    expect(ip('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7');
  });

  test('an IPv6 zone index is dropped (Postgres inet rejects it)', () => {
    expect(ip('fe80::1%eth0')).toBe('fe80::1');
  });

  test('anything that is not an address becomes null instead of poisoning the write', () => {
    expect(ip('unknown')).toBeNull();
    expect(ip('not-an-ip-at-all')).toBeNull();
    expect(ip("203.0.113.7'); select 1 --")).toBeNull();
    expect(ip('203.0.113.7, 198.51.100.4')).toBeNull();
    expect(ip('')).toBeNull();
    expect(ip(undefined)).toBeNull();
    expect(authSessionService.clientIp(null)).toBeNull();
  });

  test('a session insert with a bogus forwarded IP still stores the row', async () => {
    const row = await authSessionService.insertSession({
      id: SID,
      userId: UID,
      refreshToken: 'rt-x',
      req: { ip: 'unknown', headers: { 'user-agent': 'okhttp/4.12.0' } },
    });
    expect(row).toBeTruthy();
    expect(getTable('AuthSession')).toHaveLength(1);
    expect(getTable('AuthSession')[0].last_ip).toBeNull();
    expect(getTable('AuthSession')[0].user_agent).toBe('okhttp/4.12.0');
  });
});

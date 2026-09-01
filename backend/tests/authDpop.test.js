// ============================================================
// middleware/dpop.js — DPoP proof verification (CONTRACT.md "Headers")
//   valid / wrong htu / wrong htm / skewed iat / replayed jti / rth mismatch /
//   missing header per AUTH_DEVICE_BINDING mode / bad alg / private jwk /
//   PUBLIC_API_BASE_URL comparison / requireDpop + optionalDpop middleware
// ============================================================

const crypto = require('crypto');
const jose = require('jose');
const { resetTables, getTable } = require('./__mocks__/supabaseAdmin');
const authPolicy = require('../config/authPolicy');
const dpop = require('../middleware/dpop');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

let keyPair;
let publicJwk;

async function makeKey() {
  const kp = await jose.generateKeyPair('ES256', { extractable: true });
  const jwk = await jose.exportJWK(kp.publicKey);
  return { kp, jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } };
}

/**
 * Build a DPoP proof. `overrides.claims` patch the payload, `overrides.header`
 * patch the protected header, `overrides.key` signs with another key.
 */
async function proofFor({ htm = 'POST', htu, iat = Math.floor(Date.now() / 1000), jti = crypto.randomUUID(), rth, claims = {}, header = {}, key } = {}) {
  const signer = key || keyPair.privateKey;
  const payload = { jti, htm, htu, iat, ...(rth ? { rth } : {}), ...claims };
  const protectedHeader = { typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk, ...header };
  return new jose.SignJWT(payload).setProtectedHeader(protectedHeader).sign(signer);
}

function fakeReq({ method = 'POST', path = '/api/users/refresh', host = 'api.test.local', proto = 'https', headers = {} } = {}) {
  const lower = {};
  Object.entries(headers).forEach(([k, v]) => { lower[k.toLowerCase()] = v; });
  lower.host = lower.host || host;
  return {
    method,
    originalUrl: path,
    url: path,
    path,
    protocol: proto,
    ip: '203.0.113.7',
    headers: lower,
    get(name) { return lower[String(name).toLowerCase()]; },
  };
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const HTU = 'https://api.test.local/api/users/refresh';

beforeAll(async () => {
  ({ kp: keyPair, jwk: publicJwk } = await makeKey());
});

beforeEach(() => {
  resetTables();
  delete process.env.AUTH_DEVICE_BINDING;
  delete process.env.PUBLIC_API_BASE_URL;
  authPolicy._resetForTests();
});

// ---------------------------------------------------------------------------
// verifyDpop
// ---------------------------------------------------------------------------

describe('verifyDpop — valid proof', () => {
  test('accepts a well-formed ES256 proof and exposes jwk/thumbprint/rth', async () => {
    const proof = await proofFor({ htu: HTU, rth: 'abc' });
    const req = fakeReq({ headers: { DPoP: proof } });
    const result = await dpop.verifyDpop(req);
    expect(result.ok).toBe(true);
    expect(req.dpop).toBeTruthy();
    expect(req.dpop.jwk).toEqual(publicJwk);
    expect(req.dpop.thumbprint).toBe(await jose.calculateJwkThumbprint(publicJwk, 'sha256'));
    expect(req.dpop.rth).toBe('abc');
    expect(req.dpop.htm).toBe('POST');
    // jti stored in the replay cache
    expect(getTable('AuthDpopJti')).toHaveLength(1);
  });

  test('header name is case-insensitive', async () => {
    const proof = await proofFor({ htu: HTU });
    const req = fakeReq({ headers: { dpop: proof } });
    expect((await dpop.verifyDpop(req)).ok).toBe(true);
  });

  test('ignores query string + trailing slash differences in htu', async () => {
    const proof = await proofFor({ htu: `${HTU}/` });
    const req = fakeReq({ path: '/api/users/refresh?x=1', headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).ok).toBe(true);
  });

  test('uses PUBLIC_API_BASE_URL (not the Host header) when configured', async () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.pantopus.com/';
    const proof = await proofFor({ htu: 'https://api.pantopus.com/api/users/refresh' });
    const req = fakeReq({ host: 'internal-lb:8080', proto: 'http', headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).ok).toBe(true);
  });

  test('checks rth against the refresh token when opts.refreshToken is passed', async () => {
    const refreshToken = 'rt-' + crypto.randomBytes(16).toString('hex');
    const rth = dpop.refreshTokenHash(refreshToken);
    const proof = await proofFor({ htu: HTU, rth });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req, { refreshToken })).ok).toBe(true);
  });
});

describe('verifyDpop — rejections', () => {
  test('wrong htu → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: 'https://api.test.local/api/users/login' });
    const req = fakeReq({ headers: { DPoP: proof } });
    const result = await dpop.verifyDpop(req);
    expect(result).toMatchObject({ ok: false, status: 401, code: 'DPOP_INVALID' });
    expect(req.dpop).toBeNull();
    // cheaper checks fail before the jti is burnt
    expect(getTable('AuthDpopJti')).toHaveLength(0);
  });

  test('wrong host in htu → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: 'https://evil.example/api/users/refresh' });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).code).toBe('DPOP_INVALID');
  });

  test('wrong htm → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU, htm: 'GET' });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).code).toBe('DPOP_INVALID');
  });

  test('iat skewed by more than 300 s (past) → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU, iat: Math.floor(Date.now() / 1000) - 301 });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).code).toBe('DPOP_INVALID');
  });

  test('iat skewed by more than 300 s (future) → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU, iat: Math.floor(Date.now() / 1000) + 301 });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).code).toBe('DPOP_INVALID');
  });

  test('iat inside the ±300 s window is accepted', async () => {
    const proof = await proofFor({ htu: HTU, iat: Math.floor(Date.now() / 1000) - 250 });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).ok).toBe(true);
  });

  test('replayed jti → DPOP_REPLAY on the second use', async () => {
    const proof = await proofFor({ htu: HTU });
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).ok).toBe(true);
    const second = await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }));
    expect(second).toMatchObject({ ok: false, status: 401, code: 'DPOP_REPLAY' });
  });

  test('same jti value re-signed in a new proof is still a replay', async () => {
    const jti = crypto.randomUUID();
    const a = await proofFor({ htu: HTU, jti });
    const b = await proofFor({ htu: HTU, jti });
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: a } }))).ok).toBe(true);
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: b } }))).code).toBe('DPOP_REPLAY');
  });

  test('rth mismatch → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU, rth: dpop.refreshTokenHash('other-token') });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req, { refreshToken: 'the-real-token' })).code).toBe('DPOP_INVALID');
  });

  test('rth missing while a refresh token is presented → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU });
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req, { refreshToken: 'the-real-token' })).code).toBe('DPOP_INVALID');
  });

  test('signature by a different key than the embedded jwk → DPOP_INVALID', async () => {
    const other = await makeKey();
    const proof = await proofFor({ htu: HTU, key: other.kp.privateKey }); // header jwk = original public key
    const req = fakeReq({ headers: { DPoP: proof } });
    expect((await dpop.verifyDpop(req)).code).toBe('DPOP_INVALID');
  });

  test('typ != dpop+jwt → DPOP_INVALID', async () => {
    const proof = await proofFor({ htu: HTU, header: { typ: 'JWT' } });
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });

  test('embedded jwk carrying a private component → DPOP_INVALID', async () => {
    const full = await jose.exportJWK(keyPair.privateKey);
    const proof = await proofFor({ htu: HTU, header: { jwk: { kty: 'EC', crv: 'P-256', x: full.x, y: full.y, d: full.d } } });
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });

  test('non-ES256 alg → DPOP_INVALID', async () => {
    const hs = new TextEncoder().encode('0123456789abcdef0123456789abcdef');
    const proof = await new jose.SignJWT({ jti: crypto.randomUUID(), htm: 'POST', htu: HTU, iat: Math.floor(Date.now() / 1000) })
      .setProtectedHeader({ typ: 'dpop+jwt', alg: 'HS256', jwk: publicJwk })
      .sign(hs);
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });

  // ── key-confusion matrix (security review) ──────────────────────────────
  // Hand-built compact JWTs: jose refuses to *produce* these, an attacker does not.
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const freshClaims = () => ({ jti: crypto.randomUUID(), htm: 'POST', htu: HTU, iat: Math.floor(Date.now() / 1000) });
  function handBuilt(header, claims, signature = '') {
    return `${b64u(header)}.${b64u(claims)}.${signature}`;
  }

  test('symmetric (oct) jwk in the header → DPOP_INVALID, whatever the alg', async () => {
    const secret = Buffer.from('0123456789abcdef0123456789abcdef');
    const octJwk = { kty: 'oct', k: secret.toString('base64url') };
    for (const alg of ['HS256', 'ES256']) {
      const header = { typ: 'dpop+jwt', alg, jwk: octJwk };
      const claims = freshClaims();
      const signingInput = `${b64u(header)}.${b64u(claims)}`;
      const sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
      const out = await dpop.verifyDpop(fakeReq({ headers: { DPoP: `${signingInput}.${sig}` } }));
      expect(out.code).toBe('DPOP_INVALID');
    }
    // and nothing was allowed to burn a jti
    expect(getTable('AuthDpopJti')).toHaveLength(0);
  });

  test('alg "none" / unsigned proof → DPOP_INVALID', async () => {
    const proof = handBuilt({ typ: 'dpop+jwt', alg: 'none', jwk: publicJwk }, freshClaims());
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });

  test('non-P-256 EC curve (P-384) → DPOP_INVALID', async () => {
    const kp = await jose.generateKeyPair('ES384', { extractable: true });
    const jwk = await jose.exportJWK(kp.publicKey);
    const proof = handBuilt(
      { typ: 'dpop+jwt', alg: 'ES256', jwk: { kty: 'EC', crv: 'P-384', x: jwk.x, y: jwk.y } },
      freshClaims(),
      Buffer.alloc(64, 7).toString('base64url')
    );
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });

  test('RSA jwk in the header → DPOP_INVALID', async () => {
    const proof = handBuilt(
      { typ: 'dpop+jwt', alg: 'ES256', jwk: { kty: 'RSA', n: 'AQAB', e: 'AQAB' } },
      freshClaims(),
      Buffer.alloc(64, 7).toString('base64url')
    );
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
    expect(getTable('AuthDpopJti')).toHaveLength(0);
  });

  test('a proof for one path cannot be replayed on another (no jti burned by the failure)', async () => {
    const proof = await proofFor({ htu: HTU });
    const other = await dpop.verifyDpop(fakeReq({ path: '/api/auth/devices/register', headers: { DPoP: proof } }));
    expect(other.code).toBe('DPOP_INVALID');
    expect(getTable('AuthDpopJti')).toHaveLength(0);
    // still usable on its own path — a failed cross-path attempt must not
    // let an attacker invalidate the legitimate client's proof
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).ok).toBe(true);
  });

  test('garbage header → DPOP_INVALID', async () => {
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: 'not.a.jwt' } }))).code).toBe('DPOP_INVALID');
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: 'xx' } }))).code).toBe('DPOP_INVALID');
  });

  test('missing required claims (no jti) → DPOP_INVALID', async () => {
    const proof = await new jose.SignJWT({ htm: 'POST', htu: HTU, iat: Math.floor(Date.now() / 1000) })
      .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk })
      .sign(keyPair.privateKey);
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).code).toBe('DPOP_INVALID');
  });
});

describe('verifyDpop — modes (AUTH_DEVICE_BINDING)', () => {
  test('optional (default): missing header is fine, req.dpop = null', async () => {
    const req = fakeReq();
    const result = await dpop.verifyDpop(req);
    expect(result).toEqual({ ok: true, dpop: null });
    expect(req.dpop).toBeNull();
  });

  test('required: missing header → 401 DPOP_REQUIRED', async () => {
    process.env.AUTH_DEVICE_BINDING = 'required';
    const result = await dpop.verifyDpop(fakeReq());
    expect(result).toMatchObject({ ok: false, status: 401, code: 'DPOP_REQUIRED' });
  });

  test('opts.required forces DPOP_REQUIRED even in optional mode', async () => {
    const result = await dpop.verifyDpop(fakeReq(), { required: true });
    expect(result.code).toBe('DPOP_REQUIRED');
  });

  test('off: proofs are ignored (even invalid ones) unless ignoreMode', async () => {
    process.env.AUTH_DEVICE_BINDING = 'off';
    const req = fakeReq({ headers: { DPoP: 'garbage' } });
    expect(await dpop.verifyDpop(req)).toEqual({ ok: true, dpop: null });
    expect((await dpop.verifyDpop(req, { ignoreMode: true, required: true })).code).toBe('DPOP_INVALID');
  });

  test('required: a valid proof passes', async () => {
    process.env.AUTH_DEVICE_BINDING = 'required';
    const proof = await proofFor({ htu: HTU });
    expect((await dpop.verifyDpop(fakeReq({ headers: { DPoP: proof } }))).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// middleware wrappers
// ---------------------------------------------------------------------------

describe('requireDpop() / optionalDpop()', () => {
  test('requireDpop: 401 DPOP_REQUIRED without a header regardless of mode off', async () => {
    process.env.AUTH_DEVICE_BINDING = 'off';
    const req = fakeReq();
    const res = fakeRes();
    const next = jest.fn();
    await dpop.requireDpop()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'DPoP proof required', code: 'DPOP_REQUIRED' });
  });

  test('requireDpop: calls next with req.dpop set on a valid proof', async () => {
    const proof = await proofFor({ htu: HTU });
    const req = fakeReq({ headers: { DPoP: proof } });
    const res = fakeRes();
    const next = jest.fn();
    await dpop.requireDpop()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.dpop.thumbprint).toBeTruthy();
  });

  test('optionalDpop: passes without a header in optional mode, rejects an invalid one', async () => {
    const next = jest.fn();
    await dpop.optionalDpop()(fakeReq(), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    const res = fakeRes();
    const next2 = jest.fn();
    await dpop.optionalDpop()(fakeReq({ headers: { DPoP: 'garbage' } }), res, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('DPOP_INVALID');
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe('helpers', () => {
  test('refreshTokenHash is base64url sha256', () => {
    const expected = crypto.createHash('sha256').update('tok').digest('base64url');
    expect(dpop.refreshTokenHash('tok')).toBe(expected);
    expect(dpop.refreshTokenHash('tok')).not.toMatch(/[+/=]/);
  });

  test('thumbprintEquals is strict', () => {
    expect(dpop.thumbprintEquals('abc', 'abc')).toBe(true);
    expect(dpop.thumbprintEquals('abc', 'abd')).toBe(false);
    expect(dpop.thumbprintEquals('abc', 'abcd')).toBe(false);
    expect(dpop.thumbprintEquals(null, 'abc')).toBe(false);
    expect(dpop.thumbprintEquals('', '')).toBe(false);
  });

  test('jwkThumbprint matches jose and rejects non-P-256 keys', async () => {
    expect(await dpop.jwkThumbprint(publicJwk)).toBe(await jose.calculateJwkThumbprint(publicJwk, 'sha256'));
    await expect(dpop.jwkThumbprint({ kty: 'RSA', n: 'x', e: 'AQAB' })).rejects.toBeInstanceOf(dpop.DpopError);
  });

  test('expectedHtu derives from the request when no base URL is set', () => {
    expect(dpop.expectedHtu(fakeReq({ path: '/api/auth/resume?x=1', host: 'h.example', proto: 'https' }))).toBe('https://h.example/api/auth/resume');
  });
});

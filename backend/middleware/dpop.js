// ============================================================
// DPoP proof verification (RFC 9449 subset) — CONTRACT.md "Headers".
//
//   DPoP: <jwt>   header {"typ":"dpop+jwt","alg":"ES256","jwk":{kty,crv,x,y}}
//                 payload {jti, htm, htu, iat, rth?}
//
// Verification:
//   * signature with the embedded JWK (jose EmbeddedJWK, ES256 only, public
//     key only), typ must be dpop+jwt
//   * htm === request method; htu === PUBLIC_API_BASE_URL + path (or
//     <proto>://<host> + path derived from the request — trust proxy is
//     configured in app.js), query/fragment ignored
//   * |now − iat| ≤ 300 s
//   * jti single-use for 10 min (INSERT into AuthDpopJti; PK conflict ⇒ replay)
//   * rth (base64url sha256 of the refresh token) is surfaced on req.dpop and
//     checked against a refresh token when the caller passes one
//
// On success `req.dpop = { jwk, thumbprint, jti, htu, htm, rth }`. When no
// header is present and the proof is not required, `req.dpop = null`.
//
// Modes (AUTH_DEVICE_BINDING):
//   off       — proofs are ignored on optional endpoints (kill switch)
//   optional  — verified when present, missing is fine
//   required  — missing ⇒ 401 DPOP_REQUIRED
// `requireDpop()` endpoints (/resume, /devices/register, /step-up-key)
// always need a valid proof regardless of mode: they cannot work without
// the key.
// ============================================================

const crypto = require('crypto');
const jose = require('jose');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const authPolicy = require('../config/authPolicy');

const HEADER = 'dpop';

class DpopError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getHeader(req, name) {
  if (typeof req.get === 'function') return req.get(name);
  const key = String(name || '').toLowerCase();
  return req.headers?.[key] || req.headers?.[name];
}

/** base64url(sha256(value)) — the `rth` binding of a refresh token. */
function refreshTokenHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

/**
 * Expected htu for this request: PUBLIC_API_BASE_URL + path, or the
 * request's own origin when the base URL is not configured. Query and
 * fragment are dropped.
 */
function expectedHtu(req) {
  const rawPath = String(req.originalUrl || req.url || req.path || '/');
  const path = rawPath.split('?')[0].split('#')[0] || '/';
  const base = authPolicy.publicApiBaseUrl();
  if (base) return `${base}${path}`;
  const proto = req.protocol || 'https';
  const host = getHeader(req, 'host') || 'localhost';
  return `${proto}://${host}${path}`;
}

/** Compare two htu values after RFC 3986 §6.2 style normalisation. */
function htuMatches(actual, expected) {
  if (typeof actual !== 'string' || !actual) return false;
  let a;
  let e;
  try {
    a = new URL(actual);
    e = new URL(expected);
  } catch {
    return false;
  }
  const norm = (u) => `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '') || '/'}`;
  return norm(a) === norm(e);
}

function isPlainP256Jwk(jwk) {
  return (
    jwk &&
    typeof jwk === 'object' &&
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.x === 'string' &&
    typeof jwk.y === 'string' &&
    !('d' in jwk)
  );
}

/** Insert the jti into the replay cache; a PK conflict means replay. */
async function rememberJti(jti) {
  const expiresAt = new Date(Date.now() + authPolicy.DPOP_JTI_TTL_SEC * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('AuthDpopJti')
    .insert({ jti, expires_at: expiresAt });
  if (!error) return;
  if (String(error.code) === '23505' || /duplicate key|unique constraint/i.test(String(error.message || ''))) {
    throw new DpopError('DPOP_REPLAY', 'DPoP proof replayed');
  }
  logger.error('auth.dpop.jti_store_failed', { error: error.message });
  throw new DpopError('DPOP_INVALID', 'Could not verify DPoP proof');
}

/**
 * Verify the proof carried by `req` (if any).
 *
 * @param {object} req
 * @param {object} [opts]
 * @param {boolean} [opts.required]     — missing header ⇒ DPOP_REQUIRED even in optional mode
 * @param {string}  [opts.refreshToken] — when set, `rth` must be present and equal sha256(refreshToken)
 * @param {boolean} [opts.ignoreMode]   — verify regardless of AUTH_DEVICE_BINDING=off (used by requireDpop)
 * @returns {Promise<{ok:true, dpop:object|null}|{ok:false, status:number, code:string, error:string}>}
 */
async function verifyDpop(req, opts = {}) {
  const mode = authPolicy.deviceBindingMode();
  const required = Boolean(opts.required) || mode === 'required';
  const proof = getHeader(req, HEADER);

  if (mode === 'off' && !opts.ignoreMode) {
    // Kill switch: proofs are neither required nor verified on optional endpoints.
    req.dpop = null;
    return { ok: true, dpop: null };
  }

  if (!proof || typeof proof !== 'string') {
    req.dpop = null;
    if (required) {
      return { ok: false, status: 401, code: 'DPOP_REQUIRED', error: 'DPoP proof required' };
    }
    return { ok: true, dpop: null };
  }

  try {
    const dpop = await verifyProofString(proof, {
      htm: String(req.method || 'POST').toUpperCase(),
      htu: expectedHtu(req),
      refreshToken: opts.refreshToken,
    });
    req.dpop = dpop;
    return { ok: true, dpop };
  } catch (err) {
    req.dpop = null;
    const code = err instanceof DpopError ? err.code : 'DPOP_INVALID';
    logger.warn('auth.dpop.invalid', {
      code,
      reason: err.message,
      path: req.originalUrl || req.path,
      ip: req.ip,
    });
    return { ok: false, status: 401, code, error: code === 'DPOP_REPLAY' ? 'DPoP proof replayed' : 'Invalid DPoP proof' };
  }
}

/**
 * Pure verification of a proof string against expected htm/htu. Exported for
 * the socket layer / tests. Throws DpopError.
 */
async function verifyProofString(proof, { htm, htu, refreshToken } = {}) {
  let header;
  try {
    header = jose.decodeProtectedHeader(proof);
  } catch {
    throw new DpopError('DPOP_INVALID', 'malformed proof');
  }
  if (header.typ !== 'dpop+jwt') throw new DpopError('DPOP_INVALID', 'typ must be dpop+jwt');
  if (header.alg !== 'ES256') throw new DpopError('DPOP_INVALID', 'alg must be ES256');
  if (!isPlainP256Jwk(header.jwk)) throw new DpopError('DPOP_INVALID', 'jwk must be a public P-256 EC key');

  let payload;
  try {
    ({ payload } = await jose.jwtVerify(proof, jose.EmbeddedJWK, {
      algorithms: ['ES256'],
      typ: 'dpop+jwt',
      clockTolerance: authPolicy.DPOP_IAT_TOLERANCE_SEC,
      requiredClaims: ['jti', 'htm', 'htu', 'iat'],
    }));
  } catch (err) {
    throw new DpopError('DPOP_INVALID', `signature/claims: ${err.code || err.message}`);
  }

  if (typeof payload.jti !== 'string' || payload.jti.length < 8 || payload.jti.length > 128) {
    throw new DpopError('DPOP_INVALID', 'jti invalid');
  }
  if (typeof payload.htm !== 'string' || payload.htm.toUpperCase() !== htm) {
    throw new DpopError('DPOP_INVALID', 'htm mismatch');
  }
  if (!htuMatches(payload.htu, htu)) {
    throw new DpopError('DPOP_INVALID', 'htu mismatch');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== 'number' || Math.abs(now - payload.iat) > authPolicy.DPOP_IAT_TOLERANCE_SEC) {
    throw new DpopError('DPOP_INVALID', 'iat outside window');
  }
  if (payload.rth !== undefined && typeof payload.rth !== 'string') {
    throw new DpopError('DPOP_INVALID', 'rth invalid');
  }
  if (refreshToken) {
    if (!payload.rth) throw new DpopError('DPOP_INVALID', 'rth required');
    const expected = refreshTokenHash(refreshToken);
    const a = Buffer.from(String(payload.rth));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new DpopError('DPOP_INVALID', 'rth mismatch');
    }
  }

  const jwk = { kty: 'EC', crv: 'P-256', x: header.jwk.x, y: header.jwk.y };
  const thumbprint = await jose.calculateJwkThumbprint(jwk, 'sha256');

  // Replay cache last, so a proof that fails cheaper checks does not burn a jti.
  await rememberJti(payload.jti);

  return {
    jwk,
    thumbprint,
    jti: payload.jti,
    htm: payload.htm.toUpperCase(),
    htu: payload.htu,
    rth: payload.rth || null,
  };
}

/**
 * Express middleware: the proof is mandatory (regardless of mode) and must be
 * valid. Used by /api/auth/resume, /devices/register, /step-up-key.
 */
function requireDpop(opts = {}) {
  return async (req, res, next) => {
    const result = await verifyDpop(req, { ...opts, required: true, ignoreMode: true });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    return next();
  };
}

/**
 * Express middleware: verify when present; enforce only in `required` mode.
 * Used by /login, /oauth/*, /step-up.
 */
function optionalDpop(opts = {}) {
  return async (req, res, next) => {
    const result = await verifyDpop(req, opts);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    return next();
  };
}

/** Compare a verified proof's thumbprint against a stored one (timing safe). */
function thumbprintEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** RFC 7638 thumbprint of a public JWK (used when storing keys). */
async function jwkThumbprint(jwk) {
  if (!isPlainP256Jwk(jwk)) throw new DpopError('DPOP_INVALID', 'jwk must be a public P-256 EC key', 400);
  return jose.calculateJwkThumbprint({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, 'sha256');
}

module.exports = {
  verifyDpop,
  verifyProofString,
  requireDpop,
  optionalDpop,
  expectedHtu,
  refreshTokenHash,
  thumbprintEquals,
  jwkThumbprint,
  isPlainP256Jwk,
  DpopError,
};

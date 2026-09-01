// ============================================================
// X-Step-Up verification (CONTRACT.md "New router" footnote).
//
// Token: base64url(payloadJson) + "." + base64url(HMAC-SHA256(STEP_UP_SECRET, payloadJson))
// payload { uid, sid, purpose, method, jti, exp }   — 5 min
// purposes: delete_account | revoke_device | revoke_sessions |
//           change_security_prefs | generic (wildcard, from /reauthenticate)
// one-shot for delete_account | revoke_device | revoke_sessions — the jti is
// consumed in AuthChallenge (purpose 'stepup_used', PK conflict ⇒ used).
//
// Restored-session rule: a token obtained with method 'device_key' is refused
// when the CURRENT session is `restored` (design §7.10). Password (and the
// wildcard from /reauthenticate, which is password) is always accepted.
//
// Usage (after verifyToken):
//   router.delete('/devices/:id', verifyToken, requireStepUp('revoke_device'), handler)
// On failure: 403 { error, code:'STEP_UP_REQUIRED', purpose, methods:[...] }
// On success: req.stepUp = { uid, sid, purpose, method, jti }
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('../services/authSessionService');

const PURPOSES = Object.freeze(['delete_account', 'revoke_device', 'revoke_sessions', 'change_security_prefs', 'generic']);
const ONE_SHOT_PURPOSES = Object.freeze(['delete_account', 'revoke_device', 'revoke_sessions']);
const METHODS = Object.freeze(['password', 'device_key', 'passkey', 'oauth']);
const HEADER = 'x-step-up';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(payloadJson) {
  return crypto.createHmac('sha256', authPolicy.stepUpSecret()).update(payloadJson).digest();
}

/**
 * Mint a step-up token.
 * @param {object} p
 * @param {string} p.uid      user id
 * @param {string|null} p.sid session id the token is bound to (null ⇒ unbound; avoid)
 * @param {string} p.purpose  one of PURPOSES
 * @param {string} p.method   'password' | 'device_key' | 'passkey' | 'oauth'
 * @param {number} [p.ttlSec] default 300
 * @returns {{ token:string, expiresAt:string, payload:object }}
 */
function mintStepUpToken({ uid, sid = null, purpose, method, ttlSec = authPolicy.STEP_UP_TTL_SEC }) {
  if (!uid) throw new Error('uid required');
  if (!PURPOSES.includes(purpose)) throw new Error(`invalid purpose ${purpose}`);
  if (!METHODS.includes(method)) throw new Error(`invalid method ${method}`);
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, Math.min(900, Number(ttlSec) || authPolicy.STEP_UP_TTL_SEC));
  const payload = { uid, sid: sid || null, purpose, method, jti: crypto.randomUUID(), exp };
  const json = JSON.stringify(payload);
  const token = `${b64url(json)}.${hmac(json).toString('base64url')}`;
  return { token, expiresAt: new Date(exp * 1000).toISOString(), payload };
}

/**
 * Parse + authenticate a token. Returns the payload or null. Does NOT check
 * purpose/uid/one-shot — see `requireStepUp`.
 */
function verifyStepUpToken(token) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let json;
  try {
    json = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = hmac(json);
  let given;
  try {
    given = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.uid !== 'string' || !payload.uid) return null;
  if (!PURPOSES.includes(payload.purpose)) return null;
  if (!METHODS.includes(payload.method)) return null;
  if (typeof payload.jti !== 'string' || !payload.jti) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

/** One-shot consumption: PK conflict ⇒ already used. */
async function consumeJti(jti, exp) {
  const { error } = await supabaseAdmin
    .from('AuthChallenge')
    .insert({ id: `stepup:${jti}`, purpose: 'stepup_used', challenge: null, expires_at: new Date(exp * 1000).toISOString() });
  if (!error) return true;
  if (String(error.code) === '23505' || /duplicate key|unique constraint/i.test(String(error.message || ''))) return false;
  logger.error('auth.stepup.jti_store_failed', { error: error.message });
  return false;
}

/** Context of the current session: req.session.context, else look up by sid. */
async function currentSessionContext(req, sid) {
  if (req?.session?.context) return req.session.context;
  const id = req?.session?.id || sid;
  if (!authSessionService.isUuid(id)) return null;
  const row = await authSessionService.getSessionById(id);
  if (row && !req.session) req.session = { id: row.id, context: row.context };
  else if (row && req.session && !req.session.context) req.session.context = row.context;
  return row?.context || null;
}

function getHeader(req, name) {
  if (typeof req.get === 'function') return req.get(name);
  return req.headers?.[name] || req.headers?.[String(name).toLowerCase()];
}

/** The access token that authenticated this request (Bearer, else cookie). */
function tokenFromRequest(req) {
  const authHeader = getHeader(req, 'authorization');
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim() || null;
  return req?.cookies?.pantopus_access || null;
}

/**
 * Compute the methods to advertise on a 403. Lazy-required to avoid a
 * circular import at module load (authDeviceService requires dpop.js only).
 */
async function methodsFor(req, purpose = null) {
  try {
    const authDeviceService = require('../services/authDeviceService');
    const sessionRow = req.sessionRow || (await authDeviceService.sessionRowFromRequest(req));
    if (sessionRow && !req.sessionRow) req.sessionRow = sessionRow;
    const methods = await authDeviceService.availableStepUpMethods({ userId: req.user?.id, sessionRow, purpose });
    return methods.length > 0 ? methods : ['password'];
  } catch (err) {
    logger.debug('auth.stepup.methods_failed', { error: err.message });
    return ['password'];
  }
}

async function reject(req, res, purpose, reason) {
  const methods = await methodsFor(req, purpose);
  logger.info('auth.stepup.required', { purpose, reason, userId: req.user?.id, path: req.originalUrl || req.path });
  return res.status(403).json({
    error: 'Please verify it is you to continue.',
    code: 'STEP_UP_REQUIRED',
    purpose,
    methods,
    reason,
  });
}

/**
 * Express middleware factory. Must run after verifyToken (needs req.user).
 * @param {string} purpose  one of PURPOSES (not 'generic')
 */
function requireStepUp(purpose) {
  if (!PURPOSES.includes(purpose) || purpose === 'generic') {
    throw new Error(`requireStepUp: invalid purpose ${purpose}`);
  }
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
      }
      const token = getHeader(req, HEADER);
      if (!token) return reject(req, res, purpose, 'missing');

      const payload = verifyStepUpToken(token);
      if (!payload) return reject(req, res, purpose, 'invalid');
      if (payload.uid !== req.user.id) return reject(req, res, purpose, 'user_mismatch');
      if (payload.purpose !== purpose && payload.purpose !== 'generic') return reject(req, res, purpose, 'purpose_mismatch');

      // Session binding: when we know the current session, the token must be for it.
      const currentSid = req.session?.id
        || authSessionService.sessionClaimsFromAccessToken(tokenFromRequest(req))?.id
        || null;
      if (payload.sid && currentSid && payload.sid !== currentSid) return reject(req, res, purpose, 'session_mismatch');

      // Restored sessions may not use device_key step-up for anything.
      if (payload.method === 'device_key') {
        const context = await currentSessionContext(req, payload.sid || currentSid);
        if (context === 'restored') return reject(req, res, purpose, 'restored_session');
      }

      if (ONE_SHOT_PURPOSES.includes(purpose)) {
        const fresh = await consumeJti(payload.jti, payload.exp);
        if (!fresh) return reject(req, res, purpose, 'used');
      }

      req.stepUp = { uid: payload.uid, sid: payload.sid, purpose: payload.purpose, method: payload.method, jti: payload.jti };
      return next();
    } catch (err) {
      logger.error('auth.stepup.error', { error: err.message, stack: err.stack });
      return res.status(500).json({ error: 'Step-up verification failed' });
    }
  };
}

module.exports = {
  requireStepUp,
  mintStepUpToken,
  verifyStepUpToken,
  PURPOSES,
  ONE_SHOT_PURPOSES,
  METHODS,
};

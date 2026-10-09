// ============================================================
// Access-token check on this server (Instant Screens contract §8, founder decision 4 "choice 5").
//
// A token is accepted here, without asking Supabase Auth, only when all of these hold:
//   * its signature verifies: the project's published JWKS for asymmetric signing keys (the default for new
//     projects), or SUPABASE_JWT_SECRET for a project still on the legacy shared secret;
//   * it hasn't expired, its audience is `authenticated`, its issuer is this project's Auth
//     (`<SUPABASE_URL>/auth/v1`, or SUPABASE_JWT_ISSUER), and it names a signed-in user and a session;
//   * our own session registry (AuthSession) has a row for that session. The registry stays the authority on
//     sign-outs: callers still apply checkSessionPolicy (revocation with its 15-second cache, the
//     sessions_valid_after watermark), exactly as after getUser.
// An authentic token past its expiry is refused here too (Supabase refuses it as well). Anything this check
// can't decide goes to Supabase's getUser as before: a malformed token, an unknown key id, a JWKS outage, a
// secret-signed token without SUPABASE_JWT_SECRET, a session without a registry row, a failed registry read.
// AUTH_LOCAL_JWT=off sends every token to getUser.
// ============================================================

const { jwtVerify, createRemoteJWKSet, decodeProtectedHeader, errors } = require('jose');
const authSessionService = require('./authSessionService');
const logger = require('../utils/logger');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASYMMETRIC_ALGS = ['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'EdDSA'];

function issuer() {
  if (process.env.SUPABASE_JWT_ISSUER) return process.env.SUPABASE_JWT_ISSUER;
  return `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1`;
}

let _jwks = null;
let _jwksUrl = null;
function projectJwks() {
  const url = `${issuer()}/.well-known/jwks.json`;
  if (!_jwks || _jwksUrl !== url) {
    // Keys are kept 10 minutes; an unknown key id refetches at most every 30 s (a rotation is picked up then).
    _jwks = createRemoteJWKSet(new URL(url), { timeoutDuration: 3000, cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
    _jwksUrl = url;
  }
  return _jwks;
}

// Each reason to ask Supabase is logged once per process, so staging shows why the local check isn't used.
const loggedReasons = new Set();
function undecided(reason) {
  if (!loggedReasons.has(reason)) {
    loggedReasons.add(reason);
    logger.info('auth.local_jwt_undecided', { reason });
  }
  return { status: 'undecided', reason };
}

/** @returns {Promise<{status:'valid', claims:object, mode:string}|{status:'expired'}|{status:'undecided', reason:string}>} */
async function verifyLocally(token) {
  if (String(process.env.AUTH_LOCAL_JWT || '').toLowerCase() === 'off') return undecided('off');
  let header;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    return { status: 'undecided', reason: 'malformed' };
  }
  let key;
  let algorithms;
  let mode;
  if (ASYMMETRIC_ALGS.includes(header.alg)) {
    key = projectJwks();
    algorithms = ASYMMETRIC_ALGS;
    mode = 'jwks';
  } else if (header.alg === 'HS256') {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return undecided('no_shared_secret');
    key = new TextEncoder().encode(secret);
    algorithms = ['HS256'];
    mode = 'shared_secret';
  } else {
    return undecided(`alg_${header.alg}`);
  }
  try {
    const { payload } = await jwtVerify(token, key, { issuer: issuer(), audience: 'authenticated', algorithms });
    if (payload.role !== 'authenticated' || !UUID.test(String(payload.sub || '')) || !UUID.test(String(payload.session_id || ''))) {
      return undecided('claims');
    }
    return { status: 'valid', claims: payload, mode };
  } catch (err) {
    // The signature verified before the expiry was read, so the token is authentic and past its time.
    if (err instanceof errors.JWTExpired) return { status: 'expired' };
    return undecided(err?.code || err?.name || 'verify_failed');
  }
}

let loggedActive = false;

/**
 * Verify an access token. `authClient` is the Supabase client whose getUser decides when this server can't.
 * @returns {Promise<{ok:true, via:'local'|'supabase', user:{id:string, email:string|null, emailConfirmed:boolean|null}}
 *   |{ok:false, reason:'invalid'|'busy', error?:object}>}
 */
async function verifyAccessToken(token, { authClient }) {
  const local = await verifyLocally(token);
  if (local.status === 'expired') return { ok: false, reason: 'invalid' };
  if (local.status === 'valid') {
    const state = await authSessionService.getSessionStateCached(local.claims.session_id);
    if (state.known) {
      if (!loggedActive) {
        loggedActive = true;
        logger.info('auth.local_jwt_active', { mode: local.mode });
      }
      return {
        ok: true,
        via: 'local',
        user: { id: local.claims.sub, email: local.claims.email || null, emailConfirmed: null },
      };
    }
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error && authSessionService.isAuthServiceBusy(error)) return { ok: false, reason: 'busy', error };
  if (error || !data?.user) return { ok: false, reason: 'invalid', error };
  return {
    ok: true,
    via: 'supabase',
    user: { id: data.user.id, email: data.user.email, emailConfirmed: data.user.email_confirmed_at !== null },
  };
}

module.exports = { verifyAccessToken, verifyLocally };

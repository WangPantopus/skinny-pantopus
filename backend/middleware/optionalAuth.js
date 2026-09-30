/**
 * optionalAuth middleware
 *
 * Soft-auth: if a valid Bearer token (or httpOnly cookie) is present,
 * populate req.user = { id, email }.  Otherwise set req.user = null
 * and continue — never returns 401. A token the auth service rejected
 * (invalid, expired or revoked; not an unreachable service) also sets
 * req.authRejected, for routes whose signed-in view differs.
 *
 * Uses a short-lived in-memory token→user cache (15 s) to avoid
 * hitting Supabase auth on every request.
 */

const { isAuthRetryableFetchError } = require('@supabase/supabase-js');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const authSessionService = require('../services/authSessionService');

// ── Token → user cache (15 s TTL) ──────────────────────────────
const TOKEN_CACHE_TTL = 15_000;
const TOKEN_CACHE_MAX = 500;
const _tokenCache = new Map();

function getCached(token) {
  const entry = _tokenCache.get(token);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > TOKEN_CACHE_TTL) {
    _tokenCache.delete(token);
    return undefined;
  }
  return entry.user; // may be null (invalid token cached)
}

function setCache(token, user) {
  if (_tokenCache.size >= TOKEN_CACHE_MAX && !_tokenCache.has(token)) {
    const firstKey = _tokenCache.keys().next().value;
    _tokenCache.delete(firstKey);
  }
  _tokenCache.set(token, { user, ts: Date.now() });
}

// A definite "no" from the auth service (an invalid, expired or unknown token), as
// opposed to the service being unreachable (network, timeout, 5xx), which supabase-js
// also returns as an error object. Only a rejection may read as "signed out".
function isRejection(error) {
  if (!error) return true; // the service answered, with no user
  if (isAuthRetryableFetchError(error)) return false;
  const status = Number(error.status);
  return Number.isInteger(status) && status >= 400 && status < 500;
}

// ── Middleware ───────────────────────────────────────────────────
async function optionalAuth(req, _res, next) {
  req.user = null;
  req.authRejected = false;

  try {
    // Extract token: prefer Bearer header (mobile) over httpOnly cookie (web).
    // Native clients can retain stale cookies in the platform cookie jar, so a
    // deliberate Bearer token must win when both transports are present.
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.pantopus_access) {
      token = req.cookies.pantopus_access;
    }

    if (!token) return next();

    // Check cache first
    const cached = getCached(token);
    if (cached !== undefined) {
      req.user = cached;
      req.authRejected = cached === null; // only rejections are cached as null
      return next();
    }

    // Verify with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      if (!isRejection(error)) {
        logger.debug('optionalAuth: auth service unreachable, treating as anonymous', { status: error?.status });
        return next(); // not cached: the next request verifies again
      }
      setCache(token, null);
      req.authRejected = true;
      return next();
    }

    // Persistent login (design §6.4): a revoked AuthSession reads as
    // anonymous on soft-auth routes too (same 15-s cache as verifyToken).
    const claims = authSessionService.sessionClaimsFromAccessToken(token);
    if (claims?.id) {
      const state = await authSessionService.getSessionStateCached(claims.id);
      if (state.known && state.revoked) {
        logger.debug('optionalAuth: session revoked, treating as anonymous', { session_id: claims.id });
        setCache(token, null);
        req.authRejected = true;
        return next();
      }
    }

    const user = { id: data.user.id, email: data.user.email };
    setCache(token, user);
    req.user = user;
  } catch (err) {
    logger.debug('optionalAuth: non-fatal error', { error: err.message });
    // Continue as anonymous
  }

  next();
}

module.exports = optionalAuth;
// Exposed for testing
module.exports._tokenCache = _tokenCache;

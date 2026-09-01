/**
 * optionalAuth middleware
 *
 * Soft-auth: if a valid Bearer token (or httpOnly cookie) is present,
 * populate req.user = { id, email }.  Otherwise set req.user = null
 * and continue — never returns 401.
 *
 * Uses a short-lived in-memory token→user cache (15 s) to avoid
 * hitting Supabase auth on every request.
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

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

// ── Middleware ───────────────────────────────────────────────────
async function optionalAuth(req, _res, next) {
  req.user = null;

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
      return next();
    }

    // Verify with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      setCache(token, null);
      return next();
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

require('dotenv').config();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const csrfProtection = require('./csrfProtection');
const logger = require('../utils/logger');
const authSessionService = require('../services/authSessionService');

// ============ IN-MEMORY ROLE CACHE (AUTH-3.4) ============
// Caches User.role lookups to reduce DB queries per request.
// Map<userId, { role: string, ts: number }>
const ROLE_CACHE_TTL_MS = 60_000; // 60 seconds
const ROLE_CACHE_MAX_SIZE = 1000;
const _roleCache = new Map();

function getCachedRole(userId) {
  const entry = _roleCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > ROLE_CACHE_TTL_MS) {
    _roleCache.delete(userId);
    return null;
  }
  return {
    role: entry.role,
    accountType: entry.accountType || 'individual',
    // Persistent login (design §6.4): User.sessions_valid_after watermark rides
    // in the same 60-s cache; JWTs issued before it are refused.
    sessionsValidAfter: entry.sessionsValidAfter || null,
  };
}

function setCachedRole(userId, role, accountType, sessionsValidAfter = null) {
  // Evict oldest entries if at max size
  if (_roleCache.size >= ROLE_CACHE_MAX_SIZE && !_roleCache.has(userId)) {
    const firstKey = _roleCache.keys().next().value;
    _roleCache.delete(firstKey);
  }
  _roleCache.set(userId, {
    role,
    accountType: accountType || 'individual',
    sessionsValidAfter: sessionsValidAfter || null,
    ts: Date.now(),
  });
}

/**
 * Invalidate cached role for a user. Call after role changes.
 * @param {string} userId
 */
function invalidateRoleCache(userId) {
  _roleCache.delete(userId);
}

// ============ SESSION CLAIMS / REVOCATION (persistent login, design §6.4) ============

/**
 * Decode the session claims of an access token that Supabase already
 * accepted. Pure decode — never call it before `supabase.auth.getUser`.
 * Shared with socket/chatSocketio.js and optionalAuth.
 * @returns {{id:string|null, iat:number|null, exp:number|null, sub:string|null, aal:string|null}|null}
 */
function decodeSessionClaims(token) {
  return authSessionService.sessionClaimsFromAccessToken(token);
}

function parseWatermark(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Additive session policy on top of getUser (which stays the authority):
 *   1. AuthSession row revoked            → { ok:false, code:'SESSION_REVOKED' }
 *   2. JWT iat older than the user's       → { ok:false, code:'SESSION_REVOKED' }
 *      sessions_valid_after watermark
 * Pre-registry sessions (no row) and tokens without a session_id claim pass.
 * @returns {Promise<{ok:true, session:object}|{ok:false, code:string, reason:string, session:object}>}
 */
async function checkSessionPolicy(token, { userId, sessionsValidAfter } = {}) {
  const claims = decodeSessionClaims(token);
  const session = {
    id: claims?.id || null,
    iat: claims?.iat || null,
    aal: claims?.aal || null,
    context: null,
  };
  if (session.id) {
    const state = await authSessionService.getSessionStateCached(session.id);
    if (state.known) {
      session.context = state.context;
      if (state.revoked) return { ok: false, code: 'SESSION_REVOKED', reason: state.row?.revoked_reason || 'revoked', session };
    }
  }
  const watermark = parseWatermark(sessionsValidAfter);
  if (watermark && typeof session.iat === 'number' && session.iat * 1000 < watermark.getTime()) {
    logger.info('auth.session_before_watermark', { user_id: userId, iat: session.iat, watermark: watermark.toISOString() });
    return { ok: false, code: 'SESSION_REVOKED', reason: 'watermark', session };
  }
  return { ok: true, session };
}

const SESSION_REVOKED_MESSAGE = 'This session was signed out. Please sign in again.';

// A lockdown / password reset in this process must take effect on the next
// request, not after the 60-s cache expires.
authSessionService.authEvents.on('watermark_updated', ({ userId } = {}) => {
  if (userId) invalidateRoleCache(userId);
});

/**
 * Middleware to verify Supabase JWT token
 * Extracts user from token and attaches to req.user
 */
const verifyToken = async (req, res, next) => {
  const startMs = Date.now();
  try {
    // Extract token: prefer Bearer header (mobile) over httpOnly cookie (web).
    // Mobile clients send Bearer explicitly; cookies may also be present as
    // a side-effect of Set-Cookie on login, so Bearer must take priority to
    // avoid incorrectly triggering CSRF enforcement on mobile requests.
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
      req._authMethod = 'bearer';
    } else if (req.cookies?.pantopus_access) {
      token = req.cookies.pantopus_access;
      req._authMethod = 'cookie'; // Tag for CSRF check downstream
    }

    if (!token) {
      logger.warn('auth.no_token', { path: req.path, ip: req.ip, method: req._authMethod, hasCookie: Boolean(req.cookies?.pantopus_access), hasBearer: Boolean(authHeader) });
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.warn('auth.token_invalid', { ip: req.ip, method: req._authMethod });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user role + account type (+ sessions_valid_after watermark) —
    // check cache first (AUTH-3.4)
    let userRole = 'user';
    let userAccountType = 'individual';
    let sessionsValidAfter = null;
    const cached = getCachedRole(data.user.id);
    if (cached) {
      logger.debug('auth.role_cache_hit', { user_id: data.user.id });
      userRole = cached.role;
      userAccountType = cached.accountType;
      sessionsValidAfter = cached.sessionsValidAfter;
    } else {
      logger.debug('auth.role_cache_miss', { user_id: data.user.id });
      try {
        let { data: userRow, error: userRowError } = await supabaseAdmin
          .from('User')
          .select('role, account_type, sessions_valid_after')
          .eq('id', data.user.id)
          .single();
        if (userRowError && !userRow) {
          // Migration 160 not applied yet (column missing) — fall back to the
          // legacy projection so roles never silently downgrade to 'user'.
          ({ data: userRow } = await supabaseAdmin
            .from('User')
            .select('role, account_type')
            .eq('id', data.user.id)
            .single());
        }
        if (userRow?.role) userRole = userRow.role;
        if (userRow?.account_type) userAccountType = userRow.account_type;
        if (userRow?.sessions_valid_after) sessionsValidAfter = userRow.sessions_valid_after;
      } catch {
        // Non-fatal: default to 'user' role
      }
      setCachedRole(data.user.id, userRole, userAccountType, sessionsValidAfter);
    }

    // Persistent login (design §6.4): session_id / iat / aal from the JWT,
    // AuthSession revocation (15-s cache) and the sessions_valid_after
    // watermark. Additive — getUser above remains the authority.
    const policy = await checkSessionPolicy(token, { userId: data.user.id, sessionsValidAfter });
    req.session = policy.session;
    if (!policy.ok) {
      logger.warn('auth.session_revoked', {
        user_id: data.user.id,
        session_id: policy.session.id,
        reason: policy.reason,
        method: req._authMethod,
        path: req.path,
      });
      return res.status(401).json({ error: SESSION_REVOKED_MESSAGE, code: policy.code });
    }

    // Attach user info to request
    req.user = {
      id: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.email_confirmed_at !== null,
      role: userRole,
      accountType: userAccountType,
    };

    logger.debug('auth.token_verified', {
      user_id: data.user.id,
      method: req._authMethod,
      latency_ms: Date.now() - startMs,
    });

    // CSRF check runs here — after _authMethod is set, before route handler.
    csrfProtection(req, res, next);
  } catch (err) {
    logger.error('Token verification error:', err);
    res.status(500).json({ error: 'Token verification failed' });
  }
};

/**
 * Middleware to require platform admin role.
 * Must be used AFTER verifyToken.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
};

module.exports = verifyToken;
module.exports.requireAdmin = requireAdmin;
module.exports.invalidateRoleCache = invalidateRoleCache;
// Persistent login helpers (shared with optionalAuth / socket layer)
module.exports.decodeSessionClaims = decodeSessionClaims;
module.exports.checkSessionPolicy = checkSessionPolicy;
module.exports.SESSION_REVOKED_MESSAGE = SESSION_REVOKED_MESSAGE;
// Exposed for testing only
module.exports._roleCache = _roleCache;

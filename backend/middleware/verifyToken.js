require('dotenv').config();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const csrfProtection = require('./csrfProtection');
const logger = require('../utils/logger');

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
  return { role: entry.role, accountType: entry.accountType || 'individual' };
}

function setCachedRole(userId, role, accountType) {
  // Evict oldest entries if at max size
  if (_roleCache.size >= ROLE_CACHE_MAX_SIZE && !_roleCache.has(userId)) {
    const firstKey = _roleCache.keys().next().value;
    _roleCache.delete(firstKey);
  }
  _roleCache.set(userId, { role, accountType: accountType || 'individual', ts: Date.now() });
}

/**
 * Invalidate cached role for a user. Call after role changes.
 * @param {string} userId
 */
function invalidateRoleCache(userId) {
  _roleCache.delete(userId);
}

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

    // Fetch user role + account type — check cache first (AUTH-3.4)
    let userRole = 'user';
    let userAccountType = 'individual';
    const cached = getCachedRole(data.user.id);
    if (cached) {
      logger.debug('auth.role_cache_hit', { user_id: data.user.id });
      userRole = cached.role;
      userAccountType = cached.accountType;
    } else {
      logger.debug('auth.role_cache_miss', { user_id: data.user.id });
      try {
        const { data: userRow } = await supabaseAdmin
          .from('User')
          .select('role, account_type')
          .eq('id', data.user.id)
          .single();
        if (userRow?.role) userRole = userRow.role;
        if (userRow?.account_type) userAccountType = userRow.account_type;
      } catch {
        // Non-fatal: default to 'user' role
      }
      setCachedRole(data.user.id, userRole, userAccountType);
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
// Exposed for testing only
module.exports._roleCache = _roleCache;

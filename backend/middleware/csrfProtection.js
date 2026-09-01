// ============================================================
// CSRF PROTECTION MIDDLEWARE (AUTH-3.3 / AUTH-3.3b)
//
// Protects cookie-authenticated web requests against CSRF.
// For non-safe HTTP methods (POST, PUT, PATCH, DELETE), when
// auth came via httpOnly cookie, we require:
//   1. x-csrf-token header matches pantopus_csrf cookie (double-submit)
//   2. The token is a valid HMAC of the authenticated user's ID
//      (session-binding prevents cookie-injection attacks)
//
// Bearer-authenticated requests (mobile) skip CSRF entirely.
// ============================================================

const logger = require('../utils/logger');
const { verifyCsrfToken } = require('../utils/csrf');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  // Safe methods never need CSRF
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Only enforce CSRF when auth came via cookie
  if (req._authMethod !== 'cookie') {
    return next();
  }

  const cookieToken = req.cookies?.pantopus_csrf;
  const headerToken = req.headers['x-csrf-token'];

  // Double-submit check: cookie and header must match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn('CSRF token missing or mismatch', {
      path: req.path,
      method: req.method,
      hasCookieToken: Boolean(cookieToken),
      hasHeaderToken: Boolean(headerToken),
    });
    return res.status(403).json({ error: 'CSRF token missing or invalid' });
  }

  // Session-binding check: token must be HMAC(secret, userId)
  const userId = req.user?.id;
  if (!userId || !verifyCsrfToken(cookieToken, userId)) {
    logger.warn('CSRF token not bound to session', {
      path: req.path,
      method: req.method,
      userId: userId || 'unknown',
    });
    return res.status(403).json({ error: 'CSRF token missing or invalid' });
  }

  next();
}

module.exports = csrfProtection;

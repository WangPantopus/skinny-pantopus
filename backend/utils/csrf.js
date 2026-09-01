// ============================================================
// CSRF Token Utility — session-bound HMAC tokens (AUTH-3.3b)
//
// Generates CSRF tokens as HMAC-SHA256(secret, userId) so each
// token is bound to a specific user session. This prevents an
// attacker from injecting their own CSRF cookie to bypass the
// double-submit check.
// ============================================================

const crypto = require('crypto');

// Secret used to HMAC CSRF tokens. In production, CSRF_SECRET must
// be set in the environment so all instances share the same key.
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error(
    'CSRF_SECRET environment variable is required in production. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Generate a session-bound CSRF token for a given user ID.
 * @param {string} userId
 * @returns {string} hex-encoded HMAC (always 64 hex chars)
 */
function generateCsrfToken(userId) {
  return crypto.createHmac('sha256', CSRF_SECRET).update(userId).digest('hex');
}

/**
 * Verify that a CSRF token matches the expected HMAC for a user.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {string} token - the token from cookie/header
 * @param {string} userId
 * @returns {boolean}
 */
function verifyCsrfToken(token, userId) {
  if (!token || !userId) return false;
  const expected = generateCsrfToken(userId);
  // Both are hex-encoded HMAC-SHA256 (64 chars). Use fixed-size buffers
  // for timing-safe comparison — no early exit on length mismatch.
  const tokenBuf = Buffer.alloc(32);
  const expectedBuf = Buffer.from(expected, 'hex');
  // If token isn't valid 64-char hex, the decode will produce a short
  // buffer and the comparison will fail (safe).
  const decoded = Buffer.from(token, 'hex');
  decoded.copy(tokenBuf, 0, 0, Math.min(decoded.length, 32));
  if (decoded.length !== 32) return false;
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

module.exports = { generateCsrfToken, verifyCsrfToken };

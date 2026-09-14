const crypto = require('crypto');

// Scope comparison never grants access. Call only after verifyToken. Registered
// sessions remain stable across token refresh; verified legacy tokens fail closed
// across rotation. No credential or bearer-capable identifier is returned.
function getRequestSessionScope(req) {
  if (!req.user?.id) throw new Error('Authenticated request scope is unavailable');
  const header = req.headers?.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.pantopus_access;
  const session = typeof req.session?.id === 'string' && req.session.id ? `session:${req.session.id}`
    : typeof token === 'string' && token ? `legacy:${crypto.createHash('sha256').update(token).digest('hex')}` : null;
  if (!session) throw new Error('Authenticated request scope is unavailable');
  return { actor_id: req.user.id, session_scope: crypto.createHash('sha256').update(`pantopus-request-scope-v1\n${req.user.id}\n${session}`).digest('hex') };
}
function requireExpectedSessionScope(req, res, { required = false } = {}) {
  const expected = req.headers?.['x-pantopus-session-scope'];
  if (expected === undefined && !required) return true;
  let actual;
  try { actual = getRequestSessionScope(req).session_scope; } catch (_) { actual = null; }
  if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected) || actual === null
    || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))) {
    res.status(409).json({ code: 'SESSION_SCOPE_CHANGED', error: 'Your signed-in session changed. Reopen this screen before continuing.' });
    return false;
  }
  return true;
}
module.exports = { getRequestSessionScope, requireExpectedSessionScope };

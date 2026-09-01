/**
 * requireFeatureFlag(flagName)
 *
 * Express middleware that 404s the request if the authenticated user does
 * not have the named feature flag enabled. The 404 (rather than a 403 or
 * "feature disabled" body) is intentional: a feature behind the flag must
 * be invisible to users without access — the URL must look like it
 * doesn't exist.
 *
 * Usage:
 *
 *   router.get('/api/personas/:id',
 *     verifyToken,
 *     requireFeatureFlag('audience_profile'),
 *     getPersona);
 *
 * P0.8 ships the middleware with no Phase-0 routes using it. Phase 1
 * audience-profile routes will register through it from the start.
 */

const { isFeatureEnabled } = require('../services/featureFlagService');
const logger = require('../utils/logger');

function notFound(res) {
  return res.status(404).json({ error: 'Not found' });
}

function requireFeatureFlag(flagName) {
  if (!flagName || typeof flagName !== 'string') {
    throw new Error('requireFeatureFlag: flagName is required.');
  }
  return async function flagGuard(req, res, next) {
    try {
      const user = req.user || null;
      if (!user || !user.id) return notFound(res);
      const enabled = await isFeatureEnabled(flagName, user);
      if (!enabled) return notFound(res);
      return next();
    } catch (err) {
      logger.error('requireFeatureFlag.error', {
        flagName,
        userId: req.user?.id,
        error: err.message,
      });
      return res.status(500).json({ error: 'Feature flag check failed' });
    }
  };
}

module.exports = requireFeatureFlag;

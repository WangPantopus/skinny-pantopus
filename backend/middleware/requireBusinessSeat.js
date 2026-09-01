/**
 * requireBusinessSeat — Express middleware for seat-based business authorization.
 *
 * Resolves the authenticated user's seat at the business identified by the
 * route param, optionally checks a specific IAM permission, and attaches
 * the seat + permissions to the request object.
 *
 * Usage:
 *   router.get('/:businessId/seats', verifyToken, requireBusinessSeat('team.view'), handler)
 *   router.get('/:businessId/overview', verifyToken, requireBusinessSeat(), handler)
 *
 * After middleware runs:
 *   req.businessSeat        — the seat object (id, display_name, role_base, ...)
 *   req.businessPermissions — resolved permission strings[]
 *   req.isBusinessOwner     — boolean
 *   req.businessUserId      — the business account's user ID (convenience)
 */

const { getSeatAccess } = require('../utils/seatPermissions');

/**
 * @param {string|null} permission - Optional IAM permission to enforce (e.g. 'team.view')
 * @returns {Function} Express middleware
 */
function requireBusinessSeat(permission = null) {
  return async (req, res, next) => {
    try {
      // Resolve the business user ID from route params
      // Routes use different param names — try the common ones
      const businessUserId =
        req.params.businessUserId ||
        req.params.businessId ||
        req.params.id;

      if (!businessUserId) {
        return res.status(400).json({ error: 'Missing business identifier in route' });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const access = await getSeatAccess(businessUserId, req.user.id);

      if (!access.hasAccess) {
        return res.status(403).json({ error: 'No active seat at this business' });
      }

      if (permission && !access.permissions.includes(permission)) {
        return res.status(403).json({ error: `Missing permission: ${permission}` });
      }

      // Attach seat context to request — downstream handlers use these
      req.businessSeat = access.seat;
      req.businessPermissions = access.permissions;
      req.isBusinessOwner = access.isOwner;
      req.businessUserId = businessUserId;

      next();
    } catch (err) {
      // Avoid leaking internal details
      return res.status(500).json({ error: 'Failed to verify business access' });
    }
  };
}

module.exports = requireBusinessSeat;

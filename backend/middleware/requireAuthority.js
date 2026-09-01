/**
 * Middleware: requireAuthority
 *
 * Verifies that the authenticated user (or their business) holds a
 * verified HomeAuthority for the target home.  Attaches the matching
 * authority record to `req.authority` for downstream handlers.
 *
 * The home ID is resolved from (in order):
 *   1. req.params.homeId
 *   2. req.body.home_id
 *
 * Usage:
 *   router.post('/landlord/lease/invite', verifyToken, requireAuthority, handler);
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function requireAuthority(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const homeId = req.params.homeId || req.body.home_id;

  // For routes that derive homeId from a lease, we defer the check to the handler.
  // Only block when we can resolve a homeId up front.
  if (!homeId) {
    // Attach null so handlers know middleware ran but had no homeId to check.
    req.authority = null;
    return next();
  }

  try {
    // Look up verified authority for this user (direct or via business membership)
    const { data: authority, error } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('home_id', homeId)
      .eq('status', 'verified')
      .or(`and(subject_type.eq.user,subject_id.eq.${userId})`)
      .maybeSingle();

    if (error) {
      logger.error('requireAuthority: query failed', { error: error.message, userId, homeId });
      return res.status(500).json({ error: 'Failed to verify authority' });
    }

    if (!authority) {
      // Fall back: check if user belongs to a business that holds authority
      const businessAuthority = await _findBusinessAuthority(userId, homeId);
      if (!businessAuthority) {
        return res.status(403).json({ error: 'No verified authority for this property' });
      }
      req.authority = businessAuthority;
      return next();
    }

    req.authority = authority;
    next();
  } catch (err) {
    logger.error('requireAuthority: unexpected error', { error: err.message, userId, homeId });
    return res.status(500).json({ error: 'Failed to verify authority' });
  }
}

/**
 * Check if the user is a member of a business that holds authority
 * over the given home. Checks SeatBinding first, then BusinessTeam (legacy).
 */
async function _findBusinessAuthority(userId, homeId) {
  try {
    // ── 1. Seat-based lookup (SeatBinding → BusinessSeat) ──────
    const { data: bindings } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat_id')
      .eq('user_id', userId);

    if (bindings && bindings.length > 0) {
      const seatIds = bindings.map((b) => b.seat_id);

      const { data: seats } = await supabaseAdmin
        .from('BusinessSeat')
        .select('id, business_user_id')
        .in('id', seatIds)
        .eq('is_active', true);

      if (seats && seats.length > 0) {
        const seatBizIds = [...new Set(seats.map((s) => s.business_user_id))];

        const { data: authority } = await supabaseAdmin
          .from('HomeAuthority')
          .select('*')
          .eq('home_id', homeId)
          .eq('subject_type', 'business')
          .in('subject_id', seatBizIds)
          .eq('status', 'verified')
          .maybeSingle();

        if (authority) return authority;
      }
    }

    // ── 2. Legacy BusinessTeam fallback ─────────────────────────
    const { data: memberships } = await supabaseAdmin
      .from('BusinessTeam')
      .select('business_user_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) return null;

    const businessIds = memberships.map((m) => m.business_user_id);

    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('home_id', homeId)
      .eq('subject_type', 'business')
      .in('subject_id', businessIds)
      .eq('status', 'verified')
      .maybeSingle();

    return authority || null;
  } catch {
    return null;
  }
}

module.exports = requireAuthority;

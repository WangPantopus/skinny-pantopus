/**
 * Authority Resolution Utility
 *
 * Centralizes "does this caller actually hold authority for this home?"
 * resolution. Replaces the pattern of trusting caller-supplied authority_id
 * by resolving authority server-side from the authenticated user.
 *
 * Resolution paths (in order):
 *   1. Direct user authority (HomeAuthority subject_type=user)
 *   2. Seat-based business authority (SeatBinding + BusinessSeat → HomeAuthority subject_type=business)
 *   3. Legacy BusinessTeam-based business authority (transition period)
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

// ============================================================
// resolveVerifiedAuthorityForActor
// ============================================================

/**
 * Resolve a verified HomeAuthority for the given user at the given home.
 *
 * @param {{ userId: string, homeId: string }} params
 * @returns {Promise<{ found: boolean, authority?: object, reason?: string }>}
 */
async function resolveVerifiedAuthorityForActor({ userId, homeId }) {
  if (!userId || !homeId) {
    return { found: false, reason: 'userId and homeId are required' };
  }

  // ── 1. Direct user authority ────────────────────────────────
  const { data: directAuthority, error: directErr } = await supabaseAdmin
    .from('HomeAuthority')
    .select('*')
    .eq('home_id', homeId)
    .eq('subject_type', 'user')
    .eq('subject_id', userId)
    .eq('status', 'verified')
    .maybeSingle();

  if (directErr) {
    logger.error('resolveVerifiedAuthorityForActor: direct query failed', {
      error: directErr.message, userId, homeId,
    });
    return { found: false, reason: 'Failed to query authority' };
  }

  if (directAuthority) {
    return { found: true, authority: directAuthority };
  }

  // ── 2. Seat-based business authority ────────────────────────
  // Find all businesses the user has an active seat at
  const seatAuthority = await _findSeatBasedAuthority(userId, homeId);
  if (seatAuthority) {
    return { found: true, authority: seatAuthority };
  }

  // ── 3. Legacy BusinessTeam fallback ─────────────────────────
  const teamAuthority = await _findBusinessTeamAuthority(userId, homeId);
  if (teamAuthority) {
    return { found: true, authority: teamAuthority };
  }

  return { found: false, reason: 'No verified authority found for this user and home' };
}

/**
 * Check if the user holds a seat at a business that has verified authority
 * for the home (SeatBinding → BusinessSeat → HomeAuthority).
 */
async function _findSeatBasedAuthority(userId, homeId) {
  try {
    // Get all seat bindings for this user
    const { data: bindings } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat_id')
      .eq('user_id', userId);

    if (!bindings || bindings.length === 0) return null;

    const seatIds = bindings.map(b => b.seat_id);

    // Get all active seats and their business IDs
    const { data: seats } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id, business_user_id')
      .in('id', seatIds)
      .eq('is_active', true);

    if (!seats || seats.length === 0) return null;

    const businessIds = [...new Set(seats.map(s => s.business_user_id))];

    // Check if any of those businesses hold verified authority for this home
    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('home_id', homeId)
      .eq('subject_type', 'business')
      .in('subject_id', businessIds)
      .eq('status', 'verified')
      .maybeSingle();

    return authority || null;
  } catch (err) {
    logger.warn('_findSeatBasedAuthority: error (non-fatal)', {
      error: err.message, userId, homeId,
    });
    return null;
  }
}

/**
 * Legacy fallback: check if user is an active member of a business
 * (via BusinessTeam) that holds verified authority for the home.
 */
async function _findBusinessTeamAuthority(userId, homeId) {
  try {
    const { data: memberships } = await supabaseAdmin
      .from('BusinessTeam')
      .select('business_user_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) return null;

    const businessIds = memberships.map(m => m.business_user_id);

    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('home_id', homeId)
      .eq('subject_type', 'business')
      .in('subject_id', businessIds)
      .eq('status', 'verified')
      .maybeSingle();

    return authority || null;
  } catch (err) {
    logger.warn('_findBusinessTeamAuthority: error (non-fatal)', {
      error: err.message, userId, homeId,
    });
    return null;
  }
}

// ============================================================
// assertCallerOwnsLease
// ============================================================

/**
 * Check if a user is allowed to act on a lease — either as a resident
 * or as an authority holder for the lease's home.
 *
 * @param {{ userId: string, leaseId: string }} params
 * @returns {Promise<{ allowed: boolean, lease?: object, authority?: object, reason?: string }>}
 */
async function assertCallerOwnsLease({ userId, leaseId }) {
  if (!userId || !leaseId) {
    return { allowed: false, reason: 'userId and leaseId are required' };
  }

  // ── 1. Fetch the lease ──────────────────────────────────────
  const { data: lease, error: leaseErr } = await supabaseAdmin
    .from('HomeLease')
    .select('*')
    .eq('id', leaseId)
    .maybeSingle();

  if (leaseErr) {
    logger.error('assertCallerOwnsLease: lease query failed', {
      error: leaseErr.message, userId, leaseId,
    });
    return { allowed: false, reason: 'Failed to fetch lease' };
  }

  if (!lease) {
    return { allowed: false, reason: 'Lease not found' };
  }

  // ── 2. Check if user is the primary resident ────────────────
  if (userId === lease.primary_resident_user_id) {
    return { allowed: true, lease };
  }

  // ── 3. Check if user is a co-resident on this lease ─────────
  const { data: resident } = await supabaseAdmin
    .from('HomeLeaseResident')
    .select('id')
    .eq('lease_id', leaseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (resident) {
    return { allowed: true, lease };
  }

  // ── 4. Check if user holds verified authority for the home ──
  const authorityResult = await resolveVerifiedAuthorityForActor({
    userId,
    homeId: lease.home_id,
  });

  if (authorityResult.found) {
    return { allowed: true, lease, authority: authorityResult.authority };
  }

  return { allowed: false, lease, reason: 'User is not a resident and holds no authority for this lease' };
}

module.exports = {
  resolveVerifiedAuthorityForActor,
  assertCallerOwnsLease,
};

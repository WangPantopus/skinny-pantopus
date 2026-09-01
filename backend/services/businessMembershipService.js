// ============================================================
// BUSINESS MEMBERSHIP SERVICE (AUTH-2.3)
//
// Centralized dual-write service that keeps BusinessTeam and
// BusinessSeat + SeatBinding in sync. BusinessTeam remains the
// canonical source during migration; seat failures are logged
// but do not fail the operation.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

/**
 * Add a member to a business — writes to both BusinessTeam and BusinessSeat.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId  - The business (BusinessUser) ID
 * @param {string} opts.userId          - The user being added
 * @param {string} opts.roleBase        - Role to assign (viewer, staff, editor, admin, owner)
 * @param {string} [opts.displayName]   - Display name / title
 * @param {string} [opts.invitedBy]     - Actor who invited
 * @param {string} [opts.email]         - User's email (for seat record)
 * @param {string} [opts.notes]         - Optional notes
 * @returns {{ team: object|null, seat: object|null, binding: object|null, error: string|null }}
 */
async function addMember({ businessUserId, userId, roleBase, displayName, invitedBy, email, notes }) {
  const now = new Date().toISOString();

  // ── 1. Primary write: BusinessTeam ──────────────────────────
  // Check for existing (possibly deactivated) membership
  const { data: existing } = await supabaseAdmin
    .from('BusinessTeam')
    .select('id, is_active')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .maybeSingle();

  let team = null;

  if (existing && existing.is_active) {
    return { team: null, seat: null, binding: null, error: 'User is already a team member' };
  }

  if (existing) {
    // Reactivate
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessTeam')
      .update({
        is_active: true,
        role_base: roleBase,
        title: displayName || null,
        notes: notes || null,
        invited_by: invitedBy || null,
        invited_at: now,
        joined_at: now,
        left_at: null,
        updated_at: now,
      })
      .eq('id', existing.id);

    if (updateErr) {
      logger.error('addMember: failed to reactivate BusinessTeam row', { error: updateErr.message });
      return { team: null, seat: null, binding: null, error: 'Failed to add member' };
    }
    team = { id: existing.id, reactivated: true };
  } else {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('BusinessTeam')
      .insert({
        business_user_id: businessUserId,
        user_id: userId,
        role_base: roleBase,
        title: displayName || null,
        notes: notes || null,
        invited_by: invitedBy || null,
        invited_at: now,
        joined_at: now,
      })
      .select('id')
      .maybeSingle();

    if (insertErr) {
      logger.error('addMember: failed to insert BusinessTeam row', { error: insertErr.message });
      return { team: null, seat: null, binding: null, error: 'Failed to add member' };
    }
    team = inserted || { id: null };
  }

  // ── 2. Secondary write: BusinessSeat + SeatBinding ──────────
  let seat = null;
  let binding = null;

  try {
    const { data: seatData, error: seatErr } = await supabaseAdmin
      .from('BusinessSeat')
      .insert({
        business_user_id: businessUserId,
        role_base: roleBase,
        display_name: displayName || null,
        email: email || null,
        notes: notes || null,
        invite_status: 'accepted',
        accepted_at: now,
        is_active: true,
        invited_by_seat_id: null,
      })
      .select('id')
      .maybeSingle();

    if (seatErr) throw seatErr;
    seat = seatData;

    if (seat) {
      const { data: bindData, error: bindErr } = await supabaseAdmin
        .from('SeatBinding')
        .insert({
          seat_id: seat.id,
          user_id: userId,
          binding_method: 'iam_add',
        })
        .select('id')
        .maybeSingle();

      if (bindErr) throw bindErr;
      binding = bindData;
    }
  } catch (seatError) {
    logger.warn('addMember: dual-write to BusinessSeat failed (non-fatal)', {
      error: seatError.message || seatError,
      businessUserId,
      userId,
    });
  }

  return { team, seat, binding, error: null };
}

/**
 * Update a member's role in both BusinessTeam and BusinessSeat.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId
 * @param {string} opts.userId
 * @param {string} opts.newRoleBase
 * @returns {{ updated: boolean, error: string|null }}
 */
async function updateMemberRole({ businessUserId, userId, newRoleBase }) {
  const now = new Date().toISOString();

  // ── 1. Primary: update BusinessTeam ─────────────────────────
  const { error: teamErr } = await supabaseAdmin
    .from('BusinessTeam')
    .update({
      role_base: newRoleBase,
      updated_at: now,
    })
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (teamErr) {
    logger.error('updateMemberRole: BusinessTeam update failed', { error: teamErr.message });
    return { updated: false, error: 'Failed to update role' };
  }

  // ── 2. Secondary: update BusinessSeat via SeatBinding ───────
  try {
    const { data: bindings } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat_id')
      .eq('user_id', userId);

    if (bindings && bindings.length > 0) {
      const seatIds = bindings.map((b) => b.seat_id);

      for (const seatId of seatIds) {
        // Only update seats belonging to this business
        await supabaseAdmin
          .from('BusinessSeat')
          .update({ role_base: newRoleBase, updated_at: now })
          .eq('id', seatId)
          .eq('business_user_id', businessUserId);
      }
    }
  } catch (seatError) {
    logger.warn('updateMemberRole: dual-write to BusinessSeat failed (non-fatal)', {
      error: seatError.message || seatError,
      businessUserId,
      userId,
    });
  }

  return { updated: true, error: null };
}

/**
 * Remove a member from a business — soft-deactivates in both tables
 * and cleans up overrides.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId
 * @param {string} opts.userId
 * @param {string} [opts.reason]
 * @returns {{ removed: boolean, error: string|null }}
 */
async function removeMember({ businessUserId, userId, reason }) {
  const now = new Date().toISOString();

  // ── 1. Primary: deactivate BusinessTeam ─────────────────────
  const { error: teamErr } = await supabaseAdmin
    .from('BusinessTeam')
    .update({
      is_active: false,
      left_at: now,
      updated_at: now,
    })
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId);

  if (teamErr) {
    logger.error('removeMember: BusinessTeam deactivation failed', { error: teamErr.message });
    return { removed: false, error: 'Failed to remove member' };
  }

  // ── 2. Clean up permission overrides ────────────────────────
  await supabaseAdmin
    .from('BusinessPermissionOverride')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId);

  // ── 3. Secondary: deactivate BusinessSeat + delete SeatBinding
  try {
    const { data: bindings } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat_id')
      .eq('user_id', userId);

    if (bindings && bindings.length > 0) {
      const seatIds = bindings.map((b) => b.seat_id);

      for (const seatId of seatIds) {
        await supabaseAdmin
          .from('BusinessSeat')
          .update({
            is_active: false,
            deactivated_at: now,
            deactivated_reason: reason || 'removed',
            updated_at: now,
          })
          .eq('id', seatId)
          .eq('business_user_id', businessUserId);
      }

      // Delete SeatBinding rows
      for (const seatId of seatIds) {
        await supabaseAdmin
          .from('SeatBinding')
          .delete()
          .eq('seat_id', seatId)
          .eq('user_id', userId);
      }
    }
  } catch (seatError) {
    logger.warn('removeMember: dual-write to BusinessSeat failed (non-fatal)', {
      error: seatError.message || seatError,
      businessUserId,
      userId,
    });
  }

  return { removed: true, error: null };
}

module.exports = {
  addMember,
  updateMemberRole,
  removeMember,
};

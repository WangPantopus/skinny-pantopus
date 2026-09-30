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

// The active seat bound to this user at this business, if any. A user holds one binding per seat, across
// every business they belong to.
async function findActiveSeat(businessUserId, userId) {
  const { data: bindings, error: bindErr } = await supabaseAdmin
    .from('SeatBinding')
    .select('seat_id')
    .eq('user_id', userId);
  if (bindErr) throw bindErr;
  if (!bindings || bindings.length === 0) return null;

  const { data: seats, error: seatErr } = await supabaseAdmin
    .from('BusinessSeat')
    .select('id, role_base')
    .in('id', bindings.map((b) => b.seat_id))
    .eq('business_user_id', businessUserId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (seatErr) throw seatErr;
  return seats?.[0] || null;
}

// A seat is named as migration 20260930184000 names the seats it backfills: by the member's team title (a
// manager's "Front Desk", or "Owner" for the business's creator), else by their first name. display_name is
// required.
async function seatDisplayName(businessUserId, userId, title) {
  let teamTitle = (title || '').trim();
  if (!teamTitle) {
    const { data: team } = await supabaseAdmin
      .from('BusinessTeam')
      .select('title')
      .eq('business_user_id', businessUserId)
      .eq('user_id', userId)
      .maybeSingle();
    teamTitle = (team?.title || '').trim();
  }
  if (teamTitle) return teamTitle;
  const { data: user } = await supabaseAdmin
    .from('User')
    .select('first_name, name')
    .eq('id', userId)
    .maybeSingle();
  return (user?.first_name || '').trim() || (user?.name || '').trim().split(/\s+/)[0] || 'Team Member';
}

/**
 * Make sure the member holds an active, bound seat at the business: the identity the seat-based features
 * read (dashboard Team tab, seat invites, Profiles & Privacy, business messaging). An active seat they
 * already hold there is kept and given the role; otherwise a seat and its binding are created.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId
 * @param {string} opts.userId
 * @param {string} opts.roleBase
 * @param {string} [opts.title]
 * @param {string} [opts.notes]
 * @param {string} opts.bindingMethod - seat_binding_method: 'owner_bootstrap' or 'iam_add'
 * @returns {{ seat: object, binding: object|null, created: boolean }}
 */
async function ensureSeat({ businessUserId, userId, roleBase, title, notes, bindingMethod }) {
  const now = new Date().toISOString();

  const existing = await findActiveSeat(businessUserId, userId);
  if (existing) {
    if (existing.role_base !== roleBase) {
      const { error: roleErr } = await supabaseAdmin
        .from('BusinessSeat')
        .update({ role_base: roleBase, updated_at: now })
        .eq('id', existing.id);
      if (roleErr) throw roleErr;
    }
    return { seat: { id: existing.id }, binding: null, created: false };
  }

  const { data: seat, error: seatErr } = await supabaseAdmin
    .from('BusinessSeat')
    .insert({
      business_user_id: businessUserId,
      role_base: roleBase,
      display_name: await seatDisplayName(businessUserId, userId, title),
      notes: notes || null,
      invite_status: 'accepted',
      accepted_at: now,
      is_active: true,
    })
    .select('id')
    .single();
  if (seatErr) throw seatErr;

  const { data: binding, error: bindErr } = await supabaseAdmin
    .from('SeatBinding')
    .insert({ seat_id: seat.id, user_id: userId, binding_method: bindingMethod })
    .select('seat_id, binding_method')
    .single();
  if (bindErr) {
    // An unbound seat would sit on the Team tab with nobody holding it.
    await supabaseAdmin.from('BusinessSeat').delete().eq('id', seat.id);
    throw bindErr;
  }

  return { seat, binding, created: true };
}

/**
 * Add a member to a business — writes to both BusinessTeam and BusinessSeat.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId  - The business (BusinessUser) ID
 * @param {string} opts.userId          - The user being added
 * @param {string} opts.roleBase        - Role to assign (viewer, staff, editor, admin, owner)
 * @param {string} [opts.displayName]   - Display name / title
 * @param {string} [opts.invitedBy]     - Actor who invited
 * @param {string} [opts.notes]         - Optional notes
 * @returns {{ team: object|null, seat: object|null, binding: object|null, error: string|null }}
 */
async function addMember({ businessUserId, userId, roleBase, displayName, invitedBy, notes }) {
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
    ({ seat, binding } = await ensureSeat({
      businessUserId,
      userId,
      roleBase,
      title: displayName,
      notes,
      bindingMethod: 'iam_add',
    }));
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
      // Only this business's seats: the member keeps the seats they hold at other businesses.
      const { data: seats, error: seatsErr } = await supabaseAdmin
        .from('BusinessSeat')
        .select('id')
        .in('id', bindings.map((b) => b.seat_id))
        .eq('business_user_id', businessUserId);
      if (seatsErr) throw seatsErr;
      const seatIds = (seats || []).map((s) => s.id);

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
  ensureSeat,
  updateMemberRole,
  removeMember,
};

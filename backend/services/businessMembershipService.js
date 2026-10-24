// ============================================================
// BUSINESS MEMBERSHIP SERVICE (AUTH-2.3)
//
// Centralized dual-write service that keeps BusinessTeam and
// BusinessSeat + SeatBinding in sync. BusinessTeam remains the
// canonical source during migration. Both grant access (the IAM
// routes read BusinessTeam, the seat routes read the seat), so
// every write is checked: a change reports success only once
// both hold it, and repeating a failed change finishes it.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// This business's seats bound to the user (any state unless activeOnly). Throws when a read fails.
async function boundSeats(businessUserId, userId, { activeOnly = false } = {}) {
  const { data: bindings, error: bindErr } = await supabaseAdmin
    .from('SeatBinding')
    .select('seat_id')
    .eq('user_id', userId);
  if (bindErr) throw bindErr;
  if (!bindings || bindings.length === 0) return [];

  let query = supabaseAdmin
    .from('BusinessSeat')
    .select('id, role_base, is_active')
    .in('id', bindings.map((b) => b.seat_id))
    .eq('business_user_id', businessUserId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data: seats, error: seatErr } = await query;
  if (seatErr) throw seatErr;
  return seats || [];
}

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
// manager's "Front Desk", or "Owner" for the business's creator), else by their first name. Someone with a Local
// Profile goes by its name instead, as teammates see them everywhere else. display_name is required.
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
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('User').select('first_name, name').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('LocalProfile').select('display_name').eq('user_id', userId).maybeSingle(),
  ]);
  return (profile?.display_name || '').trim()
    || (user?.first_name || '').trim() || (user?.name || '').trim().split(/\s+/)[0] || 'Team Member';
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
 *   error 'Failed to add member' when a read or write failed; adding them again finishes the work.
 */
async function addMember({ businessUserId, userId, roleBase, displayName, invitedBy, notes }) {
  const now = new Date().toISOString();
  const failed = { team: null, seat: null, binding: null, error: 'Failed to add member' };

  // ── 1. Primary write: BusinessTeam ──────────────────────────
  // Check for existing (possibly deactivated) membership
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('BusinessTeam')
    .select('id, is_active, role_base, title, notes')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingErr) {
    logger.error('addMember: BusinessTeam read failed', { error: existingErr.message, businessUserId, userId });
    return failed;
  }

  let team = null;

  if (existing && existing.is_active) {
    // An earlier add that failed after writing this row left them without a seat: give them one now.
    try {
      if (!(await findActiveSeat(businessUserId, userId))) {
        await ensureSeat({
          businessUserId,
          userId,
          roleBase: existing.role_base,
          title: existing.title,
          notes: existing.notes,
          bindingMethod: 'iam_add',
        });
      }
    } catch (seatError) {
      logger.error('addMember: seat for an existing member failed', {
        error: seatError.message, businessUserId, userId,
      });
      return failed;
    }
    return { team: null, seat: null, binding: null, error: 'User is already a team member' };
  }

  // Overrides left from an earlier membership (a removal that failed part way, or an override set while they
  // weren't on the team) must not apply to the new one: a new member starts from their role's defaults.
  const { error: staleErr } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId);
  if (staleErr) {
    logger.error('addMember: clearing old permission overrides failed', {
      error: staleErr.message, businessUserId, userId,
    });
    return failed;
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
  // The seat-based features (Team tab, seat invites, business messaging) need it. If it fails the member stays
  // added without one; adding them again gives them the seat (the existing-member path above).
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
    logger.error('addMember: seat write failed', {
      error: seatError.message || seatError,
      businessUserId,
      userId,
    });
    return failed;
  }

  return { team, seat, binding, error: null };
}

/**
 * Update a member's role on their team row and on their active seats at this business.
 *
 * The team row goes first, then the seats. The writes can't share a transaction, so a failure part way leaves
 * each row with its old or its new role, never another; the caller reports the failure and repeating the change
 * finishes it.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId
 * @param {string} opts.userId
 * @param {string} opts.newRoleBase
 * @returns {{ updated: boolean, notMember?: boolean, error: string|null }} notMember: no active team row (nothing
 *   changed)
 */
async function updateMemberRole({ businessUserId, userId, newRoleBase }) {
  const now = new Date().toISOString();

  try {
    const seats = await boundSeats(businessUserId, userId, { activeOnly: true });

    // ── 1. Primary: update BusinessTeam ─────────────────────────
    const { data: rows, error: teamErr } = await supabaseAdmin
      .from('BusinessTeam')
      .update({
        role_base: newRoleBase,
        updated_at: now,
      })
      .eq('business_user_id', businessUserId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .select('id');
    if (teamErr) throw teamErr;
    if (!rows || rows.length === 0) return { updated: false, notMember: true, error: 'Not a member of this team' };

    // ── 2. Secondary: their seats here ──────────────────────────
    if (seats.length > 0) {
      const { error: seatErr } = await supabaseAdmin
        .from('BusinessSeat')
        .update({ role_base: newRoleBase, updated_at: now })
        .in('id', seats.map((s) => s.id))
        .eq('business_user_id', businessUserId);
      if (seatErr) throw seatErr;
    }
  } catch (err) {
    logger.error('updateMemberRole: role change incomplete', { error: err.message || err, businessUserId, userId });
    return { updated: false, error: 'Failed to update role' };
  }

  return { updated: true, error: null };
}

/**
 * Remove a member from a business: their team row, their seats here and their permission overrides.
 *
 * The team row (IAM routes) and a bound, active seat (seat routes) each grant access, and the writes can't share a
 * transaction, so every step is checked and ordered to leave no access behind when one fails:
 *   1. the team row; if it fails, nothing has changed;
 *   2. the seats; if that fails, their bindings are deleted instead, which also ends a seat's access (the seat
 *      stays listed, held by nobody, until it is removed from the Team tab);
 *   3. the overrides, once nothing grants access: a deny deleted earlier would widen what a remaining row allows;
 *   4. the bindings, last, since a retry finds the seats through them.
 * Calling it again after a failure finishes the removal. Reports removed only when every step succeeded.
 *
 * @param {Object} opts
 * @param {string} opts.businessUserId
 * @param {string} opts.userId
 * @param {string} [opts.reason]
 * @returns {{ removed: boolean, error: string|null }}
 */
async function removeMember({ businessUserId, userId, reason }) {
  const now = new Date().toISOString();
  const failed = (err) => {
    logger.error('removeMember: removal incomplete', { error: err.message || err, businessUserId, userId });
    return { removed: false, error: 'Failed to remove member' };
  };

  let seatIds;
  try {
    // Only this business's seats: the member keeps the seats they hold at other businesses.
    seatIds = (await boundSeats(businessUserId, userId)).map((s) => s.id);
  } catch (err) {
    return failed(err);
  }
  const deleteBindings = () => supabaseAdmin
    .from('SeatBinding')
    .delete()
    .in('seat_id', seatIds)
    .eq('user_id', userId);

  // ── 1. Primary: deactivate BusinessTeam ─────────────────────
  const { error: teamErr } = await supabaseAdmin
    .from('BusinessTeam')
    .update({
      is_active: false,
      left_at: now,
      updated_at: now,
    })
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .eq('is_active', true);
  if (teamErr) return failed(teamErr);

  // ── 2. Deactivate their seats here ──────────────────────────
  if (seatIds.length > 0) {
    const { error: seatErr } = await supabaseAdmin
      .from('BusinessSeat')
      .update({
        is_active: false,
        deactivated_at: now,
        deactivated_reason: reason || 'removed',
        updated_at: now,
      })
      .in('id', seatIds)
      .eq('business_user_id', businessUserId)
      .eq('is_active', true);
    if (seatErr) {
      // A seat that is still active stops granting access once nobody is bound to it.
      const { error: unbindErr } = await deleteBindings();
      if (unbindErr) {
        logger.error('removeMember: unbinding the seats failed too', {
          error: unbindErr.message, businessUserId, userId,
        });
      }
      return failed(seatErr);
    }
  }

  // ── 3. Clean up permission overrides ────────────────────────
  const { error: overrideErr } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId);
  if (overrideErr) return failed(overrideErr);

  // ── 4. Delete the seat bindings ─────────────────────────────
  if (seatIds.length > 0) {
    const { error: bindErr } = await deleteBindings();
    if (bindErr) return failed(bindErr);
  }

  return { removed: true, error: null };
}

/**
 * Apply a role preset to a member: the preset's role, its grants and denies, and no other overrides.
 *
 * The writes can't share a transaction, so they run in an order where no state between them allows anything
 * that neither the old setup nor the preset allows: the preset's denies first, then the role, then its grants,
 * then removing every other override. A failure part way is reported and applying the preset again finishes it.
 *
 * @returns {{ applied: boolean, notMember?: boolean, error: string|null }}
 */
async function applyRolePreset({ businessUserId, userId, preset, actorId }) {
  const now = new Date().toISOString();
  // A permission the preset both grants and denies is denied, as when the denies were written last.
  const denies = [...new Set(preset.deny_perms || [])];
  const grants = [...new Set(preset.grant_perms || [])].filter((perm) => !denies.includes(perm));
  const overrides = (perms, allowed) => perms.map((permission) => ({
    business_user_id: businessUserId,
    user_id: userId,
    permission,
    allowed,
    created_by: actorId,
    updated_at: now,
  }));
  const upsertOverrides = (perms, allowed) => supabaseAdmin
    .from('BusinessPermissionOverride')
    .upsert(overrides(perms, allowed), { onConflict: 'business_user_id,user_id,permission' });

  try {
    if (denies.length > 0) {
      const { error } = await upsertOverrides(denies, false);
      if (error) throw error;
    }

    const roleResult = await updateMemberRole({ businessUserId, userId, newRoleBase: preset.role_base });
    if (roleResult.notMember) return { applied: false, notMember: true, error: roleResult.error };
    if (roleResult.error) return { applied: false, error: 'Failed to apply preset' };

    if (grants.length > 0) {
      const { error } = await upsertOverrides(grants, true);
      if (error) throw error;
    }

    let others = supabaseAdmin
      .from('BusinessPermissionOverride')
      .delete()
      .eq('business_user_id', businessUserId)
      .eq('user_id', userId);
    const kept = [...denies, ...grants];
    if (kept.length > 0) others = others.not('permission', 'in', `(${kept.map((perm) => `"${perm}"`).join(',')})`);
    const { error: othersErr } = await others;
    if (othersErr) throw othersErr;
  } catch (err) {
    logger.error('applyRolePreset: preset incomplete', { error: err.message || err, businessUserId, userId });
    return { applied: false, error: 'Failed to apply preset' };
  }

  return { applied: true, error: null };
}

module.exports = {
  addMember,
  ensureSeat,
  updateMemberRole,
  removeMember,
  applyRolePreset,
};

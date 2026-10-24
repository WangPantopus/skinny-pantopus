/**
 * Business IAM Routes
 *
 * Team management endpoints for businesses. Mirrors homeIam.js style.
 * Mount at: app.use('/api/businesses', require('./routes/businessIam'));
 *
 * Endpoints:
 *   GET    /:businessId/me                                — Current user's access & permissions
 *   GET    /:businessId/role-presets                       — Available role presets
 *   GET    /:businessId/members                            — List team members
 *   POST   /:businessId/members                            — Invite / add team member
 *   POST   /:businessId/members/:userId/role               — Update member role/preset
 *   POST   /:businessId/members/:userId/permissions        — Toggle specific permissions
 *   GET    /:businessId/members/:userId/permissions        — Get member's permissions
 *   DELETE /:businessId/members/:userId                    — Remove member
 *   GET    /:businessId/audit-log                          — View audit log
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { invalidateRoleCache } = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const {
  checkBusinessPermission,
  getUserAccess,
  hasPermission,
  getRoleRank,
  writeAuditLog,
  assertCanMutateTarget,
  assertCanGrantPermission,
  authorizationUnavailable,
  BUSINESS_ROLE_RANK,
} = require('../utils/businessPermissions');
const membershipService = require('../services/businessMembershipService');
const { loadChatPeople, chatPersonRow } = require('../services/chatPeople');

// A team change that could not be read or finished answers 503 with what didn't happen; trying again finishes it.
function teamUnavailable(res, error) {
  return res.status(503).json({ error, code: 'BUSINESS_TEAM_UNAVAILABLE' });
}

// A failed access read (utils/businessPermissions authorizationUnavailable) answers 503 with its own message.
function accessUnavailableResponse(res, err) {
  if (err?.code !== 'AUTHORIZATION_UNAVAILABLE') return false;
  res.status(503).json({ error: err.message, code: err.code });
  return true;
}

// The acting member's role, read strictly. They passed the permission check, so no row now means the lowest rank.
async function readActorRole(businessId, actorId) {
  const { data, error } = await supabaseAdmin
    .from('BusinessTeam')
    .select('role_base')
    .eq('business_user_id', businessId)
    .eq('user_id', actorId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw authorizationUnavailable();
  return data?.role_base || 'viewer';
}

// The target's roles here: their active team row's role and their active seats' roles. Rank checks compare the
// highest of them, so a check can't pass on whichever row holds the lower role. A failed read throws (503): it
// must never read as 'viewer' or as "not the owner".
async function readTargetRoles(businessId, userId) {
  const [{ data: team, error: teamError }, { data: bindings, error: bindingError }] = await Promise.all([
    supabaseAdmin
      .from('BusinessTeam')
      .select('role_base')
      .eq('business_user_id', businessId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin.from('SeatBinding').select('seat_id').eq('user_id', userId),
  ]);
  if (teamError || bindingError) throw authorizationUnavailable();

  let seatRoles = [];
  if (bindings && bindings.length > 0) {
    const { data: seats, error: seatError } = await supabaseAdmin
      .from('BusinessSeat')
      .select('role_base')
      .in('id', bindings.map((b) => b.seat_id))
      .eq('business_user_id', businessId)
      .eq('is_active', true);
    if (seatError) throw authorizationUnavailable();
    seatRoles = (seats || []).map((s) => s.role_base);
  }

  const teamRole = team?.role_base || null;
  const highestRole = [teamRole, ...seatRoles].filter(Boolean)
    .reduce((top, role) => (!top || getRoleRank(role) > getRoleRank(top) ? role : top), null);
  return { teamRole, highestRole };
}


// ============================================================
// GET /:businessId/me — Current user's access for this business
// ============================================================

router.get('/:businessId/me', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await getUserAccess(businessId, userId);

    if (!access.hasAccess) {
      return res.status(403).json({
        hasAccess: false,
        role_base: null,
        permissions: [],
      });
    }

    res.json({
      hasAccess: true,
      isOwner: access.isOwner,
      role_base: access.role_base,
      permissions: access.permissions,
      membership: access.membership ? {
        id: access.membership.id,
        role_base: access.role_base,
        title: access.membership.title,
        joined_at: access.membership.joined_at,
      } : null,
    });
  } catch (err) {
    logger.error('GET business /me error', { error: err.message, businessId: req.params.businessId });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to load access info' });
  }
});


// ============================================================
// GET /:businessId/role-presets — List available role presets
// ============================================================

router.get('/:businessId/role-presets', verifyToken, async (req, res) => {
  try {
    const { data: presets, error } = await supabaseAdmin
      .from('BusinessRolePreset')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error fetching business role presets', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch presets' });
    }

    res.json({ presets: presets || [] });
  } catch (err) {
    logger.error('Business role presets error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});


// ============================================================
// GET /:businessId/members — List team members
// ============================================================

router.get('/:businessId/members', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'team.view', { throwOnError: true });
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to view team' });
    }

    const { data: members, error } = await supabaseAdmin
      .from('BusinessTeam')
      .select(`
        id,
        role_base,
        title,
        joined_at,
        invited_at,
        notes,
        user:user_id (
          id, username, name, email, profile_picture_url
        )
      `)
      .eq('business_user_id', businessId)
      .eq('is_active', true)
      .order('role_base');

    if (error) {
      logger.error('Error fetching business members', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    // Teammates name each other as everyone else names them, by the Local Profile's name, handle and photo
    // (services/chatPeople.js), not by the account behind the seat (identity firewall design §9.3). `id` stays the
    // account id the role, permission and removal routes take. An account's email is its owner's alone: each member
    // sees only their own.
    const people = await loadChatPeople((members || []).map((m) => m.user?.id));
    res.json({
      members: (members || []).map((m) => {
        const user = chatPersonRow(m.user, people);
        return { ...m, user: user && String(user.id) !== String(userId) ? { ...user, email: null } : user };
      }),
    });
  } catch (err) {
    logger.error('Business members error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});


// ============================================================
// POST /:businessId/members — Invite / add team member
// ============================================================

router.post('/:businessId/members', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const actorId = req.user.id;

    const access = await checkBusinessPermission(businessId, actorId, 'team.invite', { throwOnError: true });
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to invite members' });
    }

    const { user_id, username, role_base = 'viewer', title, notes } = req.body;

    // Resolve user by ID or username
    let targetUserId = user_id;
    if (!targetUserId && username) {
      const { data: user, error: userError } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (userError) {
        return teamUnavailable(res, "Couldn't look up that username right now. Please try again.");
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'user_id or username is required' });
    }

    // Validate role
    const validRoles = Object.keys(BUSINESS_ROLE_RANK);
    if (!validRoles.includes(role_base)) {
      return res.status(400).json({ error: `Invalid role: ${role_base}` });
    }

    // Only owner can add owner
    if (role_base === 'owner' && !access.isOwner) {
      return res.status(403).json({ error: 'Only the owner can add another owner' });
    }

    // As with seat invites, someone who isn't an owner adds only roles below their own: an invite permission
    // granted to a staff member must not let them add an admin.
    if (!access.isOwner) {
      const assignCheck = assertCanMutateTarget(await readActorRole(businessId, actorId), role_base);
      if (!assignCheck.allowed) {
        return res.status(403).json({ error: `Cannot add a member as '${role_base}': ${assignCheck.reason}` });
      }
    }

    // Dual-write via membership service (AUTH-2.3)
    const addResult = await membershipService.addMember({
      businessUserId: businessId,
      userId: targetUserId,
      roleBase: role_base,
      displayName: title,
      invitedBy: actorId,
      notes,
    });

    if (addResult.error === 'User is already a team member') {
      return res.status(409).json({ error: addResult.error });
    }
    if (addResult.error) {
      return teamUnavailable(res, "Couldn't finish adding this member. Please try again.");
    }

    await writeAuditLog(businessId, actorId, 'invite_member', 'BusinessTeam', targetUserId, {
      role_base,
      title,
    });

    res.status(201).json({ message: 'Member added', user_id: targetUserId, role_base });
  } catch (err) {
    logger.error('Add business member error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to add member' });
  }
});


// ============================================================
// POST /:businessId/members/:userId/role — Update member role/preset
// ============================================================

router.post('/:businessId/members/:userId/role', verifyToken, async (req, res) => {
  try {
    const { businessId, userId: targetUserId } = req.params;
    const actorId = req.user.id;

    const access = await checkBusinessPermission(businessId, actorId, 'team.manage', { throwOnError: true });
    if (!access.hasAccess) {
      logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'No permission to manage team' });
    }

    const { preset_key, role_base, title } = req.body;
    let preset = null;
    if (preset_key) {
      const { data, error } = await supabaseAdmin
        .from('BusinessRolePreset')
        .select('*')
        .eq('key', preset_key)
        .maybeSingle();
      if (error) {
        return teamUnavailable(res, "Couldn't load that role preset right now. Please try again.");
      }
      if (!data) {
        return res.status(400).json({ error: 'Unknown role preset' });
      }
      preset = data;
    } else if (!role_base) {
      return res.status(400).json({ error: 'preset_key or role_base is required' });
    } else if (!Object.keys(BUSINESS_ROLE_RANK).includes(role_base)) {
      return res.status(400).json({ error: `Invalid role_base: ${role_base}` });
    }
    const requestedRole = preset?.role_base || role_base;

    // Prevent demoting self from owner
    if (targetUserId === actorId && access.isOwner && requestedRole && requestedRole !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote yourself from owner. Transfer ownership instead.' });
    }

    // Prevent promoting to owner unless you are owner
    if (requestedRole === 'owner' && !access.isOwner) {
      logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: 'non_owner_promote_to_owner', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'Only the owner can promote to owner' });
    }
    if (requestedRole && !access.isOwner && targetUserId === actorId) {
      const assignCheck = assertCanMutateTarget(access.membership?.role_base || 'viewer', requestedRole);
      if (!assignCheck.allowed) {
        return res.status(403).json({ error: `Cannot assign role '${requestedRole}': ${assignCheck.reason}` });
      }
    }

    // ── Rank enforcement (AUTH-1.5) ──────────────────────────
    if (targetUserId !== actorId) {
      const [actorRoleBase, target] = await Promise.all([
        readActorRole(businessId, actorId),
        readTargetRoles(businessId, targetUserId),
      ]);
      if (!target.teamRole) {
        return res.status(404).json({ error: 'This person is not on the team' });
      }

      const mutateCheck = assertCanMutateTarget(actorRoleBase, target.highestRole);
      if (!mutateCheck.allowed) {
        logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: mutateCheck.reason, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: mutateCheck.reason });
      }

      const assignCheck = assertCanMutateTarget(actorRoleBase, requestedRole);
      if (!assignCheck.allowed) {
        logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: assignCheck.reason, new_role: requestedRole, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: `Cannot assign role '${requestedRole}': ${assignCheck.reason}` });
      }
    }

    // Preset or direct role, via the membership service (AUTH-2.3). Each reports success only once every write
    // held; a failure part way is answered 503, and sending the same change again finishes it.
    const result = preset
      ? await membershipService.applyRolePreset({ businessUserId: businessId, userId: targetUserId, preset, actorId })
      : await membershipService.updateMemberRole({ businessUserId: businessId, userId: targetUserId, newRoleBase: role_base });
    invalidateRoleCache(targetUserId); // AUTH-3.4
    if (result.notMember) {
      return res.status(404).json({ error: 'This person is not on the team' });
    }
    const failedMessage = preset
      ? "Couldn't finish applying this preset. Please try again."
      : "Couldn't finish changing this role. Please try again.";
    if (result.error) {
      return teamUnavailable(res, failedMessage);
    }

    // Title update is separate (not part of dual-write concern)
    if (title !== undefined) {
      const { error: titleError } = await supabaseAdmin
        .from('BusinessTeam')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('business_user_id', businessId)
        .eq('user_id', targetUserId)
        .eq('is_active', true);
      if (titleError) {
        logger.error('Business member title update failed', { error: titleError.message, businessId, targetUserId });
        return teamUnavailable(res, failedMessage);
      }
    }

    if (preset) {
      await writeAuditLog(businessId, actorId, 'apply_role_preset', 'BusinessTeam', targetUserId, {
        preset_key,
        role_base: preset.role_base,
      });
      logger.info('auth.action', { event: 'role_changed', actor_id: actorId, target_id: targetUserId, business_id: businessId, preset_key, new_role: preset.role_base });
      return res.json({ message: 'Preset applied', preset_key, role_base: preset.role_base });
    }

    await writeAuditLog(businessId, actorId, 'change_role', 'BusinessTeam', targetUserId, {
      new_role_base: role_base,
    });
    logger.info('auth.action', { event: 'role_changed', actor_id: actorId, target_id: targetUserId, business_id: businessId, new_role: role_base });
    return res.json({ message: 'Role updated', role_base });
  } catch (err) {
    logger.error('Update business member role error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to update role' });
  }
});


// ============================================================
// POST /:businessId/members/:userId/permissions — Toggle permissions
// ============================================================

router.post('/:businessId/members/:userId/permissions', verifyToken, async (req, res) => {
  try {
    const { businessId, userId: targetUserId } = req.params;
    const actorId = req.user.id;

    const access = await checkBusinessPermission(businessId, actorId, 'team.manage', { throwOnError: true });
    if (!access.hasAccess) {
      logger.warn('auth.denied', { event: 'permission_override_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'No permission to manage team' });
    }

    const { permission, allowed } = req.body;

    if (!permission || typeof allowed !== 'boolean') {
      return res.status(400).json({ error: 'permission (string) and allowed (boolean) are required' });
    }

    // ── Rank enforcement (AUTH-1.5) ──────────────────────────
    const [actorRoleBase, target] = await Promise.all([
      readActorRole(businessId, actorId),
      readTargetRoles(businessId, targetUserId),
    ]);
    // An override belongs to a membership: one written for someone off the team would apply when they join.
    if (!target.teamRole) {
      return res.status(404).json({ error: 'This person is not on the team' });
    }

    const mutateCheck = assertCanMutateTarget(actorRoleBase, target.highestRole);
    if (!mutateCheck.allowed) {
      logger.warn('auth.denied', { event: 'permission_override_denied', actor_id: actorId, target_id: targetUserId, reason: mutateCheck.reason, business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: mutateCheck.reason });
    }

    if (allowed) {
      const grantCheck = await assertCanGrantPermission(actorRoleBase, permission);
      if (!grantCheck.allowed) {
        logger.warn('auth.denied', { event: 'permission_override_denied', actor_id: actorId, target_id: targetUserId, reason: grantCheck.reason, permission, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: grantCheck.reason });
      }
    }

    const { error } = await supabaseAdmin
      .from('BusinessPermissionOverride')
      .upsert({
        business_user_id: businessId,
        user_id: targetUserId,
        permission,
        allowed,
        created_by: actorId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_user_id,user_id,permission' });

    if (error) {
      logger.error('Error toggling business permission', { error: error.message, errorCode: error.code });
      // 22P02: not a value of the business_permission enum.
      if (error.code === '22P02') return res.status(400).json({ error: `Unknown permission: ${permission}` });
      return teamUnavailable(res, "Couldn't update this permission right now. Please try again.");
    }

    await writeAuditLog(businessId, actorId, 'toggle_permission', 'BusinessPermissionOverride', targetUserId, {
      permission,
      allowed,
    });

    res.json({ message: 'Permission updated', permission, allowed });
  } catch (err) {
    logger.error('Toggle business permission error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to update permission' });
  }
});


// ============================================================
// GET /:businessId/members/:userId/permissions — Get member's permissions
// ============================================================

router.get('/:businessId/members/:userId/permissions', verifyToken, async (req, res) => {
  try {
    const { businessId, userId: targetUserId } = req.params;
    const actorId = req.user.id;

    // Can view own permissions or need team.view (a member someone denied the team view can't read the others')
    if (targetUserId !== actorId) {
      const canView = await hasPermission(businessId, actorId, 'team.view', { throwOnError: true });
      if (!canView) {
        return res.status(403).json({ error: 'No permission to view team' });
      }
    }

    const access = await getUserAccess(businessId, targetUserId);
    res.json({
      permissions: access.permissions,
      role_base: access.role_base,
    });
  } catch (err) {
    logger.error('Get business member permissions error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});


// ============================================================
// DELETE /:businessId/members/:userId — Remove member
// ============================================================

router.delete('/:businessId/members/:userId', verifyToken, async (req, res) => {
  try {
    const { businessId, userId: targetUserId } = req.params;
    const actorId = req.user.id;

    // Self-removal is always allowed
    const isSelf = targetUserId === actorId;

    if (!isSelf) {
      const access = await checkBusinessPermission(businessId, actorId, 'team.manage', { throwOnError: true });
      if (!access.hasAccess) {
        logger.warn('auth.denied', { event: 'member_remove_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: 'No permission to remove members' });
      }
    }

    // The target's roles, read strictly: a failed read must not pass the rank check or hide an owner.
    const target = await readTargetRoles(businessId, targetUserId);

    if (!isSelf) {
      // ── Rank enforcement (AUTH-1.5) ──────────────────────────
      // Someone already off the team (an earlier removal that failed part way) is checked as the lowest role, so
      // removing them again finishes the cleanup.
      const actorRoleBase = await readActorRole(businessId, actorId);
      const mutateCheck = assertCanMutateTarget(actorRoleBase, target.highestRole || 'viewer');
      if (!mutateCheck.allowed) {
        logger.warn('auth.denied', { event: 'member_remove_denied', actor_id: actorId, target_id: targetUserId, reason: mutateCheck.reason, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: mutateCheck.reason });
      }
    }

    // Cannot remove the owner (unless self-leaving)
    const targetIsOwner = target.highestRole === 'owner';
    if (targetIsOwner && !isSelf) {
      return res.status(400).json({ error: 'Cannot remove the business owner' });
    }

    // Prevent owner from leaving without transferring ownership
    if (targetIsOwner && isSelf) {
      // Check if there's another owner
      const { data: otherOwners, error: ownersError } = await supabaseAdmin
        .from('BusinessTeam')
        .select('id')
        .eq('business_user_id', businessId)
        .eq('role_base', 'owner')
        .eq('is_active', true)
        .neq('user_id', actorId);

      if (ownersError) {
        return teamUnavailable(res, "Couldn't check the business's other owners right now. Please try again.");
      }
      if (!otherOwners || otherOwners.length === 0) {
        return res.status(400).json({ error: 'Cannot leave as the sole owner. Transfer ownership first.' });
      }
    }

    // Dual-write removal via membership service (AUTH-2.3)
    const removeResult = await membershipService.removeMember({
      businessUserId: businessId,
      userId: targetUserId,
      reason: isSelf ? 'self_leave' : 'removed',
    });

    if (removeResult.error) {
      return teamUnavailable(res, isSelf
        ? "Couldn't finish leaving this business. Please try again."
        : "Couldn't finish removing this member. Please try again.");
    }

    await writeAuditLog(businessId, actorId, isSelf ? 'self_leave' : 'remove_member', 'BusinessTeam', targetUserId, {});

    logger.info('auth.action', { event: 'member_removed', actor_id: actorId, target_id: targetUserId, business_id: businessId, self_leave: isSelf });
    res.json({ message: 'Member removed' });
  } catch (err) {
    logger.error('Remove business member error', { error: err.message });
    if (accessUnavailableResponse(res, err)) return;
    res.status(500).json({ error: 'Failed to remove member' });
  }
});


// ============================================================
// GET /:businessId/audit-log — View audit log
// ============================================================

router.get('/:businessId/audit-log', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const actorId = req.user.id;

    const access = await checkBusinessPermission(businessId, actorId, 'team.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to view audit log' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabaseAdmin
      .from('BusinessAuditLog')
      .select(`
        *,
        actor:actor_user_id (
          id, username, name, profile_picture_url
        ),
        actor_seat:actor_seat_id (
          id, display_name, role_base
        )
      `)
      .eq('business_user_id', businessId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      logger.error('Error fetching business audit log', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch audit log' });
    }

    // The teammate who acted goes by their Local Profile, as in the members list.
    const people = await loadChatPeople((data || []).map((entry) => entry.actor?.id));
    res.json({ entries: (data || []).map((entry) => ({ ...entry, actor: chatPersonRow(entry.actor, people) })) });
  } catch (err) {
    logger.error('Business audit log error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});


module.exports = router;

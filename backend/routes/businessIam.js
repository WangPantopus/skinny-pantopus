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
  BUSINESS_ROLE_RANK,
} = require('../utils/businessPermissions');
const membershipService = require('../services/businessMembershipService');


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

    const access = await checkBusinessPermission(businessId, userId, 'team.view');
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

    res.json({ members: members || [] });
  } catch (err) {
    logger.error('Business members error', { error: err.message });
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

    const access = await checkBusinessPermission(businessId, actorId, 'team.invite');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to invite members' });
    }

    const { user_id, username, role_base = 'viewer', title, notes } = req.body;

    // Resolve user by ID or username
    let targetUserId = user_id;
    if (!targetUserId && username) {
      const { data: user } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('username', username)
        .single();

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
      return res.status(500).json({ error: addResult.error });
    }

    await writeAuditLog(businessId, actorId, 'invite_member', 'BusinessTeam', targetUserId, {
      role_base,
      title,
    });

    res.status(201).json({ message: 'Member added', user_id: targetUserId, role_base });
  } catch (err) {
    logger.error('Add business member error', { error: err.message });
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

    const access = await checkBusinessPermission(businessId, actorId, 'team.manage');
    if (!access.hasAccess) {
      logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'No permission to manage team' });
    }

    const { preset_key, role_base, title } = req.body;

    // Prevent demoting self from owner
    if (targetUserId === actorId && access.isOwner && role_base && role_base !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote yourself from owner. Transfer ownership instead.' });
    }

    // Prevent promoting to owner unless you are owner
    if (role_base === 'owner' && !access.isOwner) {
      logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: 'non_owner_promote_to_owner', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'Only the owner can promote to owner' });
    }

    // ── Rank enforcement (AUTH-1.5) ──────────────────────────
    if (targetUserId !== actorId) {
      const { data: actorTeam } = await supabaseAdmin
        .from('BusinessTeam')
        .select('role_base')
        .eq('business_user_id', businessId)
        .eq('user_id', actorId)
        .eq('is_active', true)
        .maybeSingle();
      const { data: targetTeam } = await supabaseAdmin
        .from('BusinessTeam')
        .select('role_base')
        .eq('business_user_id', businessId)
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .maybeSingle();

      const actorRoleBase = actorTeam?.role_base || 'viewer';
      const targetRoleBase = targetTeam?.role_base || 'viewer';

      const mutateCheck = assertCanMutateTarget(actorRoleBase, targetRoleBase);
      if (!mutateCheck.allowed) {
        logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: mutateCheck.reason, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: mutateCheck.reason });
      }

      const newRole = role_base || null;
      if (newRole) {
        const assignCheck = assertCanMutateTarget(actorRoleBase, newRole);
        if (!assignCheck.allowed) {
          logger.warn('auth.denied', { event: 'role_change_denied', actor_id: actorId, target_id: targetUserId, reason: assignCheck.reason, new_role: newRole, business_id: businessId, ip: req.ip });
          return res.status(403).json({ error: `Cannot assign role '${newRole}': ${assignCheck.reason}` });
        }
      }
    }

    // If using a preset, apply it
    if (preset_key) {
      const { data: preset } = await supabaseAdmin
        .from('BusinessRolePreset')
        .select('*')
        .eq('key', preset_key)
        .single();

      if (!preset) {
        return res.status(400).json({ error: `Unknown preset: ${preset_key}` });
      }

      // Dual-write role update via membership service (AUTH-2.3)
      const presetRoleResult = await membershipService.updateMemberRole({
        businessUserId: businessId,
        userId: targetUserId,
        newRoleBase: preset.role_base,
      });

      if (presetRoleResult.error) {
        return res.status(500).json({ error: presetRoleResult.error });
      }

      // Title update (not part of dual-write concern)
      if (title !== undefined) {
        await supabaseAdmin
          .from('BusinessTeam')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('business_user_id', businessId)
          .eq('user_id', targetUserId)
          .eq('is_active', true);
      }

      // Clear existing overrides
      await supabaseAdmin
        .from('BusinessPermissionOverride')
        .delete()
        .eq('business_user_id', businessId)
        .eq('user_id', targetUserId);

      // Apply preset grants
      if (preset.grant_perms && preset.grant_perms.length > 0) {
        const grants = preset.grant_perms.map(perm => ({
          business_user_id: businessId,
          user_id: targetUserId,
          permission: perm,
          allowed: true,
          created_by: actorId,
        }));
        await supabaseAdmin
          .from('BusinessPermissionOverride')
          .upsert(grants, { onConflict: 'business_user_id,user_id,permission' });
      }

      // Apply preset denies
      if (preset.deny_perms && preset.deny_perms.length > 0) {
        const denies = preset.deny_perms.map(perm => ({
          business_user_id: businessId,
          user_id: targetUserId,
          permission: perm,
          allowed: false,
          created_by: actorId,
        }));
        await supabaseAdmin
          .from('BusinessPermissionOverride')
          .upsert(denies, { onConflict: 'business_user_id,user_id,permission' });
      }

      await writeAuditLog(businessId, actorId, 'apply_role_preset', 'BusinessTeam', targetUserId, {
        preset_key,
        role_base: preset.role_base,
      });

      invalidateRoleCache(targetUserId); // AUTH-3.4
      logger.info('auth.action', { event: 'role_changed', actor_id: actorId, target_id: targetUserId, business_id: businessId, preset_key, new_role: preset.role_base });
      return res.json({ message: 'Preset applied', preset_key, role_base: preset.role_base });
    }

    // Direct role_base update via membership service (AUTH-2.3)
    if (role_base) {
      const validRoles = Object.keys(BUSINESS_ROLE_RANK);
      if (!validRoles.includes(role_base)) {
        return res.status(400).json({ error: `Invalid role_base: ${role_base}` });
      }

      const roleResult = await membershipService.updateMemberRole({
        businessUserId: businessId,
        userId: targetUserId,
        newRoleBase: role_base,
      });

      if (roleResult.error) {
        return res.status(500).json({ error: roleResult.error });
      }

      // Title update is separate (not part of dual-write concern)
      if (title !== undefined) {
        await supabaseAdmin
          .from('BusinessTeam')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('business_user_id', businessId)
          .eq('user_id', targetUserId)
          .eq('is_active', true);
      }

      await writeAuditLog(businessId, actorId, 'change_role', 'BusinessTeam', targetUserId, {
        new_role_base: role_base,
      });

      invalidateRoleCache(targetUserId); // AUTH-3.4
      logger.info('auth.action', { event: 'role_changed', actor_id: actorId, target_id: targetUserId, business_id: businessId, new_role: role_base });
      return res.json({ message: 'Role updated', role_base });
    }

    res.status(400).json({ error: 'preset_key or role_base is required' });
  } catch (err) {
    logger.error('Update business member role error', { error: err.message });
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

    const access = await checkBusinessPermission(businessId, actorId, 'team.manage');
    if (!access.hasAccess) {
      logger.warn('auth.denied', { event: 'permission_override_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
      return res.status(403).json({ error: 'No permission to manage team' });
    }

    const { permission, allowed } = req.body;

    if (!permission || typeof allowed !== 'boolean') {
      return res.status(400).json({ error: 'permission (string) and allowed (boolean) are required' });
    }

    // ── Rank enforcement (AUTH-1.5) ──────────────────────────
    const { data: actorTeam } = await supabaseAdmin
      .from('BusinessTeam')
      .select('role_base')
      .eq('business_user_id', businessId)
      .eq('user_id', actorId)
      .eq('is_active', true)
      .maybeSingle();
    const { data: targetTeam } = await supabaseAdmin
      .from('BusinessTeam')
      .select('role_base')
      .eq('business_user_id', businessId)
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .maybeSingle();

    const actorRoleBase = actorTeam?.role_base || 'viewer';
    const targetRoleBase = targetTeam?.role_base || 'viewer';

    const mutateCheck = assertCanMutateTarget(actorRoleBase, targetRoleBase);
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
      logger.error('Error toggling business permission', { error: error.message });
      return res.status(500).json({ error: 'Failed to update permission' });
    }

    await writeAuditLog(businessId, actorId, 'toggle_permission', 'BusinessPermissionOverride', targetUserId, {
      permission,
      allowed,
    });

    res.json({ message: 'Permission updated', permission, allowed });
  } catch (err) {
    logger.error('Toggle business permission error', { error: err.message });
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

    // Can view own permissions or need team.view
    if (targetUserId !== actorId) {
      const canView = await hasPermission(businessId, actorId, 'team.view');
      if (!canView) {
        const access = await checkBusinessPermission(businessId, actorId);
        if (!access.hasAccess) {
          return res.status(403).json({ error: 'No access' });
        }
      }
    }

    const access = await getUserAccess(businessId, targetUserId);
    res.json({
      permissions: access.permissions,
      role_base: access.role_base,
    });
  } catch (err) {
    logger.error('Get business member permissions error', { error: err.message });
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
      const access = await checkBusinessPermission(businessId, actorId, 'team.manage');
      if (!access.hasAccess) {
        logger.warn('auth.denied', { event: 'member_remove_denied', actor_id: actorId, target_id: targetUserId, reason: 'no_permission', business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: 'No permission to remove members' });
      }

      // ── Rank enforcement (AUTH-1.5) ──────────────────────────
      const { data: actorTeam } = await supabaseAdmin
        .from('BusinessTeam')
        .select('role_base')
        .eq('business_user_id', businessId)
        .eq('user_id', actorId)
        .eq('is_active', true)
        .maybeSingle();
      const { data: targetTeam } = await supabaseAdmin
        .from('BusinessTeam')
        .select('role_base')
        .eq('business_user_id', businessId)
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .maybeSingle();

      const actorRoleBase = actorTeam?.role_base || 'viewer';
      const targetRoleBase = targetTeam?.role_base || 'viewer';

      const mutateCheck = assertCanMutateTarget(actorRoleBase, targetRoleBase);
      if (!mutateCheck.allowed) {
        logger.warn('auth.denied', { event: 'member_remove_denied', actor_id: actorId, target_id: targetUserId, reason: mutateCheck.reason, business_id: businessId, ip: req.ip });
        return res.status(403).json({ error: mutateCheck.reason });
      }
    }

    // Cannot remove the owner (unless self-leaving)
    const targetAccess = await getUserAccess(businessId, targetUserId);
    if (targetAccess.isOwner && !isSelf) {
      return res.status(400).json({ error: 'Cannot remove the business owner' });
    }

    // Prevent owner from leaving without transferring ownership
    if (targetAccess.isOwner && isSelf) {
      // Check if there's another owner
      const { data: otherOwners } = await supabaseAdmin
        .from('BusinessTeam')
        .select('id')
        .eq('business_user_id', businessId)
        .eq('role_base', 'owner')
        .eq('is_active', true)
        .neq('user_id', actorId);

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
      return res.status(500).json({ error: removeResult.error });
    }

    await writeAuditLog(businessId, actorId, isSelf ? 'self_leave' : 'remove_member', 'BusinessTeam', targetUserId, {});

    logger.info('auth.action', { event: 'member_removed', actor_id: actorId, target_id: targetUserId, business_id: businessId, self_leave: isSelf });
    res.json({ message: 'Member removed' });
  } catch (err) {
    logger.error('Remove business member error', { error: err.message });
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

    res.json({ entries: data || [] });
  } catch (err) {
    logger.error('Business audit log error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});


module.exports = router;

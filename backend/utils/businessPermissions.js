/**
 * Business IAM Permission Helper
 *
 * Mirrors homePermissions.js for Business entities.
 * Uses BusinessTeam (instead of HomeOccupancy) and BusinessRolePermission /
 * BusinessPermissionOverride for the same override-first resolution logic.
 *
 * The backend uses supabaseAdmin (service_role), so RLS is bypassed.
 * We replicate the permission logic from business_has_permission() here
 * for efficient server-side checks without extra round-trips.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

// ============================================================
// ROLE HIERARCHY
// ============================================================

const BUSINESS_ROLE_RANK = {
  viewer: 10,
  staff: 20,
  editor: 30,
  admin: 40,
  owner: 50,
};

// ============================================================
// Core: check if a user has a specific IAM permission in a business
// ============================================================

/**
 * Check if a user has a specific permission in a business.
 * Mirrors the DB function public.business_has_permission().
 *
 * @param {string} businessUserId - The business's user ID (User.id where account_type='business')
 * @param {string} userId - The acting user's personal ID
 * @param {string} permission - e.g. 'profile.edit', 'catalog.manage'
 * @returns {Promise<boolean>}
 */
async function hasPermission(businessUserId, userId, permission) {
  const membership = await getActiveMembership(businessUserId, userId);
  if (!membership) return false;

  const roleBase = membership.role_base;

  // Owner always has all permissions
  if (roleBase === 'owner') return true;

  // Check per-user override first
  const { data: override } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .select('allowed')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .eq('permission', permission)
    .maybeSingle();

  if (override && override.allowed !== null && override.allowed !== undefined) {
    return override.allowed;
  }

  // Fall back to role default
  const { data: rolePerm } = await supabaseAdmin
    .from('BusinessRolePermission')
    .select('allowed')
    .eq('role_base', roleBase)
    .eq('permission', permission)
    .maybeSingle();

  return rolePerm?.allowed === true;
}

/**
 * Get all permissions for a user in a business.
 * Returns { permissions: string[], role_base: string, membership: object, hasAccess: boolean, isOwner: boolean }
 */
async function getUserAccess(businessUserId, userId) {
  const membership = await getActiveMembership(businessUserId, userId);
  if (!membership) {
    return { permissions: [], role_base: null, membership: null, hasAccess: false, isOwner: false };
  }

  const roleBase = membership.role_base;
  const isOwner = roleBase === 'owner';

  // Owner: return all permissions
  if (isOwner) {
    const ALL_PERMS = [
      'profile.view', 'profile.edit',
      'locations.view', 'locations.edit', 'locations.manage',
      'hours.view', 'hours.edit',
      'catalog.view', 'catalog.edit', 'catalog.manage',
      'pages.view', 'pages.edit', 'pages.publish', 'pages.manage',
      'team.view', 'team.invite', 'team.manage',
      'reviews.view', 'reviews.respond',
      'gigs.post', 'gigs.manage',
      'mail.view', 'mail.send',
      'ads.view', 'ads.manage',
      'finance.view', 'finance.manage',
      'insights.view', 'sensitive.view',
    ];
    return {
      permissions: ALL_PERMS,
      role_base: roleBase,
      membership,
      hasAccess: true,
      isOwner: true,
    };
  }

  // Get base role permissions
  const { data: rolePerms } = await supabaseAdmin
    .from('BusinessRolePermission')
    .select('permission')
    .eq('role_base', roleBase)
    .eq('allowed', true);

  const basePerms = new Set((rolePerms || []).map(r => r.permission));

  // Overlay per-user overrides
  const { data: overrides } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .select('permission, allowed')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId);

  for (const ov of (overrides || [])) {
    if (ov.allowed) {
      basePerms.add(ov.permission);
    } else {
      basePerms.delete(ov.permission);
    }
  }

  return {
    permissions: Array.from(basePerms),
    role_base: roleBase,
    membership,
    hasAccess: true,
    isOwner: false,
  };
}

// ============================================================
// Main permission check (drop-in for route handlers)
// ============================================================

/**
 * Check if a user has access (and optionally a specific permission) to a business.
 *
 * @param {string} businessUserId
 * @param {string} userId
 * @param {string|null} permission - e.g. 'profile.edit', 'team.manage'
 * @returns {Promise<{ hasAccess: boolean, isOwner: boolean, membership: object|null }>}
 */
async function checkBusinessPermission(businessUserId, userId, permission = null) {
  const membership = await getActiveMembership(businessUserId, userId);

  if (!membership) {
    return { hasAccess: false, isOwner: false, membership: null };
  }

  const isOwner = membership.role_base === 'owner';

  // No specific permission needed — just check membership
  if (!permission) {
    return { hasAccess: true, isOwner, membership };
  }

  // Owner always has all permissions
  if (isOwner) {
    return { hasAccess: true, isOwner: true, membership };
  }

  // Check the IAM permission
  const allowed = await hasPermission(businessUserId, userId, permission);
  return { hasAccess: allowed, isOwner: false, membership };
}


// ============================================================
// Batch: check permissions across multiple businesses (avoids N+1)
// ============================================================

/**
 * For a given user, find all business IDs where the user has ANY of the
 * specified permissions. Uses exactly 2 DB queries regardless of how many
 * businesses the user belongs to.
 *
 * @param {string} userId - The acting user's personal ID
 * @param {string[]} permissions - e.g. ['gigs.manage', 'gigs.post']
 * @returns {Promise<string[]>} - Business user IDs where user has at least one permission
 */
async function getBusinessIdsWithPermissions(userId, permissions) {
  // 1) Fetch all active memberships
  const { data: memberships } = await supabaseAdmin
    .from('BusinessTeam')
    .select('business_user_id, role_base')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!memberships || memberships.length === 0) return [];

  const bizIds = memberships.map(m => m.business_user_id);
  const roles = [...new Set(memberships.map(m => m.role_base))];

  // 2) Batch-fetch overrides + role defaults (2 queries instead of 2-4 per business)
  const [{ data: overrides }, { data: rolePerms }] = await Promise.all([
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('business_user_id, permission, allowed')
      .in('business_user_id', bizIds)
      .eq('user_id', userId)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessRolePermission')
      .select('role_base, permission, allowed')
      .in('role_base', roles)
      .in('permission', permissions),
  ]);

  // 3) Build O(1) lookup maps
  const ovrMap = {};
  for (const o of overrides || []) ovrMap[`${o.business_user_id}:${o.permission}`] = o.allowed;
  const rpMap = {};
  for (const r of rolePerms || []) rpMap[`${r.role_base}:${r.permission}`] = r.allowed;

  // 4) Resolve per-business using in-memory lookups
  const result = [];
  for (const m of memberships) {
    const biz = m.business_user_id;
    if (m.role_base === 'owner') { result.push(biz); continue; }

    const hasAny = permissions.some(perm => {
      const override = ovrMap[`${biz}:${perm}`];
      if (override !== undefined) return override;
      return rpMap[`${m.role_base}:${perm}`] === true;
    });
    if (hasAny) result.push(biz);
  }

  return result;
}

/**
 * For a business, find all team member user IDs who have ANY of the
 * specified permissions. Uses exactly 2 DB queries regardless of team size.
 *
 * @param {string} businessUserId - The business user ID
 * @param {string[]} permissions - e.g. ['gigs.manage', 'gigs.post']
 * @param {string|null} excludeUserId - Optional user to exclude from results
 * @returns {Promise<string[]>} - User IDs with at least one permission
 */
async function getTeamMembersWithPermissions(businessUserId, permissions, excludeUserId = null) {
  // 1) Fetch all active team members
  const { data: members } = await supabaseAdmin
    .from('BusinessTeam')
    .select('user_id, role_base')
    .eq('business_user_id', businessUserId)
    .eq('is_active', true);

  if (!members || members.length === 0) return [];

  const memberIds = members.map(m => m.user_id);
  const roles = [...new Set(members.map(m => m.role_base))];

  // 2) Batch-fetch overrides + role defaults
  const [{ data: overrides }, { data: rolePerms }] = await Promise.all([
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('user_id, permission, allowed')
      .eq('business_user_id', businessUserId)
      .in('user_id', memberIds)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessRolePermission')
      .select('role_base, permission, allowed')
      .in('role_base', roles)
      .in('permission', permissions),
  ]);

  // 3) Build lookup maps
  const ovrMap = {};
  for (const o of overrides || []) ovrMap[`${o.user_id}:${o.permission}`] = o.allowed;
  const rpMap = {};
  for (const r of rolePerms || []) rpMap[`${r.role_base}:${r.permission}`] = r.allowed;

  // 4) Resolve per-member
  const result = [];
  for (const m of members) {
    const uid = String(m.user_id);
    if (excludeUserId && uid === String(excludeUserId)) continue;
    if (m.role_base === 'owner') { result.push(uid); continue; }

    const hasAny = permissions.some(perm => {
      const override = ovrMap[`${uid}:${perm}`];
      if (override !== undefined) return override;
      return rpMap[`${m.role_base}:${perm}`] === true;
    });
    if (hasAny) result.push(uid);
  }

  return result;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Get active team membership for a user in a business
 */
async function getActiveMembership(businessUserId, userId) {
  const { data: membership } = await supabaseAdmin
    .from('BusinessTeam')
    .select('*')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  return membership || null;
}

/**
 * Get role rank for comparisons (e.g. can't demote someone of equal/higher rank)
 */
function getRoleRank(roleBase) {
  return BUSINESS_ROLE_RANK[roleBase] || 0;
}

// ============================================================
// Rank Enforcement Helpers
// ============================================================

/**
 * Check whether an actor is allowed to mutate (role change, removal, etc.)
 * a target user based on role hierarchy.
 *
 * Rules:
 *   - Only owner can create or modify another owner.
 *   - Non-owner cannot modify a user with rank >= their own.
 *   - (Sole-owner self-demotion is checked at the route level, not here.)
 *
 * @param {string} actorRoleBase - The acting user's role_base
 * @param {string} targetRoleBase - The target user's role_base
 * @returns {{ allowed: boolean, reason?: string }}
 */
function assertCanMutateTarget(actorRoleBase, targetRoleBase) {
  const actorRank = getRoleRank(actorRoleBase);
  const targetRank = getRoleRank(targetRoleBase);

  // Only owner can touch another owner
  if (targetRoleBase === 'owner' && actorRoleBase !== 'owner') {
    return { allowed: false, reason: 'Only an owner can modify another owner' };
  }

  // Owner can mutate anyone
  if (actorRoleBase === 'owner') {
    return { allowed: true };
  }

  // Non-owner cannot mutate equal or higher rank
  if (targetRank >= actorRank) {
    return { allowed: false, reason: 'Cannot modify a member with a role equal to or higher than your own' };
  }

  return { allowed: true };
}

/**
 * Check whether an actor is allowed to grant a specific permission override.
 *
 * Rules:
 *   - Owner bypasses this check (can grant anything).
 *   - Non-owner can only grant permissions that their own role tier already has.
 *
 * Queries BusinessRolePermission to resolve the actor's role permission set.
 *
 * @param {string} actorRoleBase - The acting user's role_base
 * @param {string} permission - The permission being granted, e.g. 'profile.edit'
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function assertCanGrantPermission(actorRoleBase, permission) {
  // Owner can grant any permission
  if (actorRoleBase === 'owner') {
    return { allowed: true };
  }

  // Query the actor's role permission set
  const { data: rolePerm } = await supabaseAdmin
    .from('BusinessRolePermission')
    .select('allowed')
    .eq('role_base', actorRoleBase)
    .eq('permission', permission)
    .maybeSingle();

  if (rolePerm?.allowed === true) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot grant permission '${permission}' that exceeds your own role's permission set`,
  };
}

/**
 * Write a business audit log entry
 */
async function writeAuditLog(businessUserId, actorUserId, action, targetType, targetId, metadata = {}) {
  try {
    await supabaseAdmin
      .from('BusinessAuditLog')
      .insert({
        business_user_id: businessUserId,
        actor_user_id: actorUserId,
        action,
        target_type: targetType || null,
        target_id: targetId || null,
        metadata,
      });
  } catch (err) {
    logger.warn('Failed to write business audit log (non-fatal)', {
      error: err.message,
      businessUserId,
      action,
    });
  }
}

module.exports = {
  hasPermission,
  getUserAccess,
  checkBusinessPermission,
  getBusinessIdsWithPermissions,
  getTeamMembersWithPermissions,
  getActiveMembership,
  getRoleRank,
  assertCanMutateTarget,
  assertCanGrantPermission,
  writeAuditLog,
  BUSINESS_ROLE_RANK,
};

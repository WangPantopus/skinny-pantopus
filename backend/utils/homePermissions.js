/**
 * Home IAM Permission Helper
 *
 * Replaces the old boolean-flag permission system (can_manage_home, etc.)
 * with the new IAM system (role_base + HomeRolePermission + HomePermissionOverride).
 *
 * The backend uses supabaseAdmin (service_role), so RLS is bypassed.
 * We replicate the permission logic from the DB functions here for
 * efficient server-side checks without extra round-trips.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// ============================================================
// PERMISSION MAP: old flag → new IAM permission(s)
// ============================================================

const OLD_TO_NEW_PERM = {
  can_manage_home:    ['home.edit'],
  can_manage_finance: ['finance.view', 'finance.manage'],
  can_manage_access:  ['access.manage', 'members.manage'],
  can_manage_tasks:   ['tasks.edit', 'tasks.manage'],
  can_view_sensitive:  ['sensitive.view'],
};

// ============================================================
// ROLE HIERARCHY
// ============================================================

const ROLE_RANK = {
  guest: 10,
  restricted_member: 20,
  member: 30,
  manager: 40,
  admin: 50,
  owner: 60,
};

// ============================================================
// Core: check if a user has a specific IAM permission in a home
// ============================================================

/**
 * Check if a user has a specific permission in a home.
 * Mirrors the DB function public.home_has_permission().
 *
 * @param {string} homeId
 * @param {string} userId
 * @param {string} permission - e.g. 'home.edit', 'tasks.manage', 'finance.view'
 * @returns {Promise<boolean>}
 */
async function hasPermission(homeId, userId, permission) {
  // 1) Get the user's occupancy
  const occ = await getActiveOccupancy(homeId, userId);
  if (!occ) return false;

  const roleBase = occ.role_base || mapLegacyRole(occ.role);

  // 2) Check overrides first (explicit grant/deny)
  const { data: override } = await supabaseAdmin
    .from('HomePermissionOverride')
    .select('allowed')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .eq('permission', permission)
    .maybeSingle();

  if (override && override.allowed !== null && override.allowed !== undefined) {
    return override.allowed;
  }

  // 3) Check base role permissions
  const { data: rolePerm } = await supabaseAdmin
    .from('HomeRolePermission')
    .select('allowed')
    .eq('role_base', roleBase)
    .eq('permission', permission)
    .maybeSingle();

  return rolePerm?.allowed === true;
}

/**
 * Get all permissions for a user in a home.
 * Returns { permissions: string[], role_base: string, occupancy: object }
 */
async function getUserAccess(homeId, userId) {
  const occ = await getActiveOccupancy(homeId, userId);
  if (!occ) {
    return { permissions: [], role_base: null, occupancy: null, hasAccess: false, isOwner: false };
  }

  const roleBase = occ.role_base || mapLegacyRole(occ.role);

  // Get base role permissions
  const { data: rolePerms } = await supabaseAdmin
    .from('HomeRolePermission')
    .select('permission')
    .eq('role_base', roleBase)
    .eq('allowed', true);

  const basePerms = new Set((rolePerms || []).map(r => r.permission));

  // Get overrides
  const { data: overrides } = await supabaseAdmin
    .from('HomePermissionOverride')
    .select('permission, allowed')
    .eq('home_id', homeId)
    .eq('user_id', userId);

  for (const ov of (overrides || [])) {
    if (ov.allowed) {
      basePerms.add(ov.permission);
    } else {
      basePerms.delete(ov.permission);
    }
  }

  // Align with checkHomePermission: legacy Home.owner_id OR verified HomeOwner row
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('owner_id')
    .eq('id', homeId)
    .single();

  const ownerCheck = await isVerifiedOwner(homeId, userId);
  // IAM "owner" role must count as owner for dashboard /myAccess (matches GET /:id/me isOwnerLike).
  const isOwner =
    home?.owner_id === userId || ownerCheck.isOwner || roleBase === 'owner';

  return {
    permissions: Array.from(basePerms),
    role_base: roleBase,
    occupancy: occ,
    hasAccess: true,
    isOwner,
  };
}

// ============================================================
// Upgraded checkHomePermission (drop-in replacement)
// ============================================================

/**
 * Drop-in replacement for the old checkHomePermission.
 * Supports both old-style flags AND new IAM permission strings.
 *
 * @param {string} homeId
 * @param {string} userId
 * @param {string|null} permission - old flag like 'can_manage_home' OR new perm like 'tasks.edit'
 * @returns {Promise<{ hasAccess: boolean, isOwner: boolean, occupancy: object|null, permissions: string[] }>}
 */
async function checkHomePermission(homeId, userId, permission = null) {
  // Check ownership
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('owner_id')
    .eq('id', homeId)
    .single();

  if (!home) return { hasAccess: false, isOwner: false, occupancy: null };

  const isLegacyOwner = home.owner_id === userId;

  // Also check HomeOwner table for verified ownership
  const ownerCheck = await isVerifiedOwner(homeId, userId);

  // Check occupancy (needed for IAM owner role and permission resolution)
  const occ = await getActiveOccupancy(homeId, userId);
  const roleBase = occ ? (occ.role_base || mapLegacyRole(occ.role)) : null;
  const isIamOwner = roleBase === 'owner';
  const isOwner = isLegacyOwner || ownerCheck.isOwner || isIamOwner;

  const hasAccess = isOwner || !!occ;

  if (!hasAccess) return { hasAccess: false, isOwner: false, occupancy: null };

  // No specific permission needed — just check membership
  if (!permission) return { hasAccess: true, isOwner, occupancy: occ };

  // Owner always has all permissions
  if (isOwner) return { hasAccess: true, isOwner: true, occupancy: occ };

  // Resolve permission: old flag → new IAM perm(s)
  let permsToCheck;
  if (OLD_TO_NEW_PERM[permission]) {
    // Old-style flag: check ANY of the mapped new permissions
    permsToCheck = OLD_TO_NEW_PERM[permission];
  } else if (permission.includes('.')) {
    // Already a new-style IAM permission
    permsToCheck = [permission];
  } else {
    // Unknown — try as occupancy field fallback
    const hasPerm = occ && occ[permission] === true;
    return { hasAccess: hasPerm, isOwner: false, occupancy: occ };
  }

  // Check the IAM permissions
  for (const perm of permsToCheck) {
    const allowed = await hasPermission(homeId, userId, perm);
    if (allowed) return { hasAccess: true, isOwner: false, occupancy: occ };
  }

  return { hasAccess: false, isOwner: false, occupancy: occ };
}


// ============================================================
// Helpers
// ============================================================

/**
 * Get active occupancy for a user in a home (respects time windows)
 */
async function getActiveOccupancy(homeId, userId) {
  const { data: occ } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('*')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!occ) return null;

  // Check time windows
  const now = new Date();
  if (occ.start_at && new Date(occ.start_at) > now) return null;
  if (occ.end_at && new Date(occ.end_at) <= now) return null;

  return occ;
}

/**
 * Map legacy role text to role_base enum value
 */
function mapLegacyRole(role) {
  const map = {
    owner: 'owner',
    admin: 'admin',
    property_manager: 'manager',
    manager: 'manager',
    tenant: 'lease_resident',
    roommate: 'member',
    renter: 'lease_resident',
    family: 'member',
    member: 'member',
    caregiver: 'restricted_member',
    restricted_member: 'restricted_member',
    guest: 'guest',
    lease_resident: 'lease_resident',
    service_provider: 'service_provider',
  };
  return map[role] || 'member';
}

/**
 * Get role rank for comparisons
 */
function getRoleRank(roleBase) {
  return ROLE_RANK[roleBase] || 0;
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
 * Queries HomeRolePermission to resolve the actor's role permission set.
 *
 * @param {string} actorRoleBase - The acting user's role_base
 * @param {string} permission - The permission being granted, e.g. 'home.edit'
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function assertCanGrantPermission(actorRoleBase, permission) {
  // Owner can grant any permission
  if (actorRoleBase === 'owner') {
    return { allowed: true };
  }

  // Query the actor's role permission set
  const { data: rolePerm } = await supabaseAdmin
    .from('HomeRolePermission')
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
 * Check if a user is a verified owner via the HomeOwner table.
 */
async function isVerifiedOwner(homeId, userId) {
  const { data: owner } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, verification_tier, is_primary_owner')
    .eq('home_id', homeId)
    .eq('subject_id', userId)
    .eq('owner_status', 'verified')
    .maybeSingle();

  return owner ? { isOwner: true, tier: owner.verification_tier, isPrimary: owner.is_primary_owner } : { isOwner: false };
}

/**
 * Write an audit log entry
 */
async function writeAuditLog(homeId, actorUserId, action, targetType, targetId, metadata = {}) {
  try {
    await supabaseAdmin
      .from('HomeAuditLog')
      .insert({
        home_id: homeId,
        actor_user_id: actorUserId,
        action,
        target_type: targetType || null,
        target_id: targetId || null,
        metadata,
      });
  } catch (err) {
    logger.warn('Failed to write audit log (non-fatal)', { error: err.message, homeId, action });
  }
}

// ============================================================
// OCCUPANCY TEMPLATES: single source of truth for permission booleans
// ============================================================

/**
 * Verified role → boolean permission templates.
 * These are applied ONLY when verificationStatus === 'verified'.
 */
const VERIFIED_TEMPLATES = {
  owner:             { can_manage_home: true,  can_manage_access: true,  can_manage_finance: true,  can_manage_tasks: true,  can_view_sensitive: true  },
  admin:             { can_manage_home: true,  can_manage_access: true,  can_manage_finance: false, can_manage_tasks: true,  can_view_sensitive: true  },
  manager:           { can_manage_home: true,  can_manage_access: false, can_manage_finance: false, can_manage_tasks: true,  can_view_sensitive: false },
  lease_resident:    { can_manage_home: false, can_manage_access: false, can_manage_finance: false, can_manage_tasks: true,  can_view_sensitive: true  },
  member:            { can_manage_home: false, can_manage_access: false, can_manage_finance: false, can_manage_tasks: true,  can_view_sensitive: true  },
  restricted_member: { can_manage_home: false, can_manage_access: false, can_manage_finance: false, can_manage_tasks: true,  can_view_sensitive: false },
  guest:             { can_manage_home: false, can_manage_access: false, can_manage_finance: false, can_manage_tasks: false, can_view_sensitive: false },
  service_provider:  { can_manage_home: false, can_manage_access: false, can_manage_finance: false, can_manage_tasks: false, can_view_sensitive: false },
};

/**
 * All-false template used for non-verified statuses (provisional, pending_*, unverified).
 */
const ALL_FALSE_TEMPLATE = {
  can_manage_home: false,
  can_manage_access: false,
  can_manage_finance: false,
  can_manage_tasks: false,
  can_view_sensitive: false,
};

/**
 * applyOccupancyTemplate(homeId, userId, roleBase, verificationStatus, options)
 *
 * Computes the correct permission booleans + role_base for a HomeOccupancy row,
 * then upserts the row. This is the SINGLE write path for occupancy permissions.
 *
 * Every place that creates or modifies a HomeOccupancy row must call this.
 * Never set the boolean columns directly anywhere else.
 *
 * Called by:
 *   - Home creation (POST /api/homes)
 *   - Invite acceptance (POST /invitations/token/:token/accept)
 *   - Claim approval (POST /:id/claim/:claimId/approve)
 *   - Postcard verification (POST /:id/verify-postcard)
 *   - Role change (POST /:id/members/:userId/role)
 *   - Cold-start self-bootstrap
 *   - Challenge window promotion (background job)
 *   - Move-out reactivation
 *
 * @param {string} homeId
 * @param {string} userId
 * @param {string} roleBase - one of: owner, admin, manager, lease_resident, member, restricted_member, guest, service_provider
 * @param {string} verificationStatus - one of: verified, provisional, provisional_bootstrap, pending_postcard, pending_doc, pending_approval, unverified
 * @param {object} options - { ageBand?: 'child'|'teen'|'adult', dryRun?: boolean }
 * @returns {Promise<{occupancy: object|null, template: object}>}
 */
async function applyOccupancyTemplate(homeId, userId, roleBase, verificationStatus = 'verified', options = {}) {
  const { ageBand = null, dryRun = false } = options;
  const isVerified = verificationStatus === 'verified';
  const isProvisionalBootstrap = verificationStatus === 'provisional_bootstrap';
  const isMinor = ageBand === 'child' || ageBand === 'teen';

  let template;
  let effectiveRoleBase = roleBase;

  if (!isVerified && !isProvisionalBootstrap) {
    // PROVISIONAL / PENDING_* / UNVERIFIED: all booleans false, downgrade role
    template = { ...ALL_FALSE_TEMPLATE };
    effectiveRoleBase = 'restricted_member';
  } else if (isProvisionalBootstrap) {
    // PROVISIONAL_BOOTSTRAP: can_manage_tasks only, keep role_base as passed
    template = {
      ...ALL_FALSE_TEMPLATE,
      can_manage_tasks: true,
    };
  } else {
    // VERIFIED: use the role-based template
    template = { ...(VERIFIED_TEMPLATES[roleBase] || VERIFIED_TEMPLATES.member) };
  }

  // AGE BAND OVERRIDE: applied after template selection
  if (isMinor) {
    template.can_view_sensitive = false;
    template.can_manage_finance = false;
    template.can_manage_access = false;
    template.can_manage_home = false;
    // Teens can manage tasks, children cannot
    template.can_manage_tasks = ageBand === 'teen' ? template.can_manage_tasks : false;
  }

  const result = {
    role_base: effectiveRoleBase,
    is_active: true,
    verification_status: verificationStatus,
    ...template,
  };

  if (dryRun) {
    return { occupancy: null, template: result };
  }

  // UPSERT into HomeOccupancy
  const upsertData = {
    home_id: homeId,
    user_id: userId,
    role_base: effectiveRoleBase,
    is_active: true,
    verification_status: verificationStatus,
    updated_at: new Date().toISOString(),
    ...template,
  };

  // Include age_band if provided
  if (ageBand) {
    upsertData.age_band = ageBand;
  }

  const { data: occupancy, error: upsertError } = await supabaseAdmin
    .from('HomeOccupancy')
    .upsert(upsertData, { onConflict: 'home_id,user_id' })
    .select()
    .single();

  if (upsertError) {
    logger.error('applyOccupancyTemplate upsert failed', {
      error: upsertError.message,
      homeId,
      userId,
      roleBase: effectiveRoleBase,
      verificationStatus,
    });
    throw new Error(`Failed to apply occupancy template: ${upsertError.message}`);
  }

  // Audit log
  await writeAuditLog(homeId, userId, 'OCCUPANCY_TEMPLATE_APPLIED', 'HomeOccupancy', occupancy.id, {
    role_base: effectiveRoleBase,
    verification_status: verificationStatus,
    age_band: ageBand,
    booleans: template,
  });

  return { occupancy, template: result };
}

module.exports = {
  hasPermission,
  getUserAccess,
  checkHomePermission,
  getActiveOccupancy,
  isVerifiedOwner,
  mapLegacyRole,
  getRoleRank,
  assertCanMutateTarget,
  assertCanGrantPermission,
  writeAuditLog,
  applyOccupancyTemplate,
  VERIFIED_TEMPLATES,
  ALL_FALSE_TEMPLATE,
  OLD_TO_NEW_PERM,
  ROLE_RANK,
};

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

const {
  HOME_PERMISSIONS, OLD_TO_NEW_PERM, ROLE_RANK, resolveHomeRole,
  currentOccupancy, ageAllows, effectiveRole,
} = require('./homeAccessPolicy');

function accessUnavailable() {
  return Object.assign(new Error('Could not check Home access. Please retry.'), {
    code: 'HOME_ACCESS_UNAVAILABLE', status: 503, statusCode: 503,
  });
}

async function checked(query) {
  let result;
  try { result = await query; } catch (_) { throw accessUnavailable(); }
  if (!result || result.error) throw accessUnavailable();
  return result.data;
}

/**
 * Resolve one current effective policy. Unknown verification does not attest
 * membership; missing age is preserved as historical adult-compatible data.
 * Errors throw so callers cannot turn an unreadable deny into a base grant.
 */
async function getUserAccess(homeId, userId) {
  const empty = { permissions: [], role_base: null, effective_role_base: null,
    occupancy: null, hasAccess: false, isOwner: false };
  if (!homeId || !userId) return empty;
  const [home, occupancy, owner] = await Promise.all([
    checked(supabaseAdmin.from('Home').select('id, owner_id').eq('id', homeId).maybeSingle()),
    checked(supabaseAdmin.from('HomeOccupancy').select('*').eq('home_id', homeId).eq('user_id', userId).maybeSingle()),
    checked(supabaseAdmin.from('HomeOwner').select('id, subject_type, owner_status')
      .eq('home_id', homeId).eq('subject_id', userId).eq('subject_type', 'user')
      .eq('owner_status', 'verified').maybeSingle()),
  ]);
  if (!home) return empty;
  const role = resolveHomeRole(occupancy);
  const verifiedOccupancy = currentOccupancy(occupancy) && occupancy.verification_status === 'verified' && !!role;
  const ownership = home.owner_id === userId || (owner && owner.subject_type === 'user')
    || (verifiedOccupancy && role === 'owner');
  // An explicit revoked/ended/pending occupancy fences a stale ownership pointer.
  const admitted = occupancy ? verifiedOccupancy : !!ownership;
  if (!admitted) return { ...empty, occupancy, role_base: role,
    verificationRequired: currentOccupancy(occupancy) && !!role
      && ['unverified', 'provisional', 'provisional_bootstrap', 'pending_doc', 'pending_postcard',
        'pending_approval', 'pending', 'none'].includes(occupancy.verification_status) };

  const ownerEntitlement = !!ownership;
  const baseRole = ownerEntitlement ? 'owner' : role;
  const [roleRows, overrides] = await Promise.all([
    checked(supabaseAdmin.from('HomeRolePermission').select('permission, allowed').eq('role_base', baseRole)),
    checked(supabaseAdmin.from('HomePermissionOverride').select('permission, allowed')
      .eq('home_id', homeId).eq('user_id', userId)),
  ]);
  const allowed = new Set(ownerEntitlement ? HOME_PERMISSIONS : []);
  for (const row of (roleRows || [])) {
    if (row.allowed === true) allowed.add(row.permission);
    else allowed.delete(row.permission);
  }
  for (const row of (overrides || [])) {
    if (row.allowed === true) allowed.add(row.permission);
    else allowed.delete(row.permission);
  }
  const age = occupancy?.age_band;
  const permissions = HOME_PERMISSIONS.filter(permission => allowed.has(permission) && ageAllows(age, permission));
  return {
    permissions, role_base: role || 'owner',
    effective_role_base: effectiveRole(ownerEntitlement ? 'owner' : role, age),
    occupancy, hasAccess: true,
    // Existing owner shortcuts must never reinstate a minor's hard-denied powers.
    isOwner: ownerEntitlement && (age == null || age === 'adult'),
  };
}

async function hasPermission(homeId, userId, permission) {
  const access = await getUserAccess(homeId, userId);
  return access.hasAccess && access.permissions.includes(permission);
}

async function checkHomePermission(homeId, userId, permission = null) {
  const access = await getUserAccess(homeId, userId);
  if (!access.hasAccess || !permission) return access;
  const requested = OLD_TO_NEW_PERM[permission] || [permission];
  return { ...access, hasAccess: requested.some(value => access.permissions.includes(value)) };
}

async function getActiveOccupancy(homeId, userId) {
  const occupancy = await checked(supabaseAdmin.from('HomeOccupancy').select('*')
    .eq('home_id', homeId).eq('user_id', userId).maybeSingle());
  return currentOccupancy(occupancy) && occupancy.verification_status === 'verified'
    && resolveHomeRole(occupancy) ? occupancy : null;
}

/** Own onboarding/personal progress only. This is deliberately not membership.
 * Callers must return only the caller's records/status and public state-level
 * guidance. Never use it to authorize shared Home content or operations.
 */
async function getHomePersonalContext(homeId, userId) {
  if (!homeId || !userId) return null;
  const [home, occupancy] = await Promise.all([
    checked(supabaseAdmin.from('Home').select('id').eq('id', homeId).maybeSingle()),
    checked(supabaseAdmin.from('HomeOccupancy').select('*')
      .eq('home_id', homeId).eq('user_id', userId).maybeSingle()),
  ]);
  return home && currentOccupancy(occupancy) && resolveHomeRole(occupancy)
    && ['verified', 'unverified', 'provisional', 'provisional_bootstrap', 'pending_doc',
      'pending_postcard', 'pending_approval', 'pending', 'none'].includes(occupancy.verification_status)
    ? { occupancy } : null;
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
  const owner = await checked(supabaseAdmin.from('HomeOwner')
    .select('id, subject_type, verification_tier, is_primary_owner')
    .eq('home_id', homeId).eq('subject_id', userId)
    .eq('subject_type', 'user').eq('owner_status', 'verified').maybeSingle());
  return owner?.subject_type === 'user'
    ? { isOwner: true, tier: owner.verification_tier, isPrimary: owner.is_primary_owner }
    : { isOwner: false };
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
 * Never set the boolean columns directly anywhere else. Transactional postcard
 * confirmation uses dryRun templates in its atomic database function.
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
  const nowIso = new Date().toISOString();
  const upsertData = {
    home_id: homeId,
    user_id: userId,
    role_base: effectiveRoleBase,
    is_active: true,
    verification_status: verificationStatus,
    updated_at: nowIso,
    ...template,
  };

  // §5.1: stamp WHEN a residency became verified. Without this the system
  // cannot express "verified 29 months ago" and every trust decision treats a
  // three-year-old verification the same as this morning's.
  if (verificationStatus === 'verified') {
    // eslint-disable-next-line global-require
    const verificationAge = require('./verificationAge');
    upsertData.verified_at = nowIso;
    upsertData.verification_expires_at = verificationAge.expiryFor(nowIso);
  }

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

/**
 * The T4 gate, stated once: does this access result carry a VERIFIED
 * occupancy? Every surface that issues an attested artifact (residency
 * letters, residency claims, fridge cards) must use this same check —
 * duplicated trust gates are how privacy primitives drift.
 * @param {{ occupancy?: object|null }} access - from checkHomePermission
 * @returns {boolean}
 */
function isVerifiedResident(access) {
  if (!access || !access.occupancy || access.occupancy.verification_status !== 'verified') {
    return false;
  }
  // Attestations (residency letters, live residency claims, fridge cards)
  // are dated. When expiry enforcement is on
  // (address.enforce_verification_expiry), a verification past its validity
  // window may not mint a fresh one — the holder re-verifies first. Rows
  // with no verified_at predate the column and are never treated as stale.
  const verificationAge = require('./verificationAge');
  return !verificationAge.staleAffectsTrust(access.occupancy.verified_at);
}

module.exports = {
  hasPermission,
  getUserAccess,
  checkHomePermission,
  getActiveOccupancy,
  isVerifiedResident,
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
  accessUnavailable,
  getHomePersonalContext,
};

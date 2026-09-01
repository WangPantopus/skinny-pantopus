/**
 * Seat-Based Business IAM Permission Helper
 *
 * Replaces businessPermissions.js for the Identity Firewall architecture.
 * Resolves permissions via BusinessSeat + SeatBinding instead of BusinessTeam.
 *
 * The critical invariant: SeatBinding is ONLY queried to resolve which seat
 * belongs to the authenticated user. It is NEVER used to reveal which user
 * is behind someone else's seat.
 *
 * The backend uses supabaseAdmin (service_role), so RLS is bypassed.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

// ============================================================
// ROLE HIERARCHY (same as businessPermissions.js)
// ============================================================

const BUSINESS_ROLE_RANK = {
  viewer: 10,
  staff: 20,
  editor: 30,
  admin: 40,
  owner: 50,
};

// ============================================================
// ALL_PERMS — full permission set granted to owner
// ============================================================

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

// ============================================================
// Core: resolve a user's seat at a specific business
// ============================================================

/**
 * Get the active BusinessSeat for a user at a specific business.
 * Uses SeatBinding to resolve user → seat (internal auth only).
 *
 * @param {string} businessUserId - The business account's user ID
 * @param {string} userId - The acting user's personal ID
 * @returns {Promise<object|null>} The seat row or null
 */
async function getSeatForUser(businessUserId, userId) {
  const { data, error } = await supabaseAdmin
    .from('SeatBinding')
    .select(`
      seat_id,
      user_id,
      bound_at,
      binding_method,
      seat:seat_id (
        id,
        business_user_id,
        display_name,
        display_avatar_file_id,
        role_base,
        contact_method,
        is_active,
        invite_status,
        accepted_at,
        notes,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('getSeatForUser query error', { error: error.message, businessUserId, userId });
    return null;
  }

  if (!data || !data.seat) return null;

  const seat = data.seat;
  // Verify this seat belongs to the right business and is active
  if (seat.business_user_id !== businessUserId || !seat.is_active) {
    // The binding exists but seat is not for this business or not active.
    // Try a direct query in case there are multiple seats (user at multiple businesses).
    return await _findActiveSeatForUserAtBusiness(businessUserId, userId);
  }

  return seat;
}

/**
 * Internal helper: when a user has multiple seats (multiple businesses),
 * the single SeatBinding join might return the wrong one. Do a targeted lookup.
 */
async function _findActiveSeatForUserAtBusiness(businessUserId, userId) {
  const { data: bindings, error } = await supabaseAdmin
    .from('SeatBinding')
    .select('seat_id')
    .eq('user_id', userId);

  if (error || !bindings || bindings.length === 0) return null;

  const seatIds = bindings.map(b => b.seat_id);

  const { data: seat } = await supabaseAdmin
    .from('BusinessSeat')
    .select('id, business_user_id, display_name, display_avatar_file_id, role_base, contact_method, is_active, invite_status, accepted_at, notes, created_at, updated_at')
    .eq('business_user_id', businessUserId)
    .eq('is_active', true)
    .in('id', seatIds)
    .maybeSingle();

  return seat || null;
}

// ============================================================
// Permission checks via seat
// ============================================================

/**
 * Check if a user has a specific permission at a business (seat-based).
 *
 * @param {string} businessUserId
 * @param {string} userId
 * @param {string} permission - e.g. 'profile.edit', 'team.manage'
 * @returns {Promise<boolean>}
 */
async function hasSeatPermission(businessUserId, userId, permission) {
  const seat = await getSeatForUser(businessUserId, userId);
  if (!seat) return false;

  if (seat.role_base === 'owner') return true;

  // Check per-seat override first, then fall back to per-user override
  const { data: seatOverride } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .select('allowed')
    .eq('business_user_id', businessUserId)
    .eq('seat_id', seat.id)
    .eq('permission', permission)
    .maybeSingle();

  if (seatOverride && seatOverride.allowed !== null && seatOverride.allowed !== undefined) {
    return seatOverride.allowed;
  }

  // Fallback: per-user override (legacy, during transition)
  const { data: userOverride } = await supabaseAdmin
    .from('BusinessPermissionOverride')
    .select('allowed')
    .eq('business_user_id', businessUserId)
    .eq('user_id', userId)
    .eq('permission', permission)
    .is('seat_id', null)
    .maybeSingle();

  if (userOverride && userOverride.allowed !== null && userOverride.allowed !== undefined) {
    return userOverride.allowed;
  }

  // Fall back to role default
  const { data: rolePerm } = await supabaseAdmin
    .from('BusinessRolePermission')
    .select('allowed')
    .eq('role_base', seat.role_base)
    .eq('permission', permission)
    .maybeSingle();

  return rolePerm?.allowed === true;
}

/**
 * Get full access object for a user at a business (seat-based).
 * Returns { hasAccess, seat, permissions, isOwner }
 *
 * @param {string} businessUserId
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getSeatAccess(businessUserId, userId) {
  const seat = await getSeatForUser(businessUserId, userId);
  if (!seat) {
    return { hasAccess: false, seat: null, permissions: [], isOwner: false };
  }

  const isOwner = seat.role_base === 'owner';

  if (isOwner) {
    return {
      hasAccess: true,
      seat,
      permissions: [...ALL_PERMS],
      isOwner: true,
    };
  }

  // Get base role permissions
  const { data: rolePerms } = await supabaseAdmin
    .from('BusinessRolePermission')
    .select('permission')
    .eq('role_base', seat.role_base)
    .eq('allowed', true);

  const basePerms = new Set((rolePerms || []).map(r => r.permission));

  // Overlay per-seat overrides (preferred), then per-user overrides (legacy fallback)
  const [{ data: seatOverrides }, { data: userOverrides }] = await Promise.all([
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('permission, allowed')
      .eq('business_user_id', businessUserId)
      .eq('seat_id', seat.id),
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('permission, allowed')
      .eq('business_user_id', businessUserId)
      .eq('user_id', userId)
      .is('seat_id', null),
  ]);

  // Apply user-level overrides first (lower precedence)
  for (const ov of (userOverrides || [])) {
    if (ov.allowed) { basePerms.add(ov.permission); }
    else { basePerms.delete(ov.permission); }
  }
  // Apply seat-level overrides second (higher precedence)
  for (const ov of (seatOverrides || [])) {
    if (ov.allowed) { basePerms.add(ov.permission); }
    else { basePerms.delete(ov.permission); }
  }

  return {
    hasAccess: true,
    seat,
    permissions: Array.from(basePerms),
    isOwner: false,
  };
}

/**
 * Route-level permission check. Returns structured result for route handlers.
 *
 * @param {string} businessUserId
 * @param {string} userId
 * @param {string|null} permission
 * @returns {Promise<{ hasAccess: boolean, isOwner: boolean, seat: object|null }>}
 */
async function checkSeatPermission(businessUserId, userId, permission = null) {
  const seat = await getSeatForUser(businessUserId, userId);

  if (!seat) {
    return { hasAccess: false, isOwner: false, seat: null };
  }

  const isOwner = seat.role_base === 'owner';

  if (!permission) {
    return { hasAccess: true, isOwner, seat };
  }

  if (isOwner) {
    return { hasAccess: true, isOwner: true, seat };
  }

  const allowed = await hasSeatPermission(businessUserId, userId, permission);
  return { hasAccess: allowed, isOwner: false, seat };
}

// ============================================================
// Batch helpers
// ============================================================

/**
 * Get all active seats for a user across all businesses.
 * Returns seat data enriched with business info.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function getAllSeatsForUser(userId) {
  // Step 1: Get all seat IDs for this user
  const { data: bindings, error: bindErr } = await supabaseAdmin
    .from('SeatBinding')
    .select('seat_id')
    .eq('user_id', userId);

  if (bindErr || !bindings || bindings.length === 0) return [];

  const seatIds = bindings.map(b => b.seat_id);

  // Step 2: Get all active seats with business info
  const { data: seats, error: seatErr } = await supabaseAdmin
    .from('BusinessSeat')
    .select(`
      id,
      business_user_id,
      display_name,
      display_avatar_file_id,
      role_base,
      contact_method,
      is_active,
      created_at
    `)
    .in('id', seatIds)
    .eq('is_active', true);

  if (seatErr || !seats || seats.length === 0) return [];

  // Step 3: Enrich with business info
  const bizIds = [...new Set(seats.map(s => s.business_user_id))];

  const [{ data: bizUsers }, { data: bizProfiles }] = await Promise.all([
    supabaseAdmin
      .from('User')
      .select('id, username, name')
      .in('id', bizIds),
    supabaseAdmin
      .from('BusinessProfile')
      .select('business_user_id, logo_file_id, business_type')
      .in('business_user_id', bizIds),
  ]);

  const bizUserMap = {};
  for (const u of (bizUsers || [])) bizUserMap[u.id] = u;
  const bizProfileMap = {};
  for (const p of (bizProfiles || [])) bizProfileMap[p.business_user_id] = p;

  return seats.map(seat => {
    const biz = bizUserMap[seat.business_user_id] || {};
    const profile = bizProfileMap[seat.business_user_id] || {};
    return {
      seat_id: seat.id,
      business_user_id: seat.business_user_id,
      business_name: biz.name || biz.username || 'Unknown Business',
      business_username: biz.username || '',
      business_logo_file_id: profile.logo_file_id || null,
      business_type: profile.business_type || null,
      display_name: seat.display_name,
      display_avatar_file_id: seat.display_avatar_file_id,
      role_base: seat.role_base,
      contact_method: seat.contact_method,
    };
  });
}

/**
 * Get all seats for a business (safe to return — no user data).
 *
 * @param {string} businessUserId
 * @param {object} options - { includeInactive: boolean }
 * @returns {Promise<object[]>}
 */
async function getBusinessSeats(businessUserId, options = {}) {
  let query = supabaseAdmin
    .from('BusinessSeat')
    .select('id, display_name, display_avatar_file_id, role_base, contact_method, is_active, invite_status, invite_email, accepted_at, deactivated_at, deactivated_reason, notes, created_at, updated_at')
    .eq('business_user_id', businessUserId);

  if (!options.includeInactive) {
    query = query.eq('is_active', true);
  }

  query = query.order('created_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    logger.warn('getBusinessSeats query error', { error: error.message, businessUserId });
    return [];
  }

  return data || [];
}

/**
 * For a given user, find all business IDs where the user has ANY of the
 * specified permissions. Seat-based equivalent of getBusinessIdsWithPermissions.
 *
 * @param {string} userId
 * @param {string[]} permissions
 * @returns {Promise<string[]>}
 */
async function getBusinessIdsWithSeatPermissions(userId, permissions) {
  // 1) Get all active seats for this user
  const seats = await getAllSeatsForUser(userId);
  if (seats.length === 0) return [];

  const bizIds = seats.map(s => s.business_user_id);
  const roles = [...new Set(seats.map(s => s.role_base))];

  const seatIds = seats.map(s => s.seat_id || s.id);

  // 2) Batch-fetch overrides (seat-based + user-based) + role defaults
  const [{ data: seatOverrides }, { data: userOverrides }, { data: rolePerms }] = await Promise.all([
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('business_user_id, seat_id, permission, allowed')
      .in('business_user_id', bizIds)
      .in('seat_id', seatIds)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('business_user_id, permission, allowed')
      .in('business_user_id', bizIds)
      .eq('user_id', userId)
      .is('seat_id', null)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessRolePermission')
      .select('role_base, permission, allowed')
      .in('role_base', roles)
      .in('permission', permissions),
  ]);

  // 3) Build maps — seat overrides take precedence over user overrides
  const userOvrMap = {};
  for (const o of (userOverrides || [])) userOvrMap[`${o.business_user_id}:${o.permission}`] = o.allowed;
  const seatOvrMap = {};
  for (const o of (seatOverrides || [])) seatOvrMap[`${o.seat_id}:${o.permission}`] = o.allowed;
  const rpMap = {};
  for (const r of (rolePerms || [])) rpMap[`${r.role_base}:${r.permission}`] = r.allowed;

  // 4) Resolve
  const result = [];
  for (const s of seats) {
    const biz = s.business_user_id;
    const sid = s.seat_id || s.id;
    if (s.role_base === 'owner') { result.push(biz); continue; }

    const hasAny = permissions.some(perm => {
      // Seat override > user override > role default
      const seatOvr = seatOvrMap[`${sid}:${perm}`];
      if (seatOvr !== undefined) return seatOvr;
      const userOvr = userOvrMap[`${biz}:${perm}`];
      if (userOvr !== undefined) return userOvr;
      return rpMap[`${s.role_base}:${perm}`] === true;
    });
    if (hasAny) result.push(biz);
  }

  return result;
}

/**
 * For a business, find all seat holder user IDs who have ANY of the
 * specified permissions. Used for notification routing.
 *
 * @param {string} businessUserId
 * @param {string[]} permissions
 * @param {string|null} excludeUserId
 * @returns {Promise<string[]>}
 */
async function getSeatHoldersWithPermissions(businessUserId, permissions, excludeUserId = null) {
  // 1) Get all active seats
  const seats = await getBusinessSeats(businessUserId);
  if (seats.length === 0) return [];

  const seatIds = seats.map(s => s.id);
  const roles = [...new Set(seats.map(s => s.role_base))];

  // 2) Get bindings to resolve seat → user
  const { data: bindings } = await supabaseAdmin
    .from('SeatBinding')
    .select('seat_id, user_id')
    .in('seat_id', seatIds);

  if (!bindings || bindings.length === 0) return [];

  const seatToUser = {};
  for (const b of bindings) seatToUser[b.seat_id] = b.user_id;

  // 3) Batch-fetch overrides (seat-based + user-based) + role defaults
  const userIds = bindings.map(b => b.user_id);
  const [{ data: seatOverrides }, { data: userOverrides }, { data: rolePerms }] = await Promise.all([
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('seat_id, permission, allowed')
      .eq('business_user_id', businessUserId)
      .in('seat_id', seatIds)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessPermissionOverride')
      .select('user_id, permission, allowed')
      .eq('business_user_id', businessUserId)
      .in('user_id', userIds)
      .is('seat_id', null)
      .in('permission', permissions),
    supabaseAdmin
      .from('BusinessRolePermission')
      .select('role_base, permission, allowed')
      .in('role_base', roles)
      .in('permission', permissions),
  ]);

  const seatOvrMap = {};
  for (const o of (seatOverrides || [])) seatOvrMap[`${o.seat_id}:${o.permission}`] = o.allowed;
  const userOvrMap = {};
  for (const o of (userOverrides || [])) userOvrMap[`${o.user_id}:${o.permission}`] = o.allowed;
  const rpMap = {};
  for (const r of (rolePerms || [])) rpMap[`${r.role_base}:${r.permission}`] = r.allowed;

  // 4) Resolve per seat
  const result = [];
  for (const seat of seats) {
    const uid = seatToUser[seat.id];
    if (!uid) continue;
    if (excludeUserId && String(uid) === String(excludeUserId)) continue;
    if (seat.role_base === 'owner') { result.push(uid); continue; }

    const hasAny = permissions.some(perm => {
      // Seat override > user override > role default
      const seatOvr = seatOvrMap[`${seat.id}:${perm}`];
      if (seatOvr !== undefined) return seatOvr;
      const userOvr = userOvrMap[`${uid}:${perm}`];
      if (userOvr !== undefined) return userOvr;
      return rpMap[`${seat.role_base}:${perm}`] === true;
    });
    if (hasAny) result.push(uid);
  }

  return result;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Get role rank for hierarchy comparisons.
 */
function getRoleRank(roleBase) {
  return BUSINESS_ROLE_RANK[roleBase] || 0;
}

/**
 * Write a business audit log entry (seat-aware).
 * During transition, writes both actor_user_id and logs seat info in metadata.
 *
 * @param {string} businessUserId
 * @param {string} actorSeatId - The acting seat's ID
 * @param {string} action
 * @param {string|null} targetType
 * @param {string|null} targetId
 * @param {object} metadata
 */
async function writeSeatAuditLog(businessUserId, actorSeatId, action, targetType, targetId, metadata = {}) {
  try {
    // Resolve actor_user_id from seat binding (for backward compat)
    let actorUserId = null;
    if (actorSeatId) {
      const { data: binding } = await supabaseAdmin
        .from('SeatBinding')
        .select('user_id')
        .eq('seat_id', actorSeatId)
        .maybeSingle();
      actorUserId = binding?.user_id || null;
    }

    await supabaseAdmin
      .from('BusinessAuditLog')
      .insert({
        business_user_id: businessUserId,
        actor_user_id: actorUserId || '00000000-0000-0000-0000-000000000000', // NOT NULL constraint
        actor_seat_id: actorSeatId || null,
        action,
        target_type: targetType || null,
        target_id: targetId || null,
        metadata: {
          ...metadata,
          actor_seat_id: actorSeatId, // also in metadata for backward compat
        },
      });
  } catch (err) {
    logger.warn('Failed to write business audit log (non-fatal)', {
      error: err.message,
      businessUserId,
      actorSeatId,
      action,
    });
  }
}

module.exports = {
  getSeatForUser,
  hasSeatPermission,
  getSeatAccess,
  checkSeatPermission,
  getAllSeatsForUser,
  getBusinessSeats,
  getBusinessIdsWithSeatPermissions,
  getSeatHoldersWithPermissions,
  getRoleRank,
  writeSeatAuditLog,
  BUSINESS_ROLE_RANK,
  ALL_PERMS,
};

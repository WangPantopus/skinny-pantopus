/**
 * Visibility Policy Module
 *
 * Central source of truth for who can see what across two graphs:
 *   - Residency Graph (Home membership)
 *   - Trust Graph (Connections / Relationships)
 *
 * Every route handler should call these helpers instead of inline ad-hoc checks.
 *
 * Visibility Matrix:
 * ┌──────────────────────────────┬────────┬─────────────┬──────────────┐
 * │ Scope                        │ Public │ Connections │ Home Members │
 * ├──────────────────────────────┼────────┼─────────────┼──────────────┤
 * │ Public pro/business posts    │  yes   │     yes     │     yes      │
 * │ Personal connection-only     │  no    │     yes     │     yes      │
 * │ Home private content         │  no    │     no      │     yes      │
 * │ Mailbox items                │  no    │     no      │ home perm    │
 * │ Exact residential address    │  no    │  optional   │     yes      │
 * │ Professional service area    │  yes*  │     yes     │     yes      │
 * └──────────────────────────────┴────────┴─────────────┴──────────────┘
 *  * if profile is_public = true
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

// ============================================================
// GRAPH QUERY HELPERS
// ============================================================

/**
 * Get the relationship status between two users.
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<'none'|'pending_sent'|'pending_received'|'connected'|'blocked'>}
 */
async function getRelationshipStatus(userA, userB) {
  if (!userA || !userB || userA === userB) return 'none';
  try {
    const { data } = await supabaseAdmin
      .from('Relationship')
      .select('id, requester_id, addressee_id, status, blocked_by')
      .or(
        `and(requester_id.eq.${userA},addressee_id.eq.${userB}),and(requester_id.eq.${userB},addressee_id.eq.${userA})`
      )
      .single();

    if (!data) return 'none';

    if (data.status === 'blocked') return 'blocked';
    if (data.status === 'accepted') return 'connected';
    if (data.status === 'pending') {
      return data.requester_id === userA ? 'pending_sent' : 'pending_received';
    }
    return 'none';
  } catch {
    return 'none';
  }
}

/**
 * Check if two users are connected (accepted relationship).
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>}
 */
async function isConnected(userA, userB) {
  const status = await getRelationshipStatus(userA, userB);
  return status === 'connected';
}

/**
 * Check if one user has blocked the other (either direction).
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>}
 */
async function isBlocked(userA, userB) {
  const status = await getRelationshipStatus(userA, userB);
  return status === 'blocked';
}

/**
 * Check if user is an active home member.
 * @param {string} userId
 * @param {string} homeId
 * @returns {Promise<boolean>}
 */
async function isHomeMember(userId, homeId) {
  if (!userId || !homeId) return false;
  try {
    const { data } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('user_id', userId)
      .eq('home_id', homeId)
      .eq('is_active', true)
      .is('end_at', null)
      .single();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Check if two users share at least one active home.
 * @param {string} userA
 * @param {string} userB
 * @returns {Promise<boolean>}
 */
async function shareHome(userA, userB) {
  if (!userA || !userB || userA === userB) return false;
  try {
    // Find homes where both are active members
    const { data: homesA } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userA)
      .eq('is_active', true)
      .is('end_at', null);

    if (!homesA || homesA.length === 0) return false;

    const homeIds = homesA.map(h => h.home_id);
    const { data: shared } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('user_id', userB)
      .eq('is_active', true)
      .is('end_at', null)
      .in('home_id', homeIds)
      .limit(1);

    return shared && shared.length > 0;
  } catch {
    return false;
  }
}

// ============================================================
// CONTENT VISIBILITY CHECKS
// ============================================================

/**
 * Check if a viewer can see a post based on its visibility setting.
 *
 * @param {string} viewerId - the user trying to view
 * @param {object} post - must have { user_id, visibility, home_id? }
 * @returns {Promise<boolean>}
 */
async function canViewContent(viewerId, post) {
  // Owner can always see their own content
  if (viewerId === post.user_id) return true;

  switch (post.visibility) {
    case 'public':
      // Check block — blocked users can't see anything
      if (await isBlocked(viewerId, post.user_id)) return false;
      return true;

    case 'neighborhood':
      // Neighborhood scoping is handled by geo-query; here we just check block
      if (await isBlocked(viewerId, post.user_id)) return false;
      return true;

    case 'followers':
      // Legacy 'followers' visibility on personal posts is treated as
      // 'connections' after the peer-follow removal. Persona-context posts
      // are routed via PersonaMembership before reaching this switch.
      if (await isBlocked(viewerId, post.user_id)) return false;
      if (await isConnected(viewerId, post.user_id)) return true;
      if (await shareHome(viewerId, post.user_id)) return true;
      return false;

    case 'connections':
      if (await isBlocked(viewerId, post.user_id)) return false;
      // Only connections and home-mates
      if (await isConnected(viewerId, post.user_id)) return true;
      if (await shareHome(viewerId, post.user_id)) return true;
      return false;

    case 'private':
      return false;

    case 'home':
      // Home-scoped content: must be a member of the specific home
      if (!post.home_id) return false;
      return await isHomeMember(viewerId, post.home_id);

    default:
      return false;
  }
}

/**
 * Determine what profile information a viewer can see.
 * Returns a visibility level that the route can use to filter fields.
 *
 * @param {string} viewerId
 * @param {string} profileUserId
 * @returns {Promise<'full'|'connected'|'public'|'blocked'>}
 */
async function getProfileVisibility(viewerId, profileUserId) {
  if (viewerId === profileUserId) return 'full';

  if (await isBlocked(viewerId, profileUserId)) return 'blocked';

  if (await shareHome(viewerId, profileUserId)) return 'full';
  if (await isConnected(viewerId, profileUserId)) return 'connected';
  return 'public';
}

/**
 * Check if viewer can see the exact home address.
 * Only home members and optionally connections (with permission) can see it.
 *
 * @param {string} viewerId
 * @param {string} homeId
 * @param {string} homeOwnerId - for checking connection permission
 * @returns {Promise<boolean>}
 */
async function canViewExactAddress(viewerId, homeId, homeOwnerId) {
  // Home members always see their home's address
  if (await isHomeMember(viewerId, homeId)) return true;

  // Connections can see if the owner granted location visibility
  if (homeOwnerId && await isConnected(viewerId, homeOwnerId)) {
    try {
      const { data: perm } = await supabaseAdmin
        .from('RelationshipPermission')
        .select('visibility')
        .eq('owner_id', homeOwnerId)
        .eq('viewer_id', viewerId)
        .single();

      if (perm && perm.visibility === 'full') return true;
    } catch {
      // No permission row = no access
    }
  }

  return false;
}

/**
 * Check if a user can send a direct message to another user.
 * Requires a connection (trust graph) or shared home membership.
 *
 * @param {string} senderId
 * @param {string} recipientId
 * @returns {Promise<boolean>}
 */
async function canMessageUser(senderId, recipientId) {
  if (!senderId || !recipientId || senderId === recipientId) return false;
  if (await isBlocked(senderId, recipientId)) return false;
  if (await isConnected(senderId, recipientId)) return true;
  if (await shareHome(senderId, recipientId)) return true;
  return false;
}

/**
 * Check if a viewer can see a professional profile.
 * Public profiles are visible to everyone; private ones only to the owner.
 *
 * @param {string} viewerId
 * @param {object} profile - must have { user_id, is_public, is_active }
 * @returns {Promise<boolean>}
 */
async function canViewProfessionalProfile(viewerId, profile) {
  if (viewerId === profile.user_id) return true;
  if (!profile.is_active) return false;
  if (profile.is_public) {
    // Block check
    if (await isBlocked(viewerId, profile.user_id)) return false;
    return true;
  }
  // Private profiles: connections and home-mates only
  if (await isConnected(viewerId, profile.user_id)) return true;
  if (await shareHome(viewerId, profile.user_id)) return true;
  return false;
}

// ============================================================
// IDENTITY FIREWALL — Privacy Settings Integration
// ============================================================

/**
 * Check if a user is searchable by a viewer, respecting UserPrivacySettings.
 *
 * @param {string} viewerId - the person searching
 * @param {string} targetUserId - the person being searched for
 * @returns {Promise<boolean>}
 */
async function isSearchable(viewerId, targetUserId) {
  if (viewerId === targetUserId) return true;

  // Check scoped blocks (full or search_only)
  const { data: block } = await supabaseAdmin
    .from('UserProfileBlock')
    .select('id, block_scope')
    .eq('user_id', targetUserId)
    .eq('blocked_user_id', viewerId)
    .in('block_scope', ['full', 'search_only'])
    .maybeSingle();

  if (block) return false;

  // Check legacy Relationship blocks too
  if (await isBlocked(viewerId, targetUserId)) return false;

  // Check privacy settings
  const { data: settings } = await supabaseAdmin
    .from('UserPrivacySettings')
    .select('search_visibility')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const visibility = settings?.search_visibility || 'everyone';

  switch (visibility) {
    case 'everyone':
      return true;
    case 'mutuals':
      return await isConnected(viewerId, targetUserId);
    case 'nobody':
      return false;
    default:
      return true;
  }
}

/**
 * Check if a viewer can see a specific profile field based on privacy settings.
 *
 * @param {string} viewerId
 * @param {string} targetUserId
 * @param {string} field - one of: 'gig_history', 'neighborhood', 'home_affiliation'
 * @returns {Promise<boolean>}
 */
async function canViewProfileField(viewerId, targetUserId, field) {
  if (viewerId === targetUserId) return true;

  const fieldToColumn = {
    gig_history: 'show_gig_history',
    neighborhood: 'show_neighborhood',
    home_affiliation: 'show_home_affiliation',
  };

  const column = fieldToColumn[field];
  if (!column) return false;

  const { data: settings } = await supabaseAdmin
    .from('UserPrivacySettings')
    .select(column)
    .eq('user_id', targetUserId)
    .maybeSingle();

  const level = settings?.[column] || 'public';

  switch (level) {
    case 'public':
      return true;
    case 'followers':
      // Legacy stored value — peer-follow has been removed, so this now
      // collapses to the connections/home-mate scope.
      if (await isConnected(viewerId, targetUserId)) return true;
      if (await shareHome(viewerId, targetUserId)) return true;
      return false;
    case 'connections':
      if (await isConnected(viewerId, targetUserId)) return true;
      if (await shareHome(viewerId, targetUserId)) return true;
      return false;
    case 'private':
      return false;
    default:
      return true;
  }
}

/**
 * Check UserProfileBlock with scope awareness.
 * Extends the existing Relationship-based isBlocked.
 *
 * @param {string} viewerId
 * @param {string} targetUserId
 * @param {string} scope - 'full'|'search_only'|'business_context'|'any'. Default 'full'.
 * @returns {Promise<boolean>}
 */
async function isScopedBlocked(viewerId, targetUserId, scope = 'full') {
  if (viewerId === targetUserId) return false;

  // Check legacy Relationship block first (always full scope)
  if (await isBlocked(viewerId, targetUserId)) return true;

  const scopeFilter = scope === 'any'
    ? ['full', 'search_only', 'business_context']
    : scope === 'full'
    ? ['full']
    : [scope, 'full']; // specific scope + full always applies

  // Check both directions of UserProfileBlock
  const { data: blocks } = await supabaseAdmin
    .from('UserProfileBlock')
    .select('id')
    .or(
      `and(user_id.eq.${viewerId},blocked_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},blocked_user_id.eq.${viewerId})`,
    )
    .in('block_scope', scopeFilter)
    .limit(1);

  return blocks && blocks.length > 0;
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Graph queries
  getRelationshipStatus,
  isConnected,
  isBlocked,
  isHomeMember,
  shareHome,

  // Content visibility
  canViewContent,
  getProfileVisibility,
  canViewExactAddress,
  canMessageUser,
  canViewProfessionalProfile,

  // Identity Firewall — privacy settings
  isSearchable,
  canViewProfileField,
  isScopedBlocked,
};

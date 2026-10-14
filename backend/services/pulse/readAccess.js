// Who may read a post: the one check every path that returns a post uses
// (docs/product/pulse-build/02-contract.md §0 and §5). It is the post page's rule, moved here from
// routes/posts.js unchanged; S5 adds the Pulse audience scopes and S11 the moderation states.

const supabaseAdmin = require('../../config/supabaseAdmin');
const blockService = require('../blockService');
const { isFanBlockedFromPersona } = require('../personaBlockService');
const { getPersonaMembershipForUser, getViewerTierRankForPersona } = require('../../utils/identityProfiles');
const { haversineMeters } = require('../../utils/trustState');

// The Post columns canReadPost reads; a path that checks a post it selected itself selects these.
const POST_READ_SELECT = [
  'id',
  'user_id',
  'archived_at',
  'archive_reason',
  'post_metadata',
  'identity_context_type',
  'identity_context_id',
  'target_tier_rank',
  'visibility',
  'audience',
  'allow_external_share',
  'origin',
  'latitude',
  'longitude',
  'location_name',
  'radius_miles',
  'distribution_targets',
].join(', ');

const METERS_PER_MILE = 1609.34;
const LEGACY_LOCAL_POST_RADIUS_METERS = 40000; // ~25 miles
const MAX_POST_RADIUS_MILES = 25000;

function resolvePostVisibilityRadiusMeters(post) {
  if (post.visibility !== 'radius') {
    return LEGACY_LOCAL_POST_RADIUS_METERS;
  }

  const radiusMiles = Number(post.radius_miles);
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
    return LEGACY_LOCAL_POST_RADIUS_METERS;
  }

  return Math.round(Math.min(radiusMiles, MAX_POST_RADIUS_MILES) * METERS_PER_MILE);
}

async function isConnectedToUser(viewerId, authorId) {
  const { data: rel } = await supabaseAdmin
    .from('Relationship')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${authorId}),and(requester_id.eq.${authorId},addressee_id.eq.${viewerId})`
    )
    .maybeSingle();
  return !!rel;
}

async function isPersonaAudienceMember(viewerId, personaId) {
  if (!viewerId || !personaId) return false;
  const membership = await getPersonaMembershipForUser(personaId, viewerId);
  return ['active', 'past_due'].includes(membership?.status);
}

async function canViewPersonaPostAudience(post, viewerId) {
  if (!viewerId || !post?.identity_context_id) return false;

  const requiredRank = Number(post.target_tier_rank || 0);
  if (!requiredRank) {
    return isPersonaAudienceMember(viewerId, post.identity_context_id);
  }

  const rank = await getViewerTierRankForPersona(post.identity_context_id, viewerId);
  if (rank >= requiredRank) return true;

  const membership = await getPersonaMembershipForUser(post.identity_context_id, viewerId);
  return ['active', 'past_due'].includes(membership?.status)
    && membership.relationship_type === 'subscriber'
    && requiredRank <= 2;
}

// A link opens outside the app only for a post its author made public and left sharing on.
// Nobody else's Share tap widens who can read a post.
function isPubliclyShareable(post) {
  const isPublic = post.visibility === 'public' || post.audience === 'public';
  return isPublic && post.allow_external_share !== false;
}

/** Whether `userId` (null: signed out) may read `post`, a row with at least POST_READ_SELECT. */
async function canReadPost(post, userId) {
  if (post.user_id === userId) return true;
  // Removed by moderation: only its author still sees it.
  if (post.archive_reason === 'moderation') return false;
  // Profile blocks (UserBlock) hide posts in both directions, like messaging.
  if (userId && post.user_id && await blockService.isBlocked(post.user_id, userId)) return false;
  if (post.identity_context_type === 'persona'
      && (post.archived_at || post.status === 'removed'
        || (post.post_metadata?.broadcast_status != null
          && post.post_metadata.broadcast_status !== 'published'))) return false;

  if (
    userId
    && post.identity_context_type === 'persona'
    && post.identity_context_id
    && await isFanBlockedFromPersona(post.identity_context_id, userId)
  ) {
    return false;
  }

  if (!userId) {
    // Direct-link views from outside the app only work for posts that are already public.
    return isPubliclyShareable(post);
  }

  const targets = Array.isArray(post.distribution_targets) ? post.distribution_targets : [];
  if (targets.length > 0) {
    if (targets.includes('place')) return true;
    if (targets.includes('persona_followers') && await canViewPersonaPostAudience(post, userId)) return true;
    if (targets.includes('public')) return true;
    // Legacy 'followers' target is treated as 'connections' after the
    // peer-follow removal — see migration 140.
    if ((targets.includes('connections') || targets.includes('followers')) && await isConnectedToUser(userId, post.user_id)) return true;
    if (
      targets.includes('country:US')
      && post.audience === 'national'
      && post.origin === 'curator'
    ) {
      return true;
    }
    return false;
  }

  if (post.visibility === 'followers' || post.audience === 'followers') {
    // Persona-context posts target Beacon members (PersonaMembership).
    // Personal posts no longer use a peer 'followers' audience — any straggler
    // value here is treated as 'connections' for safety.
    if (post.identity_context_type === 'persona') {
      return canViewPersonaPostAudience(post, userId);
    }
    return isConnectedToUser(userId, post.user_id);
  }

  if (post.visibility === 'connections' || post.audience === 'connections') {
    return isConnectedToUser(userId, post.user_id);
  }

  if (post.visibility === 'public') return true;

  if (['neighborhood', 'city', 'radius'].includes(post.visibility)) {
    const visibilityRadiusMeters = resolvePostVisibilityRadiusMeters(post);
    if (post.latitude && post.longitude) {
      const { data: viewer } = await supabaseAdmin
        .from('User')
        .select('latitude, longitude, city')
        .eq('id', userId)
        .single();
      if (viewer) {
        if (viewer.latitude && viewer.longitude) {
          const distMeters = haversineMeters(
            post.latitude, post.longitude,
            viewer.latitude, viewer.longitude
          );
          if (distMeters <= visibilityRadiusMeters) return true;
        }
        // Fallback: city match
        if (viewer.city && post.location_name &&
            viewer.city.toLowerCase() === post.location_name.toLowerCase()) {
          return true;
        }
      }
    }

    // Fallback: city match between poster and viewer
    const { data: users } = await supabaseAdmin
      .from('User')
      .select('city')
      .in('id', [userId, post.user_id]);
    if (users && users.length === 2 &&
        users[0].city && users[1].city &&
        users[0].city.toLowerCase() === users[1].city.toLowerCase()) {
      return true;
    }

    // No location match — deny access to local-scope posts
    return false;
  }

  return false;
}

/** The posts of `posts` that `userId` may read, in order. A failed check leaves a post out. */
async function readablePosts(posts, userId) {
  const readable = await Promise.all((posts || []).map((post) => canReadPost(post, userId).catch(() => false)));
  return (posts || []).filter((_, i) => readable[i] === true);
}

module.exports = { canReadPost, readablePosts, isPubliclyShareable, POST_READ_SELECT };

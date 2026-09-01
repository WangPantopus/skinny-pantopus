const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { computeTrustState, getPostingIdentities, canPostToAudience, canPostToPlace } = require('../utils/trustState');
const { canPostWithIdentityToAudience } = require('../utils/identityPolicy');
const {
  ensureLocalProfile,
  getPersonaById,
  getPersonaMembershipForUser,
  getViewerTierRankForPersona,
} = require('../utils/identityProfiles');
const { isPersonaEnabled } = require('../utils/featureFlags');
const {
  SAFE_CREATOR_SELECT,
  serializeUserAsLocalIdentity,
  serializeUserIdentityForViewer,
} = require('../serializers/identitySerializers');
const { matchBusinessesForPost } = require('../jobs/organicMatch');
const { checkHomePermission, getActiveOccupancy, mapLegacyRole } = require('../utils/homePermissions');
const { computeUtilityScore } = require('../utils/feedRanking');
const s3 = require('../services/s3Service');
const feedService = require('../services/feedService');
const { generateNeighborhoodFacts } = require('../services/ai/neighborhoodFactService');
const { encodeGeohash6: _encodeGeohash6 } = require('../utils/geohash');

// ── Cold-start seeding helpers ──────────────────────────────────────────

/**
 * Build a synthetic feed item from a FactCard.
 */
function _buildSeededItem(fact, timestamp, systemAuthor) {
  return {
    id: fact.id,
    user_id: null,
    title: fact.title,
    content: fact.body,
    media_urls: [],
    media_types: [],
    media_thumbnails: [],
    media_live_urls: [],
    post_type: fact.post_type || 'general',
    post_format: 'standard',
    visibility: 'neighborhood',
    visibility_scope: 'neighborhood',
    location_precision: 'neighborhood_only',
    tags: [],
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    save_count: 0,
    is_pinned: false,
    is_edited: false,
    is_archived: false,
    created_at: timestamp,
    updated_at: timestamp,
    userHasLiked: false,
    userHasSaved: false,
    userHasReposted: false,
    home_id: null,
    latitude: null,
    longitude: null,
    effective_latitude: null,
    effective_longitude: null,
    location_name: null,
    distance_meters: null,
    post_as: 'personal',
    audience: 'nearby',
    business_id: null,
    target_place_id: null,
    resolved_at: null,
    archived_at: null,
    archive_reason: null,
    is_story: false,
    story_expires_at: null,
    distribution_targets: ['place'],
    creator: systemAuthor,
    home: null,
    is_seeded: true,
    metadata: {
      source: fact.source,
      cta: fact.cta || null,
      fact_type: fact.type,
    },
  };
}

const DISMISSED_FACTS_CAP = 50;
const notificationService = require('../services/notificationService');
const { isFanBlockedFromPersona } = require('../services/personaBlockService');
const { runPostCreatedHooks } = require('../services/postCreationHooksService');
const {
  normalizeFeedPostRow,
  normalizeMediaUrls,
  normalizeAlignedMediaUrls,
  getMuteAndHideFilters,
  applyMuteHideFilters,
  enrichWithUserStatus,
  attachIdentityAuthors,
  applyPostLocationPrivacy,
  applyPostLocationPrivacyBatch,
  applyCursorCondition,
  buildCursorPagination,
  FEED_POST_SELECT,
} = feedService;

// ============ VALIDATION SCHEMAS ============

const POST_TYPES = [
  // Place types
  'ask_local', 'recommendation', 'event', 'lost_found',
  'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide',
  // Non-Place Feed types
  'general', 'personal_update', 'announcement', 'service_offer',
  'resources_howto', 'progress_wins',
];

const FEED_SURFACES = ['place', 'connections', 'personas'];

const PLACE_POST_TYPES = [
  'ask_local', 'recommendation', 'event', 'lost_found',
  'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide',
];

const ALERT_TEMPLATE_KINDS = [
  'road_hazard', 'power_outage', 'weather_damage', 'missing_pet', 'official_notice',
];

const HOME_PLACE_TYPES = [
  'ask_local', 'recommendation', 'event', 'lost_found',
  'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide',
];

const BUSINESS_PLACE_TYPES = [
  'event', 'deal', 'local_update',
];

const POST_FORMATS = ['standard', 'quick_pulse', 'deep_dive', 'shout_out', 'show_and_tell'];

const LOCATION_PRECISIONS = ['exact_place', 'approx_area', 'neighborhood_only', 'none'];

const VISIBILITY_SCOPES = ['neighborhood', 'city', 'radius', 'global'];

const SAFETY_ALERT_KINDS = [
  'crime_incident', 'public_safety',
  'road_hazard', 'power_outage', 'weather_damage', 'missing_pet', 'official_notice',
  // Frontend-composer kinds (SafetyAlertFields.tsx)
  'theft', 'vandalism', 'suspicious', 'hazard', 'scam', 'other',
];

// Map frontend alert kinds to valid DB enum values until migration 081 is applied
const SAFETY_KIND_TO_DB = {
  theft: 'crime_incident',
  vandalism: 'crime_incident',
  suspicious: 'public_safety',
  hazard: 'road_hazard',
  scam: 'crime_incident',
  other: 'public_safety',
};

const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternal|whatsapp|telegram|preview|fetch|http|curl|wget|python|java\/|go-http|axios|node-fetch|postman/i;

function toDbSafetyKind(kind) {
  return kind ? (SAFETY_KIND_TO_DB[kind] || kind) : null;
}

const POST_AS_TYPES = ['personal', 'business', 'home', 'persona'];
const AUDIENCE_TYPES = ['connections', 'followers', 'network', 'nearby', 'saved_place', 'household', 'neighborhood', 'target_area', 'national', 'public'];
const LOCAL_AUDIENCES = ['nearby', 'neighborhood', 'saved_place', 'target_area'];

const TOPIC_VALUES = ['sports'];
const SPORTS_SCOPES = ['local', 'regional', 'national', 'youth', 'school', 'rec', 'watch'];
const SPORTS_LEAGUES = ['nba', 'nfl', 'mls', 'nwsl', 'mlb', 'nhl', 'college', 'youth', 'other'];
const DISTRIBUTION_TARGET_VALUES = ['place', 'connections', 'persona_followers', 'public', 'country:US'];
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

const createPostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  title: Joi.string().max(255).optional(),
  mediaUrls: Joi.array().items(Joi.string().uri()).max(10).optional(),
  mediaTypes: Joi.array().items(Joi.string().valid('image', 'video', 'live_photo')).optional(),
  mediaThumbnails: Joi.array().items(Joi.string().uri().allow('', null)).max(10).optional(),
  mediaLiveUrls: Joi.array().items(Joi.string().uri().allow('', null)).max(10).optional(),
  postType: Joi.string().valid(...POST_TYPES).default('general'),
  postFormat: Joi.string().valid(...POST_FORMATS).default('standard'),
  visibility: Joi.string().valid('public', 'neighborhood', 'followers', 'private', 'city', 'radius', 'connections').default('neighborhood'),
  visibilityScope: Joi.string().valid(...VISIBILITY_SCOPES).default('neighborhood'),
  locationPrecision: Joi.string().valid(...LOCATION_PRECISIONS).default('approx_area'),
  homeId: Joi.string().uuid().optional(),
  // New: Post As + Audience
  postAs: Joi.string().valid(...POST_AS_TYPES).default('personal'),
  audience: Joi.string().valid(...AUDIENCE_TYPES).optional(),
  identityContextId: Joi.string().uuid().optional(),
  targetPlaceId: Joi.string().uuid().optional(),
  businessId: Joi.string().uuid().optional(),
  isStory: Joi.boolean().default(false),
  // Geo-location fields
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  locationName: Joi.string().max(255).optional(),
  locationAddress: Joi.string().max(500).optional(),
  // Tags
  tags: Joi.array().items(Joi.string().max(50)).max(3).optional(),
  // Event fields
  eventDate: Joi.date().iso().optional(),
  eventEndDate: Joi.date().iso().optional(),
  eventVenue: Joi.string().max(255).optional(),
  // Safety Alert fields
  safetyAlertKind: Joi.string().valid(...SAFETY_ALERT_KINDS).when('postType', {
    is: 'alert', then: Joi.required(), otherwise: Joi.optional(),
  }),
  safetyHappenedAt: Joi.date().iso().optional(),
  safetyHappenedEnd: Joi.date().iso().optional(),
  safetyBehaviorDescription: Joi.string().max(2000).optional(),
  // Frontend alias for safetyBehaviorDescription
  behaviorDescription: Joi.string().max(2000).optional(),
  // Deal fields
  dealExpiresAt: Joi.date().iso().optional(),
  dealBusinessName: Joi.string().max(255).optional(),
  // Frontend alias for dealBusinessName
  businessName: Joi.string().max(255).optional(),
  // Lost & Found
  lostFoundType: Joi.string().valid('lost', 'found').optional(),
  lostFoundContactPref: Joi.string().valid('dm', 'comment', 'phone').optional(),
  // Frontend alias for lostFoundContactPref
  contactPref: Joi.string().valid('dm', 'comment', 'phone').optional(),
  contactPhone: Joi.string().pattern(/^\d{7,15}$/).optional(),
  // Services & Offers
  serviceCategory: Joi.string().max(100).optional(),
  // Cross-surface references
  refListingId: Joi.string().uuid().optional(),
  refTaskId: Joi.string().uuid().optional(),
  // Radius for radius-based visibility
  radiusMiles: Joi.number().min(1).max(25000).optional(),
  // v1.1: Distribution targets & cross-post
  distributionTargets: Joi.array().items(Joi.string().valid(...DISTRIBUTION_TARGET_VALUES)).optional(),
  crossPostToConnections: Joi.boolean().default(false),
  // v1.1: GPS timestamp for freshness validation
  gpsTimestamp: Joi.date().iso().optional(),
  gpsLatitude: Joi.number().min(-90).max(90).optional(),
  gpsLongitude: Joi.number().min(-180).max(180).optional(),
  // v1.2: Social layer fields
  purpose: Joi.string().valid(
    'ask', 'offer', 'heads_up', 'recommend', 'lost_found', 'local_update',
    'neighborhood_win', 'visitor_guide', 'learn', 'showcase', 'story', 'event', 'deal'
  ).optional(),
  profileVisibilityScope: Joi.string().valid(
    'public', 'followers', 'connections', 'local_context', 'hidden'
  ).default('public'),
  showOnProfile: Joi.boolean().default(true),
  // Geocode provenance (optional, threaded from geo.resolve)
  geocodeProvider: Joi.string().max(50).allow('', null).optional(),
  geocodeAccuracy: Joi.string().max(50).allow('', null).optional(),
  geocodePlaceId: Joi.string().max(255).allow('', null).optional(),
  // Sports topic lane (Phase 1)
  topic: Joi.string().valid(...TOPIC_VALUES).optional(),
  sportsScope: Joi.string().valid(...SPORTS_SCOPES).optional(),
  postMetadata: Joi.object({
    league: Joi.string().valid(...SPORTS_LEAGUES),
    team_tag: Joi.string().max(64),
    event_key: Joi.string().max(64),
    is_game_thread: Joi.boolean(),
    is_watch_prompt: Joi.boolean(),
    fresh_until: Joi.string().isoDate(),
    /** Sports Pulse starter / composer template (matches mobile SPORTS_PULSE_STARTERS keys). */
    starter_key: Joi.string().valid('anyone_watching', 'best_place_watch', 'youth_signups', 'pickup_weekend').optional(),
  }).unknown(true).optional(),
}).custom((value, helpers) => {
  if ((value.latitude != null) !== (value.longitude != null)) {
    return helpers.error('any.custom', { message: 'latitude and longitude must both be provided together' });
  }
  // Alert: enforce location precision restrictions
  if (value.postType === 'alert' && value.locationPrecision === 'exact_place') {
    return helpers.error('any.custom', { message: 'Alerts cannot use exact_place precision' });
  }
  return value;
});

const updatePostSchema = Joi.object({
  content: Joi.string().min(1).max(5000),
  title: Joi.string().max(255).allow(null, ''),
  mediaUrls: Joi.array().items(Joi.string().uri()).max(10),
  mediaTypes: Joi.array().items(Joi.string().valid('image', 'video', 'live_photo')),
  mediaThumbnails: Joi.array().items(Joi.string().uri().allow('', null)).max(10),
  mediaLiveUrls: Joi.array().items(Joi.string().uri().allow('', null)).max(10),
  postType: Joi.string().valid(...POST_TYPES),
  postFormat: Joi.string().valid(...POST_FORMATS),
  visibility: Joi.string().valid('public', 'neighborhood', 'followers', 'private', 'city', 'radius'),
  visibilityScope: Joi.string().valid(...VISIBILITY_SCOPES),
  locationPrecision: Joi.string().valid(...LOCATION_PRECISIONS),
  latitude: Joi.number().min(-90).max(90).allow(null).optional(),
  longitude: Joi.number().min(-180).max(180).allow(null).optional(),
  locationName: Joi.string().max(255).allow(null, '').optional(),
  locationAddress: Joi.string().max(500).allow(null, '').optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(3),
  eventDate: Joi.date().iso().allow(null),
  eventEndDate: Joi.date().iso().allow(null),
  eventVenue: Joi.string().max(255).allow(null, ''),
  safetyAlertKind: Joi.string().valid(...SAFETY_ALERT_KINDS).allow(null),
  safetyHappenedAt: Joi.date().iso().allow(null),
  safetyHappenedEnd: Joi.date().iso().allow(null),
  safetyBehaviorDescription: Joi.string().max(2000).allow(null, ''),
  dealExpiresAt: Joi.date().iso().allow(null),
  dealBusinessName: Joi.string().max(255).allow(null, ''),
  lostFoundType: Joi.string().valid('lost', 'found').allow(null),
  lostFoundContactPref: Joi.string().valid('dm', 'comment', 'phone').allow(null),
  serviceCategory: Joi.string().max(100).allow(null, ''),
  radiusMiles: Joi.number().min(1).max(25000).allow(null),
}).min(1);

const createCommentSchema = Joi.object({
  comment: Joi.string().allow('').max(2000).required(),
  parentCommentId: Joi.string().uuid().optional()
});

const updateCommentSchema = Joi.object({
  comment: Joi.string().min(1).max(2000).required()
});

const reportPostSchema = Joi.object({
  reason: Joi.string().valid('spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other').required(),
  details: Joi.string().max(1000).optional()
});

const sharePostSchema = Joi.object({
  shareType: Joi.string().valid('repost', 'external').default('external'),
});

// ============ HELPER FUNCTIONS ============

/** Derive a purpose enum from canonical postType */
function derivePurposeFromPostType(postType) {
  const map = {
    ask_local: 'ask', lost_found: 'ask',
    service_offer: 'offer',
    alert: 'heads_up', local_update: 'heads_up', announcement: 'heads_up',
    recommendation: 'recommend',
    resources_howto: 'learn', visitor_guide: 'learn',
    progress_wins: 'showcase', neighborhood_win: 'showcase',
    general: 'story', personal_update: 'story',
    event: 'event',
    deal: 'deal',
  };
  return map[postType] || null;
}

/** Map surface tab names to DB-valid surface enum values */
function normalizeSurface(surface) {
  const map = { place: 'nearby', nearby: 'nearby', connections: 'connections' };
  return map[surface] || 'nearby';
}

function isUniqueConstraintError(error) {
  if (!error) return false;
  if (String(error.code) === '23505') return true;
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes('duplicate key') || message.includes('unique constraint') || details.includes('duplicate key');
}

async function findExistingMute({ userId, entityType, entityId, surface = null }) {
  let query = supabaseAdmin
    .from('PostMute')
    .select('id')
    .eq('user_id', userId)
    .eq('muted_entity_type', entityType)
    .eq('muted_entity_id', entityId);

  query = surface == null ? query.is('surface', null) : query.eq('surface', surface);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function ensurePostMute({ userId, entityType, entityId, surface = null }) {
  const existing = await findExistingMute({ userId, entityType, entityId, surface });
  if (existing) return existing;

  const muteRow = {
    user_id: userId,
    muted_entity_type: entityType,
    muted_entity_id: entityId,
    surface,
  };

  const { data, error } = await supabaseAdmin
    .from('PostMute')
    .insert(muteRow);

  if (error && !isUniqueConstraintError(error)) {
    throw error;
  }

  if (error) {
    return findExistingMute({ userId, entityType, entityId, surface });
  }

  return Array.isArray(data) ? data[0] : data;
}

async function attachFilesToComments(comments) {
  if (!Array.isArray(comments) || comments.length === 0) return [];

  const commentIds = comments.map((comment) => comment.id).filter(Boolean);
  if (commentIds.length === 0) return comments;

  const { data: files, error } = await supabaseAdmin
    .from('File')
    .select('id, comment_id, file_url, original_filename, mime_type, file_size, file_type, created_at')
    .in('comment_id', commentIds)
    .eq('is_deleted', false);

  if (error) {
    logger.warn('Comment attachment fetch error', { error: error.message, commentIds });
    return comments.map((comment) => ({ ...comment, attachments: [] }));
  }

  const attachmentsByCommentId = new Map();
  for (const file of files || []) {
    const key = file.comment_id;
    if (!key) continue;
    if (!attachmentsByCommentId.has(key)) attachmentsByCommentId.set(key, []);
    attachmentsByCommentId.get(key).push({
      id: file.id,
      comment_id: file.comment_id,
      file_url: file.file_url,
      original_filename: file.original_filename,
      mime_type: file.mime_type,
      file_size: file.file_size,
      file_type: file.file_type,
      created_at: file.created_at,
    });
  }

  return comments.map((comment) => ({
    ...comment,
    attachments: attachmentsByCommentId.get(comment.id) || [],
  }));
}

function serializeCommentForViewer(comment) {
  if (!comment) return null;
  const { author: rawAuthor, ...safe } = comment;
  return {
    ...safe,
    author: serializeUserAsLocalIdentity(rawAuthor),
  };
}

function serializeLikeForViewer(like) {
  if (!like) return null;
  const { user: rawUser, ...safe } = like;
  const identity = serializeUserIdentityForViewer(rawUser);
  return {
    ...safe,
    user: identity,
    identity,
  };
}

async function serializePostForViewer(post, viewerUserId) {
  if (!post) return null;
  const [serialized] = await attachIdentityAuthors([post], viewerUserId);
  return serialized || post;
}

async function serializePostsForViewer(posts, viewerUserId) {
  return attachIdentityAuthors(posts || [], viewerUserId);
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

async function hasExternalShare(postId) {
  const { data: share } = await supabaseAdmin
    .from('PostShare')
    .select('id')
    .eq('post_id', postId)
    .eq('share_type', 'external')
    .maybeSingle();
  return !!share;
}

const canViewPost = async (post, userId) => {
  if (post.user_id === userId) return true;

  if (
    userId
    && post.identity_context_type === 'persona'
    && post.identity_context_id
    && await isFanBlockedFromPersona(post.identity_context_id, userId)
  ) {
    return false;
  }

  if (!userId) {
    // Direct-link views from outside the app should only work for posts that
    // are already public, or that a user explicitly shared externally.
    if (post.visibility === 'public' || post.audience === 'public') return true;
    return hasExternalShare(post.id);
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
          const { haversineMeters } = require('../utils/trustState');
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
};

const POST_VISIBILITY_SELECT = [
  'id',
  'user_id',
  'identity_context_type',
  'identity_context_id',
  'target_tier_rank',
  'visibility',
  'audience',
  'origin',
  'latitude',
  'longitude',
  'location_name',
  'distribution_targets',
].join(', ');

const POST_REFS_SELECT = `${POST_VISIBILITY_SELECT},ref_task_id,ref_listing_id`;

/** Web notification `link` + metadata extras for gig/listing-backed posts (canonical public URLs). */
function postEngagementNotificationLink(post, postId) {
  if (post?.ref_task_id) {
    return {
      link: `/gigs/${post.ref_task_id}`,
      extraMeta: { ref_task_id: post.ref_task_id, gig_id: post.ref_task_id },
    };
  }
  if (post?.ref_listing_id) {
    return {
      link: `/listing/${post.ref_listing_id}`,
      extraMeta: { ref_listing_id: post.ref_listing_id, listing_id: post.ref_listing_id },
    };
  }
  return { link: `/posts/${postId}`, extraMeta: {} };
}

async function requireVisiblePost({ postId, userId, res, select = POST_VISIBILITY_SELECT }) {
  const { data: post, error } = await supabaseAdmin
    .from('Post')
    .select(select)
    .eq('id', postId)
    .single();

  if (error || !post) {
    res.status(404).json({ error: 'Post not found' });
    return null;
  }

  const hasAccess = await canViewPost(post, userId);
  if (!hasAccess) {
    res.status(403).json({ error: 'You do not have access to this post' });
    return null;
  }

  return post;
}

async function getUserDisplayName(userId) {
  const { data } = await supabaseAdmin
    .from('User')
    .select('username, name, first_name')
    .eq('id', userId)
    .single();
  if (!data) return 'Someone';
  return data.name || data.first_name || data.username || 'Someone';
}

// ============ POST ROUTES ============

/**
 * POST /api/posts/precheck
 * Soft AI pre-check before submitting a post.
 * Returns suggestions — never blocks the post outright.
 */
router.post('/precheck', verifyToken, async (req, res) => {
  try {
    const { content, postType, purpose, surface, latitude, longitude } = req.body;
    const userId = req.user.id;

    const suggestions = [];
    const flags = [];

    // 1. Check if user has an active cooldown on this surface
    const { data: cooldown } = await supabaseAdmin
      .from('UserPostingCooldown')
      .select('restriction_level, expires_at, reason')
      .eq('user_id', userId)
      .eq('surface', normalizeSurface(surface))
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cooldown) {
      flags.push({
        type: 'cooldown',
        level: cooldown.restriction_level,
        message: `You have a posting restriction: ${cooldown.reason || 'please keep posts helpful'}`,
        expiresAt: cooldown.expires_at,
      });
    }

    // 2. Content pattern heuristics (no external AI needed for MVP)
    const lowerContent = (content || '').toLowerCase();

    // Rant/complaint detection
    const rantWords = ['ridiculous', 'unacceptable', 'terrible', 'furious', 'disgusting',
      'sick of', 'tired of', 'always do this', 'worst neighbor', 'called the cops'];
    const rantMatches = rantWords.filter(w => lowerContent.includes(w));
    if (rantMatches.length >= 2 && surface === 'place') {
      suggestions.push({
        type: 'tone_check',
        message: 'This reads a bit heated. Nearby posts work best when they\'re helpful or constructive. Consider rephrasing or sharing to Connections instead.',
        suggestedAction: 'rephrase_or_move_surface',
      });
    }

    // Callout/name-shame detection
    const calloutPatterns = [/my neighbor at \d+/i, /the person at/i, /[A-Z][a-z]+ on [A-Z][a-z]+ St/];
    if (calloutPatterns.some(p => p.test(content || '')) && surface === 'place') {
      flags.push({
        type: 'callout_risk',
        message: 'Avoid naming or identifying specific neighbors. Pantopus is not a call-out platform.',
        suggestedAction: 'remove_names',
      });
    }

    // Politics detection in Nearby
    const politicsWords = ['democrat', 'republican', 'biden', 'trump', 'maga', 'liberal', 'conservative',
      'vote for', 'political party'];
    if (surface === 'place' && politicsWords.some(w => lowerContent.includes(w))) {
      suggestions.push({
        type: 'politics_in_nearby',
        message: 'Political content in the Nearby feed is shown only to neighbors who opt in. Consider posting to Connections/Following instead for broader reach.',
        suggestedAction: 'move_to_connections',
      });
    }

    // Purpose/intent mismatch suggestions
    if (postType === 'ask_local' && !content?.includes('?') && (content || '').length > 200) {
      suggestions.push({
        type: 'intent_mismatch',
        message: 'This is tagged as a question but reads like a statement. Try ending with a question or change the intent to "Story" or "Heads-up".',
      });
    }

    // 3. Visitor post awareness
    let isVisitor = false;
    if (latitude && longitude) {
      const { data: userHome } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('home:home_id(location)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (userHome?.home?.location) {
        const homeLat = userHome.home.location.coordinates
          ? userHome.home.location.coordinates[1] : null;
        const homeLon = userHome.home.location.coordinates
          ? userHome.home.location.coordinates[0] : null;
        if (homeLat != null && homeLon != null) {
          const latDiff = Math.abs(parseFloat(latitude) - homeLat);
          const lonDiff = Math.abs(parseFloat(longitude) - homeLon);
          isVisitor = latDiff > 0.5 || lonDiff > 0.5; // ~35 miles
        }
      }
    }

    if (isVisitor && surface === 'place') {
      suggestions.push({
        type: 'visitor_context',
        message: 'You\'re posting to a place you\'re visiting. Your post will show a visitor badge. Ask and Recommend intents work best for visitors.',
        suggestedIntents: ['ask', 'recommend'],
      });
    }

    return res.json({
      ok: true,
      canPost: !cooldown || !['cooldown_1h', 'cooldown_24h'].includes(cooldown.restriction_level),
      cooldown: cooldown || null,
      flags,
      suggestions,
      isVisitor,
    });
  } catch (err) {
    logger.error('Post precheck error', { error: err.message });
    // Always fail open — never block posting due to precheck errors
    res.json({ ok: true, canPost: true, flags: [], suggestions: [], isVisitor: false });
  }
});

function parsePostGISPoint(point) {
  if (!point) return null;
  if (typeof point === 'object' && point.latitude != null && point.longitude != null) {
    return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
  }
  if (typeof point === 'object' && point.type === 'Point' && Array.isArray(point.coordinates)) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  if (typeof point === 'string') {
    const wktMatch = point.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (wktMatch) return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }
  // WKB hex (Supabase returns geography columns in this format)
  const str = String(point);
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
      if (geomType !== 1) return null;
      const coordOffset = hasSRID ? 9 : 5;
      const lng = le ? buf.readDoubleLE(coordOffset) : buf.readDoubleBE(coordOffset);
      const lat = le ? buf.readDoubleLE(coordOffset + 8) : buf.readDoubleBE(coordOffset + 8);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return { longitude: lng, latitude: lat };
    } catch (_) { return null; }
  }
  return null;
}

function resolveHomeCoordinates(home) {
  if (!home) return { latitude: null, longitude: null };
  const parsed = parsePostGISPoint(home.location);
  if (parsed) return { latitude: parsed.latitude, longitude: parsed.longitude };
  return { latitude: null, longitude: null };
}

router.post('/', verifyToken, validate(createPostSchema), async (req, res) => {
  try {
    const {
      content, title, mediaUrls, mediaTypes, mediaThumbnails, mediaLiveUrls, postType, postFormat,
      visibility, visibilityScope, locationPrecision,
      homeId, latitude, longitude, locationName, locationAddress,
      tags, eventDate, eventEndDate, eventVenue,
      safetyAlertKind, safetyHappenedEnd,
      // Accept both canonical and frontend-alias field names
      safetyBehaviorDescription: _safetyBehaviorDesc, behaviorDescription: _behaviorDesc,
      dealBusinessName: _dealBusinessName, businessName: _businessName,
      lostFoundContactPref: _lostFoundContactPref, contactPref: _contactPref, contactPhone,
      dealExpiresAt,
      lostFoundType,
      serviceCategory, refListingId, refTaskId, radiusMiles,
      postAs: rawPostAs, audience, identityContextId, targetPlaceId, businessId, isStory,
      distributionTargets, crossPostToConnections, gpsTimestamp, gpsLatitude, gpsLongitude,
      purpose, profileVisibilityScope, showOnProfile,
      geocodeProvider, geocodeAccuracy, geocodePlaceId,
      topic, sportsScope, postMetadata,
    } = req.body;
    // P2.4 / unified-IA §4.1 — defense-in-depth. Persona-context posts
    // must go through the audience-zone composer (P2.5) and the
    // /api/personas/:id/posts (or broadcast) routes, not /api/posts.
    // Even if a malicious or stale client sends postAs='persona' here,
    // refuse with a clear error so the route can never accidentally
    // create cross-zone Post rows. UI enforcement lives in PostComposer.tsx.
    //
    // Beacon/broadcast publishing now has its own route that writes
    // persona-context Post rows with the proper distribution and tier fields.
    if (rawPostAs === 'persona') {
      return res.status(400).json({
        error: 'Persona-context posts must use /api/personas/:id/posts',
        code: 'wrong_post_route',
      });
    }
    // Infer postAs from homeId/businessId when client sends 'personal' (backwards compat)
    const postAs = (rawPostAs === 'personal' && homeId) ? 'home'
      : (rawPostAs === 'personal' && businessId) ? 'business'
      : rawPostAs;
    // Normalize aliased fields: canonical name takes precedence
    const safetyBehaviorDescription = _safetyBehaviorDesc || _behaviorDesc;
    const dealBusinessName = _dealBusinessName || _businessName;
    const _resolvedContactPref = _lostFoundContactPref || _contactPref;
    const lostFoundContactPref = _resolvedContactPref === 'phone' && contactPhone
      ? `phone|${contactPhone}` : _resolvedContactPref;
    // Auto-fill safetyHappenedAt if not provided for alert posts
    const safetyHappenedAt = req.body.safetyHappenedAt || (postType === 'alert' ? new Date().toISOString() : null);
	    const userId = req.user.id;
	    let requestedAudience = audience || (postAs === 'persona' ? 'followers' : 'nearby');
	    if (postAs === 'business' && (requestedAudience === 'followers' || visibility === 'followers')) {
	      return res.status(400).json({
	        error: 'Business posts can no longer target followers. Use Target Area or Public instead.',
	        code: 'business_followers_audience_removed',
	      });
	    }
	    if (postAs !== 'persona' && requestedAudience === 'followers') {
	      requestedAudience = 'connections';
	    }
    const requestedVisibility = postAs !== 'persona' && visibility === 'followers'
      ? 'connections'
      : visibility;
    if (postAs === 'persona' && !isPersonaEnabled()) {
      return res.status(404).json({ error: 'Beacons are not enabled.' });
    }
    // Curator accounts are platform-owned content seeders — they post with
    // explicit lat/lng and skip home/trust/place-eligibility checks.
    const isCurator = req.user.accountType === 'curator';

    // Origin is server-derived from the caller's account type. It is the
    // durable "is this a seeded post?" marker. Never trusted from the body.
    const origin =
      req.user.accountType === 'curator' ? 'curator' :
      req.user.accountType === 'system'  ? 'system'  :
      'user';

    // 'national' audience is a curator-only distribution (Sports lane Phase 1).
    // Reject early before any expensive validation so misuse returns a clear 403.
    if (requestedAudience === 'national' && !isCurator) {
      return res.status(403).json({ error: 'National audience is restricted to curator accounts.' });
    }
    const requestedDistributionTargets = Array.isArray(distributionTargets) ? distributionTargets : [];
    const hasCountryDistributionTarget = requestedDistributionTargets.some((target) => (
      typeof target === 'string' && target.startsWith('country:')
    ));
    if (hasCountryDistributionTarget && !isCurator) {
      return res.status(403).json({ error: 'Country-wide distribution is restricted to curator accounts.' });
    }
    if (hasCountryDistributionTarget && requestedAudience !== 'national') {
      return res.status(400).json({ error: 'Country-wide distribution requires national audience.' });
    }

    let homeContext = null;

    // ── Post As validation ──
    if (homeId && postAs !== 'persona') {
      const { data: home, error: homeErr } = await supabaseAdmin
        .from('Home')
        .select('id, owner_id, name, address, city, state, location')
        .eq('id', homeId)
        .maybeSingle();
      if (!home) {
        logger.warn('Home not found for post creation', { homeId, userId, dbError: homeErr?.message || null });
        return res.status(404).json({ error: 'Home not found' });
      }
      const occ = await getActiveOccupancy(homeId, userId);
      const postAccess = await checkHomePermission(homeId, userId, 'home.view');
      if (!postAccess.hasAccess) {
        return res.status(403).json({ error: 'You do not have access to post from this home' });
      }

      const roleBase = occ?.role_base || mapLegacyRole(occ?.role) || (postAccess.isOwner ? 'owner' : null);
      homeContext = {
        home,
        roleBase,
        isOwner: postAccess.isOwner,
      };

      if (postAs === 'home' && requestedAudience === 'neighborhood' && !['owner', 'admin'].includes(roleBase)) {
          return res.status(403).json({ error: 'Only Home Owners and Admins can publish neighborhood posts as this Home.' });
      }
    }

    if (postAs === 'business' && businessId) {
      // Verify user has at least editor role on this business
      const { getSeatForUser } = require('../utils/seatPermissions');
      const seat = await getSeatForUser(businessId, userId);
      const seatRole = seat?.role_base;
      let hasEditorAccess = seatRole && ['owner', 'admin', 'editor'].includes(seatRole);

      if (!hasEditorAccess) {
        // Fallback to legacy BusinessTeam
        const { data: team } = await supabaseAdmin
          .from('BusinessTeam')
          .select('id, role_base')
          .eq('business_user_id', businessId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();
        if (team && ['owner', 'admin', 'editor'].includes(team.role_base)) {
          hasEditorAccess = true;
        }
      }

      if (!hasEditorAccess) {
        return res.status(403).json({ error: 'You need at least editor role to post as this business' });
      }
      // v1.1: Business rate limiting — 1 per 24h to Place (tightened from 3)
      if (['nearby', 'target_area'].includes(requestedAudience) ||
          (distributionTargets && distributionTargets.includes('place'))) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from('Post')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .contains('distribution_targets', ['place'])
          .gte('created_at', oneDayAgo);
        if (count >= 1) {
          return res.status(429).json({ error: 'Business posting limit reached (1 post per 24h to Place feed). Try again later.' });
        }
      }
    }

    let personaContext = null;
    if (postAs === 'persona') {
      const policy = canPostWithIdentityToAudience({
        identityType: 'persona',
        audience: requestedAudience,
      });
      if (!policy.allowed) {
        return res.status(403).json({ error: policy.reason, code: policy.code });
      }

      if (!identityContextId) {
        return res.status(400).json({ error: 'identityContextId is required when posting as a Beacon.' });
      }

      personaContext = await getPersonaById(identityContextId);
      if (!personaContext || personaContext.user_id !== userId || personaContext.status !== 'active') {
        return res.status(403).json({ error: 'You cannot post as this Beacon.' });
      }
    }

    let effectiveLatitude = latitude;
    let effectiveLongitude = longitude;
    let effectiveLocationName = locationName;
    let effectiveLocationAddress = locationAddress;

    if (postAs === 'home' && homeContext) {
      const coords = resolveHomeCoordinates(homeContext.home);
      if (effectiveLatitude == null) effectiveLatitude = coords.latitude;
      if (effectiveLongitude == null) effectiveLongitude = coords.longitude;
      if (!effectiveLocationName) {
        effectiveLocationName = homeContext.home.name || homeContext.home.city || homeContext.home.address || 'Home';
      }
      if (!effectiveLocationAddress) {
        effectiveLocationAddress = [homeContext.home.address, homeContext.home.city, homeContext.home.state]
          .filter(Boolean)
          .join(', ') || null;
      }
    }

    const isHomeIdentityPost = postAs === 'home' && !!homeContext;

    // ── Audience guardrails ──
    // Curator accounts bypass trust-state checks — they are platform-owned, not a real neighbor
    if (!isCurator && postAs !== 'persona') {
      if (effectiveLatitude != null && effectiveLongitude != null) {
        const trustState = isHomeIdentityPost
          ? { level: 'verified_resident', roleBase: homeContext.roleBase }
          : await computeTrustState(userId, effectiveLatitude, effectiveLongitude);
        const roleBase = trustState.roleBase || homeContext?.roleBase || null;
        const check = canPostToAudience({
          postAs: postAs || 'personal',
          audience: requestedAudience,
          postType: postType || 'general',
          trustLevel: trustState.level,
          homeId,
          roleBase,
        });
        if (!check.allowed) {
          return res.status(403).json({ error: check.reason });
        }
      } else {
        // No location — still enforce General ban from Nearby
        const localAudiences = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
        if (localAudiences.includes(requestedAudience) && postType === 'general') {
          return res.status(400).json({ error: 'General posts cannot be shared to local/public audiences. Please choose a specific category.' });
        }
      }
    }

    // ── v1.1: Place posting eligibility gate ──
    const placeAudiences = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
    const isPlacePost = postAs !== 'persona' && (
      placeAudiences.includes(requestedAudience) ||
      (distributionTargets && distributionTargets.includes('place'))
    );

    if (isPlacePost && (effectiveLatitude == null || effectiveLongitude == null)) {
      return res.status(400).json({ error: 'Place posts require a target location or a verified home address.' });
    }

    // Curator accounts bypass place eligibility — platform-owned, not a real neighbor
    if (!isCurator && isPlacePost && effectiveLatitude != null && effectiveLongitude != null) {
      const trustState = isHomeIdentityPost
        ? { level: 'verified_resident' }
        : await computeTrustState(userId, effectiveLatitude, effectiveLongitude);
      const eligibility = canPostToPlace({
        trustLevel: trustState.level,
        gpsTimestamp: gpsTimestamp || null,
        gpsLatitude: gpsLatitude ?? null,
        gpsLongitude: gpsLongitude ?? null,
        targetLatitude: effectiveLatitude,
        targetLongitude: effectiveLongitude,
      });
      if (!eligibility.eligible) {
        return res.status(403).json({ error: eligibility.reason });
      }
    }

    // ── v1.1: Post type enforcement for Place surface ──
    // Curator accounts bypass Place type restrictions — platform-owned, not a real neighbor
    if (isPlacePost && !isCurator) {
      if (!PLACE_POST_TYPES.includes(postType)) {
        return res.status(400).json({
          error: `Post type "${postType}" is not allowed on the Place feed. Allowed types: ${PLACE_POST_TYPES.join(', ')}`,
        });
      }

      // Deal requires deal_expires_at
      if (postType === 'deal' && !dealExpiresAt) {
        return res.status(400).json({ error: 'Deals must include an expiration date.' });
      }

      // Alert requires safety_alert_kind
      if (postType === 'alert' && !safetyAlertKind) {
        return res.status(400).json({ error: 'Alerts must specify an alert type (e.g., road_hazard, power_outage).' });
      }

      // Business Place type enforcement
      if (postAs === 'business' && !BUSINESS_PLACE_TYPES.includes(postType)) {
        return res.status(400).json({
          error: `Businesses can only post Events, Deals, and Local Updates to the Place feed.`,
        });
      }

      // Home Place type enforcement
      if (postAs === 'home' && !HOME_PLACE_TYPES.includes(postType)) {
        return res.status(400).json({
          error: `Home posts to the Place feed are limited to: Ask Local, Recommendations, Events, Lost & Found, Alerts, Deals, Local Updates, Neighborhood Wins, and Visitor Guides.`,
        });
      }

      // v1.1: Home Place rate limit — 2 per day per home
      if (postAs === 'home' && homeId) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from('Post')
          .select('id', { count: 'exact', head: true })
          .eq('home_id', homeId)
          .contains('distribution_targets', ['place'])
          .gte('created_at', oneDayAgo);
        if (count >= 2) {
          return res.status(429).json({ error: 'Home posting limit reached (2 posts per day to Place feed). Try again later.' });
        }
      }
    }

    // v1.1: Force approx_area precision for Home Place posts
    const effectiveLocationPrecision =
      (isPlacePost && postAs === 'home') ? 'approx_area' : (locationPrecision || 'approx_area');

    const localProfile = postAs === 'personal' ? await ensureLocalProfile(userId) : null;
    const identityContextType = postAs === 'persona' ? 'persona'
      : postAs === 'home' ? 'home'
      : postAs === 'business' ? 'business'
      : 'local';
    const resolvedIdentityContextId = postAs === 'persona' ? personaContext.id
      : postAs === 'home' ? (homeId || null)
      : postAs === 'business' ? (businessId || null)
      : (localProfile?.id || null);

    const postData = {
      user_id: userId,
      author_user_id: userId,
      identity_context_type: identityContextType,
      identity_context_id: resolvedIdentityContextId,
      home_id: homeId || null,
      title: title || null,
      content,
      media_urls: mediaUrls || [],
      media_types: mediaTypes || [],
      media_thumbnails: mediaThumbnails || [],
      media_live_urls: mediaLiveUrls || [],
      post_type: postType || 'general',
      post_format: postFormat || 'standard',
      visibility: postAs === 'persona'
        ? (requestedAudience === 'public' ? 'public' : 'followers')
        : (requestedVisibility || 'neighborhood'),
      visibility_scope: visibilityScope || 'neighborhood',
      location_precision: effectiveLocationPrecision,
      latitude: effectiveLatitude ?? null,
      longitude: effectiveLongitude ?? null,
      location_name: effectiveLocationName || null,
      location_address: effectiveLocationAddress || null,
      tags: tags || [],
      // New fields
      post_as: postAs || 'personal',
      audience: requestedAudience,
      target_place_id: targetPlaceId || null,
      business_id: businessId || null,
      business_author_id: (postAs === 'business' && businessId) ? businessId : null,
      is_story: isStory || false,
      story_expires_at: isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      // Event fields
      event_date: eventDate || null,
      event_end_date: eventEndDate || null,
      event_venue: eventVenue || null,
      // Safety Alert fields
      safety_alert_kind: toDbSafetyKind(safetyAlertKind),
      safety_happened_at: safetyHappenedAt || null,
      safety_happened_end: safetyHappenedEnd || null,
      safety_behavior_description: safetyBehaviorDescription || null,
      // Deal fields
      deal_expires_at: dealExpiresAt || null,
      deal_business_name: dealBusinessName || null,
      // Lost & Found
      lost_found_type: lostFoundType || null,
      lost_found_contact_pref: lostFoundContactPref || null,
      // Services
      service_category: serviceCategory || null,
      // Cross-surface
      ref_listing_id: refListingId || null,
      ref_task_id: refTaskId || null,
      // Radius
      radius_miles: radiusMiles || null,
      // v1.1: GPS timestamp for Place eligibility
      gps_timestamp: gpsTimestamp || null,
      // v1.2: Social layer fields
      purpose: purpose || derivePurposeFromPostType(postType),
      profile_visibility_scope: profileVisibilityScope || 'public',
      show_on_profile: showOnProfile !== false,
      is_visitor_post: false,
      // All posts start as 'open'; only Ask posts can be transitioned to 'solved'.
      // DB CHECK constraint requires state IN ('open', 'solved') — null is not allowed.
      state: 'open',
      // Sports topic lane (Phase 1)
      topic: topic || null,
      sports_scope: sportsScope || null,
      post_metadata: postMetadata || {},
      origin,
    };

    // v1.1: Compute distribution_targets from audience + cross-post toggles
    if (distributionTargets && distributionTargets.length > 0) {
      // Explicit distribution_targets from client takes precedence
      postData.distribution_targets = distributionTargets;
    } else {
      // Auto-compute from audience
      const targets = [];
      const placeAudiences = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
      if (postAs === 'persona') {
        if (requestedAudience === 'followers') targets.push('persona_followers');
        if (requestedAudience === 'public') targets.push('public');
      } else {
	        if (placeAudiences.includes(requestedAudience)) targets.push('place');
	        if (requestedAudience === 'connections') targets.push('connections');
	        if (requestedAudience === 'network') targets.push('connections');
	      }
      // National audience is country-scoped so the model stays correct when
      // Pantopus adds more countries. Do NOT use a bare 'national' marker.
      if (requestedAudience === 'national') targets.push('country:US');

      // Cross-post toggle (only when primary is place)
      if (targets.includes('place')) {
        if (crossPostToConnections && !targets.includes('connections')) targets.push('connections');
      }

      postData.distribution_targets = targets;
    }

    // Safety net: if a client/seeder supplies audience='national' with an
    // explicit distributionTargets that omits the country scope, stamp it.
    if (requestedAudience === 'national'
        && Array.isArray(postData.distribution_targets)
        && !postData.distribution_targets.includes('country:US')) {
      postData.distribution_targets = Array.from(new Set([
        ...postData.distribution_targets,
        'country:US',
      ]));
    }

    // v1.2: Auto-detect visitor post (user's home is far from posting location)
    // Curator accounts have no home — skip visitor detection (platform-owned, not a real neighbor)
    if (!isCurator && postAs !== 'persona' && (targetPlaceId || (effectiveLatitude != null && effectiveLongitude != null))) {
      try {
        const { data: userHome } = await supabaseAdmin
          .from('HomeOccupancy')
          .select('home:home_id(location, city)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        if (userHome?.home?.location && effectiveLatitude != null && effectiveLongitude != null) {
          const homeLat = userHome.home.location.coordinates
            ? userHome.home.location.coordinates[1] : null;
          const homeLon = userHome.home.location.coordinates
            ? userHome.home.location.coordinates[0] : null;
          if (homeLat != null && homeLon != null) {
            const latDiff = Math.abs(parseFloat(effectiveLatitude) - homeLat);
            const lonDiff = Math.abs(parseFloat(effectiveLongitude) - homeLon);
            postData.is_visitor_post = latDiff > 0.5 || lonDiff > 0.5; // ~35 miles
          }
        }
      } catch (visitorErr) {
        logger.warn('Visitor detection failed', { error: visitorErr.message, userId });
        // Non-blocking — default to false
      }
    }

    // Geocode provenance (when coordinates are provided)
    if (effectiveLatitude != null && effectiveLongitude != null) {
      postData.geocode_provider = geocodeProvider || 'mapbox';
      postData.geocode_mode = 'temporary';
      postData.geocode_accuracy = geocodeAccuracy || null;
      postData.geocode_place_id = geocodePlaceId || null;
      postData.geocode_source_flow = 'post_create';
      postData.geocode_created_at = new Date().toISOString();
    }

    // Denormalize effective location for spatial feed queries
    if (effectiveLatitude != null && effectiveLongitude != null) {
      postData.effective_latitude = parseFloat(effectiveLatitude);
      postData.effective_longitude = parseFloat(effectiveLongitude);
    } else if (homeId && postAs !== 'persona') {
      try {
        const { data: home } = await supabaseAdmin
          .from('Home')
          .select('location')
          .eq('id', homeId)
          .maybeSingle();
        const coords = resolveHomeCoordinates(home);
        if (coords.latitude != null && coords.longitude != null) {
          postData.effective_latitude = coords.latitude;
          postData.effective_longitude = coords.longitude;
        }
      } catch (locErr) {
        logger.warn('Failed to resolve home location for effective coords', { error: locErr.message, homeId });
      }
    }

    if (postAs === 'persona') {
      // An explicitly picked venue (geocodePlaceId present) is intentional
      // public disclosure, like an Instagram place tag — keep it. But
      // auto-attached GPS/home context is ALWAYS stripped so a Beacon post
      // can never leak the author's home or live GPS fix.
      const hasExplicitPlaceTag = !!(geocodePlaceId && effectiveLocationName
        && effectiveLatitude != null && effectiveLongitude != null);
      // Identity-linking fields are ALWAYS stripped for Beacon posts.
      Object.assign(postData, {
        home_id: null,
        target_place_id: null,
        radius_miles: null,
        gps_timestamp: null,
        gps_latitude: null,
        gps_longitude: null,
      });
      if (!hasExplicitPlaceTag) {
        Object.assign(postData, {
          latitude: null,
          longitude: null,
          effective_latitude: null,
          effective_longitude: null,
          location_name: null,
          location_address: null,
          geocode_provider: null,
          geocode_mode: null,
          geocode_accuracy: null,
          geocode_place_id: null,
          geocode_source_flow: null,
          geocode_created_at: null,
        });
      }
    }

    // Compute initial utility_score so the post ranks properly before the background job runs
    postData.utility_score = computeUtilityScore(postData);

    const { data: post, error } = await supabaseAdmin
      .from('Post')
      .insert(postData)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT}), business_author:business_author_id (${SAFE_CREATOR_SELECT}), home:home_id (id, address, city)`)
      .single();

    if (error) {
      logger.error('Error creating post', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to create post' });
    }

    logger.info('Post created', {
      postId: post.id,
      userId,
      postType,
      postAs,
      audience: requestedAudience,
      hasLocation: effectiveLatitude != null && effectiveLongitude != null,
    });

    // Fire-and-forget: queue organic business matching if post has a service category + location
    if (serviceCategory && effectiveLatitude != null && effectiveLongitude != null) {
      setImmediate(() => {
        matchBusinessesForPost(post.id).catch((err) => {
          logger.warn('[organicMatch] Inline match failed (will retry via cron)', { postId: post.id, error: err.message });
        });
      });
    }

    runPostCreatedHooks({
      post,
      userId,
      personaContext,
      targets: postData.distribution_targets || [],
    });

    const responsePost = await serializePostForViewer({
      ...post,
      media_urls: normalizeMediaUrls(post.media_urls),
      media_thumbnails: normalizeAlignedMediaUrls(post.media_thumbnails),
      media_live_urls: normalizeAlignedMediaUrls(post.media_live_urls),
    }, userId);

    res.status(201).json({
      message: 'Post created successfully',
      post: responsePost,
    });
  } catch (err) {
    logger.error('Post creation error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ============ v1.1 CURSOR-BASED SURFACE FEED ============


/**
 * GET /api/posts/feed — v1.1 Surface-aware feed with cursor pagination
 *
 * Query params:
 *   - surface                — 'place' | 'connections' | 'personas'
 *   - cursorCreatedAt, cursorId — cursor for keyset pagination
 *   - limit                  — items per page (default 20)
 *   - postType               — filter by post type
 *   - latitude, longitude    — for Place surface (viewing location)
 *   - radiusMiles            — proximity radius (default 10)
 *   - tags                   — comma-separated tag filter
 *
 * Returns: { posts, pagination: { nextCursor: { createdAt, id } | null, hasMore } }
 */
router.get('/feed', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      surface,
      limit = 20,
      cursorCreatedAt,
      cursorId,
      cursorRankBucket,
      postType,
      latitude,
      longitude,
      radiusMiles,
      tags,
      topic,
      sportsMode,
      eventKey,
    } = req.query;

    if (!surface || !FEED_SURFACES.includes(surface)) {
      return res.status(400).json({
        error: 'Missing or invalid surface parameter',
        validSurfaces: FEED_SURFACES,
      });
    }
    if (surface === 'personas' && !isPersonaEnabled()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Validate topic / sportsMode when present — prevents unknown values
    // from silently falling through to generic branches.
    if (topic && !TOPIC_VALUES.includes(topic)) {
      return res.status(400).json({ error: `Invalid topic: ${topic}` });
    }
    if (topic && surface !== 'place') {
      return res.status(400).json({ error: 'Topic lanes are only supported on the Place surface.' });
    }
    const SPORTS_MODES = ['for_you', 'local', 'event', 'watch'];
    if (sportsMode && !SPORTS_MODES.includes(sportsMode)) {
      return res.status(400).json({ error: `Invalid sportsMode: ${sportsMode}` });
    }

    const radiusMeters = radiusMiles ? Math.round(parseFloat(radiusMiles) * 1609.34) : 160934;

    // Place requires location
    if (surface === 'place') {
      const hasLocation = latitude != null && longitude != null
        && Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude));
      if (!hasLocation) {
        return res.json({
          posts: [],
          pagination: { nextCursor: null, hasMore: false },
          requiresViewingLocation: true,
          message: 'Set an area to see local posts.',
        });
      }
    }

    const result = await feedService.getListFeed({
      userId,
      surface,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radiusMeters,
      postType: postType || null,
      cursorCreatedAt: cursorCreatedAt || null,
      cursorId: cursorId || null,
      cursorRankBucket: cursorRankBucket != null ? Number(cursorRankBucket) : null,
      limit: Math.min(parseInt(limit) || 20, 50),
      tags: tags || null,
      topic: topic || null,
      sportsMode: sportsMode || null,
      eventKey: eventKey || null,
    });

    // Cold-start seeding: inject neighborhood facts when real posts are sparse
    // Only on first page of the place surface, when fewer than 5 real posts
    const realPostCount = result.posts.length;
    const isColdStart = surface === 'place' && !topic && !cursorCreatedAt && !cursorId && !postType && latitude && longitude;

    if (isColdStart && realPostCount < 5) {
      try {
        const geohash = _encodeGeohash6(parseFloat(latitude), parseFloat(longitude));
        const facts = await generateNeighborhoodFacts(geohash);

        // Load user's dismissed fact IDs
        let dismissedIds = new Set();
        try {
          const { data: userData } = await supabaseAdmin
            .from('User')
            .select('dismissed_seeded_facts')
            .eq('id', userId)
            .maybeSingle();
          if (Array.isArray(userData?.dismissed_seeded_facts)) {
            dismissedIds = new Set(userData.dismissed_seeded_facts);
          }
        } catch { /* ignore — show all facts if lookup fails */ }

        // Filter out dismissed facts
        const eligibleFacts = facts.filter((f) => !dismissedIds.has(f.id));

        // Build beginning-of-month timestamp so seeded items sort below real posts
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const SYSTEM_AUTHOR = {
          id: null,
          name: 'Pantopus',
          username: 'pantopus',
          first_name: 'Pantopus',
          last_name: null,
          profile_picture_url: null,
        };

        // Take at most 3 seeded facts
        const maxSeeded = 3;
        const seededItems = eligibleFacts.slice(0, maxSeeded).map((fact) => _buildSeededItem(fact, monthStart, SYSTEM_AUTHOR));

        // Interleave: real posts first, then insert 1 seeded per 2-3 real posts
        const realPosts = result.posts;
        const merged = [];
        let seededIdx = 0;
        for (let i = 0; i < realPosts.length; i++) {
          merged.push(realPosts[i]);
          // After every 2 real posts, inject a seeded fact
          if ((i + 1) % 2 === 0 && seededIdx < seededItems.length) {
            merged.push(seededItems[seededIdx++]);
          }
        }
        // Append remaining seeded items after all real posts
        while (seededIdx < seededItems.length) {
          merged.push(seededItems[seededIdx++]);
        }

        result.posts = merged;
      } catch (seedErr) {
        logger.warn('Cold-start seeding failed, returning real posts only', { error: seedErr.message });
      }
    }

    // Transition celebration card: when a neighborhood just crossed from cold-start
    // (< 5 posts) to active (5+ posts), inject a one-time congratulatory card
    if (isColdStart && realPostCount >= 5 && realPostCount <= 8) {
      try {
        const geohash = _encodeGeohash6(parseFloat(latitude), parseFloat(longitude));
        const transitionId = `transition_${geohash}`;

        // Load user's dismissed list (reuse from cold-start path if available)
        const { data: userData } = await supabaseAdmin
          .from('User')
          .select('dismissed_seeded_facts')
          .eq('id', userId)
          .maybeSingle();

        const dismissed = userData?.dismissed_seeded_facts || [];
        if (!dismissed.includes(transitionId)) {
          const now = new Date();
          const transitionCard = _buildSeededItem(
            {
              id: transitionId,
              type: 'transition',
              title: 'Your Neighborhood Is Coming Alive!',
              body: `${realPostCount} neighbors have posted recently. Real conversations are happening \u2014 join in!`,
              source: 'Community',
              post_type: 'neighborhood_win',
              cta: 'Say hello to your neighbors',
            },
            now.toISOString(),
            {
              id: null,
              name: 'Pantopus',
              username: 'pantopus',
              first_name: 'Pantopus',
              last_name: null,
              profile_picture_url: null,
            },
          );

          // Insert at position 2 (after first 2 real posts)
          const insertAt = Math.min(2, result.posts.length);
          result.posts.splice(insertAt, 0, transitionCard);
        }
      } catch (transErr) {
        logger.warn('Transition card injection failed', { error: transErr.message });
      }
    }

    return res.json(result);
  } catch (err) {
    logger.error('Feed fetch error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});



router.get('/map', verifyToken, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.id;
    const { south, west, north, east, postType, limit = 50, layers: layersParam, surface } = req.query;

    if (!south || !west || !north || !east) {
      return res.status(400).json({ error: 'Bounding box required: south, west, north, east' });
    }

    const s = parseFloat(south);
    const w = parseFloat(west);
    const n = parseFloat(north);
    const e = parseFloat(east);
    const lim = parseInt(limit);

    const boundsArea = Math.abs((n - s) * (e - w));
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom) : null;
    logger.info('viewport_request', {
      endpoint: '/api/posts/map',
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
      layers: layersParam || 'posts',
    });
    const enabledLayers = layersParam
      ? String(layersParam).split(',').map(l => l.trim().toLowerCase())
      : ['posts'];

    const results = [];

    // ── Posts layer ──
    if (enabledLayers.includes('posts')) {
      try {
        const mapPosts = await feedService.getMapFeed({
          userId,
          surface: surface || 'place',
          south: s,
          west: w,
          north: n,
          east: e,
          postType: postType || null,
          limit: lim,
        });

        mapPosts.forEach((post) => results.push({
          layer_type: 'post',
          id: post.id,
          latitude: post.latitude,
          longitude: post.longitude,
          title: post.title || null,
          post_type: post.post_type,
          post_as: post.post_as || 'personal',
          audience: post.audience || 'nearby',
          content: post.content,
          location_name: post.location_name,
          home_address: post.home?.address || null,
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          userHasLiked: !!post.userHasLiked,
          userHasSaved: !!post.userHasSaved,
          created_at: post.created_at,
          creator: post.creator,
        }));
      } catch (error) {
        logger.error('Error fetching map posts', { error: error.message, userId, surface });
      }
    }

    // ── Tasks layer (Gig table) ──
    if (enabledLayers.includes('tasks')) {
      const { data: gigs, error: gigErr } = await supabaseAdmin
        .from('Gig')
        .select('id, title, description, status, latitude, longitude, location_name, category, created_at, poster_id, user_id, accepted_by, location_precision, reveal_policy, poster:poster_id (id, username, name, profile_picture_url)')
        .gte('latitude', s).lte('latitude', n)
        .gte('longitude', w).lte('longitude', e)
        .in('status', ['open', 'assigned', 'in_progress'])
        .limit(lim);
      if (gigErr) {
        logger.error('Error fetching map tasks', { error: gigErr.message });
      } else {
        const { resolveGigPrecision: _resolveTask, applyLocationPrecision: _applyTask } = require('../utils/locationPrivacy');
        (gigs || []).forEach(g => {
          const { precision, isOwner, locationUnlocked } = _resolveTask(g, userId);
          _applyTask(g, precision, isOwner);
          results.push({
            layer_type: 'task',
            id: g.id,
            latitude: g.latitude,
            longitude: g.longitude,
            title: g.title,
            description: g.description,
            status: g.status,
            category: g.category,
            location_name: g.location_name,
            created_at: g.created_at,
            locationUnlocked,
            creator: g.poster ? { id: g.poster.id, username: g.poster.username, name: g.poster.name, profile_picture_url: g.poster.profile_picture_url } : null,
          });
        });
      }
    }

    // ── Offers layer (Gig offers/services) ──
    if (enabledLayers.includes('offers')) {
      const { data: offers, error: offerErr } = await supabaseAdmin
        .from('Gig')
        .select('id, title, description, latitude, longitude, location_name, category, created_at, poster_id, user_id, accepted_by, location_precision, reveal_policy, poster:poster_id (id, username, name, profile_picture_url)')
        .eq('gig_type', 'offer')
        .gte('latitude', s).lte('latitude', n)
        .gte('longitude', w).lte('longitude', e)
        .in('status', ['open'])
        .limit(lim);
      if (offerErr) {
        logger.error('Error fetching map offers', { error: offerErr.message });
      } else {
        const { resolveGigPrecision: _resolveOffer, applyLocationPrecision: _applyOffer } = require('../utils/locationPrivacy');
        (offers || []).forEach(o => {
          const { precision, isOwner, locationUnlocked } = _resolveOffer(o, userId);
          _applyOffer(o, precision, isOwner);
          results.push({
            layer_type: 'offer',
            id: o.id,
            latitude: o.latitude,
            longitude: o.longitude,
            title: o.title,
            description: o.description,
            category: o.category,
            location_name: o.location_name,
            created_at: o.created_at,
            locationUnlocked,
            creator: o.poster ? { id: o.poster.id, username: o.poster.username, name: o.poster.name, profile_picture_url: o.poster.profile_picture_url } : null,
          });
        });
      }
    }

    // ── Businesses layer ──
    if (enabledLayers.includes('businesses')) {
      const { data: biz, error: bizErr } = await supabaseAdmin
        .from('BusinessProfile')
        .select('id, business_name, category, latitude, longitude, address, logo_url, is_verified')
        .gte('latitude', s).lte('latitude', n)
        .gte('longitude', w).lte('longitude', e)
        .limit(lim);
      if (bizErr) {
        logger.error('Error fetching map businesses', { error: bizErr.message });
      } else {
        (biz || []).forEach(b => results.push({
          layer_type: 'business',
          id: b.id,
          latitude: b.latitude,
          longitude: b.longitude,
          business_name: b.business_name,
          category: b.category,
          address: b.address,
          logo_url: b.logo_url,
          is_verified: b.is_verified,
        }));
      }
    }

    // ── Homes layer ──
    // Home table stores coordinates as geography(Point,4326), not separate lat/lon columns.
    // Fetch homes with location and apply bounding box filter in JS.
    if (enabledLayers.includes('homes')) {
      const { data: homes, error: homeErr } = await supabaseAdmin
        .from('Home')
        .select('id, address, city, state, location, home_type')
        .not('location', 'is', null)
        .limit(lim * 3);
      if (homeErr) {
        logger.error('Error fetching map homes', { error: homeErr.message });
      } else {
        let homeCount = 0;
        for (const h of (homes || [])) {
          if (homeCount >= lim) break;
          let lat = null, lon = null;
          if (h.location) {
            if (typeof h.location === 'object' && h.location.coordinates) {
              lon = h.location.coordinates[0];
              lat = h.location.coordinates[1];
            } else if (typeof h.location === 'string') {
              const m = h.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
              if (m) { lon = parseFloat(m[1]); lat = parseFloat(m[2]); }
            }
          }
          if (lat != null && lon != null && lat >= s && lat <= n && lon >= w && lon <= e) {
            results.push({
              layer_type: 'home',
              id: h.id,
              latitude: lat,
              longitude: lon,
              address: h.address,
              city: h.city,
              state: h.state,
              home_type: h.home_type,
            });
            homeCount++;
          }
        }
      }
    }

    // When viewport is empty, find the nearest activity center
    let nearest_activity_center = null;
    if (results.length === 0) {
      const centerLat = (s + n) / 2;
      const centerLon = (w + e) / 2;
      const { data: nearestRows } = await supabaseAdmin.rpc('find_nearest_activity_center', {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_content_type: 'post',
      });
      if (nearestRows && nearestRows.length > 0) {
        nearest_activity_center = {
          latitude: nearestRows[0].latitude,
          longitude: nearestRows[0].longitude,
        };
      }
    }

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info('viewport_response', {
      endpoint: '/api/posts/map',
      status: 200,
      result_count: results.length,
      response_time_ms: Math.round(elapsed * 100) / 100,
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    res.json({ markers: results, nearest_activity_center });
  } catch (err) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.error('Map fetch error', {
      error: err.message,
      userId: req.user.id,
      response_time_ms: Math.round(elapsed * 100) / 100,
    });
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

/**
 * GET /api/posts/saved — saved/bookmarked posts
 * MUST be before /:id route to avoid matching "saved" as an ID
 */
router.get('/saved', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const { data: saves, error } = await supabaseAdmin
      .from('PostSave')
      .select(`
        id, created_at,
        post:post_id (
          *, creator:user_id (${SAFE_CREATOR_SELECT}), home:home_id (id, address, city)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      logger.error('Error fetching saved posts', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch saved posts' });
    }

    const validSaves = (saves || []).filter(s => s.post);
    const privacySafePosts = applyPostLocationPrivacyBatch(
      validSaves.map(s => ({ ...s.post, savedAt: s.created_at })),
      userId
    );
    const serializedPosts = await serializePostsForViewer(privacySafePosts, userId);

    res.json({
      posts: serializedPosts,
      pagination: { limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (err) {
    logger.error('Saved posts fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// ============ POSTING IDENTITIES ============

/**
 * GET /api/posts/identities — Get available posting identities for the composer
 */
/**
 * GET /api/posts/place-eligibility — Check if user can post to Place feed
 * Query: latitude, longitude, gpsTimestamp, gpsLatitude, gpsLongitude
 */
router.get('/place-eligibility', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, gpsTimestamp, gpsLatitude, gpsLongitude } = req.query;

    if (latitude == null || longitude == null) {
      return res.json({ eligible: false, readOnly: true, reason: 'Location required to check Place eligibility.' });
    }

    const trustState = await computeTrustState(userId, parseFloat(latitude), parseFloat(longitude));
    const eligibility = canPostToPlace({
      trustLevel: trustState.level,
      gpsTimestamp: gpsTimestamp || null,
      gpsLatitude: gpsLatitude != null ? parseFloat(gpsLatitude) : null,
      gpsLongitude: gpsLongitude != null ? parseFloat(gpsLongitude) : null,
      targetLatitude: parseFloat(latitude),
      targetLongitude: parseFloat(longitude),
    });

    res.json({
      eligible: eligibility.eligible,
      readOnly: eligibility.readOnly,
      reason: eligibility.reason || null,
      trustLevel: trustState.level,
    });
  } catch (err) {
    logger.error('Place eligibility check error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

router.get('/identities', verifyToken, async (req, res) => {
  try {
    const all = await getPostingIdentities(req.user.id);
    // P2.4 / unified-IA §4.1 — the personal-zone composer never offers
    // persona. Strip it server-side so the picker can't even render the
    // option. The audience composer (P2.5) reads persona separately
    // from /api/personas/me, not this endpoint.
    const identities = (all || []).filter((i) => i && i.type !== 'persona');
    res.json({ identities });
  } catch (err) {
    logger.error('Identities fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch identities' });
  }
});

// ============ SCOPED FEED ROUTES ============


/**
 * GET /api/posts/feed/home — Home feed (household private or neighborhood public)
 */
router.get('/feed/home', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { homeId, subTab = 'household', limit = 20, offset = 0, postType } = req.query;

    if (!homeId) {
      return res.status(400).json({ error: 'homeId is required' });
    }

    // Verify user has access to this home
    const { hasAccess } = await checkHomePermission(homeId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    const audienceFilter = subTab === 'neighborhood' ? 'neighborhood' : 'household';

    let query = supabaseAdmin
      .from('Post')
      .select(FEED_POST_SELECT)
      .eq('home_id', homeId)
      .eq('audience', audienceFilter)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (postType) query = query.eq('post_type', postType);

    const { data: posts, error } = await query;
    if (error) {
      logger.error('Home feed error', { error: error.message, userId, homeId });
      return res.status(500).json({ error: 'Failed to fetch home feed' });
    }

    const enriched = await enrichWithUserStatus(
      (posts || []).map(r => normalizeFeedPostRow(r, new Set(), new Set())),
      userId
    );
    const serialized = await serializePostsForViewer(enriched, userId);

    res.json({
      posts: serialized,
      pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: (posts || []).length >= parseInt(limit) },
    });
  } catch (err) {
    logger.error('Home feed error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch home feed' });
  }
});

/**
 * GET /api/posts/feed/saved-place/:placeId — Nearby feed for a saved place
 * Delegates to feedService.getListFeed with the saved place's coordinates.
 */
router.get('/feed/saved-place/:placeId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { placeId } = req.params;
    const { limit = 20, postType, radiusMiles } = req.query;

    // Verify saved place belongs to user
    const { data: place } = await supabaseAdmin
      .from('SavedPlace')
      .select('id, latitude, longitude, label')
      .eq('id', placeId)
      .eq('user_id', userId)
      .single();

    if (!place) {
      return res.status(404).json({ error: 'Saved place not found' });
    }

    const radiusMeters = radiusMiles
      ? Math.round(parseFloat(radiusMiles) * 1609.34)
      : 160934; // default ~100 miles

    const result = await feedService.getListFeed({
      userId,
      surface: 'place',
      latitude: place.latitude,
      longitude: place.longitude,
      radiusMeters,
      limit: parseInt(limit),
      postType: postType || null,
    });

    res.json({
      posts: result.posts,
      pagination: result.pagination,
    });
  } catch (err) {
    logger.error('Saved place feed error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch saved place feed' });
  }
});

// ============ HIDE / MUTE / RESOLVE ============

/**
 * POST /api/posts/:id/hide — Hide a post for the current user
 */
router.post('/hide/:id', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post } = await supabaseAdmin.from('Post').select('id').eq('id', postId).single();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await supabaseAdmin
      .from('PostHide')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });

    feedService.invalidateFilterCache(userId);
    res.json({ message: 'Post hidden' });
  } catch (err) {
    logger.error('Hide post error', { error: err.message });
    res.status(500).json({ error: 'Failed to hide post' });
  }
});

/**
 * POST /api/posts/mute — Mute a user or business
 */
router.post('/mute', verifyToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.body;
    const userId = req.user.id;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    if (!['user', 'business'].includes(entityType)) {
      return res.status(400).json({ error: 'entityType must be "user" or "business"' });
    }

    await ensurePostMute({
      userId,
      entityType,
      entityId,
      surface: null,
    });

    feedService.invalidateFilterCache(userId);
    res.json({ message: `${entityType} muted successfully` });
  } catch (err) {
    logger.error('Mute error', { error: err.message });
    res.status(500).json({ error: 'Failed to mute' });
  }
});

/**
 * DELETE /api/posts/mute — Unmute a user or business
 */
router.delete('/mute', verifyToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.body || req.query;
    const userId = req.user.id;

    await supabaseAdmin
      .from('PostMute')
      .delete()
      .eq('user_id', userId)
      .eq('muted_entity_type', entityType)
      .eq('muted_entity_id', entityId);

    feedService.invalidateFilterCache(userId);
    res.json({ message: 'Unmuted successfully' });
  } catch (err) {
    logger.error('Unmute error', { error: err.message });
    res.status(500).json({ error: 'Failed to unmute' });
  }
});

/**
 * PATCH /api/posts/resolve/:id — Mark a question post as resolved
 */
router.patch('/resolve/:id', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post } = await supabaseAdmin
      .from('Post')
      .select('id, user_id, post_type, resolved_at')
      .eq('id', postId)
      .single();

    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== userId) return res.status(403).json({ error: 'Only the post author can mark it as resolved' });
    if (post.post_type !== 'ask_local') return res.status(400).json({ error: 'Only questions can be marked as resolved' });
    if (post.resolved_at) return res.status(400).json({ error: 'This question is already resolved' });

    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from('Post')
      .update({ resolved_at: now, state: 'solved', solved_at: now })
      .eq('id', postId)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .single();

    if (error) {
      logger.error('Error resolving post', { error: error.message, postId });
      return res.status(500).json({ error: 'Failed to resolve post' });
    }

    res.json({ message: 'Question marked as resolved', post: await serializePostForViewer(updated, userId) });
  } catch (err) {
    logger.error('Resolve post error', { error: err.message });
    res.status(500).json({ error: 'Failed to resolve post' });
  }
});

/**
 * PATCH /api/posts/global-pin/:id — Toggle global pin on a post.
 * Global-pinned posts appear at the top of every user's feed,
 * regardless of surface, location, or social graph.
 * Only the post author can toggle this.
 */
router.patch('/global-pin/:id', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post } = await supabaseAdmin
      .from('Post')
      .select('id, user_id, is_global_pin')
      .eq('id', postId)
      .single();

    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Only this specific platform account can toggle global pins
    const GLOBAL_PIN_ALLOWED = '65103e9d-67b6-4528-ab89-75b78e74b6fb';
    if (userId !== GLOBAL_PIN_ALLOWED) {
      return res.status(403).json({ error: 'You do not have permission to toggle global pin' });
    }

    const newValue = !post.is_global_pin;

    const { data: updated, error } = await supabaseAdmin
      .from('Post')
      .update({ is_global_pin: newValue, is_pinned: newValue })
      .eq('id', postId)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .single();

    if (error) {
      logger.error('Error toggling global pin', { error: error.message, postId });
      return res.status(500).json({ error: 'Failed to toggle global pin' });
    }

    res.json({ message: newValue ? 'Post globally pinned' : 'Global pin removed', post: await serializePostForViewer(updated, userId) });
  } catch (err) {
    logger.error('Global pin error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle global pin' });
  }
});

// ============ v1.1 FEED PREFERENCES ============

/**
 * GET /api/posts/feed-preferences — Get user's feed preference toggles
 */
router.get('/feed-preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data } = await supabaseAdmin
      .from('UserFeedPreference')
      .select('*')
      .eq('user_id', userId)
      .single();

    res.json({
      preferences: data || {
        user_id: userId,
        hide_deals_place: false,
        hide_alerts_place: false,
        show_politics_connections: false,
        show_politics_place: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Feed preferences fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch feed preferences' });
  }
});

/**
 * PUT /api/posts/feed-preferences — Update user's feed preference toggles
 */
router.put('/feed-preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      hideDealsPlace, hideAlertsPlace,
      showPoliticsConnections, showPoliticsPlace,
    } = req.body;

    // Only include fields that were explicitly provided to avoid
    // overwriting existing preferences with false defaults.
    const upsertData = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (hideDealsPlace !== undefined) upsertData.hide_deals_place = !!hideDealsPlace;
    if (hideAlertsPlace !== undefined) upsertData.hide_alerts_place = !!hideAlertsPlace;
    if (showPoliticsConnections !== undefined) upsertData.show_politics_connections = !!showPoliticsConnections;
    if (showPoliticsPlace !== undefined) upsertData.show_politics_place = !!showPoliticsPlace;

    const { data, error } = await supabaseAdmin
      .from('UserFeedPreference')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      logger.error('Feed preferences update error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to update feed preferences' });
    }

    // Invalidate cached filters so the feed immediately reflects the change
    feedService.invalidateFilterCache(userId);
    res.json({ message: 'Feed preferences updated', preferences: data });
  } catch (err) {
    logger.error('Feed preferences error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to update feed preferences' });
  }
});

/**
 * POST /api/posts/mute/topic — Mute a post type on a specific surface
 */
router.post('/mute/topic', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postType, surface } = req.body;

    if (!postType) return res.status(400).json({ error: 'postType is required' });
    if (surface != null && !FEED_SURFACES.includes(surface)) {
      return res.status(400).json({ error: 'surface must be one of place, connections, or personas' });
    }

    await ensurePostMute({
      userId,
      entityType: 'topic',
      entityId: postType,
      surface: surface || null,
    });

    feedService.invalidateFilterCache(userId);
    res.json({ message: `Muted ${postType}${surface ? ` on ${surface}` : ''}` });
  } catch (err) {
    logger.error('Topic mute error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to mute topic' });
  }
});

// ============ SINGLE POST + DETAILS ============

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const { data: post, error } = await supabaseAdmin
      .from('Post')
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT}), home:home_id (id, address, city, state)`)
      .eq('id', id).single();

    if (error || !post) return res.status(404).json({ error: 'Post not found' });

    const hasAccess = await canViewPost(post, userId);
    if (!hasAccess) return res.status(403).json({ error: 'You do not have access to this post' });

    const { data: comments } = await supabaseAdmin
      .from('PostComment')
      .select(`*, author:user_id (id, username, name, first_name, last_name, profile_picture_url)`)
      .eq('post_id', id).eq('is_deleted', false).order('created_at', { ascending: true });

    const commentRows = (await attachFilesToComments(comments || [])).map(serializeCommentForViewer);

    let userLike = null;
    let userSave = null;
    let userRepost = null;
    if (userId) {
      [{ data: userLike }, { data: userSave }, { data: userRepost }] = await Promise.all([
        supabaseAdmin.from('PostLike').select('id').eq('post_id', id).eq('user_id', userId).single(),
        supabaseAdmin.from('PostSave').select('id').eq('post_id', id).eq('user_id', userId).single(),
        supabaseAdmin.from('PostShare').select('id').eq('post_id', id).eq('user_id', userId).eq('share_type', 'repost').maybeSingle(),
      ]);
    }

    // Record unique authenticated views without letting repeated refreshes inflate counts.
    const userAgent = req.get('user-agent') || '';
    const isBot = BOT_UA_PATTERN.test(userAgent);
    const isOwner = !!userId && String(post.user_id) === String(userId);
    if (userId && !isOwner && !isBot) {
      supabaseAdmin
        .rpc('record_post_unique_view', { p_post_id: id, p_user_id: userId })
        .then(async ({ error: viewError }) => {
          if (viewError) {
            if (/function.*does not exist|relation.*does not exist|PostView/i.test(String(viewError.message || ''))) {
              logger.warn('PostView migration missing, falling back to simple increment');
              await supabaseAdmin.from('Post').update({ view_count: (post.view_count || 0) + 1 }).eq('id', id);
              return;
            }
            logger.warn('Post unique view tracking error', { error: viewError.message, postId: id, userId });
          }
        })
        .catch(err => logger.warn('post.view_count.error', { error: err.message, postId: id, userId }));
    }

    applyPostLocationPrivacy(post, userId);
    const responsePost = await serializePostForViewer({
      ...post,
      media_urls: normalizeMediaUrls(post.media_urls),
      media_thumbnails: normalizeAlignedMediaUrls(post.media_thumbnails),
      media_live_urls: normalizeAlignedMediaUrls(post.media_live_urls),
      userHasLiked: !!userLike,
      userHasSaved: !!userSave,
      userHasReposted: !!userRepost,
      comments: commentRows,
    }, userId);

    res.json({
      post: responsePost,
    });
  } catch (err) {
    logger.error('Post fetch error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.patch('/:id', verifyToken, validate(updatePostSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: existing } = await supabaseAdmin.from('Post').select('user_id').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only edit your own posts' });

    const fieldMap = {
      content: 'content', title: 'title',
      mediaUrls: 'media_urls', mediaTypes: 'media_types', mediaThumbnails: 'media_thumbnails', mediaLiveUrls: 'media_live_urls',
      postType: 'post_type', postFormat: 'post_format',
      visibility: 'visibility', visibilityScope: 'visibility_scope',
      locationPrecision: 'location_precision',
      latitude: 'latitude', longitude: 'longitude',
      locationName: 'location_name', locationAddress: 'location_address',
      tags: 'tags',
      eventDate: 'event_date', eventEndDate: 'event_end_date', eventVenue: 'event_venue',
      safetyAlertKind: 'safety_alert_kind', safetyHappenedAt: 'safety_happened_at',
      safetyHappenedEnd: 'safety_happened_end', safetyBehaviorDescription: 'safety_behavior_description',
      dealExpiresAt: 'deal_expires_at', dealBusinessName: 'deal_business_name',
      lostFoundType: 'lost_found_type', lostFoundContactPref: 'lost_found_contact_pref',
      serviceCategory: 'service_category', radiusMiles: 'radius_miles',
    };
    const updates = { is_edited: true, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (req.body[camel] !== undefined) updates[snake] = req.body[camel];
    }
    // Map frontend safety kinds to valid DB enum values
    if (updates.safety_alert_kind) {
      updates.safety_alert_kind = toDbSafetyKind(updates.safety_alert_kind);
    }

    const { data: post, error } = await supabaseAdmin
      .from('Post').update(updates).eq('id', id)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT}), home:home_id (id, address, city)`).single();

    if (error) { logger.error('Error updating post', { error: error.message, postId: id }); return res.status(500).json({ error: 'Failed to update post' }); }
    const responsePost = await serializePostForViewer({
      ...post,
      media_urls: normalizeMediaUrls(post.media_urls),
      media_thumbnails: normalizeAlignedMediaUrls(post.media_thumbnails),
      media_live_urls: normalizeAlignedMediaUrls(post.media_live_urls),
    }, userId);
    res.json({
      message: 'Post updated successfully',
      post: responsePost,
    });
  } catch (err) {
    logger.error('Post update error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { data: existing } = await supabaseAdmin.from('Post').select('user_id').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only delete your own posts' });
    const { error } = await supabaseAdmin.from('Post').delete().eq('id', id);
    if (error) { logger.error('Error deleting post', { error: error.message, postId: id }); return res.status(500).json({ error: 'Failed to delete post' }); }
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    logger.error('Post delete error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.post('/:id/archive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { data: existing } = await supabaseAdmin.from('Post').select('user_id').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only archive your own posts' });

    const archivedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('Post')
      .update({ archived_at: archivedAt, updated_at: archivedAt })
      .eq('id', id);
    if (error) {
      logger.error('Error archiving post', { error: error.message, postId: id });
      return res.status(500).json({ error: 'Failed to archive post' });
    }
    res.json({ archived: true, archived_at: archivedAt });
  } catch (err) {
    logger.error('Post archive error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to archive post' });
  }
});

router.post('/:id/unarchive', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { data: existing } = await supabaseAdmin.from('Post').select('user_id').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only restore your own posts' });

    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('Post')
      .update({ archived_at: null, updated_at: updatedAt })
      .eq('id', id);
    if (error) {
      logger.error('Error unarchiving post', { error: error.message, postId: id });
      return res.status(500).json({ error: 'Failed to restore post' });
    }
    res.json({ archived: false, archived_at: null });
  } catch (err) {
    logger.error('Post unarchive error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to restore post' });
  }
});

// ============ MATCHED BUSINESSES (ORGANIC) ============

router.get('/:id/matched-businesses', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;

    // 1. Fetch post to get matched_business_ids + service_category
    const { data: post, error: postErr } = await supabase
      .from('Post')
      .select('id, service_category, matched_business_ids, matched_businesses_cache, created_at')
      .eq('id', postId)
      .single();

    if (postErr || !post) return res.status(404).json({ error: 'Post not found' });

    // No service_category → no matches possible
    if (!post.service_category) {
      return res.json({ businesses: [], cached: false });
    }

    // Suppress for posts older than 30 days
    const postAgeDays = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (postAgeDays > 30) {
      return res.json({ businesses: [], cached: false, expired: true });
    }

    const ids = post.matched_business_ids || [];
    if (ids.length === 0) {
      return res.json({ businesses: [], cached: false });
    }

    // 2. Check if caller wants fast cached response
    const useCached = req.query.cached === 'true';
    if (useCached && post.matched_businesses_cache && post.matched_businesses_cache.length > 0) {
      return res.json({ businesses: post.matched_businesses_cache, cached: true });
    }

    // 3. Hydrate live data from BusinessProfile for matched IDs
    const { data: profiles, error: profileErr } = await supabase
      .from('BusinessProfile')
      .select(`
        user_id,
        categories,
        business_hours,
        average_rating,
        review_count,
        completed_gigs,
        is_published,
        user:user_id (
          id, username, name, first_name, last_name,
          profile_picture_url, is_banned
        )
      `)
      .in('user_id', ids)
      .eq('is_published', true);

    if (profileErr) {
      logger.error('Error fetching matched businesses', { error: profileErr.message, postId });
      return res.status(500).json({ error: 'Failed to fetch matched businesses' });
    }

    // 4. Filter out banned users and unpublished profiles
    const validProfiles = (profiles || []).filter(
      (p) => p.user && !p.user.is_banned
    );

    // 5. Build response preserving ranked order from matched_business_ids
    const profileMap = {};
    validProfiles.forEach((p) => { profileMap[p.user_id] = p; });

    const businesses = ids
      .filter((uid) => profileMap[uid])
      .slice(0, 5)
      .map((uid) => {
        const p = profileMap[uid];
        const u = p.user;
        return {
          business_user_id: uid,
          username: u.username,
          name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
          profile_picture_url: u.profile_picture_url || null,
          categories: p.categories || [],
          average_rating: p.average_rating != null ? parseFloat(p.average_rating) : null,
          review_count: parseInt(p.review_count, 10) || 0,
          completed_gigs: parseInt(p.completed_gigs, 10) || 0,
          is_open_now: null, // Would require business_hours parsing; cache has this
        };
      });

    res.json({ businesses, cached: false });
  } catch (err) {
    logger.error('Matched businesses fetch error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch matched businesses' });
  }
});

router.post('/:id/like', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const post = await requireVisiblePost({ postId: id, userId, res, select: POST_REFS_SELECT });
    if (!post) return;

    const { data, error } = await supabaseAdmin.rpc('toggle_post_like', { p_post_id: id, p_user_id: userId });
    if (error) { logger.error('Error toggling like', { error: error.message, postId: id }); return res.status(500).json({ error: 'Failed to toggle like' }); }

    // Notify post owner on new like (not on unlike, not on own post)
    if (data.liked && post.user_id !== userId) {
      getUserDisplayName(userId).then(name => {
        const { link, extraMeta } = postEngagementNotificationLink(post, id);
        notificationService.createNotification({
          userId: post.user_id,
          type: 'post_liked',
          title: `${name} liked your post`,
          icon: '❤️',
          link,
          metadata: { post_id: id, user_id: userId, ...extraMeta },
        });
      }).catch(err => {
        logger.warn('Like notification failed (non-blocking)', { error: err.message, postId: id });
      });
    }

    res.json({ message: data.liked ? 'Post liked' : 'Post unliked', liked: data.liked, likeCount: data.likeCount });
  } catch (err) {
    logger.error('Like toggle error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

router.get('/:id/likes', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    const post = await requireVisiblePost({ postId: id, userId, res });
    if (!post) return;

    const { data: likes, error } = await supabase.from('PostLike')
      .select(`id, created_at, user:user_id (${SAFE_CREATOR_SELECT})`)
      .eq('post_id', id).order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (error) { logger.error('Error fetching likes', { error: error.message, postId: id }); return res.status(500).json({ error: 'Failed to fetch likes' }); }
    res.json({ likes: (likes || []).map(serializeLikeForViewer), pagination: { limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (err) {
    logger.error('Likes fetch error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// ============ COMMENTS ============

router.post('/:id/comments', verifyToken, validate(createCommentSchema), async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { comment, parentCommentId } = req.body;
    const userId = req.user.id;
    const post = await requireVisiblePost({
      postId,
      userId,
      res,
      select: POST_REFS_SELECT,
    });
    if (!post) return;

    if (parentCommentId) {
      const { data: parent } = await supabase.from('PostComment').select('id, post_id').eq('id', parentCommentId).single();
      if (!parent || parent.post_id !== postId) return res.status(400).json({ error: 'Invalid parent comment' });
    }

    // Rate limit: max 5 comments per user per post within 60 seconds
    const rateLimitWindow = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentCount, error: rlErr } = await supabaseAdmin
      .from('PostComment')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('user_id', userId)
      .gte('created_at', rateLimitWindow);
    if (!rlErr && recentCount !== null && recentCount >= 5) {
      return res.status(429).json({ error: 'You are commenting too quickly. Please wait a moment before posting again.' });
    }

    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    // comment_count auto-incremented by DB trigger
    const { data: newComment, error } = await supabaseAdmin
      .from('PostComment')
      .insert({ post_id: postId, user_id: userId, comment: normalizedComment, parent_comment_id: parentCommentId || null })
      .select(`*, author:user_id (id, username, name, first_name, last_name, profile_picture_url)`)
      .single();

    if (error) { logger.error('Error creating comment', { error: error.message, postId }); return res.status(500).json({ error: 'Failed to create comment' }); }

    // Notify post owner of new comment (not on own post)
    if (post.user_id !== userId) {
      getUserDisplayName(userId).then(name => {
        notificationService.createNotification({
          userId: post.user_id,
          type: 'post_commented',
          title: `${name} commented on your post`,
          body: normalizedComment.length > 100 ? normalizedComment.substring(0, 100) + '…' : normalizedComment,
          icon: '💬',
          link: `/posts/${postId}`,
          metadata: {
            post_id: postId,
            comment_id: newComment.id,
            user_id: userId,
          },
        });
      }).catch(err => {
        logger.warn('Comment notification failed (non-blocking)', { error: err.message, postId });
      });
    }

    // Notify parent comment author of reply (if different from commenter and post owner)
    if (parentCommentId) {
      const { data: parentComment } = await supabaseAdmin.from('PostComment').select('user_id').eq('id', parentCommentId).single();
      if (parentComment && parentComment.user_id !== userId && parentComment.user_id !== post.user_id) {
        getUserDisplayName(userId).then(name => {
          notificationService.createNotification({
            userId: parentComment.user_id,
            type: 'comment_replied',
            title: `${name} replied to your comment`,
            body: normalizedComment.length > 100 ? normalizedComment.substring(0, 100) + '…' : normalizedComment,
            icon: '💬',
            link: `/posts/${postId}`,
            metadata: { post_id: postId, comment_id: newComment.id, parent_comment_id: parentCommentId, user_id: userId },
          });
        }).catch(err => {
          logger.warn('Reply notification failed (non-blocking)', { error: err.message, postId });
        });
      }
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: serializeCommentForViewer({ ...newComment, attachments: [] }),
    });
  } catch (err) {
    logger.error('Comment creation error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.get('/:id/comments', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    const post = await requireVisiblePost({ postId, userId, res });
    if (!post) return;

    const { data: comments, error } = await supabaseAdmin.from('PostComment')
      .select(`*, author:user_id (id, username, name, first_name, last_name, profile_picture_url)`)
      .eq('post_id', postId).eq('is_deleted', false).order('created_at', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (error) { logger.error('Error fetching comments', { error: error.message, postId }); return res.status(500).json({ error: 'Failed to fetch comments' }); }

    // Enrich comments with userHasLiked
    const commentIds = (comments || []).map(c => c.id);
    let userLikedSet = new Set();
    if (commentIds.length > 0) {
      const { data: userLikes } = await supabaseAdmin
        .from('CommentLike')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds);
      if (userLikes) userLikedSet = new Set(userLikes.map(l => l.comment_id));
    }

    const enrichedComments = await attachFilesToComments(comments || []);
    const commentsWithLikes = enrichedComments.map(c => ({
      ...serializeCommentForViewer(c),
      userHasLiked: userLikedSet.has(c.id),
    }));
    res.json({ comments: commentsWithLikes, pagination: { limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (err) {
    logger.error('Comments fetch error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:id/share', verifyToken, validate(sharePostSchema), async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;
    const { shareType = 'external' } = req.body || {};
    const post = await requireVisiblePost({ postId, userId, res, select: POST_REFS_SELECT });
    if (!post) return;

    if (shareType === 'repost') {
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from('PostShare')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('share_type', 'repost')
        .maybeSingle();

      if (existingErr) {
        logger.error('Repost lookup error', { error: existingErr.message, postId, userId });
        return res.status(500).json({ error: 'Failed to repost post' });
      }

      if (existing) {
        const { error: deleteErr } = await supabaseAdmin
          .from('PostShare')
          .delete()
          .eq('id', existing.id);

        if (deleteErr) {
          logger.error('Repost delete error', { error: deleteErr.message, postId, userId });
          return res.status(500).json({ error: 'Failed to remove repost' });
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from('PostShare')
          .insert({ post_id: postId, user_id: userId, share_type: 'repost' });

        if (insertErr) {
          logger.error('Repost insert error', { error: insertErr.message, postId, userId });
          return res.status(500).json({ error: 'Failed to repost post' });
        }

        // Notify post owner of repost (not on own post)
        if (post.user_id !== userId) {
          getUserDisplayName(userId).then(name => {
            const { link, extraMeta } = postEngagementNotificationLink(post, postId);
            notificationService.createNotification({
              userId: post.user_id,
              type: 'post_reposted',
              title: `${name} shared your post`,
              icon: '🔁',
              link,
              metadata: { post_id: postId, user_id: userId, ...extraMeta },
            });
          }).catch(err => {
            logger.warn('Repost notification failed (non-blocking)', { error: err.message, postId });
          });
        }
      }

      const { data: updatedPost } = await supabaseAdmin
        .from('Post')
        .select('share_count')
        .eq('id', postId)
        .single();

      return res.json({
        reposted: !existing,
        shareCount: updatedPost?.share_count || 0,
      });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('PostShare')
      .insert({ post_id: postId, user_id: userId, share_type: 'external' });

    if (insertErr) {
      logger.error('External share insert error', { error: insertErr.message, postId, userId });
      return res.status(500).json({ error: 'Failed to record share' });
    }

    const { data: updatedPost } = await supabaseAdmin
      .from('Post')
      .select('share_count')
      .eq('id', postId)
      .single();

    res.json({
      shared: true,
      shareCount: updatedPost?.share_count || 0,
    });
  } catch (err) {
    logger.error('Post share error', { error: err.message, postId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to share post' });
  }
});

router.patch('/:postId/comments/:commentId', verifyToken, validate(updateCommentSchema), async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('PostComment')
      .select('id, user_id, post_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .maybeSingle();
    if (existingErr) {
      logger.error('Comment lookup error', { error: existingErr.message, commentId, postId });
      return res.status(500).json({ error: 'Failed to update comment' });
    }
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only edit your own comments' });
    const { data: updated, error } = await supabaseAdmin.from('PostComment')
      .update({ comment, is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      .select(`*, author:user_id (id, username, name, first_name, last_name, profile_picture_url)`).single();
    if (error) { logger.error('Error updating comment', { error: error.message, commentId }); return res.status(500).json({ error: 'Failed to update comment' }); }
    res.json({ message: 'Comment updated successfully', comment: serializeCommentForViewer(updated) });
  } catch (err) {
    logger.error('Comment update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

router.delete('/:postId/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('PostComment')
      .select('id, user_id, post_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .maybeSingle();
    if (existingErr) {
      logger.error('Comment lookup error', { error: existingErr.message, commentId, postId });
      return res.status(500).json({ error: 'Failed to delete comment' });
    }
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only delete your own comments' });
    // comment_count auto-decremented by DB trigger
    const { error } = await supabaseAdmin.from('PostComment').delete().eq('id', commentId).eq('post_id', postId);
    if (error) { logger.error('Error deleting comment', { error: error.message, commentId }); return res.status(500).json({ error: 'Failed to delete comment' }); }
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    logger.error('Comment delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============ COMMENT LIKES ============

router.post('/:postId/comments/:commentId/like', verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Verify post is visible to user
    const post = await requireVisiblePost({ postId, userId, res });
    if (!post) return;

    // Verify comment exists and belongs to this post
    const { data: comment, error: commentErr } = await supabaseAdmin
      .from('PostComment')
      .select('id, post_id, user_id, like_count')
      .eq('id', commentId)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (commentErr) {
      logger.error('Comment like lookup error', { error: commentErr.message, commentId, postId });
      return res.status(500).json({ error: 'Failed to toggle comment like' });
    }
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Check if user already liked this comment
    const { data: existingLike } = await supabaseAdmin
      .from('CommentLike')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();

    let liked;
    if (existingLike) {
      // Unlike
      const { error: delErr } = await supabaseAdmin
        .from('CommentLike')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      if (delErr) {
        logger.error('Error removing comment like', { error: delErr.message, commentId });
        return res.status(500).json({ error: 'Failed to toggle comment like' });
      }
      await supabaseAdmin
        .from('PostComment')
        .update({ like_count: Math.max(0, (comment.like_count || 1) - 1) })
        .eq('id', commentId);
      liked = false;
    } else {
      // Like
      const { error: insErr } = await supabaseAdmin
        .from('CommentLike')
        .insert({ comment_id: commentId, user_id: userId });
      if (insErr) {
        logger.error('Error inserting comment like', { error: insErr.message, commentId });
        return res.status(500).json({ error: 'Failed to toggle comment like' });
      }
      await supabaseAdmin
        .from('PostComment')
        .update({ like_count: (comment.like_count || 0) + 1 })
        .eq('id', commentId);
      liked = true;
    }

    // Fetch updated count
    const { data: updated } = await supabaseAdmin
      .from('PostComment')
      .select('like_count')
      .eq('id', commentId)
      .single();

    res.json({ liked, likeCount: updated?.like_count || 0 });
  } catch (err) {
    logger.error('Comment like toggle error', { error: err.message, commentId: req.params.commentId });
    res.status(500).json({ error: 'Failed to toggle comment like' });
  }
});

// ============ USER POSTS ============

router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;
    const { limit = 20, cursorCreatedAt, cursorId } = req.query;
    const parsedLimit = parseInt(limit);

    // v1.1: Determine viewer relationship to filter visible surfaces
    const isOwn = userId === requestingUserId;
    let connection = null;

    if (!isOwn) {
      // Check if there's an accepted relationship (connection)
      const { data: connectionData } = await supabaseAdmin
        .from('Relationship')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(requester_id.eq.${requestingUserId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${requestingUserId})`)
        .maybeSingle();
      connection = connectionData;
    }

    // Profile previews honor both:
    //   - profile_visibility_scope: explicit profile-page visibility
    //   - distribution_targets / audience: whether a network-only post is actually
    //     meant for the current viewer
    //
    // This prevents public viewers from seeing brief previews for followers-only or
    // connections-only posts on someone else's profile while still allowing mixed
    // targets (for example place + followers cross-posts) to appear when the profile
    // scope allows them.

    let query = supabaseAdmin.from('Post')
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT}), home:home_id (id, address, city)`)
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(parsedLimit);

    if (isOwn) {
      // Own profile: see everything (no filters on visibility)
    } else {
      // Non-own profiles: only show posts marked for profile display
      query = query.eq('show_on_profile', true);
      // Exclude posts explicitly hidden from profiles
      query = query.neq('profile_visibility_scope', 'hidden');
    }

    query = applyCursorCondition(query, cursorCreatedAt, cursorId);

    const { data: posts, error } = await query;
    if (error) {
      logger.error('Error fetching user posts', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }

    let filtered = posts || [];

    // Non-own profiles: enforce relationship-scoped profile visibility
    if (!isOwn) {
      const isConnection = !!connection;
      // Legacy 'followers' scope/target is treated as 'connections' after peer-follow removal.
      const NETWORK_TARGETS = ['followers', 'connections'];
      filtered = filtered.filter(post => {
        const scope = post.profile_visibility_scope;
        if (scope === 'followers' && !isConnection) return false;
        if (scope === 'connections' && !isConnection) return false;

        const targets = Array.isArray(post.distribution_targets)
          ? post.distribution_targets.filter(Boolean)
          : [];

        if (targets.length > 0) {
          const networkOnly = targets.every((target) => NETWORK_TARGETS.includes(target));
          if (networkOnly) return isConnection;
        } else {
          if ((post.visibility === 'followers' || post.audience === 'followers') && !isConnection) return false;
          if ((post.visibility === 'connections' || post.audience === 'connections') && !isConnection) return false;
        }

        // 'public' and 'local_context' are visible when the viewer also satisfies
        // any network-only targeting rules above.
        return true;
      });
    }

    const normalized = filtered.map(r => normalizeFeedPostRow(r, new Set(), new Set()));
    const enriched = await enrichWithUserStatus(normalized, requestingUserId);
    const serialized = await serializePostsForViewer(enriched, requestingUserId);

    res.json({
      posts: serialized,
      pagination: buildCursorPagination(serialized, parsedLimit),
    });
  } catch (err) {
    logger.error('User posts fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// ============ REPORT ============

router.post('/:id/report', verifyToken, validate(reportPostSchema), async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { reason, details } = req.body;
    const userId = req.user.id;
    const post = await requireVisiblePost({ postId, userId, res });
    if (!post) return;
    const { error } = await supabaseAdmin.from('PostReport').insert({ post_id: postId, reported_by: userId, reason, details: details || null });
    if (error) { logger.error('Error reporting post', { error: error.message, postId, userId }); return res.status(500).json({ error: 'Failed to report post' }); }
    res.status(200).json({ message: 'Post reported successfully. We will review it shortly.' });
  } catch (err) {
    logger.error('Report error', { error: err.message });
    res.status(500).json({ error: 'Failed to report post' });
  }
});

// ============ NOT HELPFUL FLAG ============

/**
 * POST /api/posts/:id/not-helpful
 * Community signal: "this isn't helpful for this area"
 * Affects ranking (downweight) but does not remove the post.
 */
router.post('/:id/not-helpful', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await requireVisiblePost({
      postId,
      userId,
      res,
      select: POST_VISIBILITY_SELECT,
    });
    if (!post) return;

    // Prevent flagging own posts
    if (post.user_id === userId) return res.status(400).json({ error: 'Cannot flag your own post' });

    const { error } = await supabaseAdmin
      .from('PostNotHelpful')
      .upsert({ post_id: postId, user_id: userId, surface: normalizeSurface(req.body.surface) },
               { onConflict: 'post_id,user_id', ignoreDuplicates: true });

    if (error) {
      logger.error('Not helpful flag error', { error: error.message });
      return res.status(500).json({ error: 'Failed to flag post' });
    }

    // Check threshold: if ≥5 flags within 2 hours from different users, downrank
    const { count } = await supabaseAdmin
      .from('PostNotHelpful')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (count >= 5) {
      // Soft nudge: downrank the post (do not remove)
      await supabaseAdmin
        .from('Post')
        .update({ utility_score: 0 })
        .eq('id', postId);
    }

    res.json({ flagged: true });
  } catch (err) {
    logger.error('Not helpful error', { error: err.message });
    res.status(500).json({ error: 'Failed to flag post' });
  }
});

// ============ SOLVE (MARK AS SOLVED) ============

/**
 * PATCH /api/posts/:id/solve
 * Mark an Ask post as solved. Only the original author can do this.
 */
router.patch('/:id/solve', verifyToken, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post } = await supabaseAdmin
      .from('Post').select('user_id, post_type, state, purpose').eq('id', postId).single();

    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== userId) return res.status(403).json({ error: 'Only the author can mark a post as solved' });
    if (post.post_type !== 'ask_local') {
      return res.status(400).json({ error: 'Only Ask posts can be marked as solved' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Post')
      .update({ state: 'solved', solved_at: new Date().toISOString() })
      .eq('id', postId)
      .select('id, state, solved_at')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update post state' });

    res.json({ message: 'Post marked as solved', post: updated });
  } catch (err) {
    logger.error('Solve post error', { error: err.message });
    res.status(500).json({ error: 'Failed to mark post as solved' });
  }
});

// ============ SAVE / BOOKMARK ============

router.post('/:id/save', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const post = await requireVisiblePost({ postId: id, userId, res });
    if (!post) return;

    const { data: saved, error } = await supabaseAdmin.rpc('toggle_post_save', {
      p_post_id: id,
      p_user_id: userId,
    });

    if (error) {
      logger.error('Error toggling post save', { error: error.message, postId: id });
      return res.status(500).json({ error: 'Failed to toggle save' });
    }

    res.json({ message: saved ? 'Post saved' : 'Post unsaved', saved });
  } catch (err) {
    logger.error('Post save toggle error', { error: err.message, postId: req.params.id });
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});

// ============ SEEDED FACT DISMISSAL ============

/**
 * POST /api/posts/seeded/:factId/dismiss
 * Dismiss a seeded neighborhood fact so it no longer appears in the feed.
 * Stores the fact ID in the user's dismissed_seeded_facts JSONB array.
 * Rolling cap of 50 items (oldest removed first).
 */
router.post('/seeded/:factId/dismiss', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { factId } = req.params;

    if (!factId || typeof factId !== 'string' || factId.length > 64) {
      return res.status(400).json({ error: 'Invalid factId' });
    }

    // Read-then-write: low race risk since dismissals are sequential user taps.
    // If two concurrent requests race, worst case is one dismissal is lost.
    const { data: user, error: readErr } = await supabaseAdmin
      .from('User')
      .select('dismissed_seeded_facts')
      .eq('id', userId)
      .maybeSingle();

    if (readErr) {
      logger.warn('Dismiss seeded fact: read error', { error: readErr.message, userId });
      return res.status(500).json({ error: 'Failed to dismiss fact' });
    }

    let dismissed = Array.isArray(user?.dismissed_seeded_facts) ? [...user.dismissed_seeded_facts] : [];

    // Don't add duplicates
    if (!dismissed.includes(factId)) {
      dismissed.push(factId);
      // Rolling cap — remove oldest entries beyond the cap
      if (dismissed.length > DISMISSED_FACTS_CAP) {
        dismissed = dismissed.slice(dismissed.length - DISMISSED_FACTS_CAP);
      }

      const { error: writeErr } = await supabaseAdmin
        .from('User')
        .update({ dismissed_seeded_facts: dismissed })
        .eq('id', userId);

      if (writeErr) {
        logger.warn('Dismiss seeded fact: write error', { error: writeErr.message, userId });
        return res.status(500).json({ error: 'Failed to dismiss fact' });
      }
    }

    return res.json({ dismissed: true, factId });
  } catch (err) {
    logger.error('Dismiss seeded fact error', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to dismiss fact' });
  }
});

module.exports = router;

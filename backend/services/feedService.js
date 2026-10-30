/**
 * feedService.js — Unified feed query logic for list and map views.
 *
 * All feed surfaces (place, connections, personas) share the same
 * query pipeline: author resolution → post query → normalize →
 * mute/hide/block → politics filter → sort/trim → enrich.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { GeoCache } = require('../utils/geoCache');
const { personaPostVisibleToViewer } = require('../utils/personaPostVisibility');
const {
  applyLocationPrecision,
  leastPrecise,
  MAX_DISPLAY_OFFSET_DEGREES,
  snapToNeighborhoodCells,
} = require('../utils/locationPrivacy');
const s3 = require('./s3Service');
const { readablePosts, postScopeAccess } = require('./pulse/readAccess');
const { unpublishedBusinessIds } = require('../utils/visibilityPolicy');
const { localDisplayNames } = require('../utils/identityProfiles');
const {
  SAFE_CREATOR_SELECT,
  serializeAudienceProfileForViewer,
  serializeLocalProfileForViewer,
  serializeUserAsLocalIdentity,
  serializeBusinessSeatForViewer,
  serializeHomeIdentityForViewer,
  sanitizePersonaPostForViewer,
} = require('../serializers/identitySerializers');

// ---------------------------------------------------------------------------
// In-memory cache for mute/hide filters (60-second TTL)
// ---------------------------------------------------------------------------

const _filterCache = new GeoCache(1000); // userId → { data }, including pending read guards
const FILTER_CACHE_TTL = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEED_SURFACES = ['place', 'connections', 'personas'];
const LOCAL_AUTHOR_USER_SELECT = 'id, username, name, first_name, middle_name, last_name, profile_picture_url, bio, verified, review_count, gigs_completed';

// ---------------------------------------------------------------------------
// Global pins bypass location and social-graph filters, but always use the
// current viewer's audience grants before pagination.
// ---------------------------------------------------------------------------
// Short cache for the Sports active-events list. Shared by the feed (Sports
// mode=event fallback + rank_bucket=3 eligibility) and the /api/sports route.
let _activeSportsEventsCache = { data: null, expires: 0 };
const ACTIVE_SPORTS_EVENTS_TTL = 60_000; // 60 seconds

async function getActiveSportsEvents({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && _activeSportsEventsCache.data && now < _activeSportsEventsCache.expires) {
    return _activeSportsEventsCache.data;
  }

  const { data, error } = await supabaseAdmin
    .from('active_sports_events')
    .select('event_key, display_name, short_label, league, country, starts_at, ends_at, priority, cadence');

  if (error) {
    // View may not exist yet in environments that have not applied the Phase 1
    // migration. Fall back to an empty list so the feed keeps working.
    logger.warn('active_sports_events view unavailable; returning empty list', {
      error: error.message,
    });
    _activeSportsEventsCache = { data: [], expires: now + ACTIVE_SPORTS_EVENTS_TTL };
    return [];
  }

  const rows = (data || []).slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
  });

  _activeSportsEventsCache = { data: rows, expires: now + ACTIVE_SPORTS_EVENTS_TTL };
  return rows;
}

async function getGlobalPins(scopeAccess) {
  // Scope membership and a narrowed post take effect on the next request. Do not
  // cache post rows across viewers or paginate pins before checking their scope.
  const { data, error } = await scopeAccess.query(onlyShownPosts(supabaseAdmin
    .from('Post')
    .select(`${FEED_POST_SELECT}, radius_miles`)
    .eq('is_global_pin', true)
    .is('archived_at', null)))
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error('Failed to fetch global pins', { error: error.message });
    return [];
  }

  return data || [];
}

// P0.3: SAFE_CREATOR_SELECT only pulls audience-safe columns (no name,
// first_name, last_name, city, state). Routes that need to render an author
// project the resulting `creator` row through serializeUserAsLocalIdentity
// (see attachIdentityAuthors below) so the firewall is enforced at the API
// boundary regardless of what the underlying SQL row contains.
const FEED_POST_SELECT = `
  id, user_id, author_user_id, identity_context_type, identity_context_id,
  title, content, media_urls, media_types, media_thumbnails, media_live_urls, post_type, post_format,
  visibility, visibility_scope, location_precision, tags, read_scope, area_id, allow_external_share, moderation_state,
  like_count, comment_count, share_count, save_count, is_pinned, is_global_pin, is_edited, created_at, updated_at,
  home_id, latitude, longitude, effective_latitude, effective_longitude, location_name, location_address,
  post_as, audience, business_id, business_author_id, target_place_id,
  resolved_at, archived_at, archive_reason, is_story, story_expires_at,
  distribution_targets, broadcast_channel_id, target_tier_rank, delivered_count, read_count,
  event_date, event_end_date, event_venue,
  safety_alert_kind, safety_happened_at, safety_behavior_description,
  deal_expires_at, deal_business_name,
  lost_found_type, lost_found_contact_pref,
  service_category, ref_listing_id, ref_task_id,
  purpose, utility_score, show_on_profile, profile_visibility_scope,
  is_visitor_post, state, solved_at, not_helpful_count,
  topic, sports_scope, post_metadata, origin,
  expires_at, resolution, claim_mode,
  creator:user_id (${SAFE_CREATOR_SELECT}),
  business_author:business_author_id (${SAFE_CREATOR_SELECT}),
  home:home_id (id, address, city)
`;

// The embed holds the reposts by the viewer's connections (connectionPostsQuery filters it), which the list names in
// its "reposted" line (repostedByLines). normalizeFeedPostRow copies named fields, so these rows never reach a client.
const CONNECTION_POST_SELECT = `${FEED_POST_SELECT}, radius_miles, connection_reposts:PostShare(user_id, created_at)`;

// ---------------------------------------------------------------------------
// Media URL helpers
// ---------------------------------------------------------------------------

function resolveStoredMediaUrl(url) {
  const cleanUrl = typeof url === 'string' ? url.trim() : '';
  if (!cleanUrl) return '';
  if (/^(https?:)?\/\//i.test(cleanUrl)) return cleanUrl;
  if (/^(data:|blob:)/i.test(cleanUrl)) return cleanUrl;
  return s3.getPublicUrl(cleanUrl.replace(/^\/+/, ''));
}

function normalizeMediaUrls(mediaUrls) {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls.map(resolveStoredMediaUrl).filter(Boolean);
}

// media_thumbnails / media_live_urls are PARALLEL arrays to media_urls —
// empty-string slots are intentional padding (see POST /upload/post-media,
// which pads them to stay index-aligned). Filtering the blanks out, the
// way normalizeMediaUrls does, shifts every later entry and breaks the
// pairing whenever a live photo / thumbnailed video isn't the first
// attachment. This variant resolves stored keys but keeps the slots.
function normalizeAlignedMediaUrls(mediaUrls) {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls.map((url) => resolveStoredMediaUrl(url) || '');
}

// ---------------------------------------------------------------------------
// Row normalizer (direct-query rows → frontend shape)
// ---------------------------------------------------------------------------

function normalizeFeedPostRow(row, likedPostIds = new Set(), savedPostIds = new Set()) {
  return {
    id: row.id,
    user_id: row.user_id,
    author_user_id: row.author_user_id || row.user_id,
    identity_context_type: row.identity_context_type || (row.post_as === 'persona' ? 'persona' : row.post_as === 'home' ? 'home' : row.post_as === 'business' ? 'business' : 'local'),
    identity_context_id: row.identity_context_id || null,
    title: row.title || null,
    content: row.content,
    media_urls: normalizeMediaUrls(row.media_urls),
    media_types: row.media_types || [],
    media_thumbnails: normalizeAlignedMediaUrls(row.media_thumbnails),
    media_live_urls: normalizeAlignedMediaUrls(row.media_live_urls),
    post_type: row.post_type || 'general',
    post_format: row.post_format || 'standard',
    visibility: row.visibility || 'neighborhood',
    read_scope: row.read_scope ?? null,
    allow_external_share: row.allow_external_share ?? null,
    moderation_state: row.moderation_state ?? null,
    visibility_scope: row.visibility_scope || 'neighborhood',
    location_precision: row.location_precision || 'approx_area',
    tags: row.tags || [],
    like_count: row.like_count || 0,
    comment_count: row.comment_count || 0,
    share_count: row.share_count || 0,
    save_count: row.save_count || 0,
    is_pinned: row.is_pinned || false,
    is_global_pin: row.is_global_pin || false,
    is_edited: row.is_edited || false,
    is_archived: !!row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    userHasLiked: likedPostIds.has(row.id),
    userHasSaved: savedPostIds.has(row.id),
    userHasReposted: false,
    home_id: row.home_id || null,
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    effective_latitude: row.effective_latitude || null,
    effective_longitude: row.effective_longitude || null,
    location_name: row.location_name || null,
    distance_meters: null,
    post_as: row.post_as || 'personal',
    audience: row.audience || 'nearby',
    business_id: row.business_id || null,
    target_place_id: row.target_place_id || null,
    resolved_at: row.resolved_at || null,
    archived_at: row.archived_at || null,
    archive_reason: row.archive_reason || null,
    is_story: row.is_story || false,
    story_expires_at: row.story_expires_at || null,
    distribution_targets: row.distribution_targets || [],
    broadcast_channel_id: row.broadcast_channel_id || null,
    target_tier_rank: row.target_tier_rank || null,
    delivered_count: row.delivered_count || 0,
    read_count: row.read_count || 0,
    event_date: row.event_date || null,
    event_end_date: row.event_end_date || null,
    event_venue: row.event_venue || null,
    safety_alert_kind: row.safety_alert_kind || null,
    safety_happened_at: row.safety_happened_at || null,
    safety_behavior_description: row.safety_behavior_description || null,
    deal_expires_at: row.deal_expires_at || null,
    deal_business_name: row.deal_business_name || null,
    lost_found_type: row.lost_found_type || null,
    lost_found_contact_pref: row.lost_found_contact_pref || null,
    service_category: row.service_category || null,
    ref_listing_id: row.ref_listing_id || null,
    ref_task_id: row.ref_task_id || null,
    purpose: row.purpose || null,
    utility_score: row.utility_score || 0,
    show_on_profile: row.show_on_profile !== false,
    profile_visibility_scope: row.profile_visibility_scope || 'public',
    is_visitor_post: row.is_visitor_post || false,
    state: row.state || 'open',
    solved_at: row.solved_at || null,
    not_helpful_count: row.not_helpful_count || 0,
    topic: row.topic || null,
    sports_scope: row.sports_scope || null,
    post_metadata: row.post_metadata || {},
    origin: row.origin || 'user',
    // Lifecycle (contract §1): when the post ends, how it ended (null while open), and how an
    // Offer is claimed (stored on every row; it means something only on an offer).
    expires_at: row.expires_at || null,
    resolution: row.resolution || null,
    claim_mode: row.claim_mode || null,
    // P0.3: project the raw User row through the serializer wall so the
    // legacy `creator` slot never carries User.name / city / state to a
    // client even if a callsite skips attachIdentityAuthors.
    creator: row.creator ? serializeUserAsLocalIdentity(row.creator) : null,
    author: row.author || null,
    home: row.home || null,
  };
}

// A house number and then a word: how the geocoder writes a street line ("4014 Tacoma Court").
const STREET_LINE_LABEL = /^\s*\d+[a-z]?(?:-\d+)?\s+\S/i;

// The place label everyone but the author reads names a place or a town, never a street address or the home itself
// (docs/location-privacy-matrix.md). A Home post says its home's city, as Home posts are labelled since October 6;
// older ones carry the home's name, which is often its street address, and iOS sends the address for a home with no
// city. Any other label that is a street line (an address tagged as the place, or a picker that found no town) is left
// out.
function placeLabelForOthers(post) {
  const isHomePost = post.identity_context_type === 'home' || post.post_as === 'home';
  if (isHomePost && post.home?.city) return post.home.city;
  return STREET_LINE_LABEL.test(post.location_name) ? null : post.location_name;
}

function applyPostLocationPrivacy(post, viewerUserId) {
  if (!post) return post;

  const isAuthor = post.user_id === viewerUserId;
  const effectivePrecision = isAuthor
    ? (post.location_precision || 'approx_area')
    : leastPrecise(post.location_precision || 'approx_area', 'approx_area');

  applyLocationPrecision(post, effectivePrecision, isAuthor);

  if (!isAuthor) {
    // The denormalized effective point (a place tag, the author's position or the
    // home's coordinates) gets the same floor; the raw PostGIS point never leaves.
    applyLocationPrecision(post, effectivePrecision, false, {
      latField: 'effective_latitude', lngField: 'effective_longitude', setUnlockedFlag: false, stripAddress: false,
    });
    delete post.location;
    post.locationUnlocked = false;
    if (post.location_name) post.location_name = placeLabelForOthers(post);
    if (post.home) {
      post.home = {
        ...post.home,
        address: null,
      };
    }
    // The match job measured these distances from the stored point to public business
    // locations and ranked the businesses partly by them; non-authors get neither.
    if (Array.isArray(post.matched_businesses_cache)) {
      post.matched_businesses_cache = sortMatchedBusinessesByRating(
        post.matched_businesses_cache.map((business) => ({ ...business, distance_miles: null })),
      );
    }
    if (Array.isArray(post.matched_business_ids)) {
      post.matched_business_ids = [...post.matched_business_ids].sort();
    }
  }

  return post;
}

// Matched businesses in an order that says nothing about where the post is: by rating,
// then review count, then name.
function sortMatchedBusinessesByRating(businesses) {
  return [...businesses].sort((a, b) => (
    (b.average_rating ?? -1) - (a.average_rating ?? -1)
    || (b.review_count || 0) - (a.review_count || 0)
    || String(a.name || '').localeCompare(String(b.name || ''))
    || String(a.business_user_id || '').localeCompare(String(b.business_user_id || ''))
  ));
}

// The match job's snapshot and ranked ids keep a business that closed or went back to draft after the job ran,
// until its next run. Leave such businesses out, as the live list does. If their state can't be read, show none.
async function dropUnpublishedMatches(posts) {
  const ids = posts.flatMap((post) => [
    ...(Array.isArray(post.matched_business_ids) ? post.matched_business_ids : []),
    ...(Array.isArray(post.matched_businesses_cache) ? post.matched_businesses_cache.map((b) => b?.business_user_id) : []),
  ]);
  if (!ids.length) return posts;
  let hidden = null;
  try {
    hidden = await unpublishedBusinessIds(ids);
  } catch (err) {
    logger.warn('Matched business state unavailable', { error: err.message });
  }
  const shown = (id) => hidden !== null && !hidden.has(String(id));
  for (const post of posts) {
    if (Array.isArray(post.matched_business_ids)) {
      post.matched_business_ids = post.matched_business_ids.filter(shown);
    }
    if (Array.isArray(post.matched_businesses_cache)) {
      post.matched_businesses_cache = post.matched_businesses_cache.filter((b) => shown(b?.business_user_id));
    }
  }
  return posts;
}

// Where this viewer is shown a post: the stored point for its author, the point
// applyPostLocationPrivacy gives everyone else, or null when it shows none. Worked out on a
// copy, so the post itself still gets privacy exactly once (in enrichWithUserStatus). Area
// filters and distances use this point, so a non-author's box, radius or distance never
// measures the stored one. The map draws a post at its own point; lists also place a post
// that has none at its effective point (`orEffective`), as their query does.
function displayedPoint(post, viewerUserId, { orEffective = false } = {}) {
  const shown = applyPostLocationPrivacy({
    user_id: post.user_id,
    location_precision: post.location_precision,
    latitude: post.latitude,
    longitude: post.longitude,
    effective_latitude: post.effective_latitude,
    effective_longitude: post.effective_longitude,
  }, viewerUserId);
  if (shown.latitude != null && shown.longitude != null) {
    return { latitude: shown.latitude, longitude: shown.longitude };
  }
  if (orEffective && shown.effective_latitude != null && shown.effective_longitude != null) {
    return { latitude: shown.effective_latitude, longitude: shown.effective_longitude };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mute / hide / block filters
// ---------------------------------------------------------------------------

async function getMuteAndHideFilters(userId) {
  const cached = _filterCache.get(userId);
  if (cached?.data) {
    return cached.data;
  }

  // A mute/unmute can invalidate this read while its database response is pending.
  const pendingEntry = { data: null };
  _filterCache.set(userId, pendingEntry, FILTER_CACHE_TTL);

  const [
    { data: mutes, error: mutesError },
    { data: hides, error: hidesError },
    { data: blocks, error: blocksError },
    { data: userBlocks, error: userBlocksError },
    { data: personaBlocks, error: personaBlocksError },
    { data: feedPrefs, error: feedPrefsError },
  ] = await Promise.all([
    supabaseAdmin.from('PostMute').select('muted_entity_id, muted_entity_type, surface, area_id').eq('user_id', userId),
    supabaseAdmin.from('PostHide').select('post_id').eq('user_id', userId),
    supabaseAdmin.from('Relationship')
      .select('requester_id, addressee_id')
      .eq('status', 'blocked')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    // Profile blocks (UserBlock) hide content in both directions, like messaging.
    supabaseAdmin.from('UserBlock')
      .select('blocker_user_id, blocked_user_id')
      .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`),
    supabaseAdmin.from('PersonaBlock').select('persona_id').eq('blocked_user_id', userId),
    supabaseAdmin.from('UserFeedPreference').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const filterError = mutesError || hidesError || blocksError || userBlocksError || personaBlocksError || feedPrefsError;
  if (filterError) throw new Error(`Failed to load feed filters: ${filterError.message}`);

  const blockedUserIds = new Set();
  if (blocks) {
    for (const b of blocks) {
      if (b.requester_id === userId) blockedUserIds.add(b.addressee_id);
      else blockedUserIds.add(b.requester_id);
    }
  }
  if (userBlocks) {
    for (const b of userBlocks) {
      blockedUserIds.add(b.blocker_user_id === userId ? b.blocked_user_id : b.blocker_user_id);
    }
  }

  // Build surface-scoped topic mute sets, and the areas each Pulse topic is muted in
  const topicMutes = (mutes || []).filter(m => m.muted_entity_type === 'topic');
  const globalMutedTopics = new Set(topicMutes.filter(m => !m.surface && !m.area_id).map(m => m.muted_entity_id));
  const mutedTopicsBySurface = new Map();
  const mutedTopicAreas = new Map();
  for (const m of topicMutes) {
    if (m.area_id) {
      if (!mutedTopicAreas.has(m.muted_entity_id)) mutedTopicAreas.set(m.muted_entity_id, new Set());
      mutedTopicAreas.get(m.muted_entity_id).add(m.area_id);
    } else if (m.surface) {
      if (!mutedTopicsBySurface.has(m.surface)) mutedTopicsBySurface.set(m.surface, new Set());
      mutedTopicsBySurface.get(m.surface).add(m.muted_entity_id);
    }
  }

  const result = {
    mutedUserIds: new Set((mutes || []).filter(m => m.muted_entity_type === 'user').map(m => m.muted_entity_id)),
    mutedBusinessIds: new Set((mutes || []).filter(m => m.muted_entity_type === 'business').map(m => m.muted_entity_id)),
    mutedPersonaIds: new Set((mutes || []).filter(m => m.muted_entity_type === 'persona').map(m => m.muted_entity_id)),
    hiddenPostIds: new Set((hides || []).map(h => h.post_id)),
    blockedUserIds,
    blockedPersonaIds: new Set((personaBlocks || []).map(block => block.persona_id).filter(Boolean)),
    globalMutedTopics,
    mutedTopicsBySurface,
    mutedTopicAreas,
    sports: feedPrefs?.sports || {},
    feedPreferences: feedPrefs || {
      hide_deals_place: false, hide_alerts_place: false,
      show_politics_connections: false, show_politics_place: false,
    },
  };

  if (_filterCache.get(userId) === pendingEntry) {
    pendingEntry.data = result;
    _filterCache.set(userId, pendingEntry, FILTER_CACHE_TTL);
  }
  return result;
}

function invalidateFilterCache(userId) {
  _filterCache.delete(userId);
}

function applyMuteHideFilters(posts, filters, surface, viewerUserId = null) {
  const dealTypes = ['deal'];
  const alertTypes = ['alert'];
  const isPlace = surface === 'place';

  return posts.filter(p => {
    const isOwnPost = viewerUserId != null && p.user_id === viewerUserId;
    if (filters.hiddenPostIds.has(p.id)) return false;
    if (!isOwnPost) {
      if (filters.mutedUserIds.has(p.user_id)) return false;
      if (p.identity_context_type === 'persona' && filters.mutedPersonaIds?.has(p.identity_context_id)) return false;
      if (p.business_id && filters.mutedBusinessIds.has(p.business_id)) return false;
      if (filters.blockedUserIds && filters.blockedUserIds.has(p.user_id)) return false;
      if (
        p.identity_context_type === 'persona'
        && filters.blockedPersonaIds
        && filters.blockedPersonaIds.has(p.identity_context_id)
      ) return false;
      // Topic mutes apply to BOTH:
      //   - p.topic (new first-class topic column, e.g. 'sports')
      //   - p.post_type (legacy; POST /api/posts/mute/topic was originally
      //     defined over post_type, and some muted_entity_ids are post types).
      // Without this, muting the 'sports' topic would silently no-op.
      if (filters.globalMutedTopics) {
        if (p.topic && filters.globalMutedTopics.has(p.topic)) return false;
        if (filters.globalMutedTopics.has(p.post_type)) return false;
      }
      if (filters.mutedTopicsBySurface) {
        const surfaceTopics = filters.mutedTopicsBySurface.get(surface);
        if (surfaceTopics) {
          if (p.topic && surfaceTopics.has(p.topic)) return false;
          if (surfaceTopics.has(p.post_type)) return false;
        }
      }
      // A topic muted in one area hides its posts there, and posts that aren't in any area.
      const mutedAreas = p.topic ? filters.mutedTopicAreas?.get(p.topic) : null;
      if (mutedAreas && (p.area_id == null || mutedAreas.has(p.area_id))) return false;
      // Place-specific preference hiding — only apply on the Place surface
      if (isPlace && filters.feedPreferences?.hide_deals_place && dealTypes.includes(p.post_type)) return false;
      if (isPlace && filters.feedPreferences?.hide_alerts_place && alertTypes.includes(p.post_type)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Enrichment (like / save status)
// ---------------------------------------------------------------------------

// The viewer's like, save and repost rows for these posts.
function loadUserStatusRows(posts, userId) {
  const postIds = posts.map(p => p.id);
  return Promise.all([
    supabaseAdmin.from('PostLike').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabaseAdmin.from('PostSave').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabaseAdmin.from('PostShare').select('post_id').eq('user_id', userId).eq('share_type', 'repost').in('post_id', postIds),
  ]);
}

// NOTE: This function applies location privacy via applyPostLocationPrivacy.
// Callers should NOT also call applyPostLocationPrivacy.
// `statusRows` is loadUserStatusRows' result when the caller has already read it.
async function enrichWithUserStatus(posts, userId, statusRows = null) {
  if (!posts.length) return posts;
  await dropUnpublishedMatches(posts);
  const [{ data: likes }, { data: saves }, { data: reposts }] = statusRows || await loadUserStatusRows(posts, userId);
  const likedSet = new Set((likes || []).map(r => r.post_id));
  const savedSet = new Set((saves || []).map(r => r.post_id));
  const repostSet = new Set((reposts || []).map(r => r.post_id));
  return posts.map(p => {
    applyPostLocationPrivacy(p, userId);
    return {
      ...p,
      userHasLiked: likedSet.has(p.id),
      userHasSaved: savedSet.has(p.id),
      userHasReposted: repostSet.has(p.id),
    };
  });
}

// P0.4 audit follow-up (retired): legacyCreatorFromAuthor used to fabricate
// a `{ id, username, name, first_name, profile_picture_url }` shape on every
// feed post so legacy mobile/web clients could keep reading the old keys.
// All web + mobile feed consumers now read post.author (the typed identity
// — handle / displayName / avatarUrl). The legacy slot is gone; post.creator
// on a feed response is now the audience-safe output of
// serializeUserAsLocalIdentity (new keys only). Audience Profile design v2
// §16 item 3.

function redactPrivateIdentityFields(post, author, viewerUserId = null) {
  if (!author) return post;

  if (author.type === 'business') {
    // A business post names the business, never the owner or staff member who wrote it. Only that person keeps
    // their own id on it: the apps offer Edit and Delete when user_id is the viewer's (and the server lets only
    // them edit). Everyone else, the business's other team members included, gets the business's id.
    const writerId = post.author_user_id || post.user_id;
    if (viewerUserId && writerId && String(writerId) === String(viewerUserId)) return post;
    return { ...post, user_id: author.id, author_user_id: author.id };
  }

  if (author.type === 'persona') {
    return sanitizePersonaPostForViewer({
      ...post,
      // Keep legacy feed clients working without exposing the private User id.
      user_id: author.id,
      author_user_id: null,
      identity_context_id: author.id,
    });
  }

  return post;
}

const isBusinessPost = (post) => post.identity_context_type === 'business' || post.post_as === 'business';
// The business a business post was written for.
const businessIdOfPost = (post) => post.business_id || post.business_author_id || post.business_author?.id
  || post.identity_context_id || null;

// The businesses these posts were written for, as their posts show them: the name and avatar, and the handle (a link
// to the business page) only while the business is published. A failed read leaves the generic "Business".
async function loadBusinessAuthors(ids) {
  try {
    const [{ data, error }, hidden] = await Promise.all([
      supabaseAdmin.from('User').select('id, username, name, profile_picture_url').in('id', ids).eq('account_type', 'business'),
      unpublishedBusinessIds(ids),
    ]);
    if (error) throw error;
    return new Map((data || []).map((row) => [String(row.id), { ...row, published: !hidden.has(String(row.id)) }]));
  } catch (err) {
    logger.warn('Business post authors unavailable', { error: err.message });
    return new Map();
  }
}

// The persona, local profile and user rows of these posts' authors, and the businesses of business posts.
function loadIdentityAuthorRows(posts) {
  const personaIds = [...new Set(posts
    .filter(p => p.identity_context_type === 'persona' && p.identity_context_id)
    .map(p => p.identity_context_id))];
  const localUserIds = [...new Set(posts
    .filter(p => !p.identity_context_type || p.identity_context_type === 'local' || p.post_as === 'personal')
    .map(p => p.author_user_id || p.user_id)
    .filter(Boolean))];
  const businessIds = [...new Set(posts.filter(isBusinessPost).map(businessIdOfPost).filter(Boolean).map(String))];

  return Promise.all([
    personaIds.length
      ? supabaseAdmin.from('PublicPersona').select('*').in('id', personaIds)
      : Promise.resolve({ data: [] }),
    localUserIds.length
      ? supabaseAdmin.from('LocalProfile').select('*').in('user_id', localUserIds)
      : Promise.resolve({ data: [] }),
    localUserIds.length
      ? supabaseAdmin.from('User').select(LOCAL_AUTHOR_USER_SELECT).in('id', localUserIds)
      : Promise.resolve({ data: [] }),
    businessIds.length ? loadBusinessAuthors(businessIds) : Promise.resolve(new Map()),
  ]);
}

// `authorRows` is loadIdentityAuthorRows' result when the caller has already read it.
async function attachIdentityAuthors(posts, viewerUserId, authorRows = null) {
  if (!posts.length) return posts;

  const [personaResult, localResult, localUserResult, businessesById = new Map()] = authorRows || await loadIdentityAuthorRows(posts);

  const personasById = new Map((personaResult.data || []).map(row => [row.id, row]));
  const localsByUserId = new Map((localResult.data || []).map(row => [String(row.user_id), row]));
  const usersById = new Map((localUserResult.data || []).map(row => [String(row.id), row]));

  return posts.map((post) => {
    let author = null;

    if (post.identity_context_type === 'persona') {
      const persona = personasById.get(post.identity_context_id);
      if (persona) {
        author = serializeAudienceProfileForViewer(persona, {
          isOwner: persona.user_id === viewerUserId,
        });
      }
    } else if (isBusinessPost(post)) {
      const businessId = businessIdOfPost(post);
      const business = businessId ? businessesById.get(String(businessId)) : null;
      author = serializeBusinessSeatForViewer({
        id: businessId || 'business',
        business_user_id: businessId,
        business_username: business?.published ? business.username : null,
        display_name: business?.name || post.business_author?.name || post.business_author?.username || 'Business',
        display_avatar_url: business?.profile_picture_url || post.business_author?.profile_picture_url || null,
        role_base: 'business',
      });
    } else if (post.identity_context_type === 'home' || post.post_as === 'home') {
      author = serializeHomeIdentityForViewer(post.home || {
        id: post.home_id || post.identity_context_id || 'home',
        city: null,
        state: null,
      });
    } else {
      const authorUserId = post.author_user_id || post.user_id;
      const authorUserKey = String(authorUserId || '');
      const local = localsByUserId.get(authorUserKey);
      if (local) {
        author = serializeLocalProfileForViewer({
          ...local,
          user: usersById.get(authorUserKey) || post.creator || null,
        });
      }
    }

    if (!author && post.creator) {
      const authorUserId = post.author_user_id || post.user_id;
      author = serializeUserAsLocalIdentity(usersById.get(String(authorUserId || '')) || post.creator);
    }

    if (!author) return post;

    const publicPost = redactPrivateIdentityFields(post, author, viewerUserId);

    // P0.4 follow-up: legacyCreatorFromAuthor (which fabricated a
    // {username, name, first_name, profile_picture_url} legacy shape) is
    // gone. The replacement post.creator is derived from `author` (the
    // typed identity), NOT from the raw User row, so the underlying User
    // UUID and any leaky columns (email, city, legal name) never reach
    // the wire on any code path — including paths that bypass
    // normalizeFeedPostRow and pass a raw `creator` through. New code
    // reads post.author; post.creator stays as a thin projection of the
    // same identity for legacy clients.
    const safeCreator = author
      ? {
          type: author.type,
          id: author.id,
          handle: author.handle || null,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl || null,
        }
      : null;
    return {
      ...publicPost,
      author,
      creator: safeCreator,
      business_author: null,
    };
  });
}

// Like/save status and typed public authors for a page of posts: enrichWithUserStatus, then
// attachIdentityAuthors. Neither lookup depends on the other, so both are read in one round
// trip; the location privacy pass still runs before the authors are attached.
async function enrichFeedPosts(posts, userId) {
  if (!posts.length) return posts;
  const [statusRows, authorRows] = await Promise.all([
    loadUserStatusRows(posts, userId),
    loadIdentityAuthorRows(posts),
  ]);
  return attachIdentityAuthors(await enrichWithUserStatus(posts, userId, statusRows), userId, authorRows);
}

// ---------------------------------------------------------------------------
// Reads started ahead of use
// ---------------------------------------------------------------------------

// A read started before it's needed holds its outcome until awaited with outcome(), so an early
// return or a failure in between leaves no rejection unhandled (app.js exits the process on one).
// A failed read still throws, where its result is used.
function settle(read) {
  return read.then((value) => ({ value }), (error) => ({ error }));
}

async function outcome(pending) {
  const { value, error } = await pending;
  if (error) throw error;
  return value;
}

// ---------------------------------------------------------------------------
// Politics filter
// ---------------------------------------------------------------------------

function isPoliticsPost(post) {
  return (post.tags || []).some(t => ['politics', 'political'].includes(t.toLowerCase()))
    || (post.purpose === 'story' && (post.tags || []).includes('politics'));
}

// ---------------------------------------------------------------------------
// What the views show
// ---------------------------------------------------------------------------

// The feeds, the map and the pins show live posts that haven't ended (contract §5). A post whose
// own end time has passed leaves them at once, before the archive job ends it (S7: a Heads-up ends
// at the time it names). A post held for review or removed by moderation (S11) leaves them too;
// its author still reads it on its page and in their own list (canReadPost).
function onlyShownPosts(query) {
  return query
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .eq('moderation_state', 'live');
}

// ---------------------------------------------------------------------------
// Cursor pagination helpers
// ---------------------------------------------------------------------------

function applyCursorCondition(query, cursorCreatedAt, cursorId) {
  if (!cursorCreatedAt || !cursorId) return query;
  return query.or(
    `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
  );
}

function applyPinnedCursorCondition(query, cursorCreatedAt, cursorId, cursorIsPinned) {
  if (!cursorCreatedAt || !cursorId || cursorIsPinned == null) {
    return applyCursorCondition(query, cursorCreatedAt, cursorId);
  }

  if (cursorIsPinned) {
    return query.or(
      [
        'is_pinned.eq.false',
        `and(is_pinned.eq.true,created_at.lt.${cursorCreatedAt})`,
        `and(is_pinned.eq.true,created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
      ].join(',')
    );
  }

  return query.or(
    [
      `and(is_pinned.eq.false,created_at.lt.${cursorCreatedAt})`,
      `and(is_pinned.eq.false,created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
    ].join(',')
  );
}

async function getCursorPinState(cursorId) {
  if (!cursorId) return null;
  const { data, error } = await supabaseAdmin
    .from('Post')
    .select('id, is_pinned')
    .eq('id', cursorId)
    .maybeSingle();

  if (error || !data) return null;
  return !!data.is_pinned;
}

function buildCursorPagination(posts, limit, preSliceCount) {
  // If preSliceCount is provided, use it to determine hasMore (the count
  // of posts that survived filtering before trimming to limit).
  // Otherwise fall back to comparing the returned array length.
  const hasMore = preSliceCount != null ? preSliceCount > limit : posts.length >= limit;
  const lastPost = posts.length > 0 ? posts[posts.length - 1] : null;
  return {
    nextCursor: lastPost ? { createdAt: lastPost.created_at, id: lastPost.id } : null,
    hasMore,
  };
}

// ---------------------------------------------------------------------------
// Author-graph loaders (Connections / Persona)
// ---------------------------------------------------------------------------

async function loadConnectionIds(userId) {
  const { data: rels, error } = await supabaseAdmin
    .from('Relationship')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) {
    throw new Error(`Failed to load connection graph: ${error.message}`);
  }
  return (rels || []).map(r =>
    r.requester_id === userId ? r.addressee_id : r.requester_id
  ).filter(Boolean);
}

// The reposts embed holds only reposts by these people.
function withConnectionReposts(query, authorIds) {
  return query
    .eq('connection_reposts.share_type', 'repost')
    .in('connection_reposts.user_id', authorIds);
}

function connectionPostsQuery(query, authorIds) {
  return withConnectionReposts(query, authorIds)
    .or(`and(user_id.in.(${authorIds.join(',')}),distribution_targets.ov.{connections},or(post_as.is.null,post_as.neq.business)),connection_reposts.not.is.null`);
}

// ---------------------------------------------------------------------------
// Connections order: each post at the time it reached the viewer
// ---------------------------------------------------------------------------

// A PostgREST timestamp in microseconds since the epoch, so two times in the same millisecond still compare.
function timestampMicros(value) {
  const text = String(value || '');
  const millis = Date.parse(text.replace(/\.\d+/, ''));
  if (Number.isNaN(millis)) return null;
  const fraction = /\.(\d+)/.exec(text)?.[1] || '';
  return millis * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

// When a Connections post reached the viewer: when a connection wrote it for Connections, or the latest repost by
// one of their connections (the embed holds no one else's), whichever is later. Null for a row that is neither.
function reachedConnectionsAt(row, authorIdSet) {
  const written = authorIdSet.has(row.user_id) && (row.distribution_targets || []).includes('connections')
    && row.post_as !== 'business';
  let latest = written ? { at: row.created_at, micros: timestampMicros(row.created_at) } : null;
  for (const share of row.connection_reposts || []) {
    const micros = timestampMicros(share.created_at);
    if (micros != null && (!latest || micros > latest.micros)) latest = { at: share.created_at, micros };
  }
  return latest?.micros == null ? null : latest;
}

// Newest first, then by id, the order the list's cursor follows.
function byReachedDesc(a, b) {
  return (b.reached.micros - a.reached.micros) || (a.row.id < b.row.id ? 1 : a.row.id > b.row.id ? -1 : 0);
}

// Whether a post that reached the viewer at `reached` lies below `upper`: { at, id } is a cursor, which leaves out
// that post and everything above it; { at } alone keeps everything at that time.
function belowUpper(row, reached, upper) {
  if (!upper) return true;
  const upperMicros = timestampMicros(upper.at);
  if (reached.micros !== upperMicros) return reached.micros < upperMicros;
  return upper.id == null || row.id < upper.id;
}

// The oldest time in a full batch, below which that read may still hold rows; null when the batch was the last.
function batchFloor(times, batch) {
  if (times.length < batch) return null;
  return times.reduce((oldest, at) => (timestampMicros(at) < timestampMicros(oldest) ? at : oldest));
}

// One round of unpinned Connections rows below `upper`, newest first by when they reached the viewer. The posts
// connections wrote for Connections and the reposts by connections are each read newest first, a batch at a time.
// A post is listed only once it is newer than both batches' floors: above them neither read can still hold a later
// time for it, so no post is cut off or listed twice. The next round starts at `floor` (null: nothing is left).
async function connectionRows({ posts, authorIds, authorIdSet, upper, batch }) {
  let written = withConnectionReposts(posts(), authorIds)
    .in('user_id', authorIds)
    .overlaps('distribution_targets', ['connections'])
    .or('post_as.is.null,post_as.neq.business');
  if (upper) {
    written = upper.id == null ? written.lte('created_at', upper.at) : applyCursorCondition(written, upper.at, upper.id);
  }
  let shares = supabaseAdmin.from('PostShare').select('post_id, created_at')
    .eq('share_type', 'repost')
    .in('user_id', authorIds);
  if (upper) shares = shares.lte('created_at', upper.at);
  const [writtenRead, sharesRead] = await Promise.all([
    written.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(batch),
    shares.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(batch),
  ]);
  if (writtenRead.error) throw new Error(`Feed query failed: ${writtenRead.error.message}`);
  if (sharesRead.error) throw new Error(`Feed query failed: ${sharesRead.error.message}`);
  const writtenRows = writtenRead.data || [];
  const shareRows = sharesRead.data || [];
  const floor = [
    batchFloor(writtenRows.map((row) => row.created_at), batch),
    batchFloor(shareRows.map((share) => share.created_at), batch),
  ].filter(Boolean).reduce((higher, at) => (higher && timestampMicros(higher) >= timestampMicros(at) ? higher : at), null);

  const listed = new Set(writtenRows.map((row) => row.id));
  const repostedIds = [...new Set(shareRows.map((share) => share.post_id))].filter((id) => !listed.has(id));
  let repostedRows = [];
  if (repostedIds.length) {
    const { data, error } = await withConnectionReposts(posts(), authorIds).in('id', repostedIds);
    if (error) throw new Error(`Feed query failed: ${error.message}`);
    repostedRows = data || [];
  }
  const floorMicros = floor && timestampMicros(floor);
  const rows = [...writtenRows, ...repostedRows]
    .map((row) => ({ row, reached: reachedConnectionsAt(row, authorIdSet) }))
    .filter(({ row, reached }) => reached && belowUpper(row, reached, upper)
      && (floor == null || reached.micros > floorMicros))
    .sort(byReachedDesc);
  return { rows, floor };
}

// The pinned Connections posts below `upper`, newest first by when they reached the viewer: few, so read at once.
async function pinnedConnectionRows({ posts, authorIds, authorIdSet, upper }) {
  const { data, error } = await connectionPostsQuery(posts(), authorIds).limit(100);
  if (error) throw new Error(`Feed query failed: ${error.message}`);
  return (data || [])
    .map((row) => ({ row, reached: reachedConnectionsAt(row, authorIdSet) }))
    .filter(({ row, reached }) => reached && belowUpper(row, reached, upper))
    .sort(byReachedDesc);
}

// "Ben C. and 2 others reposted": a Connections post that some of the viewer's connections reposted names the latest
// two, by the name they show neighbors (as likers are named), and counts them all. The embed holds only connections
// the viewer hasn't muted or blocked. Returns post id → { names, count }; none for a post nobody reposted, and none at
// all when the names can't be read (the posts still list).
async function repostedByLines(posts, repostsByPostId) {
  const reposterIds = new Map();
  for (const post of posts) {
    const latestFirst = [...(repostsByPostId.get(post.id) || [])]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const ids = [...new Set(latestFirst.map((share) => share.user_id).filter(Boolean))];
    if (ids.length) reposterIds.set(post.id, ids);
  }
  if (!reposterIds.size) return new Map();
  let names;
  try {
    names = await localDisplayNames([...reposterIds.values()].flatMap((ids) => ids.slice(0, 2)));
  } catch (error) {
    logger.warn('Failed to name reposters for Connections', { error: error.message });
    return new Map();
  }
  return new Map([...reposterIds].map(([postId, ids]) => [postId, {
    names: ids.slice(0, 2).map((id) => names.get(String(id)) || 'Pantopus member'),
    count: ids.length,
  }]));
}

// A legacy post its author made private keeps its older targets, so the Place query still finds it; it lists only
// for viewers its own page lets in (readAccess.canReadPost). Other rows skip the per-post check.
async function withoutUnreadablePrivatePosts(rows, userId) {
  const isPrivate = (post) => post.read_scope == null && post.visibility === 'private' && post.user_id !== userId;
  const privateRows = rows.filter(isPrivate);
  if (!privateRows.length) return rows;
  const readable = new Set((await readablePosts(privateRows, userId)).map((post) => post.id));
  return rows.filter((post) => !isPrivate(post) || readable.has(post.id));
}

async function loadFollowedPersonaMemberships(userId) {
  const { data: memberships, error } = await supabaseAdmin
    .from('PersonaMembership')
    .select('persona_id, tier_id, relationship_type')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due']);

  if (error) {
    throw new Error(`Failed to load persona audience graph: ${error.message}`);
  }

  const rows = (memberships || []).filter(m => m.persona_id);
  const tierIds = [...new Set(rows.map(m => m.tier_id).filter(Boolean))];
  let rankByTierId = new Map();

  if (tierIds.length) {
    const { data: tiers, error: tierError } = await supabaseAdmin
      .from('PersonaTier')
      .select('id, rank')
      .in('id', tierIds);
    if (tierError) {
      logger.warn('Failed to load persona membership tier ranks for feed', {
        error: tierError.message,
        userId,
      });
    } else {
      rankByTierId = new Map((tiers || []).map(t => [t.id, Number(t.rank || 0)]));
    }
  }

  return rows.map(m => ({
    personaId: m.persona_id,
    rank: Math.max(
      Number(rankByTierId.get(m.tier_id) || 0),
      m.relationship_type === 'subscriber' ? 2 : 1,
    ),
  }));
}

async function loadOwnedPersonaFeedTargets(userId) {
  const { data: personas, error } = await supabaseAdmin
    .from('PublicPersona')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to load owned persona feed targets: ${error.message}`);
  }

  return (personas || [])
    .filter(persona => persona.id)
    .map(persona => ({
      personaId: persona.id,
      rank: 4,
    }));
}

// ---------------------------------------------------------------------------
// Bounding-box helper
// ---------------------------------------------------------------------------

function boundingBoxFromCenter(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

// Place reads (the list feed, the Sports lane and the map) reach at most this far from their
// point: 100 miles, the apps' default radius. A wider radius, such as the apps' 1,000-mile and
// Global choices, reads this far, so no single request reads a whole region.
const MAX_PLACE_RADIUS_METERS = 160934;

// The radius a Place read uses: the one asked for, up to the cap. A zero, negative or
// non-numeric radius reads the cap, which is also the routes' default.
function placeRadiusMeters(radiusMeters) {
  const meters = Number(radiusMeters);
  return Number.isFinite(meters) && meters > 0
    ? Math.min(meters, MAX_PLACE_RADIUS_METERS)
    : MAX_PLACE_RADIUS_METERS;
}

// The part of a map box a Place read uses: at most the cap from the box's center each way.
function capPlaceBox({ south, west, north, east }) {
  const cap = boundingBoxFromCenter((south + north) / 2, (west + east) / 2, MAX_PLACE_RADIUS_METERS);
  return {
    south: Math.max(south, cap.south),
    west: Math.max(west, cap.west),
    north: Math.min(north, cap.north),
    east: Math.min(east, cap.east),
  };
}

// The box a query reads so it finds every post whose displayed point can be inside `box`. It is
// widened by the most the location rule moves a point and made of whole location cells, so the
// rows a capped query reads never depend on where in its cell a stored point is.
function widenForDisplayedPoints(box) {
  return snapToNeighborhoodCells({
    south: box.south - MAX_DISPLAY_OFFSET_DEGREES,
    north: box.north + MAX_DISPLAY_OFFSET_DEGREES,
    west: box.west - MAX_DISPLAY_OFFSET_DEGREES,
    east: box.east + MAX_DISPLAY_OFFSET_DEGREES,
  });
}

// Area reads leave out other people's posts with precision `none`: they show this viewer no
// point, so they can't be in an area, and in a capped query their stored points would still
// decide which rows it reads.
function withoutOthersUnplacedPosts(query, userId) {
  return query.or(['location_precision.is.null', 'location_precision.neq.none', userId && `user_id.eq.${userId}`]
    .filter(Boolean).join(','));
}

function pointInBox(point, box) {
  return point != null
    && point.latitude >= box.south && point.latitude <= box.north
    && point.longitude >= box.west && point.longitude <= box.east;
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Surface-specific politics filter key
// ---------------------------------------------------------------------------

function politicsPrefKey(surface) {
  if (surface === 'connections') return 'show_politics_connections';
  return 'show_politics_place';
}

// ---------------------------------------------------------------------------
// getListFeed
// ---------------------------------------------------------------------------

/**
 * Unified list-feed query.
 *
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.surface        – 'place' | 'connections' | 'personas'
 * @param {number} [opts.latitude]
 * @param {number} [opts.longitude]
 * @param {number} [opts.radiusMeters] – defaults to 16 000 m, at most MAX_PLACE_RADIUS_METERS
 * @param {string} [opts.postType]
 * @param {string} [opts.cursorCreatedAt]
 * @param {string} [opts.cursorId]
 * @param {number} [opts.limit]        – defaults to 20
 * @param {string[]} [opts.tags]
 * @param {boolean} [opts.includeEnded] – also posts that ended (archived when their time ran out,
 *   or past their own end time), which still open on their pages; never one moderation removed.
 *   Off for the feeds; "Before you ask" reads earlier questions with it.
 * @returns {Promise<{ posts: object[], pagination: object }>}
 */
async function getListFeed({
  userId,
  surface,
  latitude,
  longitude,
  radiusMeters = 16000,
  postType,
  cursorCreatedAt,
  cursorId,
  cursorRankBucket,
  limit = 20,
  tags,
  topic,
  sportsMode,
  eventKey,
  includeEnded = false,
}) {
  // 1. Validate surface
  if (!FEED_SURFACES.includes(surface)) {
    throw new Error(`Invalid feed surface: ${surface}`);
  }
  radiusMeters = placeRadiusMeters(radiusMeters);

  // Sports topic lane: Place + topic=sports is a fundamentally different
  // query (union of local geo + national country:US) with a stable merged
  // cursor on (rank_bucket, created_at, id). Delegate to getSportsFeed.
  if (topic === 'sports' && surface === 'place') {
    return getSportsFeed({
      userId,
      latitude,
      longitude,
      radiusMeters,
      sportsMode: sportsMode || 'for_you',
      eventKey: eventKey || null,
      cursorCreatedAt: cursorCreatedAt || null,
      cursorId: cursorId || null,
      cursorRankBucket: cursorRankBucket != null ? Number(cursorRankBucket) : null,
      limit,
    });
  }

  const parsedLimit = Number(limit) || 20;
  const overFetchLimit = parsedLimit + 20;
  const isFirstPage = !cursorCreatedAt && !cursorId;
  // Read filters alongside the cursor and author graph; Connections also uses them
  // to keep muted or blocked people from introducing posts through a repost.
  const filtersRead = settle(getMuteAndHideFilters(userId));
  const scopeAccess = await postScopeAccess(userId);
  const globalPinsRead = isFirstPage ? settle(getGlobalPins(scopeAccess)) : null;
  const initialCursorPinned = await getCursorPinState(cursorId);

  // 2–4. Resolve author IDs and distribution target per surface
  let authorIds = null;
  let distributionTarget;
  let personaRankById = new Map();

  if (surface === 'place') {
    distributionTarget = 'place';
    if (latitude == null || longitude == null) {
      return {
        posts: [],
        pagination: { nextCursor: null, hasMore: false },
        requiresViewingLocation: true,
        message: 'Set an area to see local posts.',
      };
    }
  } else if (surface === 'personas') {
    distributionTarget = 'persona_followers';
    const [memberships, ownedPersonas] = await Promise.all([
      loadFollowedPersonaMemberships(userId),
      loadOwnedPersonaFeedTargets(userId),
    ]);
    personaRankById = new Map();
    for (const item of [...memberships, ...ownedPersonas]) {
      if (!item.personaId) continue;
      const rank = Number(item.rank || 1);
      personaRankById.set(item.personaId, Math.max(Number(personaRankById.get(item.personaId) || 0), rank));
    }
    authorIds = [...personaRankById.keys()];
    if (!authorIds.length) {
      return { posts: [], pagination: { nextCursor: null, hasMore: false }, emptyGraph: true };
    }
  } else {
    // connections
    distributionTarget = 'connections';
    authorIds = await loadConnectionIds(userId);
    const filters = await outcome(filtersRead);
    authorIds = authorIds.filter(id => !filters.mutedUserIds.has(id) && !filters.blockedUserIds.has(id));
    if (!authorIds.length) {
      return { posts: [], pagination: { nextCursor: null, hasMore: false }, emptyGraph: true };
    }
  }

  // Pre-compute the query box and center for place surface. The box is widened so it holds
  // every post whose displayed point can be inside the radius; step 8b keeps those that are.
  let box, centerLat, centerLng;
  if (surface === 'place') {
    centerLat = parseFloat(latitude);
    centerLng = parseFloat(longitude);
    box = widenForDisplayedPoints(boundingBoxFromCenter(centerLat, centerLng, radiusMeters));
  }

  // Fetch loop: keep fetching until we have enough visible posts or the
  // DB is exhausted. This prevents premature "all caught up" when many
  // consecutive posts are filtered by mute/hide/politics rules.
  const MAX_ROUNDS = 5;
  let accumulated = [];
  let loopCursorCreatedAt = cursorCreatedAt;
  let loopCursorId = cursorId;
  let loopCursorPinned = initialCursorPinned;
  let dbExhausted = false;
  // Connections: the reposts each fetched post carries, for its "reposted" line.
  const repostsByPostId = new Map();
  // Connections lists pinned posts first, then the rest, each newest first by when the post reached the viewer
  // (connectionRows): a repost at the moment it was reposted. Its cursor carries that time; the cursor post's pin
  // state says which of the two it is in.
  const authorIdSet = new Set(authorIds || []);
  const hasCursor = Boolean(cursorCreatedAt && cursorId);
  let connectionsPinned = !hasCursor || initialCursorPinned === true;
  let connectionsUpper = hasCursor ? { at: cursorCreatedAt, id: cursorId } : null;
  const reachedAtById = new Map();

  // The posts every round reads: shown (with includeEnded, ended but not removed), in this viewer's scope, and of the
  // asked type, topic and tags.
  const surfacePosts = () => {
    const rows = supabaseAdmin.from('Post').select(surface === 'connections' ? CONNECTION_POST_SELECT : FEED_POST_SELECT);
    let query = scopeAccess.query(includeEnded
      ? rows.eq('moderation_state', 'live').or('archive_reason.is.null,archive_reason.neq.moderation')
      : onlyShownPosts(rows.is('archived_at', null)));
    // 6. postType and topic filters (topic=sports is its own lane, above)
    if (postType) query = query.eq('post_type', postType);
    if (topic) query = query.eq('topic', topic);
    // 7. tags filter
    if (tags?.length) query = query.overlaps('tags', tags);
    return query;
  };

  for (let round = 0; round < MAX_ROUNDS && accumulated.length < parsedLimit && !dbExhausted; round++) {
    let rawRows;
    if (surface === 'connections') {
      // Business posts reach a connection only through an explicit repost, not their writer (connectionRows).
      const read = {
        posts: () => surfacePosts().eq('is_pinned', connectionsPinned), authorIds, authorIdSet, upper: connectionsUpper,
      };
      let ordered;
      if (connectionsPinned) {
        ordered = await pinnedConnectionRows(read);
        connectionsPinned = false;
        connectionsUpper = null;
      } else {
        const { rows, floor } = await connectionRows({ ...read, batch: overFetchLimit });
        ordered = rows;
        connectionsUpper = floor && { at: floor };
        dbExhausted = !floor;
      }
      rawRows = ordered.map(({ row }) => row);
      for (const { row, reached } of ordered) reachedAtById.set(row.id, reached.at);
    } else {
      // 5. Build base query
      let query = surfacePosts()
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(overFetchLimit);

      // Distribution target filter
      if (surface === 'place') {
        query = query.contains('distribution_targets', ['place']);
      } else {
        query = query
          .in('identity_context_id', authorIds)
          .eq('identity_context_type', 'persona')
          .overlaps('distribution_targets', [distributionTarget]);
      }

      // Place bounding-box filter
      // Use OR to fall back to latitude/longitude when effective_* columns are NULL
      // (can happen if PostgREST schema cache is stale after migration 20260308130000)
      if (surface === 'place') {
        query = withoutOthersUnplacedPosts(query.or(
          `and(effective_latitude.gte.${box.south},effective_latitude.lte.${box.north},effective_longitude.gte.${box.west},effective_longitude.lte.${box.east}),` +
          `and(effective_latitude.is.null,latitude.gte.${box.south},latitude.lte.${box.north},longitude.gte.${box.west},longitude.lte.${box.east})`
        ), userId);
      }

      // Cursor pagination
      query = applyPinnedCursorCondition(query, loopCursorCreatedAt, loopCursorId, loopCursorPinned);

      const { data, error } = await query;
      if (error) {
        logger.error('Feed query failed', { error: error.message, userId, surface });
        throw new Error(`Feed query failed: ${error.message}`);
      }
      rawRows = data || [];
      if (rawRows.length < overFetchLimit) {
        dbExhausted = true;
      }
    }
    // Loaded once (filtersRead above) and reused across fetch iterations.
    const filters = await outcome(filtersRead);
    const filterPolitics = !filters.feedPreferences?.[politicsPrefKey(surface)];
    if (surface === 'connections') {
      for (const row of rawRows) repostsByPostId.set(row.id, row.connection_reposts || []);
    }

    // 8. Normalize
    // A connection's repost never grants access to its original audience.
    const readableRows = surface === 'connections' ? await readablePosts(rawRows, userId)
      : await withoutUnreadablePrivatePosts(rawRows, userId);
    const visibleRows = surface === 'personas'
      ? readableRows.filter((post) => personaPostVisibleToViewer(
          post, Number(personaRankById.get(post.identity_context_id) || 0),
        ))
      : readableRows;
    let posts = visibleRows.map(r => normalizeFeedPostRow(r, new Set(), new Set()));

    // 8b. Haversine distance filter for place surface (bounding box is a
    // square approximation; this removes posts outside the true radius).
    // Radius and distance use the point each post shows this viewer; a post
    // that shows no point can't be placed in the area, so it stays out.
    if (surface === 'place') {
      posts = posts.filter(p => {
        const point = displayedPoint(p, userId, { orEffective: true });
        if (!point) return false;
        const dist = haversineMeters(centerLat, centerLng, point.latitude, point.longitude);
        p.distance_meters = Math.round(dist);
        return dist <= radiusMeters;
      });
    }

    // 9. Mute / hide / block
    posts = applyMuteHideFilters(posts, filters, surface, userId);


    // 9b. Phase 1 Sports main-feed rule: national curator sports STAY OUT of
    // All surfaces. The user sees national sports content only inside the
    // Sports tab (topic='sports'). User-created sports and local utility
    // sports still flow through.
    if (topic !== 'sports') {
      posts = posts.filter(p => !(
        p.topic === 'sports'
        && p.origin === 'curator'
        && p.audience === 'national'
      ));
    }

    // 10. Politics filtering
    if (filterPolitics) {
      posts = posts.filter(p => !isPoliticsPost(p));
    }

    accumulated.push(...posts);

    // Advance cursor to the last raw row for the next round (Connections keeps its own, above)
    if (surface !== 'connections' && rawRows.length > 0) {
      const lastRaw = rawRows[rawRows.length - 1];
      loopCursorCreatedAt = lastRaw.created_at;
      loopCursorId = lastRaw.id;
      loopCursorPinned = !!lastRaw.is_pinned;
    }
  }

  // 11. Trim to limit. Query order already matches the display order:
  // pinned first, then newest-first within each pin bucket (Connections: by when each post reached the viewer).
  const hasMore = !dbExhausted || accumulated.length > parsedLimit;
  let posts = accumulated.slice(0, parsedLimit);

  // 12. Prepend global pins on the first page (no cursor = first page).
  // These bypass the surface, location and author filters, but not the read check or the
  // viewer's own blocks, mutes and hides (contract §0 and §5).
  if (isFirstPage) {
    const globalPins = await outcome(globalPinsRead);
    if (globalPins.length) {
      const readablePins = (await readablePosts(globalPins, userId)).map(r => normalizeFeedPostRow(r));
      const shownPins = applyMuteHideFilters(readablePins, await outcome(filtersRead), surface, userId);
      // Deduplicate — a global pin might also match the regular query
      const regularIds = new Set(posts.map(p => p.id));
      const uniquePins = shownPins.filter(p => !regularIds.has(p.id));
      posts = [...uniquePins, ...posts];
    }
  }

  // 13. Enrich with like/save status and typed public authors; Connections also names who reposted each post
  const [enriched, repostLines] = await Promise.all([
    enrichFeedPosts(posts, userId),
    surface === 'connections' ? repostedByLines(posts, repostsByPostId) : new Map(),
  ]);
  const shown = repostLines.size
    ? enriched.map((post) => (repostLines.has(post.id) ? { ...post, reposted_by: repostLines.get(post.id) } : post))
    : enriched;

  // 14–15. Build pagination and return. A Connections cursor carries when its post reached the viewer, which apps send
  // back unchanged as cursorCreatedAt.
  const lastPost = shown.length > 0 ? shown[shown.length - 1] : null;
  return {
    posts: shown,
    pagination: {
      nextCursor: lastPost ? { createdAt: reachedAtById.get(lastPost.id) || lastPost.created_at, id: lastPost.id } : null,
      hasMore,
    },
  };
}

// ---------------------------------------------------------------------------
// getSportsFeed — Sports topic lane (place + national union)
//
// Builds two underlying queries:
//   1) Local:    distribution_targets @> {place}   + geo box + topic=sports
//   2) National: distribution_targets @> {country:US} + topic=sports
// Merges them, computes rank_bucket per post from the ranking ladder, and
// orders by (rank_bucket ASC, created_at DESC, id DESC). Pagination is
// keyset on that triple: the cursor encodes (rankBucket, createdAt, id),
// so the next page starts strictly after the last returned row regardless
// of which underlying source the row came from.
// ---------------------------------------------------------------------------

// Posts older than this are skipped entirely in the sports lane — game
// threads, watch prompts, and playoff starters go stale fast.
const SPORTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Minimum comment count in the last 24h to qualify as an "active thread"
// for rank_bucket = 1.
const SPORTS_ACTIVE_THREAD_MIN_COMMENTS = 3;
const SPORTS_ACTIVE_THREAD_WINDOW_MS = 24 * 60 * 60 * 1000;
const SPORTS_FETCH_PAGE_LIMIT = 200;
const SPORTS_FETCH_MAX_ROWS_PER_SIDE = 5000;

/**
 * Compute the rank bucket (0 = best) for a sports post.
 * See the ranking ladder in the plan.
 */
function computeSportsRankBucket(post, ctx) {
  const {
    viewerLatitude,
    viewerLongitude,
    radiusMeters,
    activeEventKeys,
  } = ctx;

  const metadata = post.post_metadata || {};
  const scope = post.sports_scope || null;

  // distance_meters is measured to the point the post shows the viewer
  // (fetchSportsCandidates), so the ranking never tests the stored point.
  const withinRadius = viewerLatitude != null && viewerLongitude != null
    && post.distance_meters != null && post.distance_meters <= radiusMeters;

  // Bucket 0: Nearby user-created sports posts
  if (post.origin === 'user' && withinRadius) return 0;

  // Bucket 1: Active threads (high recent comment count)
  const commentWindowStart = Date.now() - SPORTS_ACTIVE_THREAD_WINDOW_MS;
  const createdMs = post.created_at ? new Date(post.created_at).getTime() : 0;
  if (
    createdMs >= commentWindowStart
    && (post.comment_count || 0) >= SPORTS_ACTIVE_THREAD_MIN_COMMENTS
  ) {
    return 1;
  }

  // Bucket 2: Local / regional team posts
  if (scope === 'local' || scope === 'regional') return 2;

  // Bucket 3: Active major-event posts
  if (metadata.event_key && activeEventKeys.has(metadata.event_key)) return 3;

  // Bucket 4: Watch / utility posts
  if (scope === 'watch' || metadata.is_watch_prompt === true) return 4;

  // Bucket 5: Seeded posts with zero engagement (fall-through)
  if (
    post.origin === 'curator'
    && (post.like_count || 0) + (post.comment_count || 0) === 0
  ) {
    return 5;
  }

  // Anything else falls into the last bucket so it still renders somewhere
  // in For You if it survived the mode/scope gates.
  return 5;
}

function isSportsFresh(post) {
  const freshUntil = post.post_metadata?.fresh_until;
  if (!freshUntil) return true;
  const deadline = new Date(freshUntil).getTime();
  if (!Number.isFinite(deadline)) return true;
  return Date.now() <= deadline;
}

function compareSportsTuple(a, b) {
  // Sort ASC by rank_bucket, DESC by created_at, DESC by id.
  if (a._rankBucket !== b._rankBucket) return a._rankBucket - b._rankBucket;
  const at = new Date(a.created_at).getTime();
  const bt = new Date(b.created_at).getTime();
  if (at !== bt) return bt - at; // newer first
  if (a.id < b.id) return 1;
  if (a.id > b.id) return -1;
  return 0;
}

async function fetchSportsCandidates({
  filters,
  surface,
  userId,
  localBox,
  localCenterLat,
  localCenterLng,
  includeLocal,
  includeNational,
  extraFilter, // optional row-level predicate
  pageLimit = SPORTS_FETCH_PAGE_LIMIT,
  maxRowsPerSide = SPORTS_FETCH_MAX_ROWS_PER_SIDE,
}) {
  const cutoffIso = new Date(Date.now() - SPORTS_MAX_AGE_MS).toISOString();
  const scopeAccess = await postScopeAccess(userId);
  // The local query reads a widened box; a local row counts when the point it
  // shows this viewer is inside localBox.
  const localQueryBox = localBox ? widenForDisplayedPoints(localBox) : null;

  async function fetchSide(kind) {
    const rows = [];
    let loopCursorCreatedAt = null;
    let loopCursorId = null;
    let exhausted = false;

    while (!exhausted && rows.length < maxRowsPerSide) {
      let query = scopeAccess.query(onlyShownPosts(supabaseAdmin
        .from('Post')
        .select(FEED_POST_SELECT)
        .is('archived_at', null)))
        .eq('topic', 'sports')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.min(pageLimit, maxRowsPerSide - rows.length));

      if (kind === 'local') {
        query = withoutOthersUnplacedPosts(query
          .contains('distribution_targets', ['place'])
          .or(
            `and(effective_latitude.gte.${localQueryBox.south},effective_latitude.lte.${localQueryBox.north},effective_longitude.gte.${localQueryBox.west},effective_longitude.lte.${localQueryBox.east}),`
            + `and(effective_latitude.is.null,latitude.gte.${localQueryBox.south},latitude.lte.${localQueryBox.north},longitude.gte.${localQueryBox.west},longitude.lte.${localQueryBox.east})`
          ), userId);
      } else {
        // National Sports content is platform-curated only. User-created
        // Sports posts can appear in local/social surfaces, never country-wide.
        query = query
          .eq('audience', 'national')
          .eq('origin', 'curator')
          .contains('distribution_targets', ['country:US']);
      }

      query = applyCursorCondition(query, loopCursorCreatedAt, loopCursorId);

      const { data, error } = await query;
      if (error) return { kind, data: rows, error };

      const pageRows = data || [];
      rows.push(...pageRows);
      if (pageRows.length < pageLimit) {
        exhausted = true;
      } else {
        const lastRaw = pageRows[pageRows.length - 1];
        loopCursorCreatedAt = lastRaw.created_at;
        loopCursorId = lastRaw.id;
      }
    }

    if (rows.length >= maxRowsPerSide) {
      logger.warn('Sports candidate scan hit per-side cap', { kind, maxRowsPerSide });
    }

    const shown = kind === 'local'
      ? rows.filter((row) => pointInBox(displayedPoint(row, userId, { orEffective: true }), localBox))
      : rows;
    return { kind, data: shown, error: null };
  }

  const tasks = [];
  if (includeLocal && localBox) tasks.push(fetchSide('local'));
  if (includeNational) tasks.push(fetchSide('national'));

  const results = await Promise.all(tasks);
  const seen = new Set();
  const merged = [];
  for (const r of results) {
    if (r.error) {
      logger.error('Sports query failed', { error: r.error.message, kind: r.kind });
      throw new Error(`Sports feed query failed: ${r.error.message}`);
    }
    for (const row of r.data || []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  }

  let posts = merged.map(row => normalizeFeedPostRow(row, new Set(), new Set()));

  // Distance bookkeeping for the local bucket scoring, to the point each post
  // shows this viewer.
  if (localCenterLat != null && localCenterLng != null) {
    posts.forEach(p => {
      const point = displayedPoint(p, userId, { orEffective: true });
      if (point) {
        p.distance_meters = Math.round(haversineMeters(localCenterLat, localCenterLng, point.latitude, point.longitude));
      }
    });
  }

  posts = applyMuteHideFilters(posts, filters, surface, userId);
  posts = posts.filter(isSportsFresh);
  if (extraFilter) posts = posts.filter(extraFilter);

  return posts;
}

async function getSportsFeed({
  userId,
  latitude,
  longitude,
  radiusMeters = 16000,
  sportsMode = 'for_you',
  eventKey = null,
  cursorCreatedAt = null,
  cursorId = null,
  cursorRankBucket = null,
  limit = 20,
}) {
  const parsedLimit = Number(limit) || 20;

  if (latitude == null || longitude == null) {
    return {
      posts: [],
      pagination: { nextCursor: null, hasMore: false },
      requiresViewingLocation: true,
      message: 'Set an area to see local posts.',
    };
  }

  const centerLat = parseFloat(latitude);
  const centerLng = parseFloat(longitude);
  const box = boundingBoxFromCenter(centerLat, centerLng, radiusMeters);

  const [activeEvents, filters] = await Promise.all([
    getActiveSportsEvents(),
    getMuteAndHideFilters(userId),
  ]);
  const activeEventKeys = new Set(activeEvents.map(e => e.event_key));
  const effectiveEventKey = eventKey || activeEvents[0]?.event_key || null;

  const filterPolitics = !filters.feedPreferences?.[politicsPrefKey('place')];

  // Mode shaping — determines which underlying queries to run and any
  // additional row-level predicate applied before bucket ranking.
  let includeLocal = true;
  let includeNational = true;
  let extraFilter = null;

  if (sportsMode === 'local') {
    includeNational = false;
  } else if (sportsMode === 'event') {
    // Event mode is national-first. If no active event exists at all, return
    // an empty result rather than silently falling back to For You.
    includeLocal = false;
    if (!effectiveEventKey) {
      return {
        posts: [],
        pagination: { nextCursor: null, hasMore: false },
        noActiveEvent: true,
      };
    }
    extraFilter = (p) => (p.post_metadata?.event_key === effectiveEventKey);
  } else if (sportsMode === 'watch') {
    extraFilter = (p) => (
      p.sports_scope === 'watch'
      || p.post_metadata?.is_watch_prompt === true
    );
  } else if (sportsMode !== 'for_you') {
    throw new Error(`Invalid sportsMode: ${sportsMode}`);
  }

  let candidates = await fetchSportsCandidates({
    filters,
    surface: 'place',
    userId,
    localBox: box,
    localCenterLat: centerLat,
    localCenterLng: centerLng,
    includeLocal,
    includeNational,
    extraFilter,
  });

  if (filterPolitics) {
    candidates = candidates.filter(p => !isPoliticsPost(p));
  }

  // For Local mode, enforce the true radius (the bounding box was a
  // square approximation), measured to the point each post shows this viewer.
  if (sportsMode === 'local') {
    candidates = candidates.filter(p => p.distance_meters != null && p.distance_meters <= radiusMeters);
  }

  const rankCtx = {
    viewerLatitude: centerLat,
    viewerLongitude: centerLng,
    radiusMeters,
    activeEventKeys,
  };

  for (const p of candidates) {
    p._rankBucket = computeSportsRankBucket(p, rankCtx);
  }

  candidates.sort(compareSportsTuple);

  // Keyset pagination on (rank_bucket, created_at, id): skip anything <= cursor tuple.
  if (cursorCreatedAt && cursorId && cursorRankBucket != null) {
    const cutoffTime = new Date(cursorCreatedAt).getTime();
    candidates = candidates.filter(p => {
      if (p._rankBucket !== cursorRankBucket) return p._rankBucket > cursorRankBucket;
      const pt = new Date(p.created_at).getTime();
      if (pt !== cutoffTime) return pt < cutoffTime;
      return p.id < cursorId;
    });
  }

  const page = candidates.slice(0, parsedLimit);
  const hasMore = candidates.length > parsedLimit;
  const enriched = await enrichFeedPosts(page, userId);

  // Strip internal scoring field before returning to caller.
  for (const p of enriched) delete p._rankBucket;

  const last = page[page.length - 1] || null;
  return {
    posts: enriched,
    pagination: {
      nextCursor: last
        ? {
          createdAt: last.created_at,
          id: last.id,
          rankBucket: last._rankBucket ?? computeSportsRankBucket(last, rankCtx),
        }
        : null,
      hasMore,
    },
    activeEventKey: effectiveEventKey,
  };
}

// ---------------------------------------------------------------------------
// getMapFeed
// ---------------------------------------------------------------------------

/**
 * The posts this viewer may see on the map that are displayed inside the
 * bounding box, newest first, each with its displayed point, not enriched.
 *
 * @returns {Promise<Array<{post: object, point: {latitude: number, longitude: number}}>>}
 */
async function loadMapPosts({
  userId,
  surface = 'place',
  south,
  west,
  north,
  east,
  postType,
  limit = 50,
}) {
  const normalizedSurface = FEED_SURFACES.includes(surface) ? surface : 'place';
  const scopeAccess = await postScopeAccess(userId);
  const queryLimit = Math.max(Number(limit) || 50, 1);
  // Connections also excludes muted or blocked reposters from its author graph.
  const filtersRead = settle(getMuteAndHideFilters(userId));

  // 1. Resolve author IDs and distribution target
  let authorIds = null;
  let distributionTarget = 'place';

  if (normalizedSurface === 'connections') {
    authorIds = await loadConnectionIds(userId);
    const filters = await outcome(filtersRead);
    authorIds = authorIds.filter(id => !filters.mutedUserIds.has(id) && !filters.blockedUserIds.has(id));
    distributionTarget = 'connections';
  }

  if (authorIds && authorIds.length === 0) {
    return [];
  }

  // 2. Build query with bounding box (fall back to latitude/longitude when effective_* is NULL).
  // Stored points are searched in the box widened by the most the location rule moves
  // a point; step 6 keeps the posts displayed inside the box itself, so which posts
  // come back follows the points the viewer sees, never the stored ones.
  const box = { south, west, north, east };
  const queryBox = widenForDisplayedPoints(box);
  let query = withoutOthersUnplacedPosts(scopeAccess.query(onlyShownPosts(supabaseAdmin
    .from('Post')
    .select(authorIds ? CONNECTION_POST_SELECT : FEED_POST_SELECT)
    .is('archived_at', null)))
    .or(
      `and(effective_latitude.gte.${queryBox.south},effective_latitude.lte.${queryBox.north},effective_longitude.gte.${queryBox.west},effective_longitude.lte.${queryBox.east}),` +
      `and(effective_latitude.is.null,latitude.gte.${queryBox.south},latitude.lte.${queryBox.north},longitude.gte.${queryBox.west},longitude.lte.${queryBox.east})`
    ), userId)
    .order('created_at', { ascending: false })
    .limit(queryLimit + 40);

  if (postType) query = query.eq('post_type', postType);
  query = authorIds ? connectionPostsQuery(query, authorIds)
    : query.overlaps('distribution_targets', [distributionTarget]);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load map posts: ${error.message}`);
  }

  // 3–4. Normalize and apply mute/hide/block
  const filters = await outcome(filtersRead);
  const readableRows = authorIds ? await readablePosts(data || [], userId)
    : await withoutUnreadablePrivatePosts(data || [], userId);
  let posts = applyMuteHideFilters(
    readableRows.map(row => normalizeFeedPostRow(row, new Set(), new Set())),
    filters,
    normalizedSurface,
    userId
  );

  // 5. Politics filtering
  if (!filters.feedPreferences?.[politicsPrefKey(normalizedSurface)]) {
    posts = posts.filter(p => !isPoliticsPost(p));
  }

  // 6. Keep the posts displayed inside the box (a post without a displayed point has no pin)
  const shown = posts
    .map(post => ({ post, point: displayedPoint(post, userId) }))
    .filter(({ point }) => pointInBox(point, box));

  // 7. Trim
  return shown.slice(0, queryLimit);
}

/**
 * Map-view feed query — posts displayed within a bounding box.
 *
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} [opts.surface]      – defaults to 'place'
 * @param {number} opts.south
 * @param {number} opts.west
 * @param {number} opts.north
 * @param {number} opts.east
 * @param {string} [opts.postType]
 * @param {number} [opts.limit]        – defaults to 50
 * @returns {Promise<object[]>}
 */
async function getMapFeed(opts) {
  // A Place map reads at most the cap around the box's center. (The empty-map hint below searches
  // wider, but it returns one displayed point, never a post.)
  const box = opts.surface === 'connections' ? {} : capPlaceBox(opts);
  const shown = await loadMapPosts({ ...opts, ...box });
  // 8. Enrich; this applies the response privacy, which puts each pin at its displayed point
  return enrichFeedPosts(shown.map(({ post }) => post), opts.userId);
}

// Half-sides, in degrees, of the widening boxes the empty-map hint searches:
// about 11, 110 and 1,100 km north to south, then anywhere.
const NEAREST_MAP_POST_HALF_SIDES = [0.1, 1, 10, 180];

/**
 * The empty-map hint: where this viewer's map shows the post nearest to a point,
 * among the posts their map would show (same surface, post type and filters),
 * measured to and returning the displayed point. null when none is near.
 *
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function findNearestMapPost({ userId, surface = 'place', postType, latitude, longitude }) {
  for (const half of NEAREST_MAP_POST_HALF_SIDES) {
    const shown = await loadMapPosts({
      userId,
      surface,
      postType,
      south: Math.max(latitude - half, -90),
      west: Math.max(longitude - half, -180),
      north: Math.min(latitude + half, 90),
      east: Math.min(longitude + half, 180),
    });
    let nearest = null;
    let nearestMeters = Infinity;
    for (const { point } of shown) {
      const meters = haversineMeters(latitude, longitude, point.latitude, point.longitude);
      if (meters < nearestMeters) {
        nearest = point;
        nearestMeters = meters;
      }
    }
    if (nearest) return nearest;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getListFeed,
  getMapFeed,
  findNearestMapPost,
  getSportsFeed,
  getActiveSportsEvents,
  // Exported for use by posts.js during migration (these still exist in posts.js too)
  normalizeMediaUrls,
  normalizeAlignedMediaUrls,
  normalizeFeedPostRow,
  attachIdentityAuthors,
  getMuteAndHideFilters,
  applyMuteHideFilters,
  enrichWithUserStatus,
  enrichFeedPosts,
  applyPostLocationPrivacy,
  sortMatchedBusinessesByRating,
  dropUnpublishedMatches,
  applyCursorCondition,
  buildCursorPagination,
  applyPinnedCursorCondition,
  isPoliticsPost,
  invalidateFilterCache,
  FEED_POST_SELECT,
  onlyShownPosts,
  // P0.3: legacy CREATOR_SELECT removed. Importers should pull
  // SAFE_CREATOR_SELECT directly from serializers/identitySerializers.
};

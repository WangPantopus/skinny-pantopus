/**
 * feedService.js — Unified feed query logic for list and map views.
 *
 * All feed surfaces (place, connections, personas) share the same
 * query pipeline: author resolution → post query → normalize →
 * mute/hide/block → politics filter → sort/trim → enrich.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { applyLocationPrecision, leastPrecise } = require('../utils/locationPrivacy');
const s3 = require('./s3Service');
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

const _filterCache = new Map(); // key: userId, value: { data, expires }
const FILTER_CACHE_TTL = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEED_SURFACES = ['place', 'connections', 'personas'];
const LOCAL_AUTHOR_USER_SELECT = 'id, username, name, first_name, middle_name, last_name, profile_picture_url, bio, verified, review_count, gigs_completed';

// ---------------------------------------------------------------------------
// Global pins — posts that appear at the top of every feed for every user,
// bypassing location and social-graph filters.
// Short TTL cache so the query doesn't run on every single feed request.
// ---------------------------------------------------------------------------

let _globalPinsCache = { data: null, expires: 0 };
const GLOBAL_PINS_TTL = 60_000; // 60 seconds

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

async function getGlobalPins() {
  const now = Date.now();
  if (_globalPinsCache.data && now < _globalPinsCache.expires) {
    return _globalPinsCache.data;
  }

  const { data, error } = await supabaseAdmin
    .from('Post')
    .select(FEED_POST_SELECT)
    .eq('is_global_pin', true)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error('Failed to fetch global pins', { error: error.message });
    return [];
  }

  const pins = (data || []).map(r => normalizeFeedPostRow(r));
  _globalPinsCache = { data: pins, expires: now + GLOBAL_PINS_TTL };
  return pins;
}

// P0.3: SAFE_CREATOR_SELECT only pulls audience-safe columns (no name,
// first_name, last_name, city, state). Routes that need to render an author
// project the resulting `creator` row through serializeUserAsLocalIdentity
// (see attachIdentityAuthors below) so the firewall is enforced at the API
// boundary regardless of what the underlying SQL row contains.
const FEED_POST_SELECT = `
  id, user_id, author_user_id, identity_context_type, identity_context_id,
  title, content, media_urls, media_types, media_thumbnails, media_live_urls, post_type, post_format,
  visibility, visibility_scope, location_precision, tags,
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
  creator:user_id (${SAFE_CREATOR_SELECT}),
  business_author:business_author_id (${SAFE_CREATOR_SELECT}),
  home:home_id (id, address, city)
`;

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
    // P0.3: project the raw User row through the serializer wall so the
    // legacy `creator` slot never carries User.name / city / state to a
    // client even if a callsite skips attachIdentityAuthors.
    creator: row.creator ? serializeUserAsLocalIdentity(row.creator) : null,
    author: row.author || null,
    home: row.home || null,
  };
}

function applyPostLocationPrivacy(post, viewerUserId) {
  if (!post) return post;

  const isAuthor = post.user_id === viewerUserId;
  const effectivePrecision = isAuthor
    ? (post.location_precision || 'approx_area')
    : leastPrecise(post.location_precision || 'approx_area', 'approx_area');

  applyLocationPrecision(post, effectivePrecision, isAuthor);

  if (!isAuthor) {
    post.locationUnlocked = false;
    if (post.home) {
      post.home = {
        ...post.home,
        address: null,
      };
    }
  }

  return post;
}

function applyPostLocationPrivacyBatch(posts, viewerUserId) {
  return posts.map((post) => applyPostLocationPrivacy(post, viewerUserId));
}

// ---------------------------------------------------------------------------
// Mute / hide / block filters
// ---------------------------------------------------------------------------

async function getMuteAndHideFilters(userId) {
  const cached = _filterCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const [
    { data: mutes },
    { data: hides },
    { data: blocks },
    { data: personaBlocks },
    { data: feedPrefs },
  ] = await Promise.all([
    supabaseAdmin.from('PostMute').select('muted_entity_id, muted_entity_type, surface').eq('user_id', userId),
    supabaseAdmin.from('PostHide').select('post_id').eq('user_id', userId),
    supabaseAdmin.from('Relationship')
      .select('requester_id, addressee_id')
      .eq('status', 'blocked')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabaseAdmin.from('PersonaBlock').select('persona_id').eq('blocked_user_id', userId),
    supabaseAdmin.from('UserFeedPreference').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const blockedUserIds = new Set();
  if (blocks) {
    for (const b of blocks) {
      if (b.requester_id === userId) blockedUserIds.add(b.addressee_id);
      else blockedUserIds.add(b.requester_id);
    }
  }

  // Build surface-scoped topic mute sets
  const topicMutes = (mutes || []).filter(m => m.muted_entity_type === 'topic');
  const globalMutedTopics = new Set(topicMutes.filter(m => !m.surface).map(m => m.muted_entity_id));
  const mutedTopicsBySurface = new Map();
  for (const m of topicMutes) {
    if (m.surface) {
      if (!mutedTopicsBySurface.has(m.surface)) mutedTopicsBySurface.set(m.surface, new Set());
      mutedTopicsBySurface.get(m.surface).add(m.muted_entity_id);
    }
  }

  const result = {
    mutedUserIds: new Set((mutes || []).filter(m => m.muted_entity_type === 'user').map(m => m.muted_entity_id)),
    mutedBusinessIds: new Set((mutes || []).filter(m => m.muted_entity_type === 'business').map(m => m.muted_entity_id)),
    hiddenPostIds: new Set((hides || []).map(h => h.post_id)),
    blockedUserIds,
    blockedPersonaIds: new Set((personaBlocks || []).map(block => block.persona_id).filter(Boolean)),
    globalMutedTopics,
    mutedTopicsBySurface,
    feedPreferences: feedPrefs || {
      hide_deals_place: false, hide_alerts_place: false,
      show_politics_connections: false, show_politics_place: false,
    },
  };

  _filterCache.set(userId, { data: result, expires: Date.now() + FILTER_CACHE_TTL });
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

// NOTE: This function applies location privacy via applyPostLocationPrivacy.
// Callers should NOT also call applyPostLocationPrivacy/applyPostLocationPrivacyBatch.
async function enrichWithUserStatus(posts, userId) {
  if (!posts.length) return posts;
  const postIds = posts.map(p => p.id);
  const [{ data: likes }, { data: saves }, { data: reposts }] = await Promise.all([
    supabaseAdmin.from('PostLike').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabaseAdmin.from('PostSave').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabaseAdmin.from('PostShare').select('post_id').eq('user_id', userId).eq('share_type', 'repost').in('post_id', postIds),
  ]);
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

function redactPrivateIdentityFields(post, author) {
  if (!author) return post;

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

async function attachIdentityAuthors(posts, viewerUserId) {
  if (!posts.length) return posts;

  const personaIds = [...new Set(posts
    .filter(p => p.identity_context_type === 'persona' && p.identity_context_id)
    .map(p => p.identity_context_id))];
  const localUserIds = [...new Set(posts
    .filter(p => !p.identity_context_type || p.identity_context_type === 'local' || p.post_as === 'personal')
    .map(p => p.author_user_id || p.user_id)
    .filter(Boolean))];

  const [personaResult, localResult, localUserResult] = await Promise.all([
    personaIds.length
      ? supabaseAdmin.from('PublicPersona').select('*').in('id', personaIds)
      : Promise.resolve({ data: [] }),
    localUserIds.length
      ? supabaseAdmin.from('LocalProfile').select('*').in('user_id', localUserIds)
      : Promise.resolve({ data: [] }),
    localUserIds.length
      ? supabaseAdmin.from('User').select(LOCAL_AUTHOR_USER_SELECT).in('id', localUserIds)
      : Promise.resolve({ data: [] }),
  ]);

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
    } else if (post.identity_context_type === 'business' || post.post_as === 'business') {
      author = serializeBusinessSeatForViewer({
        id: post.business_id || post.business_author?.id || post.identity_context_id || 'business',
        display_name: post.business_author?.name || post.business_author?.username || 'Business',
        display_avatar_url: post.business_author?.profile_picture_url || null,
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

    const publicPost = redactPrivateIdentityFields(post, author);

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

// ---------------------------------------------------------------------------
// Politics filter
// ---------------------------------------------------------------------------

function isPoliticsPost(post) {
  return (post.tags || []).some(t => ['politics', 'political'].includes(t.toLowerCase()))
    || (post.purpose === 'story' && (post.tags || []).includes('politics'));
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
 * @param {number} [opts.radiusMeters] – defaults to 16 000 m
 * @param {string} [opts.postType]
 * @param {string} [opts.cursorCreatedAt]
 * @param {string} [opts.cursorId]
 * @param {number} [opts.limit]        – defaults to 20
 * @param {string[]} [opts.tags]
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
}) {
  // 1. Validate surface
  if (!FEED_SURFACES.includes(surface)) {
    throw new Error(`Invalid feed surface: ${surface}`);
  }

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
    if (!authorIds.length) {
      return { posts: [], pagination: { nextCursor: null, hasMore: false }, emptyGraph: true };
    }
  }

  // Pre-compute filters once and reuse across fetch iterations
  const filters = await getMuteAndHideFilters(userId);
  const filterPolitics = !filters.feedPreferences?.[politicsPrefKey(surface)];

  // Pre-compute bounding box and center for place surface
  let box, centerLat, centerLng;
  if (surface === 'place') {
    centerLat = parseFloat(latitude);
    centerLng = parseFloat(longitude);
    box = boundingBoxFromCenter(centerLat, centerLng, radiusMeters);
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

  for (let round = 0; round < MAX_ROUNDS && accumulated.length < parsedLimit && !dbExhausted; round++) {
    // 5. Build base query
    let query = supabaseAdmin
      .from('Post')
      .select(FEED_POST_SELECT)
      .is('archived_at', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(overFetchLimit);

    // Distribution target filter
    if (surface === 'place') {
      query = query.contains('distribution_targets', ['place']);
    } else if (surface === 'personas') {
      query = query
        .in('identity_context_id', authorIds)
        .eq('identity_context_type', 'persona')
        .overlaps('distribution_targets', [distributionTarget]);
    } else {
      query = query
        .in('user_id', authorIds)
        .overlaps('distribution_targets', [distributionTarget]);
    }

    // Place bounding-box filter
    // Use OR to fall back to latitude/longitude when effective_* columns are NULL
    // (can happen if PostgREST schema cache is stale after migration 20260308130000)
    if (surface === 'place') {
      query = query.or(
        `and(effective_latitude.gte.${box.south},effective_latitude.lte.${box.north},effective_longitude.gte.${box.west},effective_longitude.lte.${box.east}),` +
        `and(effective_latitude.is.null,latitude.gte.${box.south},latitude.lte.${box.north},longitude.gte.${box.west},longitude.lte.${box.east})`
      );
    }

    // 6. postType filter
    if (postType) query = query.eq('post_type', postType);

    // 7. tags filter
    if (tags?.length) query = query.overlaps('tags', tags);

    // Cursor pagination
    query = applyPinnedCursorCondition(query, loopCursorCreatedAt, loopCursorId, loopCursorPinned);

    const { data, error } = await query;
    if (error) {
      logger.error('Feed query failed', { error: error.message, userId, surface });
      throw new Error(`Feed query failed: ${error.message}`);
    }

    const rawRows = data || [];
    if (rawRows.length < overFetchLimit) {
      dbExhausted = true;
    }

    // 8. Normalize
    let posts = rawRows.map(r => normalizeFeedPostRow(r, new Set(), new Set()));

    // 8b. Haversine distance filter for place surface (bounding box is a
    // square approximation; this removes posts outside the true radius)
    if (surface === 'place') {
      posts = posts.filter(p => {
        const lat = p.latitude ?? p.effective_latitude;
        const lng = p.longitude ?? p.effective_longitude;
        if (lat == null || lng == null) return true;
        const dist = haversineMeters(centerLat, centerLng, lat, lng);
        p.distance_meters = Math.round(dist);
        return dist <= radiusMeters;
      });
    }

    // 9. Mute / hide / block
    posts = applyMuteHideFilters(posts, filters, surface, userId);

    if (surface === 'personas') {
      posts = posts.filter((post) => {
        const requiredRank = Number(post.target_tier_rank || 0);
        if (!requiredRank) return true;
        return Number(personaRankById.get(post.identity_context_id) || 0) >= requiredRank;
      });
    }

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

    // Advance cursor to the last raw row for the next round
    if (rawRows.length > 0) {
      const lastRaw = rawRows[rawRows.length - 1];
      loopCursorCreatedAt = lastRaw.created_at;
      loopCursorId = lastRaw.id;
      loopCursorPinned = !!lastRaw.is_pinned;
    }
  }

  // 11. Trim to limit. Query order already matches the display order:
  // pinned first, then newest-first within each pin bucket.
  const hasMore = !dbExhausted || accumulated.length > parsedLimit;
  let posts = accumulated.slice(0, parsedLimit);

  // 12. Prepend global pins on the first page (no cursor = first page).
  // These bypass all surface/location/author filters.
  const isFirstPage = !cursorCreatedAt && !cursorId;
  if (isFirstPage) {
    const globalPins = await getGlobalPins();
    if (globalPins.length) {
      // Deduplicate — a global pin might also match the regular query
      const regularIds = new Set(posts.map(p => p.id));
      const uniquePins = globalPins.filter(p => !regularIds.has(p.id));
      posts = [...uniquePins, ...posts];
    }
  }

  // 13. Enrich with like/save status and typed public authors
  const enriched = await attachIdentityAuthors(await enrichWithUserStatus(posts, userId), userId);

  // 14–15. Build pagination and return
  const lastPost = enriched.length > 0 ? enriched[enriched.length - 1] : null;
  return {
    posts: enriched,
    pagination: {
      nextCursor: lastPost ? { createdAt: lastPost.created_at, id: lastPost.id } : null,
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
  const lat = post.latitude ?? post.effective_latitude;
  const lng = post.longitude ?? post.effective_longitude;

  const withinRadius = (() => {
    if (viewerLatitude == null || viewerLongitude == null) return false;
    if (lat == null || lng == null) return false;
    const d = haversineMeters(viewerLatitude, viewerLongitude, lat, lng);
    return d <= radiusMeters;
  })();

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

  async function fetchSide(kind) {
    const rows = [];
    let loopCursorCreatedAt = null;
    let loopCursorId = null;
    let exhausted = false;

    while (!exhausted && rows.length < maxRowsPerSide) {
      let query = supabaseAdmin
        .from('Post')
        .select(FEED_POST_SELECT)
        .is('archived_at', null)
        .eq('topic', 'sports')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.min(pageLimit, maxRowsPerSide - rows.length));

      if (kind === 'local') {
        query = query
          .contains('distribution_targets', ['place'])
          .or(
            `and(effective_latitude.gte.${localBox.south},effective_latitude.lte.${localBox.north},effective_longitude.gte.${localBox.west},effective_longitude.lte.${localBox.east}),`
            + `and(effective_latitude.is.null,latitude.gte.${localBox.south},latitude.lte.${localBox.north},longitude.gte.${localBox.west},longitude.lte.${localBox.east})`
          );
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

    return { kind, data: rows, error: null };
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

  // Distance bookkeeping for the local bucket scoring.
  if (localCenterLat != null && localCenterLng != null) {
    posts.forEach(p => {
      const lat = p.latitude ?? p.effective_latitude;
      const lng = p.longitude ?? p.effective_longitude;
      if (lat != null && lng != null) {
        p.distance_meters = Math.round(haversineMeters(localCenterLat, localCenterLng, lat, lng));
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

  const activeEvents = await getActiveSportsEvents();
  const activeEventKeys = new Set(activeEvents.map(e => e.event_key));
  const effectiveEventKey = eventKey || activeEvents[0]?.event_key || null;

  const filters = await getMuteAndHideFilters(userId);
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
  // square approximation).
  if (sportsMode === 'local') {
    candidates = candidates.filter(p => {
      const lat = p.latitude ?? p.effective_latitude;
      const lng = p.longitude ?? p.effective_longitude;
      if (lat == null || lng == null) return false;
      const d = haversineMeters(centerLat, centerLng, lat, lng);
      return d <= radiusMeters;
    });
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
  const enriched = await attachIdentityAuthors(await enrichWithUserStatus(page, userId), userId);

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
 * Map-view feed query — posts within a bounding box.
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
async function getMapFeed({
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
  const queryLimit = Math.max(Number(limit) || 50, 1);

  // 1. Resolve author IDs and distribution target
  let authorIds = null;
  let distributionTarget = 'place';

  if (normalizedSurface === 'connections') {
    authorIds = await loadConnectionIds(userId);
    distributionTarget = 'connections';
  }

  if (authorIds && authorIds.length === 0) {
    return [];
  }

  // 2. Build query with bounding box (fall back to latitude/longitude when effective_* is NULL)
  let query = supabaseAdmin
    .from('Post')
    .select(FEED_POST_SELECT)
    .is('archived_at', null)
    .or(
      `and(effective_latitude.gte.${south},effective_latitude.lte.${north},effective_longitude.gte.${west},effective_longitude.lte.${east}),` +
      `and(effective_latitude.is.null,latitude.gte.${south},latitude.lte.${north},longitude.gte.${west},longitude.lte.${east})`
    )
    .overlaps('distribution_targets', [distributionTarget])
    .order('created_at', { ascending: false })
    .limit(queryLimit + 40);

  if (postType) query = query.eq('post_type', postType);
  if (authorIds) query = query.in('user_id', authorIds);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load map posts: ${error.message}`);
  }

  // 3–4. Normalize and apply mute/hide/block
  const filters = await getMuteAndHideFilters(userId);
  let posts = applyMuteHideFilters(
    (data || []).map(row => normalizeFeedPostRow(row, new Set(), new Set())),
    filters,
    normalizedSurface,
    userId
  );

  // 5. Politics filtering
  if (!filters.feedPreferences?.[politicsPrefKey(normalizedSurface)]) {
    posts = posts.filter(p => !isPoliticsPost(p));
  }

  // 6. Trim
  posts = posts.slice(0, queryLimit);

  // 7. Apply response privacy before the map route formats layer rows.
  posts = applyPostLocationPrivacyBatch(posts, userId);

  // 8. Enrich
  return attachIdentityAuthors(await enrichWithUserStatus(posts, userId), userId);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getListFeed,
  getMapFeed,
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
  applyPostLocationPrivacy,
  applyPostLocationPrivacyBatch,
  applyCursorCondition,
  buildCursorPagination,
  applyPinnedCursorCondition,
  isPoliticsPost,
  invalidateFilterCache,
  FEED_POST_SELECT,
  // P0.3: legacy CREATOR_SELECT removed. Importers should pull
  // SAFE_CREATOR_SELECT directly from serializers/identitySerializers.
};

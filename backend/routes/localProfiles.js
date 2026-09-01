const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const {
  ensureLocalProfile,
  getLocalProfileByHandle,
  getActivePersonaForUser,
  getBridgeSetting,
  normalizeHandle,
} = require('../utils/identityProfiles');
const {
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializePostAuthorForViewer,
} = require('../serializers/identitySerializers');
const { applyLocationPrecision, leastPrecise } = require('../utils/locationPrivacy');
const { requireIdentityFirewallEnabled } = require('../utils/featureFlags');
const { isSearchable, isScopedBlocked } = require('../utils/visibilityPolicy');

router.use(requireIdentityFirewallEnabled);

const LOCAL_ACTIVITY_POST_SELECT = [
  'id',
  'user_id',
  'author_user_id',
  'identity_context_type',
  'identity_context_id',
  'title',
  'content',
  'media_urls',
  'media_types',
  'media_thumbnails',
  'media_live_urls',
  'post_type',
  'post_format',
  'visibility',
  'visibility_scope',
  'location_precision',
  'tags',
  'like_count',
  'comment_count',
  'share_count',
  'save_count',
  'is_pinned',
  'is_global_pin',
  'is_edited',
  'created_at',
  'updated_at',
  'latitude',
  'longitude',
  'location_name',
  'location_address',
  'post_as',
  'audience',
  'distribution_targets',
  'resolved_at',
  'archived_at',
  'is_story',
  'story_expires_at',
  'event_date',
  'event_end_date',
  'event_venue',
  'purpose',
  'show_on_profile',
  'profile_visibility_scope',
  'state',
  'topic',
  'post_metadata',
  'origin',
].join(', ');

const LOCAL_PROFILE_PUBLIC_POST_FIELDS = [
  'id',
  'title',
  'content',
  'media_urls',
  'media_types',
  'media_thumbnails',
  'media_live_urls',
  'post_type',
  'post_format',
  'visibility',
  'visibility_scope',
  'location_precision',
  'tags',
  'like_count',
  'comment_count',
  'share_count',
  'save_count',
  'is_pinned',
  'is_global_pin',
  'is_edited',
  'created_at',
  'updated_at',
  'location_name',
  'post_as',
  'audience',
  'distribution_targets',
  'resolved_at',
  'is_story',
  'story_expires_at',
  'event_date',
  'event_end_date',
  'event_venue',
  'purpose',
  'profile_visibility_scope',
  'state',
  'topic',
  'post_metadata',
  'origin',
];

const RAW_IDENTITY_RECORD_FIELDS = [
  'user_id',
  'owner_id',
  'poster_id',
  'author_user_id',
  'created_by',
  'beneficiary_user_id',
  'accepted_by',
  'creator',
  'owner',
  'poster',
  'author',
  'user',
  'acceptedBy',
  'accepted_by_user',
  'User',
];

const PRIVATE_LOCATION_RECORD_FIELDS = [
  'home_id',
  'home',
  'location_address',
  'exact_address',
  'address',
  'street_address',
  'pickup_address',
  'dropoff_address',
  'service_address',
  'gps_timestamp',
  'gps_latitude',
  'gps_longitude',
];

const FORBIDDEN_PUBLIC_METADATA_KEY = /(^|_)(user|author|actor|owner|email|phone|address|home|legal|private|token|session|ip)(_|$)/i;

function parseLimit(value, fallback = 20, max = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function sanitizePublicMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (FORBIDDEN_PUBLIC_METADATA_KEY.test(key)) return false;
      return value == null || ['string', 'number', 'boolean'].includes(typeof value);
    })
  );
}

async function getLocalProfileViewerContext(profile, viewerId) {
  const isOwner = !!viewerId && viewerId === profile.user_id;
  if (!viewerId || isOwner) {
    return {
      viewerId: viewerId || null,
      isOwner,
      isConnection: false,
    };
  }

  const { data: connectionResult } = await supabaseAdmin
    .from('Relationship')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${profile.user_id}),and(requester_id.eq.${profile.user_id},addressee_id.eq.${viewerId})`)
    .maybeSingle();

  return {
    viewerId,
    isOwner: false,
    isConnection: !!connectionResult,
  };
}

async function canViewLocalProfile(profile, context) {
  if (!profile?.user_id) return false;
  if (profile.deleted_at || profile.archived_at) return false;
  if (profile.status && profile.status !== 'active' && !context.isOwner) return false;
  if (context.isOwner) return true;

  const searchVisibility = profile.search_visibility || 'everyone';
  if (searchVisibility === 'nobody') return false;
  if (searchVisibility === 'mutuals' && !context.isConnection) return false;

  if (!(await isSearchable(context.viewerId, profile.user_id))) return false;
  if (context.viewerId && await isScopedBlocked(context.viewerId, profile.user_id, 'search_only')) return false;

  const profileVisibility = profile.profile_visibility || 'public';
  if (profileVisibility === 'private') return false;
  if (profileVisibility === 'connections') return context.isConnection;
  // Legacy 'followers' value is treated as 'connections' after peer-follow
  // removal — narrow to connections rather than expanding the audience.
  if (profileVisibility === 'followers') return context.isConnection;
  return true;
}

async function resolveViewableLocalProfile(handle, viewerId) {
  const profile = await getLocalProfileByHandle(handle);
  if (!profile) return { errorStatus: 404, error: 'Local profile not found' };
  const viewerContext = await getLocalProfileViewerContext(profile, viewerId);
  if (!(await canViewLocalProfile(profile, viewerContext))) {
    return { errorStatus: 404, error: 'Local profile not found' };
  }
  return { profile, viewerContext };
}

async function getLocalProfileBridgePersona(profile) {
  const persona = await getActivePersonaForUser(profile.user_id);
  if (!persona) return null;
  const bridge = await getBridgeSetting(profile.user_id, persona.id);
  if (!bridge?.show_persona_on_local) return null;
  return serializeAudienceProfileForViewer(persona);
}

function isNetworkOnlyTarget(target) {
  return ['connections', 'persona_followers', 'household'].includes(target);
}

function canShowOnLocalProfile(post, context) {
  if (!post) return false;
  if ((post.identity_context_type || 'local') === 'persona' || post.post_as === 'persona') return false;
  if (post.archived_at) return false;

  if (context.isOwner) return true;

  if (post.show_on_profile !== true) return false;
  const scope = post.profile_visibility_scope || 'public';
  if (scope === 'hidden') return false;
  // Legacy 'followers' scope is treated as 'connections' after peer-follow removal.
  if (scope === 'followers' && !context.isConnection) return false;
  if (scope === 'connections' && !context.isConnection) return false;

  if (post.audience === 'household' || post.visibility === 'household') return false;

  const targets = Array.isArray(post.distribution_targets)
    ? post.distribution_targets.filter(Boolean)
    : [];

  if (targets.includes('persona_followers') || targets.includes('household')) return false;

  if (targets.length > 0 && targets.every(isNetworkOnlyTarget)) {
    return targets.includes('connections') && context.isConnection;
  }

  if ((post.visibility === 'followers' || post.audience === 'followers') && !context.isConnection) return false;
  if ((post.visibility === 'connections' || post.audience === 'connections') && !context.isConnection) return false;

  return true;
}

function serializeLocalProfilePostForViewer(post, profile, viewerUserId) {
  const isOwner = !!viewerUserId && viewerUserId === profile.user_id;
  const locationSafePost = { ...post };
  const precision = isOwner
    ? (locationSafePost.location_precision || 'approx_area')
    : leastPrecise(locationSafePost.location_precision || 'approx_area', 'approx_area');
  applyLocationPrecision(locationSafePost, precision, isOwner);

  const safe = {};
  for (const field of LOCAL_PROFILE_PUBLIC_POST_FIELDS) {
    safe[field] = locationSafePost[field] ?? null;
  }
  safe.post_metadata = sanitizePublicMetadata(locationSafePost.post_metadata);

  safe.latitude = locationSafePost.latitude ?? null;
  safe.longitude = locationSafePost.longitude ?? null;
  safe.location_precision = precision;
  safe.locationUnlocked = !!locationSafePost.locationUnlocked;
  if (isOwner && locationSafePost.locationUnlocked) {
    safe.location_address = locationSafePost.location_address || null;
  }

  const author = serializePostAuthorForViewer({
    ...locationSafePost,
    local_profile: profile,
  });

  // P0.4 follow-up: the legacy `creator` slot used to fabricate a
  // {username, name, profile_picture_url} shape. New code reads
  // post.author. The creator slot now mirrors author with the new keys
  // (handle / displayName / avatarUrl); legacy aliases are gone.
  return {
    ...safe,
    author,
    creator: author ? {
      type: author.type,
      id: profile.id,
      handle: author.handle || null,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl || null,
    } : null,
  };
}

function serializeLocalOwnedRecord(record, profile, authorField = 'author', viewerUserId = null) {
  if (!record) return null;
  const isOwner = !!viewerUserId && viewerUserId === profile.user_id;
  const locationSafeRecord = { ...record };
  const precision = isOwner
    ? (locationSafeRecord.location_precision || 'approx_area')
    : leastPrecise(locationSafeRecord.location_precision || 'approx_area', 'approx_area');
  applyLocationPrecision(locationSafeRecord, precision, isOwner);

  const safe = { ...locationSafeRecord };
  for (const field of RAW_IDENTITY_RECORD_FIELDS) {
    delete safe[field];
  }
  for (const field of PRIVATE_LOCATION_RECORD_FIELDS) {
    delete safe[field];
  }
  safe.location_precision = precision;
  safe.locationUnlocked = !!locationSafeRecord.locationUnlocked;
  if (safe.metadata) safe.metadata = sanitizePublicMetadata(safe.metadata);
  if (safe.post_metadata) safe.post_metadata = sanitizePublicMetadata(safe.post_metadata);

  const author = serializePostAuthorForViewer({
    ...record,
    local_profile: profile,
  });
  return {
    ...safe,
    local_profile_id: profile.id,
    [authorField]: author,
  };
}

const updateLocalProfileSchema = Joi.object({
  handle: Joi.string().trim().min(3).max(40).pattern(/^[a-zA-Z0-9_.-]+$/).optional(),
  display_name: Joi.string().trim().min(1).max(100).optional(),
  avatar_url: Joi.string().uri().allow('', null).optional(),
  bio: Joi.string().max(1000).allow('', null).optional(),
  tagline: Joi.string().max(160).allow('', null).optional(),
  public_city: Joi.string().max(120).allow('', null).optional(),
  public_state: Joi.string().max(80).allow('', null).optional(),
  public_neighborhood: Joi.string().max(120).allow('', null).optional(),
  show_verified_resident_badge: Joi.boolean().optional(),
  show_home_affiliation: Joi.boolean().optional(),
  show_neighborhood: Joi.boolean().optional(),
  show_gig_history: Joi.boolean().optional(),
  profile_visibility: Joi.string().valid('public', 'followers', 'connections', 'private').optional(),
  search_visibility: Joi.string().valid('everyone', 'mutuals', 'nobody').optional(),
}).min(1);

router.get('/me', verifyToken, async (req, res) => {
  try {
    const profile = await ensureLocalProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Local profile not found' });
    res.json({ profile: serializeLocalProfileForViewer(profile, { includeLegacyUserId: true }) });
  } catch (err) {
    logger.error('localProfiles.me.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/me', verifyToken, validate(updateLocalProfileSchema), async (req, res) => {
  try {
    const existing = await ensureLocalProfile(req.user.id);
    if (!existing) return res.status(404).json({ error: 'Local profile not found' });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    if (updates.handle) updates.handle_normalized = normalizeHandle(updates.handle);

    const { data: profile, error } = await supabaseAdmin
      .from('LocalProfile')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      logger.error('localProfiles.patch.error', { error: error.message, userId: req.user.id });
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ profile: serializeLocalProfileForViewer(profile, { includeLegacyUserId: true }) });
  } catch (err) {
    logger.error('localProfiles.patch.exception', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/:handle', optionalAuth, async (req, res) => {
  try {
    const { profile, errorStatus, error: resolveError } = await resolveViewableLocalProfile(req.params.handle, req.user?.id || null);
    if (errorStatus) return res.status(errorStatus).json({ error: resolveError });
    const bridgePersona = await getLocalProfileBridgePersona(profile);

    res.json({
      profile: serializeLocalProfileForViewer(profile, {
        includeLegacyUserId: !!req.user && req.user.id === profile.user_id,
        bridgePersona,
      }),
    });
  } catch (err) {
    logger.error('localProfiles.get.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.get('/:handle/activity', optionalAuth, async (req, res) => {
  try {
    const { profile, viewerContext, errorStatus, error: resolveError } = await resolveViewableLocalProfile(req.params.handle, req.user?.id || null);
    if (errorStatus) return res.status(errorStatus).json({ error: resolveError });

    const { data: posts, error } = await supabaseAdmin
      .from('Post')
      .select(LOCAL_ACTIVITY_POST_SELECT)
      .eq('user_id', profile.user_id)
      .eq('show_on_profile', true)
      .not('profile_visibility_scope', 'eq', 'hidden')
      .order('created_at', { ascending: false })
      .limit(parseLimit(req.query.limit));

    if (error) return res.status(500).json({ error: 'Failed to load local activity' });
    res.json({
      posts: (posts || [])
        .filter((post) => canShowOnLocalProfile(post, viewerContext))
        .map((post) => serializeLocalProfilePostForViewer(post, profile, req.user?.id || null)),
    });
  } catch (err) {
    logger.error('localProfiles.activity.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load local activity' });
  }
});

router.get('/:handle/gigs', optionalAuth, async (req, res) => {
  try {
    const { profile, errorStatus, error: resolveError } = await resolveViewableLocalProfile(req.params.handle, req.user?.id || null);
    if (errorStatus) return res.status(errorStatus).json({ error: resolveError });
    if (profile.show_gig_history === false) return res.json({ gigs: [] });

    const { data, error } = await supabaseAdmin
      .from('Gig')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(Number(req.query.limit) || 20);

    if (error) return res.status(500).json({ error: 'Failed to load local gigs' });
    res.json({ gigs: (data || []).map((gig) => serializeLocalOwnedRecord(gig, profile, 'author', req.user?.id || null)) });
  } catch (err) {
    logger.error('localProfiles.gigs.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load local gigs' });
  }
});

router.get('/:handle/listings', optionalAuth, async (req, res) => {
  try {
    const { profile, errorStatus, error: resolveError } = await resolveViewableLocalProfile(req.params.handle, req.user?.id || null);
    if (errorStatus) return res.status(errorStatus).json({ error: resolveError });

    const { data, error } = await supabaseAdmin
      .from('Listing')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(Number(req.query.limit) || 20);

    if (error) return res.status(500).json({ error: 'Failed to load local listings' });
    res.json({ listings: (data || []).map((listing) => serializeLocalOwnedRecord(listing, profile, 'author', req.user?.id || null)) });
  } catch (err) {
    logger.error('localProfiles.listings.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load local listings' });
  }
});

module.exports = router;

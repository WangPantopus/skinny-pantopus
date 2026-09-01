const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { broadcastPublishLimiter } = require('../middleware/rateLimiter');
const { isFanBlockedFromPersona } = require('../services/personaBlockService');
const { runPostCreatedHooks } = require('../services/postCreationHooksService');
const { requirePersonaBroadcastEnabled } = require('../utils/featureFlags');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const { getPersonaById, getPersonaFollow, getViewerTierRankForPersona } = require('../utils/identityProfiles');
const { serializeAudienceProfileForViewer } = require('../serializers/identitySerializers');

router.use(requirePersonaBroadcastEnabled);

// P1.10 — visibility now supports tier_or_above with target_tier_rank.
// 'subscribers' is kept as a transitional alias for legacy callers
// (existing identityFirewallPrivacy tests + any external client) and
// is normalized server-side into tier_or_above rank=2 before insert.
const createBroadcastMessageSchema = Joi.object({
  body: Joi.string().max(5000).allow('', null),
  media: Joi.array().items(Joi.object().unknown(true)).max(10).default([]),
  visibility: Joi.string()
    .valid('public', 'followers', 'tier_or_above', 'subscribers')
    .default('followers'),
  target_tier_rank: Joi.number().integer().min(1).max(4).when('visibility', {
    is: 'tier_or_above',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  // Explicit place tag (Instagram-style) picked in the Beacon composer.
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  // trim() so a whitespace-only name can't satisfy the hasPlaceTag check
  // below and write venue coords with a blank display name.
  location_name: Joi.string().trim().max(255).allow('', null)
    .optional(),
  location_address: Joi.string().trim().max(500).allow('', null)
    .optional(),
  place_id: Joi.string().max(255).optional(),
}).custom((value, helpers) => {
  if (!value.body && (!Array.isArray(value.media) || value.media.length === 0)) {
    return helpers.error('any.custom', { message: 'Broadcast message needs text or media.' });
  }
  if ((value.latitude != null) !== (value.longitude != null)) {
    return helpers.error('any.custom', { message: 'latitude and longitude must both be provided together' });
  }
  return value;
});

// Locked-broadcast preview: when a viewer's tier rank is below the
// broadcast's target_tier_rank, the list still includes the row so the
// fan can see "you're missing N member-only updates" — but the body,
// media, and analytics are stripped. Audience-profile §11.3.
const LOCKED_TEASER_LENGTH = 60;

async function getChannel(channelId) {
  const { data } = await supabaseAdmin
    .from('BroadcastChannel')
    .select('*')
    .eq('id', channelId)
    .maybeSingle();
  return data || null;
}

async function canReadChannel(channel, viewerId) {
  if (!channel) return false;
  const persona = await getPersonaById(channel.persona_id);
  if (!persona || persona.status === 'suspended') return false;
  if (persona.user_id === viewerId) return true;
  if (viewerId && await isFanBlockedFromPersona(persona.id, viewerId)) return false;
  return true;
}

// Translate broadcast visibility + viewer's tier rank → read decision.
// viewerRank: 0 = anonymous, 1 = Follower, 2 = Member, 3 = Insider, 4 = Direct/owner.
function viewerCanReadBroadcast(message, persona, viewerRank, viewerId) {
  if (!message || !persona) return false;
  if (persona.user_id === viewerId) return true;
  if (message.visibility === 'public') return true;
  if (viewerRank < 1) return false;
  if (message.visibility === 'followers') return true;
  // Treat the legacy 'subscribers' value as tier_or_above rank=2.
  if (message.visibility === 'subscribers') return viewerRank >= 2;
  if (message.visibility === 'tier_or_above') {
    const required = Number(message.target_tier_rank || 1);
    return viewerRank >= required;
  }
  return false;
}

// Backwards-compat shim — old callers pass a `follow` object. Some
// existing tests (broadcastChannels.read endpoint) rely on the old
// (message, persona, follow, viewerId) signature; map it through the
// new viewerRank-based logic.
function canReadBroadcastMessage(message, persona, follow, viewerId) {
  let viewerRank = 0;
  if (persona && persona.user_id === viewerId) {
    viewerRank = 4;
  } else if (follow?.status === 'active') {
    viewerRank = follow.relationship_type === 'subscriber' ? 2 : 1;
  }
  return viewerCanReadBroadcast(message, persona, viewerRank, viewerId);
}

function mediaUrlsFromBroadcastMedia(media) {
  return broadcastMediaItemsFromPayload(media).map((item) => item.url);
}

function normalizeBroadcastMediaType(type) {
  if (!type) return null;
  const value = String(type).toLowerCase();
  if (value === 'live_photo' || value === 'image' || value === 'video') return value;
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  return value;
}

function inferBroadcastMediaTypeFromUrl(url) {
  if (/\.(mp4|mov|m4v|webm)(?:\?|$)/i.test(String(url || ''))) return 'video';
  return 'image';
}

function broadcastMediaItemsFromPayload(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((item) => {
      const url = typeof item === 'string'
        ? item
        : item?.url || item?.uri || item?.src || item?.path || null;
      if (!url) return null;
      const explicitType = typeof item === 'object' && item
        ? item.type || item.media_type || item.mimeType || item.mime_type || null
        : null;
      const liveUrl = typeof item === 'object' && item
        ? item.liveVideoUrl || item.live_video_url || item.media_live_url || item.liveUrl || ''
        : '';
      return {
        url,
        type: normalizeBroadcastMediaType(explicitType) || inferBroadcastMediaTypeFromUrl(url),
        liveUrl,
      };
    })
    .filter(Boolean);
}

function mediaTypesFromBroadcastMedia(media) {
  return broadcastMediaItemsFromPayload(media).map((item) => item.type);
}

function mediaLiveUrlsFromBroadcastMedia(media) {
  return broadcastMediaItemsFromPayload(media).map((item) => item.liveUrl || '');
}

function mediaThumbnailsFromBroadcastMedia(media) {
  return broadcastMediaItemsFromPayload(media).map((item) => item.thumbnailUrl || '');
}

function mediaFromPost(post) {
  const urls = Array.isArray(post?.media_urls) ? post.media_urls : [];
  const types = Array.isArray(post?.media_types) ? post.media_types : [];
  const thumbnails = Array.isArray(post?.media_thumbnails) ? post.media_thumbnails : [];
  const liveUrls = Array.isArray(post?.media_live_urls) ? post.media_live_urls : [];
  if (urls.length > 0) {
    return urls.map((url, index) => {
      const item = { url };
      const type = normalizeBroadcastMediaType(types[index]);
      const thumbnailUrl = thumbnails[index];
      const liveVideoUrl = liveUrls[index];
      if (type) item.type = type;
      if (thumbnailUrl) item.thumbnailUrl = thumbnailUrl;
      if (liveVideoUrl) item.liveVideoUrl = liveVideoUrl;
      return item;
    });
  }
  const metadataMedia = post?.post_metadata?.broadcast_media;
  if (Array.isArray(metadataMedia)) {
    return metadataMedia.filter((item) => {
      if (typeof item === 'string') return item.trim().length > 0;
      if (!item || typeof item !== 'object') return false;
      return Boolean(item.url || item.uri || item.src || item.path);
    });
  }
  return urls.map((url, index) => {
    const type = types[index] || null;
    return type ? { url, type } : { url };
  });
}

function broadcastVisibilityFromPost(post) {
  const metadataVisibility = post?.post_metadata?.broadcast_visibility;
  if (metadataVisibility === 'subscribers') return 'tier_or_above';
  if (metadataVisibility === 'tier_or_above') return 'tier_or_above';
  if (Number(post?.target_tier_rank || 0) > 0) return 'tier_or_above';
  return post?.visibility === 'public' || post?.audience === 'public' ? 'public' : 'followers';
}

function serializeBroadcastMessage(message) {
  if (!message) return null;
  if (message.identity_context_type === 'persona' || message.broadcast_channel_id) {
    const visibility = broadcastVisibilityFromPost(message);
    return {
      id: message.id,
      channel_id: message.broadcast_channel_id || message.channel_id || null,
      persona_id: message.identity_context_id || message.persona_id || null,
      body: message.content ?? message.body ?? null,
      media: mediaFromPost(message),
      visibility,
      target_tier_rank: visibility === 'tier_or_above'
        ? Number(message.target_tier_rank || message.post_metadata?.target_tier_rank || 1)
        : null,
      status: message.archived_at ? 'archived' : (message.post_metadata?.broadcast_status || 'published'),
      // Explicit place tag (Beacon-profile broadcast history renders it;
      // the personas feed reuses the Pulse projection instead).
      location_name: message.location_name || null,
      location_address: message.location_address || null,
      published_at: message.created_at || message.published_at || null,
      created_at: message.created_at || message.published_at || null,
      updated_at: message.updated_at || message.created_at || null,
      delivered_count: Number(message.delivered_count || 0),
      read_count: Number(message.read_count || 0),
    };
  }
  const { author_user_id: _authorUserId, ...safe } = message;
  return safe;
}

function serializeChannelBroadcastMessage(row, channelId) {
  const message = serializeBroadcastMessage(row);
  if (message && !message.channel_id && channelId) {
    message.channel_id = channelId;
  }
  return message;
}

// Locked variant: identifies the message + the tier required to unlock,
// but strips body, media, delivered/read counts. Used in the fan list
// when a broadcast is above the viewer's rank.
function serializeLockedBroadcast(message) {
  if (!message) return null;
  const required = Number(message.target_tier_rank || (message.visibility === 'subscribers' ? 2 : 1));
  const teaser = (() => {
    const raw = message.body == null ? '' : String(message.body);
    if (raw.length <= LOCKED_TEASER_LENGTH) return raw;
    return raw.slice(0, LOCKED_TEASER_LENGTH).trimEnd() + '…';
  })();
  return {
    id: message.id,
    channel_id: message.channel_id,
    persona_id: message.persona_id,
    visibility: message.visibility === 'subscribers' ? 'tier_or_above' : message.visibility,
    target_tier_rank: required,
    locked: true,
    teaser,
    published_at: message.published_at || null,
    created_at: message.created_at,
  };
}

function serializeBroadcastChannel(channel) {
  if (!channel) return null;
  return {
    id: channel.id,
    title: channel.title,
    description: channel.description || null,
    status: channel.status,
    created_at: channel.created_at || null,
    updated_at: channel.updated_at || null,
  };
}

// Compute notification recipients for a broadcast. visibility/targetRank
// pair determines which active memberships qualify:
//   * public / followers      → every active fan opted in to notifications.
//   * tier_or_above N         → fans whose tier rank >= N (or legacy
//                                relationship_type = 'subscriber' for
//                                untagged paid members).
//   * subscribers (legacy)    → equivalent to tier_or_above 2.
async function getBroadcastNotificationRecipientIds(persona, visibility, targetRank = null) {
  const { data, error } = await supabaseAdmin
    .from('PersonaMembership')
    .select('user_id, relationship_type, notification_level, tier_id')
    .eq('persona_id', persona.id)
    .in('status', ['active', 'past_due'])
    .neq('notification_level', 'none');
  if (error) {
    logger.warn('broadcast.notification_recipients.error', { error: error.message, personaId: persona.id });
    return [];
  }

  let memberships = data || [];
  const tierGated = visibility === 'tier_or_above' || visibility === 'subscribers';
  if (tierGated) {
    const requiredRank = visibility === 'tier_or_above'
      ? Number(targetRank || 1)
      : 2; // legacy 'subscribers'
    const tierIds = [...new Set(memberships.map((membership) => membership.tier_id).filter(Boolean))];
    let rankByTierId = new Map();
    if (tierIds.length) {
      const { data: tiers, error: tierError } = await supabaseAdmin
        .from('PersonaTier')
        .select('id, rank')
        .in('id', tierIds);
      if (tierError) {
        logger.warn('broadcast.notification_recipients.tier_error', { error: tierError.message, personaId: persona.id });
      } else {
        rankByTierId = new Map((tiers || []).map((tier) => [tier.id, Number(tier.rank || 0)]));
      }
    }
    memberships = memberships.filter((membership) => {
      const rank = Number(rankByTierId.get(membership.tier_id) || 0);
      if (rank >= requiredRank) return true;
      // Legacy fallback: pre-tier rows tagged relationship_type =
      // 'subscriber' qualify for the historical 'subscribers' visibility
      // and for new Member+ broadcasts while they are being migrated onto
      // explicit PersonaTier rows.
      if (requiredRank <= 2 && membership.relationship_type === 'subscriber') {
        return true;
      }
      return false;
    });
  }

  return [...new Set(memberships
    .map((membership) => membership.user_id)
    .filter((userId) => userId && userId !== persona.user_id))];
}

router.get('/channels/:channelId/messages', optionalAuth, async (req, res) => {
  try {
    const channel = await getChannel(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Updates not found' });
    const canRead = await canReadChannel(channel, req.user?.id || null);
    if (!canRead) return res.status(403).json({ error: 'You cannot view these updates' });

    const persona = await getPersonaById(channel.persona_id);
    const follow = await getPersonaFollow(channel.persona_id, req.user?.id || null);
    const viewerId = req.user?.id || null;
    const isOwner = persona?.user_id === viewerId;

    // P1.10 — viewer's effective tier rank drives both the visible-rows
    // filter AND the locked-preview projection. Owner short-circuits to
    // 4 (max). Anonymous viewers compute as 0 inside the helper.
    let viewerRank = isOwner
      ? 4
      : await getViewerTierRankForPersona(channel.persona_id, viewerId);
    // Legacy compat: pre-tier-ladder rows tagged relationship_type
    // = 'subscriber' carried implicit paid-subscriber semantics. Bump
    // their effective rank to at least 2 so the legacy 'subscribers'
    // and tier_or_above-rank-2 broadcasts remain visible after the
    // P1.10 rank-based filter.
    if (!isOwner && follow?.relationship_type === 'subscriber' && viewerRank < 2) {
      viewerRank = 2;
    }

    const requestedLimit = Number(req.query.limit) || 50;
    let postQuery = supabaseAdmin
      .from('Post')
      .select('*')
      .eq('broadcast_channel_id', channel.id)
      .eq('identity_context_type', 'persona')
      .eq('identity_context_id', channel.persona_id)
      .order('created_at', { ascending: false })
      .limit(requestedLimit);
    if (!isOwner) postQuery = postQuery.is('archived_at', null);

    let legacyQuery = supabaseAdmin
      .from('BroadcastMessage')
      .select('*')
      .eq('channel_id', channel.id)
      .order('published_at', { ascending: false })
      .limit(requestedLimit);
    if (!isOwner) legacyQuery = legacyQuery.eq('status', 'published');

    const ownerPersonaPostQuery = isOwner
      ? supabaseAdmin
        .from('Post')
        .select('*')
        .eq('identity_context_type', 'persona')
        .eq('identity_context_id', channel.persona_id)
        .eq('user_id', persona.user_id)
        .order('created_at', { ascending: false })
        .limit(requestedLimit)
      : Promise.resolve({ data: [], error: null });

    const [
      { data: postRows, error: postError },
      { data: ownerPersonaPostRows, error: ownerPersonaPostError },
      { data: legacyRows, error: legacyError },
    ] = await Promise.all([
      postQuery,
      ownerPersonaPostQuery,
      legacyQuery,
    ]);

    if (postError || ownerPersonaPostError || legacyError) {
      return res.status(500).json({ error: 'Failed to load broadcast messages' });
    }

    // Owner sees every message in full. Other viewers see:
    //   * Public broadcasts → full body.
    //   * Followers / tier broadcasts at or below their rank → full body.
    //   * Tier broadcasts ABOVE their rank → locked teaser (id, visibility,
    //     target_tier_rank, teaser, locked: true) so the fan can see what
    //     they're missing without leaking the body or media.
    //   * Anonymous viewers below rank 1 → tier broadcasts hide entirely
    //     (showing a "join to unlock" teaser to a logged-out visitor would
    //     just be confusing; followers-only broadcasts also hide).
    const postBackedMessages = [];
    const seenPostIds = new Set();
    for (const row of [...(postRows || []), ...(ownerPersonaPostRows || [])]) {
      if (!row?.id || seenPostIds.has(row.id)) continue;
      seenPostIds.add(row.id);
      postBackedMessages.push(serializeChannelBroadcastMessage(row, channel.id));
    }
    const postBackedIds = new Set(postBackedMessages.map((message) => message.id));
    const legacyMessages = (legacyRows || [])
      .filter((message) => !postBackedIds.has(message.id))
      .map(serializeBroadcastMessage);
    const allMessages = [...postBackedMessages, ...legacyMessages]
      .filter((message) => message.status === 'published' || isOwner)
      .sort((a, b) => {
        const at = new Date(a.published_at || a.created_at || 0).getTime();
        const bt = new Date(b.published_at || b.created_at || 0).getTime();
        if (at !== bt) return bt - at;
        return String(b.id).localeCompare(String(a.id));
      })
      .slice(0, requestedLimit);

    const messages = allMessages.flatMap((message) => {
      if (viewerCanReadBroadcast(message, persona, viewerRank, viewerId)) {
        return [message];
      }
      const isTierGated = message.visibility === 'tier_or_above'
        || message.visibility === 'subscribers';
      if (!isTierGated) return [];                   // followers-only, viewer not following
      if (viewerRank < 1) return [];                 // anonymous → no teaser
      return [serializeLockedBroadcast(message)];
    });

    const analytics = isOwner
      ? messages.reduce((acc, message) => ({
          deliveredCount: acc.deliveredCount + Number(message.delivered_count || 0),
          readCount: acc.readCount + Number(message.read_count || 0),
        }), { deliveredCount: 0, readCount: 0 })
      : null;
    res.json({
      channel: serializeBroadcastChannel(channel),
      persona: serializeAudienceProfileForViewer(persona, {
        isOwner,
        isFollowing: follow?.status === 'active',
        followStatus: follow?.status || 'none',
      }),
      messages,
      analytics,
      viewer: { tierRank: viewerRank },
    });
  } catch (err) {
    logger.error('broadcast.messages.error', { error: err.message, channelId: req.params.channelId });
    res.status(500).json({ error: 'Failed to load broadcast messages' });
  }
});

router.post('/channels/:channelId/messages', verifyToken, broadcastPublishLimiter, validate(createBroadcastMessageSchema), async (req, res) => {
  try {
    const channel = await getChannel(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Updates not found' });

    const persona = await getPersonaById(channel.persona_id);
    if (!persona || persona.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the Beacon owner can publish broadcast messages' });
    }

    // P1.10 — resolve visibility + target_tier_rank. tier_or_above
    // requires a valid rank that exists on the persona; missing or
    // unknown ranks return 400 so the composer surfaces the error
    // instead of silently writing an unreachable row.
    const incomingVisibility = req.body.visibility || 'followers';
    const incomingRank = req.body.target_tier_rank == null
      ? null
      : Number(req.body.target_tier_rank);

    let visibility = incomingVisibility === 'subscribers'
      ? 'tier_or_above'
      : incomingVisibility;
    let targetTierRank = incomingVisibility === 'subscribers' ? 2 : null;
    if (visibility === 'tier_or_above') {
      if (incomingVisibility !== 'subscribers' && (!incomingRank || incomingRank < 1 || incomingRank > 4)) {
        return res.status(400).json({
          error: 'target_tier_rank is required for tier_or_above broadcasts (1-4).',
          code: 'invalid_target_tier_rank',
        });
      }
      if (incomingVisibility !== 'subscribers') {
        targetTierRank = incomingRank;
      }
      const { data: tier } = await supabaseAdmin
        .from('PersonaTier')
        .select('id, rank, status')
        .eq('persona_id', persona.id)
        .eq('rank', targetTierRank)
        .maybeSingle();
      if (!tier) {
        return res.status(400).json({
          error: `Tier rank ${targetTierRank} is not configured for this Beacon.`,
          code: 'unknown_target_tier_rank',
        });
      }
    }

    const recipientUserIds = await getBroadcastNotificationRecipientIds(
      persona, visibility, targetTierRank,
    );
    const media = req.body.media || [];
    const postVisibility = visibility === 'public' ? 'public' : 'followers';
    const postAudience = visibility === 'public' ? 'public' : 'followers';
    const now = new Date().toISOString();
    // Explicit place tag: an explicitly picked venue is intentional public
    // disclosure (like an Instagram place tag), so it may be written here.
    // Identity-linking (home_id/target_place_id/radius_miles) and GPS
    // attestation (gps_*) fields are NEVER written on Beacon posts — auto
    // GPS/home context is not intentional disclosure and a Beacon must
    // never leak the author's home or live GPS fix.
    const hasPlaceTag = req.body.latitude != null
      && req.body.longitude != null
      && !!req.body.location_name;
    const { data: message, error } = await supabaseAdmin
      .from('Post')
      .insert({
        user_id: req.user.id,
        author_user_id: req.user.id,
        identity_context_type: 'persona',
        identity_context_id: persona.id,
        content: req.body.body || '',
        media_urls: mediaUrlsFromBroadcastMedia(media),
        media_types: mediaTypesFromBroadcastMedia(media),
        media_thumbnails: mediaThumbnailsFromBroadcastMedia(media),
        media_live_urls: mediaLiveUrlsFromBroadcastMedia(media),
        post_type: 'personal_update',
        post_format: 'standard',
        visibility: postVisibility,
        visibility_scope: 'global',
        location_precision: hasPlaceTag ? 'approx_area' : 'none',
        tags: [],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
        post_as: 'persona',
        audience: postAudience,
        distribution_targets: visibility === 'public'
          ? ['public', 'persona_followers']
          : ['persona_followers'],
        purpose: null,
        show_on_profile: true,
        profile_visibility_scope: postVisibility,
        is_visitor_post: false,
        state: 'open',
        post_metadata: {
          source: 'broadcast_composer',
          broadcast_visibility: visibility,
          broadcast_status: 'published',
          broadcast_media: media,
        },
        origin: 'user',
        home_id: null,
        latitude: hasPlaceTag ? req.body.latitude : null,
        longitude: hasPlaceTag ? req.body.longitude : null,
        effective_latitude: hasPlaceTag ? req.body.latitude : null,
        effective_longitude: hasPlaceTag ? req.body.longitude : null,
        location_name: hasPlaceTag ? req.body.location_name : null,
        location_address: hasPlaceTag ? (req.body.location_address || null) : null,
        ...(hasPlaceTag ? {
          geocode_provider: 'mapbox',
          geocode_mode: 'temporary',
          geocode_place_id: req.body.place_id || null,
          geocode_source_flow: 'broadcast_publish',
          geocode_created_at: now,
        } : {}),
        target_place_id: null,
        radius_miles: null,
        archived_at: null,
        broadcast_channel_id: channel.id,
        target_tier_rank: targetTierRank,
        delivered_count: recipientUserIds.length,
        read_count: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to publish broadcast message' });
    const broadcastMessage = serializeBroadcastMessage(message);
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: persona.user_id,
      personaId: persona.id,
      action: 'persona.broadcast_published',
      targetType: 'Post',
      targetId: message.id,
      metadata: {
        channel_id: channel.id,
        visibility: broadcastMessage.visibility,
        body_length: broadcastMessage.body ? broadcastMessage.body.length : 0,
        media_count: Array.isArray(broadcastMessage.media) ? broadcastMessage.media.length : 0,
      },
    });
    await runPostCreatedHooks({
      post: message,
      userId: req.user.id,
      personaContext: persona,
      targets: message.distribution_targets || [],
      recipientUserIds,
      notificationMode: 'persona_broadcast',
      defer: false,
      broadcast: {
        messageId: message.id,
        visibility: broadcastMessage.visibility,
        bodyPreview: broadcastMessage.body || '',
      },
    });
    res.status(201).json({ message: broadcastMessage });
  } catch (err) {
    logger.error('broadcast.publish.error', { error: err.message, channelId: req.params.channelId, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to publish broadcast message' });
  }
});

router.post('/messages/:messageId/read', verifyToken, async (req, res) => {
  try {
    const { data: postMessage, error: postError } = await supabaseAdmin
      .from('Post')
      .select('*')
      .eq('id', req.params.messageId)
      .eq('identity_context_type', 'persona')
      .maybeSingle();
    if (postError) return res.status(500).json({ error: 'Failed to load broadcast message' });

    let message = postMessage ? serializeBroadcastMessage(postMessage) : null;
    let source = postMessage ? 'Post' : 'BroadcastMessage';

    if (!message) {
      const { data: legacyMessage, error } = await supabaseAdmin
        .from('BroadcastMessage')
        .select('*')
        .eq('id', req.params.messageId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: 'Failed to load broadcast message' });
      message = legacyMessage ? serializeBroadcastMessage(legacyMessage) : null;
    }
    if (!message) return res.status(404).json({ error: 'Broadcast message not found' });

    const channel = await getChannel(message.channel_id);
    const persona = await getPersonaById(message.persona_id);
    if (!channel || !persona) return res.status(404).json({ error: 'Broadcast message not found' });
    if (persona.user_id === req.user.id) {
      return res.json({ message });
    }
    if (await isFanBlockedFromPersona(persona.id, req.user.id)) {
      return res.status(403).json({ error: 'You cannot view this broadcast message' });
    }

    const follow = await getPersonaFollow(persona.id, req.user.id);
    let viewerRank = await getViewerTierRankForPersona(persona.id, req.user.id);
    if (follow?.relationship_type === 'subscriber' && viewerRank < 2) viewerRank = 2;
    const canRead = viewerCanReadBroadcast(message, persona, viewerRank, req.user.id);
    if (!canRead) return res.status(403).json({ error: 'You cannot view this broadcast message' });

    const updatePayload = {
      read_count: Number(message.read_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };
    if (source === 'Post') {
      updatePayload.view_count = Number(postMessage.view_count || 0) + 1;
    }
    const { data: updated, error: updateError } = await supabaseAdmin
      .from(source)
      .update(updatePayload)
      .eq('id', message.id)
      .select()
      .single();
    if (updateError) return res.status(500).json({ error: 'Failed to mark broadcast as read' });

    res.json({ message: serializeBroadcastMessage(updated) });
  } catch (err) {
    logger.error('broadcast.read.error', { error: err.message, messageId: req.params.messageId, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to mark broadcast as read' });
  }
});

module.exports = router;

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { personaFollowLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../services/notificationService');
const { isFeatureEnabled } = require('../services/featureFlagService');
const { requirePersonaEnabled } = require('../utils/featureFlags');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const {
  LOW_RISK_PERSONA_CATEGORIES,
  SENSITIVE_PERSONA_CATEGORY_POLICIES,
  assertPersonaCategoryEnabled,
  getPersonaCategoryPolicies,
} = require('../utils/personaCompliance');
const {
  normalizeHandle,
  getActivePersonaForUser,
  getPersonaByHandle,
  getPersonaById,
  getPersonaMembershipForUser,
  getPersonaFollow,
  getViewerTierRankForPersona,
  getBridgeSetting,
  ensureLocalProfile,
  generateUniqueAudienceHandle,
  getAudienceIdentityForUser,
  canEditAudienceIdentityForHandshake,
  getOrCreateAudienceIdentityForUser,
  syncAudienceIdentityFromPersona,
  audienceIdentityMembershipPayload,
  serializeAudienceIdentity,
  projectMembershipAsLegacyFollow,
} = require('../utils/identityProfiles');
const {
  serializeAudienceProfileForViewer,
  serializeLocalProfileForViewer,
  serializePostAuthorForViewer,
  serializeFollowingRow,
  serializeFanForCreator,
  sanitizePersonaPostForViewer,
} = require('../serializers/identitySerializers');

router.use(requirePersonaEnabled);

const publicLinkSchema = Joi.object({
  label: Joi.string().max(60).required(),
  url: Joi.string().uri().required(),
});

const personaSchemaFields = {
  handle: Joi.string().trim().min(3).max(40).pattern(/^[a-zA-Z0-9_.-]+$/),
  display_name: Joi.string().trim().min(1).max(100),
  avatar_url: Joi.string().uri().allow('', null).optional(),
  banner_url: Joi.string().uri().allow('', null).optional(),
  bio: Joi.string().max(1500).allow('', null).optional(),
  public_links: Joi.array().items(publicLinkSchema).max(8),
  category: Joi.string().valid(...LOW_RISK_PERSONA_CATEGORIES, ...Object.keys(SENSITIVE_PERSONA_CATEGORY_POLICIES)),
  audience_label: Joi.string().valid('followers', 'students', 'patients', 'clients', 'customers', 'subscribers', 'members'),
  audience_mode: Joi.string().valid('open', 'approval_required', 'invite_only', 'organization_managed'),
};

const createPersonaSchema = Joi.object({
  ...personaSchemaFields,
  handle: personaSchemaFields.handle.required(),
  display_name: personaSchemaFields.display_name.required(),
  public_links: personaSchemaFields.public_links.default([]),
  category: personaSchemaFields.category.default('creator'),
  audience_label: personaSchemaFields.audience_label.default('followers'),
  audience_mode: personaSchemaFields.audience_mode.default('open'),
});

const updatePersonaSchema = Joi.object({
  ...personaSchemaFields,
  handle: personaSchemaFields.handle.optional(),
  display_name: personaSchemaFields.display_name.optional(),
  public_links: personaSchemaFields.public_links.optional(),
  category: personaSchemaFields.category.optional(),
  audience_label: personaSchemaFields.audience_label.optional(),
  audience_mode: personaSchemaFields.audience_mode.optional(),
}).min(1);

const notificationPreferenceSchema = Joi.object({
  notification_level: Joi.string().valid('all', 'highlights', 'none').required(),
});

// PATCH /me/following/:personaId/mute body — `days: null` clears the mute,
// `days: <integer>` sets it. Max 365 prevents accidental "forever" mutes
// (use unfollow for that). Min 1 because <1 day rounding is ambiguous.
const muteFollowingSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).allow(null).required(),
});

const followingSortValues = ['activity', 'recent', 'alpha', 'unread'];

const audienceSortValues = ['recent', 'tenure', 'tier', 'alpha'];
const AUDIENCE_VISIBLE_STATUSES = ['pending', 'active', 'muted', 'past_due', 'paused', 'canceled_pending'];

const audienceMemberActionSchema = Joi.object({
  action: Joi.string().valid('approve', 'decline', 'remove', 'mute', 'unmute').required(),
});

const ownerFollowerUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'active', 'muted', 'blocked', 'removed').optional(),
  relationship_type: Joi.string().valid('follower', 'patient', 'student', 'client', 'customer', 'subscriber', 'member').optional(),
  notification_level: Joi.string().valid('all', 'highlights', 'none').optional(),
}).min(1);

const AUDIENCE_LABEL_RELATIONSHIP_TYPE = {
  followers: 'follower',
  students: 'student',
  patients: 'patient',
  clients: 'client',
  customers: 'customer',
  subscribers: 'subscriber',
  members: 'member',
};

function defaultRelationshipTypeForPersona(persona) {
  return AUDIENCE_LABEL_RELATIONSHIP_TYPE[persona?.audience_label] || 'follower';
}

function personaPostVisibleToViewer(post, viewerRank = 0) {
  if (!post) return false;
  if (post.archived_at || post.status === 'removed') return false;
  if (post.audience === 'public' || post.visibility === 'public') return true;
  const requiredRank = Number(post.target_tier_rank || 0);
  if (requiredRank > 0) return viewerRank >= requiredRank;
  const targets = Array.isArray(post.distribution_targets) ? post.distribution_targets : [];
  const followerOnly = post.audience === 'followers'
    || post.visibility === 'followers'
    || targets.includes('persona_followers');
  return viewerRank >= 1 && followerOnly;
}

async function ensureBroadcastChannel(persona) {
  const { data: existing } = await supabaseAdmin
    .from('BroadcastChannel')
    .select('*')
    .eq('persona_id', persona.id)
    .maybeSingle();
  if (existing) return existing;

  const { data } = await supabaseAdmin
    .from('BroadcastChannel')
    .insert({
      persona_id: persona.id,
      title: `${persona.display_name || persona.handle} Broadcast`,
      status: 'active',
    })
    .select()
    .single();
  return data || null;
}

async function getBroadcastChannelForPersona(personaId) {
  const { data } = await supabaseAdmin
    .from('BroadcastChannel')
    .select('*')
    .eq('persona_id', personaId)
    .maybeSingle();
  return data || null;
}

function isUniqueViolation(error) {
  if (!error) return false;
  if (String(error.code || '') === '23505') return true;
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return message.includes('duplicate key') || details.includes('duplicate key');
}

function isPersonaHandleConflict(error) {
  if (!isUniqueViolation(error)) return false;
  const text = [
    error.message,
    error.details,
    error.hint,
    error.constraint,
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes('handle_normalized') || text.includes('publicpersona_handle_normalized');
}

function isActivePersonaConflict(error) {
  if (!isUniqueViolation(error)) return false;
  const text = [
    error.message,
    error.details,
    error.hint,
    error.constraint,
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes('one_active_per_user') || text.includes('user_id');
}

async function personaViewerOptions(persona, viewerId) {
  const follow = await getPersonaFollow(persona.id, viewerId);
  let bridgeLocalProfile = null;
  const bridge = await getBridgeSetting(persona.user_id, persona.id);
  if (bridge?.show_local_on_persona) {
    const local = await ensureLocalProfile(persona.user_id);
    bridgeLocalProfile = serializeLocalProfileForViewer(local);
  }
  return {
    isFollowing: follow?.status === 'active',
    relationshipType: follow?.relationship_type || null,
    notificationLevel: follow?.notification_level || 'none',
    followStatus: follow?.status || 'none',
    isOwner: viewerId === persona.user_id,
    bridgeLocalProfile,
  };
}

async function getOwnedPersona(personaId, ownerUserId) {
  const persona = await getPersonaById(personaId);
  if (!persona) return { persona: null, errorStatus: 404, error: 'Beacon not found' };
  if (persona.user_id !== ownerUserId) return { persona, errorStatus: 403, error: 'You cannot manage this Beacon' };
  return { persona };
}

function serializePersonaFollowForOwner(follow, localProfile) {
  if (!follow) return null;
  return {
    id: follow.id,
    status: follow.status,
    relationshipType: follow.relationship_type || 'follower',
    notificationLevel: follow.notification_level || 'none',
    publicVisibility: follow.public_visibility || 'private',
    source: follow.source || null,
    approvedAt: follow.approved_at || null,
    createdAt: follow.created_at || null,
    updatedAt: follow.updated_at || null,
    follower: serializeLocalProfileForViewer(localProfile),
  };
}

function countFollowsByStatus(follows = []) {
  return follows.reduce((acc, follow) => {
    const status = follow.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, {
    total: 0,
    pending: 0,
    active: 0,
    muted: 0,
    blocked: 0,
    removed: 0,
  });
}

async function updatePersonaFollowerCount(persona, previousStatus, nextStatus) {
  const wasActive = previousStatus === 'active';
  const isActive = nextStatus === 'active';
  if (wasActive === isActive) return;
  const delta = isActive ? 1 : -1;
  await supabaseAdmin
    .from('PublicPersona')
    .update({
      follower_count: Math.max(0, (persona.follower_count || 0) + delta),
      updated_at: new Date().toISOString(),
    })
    .eq('id', persona.id);
}

router.post('/', verifyToken, validate(createPersonaSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const existing = await getActivePersonaForUser(userId);
    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: 'This account already has an active Beacon.' });
    }

    const categoryCheck = assertPersonaCategoryEnabled(req.body.category);
    if (!categoryCheck.allowed) return res.status(403).json({ error: categoryCheck.error, code: categoryCheck.code, policy: categoryCheck.policy });

    const payload = {
      ...req.body,
      user_id: userId,
      handle_normalized: normalizeHandle(req.body.handle),
      status: 'active',
      public_links: req.body.public_links || [],
    };

    const { data: persona, error } = await supabaseAdmin
      .from('PublicPersona')
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error('personas.create.error', { error: error.message, userId });
      if (isPersonaHandleConflict(error)) {
        return res.status(409).json({ error: 'That Beacon handle is already taken.' });
      }
      if (isActivePersonaConflict(error)) {
        return res.status(400).json({ error: 'This account already has an active Beacon.' });
      }
      return res.status(500).json({ error: 'Failed to create Beacon' });
    }

    await supabaseAdmin
      .from('IdentityBridgeSetting')
      .insert({
        user_id: userId,
        persona_id: persona.id,
        show_persona_on_local: false,
        show_local_on_persona: false,
    });

    try {
      await syncAudienceIdentityFromPersona(persona);
    } catch (identityErr) {
      logger.warn('personas.create.audience_identity_sync_failed', {
        error: identityErr.message,
        code: identityErr.code,
        personaId: persona.id,
        userId,
      });
    }

    const channel = await ensureBroadcastChannel(persona);
    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: userId,
      personaId: persona.id,
      action: 'persona.created',
      targetType: 'PublicPersona',
      targetId: persona.id,
      metadata: {
        handle_normalized: persona.handle_normalized,
        category: persona.category,
        audience_label: persona.audience_label,
        audience_mode: persona.audience_mode,
      },
    });

    // P1.4 — seed the default Follower/Member/Insider ladder. Soft-fail:
    // a seed error must not block persona creation. listTiers() falls
    // back to ensureDefaultLadder when called, and admin tooling can
    // re-run the seed on demand.
    try {
      await require('../services/personaTierService').ensureDefaultLadder(persona.id);
    } catch (err) {
      logger.warn('persona.create.tier_seed_failed', {
        personaId: persona.id,
        error: err.message,
      });
    }

    res.status(201).json({
      persona: serializeAudienceProfileForViewer(persona, { isOwner: true }),
      channel,
    });
  } catch (err) {
    logger.error('personas.create.exception', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create Beacon' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const persona = await getActivePersonaForUser(req.user.id);
    if (!persona) return res.json({ persona: null, channel: null });
    const channel = await ensureBroadcastChannel(persona);
    res.json({
      persona: serializeAudienceProfileForViewer(persona, { isOwner: true }),
      channel,
    });
  } catch (err) {
    logger.error('personas.me.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to load Beacon' });
  }
});

router.get('/audience-identity/me',
  verifyToken, requireFeatureFlag('audience_profile'),
  async (req, res) => {
    try {
      const identity = await getOrCreateAudienceIdentityForUser(req.user.id);
      res.json({ identity: serializeAudienceIdentity(identity) });
    } catch (err) {
      logger.error('personas.audience_identity.me.error', {
        error: err.message,
        code: err.code,
        userId: req.user?.id,
      });
      const status = err.code === 'fan_handle_taken' ? 409 : 500;
      res.status(status).json({
        code: err.code || 'audience_identity_error',
        error: status === 409
          ? 'That audience identity handle is already taken.'
          : 'Failed to load audience identity',
      });
    }
  });

router.get('/compliance/categories', verifyToken, (_req, res) => {
  res.json({
    categories: getPersonaCategoryPolicies(),
    sensitiveCategoriesEnabled: process.env.PERSONA_SENSITIVE_CATEGORIES_ENABLED === 'true',
  });
});

// "Beacons You Follow" — the fan-side management surface.
//
// Returns every active membership the viewer holds, with the data the
// management screen needs to triage subscriptions in one place:
//   - persona display fields (handle / name / avatar / paused-status flag)
//   - paidTier object (so paid memberships can be routed to /audience/...
//     for cancellation instead of unfollow)
//   - latestPost snippet + unread count for "what have I missed?"
//   - notification_level + muted_until for one-tap toggles
//   - fan_handle so the sheet can show "you appear to them as @..."
//
// Counts include both paid and free memberships; the client decides how to
// decorate them. Suspended personas are dropped server-side (admin
// moderation removes the row from view); paused personas stay (greyed in UI).
router.get('/me/following', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sort = followingSortValues.includes(req.query.sort) ? req.query.sort : 'activity';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('PersonaMembership')
      .select(`
        id, persona_id, tier_id, fan_handle, notification_level, status,
        muted_until, last_seen_at, joined_at,
        persona:PublicPersona!persona_id(id, handle, display_name, avatar_url, status, credential_status, follower_count),
        tier:PersonaTier!tier_id(rank, name, price_cents)
      `)
      .eq('user_id', userId)
      .not('status', 'in', '(removed,blocked,canceled,expired)');

    if (mErr) {
      logger.error('personas.me.following.list_error', { error: mErr.message, userId });
      return res.status(500).json({ error: 'Failed to load followed Beacons' });
    }

    const rows = memberships || [];
    const visibleRows = rows.filter((m) => m.persona && m.persona.status !== 'suspended');
    const personaIds = visibleRows.map((m) => m.persona_id);

    // One batched query for the post snippet + unread count. We over-fetch
    // recent posts across all followed personas and group in JS rather than
    // issuing N per-persona queries. The MAX_RECENT_PER_PERSONA cap also
    // doubles as an unread-count ceiling — the UI shows "25+" beyond it.
    const MAX_RECENT_PER_PERSONA = 25;
    let recentPosts = [];
    if (personaIds.length > 0) {
      const { data: posts, error: pErr } = await supabaseAdmin
        .from('Post')
        .select('id, identity_context_id, content, title, created_at')
        .eq('identity_context_type', 'persona')
        .in('identity_context_id', personaIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(personaIds.length * MAX_RECENT_PER_PERSONA);
      if (pErr) {
        logger.error('personas.me.following.posts_error', { error: pErr.message, userId });
      } else {
        recentPosts = posts || [];
      }
    }

    // Defensive sort: in production Postgres ORDER BY handles this, but
    // keeping the JS sort here makes the function correct against any
    // unordered query response and simplifies test seeding.
    recentPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const postsByPersona = new Map();
    for (const post of recentPosts) {
      const arr = postsByPersona.get(post.identity_context_id) || [];
      if (arr.length < MAX_RECENT_PER_PERSONA) arr.push(post);
      postsByPersona.set(post.identity_context_id, arr);
    }

    // Decorate each membership with its computed extras (no mutation of
    // the source row — keeps the route → serializer contract explicit).
    const decorated = visibleRows.map((m) => {
      const posts = postsByPersona.get(m.persona_id) || [];
      const latestPost = posts[0] || null;
      // For brand-new follows the column may be null (the follow path
      // does not set last_seen_at on insert); fall back to joined_at so
      // the user doesn't see every historical post as "unread" right
      // after following.
      const cutoffIso = m.last_seen_at || m.joined_at;
      const cutoffMs = cutoffIso ? new Date(cutoffIso).getTime() : 0;
      const unreadCount = cutoffMs
        ? posts.filter((p) => new Date(p.created_at).getTime() > cutoffMs).length
        : posts.length;
      return { membership: m, latestPost, unreadCount };
    });

    decorated.sort((a, b) => {
      const ma = a.membership;
      const mb = b.membership;
      if (sort === 'alpha') {
        const an = (ma.persona?.display_name || ma.persona?.handle || '').toLowerCase();
        const bn = (mb.persona?.display_name || mb.persona?.handle || '').toLowerCase();
        return an.localeCompare(bn);
      }
      if (sort === 'recent') {
        return new Date(mb.joined_at || 0).getTime() - new Date(ma.joined_at || 0).getTime();
      }
      if (sort === 'unread') {
        const diff = b.unreadCount - a.unreadCount;
        if (diff !== 0) return diff;
      }
      // activity (default + unread tiebreak)
      const aTime = a.latestPost ? new Date(a.latestPost.created_at).getTime() : 0;
      const bTime = b.latestPost ? new Date(b.latestPost.created_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return new Date(mb.joined_at || 0).getTime() - new Date(ma.joined_at || 0).getTime();
    });

    const totalFollowing = decorated.length;
    const unreadBeacons = decorated.filter((d) => d.unreadCount > 0).length;
    const paged = decorated.slice(offset, offset + limit);
    const items = paged
      .map((d) => serializeFollowingRow(d.membership, { latestPost: d.latestPost, unreadCount: d.unreadCount }))
      .filter(Boolean);
    const nextOffset = offset + paged.length < totalFollowing ? offset + paged.length : null;

    return res.json({
      items,
      counts: { totalFollowing, unreadBeacons },
      pagination: { nextOffset, hasMore: nextOffset != null },
    });
  } catch (err) {
    logger.error('personas.me.following.exception', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to load followed Beacons' });
  }
});

// Zero out unread for one beacon. Idempotent; safe to call repeatedly.
// 204 (not 404) when the membership is missing, so a stale client doesn't
// surface a hard error after the user unfollowed in another tab.
router.post('/me/following/:personaId/seen', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: membership, error: findErr } = await supabaseAdmin
      .from('PersonaMembership')
      .select('id')
      .eq('user_id', userId)
      .eq('persona_id', req.params.personaId)
      .maybeSingle();
    if (findErr) {
      logger.error('personas.me.following.seen_find_error', { error: findErr.message, userId });
      return res.status(500).json({ error: 'Failed to mark seen' });
    }
    if (!membership) return res.status(204).end();

    const now = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from('PersonaMembership')
      .update({ last_seen_at: now, updated_at: now })
      .eq('id', membership.id);

    if (updErr) {
      logger.error('personas.me.following.seen_update_error', { error: updErr.message, userId });
      return res.status(500).json({ error: 'Failed to mark seen' });
    }
    return res.json({ unreadCount: 0, lastSeenAt: now });
  } catch (err) {
    logger.error('personas.me.following.seen_exception', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to mark seen' });
  }
});

// Temporary mute. days = N sets muted_until = now + N days; days = null
// clears the mute. Distinct from the legacy status='muted' which is the
// owner-side permanent removal (handled by routes under /:id/followers).
router.patch('/me/following/:personaId/mute', verifyToken, validate(muteFollowingSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const persona = await getPersonaById(req.params.personaId);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });

    const { data: membership, error: findErr } = await supabaseAdmin
      .from('PersonaMembership')
      .select('id, muted_until')
      .eq('user_id', userId)
      .eq('persona_id', req.params.personaId)
      .maybeSingle();
    if (findErr) {
      logger.error('personas.me.following.mute_find_error', { error: findErr.message, userId });
      return res.status(500).json({ error: 'Failed to update mute' });
    }
    if (!membership) return res.status(404).json({ error: 'Audience relationship not found' });

    const days = req.body.days;
    const mutedUntil = days
      ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const { error: updErr } = await supabaseAdmin
      .from('PersonaMembership')
      .update({ muted_until: mutedUntil, updated_at: new Date().toISOString() })
      .eq('id', membership.id);

    if (updErr) {
      logger.error('personas.me.following.mute_update_error', { error: updErr.message, userId });
      return res.status(500).json({ error: 'Failed to update mute' });
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: persona.user_id,
      personaId: persona.id,
      action: days ? 'persona.follow_muted' : 'persona.follow_unmuted',
      targetType: 'PersonaMembership',
      targetId: membership.id,
      metadata: {
        previous_muted_until: membership.muted_until || null,
        muted_until: mutedUntil,
        days: days || null,
      },
    });
    return res.json({ mutedUntil });
  } catch (err) {
    logger.error('personas.me.following.mute_exception', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to update mute' });
  }
});

// "Your audience" — owner-side surface, mirror of /me/following.
//
// Returns memberships for the owner's active persona, serialized via
// serializeFanForCreator. That is the only privacy-correct serializer
// for this direction: the persona owner sees fan_handle, joined-month,
// tier, and tenure — and nothing about the fan's personal-side identity
// (no User.username, no LocalProfile, no city/state). See
// audience-profile design v2 §6.1.
//
// The pre-existing GET /:id/followers route uses an older serializer
// that pulls the fan's LocalProfile. It is kept for compatibility with
// existing UI surfaces (mobile identity/persona.tsx, web persona page)
// but should NOT be used for new screens. Migrate those callers in a
// follow-up.
router.get('/me/audience', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const persona = await getActivePersonaForUser(userId);
    if (!persona) {
      return res.json({
        persona: null,
        items: [],
        counts: { totalActive: 0, pending: 0, byTier: { 1: 0, 2: 0, 3: 0, 4: 0 } },
        pagination: { nextOffset: null, hasMore: false },
      });
    }

    const sort = audienceSortValues.includes(req.query.sort) ? req.query.sort : 'recent';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const statusParam = String(req.query.status || 'all').toLowerCase();
    const tierRankParam = req.query.tier_rank ? Number(req.query.tier_rank) : null;

    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('PersonaMembership')
      .select(`
        id, persona_id, user_id, tier_id, fan_handle, fan_display_name, fan_avatar_url,
        verified_local, notification_level, status, joined_at,
        cancel_at_period_end, current_period_end,
        tier:PersonaTier!tier_id(rank, name, price_cents)
      `)
      .eq('persona_id', persona.id)
      .in('status', AUDIENCE_VISIBLE_STATUSES);

    if (mErr) {
      logger.error('personas.me.audience.list_error', { error: mErr.message, userId });
      return res.status(500).json({ error: 'Failed to load audience' });
    }

    const rows = memberships || [];

    // Aggregate counts BEFORE applying status/tier filters so the UI
    // chips can show "Pending · 4", "Insiders · 2" alongside the
    // currently filtered list.
    const counts = {
      totalActive: 0,
      pending: 0,
      byTier: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };
    for (const m of rows) {
      if (m.status === 'pending') counts.pending += 1;
      else if (m.status === 'active' || m.status === 'past_due' || m.status === 'canceled_pending') counts.totalActive += 1;
      const rank = Number(m.tier?.rank || 0);
      if (rank >= 1 && rank <= 4) counts.byTier[rank] += 1;
    }

    let visible = rows;
    if (statusParam !== 'all') {
      const allowed = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      visible = visible.filter((m) => allowed.includes(m.status));
    }
    if (tierRankParam && tierRankParam >= 1 && tierRankParam <= 4) {
      visible = visible.filter((m) => Number(m.tier?.rank || 0) === tierRankParam);
    }

    visible.sort((a, b) => {
      if (sort === 'alpha') {
        const an = (a.fan_display_name || a.fan_handle || '').toLowerCase();
        const bn = (b.fan_display_name || b.fan_handle || '').toLowerCase();
        return an.localeCompare(bn);
      }
      if (sort === 'tenure') {
        return new Date(a.joined_at || 0).getTime() - new Date(b.joined_at || 0).getTime();
      }
      if (sort === 'tier') {
        const ra = Number(a.tier?.rank || 0);
        const rb = Number(b.tier?.rank || 0);
        if (ra !== rb) return rb - ra;
      }
      // 'recent' (default + tier tiebreak)
      return new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime();
    });

    const totalFiltered = visible.length;
    const paged = visible.slice(offset, offset + limit);
    // Attach the persona pointer so serializeFanForCreator can gate
    // verified_local correctly per design §6.1.
    const items = paged
      .map((m) => serializeFanForCreator({ ...m, persona }))
      .filter(Boolean);
    const nextOffset = offset + paged.length < totalFiltered ? offset + paged.length : null;

    return res.json({
      persona: serializeAudienceProfileForViewer(persona, { isOwner: true }),
      items,
      counts,
      pagination: { nextOffset, hasMore: nextOffset != null },
    });
  } catch (err) {
    logger.error('personas.me.audience.exception', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to load audience' });
  }
});

// Owner-side action on a single audience member. `action` keys to a
// status transition so callers don't need to know our internal status
// vocabulary (the legacy PATCH /:id/followers/:followId required them
// to). All transitions write an audit log entry.
router.patch('/me/audience/:membershipId', verifyToken, validate(audienceMemberActionSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const persona = await getActivePersonaForUser(userId);
    if (!persona) return res.status(404).json({ error: 'No active Beacon' });

    const { data: membership, error: findErr } = await supabaseAdmin
      .from('PersonaMembership')
      .select('id, status, source, user_id')
      .eq('id', req.params.membershipId)
      .eq('persona_id', persona.id)
      .maybeSingle();
    if (findErr) {
      logger.error('personas.me.audience.find_error', { error: findErr.message, userId });
      return res.status(500).json({ error: 'Failed to update follower' });
    }
    if (!membership) return res.status(404).json({ error: 'Follower not found' });

    if (isPaidPersonaMembership(membership)) {
      return paidMembershipConflict(res);
    }

    const now = new Date().toISOString();
    const action = req.body.action;
    let updates = { updated_at: now };
    let auditAction;
    switch (action) {
      case 'approve':
        if (membership.status !== 'pending') {
          return res.status(409).json({ error: 'Member is not pending' });
        }
        updates = {
          ...updates,
          status: 'active',
          approved_by_user_id: userId,
          approved_at: now,
          source: membership.source === 'follow_request' ? 'request_approved' : membership.source,
        };
        auditAction = 'persona.follower_approved';
        break;
      case 'decline':
        if (membership.status !== 'pending') {
          return res.status(409).json({ error: 'Member is not pending' });
        }
        updates = { ...updates, status: 'removed', approved_by_user_id: null, approved_at: null };
        auditAction = 'persona.follower_declined';
        break;
      case 'remove':
        updates = { ...updates, status: 'removed', approved_by_user_id: null, approved_at: null };
        auditAction = 'persona.follower_removed';
        break;
      case 'mute':
        updates = { ...updates, status: 'muted' };
        auditAction = 'persona.follower_owner_muted';
        break;
      case 'unmute':
        if (membership.status !== 'muted') {
          return res.status(409).json({ error: 'Member is not muted' });
        }
        updates = { ...updates, status: 'active' };
        auditAction = 'persona.follower_owner_unmuted';
        break;
    }

    const { error: updErr } = await supabaseAdmin
      .from('PersonaMembership')
      .update(updates)
      .eq('id', membership.id);
    if (updErr) {
      logger.error('personas.me.audience.update_error', { error: updErr.message, userId });
      return res.status(500).json({ error: 'Failed to update follower' });
    }

    // Keep PublicPersona.follower_count in step with active membership
    // count, mirroring how the existing follow / unfollow routes do it.
    if (updates.status) {
      await updatePersonaFollowerCount(persona, membership.status, updates.status);
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: membership.user_id,
      personaId: persona.id,
      action: auditAction,
      targetType: 'PersonaMembership',
      targetId: membership.id,
      metadata: { previous_status: membership.status, status: updates.status, action },
    });

    return res.json({ membershipId: membership.id, status: updates.status });
  } catch (err) {
    logger.error('personas.me.audience.exception', { error: err.message, userId: req.user?.id });
    return res.status(500).json({ error: 'Failed to update follower' });
  }
});

router.patch('/:id', verifyToken, validate(updatePersonaSchema), async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });
    if (persona.user_id !== req.user.id) return res.status(403).json({ error: 'You cannot edit this Beacon' });

    const category = req.body.category || persona.category;
    const categoryCheck = assertPersonaCategoryEnabled(category);
    if (!categoryCheck.allowed) return res.status(403).json({ error: categoryCheck.error, code: categoryCheck.code, policy: categoryCheck.policy });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    if (updates.handle) updates.handle_normalized = normalizeHandle(updates.handle);

    const { data: updated, error } = await supabaseAdmin
      .from('PublicPersona')
      .update(updates)
      .eq('id', persona.id)
      .select()
      .single();

    if (error) {
      logger.error('personas.patch.update_error', { error: error.message, personaId: persona.id });
      if (isPersonaHandleConflict(error)) {
        return res.status(409).json({ error: 'That Beacon handle is already taken.' });
      }
      return res.status(500).json({ error: 'Failed to update Beacon' });
    }
    if (req.body.handle || req.body.display_name || Object.prototype.hasOwnProperty.call(req.body, 'avatar_url')) {
      try {
        await syncAudienceIdentityFromPersona(updated);
      } catch (identityErr) {
        logger.warn('personas.patch.audience_identity_sync_failed', {
          error: identityErr.message,
          code: identityErr.code,
          personaId: persona.id,
          userId: req.user.id,
        });
      }
    }
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: req.user.id,
      personaId: persona.id,
      action: 'persona.updated',
      targetType: 'PublicPersona',
      targetId: persona.id,
      metadata: {
        changed_fields: Object.keys(req.body).sort(),
        previous: {
          handle_normalized: persona.handle_normalized,
          category: persona.category,
          audience_label: persona.audience_label,
          audience_mode: persona.audience_mode,
        },
      },
    });
    res.json({ persona: serializeAudienceProfileForViewer(updated, { isOwner: true }) });
  } catch (err) {
    logger.error('personas.patch.error', { error: err.message, personaId: req.params.id });
    res.status(500).json({ error: 'Failed to update Beacon' });
  }
});

router.get('/:id/followers', verifyToken, async (req, res) => {
  try {
    const { persona, errorStatus, error } = await getOwnedPersona(req.params.id, req.user.id);
    if (errorStatus) return res.status(errorStatus).json({ error });

    const requestedStatus = String(req.query.status || 'active');
    const statusFilter = requestedStatus === 'all'
      ? null
      : requestedStatus.split(',').map((status) => status.trim()).filter(Boolean);

    let query = supabaseAdmin
      .from('PersonaFollow')
      .select('*')
      .eq('persona_id', persona.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(req.query.limit) || 100, 200));

    if (statusFilter?.length === 1) {
      query = query.eq('status', statusFilter[0]);
    } else if (statusFilter?.length > 1) {
      query = query.in('status', statusFilter);
    }

    const { data: follows, error: followError } = await query;
    if (followError) return res.status(500).json({ error: 'Failed to load Beacon followers' });

    const { data: allFollows } = await supabaseAdmin
      .from('PersonaFollow')
      .select('status')
      .eq('persona_id', persona.id);

    const serialized = await Promise.all((follows || []).map(async (follow) => {
      const localProfile = await ensureLocalProfile(follow.follower_user_id);
      return serializePersonaFollowForOwner(follow, localProfile);
    }));

    res.json({
      followers: serialized.filter(Boolean),
      counts: countFollowsByStatus(allFollows || follows || []),
    });
  } catch (err) {
    logger.error('personas.followers.error', { error: err.message, personaId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to load Beacon followers' });
  }
});

router.patch('/:id/followers/:followId', verifyToken, validate(ownerFollowerUpdateSchema), async (req, res) => {
  try {
    const { persona, errorStatus, error } = await getOwnedPersona(req.params.id, req.user.id);
    if (errorStatus) return res.status(errorStatus).json({ error });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('PersonaMembership')
      .select('*')
      .eq('id', req.params.followId)
      .eq('persona_id', persona.id)
      .maybeSingle();
    if (existingError) return res.status(500).json({ error: 'Failed to load follower' });
    if (!existing) return res.status(404).json({ error: 'Follower not found' });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    if (updates.status === 'active' && existing.status !== 'active') {
      updates.approved_by_user_id = req.user.id;
      updates.approved_at = new Date().toISOString();
      updates.source = existing.source === 'follow_request' ? 'request_approved' : existing.source;
    }
    if (updates.status && updates.status !== 'active') {
      updates.approved_by_user_id = null;
      updates.approved_at = null;
    }

    const { data: updatedMembership, error: updateError } = await supabaseAdmin
      .from('PersonaMembership')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (updateError) return res.status(500).json({ error: 'Failed to update follower' });

    await updatePersonaFollowerCount(persona, existing.status, updatedMembership.status);
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: existing.user_id,
      personaId: persona.id,
      action: 'persona.follower_updated',
      targetType: 'PersonaFollow',
      targetId: existing.id,
      metadata: {
        previous_status: existing.status,
        status: updatedMembership.status,
        changed_fields: Object.keys(req.body).sort(),
      },
    });

    if (existing.status === 'pending' && updatedMembership.status === 'active') {
      await notificationService.notifyPersonaFollowApproved({
        fanUserId: updatedMembership.user_id,
        personaId: persona.id,
        personaHandle: persona.handle,
        personaDisplayName: persona.display_name || persona.handle,
        membershipId: updatedMembership.id,
      });
    }

    const updated = projectMembershipAsLegacyFollow(updatedMembership);
    const localProfile = await ensureLocalProfile(updatedMembership.user_id);
    res.json({ follower: serializePersonaFollowForOwner(updated, localProfile) });
  } catch (err) {
    logger.error('personas.followers.update_error', { error: err.message, personaId: req.params.id, followId: req.params.followId, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update follower' });
  }
});

router.get('/:handle', optionalAuth, async (req, res) => {
  try {
    const persona = await getPersonaByHandle(req.params.handle);
    if (!persona || persona.status === 'suspended') {
      return res.status(404).json({ error: 'Beacon not found' });
    }
    const channel = await getBroadcastChannelForPersona(persona.id);
    const viewerOptions = await personaViewerOptions(persona, req.user?.id || null);
    res.json({
      persona: serializeAudienceProfileForViewer(persona, viewerOptions),
      channel: channel ? { id: channel.id, title: channel.title, status: channel.status } : null,
    });
  } catch (err) {
    logger.error('personas.get.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load Beacon' });
  }
});

router.get('/:handle/posts', optionalAuth, async (req, res) => {
  try {
    const persona = await getPersonaByHandle(req.params.handle);
    if (!persona || persona.status === 'suspended') {
      return res.status(404).json({ error: 'Beacon not found' });
    }
    const viewerId = req.user?.id || null;
    const follow = await getPersonaFollow(persona.id, viewerId);
    let viewerRank = persona.user_id === viewerId
      ? 4
      : await getViewerTierRankForPersona(persona.id, viewerId);
    if (follow?.status === 'active' && viewerRank < 1) viewerRank = 1;
    if (follow?.relationship_type === 'subscriber' && viewerRank < 2) viewerRank = 2;

    const { data: posts, error } = await supabaseAdmin
      .from('Post')
      .select('*')
      .eq('identity_context_type', 'persona')
      .eq('identity_context_id', persona.id)
      .order('created_at', { ascending: false })
      .limit(Number(req.query.limit) || 20);

    if (error) return res.status(500).json({ error: 'Failed to load Beacon posts' });

    const visiblePosts = (posts || []).filter((post) => personaPostVisibleToViewer(post, viewerRank));
    res.json({
      posts: visiblePosts.map((post) => {
        const { user_id: _userId, author_user_id: _authorUserId, ...safePost } = post;
        const author = serializePostAuthorForViewer({ ...post, persona });
        return sanitizePersonaPostForViewer({
          ...safePost,
          user_id: persona.id,
          author_user_id: null,
          // P0.4 follow-up: creator slot mirrors author with the new
          // identity shape (handle / displayName / avatarUrl). Legacy
          // {username, name, profile_picture_url} aliases are gone.
          author,
          creator: author ? {
            type: author.type,
            id: persona.id,
            handle: author.handle || null,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl || null,
          } : null,
        });
      }),
    });
  } catch (err) {
    logger.error('personas.posts.error', { error: err.message, handle: req.params.handle });
    res.status(500).json({ error: 'Failed to load Beacon posts' });
  }
});

// P1.5 — public list of active tiers for a persona, by handle.
//
// Deliberately NOT gated by audience_profile feature flag: viewing a
// persona's Beacon (and its tier ladder) is the entry point a fan needs
// to reach the privacy-handshake screen (P1.8). Hiding it behind the
// flag would prevent a fan from ever discovering a creator whose flag is
// on. The flag controls whether the user has personas at all; their
// Beacon is intentionally accessible by URL.
//
// Strips stripe_price_id — fans never see Stripe state. The owner-side
// dashboard (routes/personaTiers.js) returns the owner serializer which
// includes it.
router.get('/:handle/tiers', optionalAuth, async (req, res) => {
  try {
    const persona = await getPersonaByHandle(req.params.handle);
    if (!persona || persona.status === 'suspended') {
      return res.status(404).json({ error: 'Beacon not found' });
    }
    const tiers = await require('../services/personaTierService')
      .listTiers(persona.id, { includeHidden: false });
    return res.json({
      tiers: tiers.map((t) => ({
        id: t.id,
        rank: t.rank,
        name: t.name,
        description: t.description || null,
        priceCents: t.price_cents,
        currency: t.currency,
        billingInterval: t.billing_interval,
        msgThreadsPerPeriod: t.msg_threads_per_period,
        creatorCanInitiateDm: !!t.creator_can_initiate_dm,
        replyPolicy: t.reply_policy,
      })),
    });
  } catch (err) {
    logger.error('personas.public_tiers.error', {
      error: err.message, handle: req.params.handle,
    });
    return res.status(500).json({ error: 'Failed to load tiers' });
  }
});

// Joi schema for the P1.8 privacy-handshake POST body. Applied only when
// `acknowledged_platform_trust` is present on the request — legacy
// callers that POST an empty body fall through to the existing
// random-handle path so we don't break the existing follow contract.
const handshakeSchema = Joi.object({
  tier_rank: Joi.number().integer().min(1).max(4).default(1),
  fan_handle: Joi.string().trim().min(3).max(40).pattern(/^[a-zA-Z0-9_.-]+$/).required(),
  fan_display_name: Joi.string().trim().max(60).allow('', null),
  fan_avatar_url: Joi.string().uri().allow('', null),
  acknowledged_platform_trust: Joi.boolean().valid(true).required(),
  acknowledged_using_pantopus_username: Joi.boolean(),
}).unknown(true);

// Look up the rank-1 (free Follower) tier id on a persona. Every
// persona is guaranteed to have one once migration 136 has run; this
// helper double-checks and returns null on miss so callers can fall
// back gracefully.
async function getRank1TierId(personaId) {
  const { data: tier } = await supabaseAdmin
    .from('PersonaTier')
    .select('id')
    .eq('persona_id', personaId)
    .eq('rank', 1)
    .maybeSingle();
  return tier?.id || null;
}

// Look up a tier by (personaId, rank) for handshake's tier_rank > 1
// case. Returns the row including stripe_price_id so the future
// Checkout step (P1.9) can use it.
async function getTierByRank(personaId, rank) {
  const { data: tier } = await supabaseAdmin
    .from('PersonaTier')
    .select('id, rank, name, status, price_cents, stripe_price_id')
    .eq('persona_id', personaId)
    .eq('rank', rank)
    .maybeSingle();
  return tier || null;
}

function isPaidPersonaMembership(membership) {
  if (!membership) return false;
  if (['expired', 'canceled', 'removed'].includes(membership.status)) {
    return false;
  }
  const rank = Number(membership.tier?.rank || 0);
  return rank > 1 || Boolean(membership.stripe_subscription_id);
}

function paidMembershipConflict(res) {
  return res.status(409).json({
    code: 'paid_membership_managed_by_subscription',
    error: 'This paid membership is managed through subscription billing.',
  });
}

async function getAudienceIdentityForHandshake(req, res, {
  fanHandle,
  fanDisplayName,
  fanAvatarUrl,
  personaId,
}) {
  try {
    return await getOrCreateAudienceIdentityForUser(req.user.id, {
      preferredHandle: fanHandle,
      displayName: fanDisplayName || fanHandle,
      avatarUrl: fanAvatarUrl || null,
      allowUnusedIdentityUpdate: true,
    });
  } catch (identityErr) {
    logger.error('persona_membership.audience_identity_error', {
      error: identityErr.message,
      code: identityErr.code,
      personaId,
      userId: req.user.id,
    });
    res.status(identityErr.code === 'fan_handle_taken' ? 409 : 500).json({
      code: identityErr.code || 'audience_identity_error',
      error: identityErr.code === 'fan_handle_taken'
        ? 'That fan name is already taken.'
        : 'Could not prepare audience identity',
    });
    return null;
  }
}

function notifyPersonaFollowFromMembership({ persona, membership, follow, status }) {
  return notificationService.notifyPersonaFollow({
    ownerUserId: persona.user_id,
    fanDisplayName: membership?.fan_display_name || membership?.fan_handle || null,
    fanHandle: membership?.fan_handle || null,
    membershipId: membership?.id || follow?.id || null,
    personaId: persona.id,
    personaHandle: persona.handle,
    personaDisplayName: persona.display_name || persona.handle,
    followId: follow?.id || null,
    followStatus: status,
  });
}

async function isViewerBlockedFromPersona(personaId, viewerUserId) {
  if (!viewerUserId) return false;
  const { data } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id')
    .eq('persona_id', personaId)
    .eq('blocked_user_id', viewerUserId)
    .maybeSingle();
  return !!data;
}

// P1.10 — owner-only aggregate counts for the broadcast composer's
// tier-visibility selector (audience-profile §11.3). Counts active
// memberships grouped by tier rank so the composer can show
// "Members · 12 reach" before the creator commits to a visibility.
router.get('/:id/membership-stats',
  verifyToken, requireFeatureFlag('audience_profile'),
  async (req, res) => {
    try {
      const persona = await getPersonaById(req.params.id);
      if (!persona) return res.status(404).json({ error: 'Not found' });
      // 404 (not 403) keeps the surface invisible to non-owners.
      if (persona.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

      const { data: tiers } = await supabaseAdmin
        .from('PersonaTier')
        .select('id, rank')
        .eq('persona_id', persona.id);
      const rankByTierId = new Map((tiers || []).map((t) => [t.id, Number(t.rank || 0)]));

      const { data: memberships } = await supabaseAdmin
        .from('PersonaMembership')
        .select('tier_id, status')
        .eq('persona_id', persona.id)
        .in('status', ['active', 'past_due']);

      const counts = { followers: 0, members: 0, insiders: 0, direct: 0 };
      for (const m of memberships || []) {
        const rank = rankByTierId.get(m.tier_id) || 0;
        if (rank >= 1) counts.followers += 1;
        if (rank >= 2) counts.members += 1;
        if (rank >= 3) counts.insiders += 1;
        if (rank >= 4) counts.direct += 1;
      }
      return res.json({ counts });
    } catch (err) {
      logger.error('personas.membership_stats.error', {
        error: err.message, personaId: req.params.id,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  });

// P1.8 / unified audience identity — returns the viewer's existing global
// audience handle when present, otherwise a fresh globally available random
// handle. The handshake page calls this once on mount and again when the fan
// asks for another suggestion before their identity exists.
//
// Audience-profile §11.4: the pre-filled fan handle is randomly
// generated, NEVER derived from User.username. Callers don't get to
// influence the handle's prefix or shape — it always comes back from
// generateRandomFanHandle (`fan_<8 hex>`).
router.get('/:handle/fan-handle-suggestion',
  verifyToken, requireFeatureFlag('audience_profile'),
  async (req, res) => {
    try {
      const persona = await getPersonaByHandle(req.params.handle);
      if (!persona || persona.status === 'suspended') {
        return res.status(404).json({ error: 'Beacon not found' });
      }

      const identity = await getAudienceIdentityForUser(req.user.id);
      if (identity) {
        const editable = await canEditAudienceIdentityForHandshake(identity);
        return res.json({
          suggestion: identity.handle,
          identity: serializeAudienceIdentity(identity),
          locked: !editable,
        });
      }

      const viewerPersona = await getActivePersonaForUser(req.user.id);
      if (viewerPersona) {
        const boundIdentity = await getOrCreateAudienceIdentityForUser(req.user.id);
        return res.json({
          suggestion: boundIdentity.handle,
          identity: serializeAudienceIdentity(boundIdentity),
          locked: true,
        });
      }

      const suggestion = await generateUniqueAudienceHandle(req.user.id);
      return res.json({
        suggestion,
        locked: false,
      });
    } catch (err) {
      logger.error('personas.fan_handle_suggestion.error', {
        error: err.message, handle: req.params.handle,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  });

router.post('/:id/follow', verifyToken, personaFollowLimiter, async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.id);
    if (!persona || persona.status === 'suspended') return res.status(404).json({ error: 'Beacon not found' });
    if (persona.user_id === req.user.id) return res.status(400).json({ error: 'Cannot follow your own Beacon' });

    if (persona.audience_mode === 'invite_only' || persona.audience_mode === 'organization_managed') {
      return res.status(403).json({ error: 'This Beacon is invite-only.' });
    }

    // Persona-level block check (audience-profile §9). The fan-facing
    // copy is intentionally vague-but-truthful: the personal-side
    // relationship that drove the block must not leak.
    if (await isViewerBlockedFromPersona(persona.id, req.user.id)) {
      return res.status(403).json({
        code: 'persona_block_active',
        error: 'This profile cannot accept a new membership from your account at this time.',
      });
    }

    const handshakeMode = req.body && Object.prototype.hasOwnProperty.call(req.body, 'acknowledged_platform_trust');

    if (handshakeMode) {
      const enabled = await isFeatureEnabled('audience_profile', req.user);
      if (!enabled) return res.status(404).json({ error: 'Not found' });
      return handlePrivacyHandshake(req, res, persona);
    }

    return handleLegacyFollow(req, res, persona);
  } catch (err) {
    logger.error('personas.follow.error', { error: err.message, personaId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to follow Beacon' });
  }
});

// Legacy free-follow path — preserves the contract that pre-P1.8
// clients (and the existing AudienceProfileClient.tsx Follow button)
// rely on. After migration 136 every membership row needs a non-null
// tier_id, so we always link to the rank-1 tier; the legacy callers
// don't supply or read that field but it satisfies the FK + NOT NULL.
async function handleLegacyFollow(req, res, persona) {
  const status = persona.audience_mode === 'approval_required' ? 'pending' : 'active';
  const existingMembership = await getPersonaMembershipForUser(persona.id, req.user.id);
  const existingFollow = projectMembershipAsLegacyFollow(existingMembership);
  if (existingFollow?.status === 'blocked') {
    return res.status(403).json({ error: 'You cannot follow this Beacon.' });
  }
  if (existingFollow?.status === status) {
    return res.status(200).json({ follow: existingFollow, status });
  }
  if (isPaidPersonaMembership(existingMembership)) {
    return paidMembershipConflict(res);
  }

  const tierId = await getRank1TierId(persona.id);
  let audienceIdentity;
  try {
    audienceIdentity = await getOrCreateAudienceIdentityForUser(req.user.id);
  } catch (identityErr) {
    logger.error('personas.follow.audience_identity_error', {
      error: identityErr.message,
      code: identityErr.code,
      personaId: persona.id,
      userId: req.user.id,
    });
    return res.status(identityErr.code === 'fan_handle_taken' ? 409 : 500).json({
      code: identityErr.code || 'audience_identity_error',
      error: identityErr.code === 'fan_handle_taken'
        ? 'That fan name is already taken.'
        : 'Could not prepare audience identity',
    });
  }
  const fanSnapshot = audienceIdentityMembershipPayload(audienceIdentity);
  const { data: membership, error } = await supabaseAdmin
    .from('PersonaMembership')
    .upsert({
      persona_id: persona.id,
      user_id: req.user.id,
      tier_id: tierId,
      ...fanSnapshot,
      relationship_type: defaultRelationshipTypeForPersona(persona),
      status,
      source: status === 'active' ? 'self_follow' : 'follow_request',
      notification_level: 'all',
      public_visibility: 'private',
      approved_at: status === 'active' ? new Date().toISOString() : null,
    }, { onConflict: 'persona_id,user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to follow Beacon' });

  const follow = projectMembershipAsLegacyFollow(membership);

  if (status === 'active' && existingFollow?.status !== 'active') {
    await supabaseAdmin
      .from('PublicPersona')
      .update({ follower_count: (persona.follower_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', persona.id);
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    targetUserId: persona.user_id,
    personaId: persona.id,
    action: status === 'pending' ? 'persona.follow_requested' : 'persona.followed',
    targetType: 'PersonaFollow',
    targetId: follow.id,
    metadata: {
      status,
      previous_status: existingFollow?.status || null,
      relationship_type: follow.relationship_type || 'follower',
    },
  });

  if (status === 'active' || status === 'pending') {
    await notifyPersonaFollowFromMembership({ persona, membership, follow, status });
  }

  return res.status(201).json({ follow, status });
}

// Privacy-handshake path — audience-profile design v2 §11.4. The fan
// has explicitly chosen their fan_handle and acknowledged the
// platform-trust statement. For tier_rank === 1 this becomes an
// active free Follower membership immediately. For tier_rank > 1
// we collect the handshake but DO NOT create a Stripe subscription
// yet — P1.9 owns Checkout + the resulting membership row.
async function handlePrivacyHandshake(req, res, persona) {
  const { value, error: joiError } = handshakeSchema.validate(req.body, {
    abortEarly: false, stripUnknown: false,
  });
  if (joiError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: joiError.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
    });
  }
  const {
    tier_rank: tierRank,
    fan_handle: fanHandle,
    fan_display_name: fanDisplayName,
    fan_avatar_url: fanAvatarUrl,
    acknowledged_using_pantopus_username: ackUsername,
  } = value;

  // Auto-derive prevention: a fan can use their User.username as their
  // fan_handle, but only with explicit consent. Audience-profile v2
  // §11.4: "Use my Pantopus username instead" is allowed but
  // visually-subordinate AND server-confirmed.
  const { data: viewer } = await supabaseAdmin
    .from('User')
    .select('username')
    .eq('id', req.user.id)
    .maybeSingle();
  const existingAudienceIdentity = await getAudienceIdentityForUser(req.user.id);
  const activeViewerPersona = existingAudienceIdentity ? null : await getActivePersonaForUser(req.user.id);
  const submittedHandle = normalizeHandle(fanHandle);
  const usernameHandleAlreadyCanonical = (
    !!existingAudienceIdentity
    && normalizeHandle(existingAudienceIdentity?.handle) === submittedHandle
  ) || normalizeHandle(activeViewerPersona?.handle) === submittedHandle;
  if (viewer?.username && fanHandle.toLowerCase() === String(viewer.username).toLowerCase()
      && !ackUsername && !usernameHandleAlreadyCanonical) {
    return res.status(400).json({
      code: 'pantopus_username_requires_ack',
      error: 'Using your Pantopus username as your fan handle requires explicit confirmation.',
    });
  }

  // tier_rank > 1: handshake-collected fields ride on Stripe Checkout
  // session metadata. The PersonaMembership row is created by the
  // customer.subscription.created webhook handler when Stripe fires
  // it on successful checkout — we never write a row here. This makes
  // the path replay-safe and means the user's billing identity never
  // crosses the trust boundary into Pantopus's UI.
  if (tierRank > 1) {
    const tier = await getTierByRank(persona.id, tierRank);
    if (!tier || tier.status !== 'active') {
      return res.status(404).json({ error: 'Tier not available' });
    }
    const existingMembership = await getPersonaMembershipForUser(persona.id, req.user.id);
    if (isPaidPersonaMembership(existingMembership)) {
      return paidMembershipConflict(res);
    }
    const audienceIdentity = await getAudienceIdentityForHandshake(req, res, {
      fanHandle,
      fanDisplayName,
      fanAvatarUrl,
      personaId: persona.id,
    });
    if (!audienceIdentity) return null;
    const fanSnapshot = audienceIdentityMembershipPayload(audienceIdentity);

    let subscribeUrl = null;
    let stripeError = null;
    try {
      const session = await require('../services/personaPaymentsService')
        .createCheckoutSession({
          persona,
          tier,
          fanUserId: req.user.id,
          handshake: {
            audience_identity_id: audienceIdentity.id,
            fan_handle: fanSnapshot.fan_handle,
            fan_display_name: fanSnapshot.fan_display_name,
            fan_avatar_url: fanSnapshot.fan_avatar_url,
          },
        });
      subscribeUrl = session.url;
    } catch (err) {
      stripeError = err.message || 'checkout_failed';
      logger.warn('persona_membership.checkout_session_error', {
        personaId: persona.id, tierRank, error: stripeError,
      });
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: persona.user_id,
      personaId: persona.id,
      action: 'persona_membership.handshake',
      targetType: 'PublicPersona',
      targetId: persona.id,
      metadata: {
        tier_rank: tierRank,
        used_pantopus_username: !!ackUsername,
        outcome: subscribeUrl ? 'checkout_session_created' : 'requires_payment',
        checkout_error: stripeError || null,
      },
    });
    return res.status(200).json({
      requiresPayment: true,
      subscribeUrl,
      handshake: {
        tier_rank: tierRank,
        tier_id: tier.id,
        audience_identity_id: audienceIdentity.id,
        fan_handle: fanSnapshot.fan_handle,
        fan_display_name: fanSnapshot.fan_display_name,
        fan_avatar_url: fanSnapshot.fan_avatar_url,
      },
    });
  }

  // tier_rank === 1: free Follower membership goes active immediately.
  const tierId = await getRank1TierId(persona.id);
  if (!tierId) {
    return res.status(500).json({ error: 'Free tier not configured' });
  }
  const status = persona.audience_mode === 'approval_required' ? 'pending' : 'active';
  const existingMembership = await getPersonaMembershipForUser(persona.id, req.user.id);
  if (isPaidPersonaMembership(existingMembership)) {
    return paidMembershipConflict(res);
  }
  const existingFollow = projectMembershipAsLegacyFollow(existingMembership);
  const audienceIdentity = await getAudienceIdentityForHandshake(req, res, {
    fanHandle,
    fanDisplayName,
    fanAvatarUrl,
    personaId: persona.id,
  });
  if (!audienceIdentity) return null;
  const fanSnapshot = audienceIdentityMembershipPayload(audienceIdentity);

  const upsertPayload = {
    persona_id: persona.id,
    user_id: req.user.id,
    tier_id: tierId,
    ...fanSnapshot,
    relationship_type: defaultRelationshipTypeForPersona(persona),
    status,
    source: status === 'active' ? 'self_follow' : 'follow_request',
    notification_level: 'all',
    public_visibility: 'private',
    approved_at: status === 'active' ? new Date().toISOString() : null,
  };

  const { data: membership, error: writeError } = await supabaseAdmin
    .from('PersonaMembership')
    .upsert(upsertPayload, { onConflict: 'persona_id,user_id' })
    .select()
    .single();

  if (writeError) {
    // Postgres error 23505 = unique_violation. Membership snapshots retain
    // the old persona-scoped unique key, while AudienceIdentity enforces the
    // global handle key.
    if (writeError.code === '23505') {
      return res.status(409).json({
        code: 'fan_handle_taken',
        error: 'That fan name is already taken.',
      });
    }
    logger.error('persona_membership.handshake_error', {
      error: writeError.message, personaId: persona.id, userId: req.user.id,
    });
    return res.status(500).json({ error: 'Could not save membership' });
  }

  const follow = projectMembershipAsLegacyFollow(membership);

  if (status === 'active' && existingFollow?.status !== 'active') {
    await supabaseAdmin
      .from('PublicPersona')
      .update({
        follower_count: (persona.follower_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', persona.id);
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    targetUserId: persona.user_id,
    personaId: persona.id,
    action: 'persona_membership.handshake',
    targetType: 'PersonaMembership',
    targetId: membership.id,
    metadata: {
      tier_rank: 1,
      used_pantopus_username: !!ackUsername,
      outcome: status,
      previous_status: existingFollow?.status || null,
    },
  });

  if ((status === 'active' || status === 'pending') && existingFollow?.status !== status) {
    await notifyPersonaFollowFromMembership({ persona, membership, follow, status });
  }

  return res.status(201).json({
    follow,
    status,
    membership: {
      id: membership.id,
      audience_identity_id: membership.audience_identity_id || audienceIdentity.id,
      fan_handle: membership.fan_handle,
      tier_id: membership.tier_id,
      status: membership.status,
    },
  });
}

router.delete('/:id/follow', verifyToken, personaFollowLimiter, async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });

    const existingMembership = await getPersonaMembershipForUser(persona.id, req.user.id);
    if (isPaidPersonaMembership(existingMembership)) {
      return paidMembershipConflict(res);
    }

    const existing = projectMembershipAsLegacyFollow(existingMembership);
    const { error: deleteError } = await supabaseAdmin
      .from('PersonaMembership')
      .delete()
      .eq('id', existingMembership?.id || '__missing__');

    if (deleteError) {
      logger.error('personas.unfollow.delete_error', {
        error: deleteError.message, personaId: persona.id, userId: req.user.id,
      });
      return res.status(500).json({ error: 'Failed to unfollow Beacon' });
    }

    if (existing?.status === 'active') {
      await supabaseAdmin
        .from('PublicPersona')
        .update({ follower_count: Math.max(0, (persona.follower_count || 0) - 1), updated_at: new Date().toISOString() })
        .eq('id', persona.id);
    }
    if (existing) {
      await writeIdentityAuditLog({
        req,
        actorUserId: req.user.id,
        targetUserId: persona.user_id,
        personaId: persona.id,
        action: 'persona.unfollowed',
        targetType: 'PersonaFollow',
        targetId: existing.id,
        metadata: {
          previous_status: existing.status || null,
          relationship_type: existing.relationship_type || 'follower',
        },
      });
    }
    res.json({ message: 'Beacon unfollowed' });
  } catch (err) {
    logger.error('personas.unfollow.error', { error: err.message, personaId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to unfollow Beacon' });
  }
});

router.patch('/:id/follow/preferences', verifyToken, validate(notificationPreferenceSchema), async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });
    const follow = await getPersonaFollow(persona.id, req.user.id);
    if (!follow || ['removed', 'blocked'].includes(follow.status)) {
      return res.status(404).json({ error: 'Audience relationship not found' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('PersonaMembership')
      .update({
        notification_level: req.body.notification_level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', follow.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update notification preference' });

    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: persona.user_id,
      personaId: persona.id,
      action: 'persona.follow_notification_updated',
      targetType: 'PersonaFollow',
      targetId: follow.id,
      metadata: {
        previous_notification_level: follow.notification_level || 'none',
        notification_level: updated.notification_level,
      },
    });

    res.json({
      following: updated.status === 'active',
      status: updated.status || 'none',
      relationshipType: updated.relationship_type || null,
      notificationLevel: updated.notification_level || 'none',
    });
  } catch (err) {
    logger.error('personas.followPreferences.error', { error: err.message, personaId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

router.get('/:id/follow/status', verifyToken, async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });
    const follow = await getPersonaFollow(persona.id, req.user.id);
    res.json({
      following: follow?.status === 'active',
      status: follow?.status || 'none',
      relationshipType: follow?.relationship_type || null,
      notificationLevel: follow?.notification_level || 'none',
    });
  } catch (err) {
    logger.error('personas.followStatus.error', { error: err.message, personaId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch follow status' });
  }
});

module.exports = router;

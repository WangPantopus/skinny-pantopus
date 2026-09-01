const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { requireIdentityFirewallEnabled } = require('../utils/featureFlags');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const {
  ensureLocalProfile,
  getLocalProfileByHandle,
  getActivePersonaForUser,
  getPersonaByHandle,
  getPersonaById,
  getBridgeSetting,
} = require('../utils/identityProfiles');
const {
  serializePrivateAccount,
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializeBusinessSeatForViewer,
  serializeHomeIdentityForViewer,
  serializePostAuthorForViewer,
  sanitizePersonaPostForViewer,
} = require('../serializers/identitySerializers');
const { applyLocationPrecision, leastPrecise } = require('../utils/locationPrivacy');

router.use(requireIdentityFirewallEnabled);

const updateBridgeSchema = Joi.object({
  show_persona_on_local: Joi.boolean().required(),
  show_local_on_persona: Joi.boolean().required(),
  bridge_label: Joi.string().max(120).allow('', null).optional(),
});

const VIEWER_LABELS = {
  public: 'Public viewer',
  // P2.7 — unified-IA §8.2 — the 7 user-facing viewer modes (plus the
  // legacy `connection` alias of `neighbor` and the `gig_participant`
  // helper kept from earlier iterations).
  verified_local: 'Verified neighbor (same area)',
  persona_audience_member: 'Follower',
  persona_follower: 'Follower',
  persona_member: 'Member',
  persona_insider: 'Insider',
  creator_follower: 'Follower',
  neighbor: 'Neighbor',
  connection: 'Connection',
  household_member: 'Household member',
  business_teammate: 'Business teammate',
  gig_participant: 'Gig participant',
};

const VALID_VIEWERS = new Set(Object.keys(VIEWER_LABELS));

const SAFE_PREVIEW_POST_FIELDS = [
  'id',
  'title',
  'content',
  'media_urls',
  'media_types',
  'media_thumbnails',
  'post_type',
  'post_format',
  'visibility',
  'audience',
  'distribution_targets',
  'profile_visibility_scope',
  'show_on_profile',
  'location_precision',
  'location_name',
  'tags',
  'like_count',
  'comment_count',
  'created_at',
  'updated_at',
];

function normalizeViewer(viewer) {
  const normalized = String(viewer || 'public');
  // Persona-side aliases — the public API speaks `persona_follower`,
  // `creator_follower`, and the legacy `persona_audience_member` all
  // mean rank-1 audience member. Member/Insider map to ranks 2/3.
  if (normalized === 'creator_follower' || normalized === 'persona_follower') {
    return 'persona_audience_member';
  }
  return normalized;
}

function viewerContext(viewer) {
  const normalized = normalizeViewer(viewer);
  // `persona_member` (rank 2) and `persona_insider` (rank 3) are
  // tier-aware audience-member viewers — they inherit the audience-
  // member visibility AND additionally pass the tier rank to the
  // post/broadcast filters.
  const isTierMember = normalized === 'persona_member' || normalized === 'persona_insider';
  const isPersonaAudienceMember = normalized === 'persona_audience_member' || isTierMember;
  let personaTierRank = 0;
  if (normalized === 'persona_audience_member') personaTierRank = 1;
  else if (normalized === 'persona_member')  personaTierRank = 2;
  else if (normalized === 'persona_insider') personaTierRank = 3;
  return {
    viewer: normalized,
    viewerLabel: VIEWER_LABELS[normalized] || normalized.replace(/_/g, ' '),
    isPublic: normalized === 'public',
    isVerifiedLocal: normalized === 'verified_local',
    isPersonaAudienceMember,
    personaTierRank,
    isNeighbor: normalized === 'neighbor',
    isConnection: normalized === 'connection',
    isHouseholdMember: normalized === 'household_member',
    isBusinessTeammate: normalized === 'business_teammate',
    isGigParticipant: normalized === 'gig_participant',
  };
}

// P2.7 — unified-IA §8.2 — the proof-of-firewall list. Each entry is a
// personal-side identity field that the persona-zone serializer must
// strip out before returning to a viewer. The Privacy preview UI shows
// users which of these fields are absent from the actual serialized
// output so they can verify the firewall holds by inspection.
const ALL_IDENTITY_FIELDS = [
  'user_id', 'email', 'phone', 'name', 'first_name', 'last_name', 'legal_name',
  'address', 'city', 'state', 'zipcode', 'neighborhood', 'home_id',
  'gigHistory', 'marketplaceListings', 'localProfile', 'business',
  'personaHandle', 'personaDisplayName', 'fan_handle', 'fan_avatar_url',
  'created_at', 'updated_at',
];

function collectAllKeys(value, sink) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectAllKeys(item, sink);
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      sink.add(key);
      collectAllKeys(value[key], sink);
    }
  }
}

function computeHiddenKeys(serializedOutput) {
  if (!serializedOutput) return ALL_IDENTITY_FIELDS.slice();
  const present = new Set();
  collectAllKeys(serializedOutput, present);
  // A field counts as "hidden" only if it would normally exist on the
  // underlying record AND the serializer dropped it. Filter ALL_IDENTITY_
  // FIELDS down to the names that didn't survive the serialization.
  return ALL_IDENTITY_FIELDS.filter((field) => !present.has(field));
}

function safePostPreview(post, author, options = {}) {
  if (!post) return null;
  const source = { ...post };
  if (!options.isPersona) {
    const precision = leastPrecise(source.location_precision || 'approx_area', 'approx_area');
    applyLocationPrecision(source, precision, false);
    source.location_precision = precision;
  }
  const safe = {};
  for (const field of SAFE_PREVIEW_POST_FIELDS) {
    safe[field] = source[field] ?? null;
  }
  safe.author = author || null;
  if (options.isPersona) {
    return sanitizePersonaPostForViewer(safe);
  }
  return safe;
}

function serializeBroadcastPreview(message) {
  if (!message) return null;
  return {
    id: message.id,
    body: message.body || null,
    media: Array.isArray(message.media) ? message.media : [],
    visibility: message.visibility || 'followers',
    status: message.status || 'published',
    delivered_count: Number(message.delivered_count || 0),
    read_count: Number(message.read_count || 0),
    created_at: message.created_at || message.published_at || null,
    published_at: message.published_at || null,
  };
}

function personaPostVisibleToViewer(post, context) {
  if (!post) return false;
  if (post.archived_at || post.status === 'removed') return false;
  if (post.audience === 'public' || post.visibility === 'public') return true;
  const targets = Array.isArray(post.distribution_targets) ? post.distribution_targets : [];
  const followerOnly = post.audience === 'followers'
    || post.visibility === 'followers'
    || targets.includes('persona_followers');
  return followerOnly && context.isPersonaAudienceMember;
}

function broadcastVisibleToViewer(message, context) {
  if (!message || message.status === 'removed' || message.status === 'archived') return false;
  if (message.visibility === 'public') return true;
  if (!context.isPersonaAudienceMember) return false;
  if (message.visibility === 'followers') return true;
  // P2.7 — tier-or-above visibility honors the viewer's tier rank.
  // A Member preview (rank 2) sees every message with target_tier_rank
  // ≤ 2; Insider (rank 3) additionally sees rank-3 messages.
  if (message.visibility === 'tier_or_above') {
    const required = Number(message.target_tier_rank ?? 2);
    return (context.personaTierRank || 0) >= required;
  }
  return false;
}

function localPostVisibleToViewer(post, context) {
  if (!post) return false;
  if ((post.identity_context_type || 'local') === 'persona' || post.post_as === 'persona') return false;
  if (post.archived_at || post.status === 'removed') return false;
  if (post.show_on_profile !== true) return false;
  if (post.audience === 'household' || post.visibility === 'household') return false;

  const targets = Array.isArray(post.distribution_targets) ? post.distribution_targets.filter(Boolean) : [];
  if (targets.includes('persona_followers') || targets.includes('household')) return false;

  const scope = post.profile_visibility_scope || 'public';
  if (scope === 'hidden') return false;
  if (scope === 'connections' && !context.isConnection) return false;
  if (scope === 'followers' && !(context.isNeighbor || context.isConnection)) return false;

  const networkOnlyTargets = ['followers', 'connections', 'persona_followers', 'household'];
  if (targets.length > 0 && targets.every((target) => networkOnlyTargets.includes(target))) {
    if (targets.includes('connections')) return context.isConnection;
    if (targets.includes('followers')) return context.isNeighbor || context.isConnection;
    return false;
  }

  if ((post.visibility === 'connections' || post.audience === 'connections') && !context.isConnection) return false;
  if ((post.visibility === 'followers' || post.audience === 'followers') && !(context.isNeighbor || context.isConnection)) return false;

  return true;
}

async function getPersonaPreview({ persona, viewer }) {
  const context = viewerContext(viewer);
  const bridge = await getBridgeSetting(persona.user_id, persona.id);
  let bridgeLocalProfile = null;
  if (bridge?.show_local_on_persona) {
    const local = await ensureLocalProfile(persona.user_id);
    bridgeLocalProfile = serializeLocalProfileForViewer(local);
  }

  const [postResult, channelResult] = await Promise.all([
    supabaseAdmin
      .from('Post')
      .select('*')
      .eq('identity_context_type', 'persona')
      .eq('identity_context_id', persona.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('BroadcastChannel')
      .select('*')
      .eq('persona_id', persona.id)
      .maybeSingle(),
  ]);

  const allPosts = postResult.data || [];
  const visiblePosts = allPosts.filter((post) => personaPostVisibleToViewer(post, context));
  const personaAuthor = serializeAudienceProfileForViewer(persona, {
    isFollowing: context.isPersonaAudienceMember,
    followStatus: context.isPersonaAudienceMember ? 'active' : 'none',
    relationshipType: context.isPersonaAudienceMember ? 'follower' : null,
    notificationLevel: context.isPersonaAudienceMember ? 'all' : 'none',
    bridgeLocalProfile,
  });

  let allBroadcasts = [];
  if (channelResult.data?.id) {
    const { data: messages } = await supabaseAdmin
      .from('BroadcastMessage')
      .select('*')
      .eq('channel_id', channelResult.data.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);
    allBroadcasts = messages || [];
  }
  const visibleBroadcasts = allBroadcasts.filter((message) => broadcastVisibleToViewer(message, context));

  return {
    surface: 'persona',
    viewer: context.viewer,
    viewerLabel: context.viewerLabel,
    // P2.7 / unified-IA §8.2 — the new shape the Privacy preview page
    // consumes directly: `visible` is the actual serializer output (no
    // approximation) and `hidden` is the list of forbidden personal-
    // side fields the serializer dropped. Existing consumers (the
    // inline preview on /app/identity) keep using `profile` /
    // `visibleSections` / `protectedSections` below — the new fields
    // are additive.
    visible: personaAuthor,
    hidden: computeHiddenKeys(personaAuthor),
    profile: personaAuthor,
    context: {
      isAudienceMember: context.isPersonaAudienceMember,
      bridgeLocalProfileVisible: !!bridgeLocalProfile,
      localIdentityHidden: !bridgeLocalProfile,
      directChatAvailable: false,
    },
    visibleSections: [
      { key: 'profile', label: 'Beacon name, handle, avatar, bio, and public links' },
      { key: 'follower_count', label: 'Follower label and follower count' },
      { key: 'posts', label: context.isPersonaAudienceMember ? 'Public and follower-only Beacon posts' : 'Beacon posts only' },
      { key: 'updates', label: context.isPersonaAudienceMember ? 'Public and follower-only updates' : 'Public updates only' },
      ...(bridgeLocalProfile ? [{ key: 'profile_link_local', label: 'Explicitly approved Profile link' }] : []),
    ],
    protectedSections: [
      { key: 'private_account', label: 'Real name, email, phone, KYC, payments, and private account metadata' },
      { key: 'home', label: 'Home address, household membership, mailbox activity, and exact local location' },
      { key: 'local_life', label: 'Nearby posts, local comments, local reviews, gigs, marketplace listings, and local connections' },
      ...(!bridgeLocalProfile ? [{ key: 'profile_link_local', label: 'Profile is hidden because profile links are off' }] : []),
      { key: 'direct_chat', label: 'Followers cannot open direct chat to the private account from updates' },
    ],
    counts: {
      visiblePosts: visiblePosts.length,
      hiddenPosts: Math.max(0, allPosts.length - visiblePosts.length),
      visibleBroadcasts: visibleBroadcasts.length,
      hiddenBroadcasts: Math.max(0, allBroadcasts.length - visibleBroadcasts.length),
    },
    sample: {
      posts: visiblePosts.slice(0, 3).map((post) => safePostPreview(post, personaAuthor, { isPersona: true })).filter(Boolean),
      broadcasts: visibleBroadcasts.slice(0, 3).map(serializeBroadcastPreview).filter(Boolean),
    },
  };
}

async function getLocalPreview({ profile, viewer }) {
  const context = viewerContext(viewer);
  const persona = await getActivePersonaForUser(profile.user_id);
  const bridge = persona ? await getBridgeSetting(profile.user_id, persona.id) : null;
  const bridgePersona = bridge?.show_persona_on_local && persona
    ? serializeAudienceProfileForViewer(persona)
    : null;

  const { data: posts } = await supabaseAdmin
    .from('Post')
    .select('*')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(20);
  const allPosts = posts || [];
  const visiblePosts = allPosts.filter((post) => localPostVisibleToViewer(post, context));
  const localAuthor = serializeLocalProfileForViewer(profile, {
    relationshipStatus: context.isConnection ? 'accepted' : 'none',
    isFollowingLocal: context.isNeighbor || context.isConnection,
    canMessage: context.isConnection || context.isGigParticipant,
    bridgePersona,
  });

  return {
    surface: 'local',
    viewer: context.viewer,
    viewerLabel: context.viewerLabel,
    // P2.7 — see getPersonaPreview; same additive contract.
    visible: localAuthor,
    hidden: computeHiddenKeys(localAuthor),
    profile: localAuthor,
    context: {
      isNeighbor: context.isNeighbor,
      isConnection: context.isConnection,
      isHouseholdMember: context.isHouseholdMember,
      isGigParticipant: context.isGigParticipant,
      bridgePersonaVisible: !!bridgePersona,
      audienceIdentityHidden: !bridgePersona,
    },
    visibleSections: [
      { key: 'profile', label: 'Profile name, handle, avatar, bio, and local trust badges' },
      { key: 'locality', label: 'Public locality at the configured precision' },
      { key: 'activity', label: context.isConnection ? 'Public and connection-visible local activity' : 'Public local activity only' },
      ...(bridgePersona ? [{ key: 'profile_link_public', label: 'Explicitly approved Beacon link' }] : []),
    ],
    protectedSections: [
      { key: 'private_account', label: 'Real name, email, phone, legal identity, payment records, and KYC metadata' },
      { key: 'public_profile', label: bridgePersona ? 'Unapproved Beacon fields remain hidden' : 'Beacon handle, follower count, updates, posts, and public links are hidden because profile links are off' },
      { key: 'home', label: 'Exact home address, household details, mailbox activity, and private home access' },
      { key: 'public_profile_followers', label: 'Beacon followers never become local followers or connections' },
    ],
    counts: {
      visiblePosts: visiblePosts.length,
      hiddenPosts: Math.max(0, allPosts.length - visiblePosts.length),
      visibleBroadcasts: 0,
      hiddenBroadcasts: 0,
    },
    sample: {
      posts: visiblePosts.slice(0, 3).map((post) => safePostPreview(post, localAuthor, { isPersona: false })).filter(Boolean),
      broadcasts: [],
    },
  };
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, email, username, name, first_name, last_name, phone_number, address, city, state, zipcode, verified, account_type, profile_picture_url')
      .eq('id', userId)
      .maybeSingle();
    const localProfile = await ensureLocalProfile(userId);
    const persona = await getActivePersonaForUser(userId);
    const bridge = persona ? await getBridgeSetting(userId, persona.id) : null;

    const { data: homes } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home:home_id(id, name, city, state, primary_photo_url), role, role_base')
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data: seats } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat:seat_id(id, business_user_id, display_name, role_base, is_active)')
      .eq('user_id', userId);

    // P2.6 / unified-IA §8 — extra fields the unified Profiles & Privacy
    // surface needs: per-row role, personaCount (drives the empty-state
    // CTA), and the personal/audience block totals (the BlockListsCard
    // shows two counts but never reveals the cross-context cascade).
    const homesWithRole = (homes || [])
      .map((row) => {
        const serialized = serializeHomeIdentityForViewer(row.home);
        if (!serialized) return null;
        return { ...serialized, role: row.role || row.role_base || 'member' };
      })
      .filter(Boolean);

    const businessesWithRole = (seats || [])
      .map((row) => serializeBusinessSeatForViewer(row.seat))
      .filter(Boolean);

    // Block counts — fan-out queries kept narrow (head:true + count:exact).
    // Audience counts aggregate across every persona the user owns; the
    // per-persona breakdown is intentionally NOT returned here so the
    // overview can never leak the existence of a specific persona via
    // an audience-block count of 1.
    const [personalBlocksRes, ownedPersonasRes] = await Promise.all([
      supabaseAdmin
        .from('UserBlock')
        .select('id', { count: 'exact', head: true })
        .eq('blocker_user_id', userId),
      supabaseAdmin
        .from('PublicPersona')
        .select('id')
        .eq('user_id', userId),
    ]);

    const personaCount = (ownedPersonasRes.data || []).length;
    const personaIds = (ownedPersonasRes.data || []).map((p) => p.id);
    let audienceBlocks = 0;
    if (personaIds.length > 0) {
      const audienceRes = await supabaseAdmin
        .from('PersonaBlock')
        .select('id', { count: 'exact', head: true })
        .in('persona_id', personaIds);
      audienceBlocks = audienceRes.count || 0;
    }

    res.json({
      privateAccount: serializePrivateAccount(user),
      localProfile: serializeLocalProfileForViewer(localProfile, { includeLegacyUserId: true }),
      audienceProfile: persona ? serializeAudienceProfileForViewer(persona, { isOwner: true }) : null,
      bridges: bridge || {
        show_persona_on_local: false,
        show_local_on_persona: false,
      },
      homes: homesWithRole,
      businessProfiles: businessesWithRole,
      personaCount,
      blockCounts: {
        personal: personalBlocksRes.count || 0,
        audience: audienceBlocks,
      },
    });
  } catch (err) {
    logger.error('identityCenter.get.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to load Profiles & Privacy' });
  }
});

router.get('/view-as', verifyToken, async (req, res) => {
  try {
    const { surface, handle, viewer = 'public' } = req.query;
    // P2.7 — reject typos / unsupported modes up front so the preview
    // can never silently fall back to public visibility.
    if (!VALID_VIEWERS.has(String(viewer))) {
      return res.status(400).json({ error: 'invalid viewer mode', viewer });
    }
    // P2.7 — for the persona surface, fall back to the user's own
    // persona when no handle is supplied so the Privacy preview page
    // can preview the owner's persona without re-querying for the
    // handle. Same convenience the local branch already had.
    if (surface === 'persona' || surface === 'audience') {
      let persona = handle ? await getPersonaByHandle(handle) : await getActivePersonaForUser(req.user.id);
      if (!persona) return res.status(404).json({ error: 'Beacon not found' });
      return res.json(await getPersonaPreview({ persona, viewer }));
    }

    const local = handle ? await getLocalProfileByHandle(handle) : await ensureLocalProfile(req.user.id);
    if (!local) return res.status(404).json({ error: 'Profile not found' });
    return res.json(await getLocalPreview({ profile: local, viewer }));
  } catch (err) {
    logger.error('identityCenter.viewAs.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to build preview' });
  }
});

router.patch('/bridges/:personaId', verifyToken, validate(updateBridgeSchema), async (req, res) => {
  try {
    const persona = await getPersonaById(req.params.personaId);
    if (!persona) return res.status(404).json({ error: 'Beacon not found' });
    if (persona.user_id !== req.user.id) return res.status(403).json({ error: 'You cannot edit this bridge' });
    const previousBridge = await getBridgeSetting(req.user.id, persona.id);

    const payload = {
      user_id: req.user.id,
      persona_id: persona.id,
      show_persona_on_local: req.body.show_persona_on_local,
      show_local_on_persona: req.body.show_local_on_persona,
      bridge_label: req.body.bridge_label || null,
      updated_at: new Date().toISOString(),
    };

    const { data: bridge, error } = await supabaseAdmin
      .from('IdentityBridgeSetting')
      .upsert(payload, { onConflict: 'user_id,persona_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update bridge settings' });
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: req.user.id,
      personaId: persona.id,
      action: 'identity.bridge_updated',
      targetType: 'IdentityBridgeSetting',
      targetId: bridge.id,
      metadata: {
        previous: {
          show_persona_on_local: !!previousBridge?.show_persona_on_local,
          show_local_on_persona: !!previousBridge?.show_local_on_persona,
        },
        next: {
          show_persona_on_local: bridge.show_persona_on_local,
          show_local_on_persona: bridge.show_local_on_persona,
        },
      },
    });
    res.json({ bridge });
  } catch (err) {
    logger.error('identityCenter.bridge.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update bridge settings' });
  }
});

module.exports = router;

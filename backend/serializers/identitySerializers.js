// Context-specific identity serializers for the Pantopus Identity Firewall.

const { computeQuotaRemaining } = require('../utils/personaQuotas');

// Phase 0 / P0.3 — replace raw `creator:user_id (name, city, state, ...)`
// nested-select patterns with a safe column set. Audience Profile design v2
// §16 item 2 calls out the old CREATOR_SELECT as a leaky pattern that pulls
// User.name (legal name) and locality straight into API responses; routes
// then forward `row.creator` raw and the firewall is bypassed.
//
// Every supabase nested select that targets the User table for a creator,
// buyer, follower, or similar audience-side join MUST use this constant
// instead. Consumers must run the resulting `creator` row through
// serializeUserAsLocalIdentity (or the appropriate higher-level serializer)
// before returning it to a client.
//
// CI grep guards reject the literal string `CREATOR_SELECT` and any new
// nested select that names `name`, `first_name`, `last_name`, `city`, or
// `state` on User. See backend/scripts/ci/check-creator-select.js.
const SAFE_CREATOR_SELECT = 'id, username, profile_picture_url, account_type, verified, bio';

function stripNullish(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function cleanIdentityText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function fullNameFromUserParts(user) {
  const parts = [user?.first_name, user?.middle_name, user?.last_name]
    .map(cleanIdentityText)
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function sameDisplayValue(a, b) {
  const left = cleanIdentityText(a);
  const right = cleanIdentityText(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

// Public local identity policy: people should render by their public display
// name/name, not by handle, unless no name is available.
function displayNameFromUser(user) {
  if (!user) return 'Pantopus member';
  return (
    cleanIdentityText(user.display_name) ||
    cleanIdentityText(user.public_display_name) ||
    cleanIdentityText(user.name) ||
    fullNameFromUserParts(user) ||
    cleanIdentityText(user.first_name) ||
    cleanIdentityText(user.username) ||
    'Pantopus member'
  );
}

function displayNameFromLocalProfile(profile, user, handle) {
  const explicit = cleanIdentityText(profile.display_name);
  const userDisplayName = user ? displayNameFromUser(user) : null;
  const looksLikeHandleDefault =
    explicit && (
      sameDisplayValue(explicit, handle) ||
      sameDisplayValue(explicit, user?.username)
    );

  if (explicit && looksLikeHandleDefault && userDisplayName && !sameDisplayValue(explicit, userDisplayName)) {
    return userDisplayName;
  }

  if (explicit) {
    return explicit;
  }

  return userDisplayName || cleanIdentityText(handle) || 'Pantopus member';
}

// Whole-month difference between two Dates, never negative. Used by
// serializeFanForCreator to compute fan tenure without exposing the exact
// joined_at timestamp (Audience Profile v2 §6.1 + §17 Q4: month granularity
// reduces timing-attack correlation between persona-side and personal-side
// activity).
function monthsBetween(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return 0;
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const yearDiff = b.getFullYear() - a.getFullYear();
  const monthDiff = b.getMonth() - a.getMonth();
  return Math.max(0, yearDiff * 12 + monthDiff);
}

// Phase 0 / P0.4 — withLegacyPublicIdentityAliases removed.
// Audience Profile design v2 §16 item 3: the helper used to re-inject
// `username`, `name`, `first_name`, `profile_picture_url` onto every public
// identity object so legacy mobile/web clients could keep reading the old
// shape. Every consumer now reads `handle`, `displayName`, `avatarUrl`
// directly. The helper is gone; the names below are the only public
// identity contract.

const PERSONA_LOCAL_POST_FIELDS = [
  'home_id',
  'home',
  'latitude',
  'longitude',
  'effective_latitude',
  'effective_longitude',
  'location_name',
  'location_address',
  'target_place_id',
  'radius_miles',
  'gps_timestamp',
  'gps_latitude',
  'gps_longitude',
  'geocode_provider',
  'geocode_mode',
  'geocode_accuracy',
  'geocode_place_id',
  'geocode_source_flow',
  'geocode_created_at',
  'distance_meters',
];

const FORBIDDEN_PUBLIC_METADATA_KEY = /(^|_)(user|author|actor|owner|email|phone|address|home|legal|private|token|session|ip)(_|$)/i;

function sanitizePublicMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (FORBIDDEN_PUBLIC_METADATA_KEY.test(key)) return false;
      return value == null || ['string', 'number', 'boolean'].includes(typeof value);
    })
  );
}

function sanitizePersonaPostForViewer(post) {
  if (!post || post.identity_context_type !== 'persona') return post;
  const safe = { ...post };
  for (const field of PERSONA_LOCAL_POST_FIELDS) {
    delete safe[field];
  }
  safe.location_precision = null;
  safe.locationUnlocked = false;
  if (safe.post_metadata) safe.post_metadata = sanitizePublicMetadata(safe.post_metadata);
  if (safe.metadata) safe.metadata = sanitizePublicMetadata(safe.metadata);
  return safe;
}

function serializePrivateAccount(user) {
  if (!user) return null;
  return stripNullish({
    id: user.id,
    email: user.email,
    username: user.username,
    legalName: user.legal_name,
    name: user.name,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone || user.phone_number,
    phone_number: user.phone_number,
    address: user.address,
    city: user.city,
    state: user.state,
    zipcode: user.zipcode,
    verified: user.verified ?? user.address_verified ?? user.identity_verified ?? false,
    account_type: user.account_type,
    profile_picture_url: user.profile_picture_url,
  });
}

function serializeLocalProfileForViewer(profile, options = {}) {
  if (!profile) return null;
  const user = profile.user || profile.owner || null;
  const handle = profile.handle || user?.username || '';
  const displayName = displayNameFromLocalProfile(profile, user, handle);
  const badges = [];
  if (profile.show_verified_resident_badge !== false && (profile.verified_resident || user?.verified)) {
    badges.push('verified_resident');
  }

  const response = {
    type: 'local',
    id: profile.id,
    handle,
    displayName,
    avatarUrl: profile.avatar_url || user?.profile_picture_url || null,
    bio: profile.bio || user?.bio || null,
    tagline: profile.tagline || null,
    href: handle ? `/${handle}` : null,
    badges,
    locality: {
      city: profile.show_neighborhood === false ? null : (profile.public_city || null),
      state: profile.show_neighborhood === false ? null : (profile.public_state || null),
      neighborhood: profile.show_neighborhood ? (profile.public_neighborhood || null) : null,
      precision: profile.show_neighborhood ? 'neighborhood' : 'city',
    },
    stats: {
      reviews: profile.review_count || user?.review_count || user?.total_reviews || 0,
      gigsCompleted: profile.show_gig_history === false ? null : (profile.gigs_completed || user?.gigs_completed || 0),
      marketplaceSales: profile.marketplace_sales || 0,
    },
    viewer: {
      relationshipStatus: options.relationshipStatus || 'none',
      isFollowingLocal: !!options.isFollowingLocal,
      canMessage: !!options.canMessage,
    },
    bridges: {
      audienceProfile: options.bridgePersona || null,
    },
  };

  if (options.includeLegacyUserId) {
    response.userId = profile.user_id || user?.id || null;
  }

  return response;
}

function serializeAudienceProfileForViewer(persona, options = {}) {
  if (!persona) return null;
  const handle = persona.handle || '';
  return {
    type: 'persona',
    id: persona.id,
    handle,
    displayName: persona.display_name || handle || 'Audience profile',
    avatarUrl: persona.avatar_url || null,
    bannerUrl: persona.banner_url || null,
    bio: persona.bio || null,
    href: handle ? `/@${handle}` : null,
    publicLinks: Array.isArray(persona.public_links) ? persona.public_links : [],
    category: persona.category || 'creator',
    audienceLabel: persona.audience_label || 'followers',
    audienceMode: persona.audience_mode || 'open',
    followerCount: persona.follower_count || 0,
    postCount: persona.post_count || 0,
    broadcastEnabled: persona.broadcast_enabled !== false,
    credential: {
      status: persona.credential_status || 'none',
      label: persona.credential_status === 'verified' ? 'Verified' : null,
    },
    organization: persona.organization_name
      ? {
          name: persona.organization_name,
          affiliationStatus: persona.organization_affiliation_status || 'none',
        }
      : null,
    viewer: {
      isFollowing: !!options.isFollowing,
      relationshipType: options.relationshipType || null,
      notificationLevel: options.notificationLevel || 'none',
      followStatus: options.followStatus || 'none',
      isOwner: !!options.isOwner,
    },
    bridges: {
      localProfile: options.bridgeLocalProfile || null,
    },
  };
}

function serializeCreatorProfileForViewer(persona, options = {}) {
  return serializeAudienceProfileForViewer(persona, options);
}

// The creator viewing a fan. Bidirectional firewall enforcement point —
// Audience Profile v2 §6.1, §13.3. The keys returned here are the creator's
// ENTIRE view of any fan; if a key isn't in this object the creator never
// sees it about this fan, ever.
//
// Forbidden by contract (verified by privacy-gate test):
//   user_id, email, phone, phone_number, name, first_name, last_name,
//   legal_name, address, city, state, zipcode, neighborhood, home_id,
//   gigHistory, marketplaceListings, localProfile, home, business,
//   bridges, stripe_customer_id, stripe_subscription_id.
//
// joined_at is exposed at MONTH granularity only (joinedMonth = "YYYY-MM").
// The exact day a fan subscribed correlates with the day they did things
// on the personal side; month is enough for the creator to see "fan tenure"
// without enabling timing-attack correlation.
//
// Required input: a PersonaMembership row joined to its tier and persona,
// with quota counts pre-fetched. Caller is responsible for the joins; the
// serializer is a pure transform with no DB calls.
//   {
//     id, fan_handle, fan_display_name, fan_avatar_url,
//     status, cancel_at_period_end, current_period_end, joined_at,
//     verified_local, verified_local_at,
//     tier:    { rank, name },
//     persona: { verified_local_discovery_enabled },
//     quota:   { msgThreadsLimit, msgThreadsUsed,
//                videoCallsLimit, videoCallsUsed }
//   }
function serializeFanForCreator(membership) {
  if (!membership) return null;
  const tier = membership.tier || {};
  const quota = membership.quota || {};
  const persona = membership.persona || {};

  let joinedMonth = null;
  let tenureMonths = 0;
  if (membership.joined_at) {
    const joined = new Date(membership.joined_at);
    if (!Number.isNaN(joined.getTime())) {
      joinedMonth = joined.toISOString().slice(0, 7);
      tenureMonths = monthsBetween(joined, new Date());
    }
  }

  // verified_local is shown to the creator only when the persona has
  // explicitly opted in to verified-local discovery (Invariant 5). When
  // the persona has not opted in, verifiedLocal is hard-false regardless
  // of the membership column, to prevent a leak via toggling the persona
  // setting and reading the badge.
  const verifiedLocal = persona.verified_local_discovery_enabled
    ? !!membership.verified_local
    : false;

  return stripNullish({
    membershipId: membership.id,
    fanHandle: membership.fan_handle,
    fanDisplayName: membership.fan_display_name || membership.fan_handle,
    fanAvatarUrl: membership.fan_avatar_url || null,
    tier: { rank: tier.rank, name: tier.name },
    joinedMonth,
    tenureMonths,
    status: membership.status,
    cancelAtPeriodEnd: !!membership.cancel_at_period_end,
    currentPeriodEnd: membership.current_period_end,
    verifiedLocal,
    quotaRemaining: {
      msgThreads: computeQuotaRemaining(quota.msgThreadsLimit, quota.msgThreadsUsed),
      videoCalls: computeQuotaRemaining(quota.videoCallsLimit, quota.videoCallsUsed),
    },
  });
}

// The fan viewing their own membership. Audience Profile v2 §6.1.
//
// The persona is rendered via serializeAudienceProfileForViewer, which
// already enforces the persona→personal direction. The membership-side
// fields here never reference the persona owner's personal identity by
// construction — we never query LocalProfile, Home, or Business when
// building this output.
//
// Tier output deliberately includes the policy fields a fan needs before
// taking any action (msg_threads_per_period, reply_policy,
// creator_can_initiate_dm). Stripe identifiers (customer/subscription)
// are platform-only and never exposed.
//
// Required input: PersonaMembership row joined to its tier and persona,
// plus pre-fetched quota counts on `membership.quota`.
function serializeMembershipForFan(membership, options = {}) {
  if (!membership) return null;
  const tier = membership.tier || {};
  const quota = membership.quota || {};
  const persona = membership.persona;
  return stripNullish({
    membershipId: membership.id,
    persona: persona ? serializeAudienceProfileForViewer(persona, options) : null,
    fanHandle: membership.fan_handle,
    fanDisplayName: membership.fan_display_name || membership.fan_handle,
    fanAvatarUrl: membership.fan_avatar_url || null,
    tier: {
      id: tier.id,
      rank: tier.rank,
      name: tier.name,
      priceCents: tier.price_cents,
      currency: tier.currency,
      billingInterval: tier.billing_interval,
      msgThreadsPerPeriod: tier.msg_threads_per_period,
      creatorCanInitiateDm: !!tier.creator_can_initiate_dm,
      replyPolicy: tier.reply_policy,
    },
    status: membership.status,
    cancelAtPeriodEnd: !!membership.cancel_at_period_end,
    currentPeriodStart: membership.current_period_start,
    currentPeriodEnd: membership.current_period_end,
    scheduledTierChange: membership.scheduled_tier_change_id
      ? { tierId: membership.scheduled_tier_change_id }
      : null,
    quotaRemaining: {
      msgThreads: computeQuotaRemaining(quota.msgThreadsLimit, quota.msgThreadsUsed),
      videoCalls: computeQuotaRemaining(quota.videoCallsLimit, quota.videoCallsUsed),
    },
  });
}

// One row of the fan's followed-beacons list (Beacons You Follow screen).
// Pure transform: the caller pre-joins persona + tier and passes the
// computed latest post and unread count via `extras`.
//
// Privacy: this row is rendered to the fan only — never to the persona
// owner. fan_handle is included so the fan can recall the pseudonym they
// used to follow this beacon. No personal-identity fields are referenced.
//
// Required input:
//   membership: {
//     id, fan_handle, notification_level, muted_until,
//     status, joined_at, last_seen_at,
//     persona:  { id, handle, display_name, avatar_url, status,
//                 credential_status, follower_count },
//     tier:     { rank, name, price_cents } | null,
//   }
//   extras: {
//     latestPost: { id, title, content, created_at } | null,
//     unreadCount: number,
//   }
function serializeFollowingRow(membership, extras = {}) {
  if (!membership) return null;
  const persona = membership.persona || {};
  const tier = membership.tier || null;
  const latestPost = extras.latestPost || null;

  const mutedUntilDate = membership.muted_until ? new Date(membership.muted_until) : null;
  const isMuted = !!mutedUntilDate && mutedUntilDate.getTime() > Date.now();

  const paidTier = tier && Number(tier.rank || 0) > 1
    ? { rank: Number(tier.rank), name: tier.name || null, priceCents: Number(tier.price_cents || 0) }
    : null;

  let snippet = null;
  if (latestPost) {
    const raw = latestPost.title || latestPost.content || '';
    snippet = raw.length > 100 ? `${raw.slice(0, 97).trimEnd()}…` : raw;
  }

  return {
    membershipId: membership.id,
    persona: {
      id: persona.id,
      handle: persona.handle,
      displayName: persona.display_name || persona.handle || 'Beacon',
      avatarUrl: persona.avatar_url || null,
      status: persona.status || 'active',
      verified: persona.credential_status === 'verified',
    },
    fanHandle: membership.fan_handle || null,
    notificationLevel: membership.notification_level || 'all',
    mutedUntil: isMuted ? mutedUntilDate.toISOString() : null,
    paidTier,
    latestPost: latestPost
      ? {
          id: latestPost.id,
          snippet,
          createdAt: latestPost.created_at,
        }
      : null,
    unreadCount: Math.max(0, Number(extras.unreadCount || 0)),
    followedAt: membership.joined_at,
    lastSeenAt: membership.last_seen_at || null,
  };
}

function serializeBusinessSeatForViewer(seat) {
  if (!seat) return null;
  return {
    type: 'business',
    id: seat.id || seat.business_user_id,
    businessId: seat.business_user_id || seat.business_id || null,
    handle: seat.business_username || null,
    displayName: seat.display_name || seat.business_name || seat.name || 'Business',
    avatarUrl: seat.display_avatar_url || seat.logo_url || null,
    role: seat.role_base || seat.role || null,
    href: seat.business_username ? `/b/${seat.business_username}` : null,
  };
}

function serializeUserAsLocalIdentity(user, options = {}) {
  if (!user) return null;
  const handle = user.handle || user.username || '';
  const publicDisplayName = displayNameFromUser(user);
  return serializeLocalProfileForViewer({
    id: user.local_profile_id || user.localProfileId || user.id,
    user_id: user.id,
    handle,
    display_name: publicDisplayName,
    avatar_url: user.avatar_url || user.profile_picture_url || null,
    public_city: options.includeLocality ? (user.public_city || user.city || null) : null,
    public_state: options.includeLocality ? (user.public_state || user.state || null) : null,
    verified_resident: user.verified_resident || user.verified || false,
    review_count: user.review_count,
    gigs_completed: user.gigs_completed,
    user,
  }, options);
}

function serializeUserIdentityForViewer(user, options = {}) {
  if (!user) return null;
  if (options.identityType === 'business' || user.account_type === 'business') {
    return serializeBusinessSeatForViewer({
      id: user.business_seat_id || user.id,
      business_user_id: user.id,
      display_name: user.display_name || user.business_name || displayNameFromUser(user),
      display_avatar_url: user.avatar_url || user.profile_picture_url || null,
      role_base: user.role_base || 'business',
      business_username: user.username || null,
    });
  }
  return serializeUserAsLocalIdentity(user, options);
}

function serializeHomeIdentityForViewer(home) {
  if (!home) return null;
  return {
    type: 'home',
    id: home.id,
    displayName: home.name || home.city || 'Home',
    avatarUrl: home.primary_photo_url || null,
    locality: {
      city: home.city || null,
      state: home.state || null,
    },
  };
}

function serializePostAuthorForViewer(post) {
  if (!post) return null;
  if (post.identity_context_type === 'persona' && post.persona) {
    return serializeAudienceProfileForViewer(post.persona);
  }
  if (post.identity_context_type === 'business' && (post.business_author || post.business)) {
    return serializeBusinessSeatForViewer(post.business_author || post.business);
  }
  if (post.identity_context_type === 'home' && post.home) {
    return serializeHomeIdentityForViewer(post.home);
  }
  if (post.local_profile) {
    return serializeLocalProfileForViewer(post.local_profile);
  }
  if (post.creator) {
    return serializeUserAsLocalIdentity({
      id: post.creator.local_profile_id || post.creator.id,
      local_profile_id: post.creator.local_profile_id || post.creator.id,
      handle: post.creator.username,
      username: post.creator.username,
      display_name: post.creator.display_name,
      public_display_name: post.creator.public_display_name,
      name: post.creator.name,
      first_name: post.creator.first_name,
      middle_name: post.creator.middle_name,
      last_name: post.creator.last_name,
      profile_picture_url: post.creator.profile_picture_url,
      verified: post.creator.verified,
    });
  }
  return null;
}

const serializeGigAuthorForViewer = serializePostAuthorForViewer;
const serializeListingAuthorForViewer = serializePostAuthorForViewer;

function serializeChatSenderForViewer(message) {
  if (!message) return null;
  return serializeUserAsLocalIdentity(message.sender);
}

module.exports = {
  displayNameFromUser,
  SAFE_CREATOR_SELECT,
  serializePrivateAccount,
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializeCreatorProfileForViewer,
  serializeFanForCreator,
  serializeFollowingRow,
  serializeMembershipForFan,
  serializeUserAsLocalIdentity,
  serializeUserIdentityForViewer,
  serializeBusinessSeatForViewer,
  serializeHomeIdentityForViewer,
  serializePostAuthorForViewer,
  serializeGigAuthorForViewer,
  serializeListingAuthorForViewer,
  serializeChatSenderForViewer,
  sanitizePersonaPostForViewer,
};

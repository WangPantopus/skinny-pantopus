/**
 * P0.7 Gate 1: serializer forbidden-keys contract.
 *
 * Audience Profile design v2 §6.1 + §13: every public identity serializer
 * has a forbidden-keys contract. A serializer that returns a User row,
 * email, address, locality, or a cross-context bridge field has bypassed
 * the firewall. This test runs each serializer over a fixture that
 * deliberately includes those forbidden values on the input — and asserts
 * none of them surface anywhere in the output, however deeply nested.
 *
 * Note: the prompt suggested tests/integration/privacy/. Integration tests
 * here require a live Supabase instance; the forbidden-keys check is a
 * pure unit-level contract on serializer output (no DB needed) so we run
 * it as a unit test that ships with every PR via the default jest config.
 * `npm run test:privacy` runs all P0.7 gates for fast local feedback.
 */

const {
  serializeAudienceProfileForViewer,
  serializeLocalProfileForViewer,
  serializeBusinessSeatForViewer,
  serializeUserAsLocalIdentity,
  serializePostAuthorForViewer,
  serializeFanForCreator,
  serializeMembershipForFan,
} = require('../../../serializers/identitySerializers');

// Recursively walk the response tree and report every key path that
// matches one of the forbidden names. Catches deep / nested leaks
// (e.g. `bridges.localProfile.email` if a future serializer change
// regresses the firewall).
function findForbiddenKeys(value, forbidden, path = '') {
  const violations = [];
  if (value == null || typeof value !== 'object') return violations;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      violations.push(...findForbiddenKeys(item, forbidden, `${path}[${idx}]`));
    });
    return violations;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (forbidden.includes(key)) violations.push(fullPath);
    violations.push(...findForbiddenKeys(child, forbidden, fullPath));
  }
  return violations;
}

// Value-based leak detector. Some output fields legitimately use names
// that overlap with forbidden ones (e.g. `tier.name` is the tier label
// "Member"; `bridges.localProfile` is the bridge slot name). The
// forbidden-keys check would false-positive on those, so we complement
// it with a value-based check: walk the output and assert that NONE
// of the leaked input values appears as a leaf string anywhere.
//
// Uses exact-equality, NOT substring matching — substring matching
// false-positives on legitimate output values that contain a forbidden
// substring (e.g. fixture User.first_name "Maya" is a substring of the
// persona's public display name "Maya Builds", which IS supposed to
// be in the audience-side output).
function findForbiddenValues(value, forbiddenValues, path = '') {
  const violations = [];
  if (value == null) return violations;
  if (typeof value === 'string' || typeof value === 'number') {
    if (forbiddenValues.some((v) => v != null && String(v) === String(value))) {
      violations.push(path);
    }
    return violations;
  }
  if (typeof value !== 'object') return violations;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      violations.push(...findForbiddenValues(item, forbiddenValues, `${path}[${idx}]`));
    });
    return violations;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = path ? `${path}.${key}` : key;
    violations.push(...findForbiddenValues(child, forbiddenValues, fullPath));
  }
  return violations;
}

// Fixture builders intentionally seed every forbidden field on the input
// — if the serializer doesn't strip them, the test surfaces the leak.
function fixtureUser() {
  return {
    id: 'user-1',
    username: 'mayabuilds',
    name: 'Maya Builder',
    first_name: 'Maya',
    last_name: 'Builder',
    legal_name: 'Maya Q. Builder',
    email: 'maya@example.test',
    phone: '+1-555-0123',
    phone_number: '+1-555-0123',
    address: '123 Main St',
    city: 'Camas',
    state: 'WA',
    zipcode: '98607',
    home_id: 'home-secret',
    profile_picture_url: 'https://cdn.example/avatar.jpg',
    verified: true,
  };
}

function fixturePersona() {
  return {
    id: 'persona-1',
    user_id: 'user-1', // private; must NOT surface
    handle: 'mayabuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    avatar_url: 'https://cdn.example/maya.jpg',
    banner_url: null,
    bio: 'Building things',
    public_links: [{ label: 'Site', url: 'https://example.test' }],
    category: 'creator',
    audience_label: 'followers',
    audience_mode: 'open',
    follower_count: 12,
    post_count: 4,
    broadcast_enabled: true,
    credential_status: 'none',
    organization_name: null,
    organization_affiliation_status: 'none',
    // The owner User row is intentionally seeded on the persona input —
    // the serializer must strip it.
    owner: fixtureUser(),
  };
}

function fixtureLocalProfile() {
  return {
    id: 'lp-1',
    user_id: 'user-1', // private; must NOT surface
    handle: 'mayabuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'mayabuilds',
    avatar_url: 'https://cdn.example/avatar.jpg',
    bio: 'Local profile bio',
    public_city: 'Camas',
    public_state: 'WA',
    public_neighborhood: 'Prune Hill',
    show_neighborhood: true,
    show_verified_resident_badge: true,
    show_gig_history: true,
    verified_resident: true,
    review_count: 3,
    gigs_completed: 7,
    user: fixtureUser(),
  };
}

// Persona row that includes the maximally-leaky owner-side fields the
// route layer might accidentally join in (User row, LocalProfile, Home,
// Business). serializeFanForCreator / serializeMembershipForFan must
// never echo any of these to the consuming side.
function fixturePersonaWithOwner() {
  return {
    ...fixturePersona(),
    user_id: 'user-1', // private; must NOT surface
    user: fixtureUser(),
    local_profile: fixtureLocalProfile(),
    home: { id: 'home-secret', name: 'Owner Home', city: 'Camas', state: 'WA' },
    business: { id: 'biz-1', business_username: 'corner_cafe', business_name: 'Corner Cafe' },
  };
}

// PersonaMembership row + the joined tier/persona/quota structure the
// audience-side serializers expect. Overrides shallow-merge so individual
// tests can flip a single field without rebuilding the whole object.
function fixtureFanMembership(overrides = {}) {
  const base = {
    id: 'membership-1',
    persona_id: 'persona-1',
    user_id: 'user-fan-1', // private; must NOT surface
    fan_handle: 'lurker_a8f3',
    fan_handle_normalized: 'lurker_a8f3',
    fan_display_name: 'lurker_a8f3',
    fan_avatar_url: null,
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: '2026-04-15T00:00:00Z',
    current_period_end: '2026-05-15T00:00:00Z',
    joined_at: '2026-03-15T08:42:11Z',
    canceled_at: null,
    verified_local: false,
    verified_local_at: null,
    scheduled_tier_change_id: null,
    // Stripe identifiers — never serialized.
    stripe_customer_id: 'cus_secret',
    stripe_subscription_id: 'sub_secret',
    // The fan's joined User row, intentionally leaked into the input. The
    // serializer must NOT surface any field of it.
    user: fixtureUser(),
    local_profile: fixtureLocalProfile(),
    tier: {
      id: 'tier-1',
      rank: 2,
      name: 'Member',
      price_cents: 500,
      currency: 'USD',
      billing_interval: 'month',
      msg_threads_per_period: 5,
      creator_can_initiate_dm: false,
      reply_policy: 'discretion',
    },
    persona: {
      ...fixturePersona(),
      verified_local_discovery_enabled: false,
    },
    quota: {
      msgThreadsLimit: 5,
      msgThreadsUsed: 2,
      videoCallsLimit: null,
      videoCallsUsed: 0,
    },
  };
  const merged = { ...base, ...overrides };
  if (overrides.tier) merged.tier = { ...base.tier, ...overrides.tier };
  if (overrides.persona) merged.persona = { ...base.persona, ...overrides.persona };
  if (overrides.quota) merged.quota = { ...base.quota, ...overrides.quota };
  return merged;
}

function fixtureSeat() {
  return {
    id: 'seat-1',
    business_user_id: 'biz-user-1', // private; must NOT surface
    business_username: 'corner_cafe',
    business_name: 'Corner Cafe',
    display_name: 'Corner Cafe',
    display_avatar_url: 'https://cdn.example/biz.jpg',
    role_base: 'owner',
    // Seed the bound user's User-row fields on the seat — the serializer
    // must NOT echo these to a viewer.
    bound_user: fixtureUser(),
  };
}

// Forbidden-key sets per surface. The audience-profile design is the source
// of truth (§6.1, §13.3). The lists target raw User-personal data fields
// (email, phone, address, …) that should NEVER appear anywhere in the
// response — at any nesting depth. Legitimate bridge SLOTS like
// `bridges.localProfile` and `bridges.audienceProfile` are tested
// separately (the slot value MUST be null when the bridge is off; when on
// the slot's content is itself privacy-clean, exercised in its own test).
const PERSONA_FORBIDDEN = [
  // Private-account fields. Never on a persona response, ever.
  'user_id', 'email', 'phone', 'phone_number', 'legal_name', 'address',
  'zipcode', 'home_id',
  'name', 'first_name', 'last_name',
  // Locality on a persona is forbidden by default — verified-local is a
  // separate Phase 1.1 surface and even there exposes a binary badge,
  // never raw city/state.
  'public_city', 'public_state', 'public_neighborhood',
  // Persona response must never carry personal-side activity slots.
  'gigHistory', 'gigsCompleted', 'marketplaceListings', 'marketplaceSales',
];

const LOCAL_FORBIDDEN_NO_BRIDGE = [
  // Private-account fields.
  'user_id', 'email', 'phone', 'phone_number', 'legal_name', 'address',
  'zipcode', 'home_id',
  // The legacy aliases retired in P0.4 — defense in depth in case anyone
  // re-introduces them.
  'profile_picture_url',
  'first_name', 'last_name',
];

const BUSINESS_FORBIDDEN = [
  'user_id', 'business_user_id', 'email', 'phone', 'phone_number',
  'legal_name', 'address', 'zipcode', 'home_id',
  'name', 'first_name', 'last_name',
  'public_city', 'public_state', 'public_neighborhood',
];

// FAN_FORBIDDEN: scaffolding for serializeFanForCreator (Phase 1).
// Documented here so the contract is in place before the serializer lands.
const FAN_FORBIDDEN = [
  'user_id', 'email', 'phone', 'phone_number', 'name', 'first_name',
  'last_name', 'legal_name', 'address', 'city', 'state', 'zipcode',
  'home_id', 'localProfile', 'home', 'business',
];

describe('P0.7 Gate 1 — serializer forbidden-keys contract', () => {
  test('serializeAudienceProfileForViewer never returns User-personal fields', () => {
    const out = serializeAudienceProfileForViewer(fixturePersona(), { isFollowing: false });
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, PERSONA_FORBIDDEN);
    expect(violations).toEqual([]);
  });

  test('serializeAudienceProfileForViewer with bridgeLocalProfile only exposes the safe LocalProfile shape', () => {
    const localProfile = serializeLocalProfileForViewer(fixtureLocalProfile());
    const out = serializeAudienceProfileForViewer(fixturePersona(), {
      isFollowing: true,
      bridgeLocalProfile: localProfile,
    });
    // The bridge slot may carry a LocalProfile, but that LocalProfile is
    // itself privacy-clean (no email/phone/user_id).
    expect(out.bridges.localProfile).toBeTruthy();
    const bridgeOnly = out.bridges.localProfile;
    const bridgeViolations = findForbiddenKeys(bridgeOnly, [
      'user_id', 'email', 'phone', 'phone_number', 'legal_name', 'address',
      'zipcode', 'home_id',
    ]);
    expect(bridgeViolations).toEqual([]);
  });

  test('serializeLocalProfileForViewer (no bridge) never returns persona fields', () => {
    const out = serializeLocalProfileForViewer(fixtureLocalProfile());
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, LOCAL_FORBIDDEN_NO_BRIDGE);
    expect(violations).toEqual([]);
  });

  test('serializeLocalProfileForViewer (no bridge) returns bridges.audienceProfile === null', () => {
    const out = serializeLocalProfileForViewer(fixtureLocalProfile());
    expect(out.bridges.audienceProfile).toBeNull();
  });

  test('serializeBusinessSeatForViewer never returns the bound User row', () => {
    const out = serializeBusinessSeatForViewer(fixtureSeat());
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, BUSINESS_FORBIDDEN);
    expect(violations).toEqual([]);
  });

  test('serializeUserAsLocalIdentity never returns email / phone / address', () => {
    const out = serializeUserAsLocalIdentity(fixtureUser());
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, [
      'email', 'phone', 'phone_number', 'legal_name', 'address',
      'zipcode', 'home_id', 'user_id',
    ]);
    expect(violations).toEqual([]);
  });

  test('serializePostAuthorForViewer (local context) drops User-personal fields', () => {
    const out = serializePostAuthorForViewer({
      identity_context_type: 'local',
      creator: fixtureUser(),
    });
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, [
      'email', 'phone', 'phone_number', 'legal_name', 'address',
      'zipcode', 'home_id', 'user_id',
    ]);
    expect(violations).toEqual([]);
  });

  test('serializePostAuthorForViewer (persona context) inherits the persona contract', () => {
    const out = serializePostAuthorForViewer({
      identity_context_type: 'persona',
      persona: fixturePersona(),
    });
    expect(out).not.toBeNull();
    const violations = findForbiddenKeys(out, PERSONA_FORBIDDEN);
    expect(violations).toEqual([]);
  });

  // --- Helper exposure tests -------------------------------------------------
  test('findForbiddenKeys finds nested matches', () => {
    expect(findForbiddenKeys({ a: { b: { email: 'x' } } }, ['email'])).toEqual(['a.b.email']);
    expect(findForbiddenKeys({ list: [{ email: 'x' }, { ok: 1 }] }, ['email']))
      .toEqual(['list[0].email']);
    expect(findForbiddenKeys({ a: 1, b: 2 }, ['email'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1.3 — Audience-side bidirectional firewall serializers.
//
// Audience Profile design v2 §6.1, §13.3. These describe blocks land
// alongside the P0 gate suite so every PR runs the same forbidden-keys
// contract over the new audience-side serializers.
// ---------------------------------------------------------------------------

describe('serializeFanForCreator (audience-profile v2 §6.1)', () => {
  test('never returns user_id / email / phone / real-name fields', () => {
    const result = serializeFanForCreator(fixtureFanMembership());
    // `name` is intentionally NOT in this key-list because the legitimate
    // output includes `tier.name` (the tier label "Member" / "Insider").
    // The leaked User.name VALUE is checked separately via
    // findForbiddenValues below.
    const forbidden = [
      'user_id', 'email', 'phone', 'phone_number',
      'first_name', 'last_name', 'legal_name',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);

    const u = fixtureUser();
    expect(findForbiddenValues(result, [
      u.id, u.email, u.phone, u.phone_number,
      u.name, u.first_name, u.last_name, u.legal_name,
    ])).toEqual([]);
  });

  test('never returns LocalProfile fields, address, neighborhood, home_id', () => {
    const result = serializeFanForCreator(fixtureFanMembership());
    const forbidden = [
      'localProfile', 'local_profile', 'address',
      'city', 'state', 'zipcode', 'public_city', 'public_state',
      'neighborhood', 'public_neighborhood', 'home_id',
      'gigHistory', 'gigsCompleted', 'marketplaceListings',
      'marketplaceSales', 'bridges',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);

    const u = fixtureUser();
    const lp = fixtureLocalProfile();
    expect(findForbiddenValues(result, [
      u.address, u.city, u.state, u.zipcode, u.home_id,
      lp.public_neighborhood,
    ])).toEqual([]);
  });

  test('never leaks Stripe identifiers', () => {
    const result = serializeFanForCreator(fixtureFanMembership());
    const forbidden = [
      'stripe_customer_id', 'stripe_subscription_id',
      'stripeCustomerId', 'stripeSubscriptionId',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);
  });

  test('reports joined_at at month granularity, never the exact date', () => {
    const result = serializeFanForCreator(
      fixtureFanMembership({ joined_at: '2026-03-15T08:42:11Z' }),
    );
    expect(result.joinedMonth).toBe('2026-03');
    expect(result).not.toHaveProperty('joined_at');
    expect(result).not.toHaveProperty('joinedAt');
  });

  test('hides verifiedLocal when the persona has not opted in', () => {
    const result = serializeFanForCreator(fixtureFanMembership({
      verified_local: true,
      persona: { verified_local_discovery_enabled: false },
    }));
    expect(result.verifiedLocal).toBe(false);
  });

  test('exposes verifiedLocal when the persona has opted in AND the fan is verified', () => {
    const result = serializeFanForCreator(fixtureFanMembership({
      verified_local: true,
      persona: { verified_local_discovery_enabled: true },
    }));
    expect(result.verifiedLocal).toBe(true);
  });

  test('returns the fan-handle as fanDisplayName when fan_display_name is unset', () => {
    const result = serializeFanForCreator(fixtureFanMembership({
      fan_display_name: null,
    }));
    expect(result.fanDisplayName).toBe('lurker_a8f3');
  });

  test('contains only the documented top-level keys (positive contract)', () => {
    const result = serializeFanForCreator(fixtureFanMembership());
    const allowed = new Set([
      'membershipId', 'fanHandle', 'fanDisplayName', 'fanAvatarUrl',
      'tier', 'joinedMonth', 'tenureMonths', 'status',
      'cancelAtPeriodEnd', 'currentPeriodEnd', 'verifiedLocal',
      'quotaRemaining',
    ]);
    for (const key of Object.keys(result)) {
      expect(allowed.has(key)).toBe(true);
    }
  });

  test('never indicates whether the fan is also a personal connection', () => {
    // The serializer takes no "is personal connection" input. This test
    // pins that contract: even with maximally-leaky owner-side fields on
    // the persona join, the output never exposes any signal that joins
    // the personal side to the audience side.
    const result = serializeFanForCreator(fixtureFanMembership({
      persona: fixturePersonaWithOwner(),
    }));
    const forbidden = [
      'isPersonalConnection', 'is_personal_connection',
      'sharedPersonalRelationship', 'isNeighbor', 'isHouseholdMember',
      'isMarketplaceCounterparty', 'localRelationship', 'crossContext',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);
  });
});

describe('serializeMembershipForFan (audience-profile v2 §6.1)', () => {
  test('never returns persona-owner User or LocalProfile fields', () => {
    const result = serializeMembershipForFan(fixtureFanMembership({
      persona: fixturePersonaWithOwner(),
    }));
    // `name` is excluded — `tier.name` is a legitimate tier label.
    // `localProfile` / `local_profile` are excluded — `persona.bridges
    // .localProfile` is the legitimate (null when off) bridge slot from
    // serializeAudienceProfileForViewer; the value-based check below
    // catches actual content leaks if the bridge slot is ever populated
    // from owner-side data.
    const forbidden = [
      'user_id', 'email', 'phone', 'phone_number',
      'first_name', 'last_name', 'legal_name',
      'address', 'city', 'state', 'zipcode',
      'public_city', 'public_state', 'public_neighborhood',
      'home_id', 'home', 'business',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);

    const u = fixtureUser();
    const lp = fixtureLocalProfile();
    expect(findForbiddenValues(result, [
      u.id, u.email, u.phone, u.phone_number,
      u.name, u.first_name, u.last_name, u.legal_name,
      u.address, u.city, u.state, u.zipcode, u.home_id,
      lp.public_neighborhood,
    ])).toEqual([]);
  });

  test('never leaks Stripe identifiers', () => {
    const result = serializeMembershipForFan(fixtureFanMembership());
    const forbidden = [
      'stripe_customer_id', 'stripe_subscription_id',
      'stripeCustomerId', 'stripeSubscriptionId',
    ];
    expect(findForbiddenKeys(result, forbidden)).toEqual([]);
  });

  test('exposes the tier reply policy so the fan knows what to expect', () => {
    const result = serializeMembershipForFan(fixtureFanMembership({
      tier: { reply_policy: 'within_7_days' },
    }));
    expect(result.tier.replyPolicy).toBe('within_7_days');
    expect(result.tier.creatorCanInitiateDm).toBe(false);
    expect(result.tier.msgThreadsPerPeriod).toBe(5);
  });

  test('embeds the persona via the standard audience-profile serializer', () => {
    const result = serializeMembershipForFan(fixtureFanMembership());
    expect(result.persona).toBeTruthy();
    expect(result.persona.type).toBe('persona');
    expect(result.persona.handle).toBe('mayabuilds');
    // The embedded persona must itself be privacy-clean.
    const personaViolations = findForbiddenKeys(result.persona, PERSONA_FORBIDDEN);
    expect(personaViolations).toEqual([]);
  });

  test('renders quota state from pre-fetched counts', () => {
    const result = serializeMembershipForFan(fixtureFanMembership({
      quota: { msgThreadsLimit: 5, msgThreadsUsed: 2,
               videoCallsLimit: null, videoCallsUsed: 0 },
    }));
    expect(result.quotaRemaining.msgThreads).toBe(3);
    expect(result.quotaRemaining.videoCalls).toBeNull();
  });

  test('returns scheduledTierChange only when one is pending', () => {
    const noChange = serializeMembershipForFan(fixtureFanMembership({
      scheduled_tier_change_id: null,
    }));
    expect(noChange.scheduledTierChange).toBeNull();

    const withChange = serializeMembershipForFan(fixtureFanMembership({
      scheduled_tier_change_id: 'tier-down-1',
    }));
    expect(withChange.scheduledTierChange).toEqual({ tierId: 'tier-down-1' });
  });
});

module.exports = { findForbiddenKeys, FAN_FORBIDDEN };

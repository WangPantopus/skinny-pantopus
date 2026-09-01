/**
 * P1.8 — privacy-handshake first-follow tests.
 *
 * Audience Profile design v2 §11.4 + §6.4 (free Follower mechanics).
 * Tests the new handshake branch of POST /api/personas/:id/follow plus
 * the GET /:handle/fan-handle-suggestion endpoint.
 *
 * Lives under tests/unit/ (not tests/integration/) so `npm test` runs
 * it; same convention as P1.4 / P1.5.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const express = require('express');
const request = require('supertest');

const featureFlagService = require('../../services/featureFlagService');
jest.mock('../../services/notificationService');
jest.mock('../../middleware/rateLimiter', () => ({
  personaFollowLimiter: (_req, _res, next) => next(),
}));
const notificationService = require('../../services/notificationService');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';

const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const OWNER_TWO_ID = '11111111-2222-4111-8111-111111111112';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID  = '33333333-3333-4333-8333-333333333333';
const SECOND_PERSONA_ID = '44444444-4444-4444-8444-444444444444';
const TIER_1_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const SECOND_TIER_1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas', personasRouter);
  return app;
}

function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function seedFlagOn() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: true, enabled_for_internal_team: false,
    beta_user_ids: [], description: '',
    created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedFlagOff() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: false, enabled_for_internal_team: false,
    beta_user_ids: [], description: '',
    created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedFixtures({ fanUsername = 'fan_personal_username_xyz' } = {}) {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner_personal_handle' },
    { id: OWNER_TWO_ID, role: 'user', username: 'second_owner_handle' },
    { id: FAN_ID,   role: 'user', username: fanUsername },
  ]);
  seedTable('PublicPersona', [
    {
      id: PERSONA_ID,
      user_id: OWNER_ID,
      handle: 'mayabuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      audience_mode: 'open',
      status: 'active',
      follower_count: 0,
      post_count: 0,
    },
    {
      id: SECOND_PERSONA_ID,
      user_id: OWNER_TWO_ID,
      handle: 'secondbeacon',
      handle_normalized: 'secondbeacon',
      display_name: 'Second Beacon',
      audience_mode: 'open',
      status: 'active',
      follower_count: 0,
      post_count: 0,
    },
  ]);
  seedTable('PersonaTier', [
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active', currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion', position: 1 },
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active', currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'discretion', position: 2 },
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      price_cents: 1500, status: 'active', currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: 'within_7_days', position: 3 },
    { id: SECOND_TIER_1_ID, persona_id: SECOND_PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active', currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion', position: 1 },
  ]);
  seedTable('LocalProfile', []);
  seedTable('PersonaMembership', []);
  seedTable('AudienceIdentity', []);
  seedTable('PersonaBlock', []);
  seedTable('IdentityBridgeSetting', []);
  seedTable('IdentityAuditLog', []);
}

const HANDSHAKE_BASE = {
  acknowledged_platform_trust: true,
};

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedFixtures();
  seedFlagOn();
});

afterEach(() => {
  featureFlagService.invalidateFlagCache();
});

describe('POST /api/personas/:id/follow — audience_profile flag boundary', () => {
  test('hides the handshake branch when the flag is disabled but keeps legacy follow available', async () => {
    seedFlagOff();

    const handshake = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'hidden_fan',
    });
    expect(handshake.status).toBe(404);
    expect(getTable('PersonaMembership')).toHaveLength(0);

    const legacy = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({});
    expect(legacy.status).toBe(201);
    expect(getTable('PersonaMembership')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Handshake (tier_rank = 1) — free Follower path.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — handshake (tier_rank = 1)', () => {
  test('creates an active membership with the supplied fan_handle and tier_id', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'lurker_a8f3',
      fan_display_name: 'lurker_a8f3',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.membership).toMatchObject({
      fan_handle: 'lurker_a8f3',
      tier_id: TIER_1_ID,
      status: 'active',
    });

    const stored = getTable('PersonaMembership');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      fan_handle: 'lurker_a8f3',
      tier_id: TIER_1_ID,
      status: 'active',
    });

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_membership.handshake'
                          && e.metadata?.tier_rank === 1)).toBe(true);
  });

  test('creates a pending membership and notifies the owner when approval is required', async () => {
    getTable('PublicPersona')[0].audience_mode = 'approval_required';

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'pending_fan_1',
      fan_display_name: 'Pending Fan',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.membership).toMatchObject({
      fan_handle: 'pending_fan_1',
      tier_id: TIER_1_ID,
      status: 'pending',
    });

    const stored = getTable('PersonaMembership');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      fan_handle: 'pending_fan_1',
      tier_id: TIER_1_ID,
      status: 'pending',
      source: 'follow_request',
    });

    expect(notificationService.notifyPersonaFollow).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: OWNER_ID,
      fanDisplayName: 'Pending Fan',
      fanHandle: 'pending_fan_1',
      membershipId: stored[0].id,
      personaId: PERSONA_ID,
      personaHandle: 'mayabuilds',
      followStatus: 'pending',
    }));

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_membership.handshake'
                          && e.metadata?.outcome === 'pending')).toBe(true);
  });

  test('accepts a dotted audience handle so Beacon-bound identities can follow', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'fan.with.dot',
    });

    expect(res.status).toBe(201);
    expect(res.body.membership.fan_handle).toBe('fan.with.dot');
  });

  test('lets an unused generated audience identity be customized on first follow', async () => {
    seedTable('AudienceIdentity', [{
      id: 'aud-unused-1',
      user_id: FAN_ID,
      public_persona_id: null,
      handle: 'fan_oldseed',
      handle_normalized: 'fan_oldseed',
      display_name: 'fan_oldseed',
      avatar_url: null,
      source: 'generated',
      status: 'active',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'chosen_fan_name',
    });

    expect(res.status).toBe(201);
    expect(res.body.membership.fan_handle).toBe('chosen_fan_name');
    expect(getTable('AudienceIdentity')).toHaveLength(1);
    expect(getTable('AudienceIdentity')[0]).toEqual(expect.objectContaining({
      id: 'aud-unused-1',
      handle: 'chosen_fan_name',
      handle_normalized: 'chosen_fan_name',
      source: 'user_selected',
    }));
  });

  test('an unused generated identity does not waive Pantopus username acknowledgement', async () => {
    seedTable('AudienceIdentity', [{
      id: 'aud-unused-1',
      user_id: FAN_ID,
      public_persona_id: null,
      handle: 'fan_oldseed',
      handle_normalized: 'fan_oldseed',
      display_name: 'fan_oldseed',
      avatar_url: null,
      source: 'generated',
      status: 'active',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'fan_personal_username_xyz',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('pantopus_username_requires_ack');
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });

  test('re-following with a new handle keeps the existing global audience identity', async () => {
    // First follow.
    await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'first_handle',
    });

    // Second follow with a different handle.
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'second_handle',
    });

    expect(res.status).toBe(201);
    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0].fan_handle).toBe('first_handle');
    expect(getTable('AudienceIdentity')).toHaveLength(1);
    expect(getTable('AudienceIdentity')[0].handle).toBe('first_handle');
  });

  test('following multiple Beacons uses one audience identity snapshot', async () => {
    await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'global_fan',
    });

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${SECOND_PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'different_on_second',
    });

    expect(res.status).toBe(201);
    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(2);
    expect(memberships.map((m) => m.fan_handle)).toEqual(['global_fan', 'global_fan']);
    expect(new Set(memberships.map((m) => m.audience_identity_id)).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Handshake (tier_rank > 1) — paid path returns requiresPayment.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — handshake (tier_rank > 1)', () => {
  test('returns { requiresPayment: true } and does NOT create an active membership yet', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 2,
      fan_handle: 'paid_fan_99',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresPayment).toBe(true);
    expect(res.body.subscribeUrl).toBeNull();
    expect(res.body.handshake).toMatchObject({
      tier_rank: 2,
      tier_id: TIER_2_ID,
      fan_handle: 'paid_fan_99',
    });

    expect(getTable('PersonaMembership')).toHaveLength(0);

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_membership.handshake'
                          && e.metadata?.outcome === 'requires_payment'
                          && e.metadata?.tier_rank === 2)).toBe(true);
  });

  test('allows checkout after a previous paid membership is terminal', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-expired',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: TIER_2_ID,
      fan_handle: 'old_paid_fan',
      fan_handle_normalized: 'old_paid_fan',
      status: 'expired',
      relationship_type: 'subscriber',
      stripe_subscription_id: 'sub_old_paid',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 2,
      fan_handle: 'paid_again',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresPayment).toBe(true);
    expect(res.body.handshake).toMatchObject({
      tier_rank: 2,
      tier_id: TIER_2_ID,
      fan_handle: 'paid_again',
    });
  });

  test('returns 404 when the requested tier does not exist on this persona', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 4, // Direct tier reserved for v1.1, not seeded here
      fan_handle: 'too_eager',
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// fan_handle = User.username protection.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — pantopus-username opt-in', () => {
  test('rejects fan_handle = req.user.username when ack is missing (400)', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'fan_personal_username_xyz', // matches the seeded user.username
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('pantopus_username_requires_ack');
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });

  test('accepts fan_handle = username when acknowledged_using_pantopus_username is true', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'fan_personal_username_xyz',
      acknowledged_using_pantopus_username: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.membership.fan_handle).toBe('fan_personal_username_xyz');

    const audit = getTable('IdentityAuditLog');
    expect(audit.some((e) => e.action === 'persona_membership.handshake'
                          && e.metadata?.used_pantopus_username === true)).toBe(true);
  });

  test('does not require username ack when the global audience identity already exists', async () => {
    seedTable('AudienceIdentity', [{
      id: 'audience-existing',
      user_id: FAN_ID,
      handle: 'fan_personal_username_xyz',
      handle_normalized: 'fan_personal_username_xyz',
      display_name: 'fan_personal_username_xyz',
      status: 'active',
      source: 'user_selected',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'fan_personal_username_xyz',
    });
    expect(res.status).toBe(201);
    expect(res.body.membership.fan_handle).toBe('fan_personal_username_xyz');
  });
});

// ---------------------------------------------------------------------------
// fan_handle uniqueness collision.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — fan_handle uniqueness', () => {
  test('returns 409 with code "fan_handle_taken" on persona-scoped collision', async () => {
    // Seed a different fan already on this persona with the handle.
    seedTable('PersonaMembership', [{
      id: 'mem-other', persona_id: PERSONA_ID, user_id: 'other-fan-id',
      tier_id: TIER_1_ID,
      fan_handle: 'duplicate_x', fan_handle_normalized: 'duplicate_x',
      status: 'active',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'DUPLICATE_X', // case-insensitive collision
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('fan_handle_taken');
  });

  test('returns 409 when the handle is already used by another audience identity', async () => {
    seedTable('AudienceIdentity', [{
      id: 'audience-other',
      user_id: 'other-fan-id',
      handle: 'global_duplicate',
      handle_normalized: 'global_duplicate',
      display_name: 'global_duplicate',
      status: 'active',
      source: 'user_selected',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'GLOBAL_DUPLICATE',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('fan_handle_taken');
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PersonaBlock: vague-but-truthful copy.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — PersonaBlock', () => {
  test('a blocked viewer gets 403 with the vague-but-truthful code', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action', reason: 'test',
      created_at: '2026-05-08T00:00:00Z',
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      ...HANDSHAKE_BASE,
      tier_rank: 1,
      fan_handle: 'optimistic_fan',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('persona_block_active');
    // The fan-facing copy must NOT name the personal-side relationship
    // (audience-profile §9): vague-but-truthful only.
    expect(res.body.error).not.toMatch(/neighbor|gig|household|local profile|personal/i);
  });
});

// ---------------------------------------------------------------------------
// acknowledged_platform_trust required.
// ---------------------------------------------------------------------------
describe('POST /api/personas/:id/follow — acknowledged_platform_trust required', () => {
  test('rejects a handshake POST that sets acknowledged_platform_trust=false', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      acknowledged_platform_trust: false,
      tier_rank: 1,
      fan_handle: 'no_ack_fan',
    });
    expect(res.status).toBe(400);
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fan-handle suggestion endpoint.
// ---------------------------------------------------------------------------
describe('GET /api/personas/:handle/fan-handle-suggestion', () => {
  test('returns a fan_<hex> handle that is not currently taken on the persona', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/mayabuilds/fan-handle-suggestion`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toMatch(/^fan_[a-f0-9]+$/);

    // Confirm the suggestion would not collide.
    const memberships = getTable('PersonaMembership');
    expect(memberships.find((m) => m.fan_handle_normalized === res.body.suggestion.toLowerCase()))
      .toBeUndefined();
  });

  test('returns an existing unused generated identity as editable', async () => {
    seedTable('AudienceIdentity', [{
      id: 'aud-unused-1',
      user_id: FAN_ID,
      public_persona_id: null,
      handle: 'fan_oldseed',
      handle_normalized: 'fan_oldseed',
      display_name: 'fan_oldseed',
      avatar_url: null,
      source: 'generated',
      status: 'active',
    }]);

    const res = await asUser(
      request(buildApp()).get(`/api/personas/mayabuilds/fan-handle-suggestion`),
      FAN_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBe('fan_oldseed');
    expect(res.body.locked).toBe(false);
  });

  test('locks an existing identity after it has been used for a membership', async () => {
    seedTable('AudienceIdentity', [{
      id: 'aud-used-1',
      user_id: FAN_ID,
      public_persona_id: null,
      handle: 'fan_used',
      handle_normalized: 'fan_used',
      display_name: 'fan_used',
      avatar_url: null,
      source: 'user_selected',
      status: 'active',
    }]);
    seedTable('PersonaMembership', [{
      id: 'membership-1',
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: TIER_1_ID,
      audience_identity_id: 'aud-used-1',
      fan_handle: 'fan_used',
      fan_handle_normalized: 'fan_used',
      fan_display_name: 'fan_used',
      status: 'active',
      relationship_type: 'follower',
      source: 'self_follow',
      notification_level: 'all',
      public_visibility: 'private',
    }]);

    const res = await asUser(
      request(buildApp()).get(`/api/personas/mayabuilds/fan-handle-suggestion`),
      FAN_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBe('fan_used');
    expect(res.body.locked).toBe(true);
  });

  test('flag-off returns 404', async () => {
    seedTable('FeatureFlag', [{
      id: 'flag-1', flag_name: FLAG_NAME,
      enabled_globally: false, enabled_for_internal_team: false,
      beta_user_ids: [], description: '',
      created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
    }]);
    featureFlagService.invalidateFlagCache();

    const res = await asUser(
      request(buildApp()).get(`/api/personas/mayabuilds/fan-handle-suggestion`),
      FAN_ID,
    );
    expect(res.status).toBe(404);
  });
});

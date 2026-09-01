/**
 * GET /api/personas/me/audience and PATCH /api/personas/me/audience/:id —
 * owner-side surface.
 *
 * Validates:
 *  - Returns the owner's beacon members serialized via the firewall-
 *    respecting serializer (fan_handle, not User.username).
 *  - Counts aggregate before filters apply.
 *  - status / tier_rank query params filter the page.
 *  - sort modes order correctly.
 *  - Member from another persona is NOT exposed.
 *  - Approve / decline / remove / mute / unmute round-trip and surface
 *    correctly on the next GET.
 *
 * Uses the in-memory supabaseAdmin mock. FK-join nested selects are not
 * expanded by the mock, so we seed `tier` directly on PersonaMembership.
 */

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

const featureFlagService = require('../../services/featureFlagService');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const FAN_1_ID = '22222222-2222-4222-8222-222222222222';
const FAN_2_ID = '33333333-3333-4333-8333-333333333333';
const FAN_3_ID = '44444444-4444-4444-8444-444444444444';
const STRANGER_ID = '55555555-5555-4555-8555-555555555555';
const PERSONA_ID = '66666666-6666-4666-8666-666666666666';
const PERSONA_OTHER_ID = '77777777-7777-4777-8777-777777777777';

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
    id: 'flag-1',
    flag_name: FLAG_NAME,
    enabled_globally: true,
    enabled_for_internal_team: false,
    beta_user_ids: [],
    description: 'Beacon + paid tier',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedBase() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'persona_owner' },
    { id: FAN_1_ID, role: 'user', username: 'real_pantopus_handle_one' },
    { id: FAN_2_ID, role: 'user', username: 'real_pantopus_handle_two' },
    { id: FAN_3_ID, role: 'user', username: 'real_pantopus_handle_three' },
    { id: STRANGER_ID, role: 'user', username: 'stranger' },
  ]);
  seedTable('PublicPersona', [
    {
      id: PERSONA_ID,
      user_id: OWNER_ID,
      handle: 'aurora',
      handle_normalized: 'aurora',
      display_name: 'Aurora',
      audience_mode: 'approval_required',
      status: 'active',
      follower_count: 3,
      post_count: 0,
    },
    {
      // Another owner's beacon — must not appear in our results.
      id: PERSONA_OTHER_ID,
      user_id: STRANGER_ID,
      handle: 'stranger_beacon',
      handle_normalized: 'stranger_beacon',
      display_name: 'Stranger Beacon',
      audience_mode: 'open',
      status: 'active',
      follower_count: 1,
      post_count: 0,
    },
  ]);
  seedTable('PersonaTier', [
    { id: 'tier-1', persona_id: PERSONA_ID, rank: 1, name: 'Follower', price_cents: 0 },
    { id: 'tier-2', persona_id: PERSONA_ID, rank: 2, name: 'Member', price_cents: 500 },
    { id: 'tier-3', persona_id: PERSONA_ID, rank: 3, name: 'Insider', price_cents: 1500 },
  ]);
}

function makeMembership(id, fanUserId, overrides = {}) {
  const tier = overrides.tier || { rank: 1, name: 'Follower', price_cents: 0 };
  const fanHandle = overrides.fan_handle || `fan_${id.slice(0, 8)}`;
  return {
    id,
    persona_id: overrides.persona_id || PERSONA_ID,
    user_id: fanUserId,
    tier_id: overrides.tier_id || 'tier-1',
    fan_handle: fanHandle,
    fan_handle_normalized: fanHandle.toLowerCase(),
    fan_display_name: overrides.fan_display_name || null,
    fan_avatar_url: overrides.fan_avatar_url || null,
    verified_local: overrides.verified_local || false,
    notification_level: 'all',
    status: overrides.status || 'active',
    joined_at: overrides.joined_at || '2026-04-01T00:00:00Z',
    cancel_at_period_end: overrides.cancel_at_period_end || false,
    current_period_end: overrides.current_period_end || null,
    source: overrides.source || 'self_follow',
    tier,
  };
}

beforeEach(() => {
  resetTables();
  seedFlagOn();
  seedBase();
});

afterEach(() => {
  featureFlagService.invalidateFlagCache();
});

// ---------------------------------------------------------------------------
// GET /api/personas/me/audience
// ---------------------------------------------------------------------------
describe('GET /api/personas/me/audience', () => {
  test('returns the owner persona + members with fan_handle (not User.username)', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-1', FAN_1_ID, {
        fan_handle: 'owl_in_march',
        fan_display_name: 'Owl',
      }),
      makeMembership('mem-2', FAN_2_ID, {
        fan_handle: 'lumen_fan',
        tier_id: 'tier-2',
        tier: { rank: 2, name: 'Member', price_cents: 500 },
      }),
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.persona).toMatchObject({ handle: 'aurora', displayName: 'Aurora' });
    expect(res.body.items).toHaveLength(2);

    // Privacy invariant: fan_handle is exposed, User.username is NOT.
    const serialized = JSON.stringify(res.body);
    expect(serialized).toContain('owl_in_march');
    expect(serialized).toContain('lumen_fan');
    expect(serialized).not.toContain('real_pantopus_handle_one');
    expect(serialized).not.toContain('real_pantopus_handle_two');
    expect(serialized).not.toMatch(/"userId"\s*:/);
    expect(serialized).not.toMatch(/"email"\s*:/);
  });

  test('counts aggregate before filters apply', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active-1', FAN_1_ID),
      makeMembership('mem-active-2', FAN_2_ID, {
        tier_id: 'tier-2',
        tier: { rank: 2, name: 'Member', price_cents: 500 },
      }),
      makeMembership('mem-pending', FAN_3_ID, { status: 'pending' }),
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      totalActive: 2,
      pending: 1,
      byTier: { 1: 2, 2: 1, 3: 0, 4: 0 },
    });
  });

  test('?status=pending filters to pending only', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active', FAN_1_ID),
      makeMembership('mem-pending', FAN_2_ID, { status: 'pending' }),
    ]);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/audience?status=pending'),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].membershipId).toBe('mem-pending');
    // Counts still reflect the whole list, not the filtered page.
    expect(res.body.counts.totalActive).toBe(1);
    expect(res.body.counts.pending).toBe(1);
  });

  test('?tier_rank=2 filters to Members only', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-follower', FAN_1_ID),
      makeMembership('mem-member', FAN_2_ID, {
        tier_id: 'tier-2',
        tier: { rank: 2, name: 'Member', price_cents: 500 },
      }),
      makeMembership('mem-insider', FAN_3_ID, {
        tier_id: 'tier-3',
        tier: { rank: 3, name: 'Insider', price_cents: 1500 },
      }),
    ]);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/audience?tier_rank=2'),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].membershipId).toBe('mem-member');
  });

  test('sort=tenure puts the longest-tenured fan first', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-recent', FAN_1_ID, { joined_at: '2026-05-01T00:00:00Z' }),
      makeMembership('mem-oldest', FAN_2_ID, { joined_at: '2025-01-01T00:00:00Z' }),
      makeMembership('mem-middle', FAN_3_ID, { joined_at: '2026-01-01T00:00:00Z' }),
    ]);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/audience?sort=tenure'),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.membershipId)).toEqual([
      'mem-oldest', 'mem-middle', 'mem-recent',
    ]);
  });

  test('sort=tier puts higher-rank tiers first', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-follower', FAN_1_ID),
      makeMembership('mem-insider', FAN_2_ID, {
        tier_id: 'tier-3',
        tier: { rank: 3, name: 'Insider', price_cents: 1500 },
      }),
      makeMembership('mem-member', FAN_3_ID, {
        tier_id: 'tier-2',
        tier: { rank: 2, name: 'Member', price_cents: 500 },
      }),
    ]);

    const res = await asUser(
      request(buildApp()).get('/api/personas/me/audience?sort=tier'),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.tier.rank)).toEqual([3, 2, 1]);
  });

  test('members of OTHER personas are not exposed', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-mine', FAN_1_ID),
      // Member of someone else's beacon — must NOT appear.
      makeMembership('mem-theirs', FAN_2_ID, { persona_id: PERSONA_OTHER_ID }),
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].membershipId).toBe('mem-mine');
  });

  test('returns empty persona + counts when the user has no active beacon', async () => {
    // Owner without a persona.
    seedTable('PublicPersona', []);
    seedTable('PersonaMembership', []);

    const res = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.persona).toBeNull();
    expect(res.body.items).toEqual([]);
    expect(res.body.counts.totalActive).toBe(0);
  });

  test('joined month is exposed; full joined_at is NOT (timing-attack invariant)', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-1', FAN_1_ID, { joined_at: '2026-02-14T13:37:00Z' }),
    ]);

    const res = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);

    expect(res.status).toBe(200);
    expect(res.body.items[0].joinedMonth).toBe('2026-02');
    // The serializer must not leak the day or time.
    const serialized = JSON.stringify(res.body.items[0]);
    expect(serialized).not.toContain('2026-02-14');
    expect(serialized).not.toContain('13:37');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/personas/me/audience/:membershipId
// ---------------------------------------------------------------------------
describe('PATCH /api/personas/me/audience/:membershipId', () => {
  test('approve transitions a pending member to active', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-pending', FAN_1_ID, { status: 'pending', source: 'follow_request' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-pending')
        .send({ action: 'approve' }),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ membershipId: 'mem-pending', status: 'active' });

    const list = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);
    expect(list.body.items[0].status).toBe('active');
    expect(list.body.counts.pending).toBe(0);
    expect(list.body.counts.totalActive).toBe(1);
  });

  test('decline transitions a pending member to removed', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-pending', FAN_1_ID, { status: 'pending' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-pending')
        .send({ action: 'decline' }),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('removed');

    // Declined members fall out of the audience-visible statuses list.
    const list = await asUser(request(buildApp()).get('/api/personas/me/audience'), OWNER_ID);
    expect(list.body.items).toHaveLength(0);
  });

  test('approving a non-pending member returns 409', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active', FAN_1_ID, { status: 'active' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-active')
        .send({ action: 'approve' }),
      OWNER_ID,
    );

    expect(res.status).toBe(409);
  });

  test('remove turns an active member into removed', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active', FAN_1_ID, { status: 'active' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-active')
        .send({ action: 'remove' }),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('removed');
  });

  test('mute / unmute round-trip', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active', FAN_1_ID, { status: 'active' }),
    ]);

    const muteRes = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-active')
        .send({ action: 'mute' }),
      OWNER_ID,
    );
    expect(muteRes.status).toBe(200);
    expect(muteRes.body.status).toBe('muted');

    const unmuteRes = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-active')
        .send({ action: 'unmute' }),
      OWNER_ID,
    );
    expect(unmuteRes.status).toBe(200);
    expect(unmuteRes.body.status).toBe('active');
  });

  test('the owner of another beacon cannot mutate this owner\'s members', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-mine', FAN_1_ID, { status: 'pending' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-mine')
        .send({ action: 'approve' }),
      STRANGER_ID,
    );

    // STRANGER_ID has a different persona; the membership is scoped to
    // the requesting user's active persona, so this should 404.
    expect(res.status).toBe(404);
  });

  test('invalid action is rejected', async () => {
    seedTable('PersonaMembership', [
      makeMembership('mem-active', FAN_1_ID, { status: 'active' }),
    ]);

    const res = await asUser(
      request(buildApp())
        .patch('/api/personas/me/audience/mem-active')
        .send({ action: 'destroy' }),
      OWNER_ID,
    );

    expect(res.status).toBe(400);
  });
});

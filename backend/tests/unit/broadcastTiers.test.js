/**
 * P1.10 — tier-rank-aware broadcast visibility.
 *
 * Audience Profile design v2 §11.3 (composer with tier visibility
 * selector) + §13.4 (a Follower cannot read a Member+ broadcast; an
 * Insider can read all lower-rank broadcasts).
 *
 * Lives under tests/unit/ so `npm test` picks it up.
 */

// The broadcast read endpoint uses optionalAuth (NOT verifyToken). The
// jest config only auto-mocks verifyToken, so we mock optionalAuth here
// to mirror the existing identityFirewallPrivacy test convention:
// x-test-user-id header → req.user.
jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] || 'user' };
  }
  next();
});

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const express = require('express');
const request = require('supertest');

const featureFlagService = require('../../services/featureFlagService');
const broadcastChannelsRouter = require('../../routes/broadcastChannels');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';
const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FOLLOWER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID   = '33333333-3333-4333-8333-333333333333';
const INSIDER_ID  = '44444444-4444-4444-4444-444444444444';
const STRANGER_ID = '55555555-5555-4555-8555-555555555555';
const PERSONA_ID  = '66666666-6666-4666-8666-666666666666';
const CHANNEL_ID  = '77777777-7777-4777-8777-777777777777';
const TIER_1_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/broadcast', broadcastChannelsRouter);
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

function seedPersona() {
  seedTable('User', [
    { id: OWNER_ID,    role: 'user', username: 'owner_handle' },
    { id: FOLLOWER_ID, role: 'user', username: 'follower_handle' },
    { id: MEMBER_ID,   role: 'user', username: 'member_handle' },
    { id: INSIDER_ID,  role: 'user', username: 'insider_handle' },
    { id: STRANGER_ID, role: 'user', username: 'stranger_handle' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds', audience_mode: 'open', status: 'active',
    audience_label: 'followers',
    follower_count: 0, post_count: 0,
  }]);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_ID, persona_id: PERSONA_ID,
    title: 'Maya Updates', status: 'active',
  }]);
  seedTable('PersonaTier', [
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active' },
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active' },
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      price_cents: 1500, status: 'active' },
  ]);
}

function seedMemberships() {
  seedTable('PersonaMembership', [
    { id: 'mem-follower', persona_id: PERSONA_ID, user_id: FOLLOWER_ID,
      tier_id: TIER_1_ID, fan_handle: 'fan_a', fan_handle_normalized: 'fan_a',
      status: 'active', notification_level: 'all' },
    { id: 'mem-member',   persona_id: PERSONA_ID, user_id: MEMBER_ID,
      tier_id: TIER_2_ID, fan_handle: 'fan_b', fan_handle_normalized: 'fan_b',
      status: 'active', notification_level: 'all' },
    { id: 'mem-insider',  persona_id: PERSONA_ID, user_id: INSIDER_ID,
      tier_id: TIER_3_ID, fan_handle: 'fan_c', fan_handle_normalized: 'fan_c',
      status: 'active', notification_level: 'all' },
  ]);
}

function seedBroadcasts() {
  seedTable('BroadcastMessage', [
    { id: 'b-public', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
      author_user_id: OWNER_ID, body: 'Public update body',
      visibility: 'public', target_tier_rank: null,
      status: 'published', published_at: '2026-05-04T10:00:00Z' },
    { id: 'b-followers', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
      author_user_id: OWNER_ID, body: 'Followers update body',
      visibility: 'followers', target_tier_rank: null,
      status: 'published', published_at: '2026-05-04T11:00:00Z' },
    { id: 'b-members', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
      author_user_id: OWNER_ID, body: 'Member-only update body that is long enough to demonstrate a teaser',
      visibility: 'tier_or_above', target_tier_rank: 2,
      status: 'published', published_at: '2026-05-04T12:00:00Z' },
    { id: 'b-insiders', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
      author_user_id: OWNER_ID, body: 'Insider-only update body — Insider rank gate test fixture',
      visibility: 'tier_or_above', target_tier_rank: 3,
      status: 'published', published_at: '2026-05-04T13:00:00Z' },
    { id: 'b-draft', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
      author_user_id: OWNER_ID, body: 'Draft update visible only to owner',
      visibility: 'followers', target_tier_rank: null,
      status: 'draft', published_at: null },
  ]);
}

beforeEach(() => {
  resetTables();
  seedFlagOn();
  seedPersona();
  seedMemberships();
  seedBroadcasts();
  // requirePersonaBroadcastEnabled reads PERSONA_BROADCAST_ENABLED env;
  // explicit default in non-prod is "on" so it's already enabled.
});

afterEach(() => featureFlagService.invalidateFlagCache());

// ---------------------------------------------------------------------------
// Per-tier read access (cases 1-5).
// ---------------------------------------------------------------------------
describe('GET /api/broadcast/channels/:channelId/messages — tier visibility', () => {
  test('1. anonymous viewer sees only the public broadcast', async () => {
    const res = await request(buildApp())
      .get(`/api/broadcast/channels/${CHANNEL_ID}/messages`);
    expect(res.status).toBe(200);
    const ids = res.body.messages.map((m) => m.id);
    expect(ids).toContain('b-public');
    expect(ids).not.toContain('b-followers');
    expect(ids).not.toContain('b-members');
    expect(ids).not.toContain('b-insiders');
    expect(res.body.viewer.tierRank).toBe(0);
  });

  test('2. Free Follower viewer sees public + followers + tier_or_above rank=1 only', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      FOLLOWER_ID,
    );
    expect(res.status).toBe(200);
    const fullIds = res.body.messages.filter((m) => !m.locked).map((m) => m.id);
    expect(fullIds).toEqual(expect.arrayContaining(['b-public', 'b-followers']));
    expect(fullIds).not.toContain('b-members');
    expect(fullIds).not.toContain('b-insiders');
    expect(res.body.viewer.tierRank).toBe(1);
  });

  test('3. Member viewer sees full body for ranks <= 2; rank-3 broadcast is locked', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      MEMBER_ID,
    );
    expect(res.status).toBe(200);
    const fullIds = res.body.messages.filter((m) => !m.locked).map((m) => m.id);
    expect(fullIds).toEqual(expect.arrayContaining(['b-public', 'b-followers', 'b-members']));
    expect(fullIds).not.toContain('b-insiders');
    const insider = res.body.messages.find((m) => m.id === 'b-insiders');
    expect(insider.locked).toBe(true);
    expect(res.body.viewer.tierRank).toBe(2);
  });

  test('4. Insider viewer sees full body for ranks <= 3 (every broadcast)', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      INSIDER_ID,
    );
    expect(res.status).toBe(200);
    const fullIds = res.body.messages.filter((m) => !m.locked).map((m) => m.id);
    expect(fullIds).toEqual(expect.arrayContaining([
      'b-public', 'b-followers', 'b-members', 'b-insiders',
    ]));
    expect(res.body.messages.every((m) => !m.locked)).toBe(true);
    expect(res.body.viewer.tierRank).toBe(3);
  });

  test('5. Owner viewer sees full body for every broadcast including tier_or_above ranks 2 and 3', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    const ids = res.body.messages.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining([
      'b-public', 'b-followers', 'b-members', 'b-insiders', 'b-draft',
    ]));
    expect(res.body.messages.every((m) => !m.locked)).toBe(true);
    expect(res.body.viewer.tierRank).toBe(4);
  });

  test('owner viewer sees own Beacon posts that are not broadcast-channel backed', async () => {
    seedTable('Post', [{
      id: 'owner-beacon-post',
      user_id: OWNER_ID,
      author_user_id: OWNER_ID,
      identity_context_type: 'persona',
      identity_context_id: PERSONA_ID,
      content: 'Own Beacon post from the profile feed',
      media_urls: [],
      media_types: [],
      media_thumbnails: [],
      media_live_urls: [],
      post_type: 'general',
      visibility: 'followers',
      audience: 'followers',
      post_as: 'persona',
      broadcast_channel_id: null,
      target_tier_rank: null,
      delivered_count: 0,
      read_count: 0,
      created_at: '2026-05-04T14:30:00Z',
      updated_at: '2026-05-04T14:30:00Z',
      archived_at: null,
    }]);

    const ownerRes = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    );
    expect(ownerRes.status).toBe(200);
    const ownerPost = ownerRes.body.messages.find((m) => m.id === 'owner-beacon-post');
    expect(ownerPost).toMatchObject({
      id: 'owner-beacon-post',
      channel_id: CHANNEL_ID,
      persona_id: PERSONA_ID,
      body: 'Own Beacon post from the profile feed',
      visibility: 'followers',
    });

    const followerRes = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      FOLLOWER_ID,
    );
    expect(followerRes.status).toBe(200);
    expect(followerRes.body.messages.map((m) => m.id)).not.toContain('owner-beacon-post');
  });

  test('6. locked broadcast carries teaser <= 60 chars and omits body / media', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      MEMBER_ID,
    );
    expect(res.status).toBe(200);
    const insider = res.body.messages.find((m) => m.id === 'b-insiders');
    expect(insider.locked).toBe(true);
    expect(insider.body).toBeUndefined();
    expect(insider.media).toBeUndefined();
    expect(insider.delivered_count).toBeUndefined();
    expect(insider.read_count).toBeUndefined();
    // Teaser is the first 60 chars + "…"; allow 61 to account for the
    // ellipsis marker.
    expect(typeof insider.teaser).toBe('string');
    expect(insider.teaser.length).toBeLessThanOrEqual(61);
    expect(insider.target_tier_rank).toBe(3);
  });

  test('post-backed broadcasts expose media uploaded after publish', async () => {
    seedTable('Post', [{
      id: 'post-backed-media',
      user_id: OWNER_ID,
      author_user_id: OWNER_ID,
      identity_context_type: 'persona',
      identity_context_id: PERSONA_ID,
      content: 'Uploaded after publish',
      media_urls: ['https://cdn.example.com/after-upload.jpg'],
      media_types: ['image'],
      media_thumbnails: ['https://cdn.example.com/after-upload-thumb.jpg'],
      media_live_urls: [''],
      post_type: 'personal_update',
      visibility: 'followers',
      audience: 'followers',
      post_as: 'persona',
      broadcast_channel_id: CHANNEL_ID,
      target_tier_rank: null,
      delivered_count: 1,
      read_count: 0,
      post_metadata: {
        source: 'broadcast_composer',
        broadcast_visibility: 'followers',
        broadcast_status: 'published',
        broadcast_media: [],
      },
      created_at: '2026-05-04T14:00:00Z',
      updated_at: '2026-05-04T14:00:00Z',
      archived_at: null,
    }]);

    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      FOLLOWER_ID,
    );
    expect(res.status).toBe(200);
    const message = res.body.messages.find((m) => m.id === 'post-backed-media');
    expect(message.media).toEqual([{
      url: 'https://cdn.example.com/after-upload.jpg',
      type: 'image',
      thumbnailUrl: 'https://cdn.example.com/after-upload-thumb.jpg',
    }]);
  });

  test('Anonymous viewers do NOT receive locked teasers (no "subscribe" hint to logged-out users)', async () => {
    const res = await request(buildApp())
      .get(`/api/broadcast/channels/${CHANNEL_ID}/messages`);
    expect(res.body.messages.some((m) => m.locked)).toBe(false);
  });

  test('non-owner viewers do not see draft broadcasts', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      INSIDER_ID,
    );
    const ids = res.body.messages.map((m) => m.id);
    expect(ids).not.toContain('b-draft');
  });

  test('rank-3 viewers can mark rank-3 broadcasts as read', async () => {
    const res = await asUser(
      request(buildApp()).post('/api/broadcast/messages/b-insiders/read'),
      INSIDER_ID,
    ).send();
    expect(res.status).toBe(200);
    expect(res.body.message.read_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Write validation (cases 7-8).
// ---------------------------------------------------------------------------
describe('POST /api/broadcast/channels/:channelId/messages — tier validation', () => {
  test('7. POST visibility=tier_or_above with missing target_tier_rank returns 400', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Missing rank', visibility: 'tier_or_above' });
    expect(res.status).toBe(400);
  });

  test('8. POST visibility=tier_or_above with target_tier_rank=5 returns 400', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Out of range', visibility: 'tier_or_above', target_tier_rank: 5 });
    expect(res.status).toBe(400);
  });

  test('POST visibility=tier_or_above with target_tier_rank=2 (Member) succeeds and persists target_tier_rank', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'New member-only', visibility: 'tier_or_above', target_tier_rank: 2 });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({
      visibility: 'tier_or_above',
      target_tier_rank: 2,
    });
  });

  test('POST legacy visibility=subscribers normalizes to tier_or_above rank 2', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Legacy subscribers', visibility: 'subscribers' });
    expect(res.status).toBe(201);
    expect(res.body.message.visibility).toBe('tier_or_above');
    expect(res.body.message.target_tier_rank).toBe(2);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.identity_context_type).toBe('persona');
    expect(stored.post_as).toBe('persona');
    expect(stored.post_metadata.broadcast_visibility).toBe('tier_or_above');
    expect(stored.target_tier_rank).toBe(2);
  });

  test('POST visibility=tier_or_above with rank=4 (no Direct tier seeded) returns 400 unknown_target_tier_rank', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Direct only', visibility: 'tier_or_above', target_tier_rank: 4 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('unknown_target_tier_rank');
  });

  test('POST visibility=public still works (no target_tier_rank required)', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Hello world', visibility: 'public' });
    expect(res.status).toBe(201);
    expect(res.body.message.visibility).toBe('public');
    expect(res.body.message.target_tier_rank).toBeNull();
  });

  test('POST with media persists Beacon media on the backing Post', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({
      body: 'Update with media',
      visibility: 'followers',
      media: [
        { url: 'https://cdn.example.com/post/image.jpg' },
        { url: 'https://cdn.example.com/post/video.mp4', type: 'video/mp4' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.message.media).toEqual([
      { url: 'https://cdn.example.com/post/image.jpg', type: 'image' },
      { url: 'https://cdn.example.com/post/video.mp4', type: 'video' },
    ]);
    const stored = getTable('Post').find((m) => m.id === res.body.message.id);
    expect(stored.media_urls).toEqual([
      'https://cdn.example.com/post/image.jpg',
      'https://cdn.example.com/post/video.mp4',
    ]);
    expect(stored.media_types).toEqual(['image', 'video']);
  });

  test('POST visibility=public WITH target_tier_rank is rejected by Joi', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      OWNER_ID,
    ).send({ body: 'Hello', visibility: 'public', target_tier_rank: 2 });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// membership-stats endpoint (case 9).
// ---------------------------------------------------------------------------
describe('GET /api/personas/:id/membership-stats', () => {
  test('9. owner receives aggregate counts grouped by tier rank', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership-stats`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    // Cumulative counts: 1 at each tier; followers (rank ≥ 1) sees all 3,
    // members (rank ≥ 2) sees 2, insiders (rank ≥ 3) sees 1.
    expect(res.body.counts).toEqual({
      followers: 3, members: 2, insiders: 1, direct: 0,
    });
  });

  test('non-owner gets 404 (existence must not leak)', async () => {
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership-stats`),
      STRANGER_ID,
    );
    expect(res.status).toBe(404);
  });

  test('flag-off owner gets 404', async () => {
    seedTable('FeatureFlag', [{
      id: 'flag-1', flag_name: FLAG_NAME,
      enabled_globally: false, enabled_for_internal_team: false,
      beta_user_ids: [], description: '',
      created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
    }]);
    featureFlagService.invalidateFlagCache();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership-stats`),
      OWNER_ID,
    );
    expect(res.status).toBe(404);
  });
});

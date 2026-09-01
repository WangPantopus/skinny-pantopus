const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  getTable,
  setRpcMock,
} = require('../__mocks__/supabaseAdmin');
const notificationService = require('../../services/notificationService');

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] || 'user' };
  }
  next();
});

jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/s3Service', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://cdn.example.com/signed'),
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas', require('../../routes/personas'));
  app.use('/api/posts', require('../../routes/posts'));
  app.use('/api/local-profiles', require('../../routes/localProfiles'));
  app.use('/api/broadcast', require('../../routes/broadcastChannels'));
  app.use('/api/relationships', require('../../routes/relationships'));
  return app;
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const USER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PERSONA_A = '33333333-3333-4333-8333-333333333333';
const CHANNEL_A = '44444444-4444-4444-8444-444444444444';
const HOME_A = '55555555-5555-4555-8555-555555555555';

function seedEmptySupportTables() {
  seedTable('PostHide', []);
  seedTable('PostMute', []);
  seedTable('UserMute', []);
  seedTable('UserFeedPreference', []);
  seedTable('PostLike', []);
  seedTable('PostSave', []);
  seedTable('PostShare', []);
  seedTable('PostComment', []);
  seedTable('PostReport', []);
  seedTable('ChatRoom', []);
  seedTable('ChatMessage', []);
  seedTable('Notification', []);
  seedTable('UserNotificationPreferences', []);
}

function seedIdentityFixture({ follow = true, bridge = { show_persona_on_local: false, show_local_on_persona: false } } = {}) {
  seedTable('User', [
    {
      id: USER_A,
      username: 'maya-private',
      name: 'Maya Legal Secret',
      first_name: 'Maya',
      last_name: 'Secret',
      email: 'maya.private@example.com',
      city: 'Private City',
      state: 'CA',
      account_type: 'personal',
      verified: true,
    },
    {
      id: USER_B,
      username: 'viewer-b',
      name: 'Viewer B',
      account_type: 'personal',
    },
    {
      id: USER_C,
      username: 'neighbor-c',
      name: 'Neighbor C',
      account_type: 'personal',
    },
  ]);
  seedTable('LocalProfile', [{
    id: 'local-a',
    user_id: USER_A,
    handle: 'RiverHome',
    handle_normalized: 'riverhome',
    display_name: 'RiverHome',
    public_city: 'Oakland',
    public_state: 'CA',
    public_neighborhood: 'Private Neighborhood',
    verified_resident: true,
  }]);
  seedTable('PublicPersona', [{
    id: PERSONA_A,
    user_id: USER_A,
    handle: 'MayaBuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    avatar_url: 'https://cdn.example.com/persona.jpg',
    category: 'creator',
    audience_label: 'followers',
    audience_mode: 'open',
    follower_count: follow ? 1 : 0,
    post_count: 2,
    status: 'active',
  }]);
  seedTable('IdentityBridgeSetting', [{
    id: 'bridge-a',
    user_id: USER_A,
    persona_id: PERSONA_A,
    show_persona_on_local: bridge.show_persona_on_local,
    show_local_on_persona: bridge.show_local_on_persona,
  }]);
  seedTable('PersonaFollow', follow ? [{
    id: 'persona-follow-b',
    persona_id: PERSONA_A,
    follower_user_id: USER_B,
    relationship_type: 'follower',
    status: 'active',
    notification_level: 'all',
    source: 'self_follow',
  }] : []);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_A,
    persona_id: PERSONA_A,
    title: 'Maya Builds Broadcast',
    status: 'active',
  }]);
  seedTable('BroadcastMessage', [
    {
      id: 'broadcast-followers',
      channel_id: CHANNEL_A,
      persona_id: PERSONA_A,
      author_user_id: USER_A,
      body: 'Audience-only broadcast',
      visibility: 'followers',
      status: 'published',
      published_at: '2026-05-04T10:00:00Z',
    },
    {
      id: 'broadcast-public',
      channel_id: CHANNEL_A,
      persona_id: PERSONA_A,
      author_user_id: USER_A,
      body: 'Public broadcast',
      visibility: 'public',
      status: 'published',
      published_at: '2026-05-04T11:00:00Z',
    },
  ]);
  seedTable('Relationship', [{
    id: 'local-connection-a-c',
    requester_id: USER_A,
    addressee_id: USER_C,
    status: 'accepted',
    accepted_at: '2026-05-04T00:00:00Z',
  }]);
  seedTable('Gig', [{
    id: 'gig-private-local',
    user_id: USER_A,
    title: 'Local moving job',
    description: 'Move boxes from the private address',
    status: 'open',
    latitude: 37.7749,
    longitude: -122.4194,
    location_address: '1 Private Way',
    home_id: HOME_A,
    created_at: '2026-05-04T00:00:00Z',
  }]);
  seedTable('Listing', [{
    id: 'listing-private-local',
    user_id: USER_A,
    title: 'Local bike listing',
    description: 'Pickup at the private garage',
    status: 'active',
    latitude: 37.7749,
    longitude: -122.4194,
    location_address: '1 Private Way',
    home_id: HOME_A,
    created_at: '2026-05-04T00:00:00Z',
  }]);
  seedTable('Post', [
    {
      id: 'persona-followers-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'persona',
      identity_context_id: PERSONA_A,
      post_as: 'persona',
      audience: 'followers',
      visibility: 'followers',
      distribution_targets: ['persona_followers'],
      content: 'Audience-only studio note',
      post_type: 'announcement',
      media_urls: [],
      media_types: [],
      home_id: HOME_A,
      latitude: 37.7749,
      longitude: -122.4194,
      effective_latitude: 37.7749,
      effective_longitude: -122.4194,
      location_name: 'Private Neighborhood',
      location_address: '1 Private Way',
      location_precision: 'exact_place',
      archived_at: null,
      created_at: '2026-05-04T12:00:00Z',
      creator: {
        id: USER_A,
        username: 'maya-private',
        name: 'Maya Legal Secret',
        email: 'maya.private@example.com',
      },
    },
    {
      id: 'persona-public-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'persona',
      identity_context_id: PERSONA_A,
      post_as: 'persona',
      audience: 'public',
      visibility: 'public',
      distribution_targets: ['public'],
      content: 'Public audience post',
      post_type: 'announcement',
      media_urls: [],
      media_types: [],
      archived_at: null,
      created_at: '2026-05-04T13:00:00Z',
    },
    {
      id: 'local-public-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'local',
      identity_context_id: 'local-a',
      post_as: 'personal',
      audience: 'nearby',
      visibility: 'neighborhood',
      distribution_targets: ['place'],
      show_on_profile: true,
      profile_visibility_scope: 'public',
      content: 'Local neighborhood note',
      post_type: 'local_update',
      latitude: 37.7749,
      longitude: -122.4194,
      effective_latitude: 37.7749,
      effective_longitude: -122.4194,
      location_address: '1 Private Way',
      home_id: HOME_A,
      archived_at: null,
      created_at: '2026-05-04T14:00:00Z',
    },
    {
      id: 'local-followers-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'local',
      identity_context_id: 'local-a',
      post_as: 'personal',
      audience: 'followers',
      visibility: 'followers',
      distribution_targets: ['followers'],
      show_on_profile: true,
      profile_visibility_scope: 'public',
      content: 'Local follower-only note',
      post_type: 'local_update',
      archived_at: null,
      created_at: '2026-05-04T15:00:00Z',
    },
    {
      id: 'home-private-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'home',
      identity_context_id: HOME_A,
      home_id: HOME_A,
      post_as: 'home',
      audience: 'household',
      visibility: 'household',
      distribution_targets: ['household'],
      show_on_profile: true,
      profile_visibility_scope: 'public',
      content: 'Household-only note',
      post_type: 'local_update',
      location_address: '1 Private Way',
      archived_at: null,
      created_at: '2026-05-04T16:00:00Z',
    },
  ]);
  seedEmptySupportTables();
}

function expectNoLocalOrPrivateData(payload) {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(USER_A);
  expect(json).not.toContain('Maya Legal Secret');
  expect(json).not.toContain('maya.private@example.com');
  expect(json).not.toContain('1 Private Way');
  expect(json).not.toContain(HOME_A);
  expect(json).not.toContain('Local moving job');
  expect(json).not.toContain('Local bike listing');
  expect(json).not.toContain('Household-only note');
  expect(json).not.toContain('local-connection-a-c');
}

describe('Identity Firewall two-user privacy contract', () => {
  beforeEach(() => {
    resetTables();
    setRpcMock(null);
    jest.clearAllMocks();
  });

  test('persona follower sees persona feed/posts only, with no local/home/private data', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });

    const feedRes = await request(app)
      .get('/api/posts/feed?surface=personas&limit=20')
      .set('x-test-user-id', USER_B);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.posts.map((post) => post.id)).toEqual(['persona-followers-post']);
    expect(feedRes.body.posts[0].author).toMatchObject({
      type: 'persona',
      id: PERSONA_A,
      handle: 'MayaBuilds',
    });
    expect(feedRes.body.posts[0].user_id).toBe(PERSONA_A);
    expect(feedRes.body.posts[0].author_user_id).toBeNull();
    expect(feedRes.body.posts[0]).not.toHaveProperty('home_id');
    expect(feedRes.body.posts[0]).not.toHaveProperty('location_address');
    expect(feedRes.body.posts[0]).not.toHaveProperty('latitude');
    expect(feedRes.body.posts[0]).not.toHaveProperty('longitude');
    expectNoLocalOrPrivateData(feedRes.body);

    const personaPostsRes = await request(app)
      .get('/api/personas/MayaBuilds/posts')
      .set('x-test-user-id', USER_B);

    expect(personaPostsRes.status).toBe(200);
    expect(personaPostsRes.body.posts.map((post) => post.id)).toEqual([
      'persona-followers-post',
      'persona-public-post',
    ]);
    for (const post of personaPostsRes.body.posts) {
      expect(post.author).toMatchObject({ type: 'persona', id: PERSONA_A });
      expect(post.user_id).toBe(PERSONA_A);
      expect(post.author_user_id).toBeNull();
      expect(post).not.toHaveProperty('home_id');
      expect(post).not.toHaveProperty('location_address');
      expect(post).not.toHaveProperty('latitude');
      expect(post).not.toHaveProperty('longitude');
    }
    expectNoLocalOrPrivateData(personaPostsRes.body);
  });

  test('persona posts endpoint hides tier-gated posts above the viewer rank', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });
    seedTable('Post', [
      ...getTable('Post'),
      {
        id: 'persona-member-post',
        user_id: USER_A,
        author_user_id: USER_A,
        identity_context_type: 'persona',
        identity_context_id: PERSONA_A,
        post_as: 'persona',
        audience: 'followers',
        visibility: 'followers',
        distribution_targets: ['persona_followers'],
        target_tier_rank: 2,
        content: 'Members-only studio note',
        post_type: 'personal_update',
        media_urls: [],
        media_types: [],
        archived_at: null,
        created_at: '2026-05-04T14:00:00Z',
      },
    ]);

    const followerRes = await request(app)
      .get('/api/personas/MayaBuilds/posts')
      .set('x-test-user-id', USER_B);
    expect(followerRes.status).toBe(200);
    expect(followerRes.body.posts.map((post) => post.id)).not.toContain('persona-member-post');

    const ownerRes = await request(app)
      .get('/api/personas/MayaBuilds/posts')
      .set('x-test-user-id', USER_A);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.posts.map((post) => post.id)).toContain('persona-member-post');
  });

  test('pending persona follow request cannot preview follower-only posts or media', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: false });
    getTable('PublicPersona')[0].audience_mode = 'approval_required';
    seedTable('PersonaFollow', [{
      id: 'persona-follow-pending-b',
      persona_id: PERSONA_A,
      follower_user_id: USER_B,
      relationship_type: 'follower',
      status: 'pending',
      notification_level: 'all',
      source: 'follow_request',
    }]);
    seedTable('Post', getTable('Post').map((post) => (
      post.id === 'persona-followers-post'
        ? {
            ...post,
            content: 'Follower-only video should stay private',
            media_urls: ['https://cdn.example.com/private-follower-video.mp4'],
            media_types: ['video'],
          }
        : post
    )));

    const profileRes = await request(app)
      .get('/api/personas/MayaBuilds')
      .set('x-test-user-id', USER_B);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.persona.viewer).toMatchObject({
      isFollowing: false,
      followStatus: 'pending',
    });

    const personaPostsRes = await request(app)
      .get('/api/personas/MayaBuilds/posts')
      .set('x-test-user-id', USER_B);

    expect(personaPostsRes.status).toBe(200);
    expect(personaPostsRes.body.posts.map((post) => post.id)).toEqual(['persona-public-post']);
    expect(JSON.stringify(personaPostsRes.body)).not.toContain('Follower-only video should stay private');
    expect(JSON.stringify(personaPostsRes.body)).not.toContain('private-follower-video.mp4');
  });

  test('broadcast follower reads broadcasts without creating chat or exposing owner identity', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });

    const readRes = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_B);

    expect(readRes.status).toBe(200);
    expect(readRes.body.messages.map((message) => message.id)).toEqual([
      'broadcast-public',
      'broadcast-followers',
    ]);
    expect(readRes.body.messages[0]).not.toHaveProperty('author_user_id');
    expect(readRes.body.channel).toMatchObject({
      id: CHANNEL_A,
      title: 'Maya Builds Broadcast',
      status: 'active',
    });
    expect(readRes.body.channel).not.toHaveProperty('persona_id');
    expect(readRes.body.persona).toMatchObject({
      type: 'persona',
      id: PERSONA_A,
      handle: 'MayaBuilds',
      viewer: { isFollowing: true },
    });
    expectNoLocalOrPrivateData(readRes.body);

    const publishRes = await request(app)
      .post(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A)
      .send({ body: 'New follower note', visibility: 'followers' });

    expect(publishRes.status).toBe(201);
    expect(publishRes.body.message).not.toHaveProperty('author_user_id');
    expect(getTable('BroadcastMessage')).toHaveLength(2);
    expect(getTable('Post')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: publishRes.body.message.id,
        identity_context_type: 'persona',
        post_as: 'persona',
        content: 'New follower note',
        broadcast_channel_id: CHANNEL_A,
        distribution_targets: ['persona_followers'],
      }),
    ]));
    expect(getTable('ChatRoom')).toHaveLength(0);
    expect(getTable('ChatMessage')).toHaveLength(0);
    expect(notificationService.notifyPersonaBroadcast).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserIds: [USER_B],
      personaId: PERSONA_A,
      personaHandle: 'MayaBuilds',
      visibility: 'followers',
    }));
    expect(JSON.stringify(notificationService.notifyPersonaBroadcast.mock.calls)).not.toContain('maya.private@example.com');
    expect(JSON.stringify(notificationService.notifyPersonaBroadcast.mock.calls)).not.toContain('Maya Legal Secret');

    const postId = publishRes.body.message.id;
    const rpcMock = jest.fn(async (fnName, params) => {
      if (fnName === 'toggle_post_like') {
        return { data: { liked: true, likeCount: 1 }, error: null };
      }
      if (fnName === 'toggle_post_save') {
        return { data: true, error: null };
      }
      return { data: null, error: { message: `Unexpected RPC ${fnName}` } };
    });
    setRpcMock(rpcMock);

    const likeRes = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('x-test-user-id', USER_B)
      .send({});
    expect(likeRes.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('toggle_post_like', {
      p_post_id: postId,
      p_user_id: USER_B,
    });

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('x-test-user-id', USER_B)
      .send({ comment: 'Looks useful' });
    expect(commentRes.status).toBe(201);
    expect(getTable('PostComment')).toEqual(expect.arrayContaining([
      expect.objectContaining({ post_id: postId, user_id: USER_B, comment: 'Looks useful' }),
    ]));

    const shareRes = await request(app)
      .post(`/api/posts/${postId}/share`)
      .set('x-test-user-id', USER_B)
      .send({ shareType: 'external' });
    expect(shareRes.status).toBe(200);
    expect(getTable('PostShare')).toEqual(expect.arrayContaining([
      expect.objectContaining({ post_id: postId, user_id: USER_B, share_type: 'external' }),
    ]));

    const reportRes = await request(app)
      .post(`/api/posts/${postId}/report`)
      .set('x-test-user-id', USER_B)
      .send({ reason: 'spam', details: 'Regression access check' });
    expect(reportRes.status).toBe(200);
    expect(getTable('PostReport')).toEqual(expect.arrayContaining([
      expect.objectContaining({ post_id: postId, reported_by: USER_B, reason: 'spam' }),
    ]));

    const saveRes = await request(app)
      .post(`/api/posts/${postId}/save`)
      .set('x-test-user-id', USER_B)
      .send({});
    expect(saveRes.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('toggle_post_save', {
      p_post_id: postId,
      p_user_id: USER_B,
    });
  });

  test('persona blocks deny standard engagement endpoints even for public Beacon posts', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });
    seedTable('PersonaBlock', [{
      id: 'persona-block-b',
      persona_id: PERSONA_A,
      blocked_user_id: USER_B,
      source: 'persona_owner_action',
    }]);
    const rpcMock = jest.fn().mockResolvedValue({
      data: { liked: true, likeCount: 1 },
      error: null,
    });
    setRpcMock(rpcMock);

    const likeRes = await request(app)
      .post('/api/posts/persona-public-post/like')
      .set('x-test-user-id', USER_B)
      .send({});

    expect(likeRes.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test('Member+ broadcasts keep legacy subscriber relationships gated correctly', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });
    seedTable('PersonaTier', [
      { id: 'tier-free', persona_id: PERSONA_A, rank: 1, name: 'Follower' },
      { id: 'tier-paid', persona_id: PERSONA_A, rank: 2, name: 'Member' },
    ]);
    getTable('BroadcastMessage').push({
      id: 'broadcast-subscribers',
      channel_id: CHANNEL_A,
      persona_id: PERSONA_A,
      author_user_id: USER_A,
      body: 'Subscriber-only broadcast',
      visibility: 'subscribers',
      status: 'published',
      published_at: '2026-05-04T12:00:00Z',
      delivered_count: 0,
      read_count: 0,
    });

    const followerMessages = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_B);
    expect(followerMessages.status).toBe(200);
    // P1.10: tier-gated broadcasts the viewer can't unlock are emitted
    // as locked previews (no body / no media) so the fan can see what
    // they're missing without leaking the body. The follower must NOT
    // be able to read the body.
    const subscriberRow = followerMessages.body.messages
      .find((message) => message.id === 'broadcast-subscribers');
    if (subscriberRow) {
      expect(subscriberRow.locked).toBe(true);
      expect(subscriberRow.body).toBeUndefined();
      expect(subscriberRow.media).toBeUndefined();
    }

    const followerRead = await request(app)
      .post('/api/broadcast/messages/broadcast-subscribers/read')
      .set('x-test-user-id', USER_B);
    expect(followerRead.status).toBe(403);

    getTable('PublicPersona')[0].audience_label = 'subscribers';
    const subscriberFollow = await request(app)
      .post(`/api/personas/${PERSONA_A}/follow`)
      .set('x-test-user-id', USER_C)
      .send({});
    expect(subscriberFollow.status).toBe(201);
    expect(getTable('PersonaFollow').find((follow) => follow.follower_user_id === USER_C)).toMatchObject({
      relationship_type: 'subscriber',
      status: 'active',
    });

    const subscriberMessages = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_C);
    expect(subscriberMessages.status).toBe(200);
    expect(subscriberMessages.body.messages.map((message) => message.id)).toContain('broadcast-subscribers');

    const subscriberRead = await request(app)
      .post('/api/broadcast/messages/broadcast-subscribers/read')
      .set('x-test-user-id', USER_C);
    expect(subscriberRead.status).toBe(200);

    const publishRes = await request(app)
      .post(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A)
      .send({ body: 'New subscriber note', visibility: 'tier_or_above', target_tier_rank: 2 });
    expect(publishRes.status).toBe(201);
    expect(publishRes.body.message.delivered_count).toBe(1);
    expect(notificationService.notifyPersonaBroadcast).toHaveBeenLastCalledWith(expect.objectContaining({
      recipientUserIds: [USER_C],
      visibility: 'tier_or_above',
    }));
  });

  test('paid tier memberships can read Member+ broadcasts without entering the PersonaFollow view', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: false });
    seedTable('PersonaTier', [
      { id: 'tier-free', persona_id: PERSONA_A, rank: 1, name: 'Follower' },
      { id: 'tier-paid', persona_id: PERSONA_A, rank: 2, name: 'Member' },
    ]);
    seedTable('PersonaMembership', [{
      id: 'paid-membership-c',
      persona_id: PERSONA_A,
      user_id: USER_C,
      tier_id: 'tier-paid',
      fan_handle: 'fan_paidc',
      fan_handle_normalized: 'fan_paidc',
      relationship_type: 'follower',
      notification_level: 'all',
      status: 'active',
    }]);
    getTable('BroadcastMessage').push({
      id: 'broadcast-paid-subscribers',
      channel_id: CHANNEL_A,
      persona_id: PERSONA_A,
      author_user_id: USER_A,
      body: 'Paid subscriber-only broadcast',
      visibility: 'subscribers',
      status: 'published',
      published_at: '2026-05-04T12:00:00Z',
      delivered_count: 0,
      read_count: 0,
    });

    expect(getTable('PersonaFollow')).toHaveLength(0);

    const subscriberMessages = await request(app)
      .get(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_C);
    expect(subscriberMessages.status).toBe(200);
    expect(subscriberMessages.body.messages.map((message) => message.id)).toContain('broadcast-paid-subscribers');

    const publishRes = await request(app)
      .post(`/api/broadcast/channels/${CHANNEL_A}/messages`)
      .set('x-test-user-id', USER_A)
      .send({ body: 'New paid subscriber note', visibility: 'tier_or_above', target_tier_rank: 2 });
    expect(publishRes.status).toBe(201);
    expect(publishRes.body.message.delivered_count).toBe(1);
    expect(notificationService.notifyPersonaBroadcast).toHaveBeenLastCalledWith(expect.objectContaining({
      recipientUserIds: [USER_C],
      visibility: 'tier_or_above',
    }));
  });

  test('direct post access denies local audience posts without a matching local visibility path', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: false });
    getTable('Post').push({
      id: 'local-no-geo-post',
      user_id: USER_A,
      author_user_id: USER_A,
      identity_context_type: 'local',
      content: 'Nearby without viewer locality',
      visibility: 'neighborhood',
      audience: 'nearby',
      distribution_targets: [],
      created_at: '2026-05-05T00:00:00Z',
    });

    const res = await request(app)
      .get('/api/posts/local-no-geo-post')
      .set('x-test-user-id', USER_B);

    expect(res.status).toBe(403);
  });

  test('persona follow and local relationship graphs stay separate', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: false });

    const followRes = await request(app)
      .post(`/api/personas/${PERSONA_A}/follow`)
      .set('x-test-user-id', USER_B)
      .send({});

    expect(followRes.status).toBe(201);
    expect(getTable('PersonaFollow')).toEqual([
      expect.objectContaining({
        persona_id: PERSONA_A,
        follower_user_id: USER_B,
        status: 'active',
      }),
    ]);

    seedTable('PersonaFollow', []);
    seedTable('Relationship', [{
      id: 'relationship-request',
      requester_id: USER_B,
      addressee_id: USER_A,
      status: 'pending',
    }]);

    const acceptRes = await request(app)
      .post('/api/relationships/relationship-request/accept')
      .set('x-test-user-id', USER_A);

    expect(acceptRes.status).toBe(200);
    expect(getTable('Relationship')[0].status).toBe('accepted');
    expect(getTable('PersonaFollow')).toEqual([]);
  });

  test('bridges default off and expose only typed approved identity fields when enabled', async () => {
    const app = createApp();
    seedIdentityFixture({ follow: true });

    const personaOffRes = await request(app)
      .get('/api/personas/MayaBuilds')
      .set('x-test-user-id', USER_B);
    expect(personaOffRes.status).toBe(200);
    expect(personaOffRes.body.persona.bridges.localProfile).toBeNull();
    expect(JSON.stringify(personaOffRes.body)).not.toContain('RiverHome');

    const localOffRes = await request(app)
      .get('/api/local-profiles/RiverHome')
      .set('x-test-user-id', USER_B);
    expect(localOffRes.status).toBe(200);
    expect(localOffRes.body.profile.bridges.audienceProfile).toBeNull();
    expect(JSON.stringify(localOffRes.body)).not.toContain('MayaBuilds');

    seedTable('IdentityBridgeSetting', [{
      id: 'bridge-a',
      user_id: USER_A,
      persona_id: PERSONA_A,
      show_persona_on_local: true,
      show_local_on_persona: true,
    }]);

    const personaOnRes = await request(app)
      .get('/api/personas/MayaBuilds')
      .set('x-test-user-id', USER_B);
    expect(personaOnRes.status).toBe(200);
    expect(personaOnRes.body.persona.bridges.localProfile).toMatchObject({
      type: 'local',
      id: 'local-a',
      handle: 'RiverHome',
      displayName: 'RiverHome',
    });
    expect(personaOnRes.body.persona.bridges.localProfile).not.toHaveProperty('userId');
    expectNoLocalOrPrivateData(personaOnRes.body.persona);

    const localOnRes = await request(app)
      .get('/api/local-profiles/RiverHome')
      .set('x-test-user-id', USER_B);
    expect(localOnRes.status).toBe(200);
    expect(localOnRes.body.profile.bridges.audienceProfile).toMatchObject({
      type: 'persona',
      id: PERSONA_A,
      handle: 'MayaBuilds',
      displayName: 'Maya Builds',
    });
    expect(localOnRes.body.profile.bridges.audienceProfile).not.toHaveProperty('user_id');
    expect(JSON.stringify(localOnRes.body.profile.bridges.audienceProfile)).not.toContain(USER_A);
  });

  test('POST /api/posts refuses persona-context posts (P2.4 / unified-IA §4.1)', async () => {
    // Updated for P2.4: the personal-zone /api/posts route no longer
    // accepts persona-context posts. Persona content is created via the
    // audience-zone composer (P2.5) which targets /api/personas/:id/posts
    // and the broadcast routes. The persona-context location stripping
    // contract still holds — it's now enforced by the persona-specific
    // routes, not this one. Here we verify the firewall rejects the
    // legacy path with a clear error code so a stale client cannot
    // accidentally write a Post row scoped to a persona identity.
    const app = createApp();
    seedIdentityFixture({ follow: true });

    const res = await request(app)
      .post('/api/posts')
      .set('x-test-user-id', USER_A)
      .send({
        postAs: 'persona',
        identityContextId: PERSONA_A,
        audience: 'followers',
        content: 'Audience post from composer',
        latitude: 37.7749,
        longitude: -122.4194,
        locationName: 'Private Neighborhood',
        locationAddress: '1 Private Way',
        homeId: HOME_A,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('wrong_post_route');
    // Critical: no Post row was created — a persona-context row in the
    // Post table would defeat the firewall the audience composer enforces.
    const created = getTable('Post').find((post) => post.content === 'Audience post from composer');
    expect(created).toBeUndefined();
  });
});

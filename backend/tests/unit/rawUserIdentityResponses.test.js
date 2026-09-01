const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: 'user' };
  }
  next();
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/s3Service', () => ({
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

function createApp(routePath, routeModule) {
  const app = express();
  app.use(express.json());
  app.use(routePath, routeModule);
  return app;
}

function expectNoPrivateUserPayload(value) {
  const json = JSON.stringify(value);
  expect(json).not.toContain('private@example.com');
  expect(json).not.toContain('Private City');
  expect(json).not.toContain('"last_name"');
  expect(json).not.toContain('"email"');
  expect(json).not.toContain('"phone"');
}

describe('raw User response audit', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('post detail and comments use typed identity authors instead of raw User joins', async () => {
    const app = createApp('/api/posts', require('../../routes/posts'));
    seedTable('LocalProfile', [{
      id: 'local-author',
      user_id: 'author-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
      avatar_url: 'https://cdn.example.com/local.jpg',
    }]);
    seedTable('Post', [{
      id: 'post-1',
      user_id: 'author-user',
      author_user_id: 'author-user',
      identity_context_type: 'local',
      identity_context_id: 'local-author',
      content: 'Public update',
      visibility: 'public',
      audience: 'public',
      distribution_targets: ['public'],
      media_urls: [],
      media_types: [],
      archived_at: null,
      created_at: '2026-05-01T00:00:00Z',
      creator: {
        id: 'author-user',
        username: 'raw-user',
        name: 'Legal Secret',
        last_name: 'Secret',
        city: 'Private City',
        email: 'private@example.com',
      },
    }]);
    seedTable('PostComment', [{
      id: 'comment-1',
      post_id: 'post-1',
      user_id: 'comment-user',
      comment: 'Looks good',
      is_deleted: false,
      created_at: '2026-05-01T00:01:00Z',
      author: {
        id: 'comment-user',
        username: 'raw-commenter',
        name: 'Commenter Name',
        last_name: 'Name',
        city: 'Private City',
        email: 'private@example.com',
      },
    }]);
    seedTable('PostLike', []);
    seedTable('PostSave', []);
    seedTable('PostShare', []);
    seedTable('File', []);

    const res = await request(app)
      .get('/api/posts/post-1')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body.post.author).toMatchObject({
      type: 'local',
      id: 'local-author',
      handle: 'RiverHome',
    });
    expect(res.body.post.comments[0].author).toMatchObject({
      type: 'local',
      handle: 'raw-commenter',
      displayName: 'Commenter Name',
    });
    expectNoPrivateUserPayload(res.body);
  });

  test('public local profile activity strips raw user, private location, and unsafe metadata fields', async () => {
    const app = createApp('/api/local-profiles', require('../../routes/localProfiles'));
    seedTable('LocalProfile', [{
      id: 'local-author',
      user_id: 'author-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
      avatar_url: 'https://cdn.example.com/local.jpg',
      show_gig_history: true,
    }]);
    seedTable('Post', [{
      id: 'post-1',
      user_id: 'author-user',
      author_user_id: 'author-user',
      identity_context_type: 'local',
      identity_context_id: 'local-author',
      post_as: 'local',
      audience: 'public',
      distribution_targets: ['public'],
      content: 'Public profile update',
      visibility: 'public',
      visibility_scope: 'public',
      show_on_profile: true,
      profile_visibility_scope: 'public',
      location_precision: 'exact_place',
      latitude: 37.712345,
      longitude: -122.412345,
      location_name: 'Nearby park',
      location_address: '1 Private Way',
      home_id: 'home-secret',
      post_metadata: {
        starter_key: 'best_place_watch',
        author_user_id: 'author-user',
        private_email: 'private@example.com',
        legal_name: 'Legal Secret',
      },
      archived_at: null,
      created_at: '2026-05-01T00:00:00Z',
    }]);

    const res = await request(app).get('/api/local-profiles/RiverHome/activity');

    expect(res.status).toBe(200);
    expect(res.body.posts[0].author).toMatchObject({
      type: 'local',
      id: 'local-author',
      handle: 'RiverHome',
    });
    expect(res.body.posts[0]).not.toHaveProperty('user_id');
    expect(res.body.posts[0]).not.toHaveProperty('author_user_id');
    expect(res.body.posts[0]).not.toHaveProperty('home_id');
    expect(res.body.posts[0]).not.toHaveProperty('location_address');
    expect(res.body.posts[0].location_precision).toBe('approx_area');
    expect(res.body.posts[0].post_metadata).toEqual({ starter_key: 'best_place_watch' });
    expectNoPrivateUserPayload(res.body);
  });

  test('public local profile gigs and listings do not leak raw owners or exact addresses', async () => {
    const app = createApp('/api/local-profiles', require('../../routes/localProfiles'));
    seedTable('LocalProfile', [{
      id: 'local-author',
      user_id: 'author-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
      show_gig_history: true,
    }]);
    seedTable('Gig', [{
      id: 'gig-1',
      user_id: 'author-user',
      author_user_id: 'author-user',
      title: 'Move boxes',
      status: 'open',
      location_precision: 'exact_place',
      latitude: 37.712345,
      longitude: -122.412345,
      location_address: '1 Private Way',
      home_id: 'home-secret',
      metadata: {
        event_key: 'safe-event',
        owner_user_id: 'author-user',
        private_email: 'private@example.com',
      },
      creator: {
        id: 'author-user',
        username: 'raw-owner',
        name: 'Legal Secret',
        last_name: 'Secret',
        email: 'private@example.com',
      },
      created_at: '2026-05-01T00:00:00Z',
    }]);
    seedTable('Listing', [{
      id: 'listing-1',
      user_id: 'author-user',
      owner_id: 'author-user',
      title: 'Bike',
      status: 'active',
      location_precision: 'exact_place',
      latitude: 37.712345,
      longitude: -122.412345,
      location_address: '1 Private Way',
      creator: {
        id: 'author-user',
        username: 'raw-owner',
        name: 'Legal Secret',
        last_name: 'Secret',
        email: 'private@example.com',
      },
      created_at: '2026-05-01T00:00:00Z',
    }]);

    const [gigsRes, listingsRes] = await Promise.all([
      request(app).get('/api/local-profiles/RiverHome/gigs'),
      request(app).get('/api/local-profiles/RiverHome/listings'),
    ]);

    expect(gigsRes.status).toBe(200);
    expect(listingsRes.status).toBe(200);
    expect(gigsRes.body.gigs[0].author).toMatchObject({
      type: 'local',
      handle: 'RiverHome',
    });
    expect(listingsRes.body.listings[0].author).toMatchObject({
      type: 'local',
      handle: 'RiverHome',
    });
    for (const item of [gigsRes.body.gigs[0], listingsRes.body.listings[0]]) {
      expect(item).not.toHaveProperty('user_id');
      expect(item).not.toHaveProperty('owner_id');
      expect(item).not.toHaveProperty('author_user_id');
      expect(item).not.toHaveProperty('home_id');
      expect(item).not.toHaveProperty('creator');
      expect(item).not.toHaveProperty('location_address');
      expect(item.location_precision).toBe('approx_area');
    }
    expect(gigsRes.body.gigs[0].metadata).toEqual({ event_key: 'safe-event' });
    expectNoPrivateUserPayload(gigsRes.body);
    expectNoPrivateUserPayload(listingsRes.body);
  });

  test('public persona profile and posts expose persona identity only', async () => {
    const app = createApp('/api/personas', require('../../routes/personas'));
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'owner-user',
      handle: 'MayaBuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      avatar_url: 'https://cdn.example.com/persona.jpg',
      banner_url: 'https://cdn.example.com/banner.jpg',
      bio: 'Public workshop updates',
      public_links: [{ label: 'Site', url: 'https://example.com' }],
      category: 'creator',
      audience_label: 'followers',
      audience_mode: 'open',
      follower_count: 12,
      status: 'active',
    }]);
    seedTable('IdentityBridgeSetting', []);
    seedTable('PersonaFollow', []);
    seedTable('BroadcastChannel', [{
      id: 'channel-1',
      persona_id: 'persona-1',
      title: 'Maya Broadcast',
      status: 'active',
    }]);
    seedTable('Post', [{
      id: 'post-1',
      user_id: 'owner-user',
      author_user_id: 'owner-user',
      identity_context_type: 'persona',
      identity_context_id: 'persona-1',
      post_as: 'persona',
      audience: 'public',
      distribution_targets: ['public'],
      content: 'Public audience post',
      visibility: 'public',
      location_precision: 'exact_place',
      latitude: 37.712345,
      longitude: -122.412345,
      location_address: '1 Private Way',
      home_id: 'home-secret',
      post_metadata: {
        starter_key: 'best_place_watch',
        owner_user_id: 'owner-user',
        private_email: 'private@example.com',
      },
      created_at: '2026-05-01T00:00:00Z',
    }]);

    const [profileRes, postsRes] = await Promise.all([
      request(app).get('/api/personas/MayaBuilds'),
      request(app).get('/api/personas/MayaBuilds/posts'),
    ]);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.persona).toMatchObject({
      type: 'persona',
      id: 'persona-1',
      handle: 'MayaBuilds',
      publicLinks: [{ label: 'Site', url: 'https://example.com' }],
    });
    expect(profileRes.body.persona).not.toHaveProperty('user_id');
    expect(profileRes.body.persona).not.toHaveProperty('userId');
    expect(postsRes.status).toBe(200);
    expect(postsRes.body.posts[0].author).toMatchObject({
      type: 'persona',
      id: 'persona-1',
      handle: 'MayaBuilds',
    });
    expect(JSON.stringify(postsRes.body)).not.toContain('owner-user');
    expect(postsRes.body.posts[0].author_user_id).toBeNull();
    expect(postsRes.body.posts[0]).not.toHaveProperty('home_id');
    expect(postsRes.body.posts[0]).not.toHaveProperty('location_address');
    expect(postsRes.body.posts[0].post_metadata).toEqual({ starter_key: 'best_place_watch' });
    expectNoPrivateUserPayload(profileRes.body);
    expectNoPrivateUserPayload(postsRes.body);
  });

  test('listing detail serializes seller identity instead of returning raw creator User', async () => {
    const app = createApp('/api/listings', require('../../routes/listings'));
    seedTable('Listing', [{
      id: 'listing-1',
      user_id: 'seller-user',
      title: 'Bike',
      description: 'A bike',
      status: 'active',
      category: 'sports',
      latitude: 37.7,
      longitude: -122.4,
      location_precision: 'approx_area',
      reveal_policy: 'after_interest',
      media_urls: [],
      media_types: [],
      created_at: '2026-05-01T00:00:00Z',
      creator: {
        id: 'seller-user',
        username: 'raw-seller',
        name: 'Seller Name',
        last_name: 'Name',
        city: 'Private City',
        email: 'private@example.com',
        profile_picture_url: 'https://cdn.example.com/seller.jpg',
      },
    }]);
    seedTable('ListingAddressGrant', []);
    seedTable('ListingSave', []);

    const res = await request(app)
      .get('/api/listings/listing-1')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    // P0.4: serializer outputs no longer carry the legacy username /
    // profile_picture_url aliases. Consumers read handle / avatarUrl.
    expect(res.body.listing.creator).toMatchObject({
      type: 'local',
      handle: 'raw-seller',
      displayName: 'Seller Name',
      avatarUrl: 'https://cdn.example.com/seller.jpg',
    });
    expect(res.body.listing.creator).not.toHaveProperty('username');
    expect(res.body.listing.creator).not.toHaveProperty('profile_picture_url');
    expect(res.body.listing.creator).not.toHaveProperty('first_name');
    expect(res.body.listing.creator).not.toHaveProperty('name');
    expectNoPrivateUserPayload(res.body);
  });

  test('gig detail serializes poster and accepted worker identities', async () => {
    const app = createApp('/api/gigs', require('../../routes/gigs'));
    seedTable('Gig', [{
      id: 'gig-1',
      user_id: 'poster-user',
      title: 'Move boxes',
      status: 'open',
      category: 'moving',
      accepted_by: 'worker-user',
      latitude: 37.7,
      longitude: -122.4,
      location_precision: 'approx_area',
      attachments: [],
      creator: {
        id: 'poster-user',
        username: 'raw-poster',
        name: 'Poster Name',
        last_name: 'Name',
        city: 'Private City',
        email: 'private@example.com',
      },
      acceptedBy: {
        id: 'worker-user',
        username: 'raw-worker',
        name: 'Worker Public',
        last_name: 'Secret',
        email: 'private@example.com',
      },
    }]);
    seedTable('GigSave', []);

    const res = await request(app)
      .get('/api/gigs/gig-1')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body.gig.creator).toMatchObject({
      type: 'local',
      handle: 'raw-poster',
      displayName: 'Poster Name',
    });
    expect(res.body.gig.acceptedBy).toMatchObject({
      type: 'local',
      handle: 'raw-worker',
      displayName: 'Worker Public',
    });
    expectNoPrivateUserPayload(res.body);
  });

  test('chat messages serialize sender identity and strip internal actor ids', async () => {
    const app = createApp('/api/chat', require('../../routes/chats'));
    seedTable('ChatParticipant', [{
      id: 'participant-1',
      room_id: 'room-1',
      user_id: 'viewer-user',
      is_active: true,
      role: 'member',
    }]);
    seedTable('ChatMessage', [{
      id: 'message-1',
      room_id: 'room-1',
      user_id: 'sender-user',
      actor_user_id: 'private-actor-user',
      message: 'Hello',
      type: 'text',
      deleted: false,
      created_at: '2026-05-01T00:00:00Z',
      sender: {
        id: 'sender-user',
        username: 'raw-sender',
        name: 'Sender Name',
        last_name: 'Name',
        city: 'Private City',
        email: 'private@example.com',
      },
    }]);
    seedTable('MessageReaction', []);

    const res = await request(app)
      .get('/api/chat/rooms/room-1/messages')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body.messages[0].sender).toMatchObject({
      type: 'local',
      handle: 'raw-sender',
      displayName: 'Sender Name',
    });
    expect(res.body.messages[0]).not.toHaveProperty('actor_user_id');
    expectNoPrivateUserPayload(res.body);
  });

  test('chat reaction summaries use typed identities instead of raw User names', async () => {
    const app = createApp('/api/chat', require('../../routes/chats'));
    seedTable('ChatParticipant', [{
      id: 'participant-1',
      room_id: 'room-1',
      user_id: 'viewer-user',
      is_active: true,
      role: 'member',
    }]);
    seedTable('ChatMessage', [{
      id: 'message-1',
      room_id: 'room-1',
      user_id: 'sender-user',
      message: 'Hello',
      type: 'text',
      deleted: false,
      created_at: '2026-05-01T00:00:00Z',
    }]);
    seedTable('MessageReaction', [{
      id: 'reaction-1',
      message_id: 'message-1',
      user_id: 'reactor-user',
      reaction: 'like',
      created_at: '2026-05-01T00:01:00Z',
    }]);
    seedTable('User', [{
      id: 'reactor-user',
      username: 'raw-reactor',
      name: 'Reactor Name',
      last_name: 'Name',
      email: 'private@example.com',
    }]);

    const res = await request(app)
      .get('/api/chat/messages/message-1/reactions')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body.reactions[0].users[0]).toMatchObject({
      name: 'Reactor Name',
      username: 'raw-reactor',
      identity: {
        type: 'local',
        handle: 'raw-reactor',
        displayName: 'Reactor Name',
      },
    });
    expectNoPrivateUserPayload(res.body);
  });

  test('chat message edits strip internal actor ids from REST responses', async () => {
    const app = createApp('/api/chat', require('../../routes/chats'));
    seedTable('ChatMessage', [{
      id: 'message-1',
      room_id: 'room-1',
      user_id: 'viewer-user',
      actor_user_id: 'private-actor-user',
      message: 'Old text',
      type: 'text',
      deleted: false,
      created_at: '2026-05-01T00:00:00Z',
    }]);

    const res = await request(app)
      .put('/api/chat/messages/message-1')
      .set('x-test-user-id', 'viewer-user')
      .send({ messageText: 'New text' });

    expect(res.status).toBe(200);
    expect(res.body.message.message).toBe('New text');
    expect(res.body.message).not.toHaveProperty('actor_user_id');
    expectNoPrivateUserPayload(res.body);
  });
});

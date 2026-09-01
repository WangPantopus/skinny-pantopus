const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] || 'user' };
  }
  next();
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/local-profiles', require('../../routes/localProfiles'));
  app.use('/api/personas', require('../../routes/personas'));
  app.use('/api/identity-center', require('../../routes/identityCenter'));
  return app;
}

describe('Identity Firewall regressions', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('local profile activity returns only visible, location-safe local posts', async () => {
    const app = createApp();
    seedTable('LocalProfile', [{
      id: 'local-1',
      user_id: 'author-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
      public_city: 'Oakland',
      public_state: 'CA',
      verified_resident: true,
    }]);
    seedTable('Relationship', []);
    seedTable('Post', [
      {
        id: 'public-post',
        user_id: 'author-user',
        author_user_id: 'author-user',
        identity_context_type: 'local',
        title: 'Porch repair',
        content: 'Local update',
        show_on_profile: true,
        profile_visibility_scope: 'public',
        visibility: 'neighborhood',
        audience: 'nearby',
        distribution_targets: ['place'],
        location_precision: 'exact_place',
        latitude: 37.7749,
        longitude: -122.4194,
        effective_latitude: 37.7749,
        effective_longitude: -122.4194,
        location_address: '1 Private Way',
        home_id: 'home-private',
        archived_at: null,
        created_at: '2026-05-01T00:00:00Z',
      },
      {
        id: 'followers-post',
        user_id: 'author-user',
        author_user_id: 'author-user',
        identity_context_type: 'local',
        content: 'Followers only',
        show_on_profile: true,
        profile_visibility_scope: 'public',
        visibility: 'followers',
        audience: 'followers',
        distribution_targets: ['followers'],
        archived_at: null,
        created_at: '2026-05-02T00:00:00Z',
      },
      {
        id: 'household-post',
        user_id: 'author-user',
        identity_context_type: 'home',
        content: 'Household only',
        show_on_profile: true,
        profile_visibility_scope: 'public',
        visibility: 'household',
        audience: 'household',
        distribution_targets: ['household'],
        archived_at: null,
        created_at: '2026-05-03T00:00:00Z',
      },
      {
        id: 'persona-post',
        user_id: 'author-user',
        author_user_id: 'author-user',
        identity_context_type: 'persona',
        identity_context_id: 'persona-1',
        content: 'Audience update',
        show_on_profile: true,
        profile_visibility_scope: 'public',
        audience: 'public',
        distribution_targets: ['public'],
        archived_at: null,
        created_at: '2026-05-04T00:00:00Z',
      },
    ]);

    const res = await request(app)
      .get('/api/local-profiles/RiverHome/activity')
      .set('x-test-user-id', 'public-viewer');

    expect(res.status).toBe(200);
    expect(res.body.posts.map((post) => post.id)).toEqual(['public-post']);
    const [post] = res.body.posts;
    expect(post).not.toHaveProperty('user_id');
    expect(post).not.toHaveProperty('author_user_id');
    expect(post).not.toHaveProperty('home_id');
    expect(post).not.toHaveProperty('effective_latitude');
    expect(post).not.toHaveProperty('effective_longitude');
    expect(post).not.toHaveProperty('location_address');
    expect(post.latitude).not.toBe(37.7749);
    expect(post.location_precision).toBe('approx_area');
    expect(JSON.stringify(post)).not.toContain('author-user');
    expect(post.author).toMatchObject({
      type: 'local',
      id: 'local-1',
      handle: 'RiverHome',
    });
  });

  test('direct local profile routes honor profile and search visibility', async () => {
    const app = createApp();
    seedTable('LocalProfile', [{
      id: 'local-private',
      user_id: 'author-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
      profile_visibility: 'private',
      search_visibility: 'nobody',
      public_city: 'Oakland',
      public_state: 'CA',
    }]);
    seedTable('Relationship', []);
    seedTable('UserPrivacySettings', []);
    seedTable('UserProfileBlock', []);
    seedTable('Post', []);
    seedTable('Gig', []);
    seedTable('Listing', []);

    for (const path of [
      '/api/local-profiles/RiverHome',
      '/api/local-profiles/RiverHome/activity',
      '/api/local-profiles/RiverHome/gigs',
      '/api/local-profiles/RiverHome/listings',
    ]) {
      const res = await request(app)
        .get(path)
        .set('x-test-user-id', 'viewer-user');
      expect(res.status).toBe(404);
    }

    const ownerRes = await request(app)
      .get('/api/local-profiles/RiverHome')
      .set('x-test-user-id', 'author-user');
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.profile.id).toBe('local-private');
  });

  test('PATCH persona preserves omitted fields instead of applying create defaults', async () => {
    const app = createApp();
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'owner-user',
      handle: 'MayaBuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      public_links: [{ label: 'Site', url: 'https://example.com' }],
      category: 'consultant',
      audience_label: 'clients',
      audience_mode: 'approval_required',
      status: 'active',
    }]);

    const res = await request(app)
      .patch('/api/personas/persona-1')
      .set('x-test-user-id', 'owner-user')
      .send({ display_name: 'Maya Builds Studio' });

    expect(res.status).toBe(200);
    const row = getTable('PublicPersona')[0];
    expect(row.display_name).toBe('Maya Builds Studio');
    expect(row.public_links).toEqual([{ label: 'Site', url: 'https://example.com' }]);
    expect(row.category).toBe('consultant');
    expect(row.audience_label).toBe('clients');
    expect(row.audience_mode).toBe('approval_required');
  });

  test('public persona GET reads existing broadcast state without creating a channel', async () => {
    const app = createApp();
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'owner-user',
      handle: 'MayaBuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      status: 'active',
    }]);
    seedTable('BroadcastChannel', []);
    seedTable('IdentityBridgeSetting', []);

    const res = await request(app).get('/api/personas/MayaBuilds');

    expect(res.status).toBe(200);
    expect(res.body.channel).toBeNull();
    expect(getTable('BroadcastChannel')).toHaveLength(0);
  });

  test('View As public preview includes the same explicit persona-to-local bridge as the Beacon', async () => {
    const app = createApp();
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'owner-user',
      handle: 'MayaBuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      status: 'active',
    }]);
    seedTable('LocalProfile', [{
      id: 'local-1',
      user_id: 'owner-user',
      handle: 'RiverHome',
      handle_normalized: 'riverhome',
      display_name: 'RiverHome',
    }]);
    seedTable('IdentityBridgeSetting', [{
      id: 'bridge-1',
      user_id: 'owner-user',
      persona_id: 'persona-1',
      show_persona_on_local: false,
      show_local_on_persona: true,
    }]);
    seedTable('Post', [
      {
        id: 'public-persona-post',
        user_id: 'owner-user',
        author_user_id: 'owner-user',
        identity_context_type: 'persona',
        identity_context_id: 'persona-1',
        content: 'Public persona note',
        audience: 'public',
        visibility: 'public',
        distribution_targets: ['public'],
        created_at: '2026-05-04T00:00:00Z',
      },
      {
        id: 'follower-persona-post',
        user_id: 'owner-user',
        author_user_id: 'owner-user',
        identity_context_type: 'persona',
        identity_context_id: 'persona-1',
        content: 'Follower persona note',
        audience: 'followers',
        visibility: 'followers',
        distribution_targets: ['persona_followers'],
        created_at: '2026-05-05T00:00:00Z',
      },
    ]);
    seedTable('BroadcastChannel', [{
      id: 'channel-1',
      persona_id: 'persona-1',
      title: 'Maya Broadcast',
      status: 'active',
    }]);
    seedTable('BroadcastMessage', [
      {
        id: 'public-broadcast',
        channel_id: 'channel-1',
        persona_id: 'persona-1',
        author_user_id: 'owner-user',
        body: 'Public broadcast',
        visibility: 'public',
        status: 'published',
        created_at: '2026-05-04T00:00:00Z',
        published_at: '2026-05-04T00:00:00Z',
      },
      {
        id: 'follower-broadcast',
        channel_id: 'channel-1',
        persona_id: 'persona-1',
        author_user_id: 'owner-user',
        body: 'Follower broadcast',
        visibility: 'followers',
        status: 'published',
        created_at: '2026-05-05T00:00:00Z',
        published_at: '2026-05-05T00:00:00Z',
      },
      {
        id: 'subscriber-broadcast',
        channel_id: 'channel-1',
        persona_id: 'persona-1',
        author_user_id: 'owner-user',
        body: 'Subscriber broadcast',
        visibility: 'subscribers',
        status: 'published',
        created_at: '2026-05-06T00:00:00Z',
        published_at: '2026-05-06T00:00:00Z',
      },
    ]);

    const res = await request(app)
      .get('/api/identity-center/view-as?surface=persona&handle=MayaBuilds&viewer=public')
      .set('x-test-user-id', 'owner-user');

    expect(res.status).toBe(200);
    expect(res.body.profile.bridges.localProfile).toMatchObject({
      type: 'local',
      id: 'local-1',
      handle: 'RiverHome',
    });
    expect(res.body.visibleSections.map((section) => section.key)).toEqual(expect.arrayContaining(['profile', 'posts', 'updates', 'profile_link_local']));
    expect(res.body.protectedSections.map((section) => section.key)).toEqual(expect.arrayContaining(['private_account', 'home', 'local_life', 'direct_chat']));
    expect(res.body.counts).toMatchObject({
      visiblePosts: 1,
      hiddenPosts: 1,
      visibleBroadcasts: 1,
      hiddenBroadcasts: 2,
    });
    expect(res.body.sample.posts.map((post) => post.id)).toEqual(['public-persona-post']);
    expect(res.body.sample.broadcasts.map((message) => message.id)).toEqual(['public-broadcast']);

    const followerPreview = await request(app)
      .get('/api/identity-center/view-as?surface=persona&handle=MayaBuilds&viewer=persona_audience_member')
      .set('x-test-user-id', 'owner-user');
    expect(followerPreview.status).toBe(200);
    expect(followerPreview.body.counts).toMatchObject({
      visiblePosts: 2,
      hiddenPosts: 0,
      visibleBroadcasts: 2,
      hiddenBroadcasts: 1,
    });
    expect(followerPreview.body.sample.broadcasts.map((message) => message.id)).not.toContain('subscriber-broadcast');
    expect(JSON.stringify(followerPreview.body)).not.toContain('author_user_id');
    expect(JSON.stringify(followerPreview.body)).not.toContain('owner-user');
  });

  test('approval-required persona follows use the migration-allowed follow_request source', async () => {
    const app = createApp();
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'owner-user',
      handle: 'MayaBuilds',
      handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds',
      audience_mode: 'approval_required',
      follower_count: 0,
      status: 'active',
    }]);
    seedTable('PersonaFollow', []);

    const res = await request(app)
      .post('/api/personas/persona-1/follow')
      .set('x-test-user-id', 'viewer-user')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(getTable('PersonaFollow')[0]).toMatchObject({
      persona_id: 'persona-1',
      follower_user_id: 'viewer-user',
      status: 'pending',
      source: 'follow_request',
    });
  });

  test('persona follow migrations allow pending follow requests', () => {
    const backendMigration = fs.readFileSync(
      path.resolve(__dirname, '../../database/migrations/128_identity_firewall_personas.sql'),
      'utf8'
    );
    const supabaseMigration = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/20260505000001_identity_firewall_personas.sql'),
      'utf8'
    );

    expect(backendMigration).toContain("'follow_request'");
    expect(supabaseMigration).toContain("'follow_request'");
  });

  test('local profile backfill migrations resolve normalized handle collisions', () => {
    const backendMigration = fs.readFileSync(
      path.resolve(__dirname, '../../database/migrations/128_identity_firewall_personas.sql'),
      'utf8'
    );
    const supabaseMigration = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/20260505000001_identity_firewall_personas.sql'),
      'utf8'
    );

    for (const migration of [backendMigration, supabaseMigration]) {
      expect(migration).toContain('count(*) OVER (PARTITION BY lower("base_handle")) AS "handle_group_count"');
      expect(migration).toContain('"base_handle" || \'-\' || replace(ranked_users."id"::text, \'-\', \'\')');
      expect(migration).toContain('existing_lp."handle_normalized" = ranked_users."base_handle_normalized"');
    }
  });
});

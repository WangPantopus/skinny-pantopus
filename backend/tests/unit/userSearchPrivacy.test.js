const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: req.headers['x-test-user-id'] || 'viewer-user', role: 'user' };
  next();
});

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  const userId = req.headers['x-test-user-id'];
  req.user = userId ? { id: userId, role: 'user' } : null;
  next();
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../config/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
}));

jest.mock('../../services/gig/affinityService', () => ({
  recordInteraction: jest.fn().mockResolvedValue(undefined),
  getUserAffinities: jest.fn().mockResolvedValue([]),
  getCategoryAffinity: jest.fn().mockResolvedValue(0),
  computeScore: jest.fn().mockReturnValue(0),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/privacy', require('../../routes/privacy'));
  app.use('/api/users', require('../../routes/users'));
  return app;
}

describe('user search privacy', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    seedTable('Relationship', []);
    seedTable('UserPrivacySettings', []);
    seedTable('UserProfileBlock', []);
    seedTable('LocalProfile', [
      {
        id: 'local-viewer',
        user_id: 'viewer-user',
        handle: 'viewer',
        handle_normalized: 'viewer',
        display_name: 'Viewer',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-visible',
        user_id: 'visible-user',
        handle: 'river-neighbor',
        handle_normalized: 'river-neighbor',
        display_name: 'River Neighbor',
        avatar_url: 'https://cdn.example.com/river.jpg',
        public_city: 'Private City',
        public_state: 'CA',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-private',
        user_id: 'private-user',
        handle: 'hidden-neighbor',
        handle_normalized: 'hidden-neighbor',
        display_name: 'Hidden Neighbor',
        profile_visibility: 'private',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-registered',
        user_id: 'registered-user',
        handle: 'registered-neighbor',
        handle_normalized: 'registered-neighbor',
        display_name: 'Registered Neighbor',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-quiet',
        user_id: 'unsearchable-user',
        handle: 'quiet-neighbor',
        handle_normalized: 'quiet-neighbor',
        display_name: 'Quiet Neighbor',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-name-opt-in',
        user_id: 'name-opt-in-user',
        handle: 'garden-helper',
        handle_normalized: 'garden-helper',
        display_name: 'Garden Helper',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        user_id: 'handle-only-user',
        handle: 'porch-builder',
        handle_normalized: 'porch-builder',
        display_name: 'Porch Builder',
        avatar_url: 'https://cdn.example.com/porch.jpg',
        bio: 'Public local profile bio',
        tagline: 'Builds porch trust',
        public_city: 'Oakland',
        public_state: 'CA',
        profile_visibility: 'public',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
      {
        id: 'local-hidden-handle-only',
        user_id: 'hidden-handle-only-user',
        handle: 'private-porch',
        handle_normalized: 'private-porch',
        display_name: 'Private Porch',
        profile_visibility: 'private',
        search_visibility: 'everyone',
        show_neighborhood: false,
      },
    ]);
    seedTable('User', [
      {
        id: 'viewer-user',
        username: 'viewer',
        name: 'Viewer',
        account_type: 'personal',
      },
      {
        id: 'visible-user',
        username: 'river-neighbor',
        name: 'River Neighbor',
        first_name: 'River',
        last_name: 'Neighbor',
        email: 'private.river@example.com',
        account_type: 'personal',
        profile_visibility: 'public',
      },
      {
        id: 'private-user',
        username: 'hidden-neighbor',
        name: 'Hidden Neighbor',
        email: 'hidden@example.com',
        account_type: 'personal',
        profile_visibility: 'private',
      },
      {
        id: 'registered-user',
        username: 'registered-neighbor',
        name: 'Registered Neighbor',
        email: 'registered@example.com',
        account_type: 'personal',
        profile_visibility: 'registered',
      },
      {
        id: 'unsearchable-user',
        username: 'quiet-neighbor',
        name: 'Quiet Neighbor',
        email: 'quiet@example.com',
        account_type: 'personal',
        profile_visibility: 'public',
      },
      {
        id: 'name-opt-in-user',
        username: 'garden-helper',
        name: 'Alexandra Middle Stone',
        first_name: 'Alexandra',
        middle_name: 'Middle',
        last_name: 'Stone',
        email: 'alexandra.stone@example.com',
        account_type: 'personal',
        profile_visibility: 'public',
      },
      {
        id: 'handle-only-user',
        username: 'legacy-porch-builder',
        name: 'Legacy Porch Name',
        bio: 'Private legacy bio',
        tagline: 'Private legacy tagline',
        email: 'porch@example.com',
        account_type: 'personal',
        profile_visibility: 'public',
      },
      {
        id: 'hidden-handle-only-user',
        username: 'legacy-private-porch',
        name: 'Legacy Private Porch',
        email: 'private-porch@example.com',
        account_type: 'personal',
        profile_visibility: 'public',
      },
    ]);
  });

  test('does not match private email fields', async () => {
    const app = createApp();

    const emailRes = await request(app)
      .get('/api/users/search')
      .query({ q: 'private.river@example.com', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(emailRes.status).toBe(200);
    expect(emailRes.body.users).toEqual([]);

    const usernameRes = await request(app)
      .get('/api/users/search')
      .query({ q: 'river', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(usernameRes.status).toBe(200);
    expect(usernameRes.body.users.map((user) => user.id)).toEqual(['visible-user']);
    expect(usernameRes.body.users[0]).toMatchObject({
      username: 'river-neighbor',
      name: 'River Neighbor',
      city: null,
      state: null,
      type: 'local_profile',
    });
    expect(JSON.stringify(usernameRes.body)).not.toContain('private.river@example.com');
    expect(JSON.stringify(usernameRes.body)).not.toContain('Private City');
  });

  test('excludes private and unsearchable accounts', async () => {
    const app = createApp();
    seedTable('UserPrivacySettings', [{
      id: 'privacy-quiet',
      user_id: 'unsearchable-user',
      search_visibility: 'nobody',
    }]);

    const privateRes = await request(app)
      .get('/api/users/search')
      .query({ q: 'hidden', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(privateRes.status).toBe(200);
    expect(privateRes.body.users).toEqual([]);

    const unsearchableRes = await request(app)
      .get('/api/users/search')
      .query({ q: 'quiet', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(unsearchableRes.status).toBe(200);
    expect(unsearchableRes.body.users).toEqual([]);
  });

  test('legacy public profile routes enforce visibility and search privacy', async () => {
    const app = createApp();
    seedTable('UserPrivacySettings', [{
      id: 'privacy-quiet',
      user_id: 'unsearchable-user',
      search_visibility: 'nobody',
    }]);

    const anonymousRegisteredRes = await request(app)
      .get('/api/users/registered-neighbor');
    expect(anonymousRegisteredRes.status).toBe(403);

    const registeredViewerRes = await request(app)
      .get('/api/users/registered-neighbor')
      .set('x-test-user-id', 'viewer-user');
    expect(registeredViewerRes.status).toBe(200);
    expect(registeredViewerRes.body.user.id).toBe('registered-user');

    const privateByIdRes = await request(app)
      .get('/api/users/id/private-user')
      .set('x-test-user-id', 'viewer-user');
    expect(privateByIdRes.status).toBe(403);

    const unsearchableByUsernameRes = await request(app)
      .get('/api/users/username/quiet-neighbor')
      .set('x-test-user-id', 'viewer-user');
    expect(unsearchableByUsernameRes.status).toBe(403);
  });

  test('public profile route resolves LocalProfile handles when they differ from legacy usernames', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/users/username/porch-builder')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'handle-only-user',
      username: 'porch-builder',
      name: 'Porch Builder',
      bio: 'Public local profile bio',
      tagline: 'Builds porch trust',
      avatar_url: 'https://cdn.example.com/porch.jpg',
      profile_picture_url: 'https://cdn.example.com/porch.jpg',
      city: null,
      state: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('porch@example.com');
    expect(JSON.stringify(res.body)).not.toContain('Private legacy bio');
  });

  test('public profile route resolves LocalProfile ids when mobile links carry the local profile UUID', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/users/id/44444444-4444-4444-8444-444444444444')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'handle-only-user',
      username: 'porch-builder',
      name: 'Porch Builder',
      avatar_url: 'https://cdn.example.com/porch.jpg',
      profile_picture_url: 'https://cdn.example.com/porch.jpg',
    });
  });

  test('public profile route respects LocalProfile visibility for handle fallback', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/api/users/username/private-porch')
      .set('x-test-user-id', 'viewer-user');

    expect(res.status).toBe(403);
  });

  test('privacy settings updates sync local profile search discoverability', async () => {
    const app = createApp();

    const hideRes = await request(app)
      .patch('/api/privacy/settings')
      .set('x-test-user-id', 'visible-user')
      .send({ search_visibility: 'nobody' });

    expect(hideRes.status).toBe(200);
    expect(hideRes.body.settings.search_visibility).toBe('nobody');
    expect(getTable('LocalProfile').find((profile) => profile.user_id === 'visible-user'))
      .toMatchObject({ search_visibility: 'nobody' });

    const hiddenSearch = await request(app)
      .get('/api/users/search')
      .query({ q: 'river', type: 'people' })
      .set('x-test-user-id', 'viewer-user');

    expect(hiddenSearch.status).toBe(200);
    expect(hiddenSearch.body.users).toEqual([]);

    const showRes = await request(app)
      .patch('/api/privacy/settings')
      .set('x-test-user-id', 'visible-user')
      .send({ search_visibility: 'everyone' });

    expect(showRes.status).toBe(200);
    expect(showRes.body.settings.search_visibility).toBe('everyone');
    expect(getTable('LocalProfile').find((profile) => profile.user_id === 'visible-user'))
      .toMatchObject({ search_visibility: 'everyone' });

    const nameOptInRes = await request(app)
      .patch('/api/privacy/settings')
      .set('x-test-user-id', 'visible-user')
      .send({ findable_by_name: true });

    expect(nameOptInRes.status).toBe(200);
    expect(nameOptInRes.body.settings.findable_by_name).toBe(true);
    expect(getTable('LocalProfile').find((profile) => profile.user_id === 'visible-user'))
      .toMatchObject({ search_visibility: 'everyone' });

    const visibleSearch = await request(app)
      .get('/api/users/search')
      .query({ q: 'river', type: 'people' })
      .set('x-test-user-id', 'viewer-user');

    expect(visibleSearch.status).toBe(200);
    expect(visibleSearch.body.users.map((user) => user.id)).toEqual(['visible-user']);
  });

  test('matches real names only after explicit name discoverability opt-in', async () => {
    const app = createApp();

    const hiddenByDefault = await request(app)
      .get('/api/users/search')
      .query({ q: 'Alexandra Stone', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(hiddenByDefault.status).toBe(200);
    expect(hiddenByDefault.body.users).toEqual([]);

    seedTable('UserPrivacySettings', [{
      id: 'privacy-name-opt-in',
      user_id: 'name-opt-in-user',
      search_visibility: 'everyone',
      findable_by_name: true,
    }]);

    const foundByName = await request(app)
      .get('/api/users/search')
      .query({ q: 'Alexandra Stone', type: 'people' })
      .set('x-test-user-id', 'viewer-user');

    expect(foundByName.status).toBe(200);
    expect(foundByName.body.users.map((user) => user.id)).toEqual(['name-opt-in-user']);
    expect(foundByName.body.users[0]).toMatchObject({
      username: 'garden-helper',
      name: 'Garden Helper',
      type: 'local_profile',
    });
    expect(JSON.stringify(foundByName.body)).not.toContain('Alexandra');
    expect(JSON.stringify(foundByName.body)).not.toContain('Stone');
    expect(JSON.stringify(foundByName.body)).not.toContain('alexandra.stone@example.com');

    seedTable('UserPrivacySettings', [{
      id: 'privacy-name-opt-in-hidden',
      user_id: 'name-opt-in-user',
      search_visibility: 'nobody',
      findable_by_name: true,
    }]);

    const hiddenBySearchPrivacy = await request(app)
      .get('/api/users/search')
      .query({ q: 'Alexandra Stone', type: 'people' })
      .set('x-test-user-id', 'viewer-user');
    expect(hiddenBySearchPrivacy.status).toBe(200);
    expect(hiddenBySearchPrivacy.body.users).toEqual([]);
  });
});

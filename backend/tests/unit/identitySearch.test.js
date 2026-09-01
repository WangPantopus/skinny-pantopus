const express = require('express');
const request = require('supertest');
const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../middleware/verifyToken', () => (req, res, next) => {
  const userId = req.headers['x-test-user-id'];
  if (!userId) return res.status(401).json({ error: 'No token provided' });
  req.user = { id: userId, role: 'user' };
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
  app.use('/api/identity', require('../../routes/identitySearch'));
  return app;
}

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VIEWER_ID = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID = '33333333-3333-4333-8333-333333333333';

function seedSupportTables() {
  seedTable('IdentityBridgeSetting', []);
  seedTable('PersonaFollow', []);
  seedTable('Relationship', []);
  seedTable('UserPrivacySettings', []);
  seedTable('UserProfileBlock', []);
}

function seedIdentityFixture({
  local = {},
  persona = {},
  bridge = {},
  privacy = null,
  blocks = [],
} = {}) {
  seedTable('User', [
    {
      id: OWNER_ID,
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
      id: VIEWER_ID,
      username: 'viewer-b',
      name: 'Viewer B',
      account_type: 'personal',
    },
  ]);
  seedTable('LocalProfile', [{
    id: 'local-a',
    user_id: OWNER_ID,
    handle: 'RiverHome',
    handle_normalized: 'riverhome',
    display_name: 'RiverHome',
    tagline: 'Verified neighbor',
    public_city: 'Oakland',
    public_state: 'CA',
    public_neighborhood: 'Temescal',
    verified_resident: true,
    search_visibility: 'everyone',
    profile_visibility: 'public',
    ...local,
  }]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID,
    user_id: OWNER_ID,
    handle: 'MayaBuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    avatar_url: 'https://cdn.example.com/persona.jpg',
    bio: 'Studio updates',
    category: 'creator',
    audience_label: 'followers',
    audience_mode: 'open',
    follower_count: 42,
    post_count: 3,
    status: 'active',
    is_searchable: true,
    ...persona,
  }]);
  if (bridge.show_persona_on_local || bridge.show_local_on_persona) {
    seedTable('IdentityBridgeSetting', [{
      id: 'bridge-a',
      user_id: OWNER_ID,
      persona_id: PERSONA_ID,
      show_persona_on_local: !!bridge.show_persona_on_local,
      show_local_on_persona: !!bridge.show_local_on_persona,
    }]);
  }
  if (privacy) {
    seedTable('UserPrivacySettings', [{
      id: 'privacy-a',
      user_id: OWNER_ID,
      ...privacy,
    }]);
  }
  seedTable('UserProfileBlock', blocks);
}

function expectNoPrivateUserPayload(value) {
  const json = JSON.stringify(value);
  expect(json).not.toContain('maya.private@example.com');
  expect(json).not.toContain('Maya Legal Secret');
  expect(json).not.toContain('maya-private');
  expect(json).not.toContain('Private City');
  expect(json).not.toContain('"email"');
  expect(json).not.toContain('"last_name"');
}

describe('Identity Firewall profile search', () => {
  let app;

  beforeEach(() => {
    delete process.env.IDENTITY_FIREWALL_ENABLED;
    delete process.env.PERSONA_ENABLED;
    resetTables();
    jest.clearAllMocks();
    seedSupportTables();
    app = createApp();
  });

  afterEach(() => {
    delete process.env.IDENTITY_FIREWALL_ENABLED;
    delete process.env.PERSONA_ENABLED;
  });

  test('searches Beacons without matching or leaking raw User fields', async () => {
    seedIdentityFixture();

    const rawEmail = await request(app)
      .get('/api/identity/search')
      .query({ q: 'maya.private@example.com', scope: 'all' })
      .set('x-test-user-id', VIEWER_ID);
    expect(rawEmail.status).toBe(200);
    expect(rawEmail.body.results).toEqual([]);

    const rawLegalName = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Maya Legal Secret', scope: 'all' })
      .set('x-test-user-id', VIEWER_ID);
    expect(rawLegalName.status).toBe(200);
    expect(rawLegalName.body.results).toEqual([]);

    const res = await request(app)
      .get('/api/identity/search')
      .query({ q: 'MayaBuilds', scope: 'public_profiles' })
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      id: PERSONA_ID,
      type: 'public_profile',
      title: 'Maya Builds',
      subtitle: '@MayaBuilds',
      href: '/@MayaBuilds',
      meta: '42 followers',
    });
    expect(res.body.results[0].linkedProfile).toBeNull();
    expectNoPrivateUserPayload(res.body);
  });

  test('searches Local Profiles as a separate identity surface', async () => {
    seedIdentityFixture();

    const res = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      id: 'local-a',
      type: 'local_profile',
      title: 'RiverHome',
      subtitle: '/RiverHome',
      meta: 'Oakland, CA',
      href: '/RiverHome',
      badges: ['verified_resident'],
    });
    expect(res.body.results[0].linkedProfile).toBeNull();
    expectNoPrivateUserPayload(res.body);
  });

  test('matches Local Profiles by real name only after explicit opt-in', async () => {
    seedIdentityFixture();

    const hiddenByDefault = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Maya Secret', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(hiddenByDefault.status).toBe(200);
    expect(hiddenByDefault.body.results).toEqual([]);

    seedTable('UserPrivacySettings', [{
      id: 'privacy-name-opt-in',
      user_id: OWNER_ID,
      search_visibility: 'everyone',
      findable_by_name: true,
    }]);

    const foundByName = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Maya Secret', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);

    expect(foundByName.status).toBe(200);
    expect(foundByName.body.results).toHaveLength(1);
    expect(foundByName.body.results[0]).toMatchObject({
      id: 'local-a',
      type: 'local_profile',
      title: 'RiverHome',
      href: '/RiverHome',
    });
    expectNoPrivateUserPayload(foundByName.body);
  });

  test('does not match hidden Local Profile locality fields', async () => {
    seedIdentityFixture({
      local: {
        show_neighborhood: false,
      },
    });

    const hiddenCity = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Oakland', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(hiddenCity.status).toBe(200);
    expect(hiddenCity.body.results).toEqual([]);

    const hiddenNeighborhood = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Temescal', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(hiddenNeighborhood.status).toBe(200);
    expect(hiddenNeighborhood.body.results).toEqual([]);

    const handleStillWorks = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(handleStillWorks.status).toBe(200);
    expect(handleStillWorks.body.results).toHaveLength(1);
    expect(handleStillWorks.body.results[0]).toMatchObject({
      type: 'local_profile',
      meta: null,
    });
  });

  test('adds cross-profile links only when bridge settings opt in', async () => {
    seedIdentityFixture({
      bridge: {
        show_persona_on_local: true,
        show_local_on_persona: true,
      },
    });

    const localRes = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(localRes.status).toBe(200);
    expect(localRes.body.results[0].linkedProfile).toEqual({
      type: 'public_profile',
      title: 'Maya Builds',
      href: '/@MayaBuilds',
    });

    const publicRes = await request(app)
      .get('/api/identity/search')
      .query({ q: 'MayaBuilds', scope: 'public_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.results[0].linkedProfile).toEqual({
      type: 'local_profile',
      title: 'RiverHome',
      href: '/RiverHome',
    });
    expectNoPrivateUserPayload(publicRes.body);
  });

  test('respects Local Profile and account-level search privacy separately from Beacon search', async () => {
    seedIdentityFixture({
      local: { search_visibility: 'nobody' },
    });

    const hiddenLocal = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(hiddenLocal.status).toBe(200);
    expect(hiddenLocal.body.results).toEqual([]);

    getTable('LocalProfile')[0].search_visibility = 'everyone';
    seedTable('UserPrivacySettings', [{
      id: 'privacy-a',
      user_id: OWNER_ID,
      search_visibility: 'nobody',
    }]);

    const accountHiddenLocal = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(accountHiddenLocal.status).toBe(200);
    expect(accountHiddenLocal.body.results).toEqual([]);

    const publicStillSearchable = await request(app)
      .get('/api/identity/search')
      .query({ q: 'MayaBuilds', scope: 'public_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(publicStillSearchable.status).toBe(200);
    expect(publicStillSearchable.body.results).toHaveLength(1);
    expect(publicStillSearchable.body.results[0].type).toBe('public_profile');
  });

  test('respects Beacon searchability and search-only blocks', async () => {
    seedIdentityFixture({
      persona: { is_searchable: false },
    });

    const hiddenPersona = await request(app)
      .get('/api/identity/search')
      .query({ q: 'MayaBuilds', scope: 'public_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(hiddenPersona.status).toBe(200);
    expect(hiddenPersona.body.results).toEqual([]);

    seedIdentityFixture({
      blocks: [{
        id: 'block-a',
        user_id: OWNER_ID,
        blocked_user_id: VIEWER_ID,
        block_scope: 'search_only',
      }],
    });

    const blocked = await request(app)
      .get('/api/identity/search')
      .query({ q: 'Maya', scope: 'all' })
      .set('x-test-user-id', VIEWER_ID);
    expect(blocked.status).toBe(200);
    expect(blocked.body.results).toEqual([]);
  });

  test('does not expose Beacons when the Persona feature is disabled', async () => {
    process.env.PERSONA_ENABLED = 'false';
    seedSupportTables();
    seedIdentityFixture({
      bridge: {
        show_persona_on_local: true,
      },
    });

    const publicRes = await request(app)
      .get('/api/identity/search')
      .query({ q: 'MayaBuilds', scope: 'public_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.results).toEqual([]);

    const localRes = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(localRes.status).toBe(200);
    expect(localRes.body.results).toHaveLength(1);
    expect(localRes.body.results[0].linkedProfile).toBeNull();
  });

  test('requires the Identity Firewall feature flag', async () => {
    process.env.IDENTITY_FIREWALL_ENABLED = 'false';
    seedSupportTables();
    seedIdentityFixture();

    const res = await request(app)
      .get('/api/identity/search')
      .query({ q: 'RiverHome', scope: 'local_profiles' })
      .set('x-test-user-id', VIEWER_ID);
    expect(res.status).toBe(404);
  });

  test('validates short queries and unsupported scopes', async () => {
    seedIdentityFixture();

    const shortQuery = await request(app)
      .get('/api/identity/search')
      .query({ q: 'm', scope: 'all' })
      .set('x-test-user-id', VIEWER_ID);
    expect(shortQuery.status).toBe(400);

    const badScope = await request(app)
      .get('/api/identity/search')
      .query({ q: 'maya', scope: 'people' })
      .set('x-test-user-id', VIEWER_ID);
    expect(badScope.status).toBe(400);
  });
});

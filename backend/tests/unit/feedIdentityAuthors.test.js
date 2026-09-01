const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../services/s3Service', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://example.com/signed'),
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

const { attachIdentityAuthors } = require('../../services/feedService');

describe('feed identity authors', () => {
  beforeEach(() => {
    resetTables();
  });

  test('persona posts render as the Audience Profile instead of the private User join', async () => {
    seedTable('PublicPersona', [{
      id: 'persona-1',
      user_id: 'private-user-1',
      handle: 'MayaBuilds',
      display_name: 'Maya Builds',
      avatar_url: 'https://cdn.example.com/persona.jpg',
      category: 'creator',
      audience_label: 'followers',
      audience_mode: 'open',
      follower_count: 12,
      post_count: 3,
      status: 'active',
    }]);
    seedTable('LocalProfile', [{
      id: 'local-1',
      user_id: 'private-user-1',
      handle: 'RiverHome',
      display_name: 'RiverHome',
      city: 'Private City',
      state: 'CA',
    }]);

    const [post] = await attachIdentityAuthors([{
      id: 'post-1',
      user_id: 'private-user-1',
      author_user_id: 'private-user-1',
      post_as: 'persona',
      identity_context_type: 'persona',
      identity_context_id: 'persona-1',
      creator: {
        id: 'private-user-1',
        username: 'real-maya',
        name: 'Maya Private',
        first_name: 'Maya',
        last_name: 'Private',
        city: 'Private City',
        state: 'CA',
        profile_picture_url: 'https://cdn.example.com/private.jpg',
      },
    }], 'viewer-1');

    expect(post.author).toMatchObject({
      type: 'persona',
      id: 'persona-1',
      handle: 'MayaBuilds',
      displayName: 'Maya Builds',
      href: '/@MayaBuilds',
    });
    // P0.4 follow-up: post.creator now mirrors post.author rather than the
    // raw User row — for persona posts the creator slot carries the
    // PERSONA's identity (not the underlying User UUID / username). This
    // matches the privacy intent of the retired legacyCreatorFromAuthor.
    expect(post.creator).toMatchObject({
      type: 'persona',
      id: 'persona-1',
      handle: 'MayaBuilds',
      displayName: 'Maya Builds',
    });
    expect(post.creator).not.toHaveProperty('username');
    expect(post.creator).not.toHaveProperty('name');
    expect(post.creator).not.toHaveProperty('first_name');
    expect(post.creator).not.toHaveProperty('city');
    expect(post.user_id).toBe('persona-1');
    expect(post.author_user_id).toBeNull();
    expect(JSON.stringify(post)).not.toContain('private-user-1');
    expect(JSON.stringify(post)).not.toContain('Maya Private');
  });

  test('local posts render readable names while keeping LocalProfile handles', async () => {
    seedTable('PublicPersona', []);
    seedTable('LocalProfile', [{
      id: 'local-1',
      user_id: 'user-1',
      handle: 'RiverHome',
      display_name: 'RiverHome',
      avatar_url: 'https://cdn.example.com/local.jpg',
      city: 'Oakland',
      state: 'CA',
      verification_badges: ['verified_resident'],
    }]);
    seedTable('User', [{
      id: 'user-1',
      username: 'legacy-user',
      name: 'Local Person',
      profile_picture_url: null,
    }]);

    const [post] = await attachIdentityAuthors([{
      id: 'post-2',
      user_id: 'user-1',
      author_user_id: 'user-1',
      post_as: 'personal',
      identity_context_type: 'local',
      identity_context_id: 'local-1',
      creator: { id: 'user-1', username: 'legacy-user', name: 'Legacy User' },
    }], 'viewer-1');

    expect(post.author).toMatchObject({
      type: 'local',
      id: 'local-1',
      handle: 'RiverHome',
      displayName: 'Local Person',
      href: '/RiverHome',
    });
    // P0.4 follow-up: post.creator now mirrors post.author — for local
    // posts the creator slot carries the LocalProfile's identity (not the
    // underlying User row's username / id).
    expect(post.creator).toMatchObject({
      type: 'local',
      id: 'local-1',
      handle: 'RiverHome',
      displayName: 'Local Person',
    });
    expect(post.creator).not.toHaveProperty('username');
    expect(post.creator).not.toHaveProperty('name');
    expect(post.creator).not.toHaveProperty('profile_picture_url');
  });

  test('local fallback author uses the readable User name when LocalProfile is missing', async () => {
    seedTable('PublicPersona', []);
    seedTable('LocalProfile', []);

    const [post] = await attachIdentityAuthors([{
      id: 'post-3',
      user_id: 'private-user-1',
      author_user_id: 'private-user-1',
      post_as: 'personal',
      identity_context_type: 'local',
      creator: {
        id: 'private-user-1',
        username: 'safe-handle',
        name: 'Sam Rivera',
        first_name: 'Sam',
        last_name: 'Rivera',
        profile_picture_url: 'https://cdn.example.com/private.jpg',
      },
    }], 'viewer-1');

    expect(post.author).toMatchObject({
      type: 'local',
      handle: 'safe-handle',
      displayName: 'Sam Rivera',
    });
    // P0.4 audit follow-up: post.creator is no longer the fabricated legacy
    // {username, name, first_name, profile_picture_url} shape from the now-
    // retired legacyCreatorFromAuthor. attachIdentityAuthors projects any raw
    // post.creator through serializeUserAsLocalIdentity so the leaky raw row
    // never surfaces to the wire.
    expect(post.creator).toMatchObject({
      type: 'local',
      handle: 'safe-handle',
      displayName: 'Sam Rivera',
    });
    // Legacy keys that used to live on post.creator are gone.
    expect(post.creator).not.toHaveProperty('username');
    expect(post.creator).not.toHaveProperty('name');
    expect(post.creator).not.toHaveProperty('first_name');
    expect(post.creator).not.toHaveProperty('profile_picture_url');
    expect(JSON.stringify(post)).not.toContain('"name"');
    expect(JSON.stringify(post)).not.toContain('"first_name"');
  });
});

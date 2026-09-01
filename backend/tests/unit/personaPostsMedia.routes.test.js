/**
 * GET /api/personas/:handle/posts — media normalization.
 *
 * The Beacon posts endpoint queries Post directly instead of going
 * through feedService.getListFeed, so it has to re-run the same media
 * normalization by hand. Before that was wired up, a Beacon post whose
 * media columns held relative S3 keys was returned verbatim — the
 * clients got "posts/abc.jpg" instead of a URL and rendered nothing —
 * and a legacy row with NULL media_thumbnails / media_live_urls was
 * returned as null instead of [], which the parallel-array readers on
 * both apps index into.
 *
 * What this pins:
 *   1. Relative S3 keys resolve to public URLs in all three URL columns.
 *   2. NULL columns become [] (the unify-broadcasts backfill copied only
 *      media_urls + media_types, so every pre-unification broadcast row
 *      still has NULL media_thumbnails / media_live_urls).
 *   3. The ""-padding in media_thumbnails / media_live_urls survives, so
 *      slot i keeps describing attachment i. Filtering the blanks — the
 *      way normalizeMediaUrls does for media_urls — would shift a Live
 *      Photo's clip onto the wrong still.
 *
 * Follows the route-test pattern in personasMeFollowing.routes.test.js:
 * in-memory supabaseAdmin mock, optionalAuth stubbed to read
 * x-test-user-id, audience_profile flag seeded on.
 */

const express = require('express');
const request = require('supertest');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: req.headers['x-test-role'] || 'user' };
  }
  next();
});

// normalizeMediaUrls / normalizeAlignedMediaUrls resolve stored keys via
// s3Service.getPublicUrl. Stub it so the assertions do not depend on the
// CloudFront / bucket env of whoever runs the suite.
jest.mock('../../services/s3Service', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://cdn.example.com/signed'),
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

const featureFlagService = require('../../services/featureFlagService');
const personasRouter = require('../../routes/personas');

const FLAG_NAME = 'audience_profile';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const FOLLOWER_ID = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID = '33333333-3333-4333-8333-333333333333';

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
    description: 'Beacon',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedPersona() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner_handle' },
    { id: FOLLOWER_ID, role: 'user', username: 'follower_handle' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID,
    user_id: OWNER_ID,
    handle: 'mayabuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    audience_mode: 'open',
    status: 'active',
    audience_label: 'followers',
    follower_count: 0,
    post_count: 0,
  }]);
  seedTable('PersonaMembership', []);
}

function makePost(id, media, overrides = {}) {
  return {
    id,
    user_id: OWNER_ID,
    author_user_id: OWNER_ID,
    identity_context_type: 'persona',
    identity_context_id: PERSONA_ID,
    content: `Beacon post ${id}`,
    post_type: 'personal_update',
    post_format: 'standard',
    post_as: 'persona',
    visibility: 'public',
    audience: 'public',
    distribution_targets: ['public', 'persona_followers'],
    target_tier_rank: null,
    archived_at: null,
    created_at: '2026-05-04T12:00:00Z',
    updated_at: '2026-05-04T12:00:00Z',
    ...media,
    ...overrides,
  };
}

async function fetchPost(postId, viewerId = null) {
  const req = request(buildApp()).get('/api/personas/mayabuilds/posts');
  const res = await (viewerId ? asUser(req, viewerId) : req);
  expect(res.status).toBe(200);
  return res.body.posts.find((post) => post.id === postId);
}

beforeEach(() => {
  resetTables();
  seedFlagOn();
  seedPersona();
});

afterEach(() => featureFlagService.invalidateFlagCache());

describe('GET /api/personas/:handle/posts — media normalization', () => {
  test('relative S3 keys resolve to public URLs in all three URL columns', async () => {
    seedTable('Post', [makePost('post-relative-keys', {
      media_urls: ['posts/still.jpg', 'posts/live-key.heic'],
      media_types: ['image', 'live_photo'],
      media_thumbnails: ['', 'posts/live-thumb.jpg'],
      media_live_urls: ['', 'posts/live-clip.mov'],
    })]);

    const post = await fetchPost('post-relative-keys');

    expect(post.media_urls).toEqual([
      'https://cdn.example.com/posts/still.jpg',
      'https://cdn.example.com/posts/live-key.heic',
    ]);
    expect(post.media_thumbnails).toEqual([
      '',
      'https://cdn.example.com/posts/live-thumb.jpg',
    ]);
    expect(post.media_live_urls).toEqual([
      '',
      'https://cdn.example.com/posts/live-clip.mov',
    ]);
    expect(post.media_types).toEqual(['image', 'live_photo']);
  });

  test('a leading slash on a stored key does not produce a doubled path', async () => {
    seedTable('Post', [makePost('post-leading-slash', {
      media_urls: ['/posts/still.jpg'],
      media_types: ['image'],
      media_thumbnails: ['/posts/thumb.jpg'],
      media_live_urls: [''],
    })]);

    const post = await fetchPost('post-leading-slash');

    expect(post.media_urls).toEqual(['https://cdn.example.com/posts/still.jpg']);
    expect(post.media_thumbnails).toEqual(['https://cdn.example.com/posts/thumb.jpg']);
  });

  test('absolute URLs are returned untouched', async () => {
    seedTable('Post', [makePost('post-absolute-urls', {
      media_urls: ['https://other-cdn.example.net/still.jpg'],
      media_types: ['live_photo'],
      media_thumbnails: ['https://other-cdn.example.net/thumb.jpg'],
      media_live_urls: ['https://other-cdn.example.net/clip.mov'],
    })]);

    const post = await fetchPost('post-absolute-urls');

    expect(post.media_urls).toEqual(['https://other-cdn.example.net/still.jpg']);
    expect(post.media_thumbnails).toEqual(['https://other-cdn.example.net/thumb.jpg']);
    expect(post.media_live_urls).toEqual(['https://other-cdn.example.net/clip.mov']);
  });

  test('NULL media columns come back as [], never null or undefined', async () => {
    // Shape of a pre-unification broadcast row: the backfill copied
    // media_urls + media_types only.
    seedTable('Post', [makePost('post-legacy-nulls', {
      media_urls: ['posts/legacy.jpg'],
      media_types: ['image'],
      media_thumbnails: null,
      media_live_urls: null,
    })]);

    const post = await fetchPost('post-legacy-nulls');

    expect(post.media_thumbnails).toEqual([]);
    expect(post.media_live_urls).toEqual([]);
    expect(post.media_urls).toEqual(['https://cdn.example.com/posts/legacy.jpg']);
  });

  test('a text-only post with every media column NULL returns four empty arrays', async () => {
    seedTable('Post', [makePost('post-no-media', {
      media_urls: null,
      media_types: null,
      media_thumbnails: null,
      media_live_urls: null,
    })]);

    const post = await fetchPost('post-no-media');

    expect(post.media_urls).toEqual([]);
    expect(post.media_types).toEqual([]);
    expect(post.media_thumbnails).toEqual([]);
    expect(post.media_live_urls).toEqual([]);
  });

  test('""-padding is preserved so a Live Photo clip stays on its own still', async () => {
    // Three attachments; only the MIDDLE one is a Live Photo. If the
    // blank slots were filtered out (the way media_urls are), the clip
    // would land at index 0 and the plain still would start playing.
    seedTable('Post', [makePost('post-padding', {
      media_urls: ['posts/a.jpg', 'posts/b-live-key.heic', 'posts/c.jpg'],
      media_types: ['image', 'live_photo', 'image'],
      media_thumbnails: ['', 'posts/b-thumb.jpg', ''],
      media_live_urls: ['', 'posts/b-clip.mov', ''],
    })]);

    const post = await fetchPost('post-padding');

    expect(post.media_live_urls).toEqual([
      '', 'https://cdn.example.com/posts/b-clip.mov', '',
    ]);
    expect(post.media_thumbnails).toEqual([
      '', 'https://cdn.example.com/posts/b-thumb.jpg', '',
    ]);
    // All four arrays stay the same length — that is the whole contract.
    expect(post.media_urls).toHaveLength(3);
    expect(post.media_types).toHaveLength(3);
    expect(post.media_thumbnails).toHaveLength(3);
    expect(post.media_live_urls).toHaveLength(3);

    const liveIndex = post.media_types.indexOf('live_photo');
    expect(liveIndex).toBe(1);
    expect(post.media_live_urls[liveIndex]).toBe('https://cdn.example.com/posts/b-clip.mov');
    expect(post.media_live_urls[0]).toBe('');
    expect(post.media_live_urls[2]).toBe('');
  });

  test('a trailing empty slot is kept rather than trimmed off the end', async () => {
    // Array.prototype.filter would silently shorten this to length 1,
    // leaving the second attachment with no slot to read at all.
    seedTable('Post', [makePost('post-trailing-blank', {
      media_urls: ['posts/live-key.heic', 'posts/plain.jpg'],
      media_types: ['live_photo', 'image'],
      media_thumbnails: ['posts/live-thumb.jpg', ''],
      media_live_urls: ['posts/live-clip.mov', ''],
    })]);

    const post = await fetchPost('post-trailing-blank');

    expect(post.media_live_urls).toEqual([
      'https://cdn.example.com/posts/live-clip.mov', '',
    ]);
    expect(post.media_live_urls).toHaveLength(post.media_urls.length);
  });

  test('normalization also applies to a follower-gated post read by a follower', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-follower',
      persona_id: PERSONA_ID,
      user_id: FOLLOWER_ID,
      tier_id: 'tier-1',
      fan_handle: 'fan_a',
      fan_handle_normalized: 'fan_a',
      status: 'active',
      notification_level: 'all',
      tier: { rank: 1, name: 'Follower', price_cents: 0 },
    }]);
    seedTable('Post', [makePost('post-followers-live', {
      media_urls: ['posts/gated-live-key.heic'],
      media_types: ['live_photo'],
      media_thumbnails: ['posts/gated-thumb.jpg'],
      media_live_urls: ['posts/gated-clip.mov'],
    }, {
      visibility: 'followers',
      audience: 'followers',
      distribution_targets: ['persona_followers'],
    })]);

    const anonymous = await fetchPost('post-followers-live');
    expect(anonymous).toBeUndefined();

    const post = await fetchPost('post-followers-live', FOLLOWER_ID);
    expect(post).toBeDefined();
    expect(post.media_live_urls).toEqual(['https://cdn.example.com/posts/gated-clip.mov']);
    expect(post.media_thumbnails).toEqual(['https://cdn.example.com/posts/gated-thumb.jpg']);
  });
});

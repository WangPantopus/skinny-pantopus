// ============================================================
// TEST: Feed Radius Filtering
//
// Tests that feedService.getListFeed correctly applies radius
// filtering on the Place surface.
// ============================================================

const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Mock s3Service ───────────────────────────────────────────
jest.mock('../../services/s3Service', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://example.com/signed'),
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

// ── Mock feedRanking ─────────────────────────────────────────
jest.mock('../../utils/feedRanking', () => ({
  computeUtilityScore: jest.fn().mockReturnValue(1),
}));

const feedService = require('../../services/feedService');

const USER_1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const USER_2 = 'bbbbbbbb-bbbb-2bbb-8bbb-bbbbbbbbbbbb';

// Portland center
const CENTER_LAT = 45.5152;
const CENTER_LON = -122.6784;

function makePost(overrides) {
  const id = overrides.id || `post-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    user_id: USER_2,
    content: 'Test post',
    post_type: 'general',
    audience: 'nearby',
    distribution_targets: ['place'],
    effective_latitude: CENTER_LAT,
    effective_longitude: CENTER_LON,
    created_at: new Date().toISOString(),
    archived_at: null,
    ...overrides,
  };
}

describe('Feed Radius Filtering', () => {
  beforeEach(() => {
    resetTables();
    seedTable('UserMute', []);
    seedTable('PostHide', []);
    seedTable('PostMute', []);
    seedTable('UserBlock', []);
    seedTable('FeedPreference', []);
    seedTable('Follow', []);
    seedTable('Connection', []);
    if (feedService.invalidateFilterCache) {
      feedService.invalidateFilterCache(USER_1);
    }
  });

  it('should include posts within the specified radius', async () => {
    // Post at center — well within any radius
    seedTable('Post', [makePost({ id: 'close-post' })]);

    const result = await feedService.getListFeed({
      userId: USER_1,
      surface: 'place',
      latitude: CENTER_LAT,
      longitude: CENTER_LON,
      radiusMeters: Math.round(3 * 1609.34),
      limit: 20,
    });

    expect(result.posts.some(p => p.id === 'close-post')).toBe(true);
  });

  it('should exclude posts outside the specified radius', async () => {
    // Post ~50 miles away from center
    seedTable('Post', [
      makePost({ id: 'far-post', effective_latitude: 46.2, effective_longitude: -122.6784 }),
    ]);

    const result = await feedService.getListFeed({
      userId: USER_1,
      surface: 'place',
      latitude: CENTER_LAT,
      longitude: CENTER_LON,
      radiusMeters: Math.round(3 * 1609.34),
      limit: 20,
    });

    expect(result.posts.some(p => p.id === 'far-post')).toBe(false);
  });

  it('should filter home-based posts using effective coordinates when raw coords are null', async () => {
    // Post ~50 miles away, raw coords null, effective coords set (home-based post)
    seedTable('Post', [
      makePost({
        id: 'home-far-post',
        latitude: null,
        longitude: null,
        effective_latitude: 46.2,
        effective_longitude: CENTER_LON,
      }),
    ]);

    const result = await feedService.getListFeed({
      userId: USER_1,
      surface: 'place',
      latitude: CENTER_LAT,
      longitude: CENTER_LON,
      radiusMeters: Math.round(3 * 1609.34),
      limit: 20,
    });

    expect(result.posts.some(p => p.id === 'home-far-post')).toBe(false);
  });

  it('should include home-based posts within radius using effective coordinates', async () => {
    // Post at center, raw coords null, effective coords at center (home-based post)
    seedTable('Post', [
      makePost({
        id: 'home-close-post',
        latitude: null,
        longitude: null,
        effective_latitude: CENTER_LAT,
        effective_longitude: CENTER_LON,
      }),
    ]);

    const result = await feedService.getListFeed({
      userId: USER_1,
      surface: 'place',
      latitude: CENTER_LAT,
      longitude: CENTER_LON,
      radiusMeters: Math.round(3 * 1609.34),
      limit: 20,
    });

    expect(result.posts.some(p => p.id === 'home-close-post')).toBe(true);
  });

  it('should use a reasonable default radius when not specified', async () => {
    // Post ~8 miles from center — should be within default 10-mile radius
    seedTable('Post', [
      makePost({ id: 'mid-post', effective_latitude: CENTER_LAT + 0.1, effective_longitude: CENTER_LON }),
    ]);

    const result = await feedService.getListFeed({
      userId: USER_1,
      surface: 'place',
      latitude: CENTER_LAT,
      longitude: CENTER_LON,
      limit: 20,
    });

    expect(result.posts.some(p => p.id === 'mid-post')).toBe(true);
  });
});

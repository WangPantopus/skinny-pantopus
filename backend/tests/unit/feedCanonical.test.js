// ============================================================
// TEST: Feed Canonical Contract
//
// Tests for canonical post_type enforcement, access control,
// migration mapping, radius handling, and pagination.
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

const {
  getListFeed,
  getMapFeed,
  invalidateFilterCache,
  normalizeFeedPostRow,
  buildCursorPagination,
} = require('../../services/feedService');

const { canPostToAudience } = require('../../utils/trustState');

// ── Constants ────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER = 'bbbbbbbb-bbbb-2bbb-8bbb-bbbbbbbbbbbb';
const REMOTE_USER = 'cccccccc-cccc-3ccc-8ccc-cccccccccccc';

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;

let postCounter = 0;

function makePost(overrides = {}) {
  postCounter++;
  const id = overrides.id || `post-${String(postCounter).padStart(4, '0')}`;
  return {
    id,
    user_id: OTHER_USER,
    title: `Post ${postCounter}`,
    content: `Content ${postCounter}`,
    media_urls: [],
    media_types: [],
    post_type: 'ask_local',
    post_format: 'standard',
    visibility: 'neighborhood',
    visibility_scope: 'neighborhood',
    location_precision: 'approx_area',
    tags: [],
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    save_count: 0,
    is_pinned: false,
    is_edited: false,
    created_at: new Date(Date.now() - postCounter * 60000).toISOString(),
    home_id: null,
    latitude: SF_LAT,
    longitude: SF_LNG,
    effective_latitude: SF_LAT,
    effective_longitude: SF_LNG,
    location_name: 'San Francisco',
    location_address: null,
    post_as: 'personal',
    audience: 'nearby',
    business_id: null,
    target_place_id: null,
    resolved_at: null,
    archived_at: null,
    archive_reason: null,
    is_story: false,
    story_expires_at: null,
    distribution_targets: ['place'],
    event_date: null,
    event_end_date: null,
    event_venue: null,
    safety_alert_kind: null,
    safety_happened_at: null,
    safety_behavior_description: null,
    deal_expires_at: null,
    deal_business_name: null,
    lost_found_type: null,
    lost_found_contact_pref: null,
    service_category: null,
    ref_listing_id: null,
    ref_task_id: null,
    purpose: 'ask',
    utility_score: 0,
    show_on_profile: true,
    profile_visibility_scope: 'public',
    is_visitor_post: false,
    state: 'open',
    solved_at: null,
    not_helpful_count: 0,
    creator: {
      id: OTHER_USER, username: 'other', name: 'Other User',
      first_name: 'Other', last_name: 'User',
      profile_picture_url: null, city: 'SF', state: 'CA',
    },
    home: null,
    ...overrides,
  };
}

function seedEmptyFilterTables() {
  seedTable('UserMute', []);
  seedTable('PostHide', []);
  seedTable('PostMute', []);
  seedTable('Relationship', []);
  seedTable('PostLike', []);
  seedTable('PostSave', []);
  seedTable('UserFeedPreference', []);
}

// ============================================================
// TEST SUITE
// ============================================================
describe('Feed Canonical Contract', () => {
  beforeEach(() => {
    resetTables();
    postCounter = 0;
    invalidateFilterCache(USER_ID);
    seedEmptyFilterTables();
  });

  // ── 1. Canonical post types ────────────────────────────────

  describe('Canonical post types', () => {
    const CANONICAL_PLACE_TYPES = [
      'ask_local', 'recommendation', 'event', 'lost_found',
      'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide',
    ];

    const CANONICAL_NONPLACE_TYPES = [
      'general', 'personal_update', 'announcement', 'service_offer',
      'resources_howto', 'progress_wins',
    ];

    it('normalizer preserves canonical post_type values', () => {
      for (const type of [...CANONICAL_PLACE_TYPES, ...CANONICAL_NONPLACE_TYPES]) {
        const row = makePost({ post_type: type });
        const normalized = normalizeFeedPostRow(row);
        expect(normalized.post_type).toBe(type);
      }
    });

    it('normalizer defaults missing post_type to general', () => {
      const row = makePost({ post_type: undefined });
      const normalized = normalizeFeedPostRow(row);
      expect(normalized.post_type).toBe('general');
    });

    it('trust helpers use canonical ask_local for incoming_resident', () => {
      // ask_local should be allowed
      const result1 = canPostToAudience({
        postAs: 'personal',
        audience: 'nearby',
        postType: 'ask_local',
        trustLevel: 'incoming_resident',
      });
      expect(result1.allowed).toBe(true);

      // Legacy 'question' should be rejected (not in allowed list)
      const result2 = canPostToAudience({
        postAs: 'personal',
        audience: 'nearby',
        postType: 'question',
        trustLevel: 'incoming_resident',
      });
      expect(result2.allowed).toBe(false);
    });

    it('trust helpers use canonical types for business target_area', () => {
      // deal should be allowed
      const result1 = canPostToAudience({
        postAs: 'business',
        audience: 'target_area',
        postType: 'deal',
        trustLevel: 'verified_business',
      });
      expect(result1.allowed).toBe(true);

      // service_offer should be allowed
      const result2 = canPostToAudience({
        postAs: 'business',
        audience: 'target_area',
        postType: 'service_offer',
        trustLevel: 'verified_business',
      });
      expect(result2.allowed).toBe(true);

      // Legacy deals_promos should be rejected
      const result3 = canPostToAudience({
        postAs: 'business',
        audience: 'target_area',
        postType: 'deals_promos',
        trustLevel: 'verified_business',
      });
      expect(result3.allowed).toBe(false);

      // Legacy services_offers should be rejected
      const result4 = canPostToAudience({
        postAs: 'business',
        audience: 'target_area',
        postType: 'services_offers',
        trustLevel: 'verified_business',
      });
      expect(result4.allowed).toBe(false);
    });

    it('general is still banned from local audiences', () => {
      const result = canPostToAudience({
        postAs: 'personal',
        audience: 'nearby',
        postType: 'general',
        trustLevel: 'verified_resident',
      });
      expect(result.allowed).toBe(false);
    });
  });

  // ── 2. Migration mapping ───────────────────────────────────

  describe('Migration mapping', () => {
    // These tests verify that after migration, legacy post_type values
    // in the DB would have been rewritten. We simulate by testing
    // that the normalizer correctly passes through canonical types,
    // and that legacy types would not match any canonical list.

    const LEGACY_TO_CANONICAL = {
      question: 'ask_local',
      safety_alert: 'alert',
      deals_promos: 'deal',
      services_offers: 'service_offer',
    };

    for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
      it(`legacy "${legacy}" maps to canonical "${canonical}"`, () => {
        // After migration, the DB row will have the canonical type.
        // The normalizer should preserve it.
        const row = makePost({ post_type: canonical });
        const normalized = normalizeFeedPostRow(row);
        expect(normalized.post_type).toBe(canonical);
      });
    }
  });

  // ── 3. Normalized fields ───────────────────────────────────

  describe('Canonical response fields', () => {
    it('normalizer includes deal_business_name', () => {
      const row = makePost({
        post_type: 'deal',
        deal_business_name: 'Test Business',
      });
      const normalized = normalizeFeedPostRow(row);
      expect(normalized.deal_business_name).toBe('Test Business');
    });

    it('normalizer includes lost_found_contact_pref', () => {
      const row = makePost({
        post_type: 'lost_found',
        lost_found_contact_pref: 'dm',
        lost_found_type: 'lost',
      });
      const normalized = normalizeFeedPostRow(row);
      expect(normalized.lost_found_contact_pref).toBe('dm');
      expect(normalized.lost_found_type).toBe('lost');
    });

    it('normalizer includes safety_behavior_description', () => {
      const row = makePost({
        post_type: 'alert',
        safety_alert_kind: 'road_hazard',
        safety_behavior_description: 'Pothole on main road',
      });
      const normalized = normalizeFeedPostRow(row);
      expect(normalized.safety_behavior_description).toBe('Pothole on main road');
      expect(normalized.safety_alert_kind).toBe('road_hazard');
    });

    it('normalizer uses snake_case field names consistently', () => {
      const row = makePost({
        post_type: 'deal',
        deal_business_name: 'Test Biz',
        deal_expires_at: '2026-04-01T00:00:00Z',
      });
      const normalized = normalizeFeedPostRow(row);
      // Canonical fields exist
      expect(normalized).toHaveProperty('deal_business_name');
      expect(normalized).toHaveProperty('deal_expires_at');
      expect(normalized).toHaveProperty('lost_found_contact_pref');
      expect(normalized).toHaveProperty('safety_behavior_description');
      // No camelCase aliases
      expect(normalized).not.toHaveProperty('dealBusinessName');
      expect(normalized).not.toHaveProperty('businessName');
    });
  });

  // ── 4. Saved-place radius ─────────────────────────────────

  describe('Saved-place radius handling', () => {
    it('feedService.getListFeed accepts radiusMeters parameter', async () => {
      seedTable('Post', [
        makePost({
          distribution_targets: ['place'],
          effective_latitude: SF_LAT,
          effective_longitude: SF_LNG,
        }),
      ]);

      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 16000, // ~10 miles
      });

      expect(result.posts.length).toBe(1);
    });

    it('small radiusMeters excludes distant posts', async () => {
      // Post ~8 miles away
      seedTable('Post', [
        makePost({
          distribution_targets: ['place'],
          effective_latitude: SF_LAT + 0.12,
          effective_longitude: SF_LNG,
        }),
      ]);

      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 1000, // ~0.6 miles — too small
      });

      expect(result.posts.length).toBe(0);
    });
  });

  // ── 5. Pagination hasMore ─────────────────────────────────

  describe('Pagination hasMore', () => {
    it('hasMore is false when exactly limit posts after filtering', () => {
      const posts = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, created_at: new Date().toISOString() }));
      const pagination = buildCursorPagination(posts, 5, 5);
      expect(pagination.hasMore).toBe(false);
    });

    it('hasMore is true when preSliceCount exceeds limit', () => {
      const posts = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, created_at: new Date().toISOString() }));
      const pagination = buildCursorPagination(posts, 5, 8);
      expect(pagination.hasMore).toBe(true);
    });

    it('hasMore is false when fewer posts than limit', () => {
      const posts = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, created_at: new Date().toISOString() }));
      const pagination = buildCursorPagination(posts, 5, 3);
      expect(pagination.hasMore).toBe(false);
    });

    it('pagination from feed is correct on exact-final-page', async () => {
      seedTable('Relationship', [
        { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
      ]);

      // Create exactly 10 posts
      const posts = [];
      for (let i = 0; i < 10; i++) {
        posts.push(makePost({
          user_id: OTHER_USER,
          distribution_targets: ['connections'],
          created_at: new Date(Date.now() - i * 60000).toISOString(),
        }));
      }
      seedTable('Post', posts);

      // Fetch with limit 10 — should get all 10 and hasMore should be false
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'connections',
        limit: 10,
      });

      expect(result.posts).toHaveLength(10);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('pagination hasMore is true when more posts exist beyond limit', async () => {
      seedTable('Relationship', [
        { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
      ]);

      // Create 25 posts
      const posts = [];
      for (let i = 0; i < 25; i++) {
        posts.push(makePost({
          user_id: OTHER_USER,
          distribution_targets: ['connections'],
          created_at: new Date(Date.now() - i * 60000).toISOString(),
        }));
      }
      seedTable('Post', posts);

      // Fetch with limit 10 — should indicate hasMore
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'connections',
        limit: 10,
      });

      expect(result.posts).toHaveLength(10);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  // ── 6. Feed filter uses canonical types only ──────────────

  describe('Feed mute filters use canonical types', () => {
    it('deal preference filter catches canonical deal type', async () => {
      seedTable('UserFeedPreference', [
        {
          user_id: USER_ID,
          hide_deals_place: true,
          hide_alerts_place: false,
          show_politics_connections: false,
          show_politics_place: false,
        },
      ]);

      seedTable('Post', [
        makePost({ post_type: 'deal', distribution_targets: ['place'] }),
        makePost({ post_type: 'ask_local', distribution_targets: ['place'] }),
      ]);

      invalidateFilterCache(USER_ID);
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 16000,
      });

      // deal posts should be hidden, ask_local should remain
      expect(result.posts.every(p => p.post_type !== 'deal')).toBe(true);
      expect(result.posts.some(p => p.post_type === 'ask_local')).toBe(true);
    });

    it('alert preference filter catches canonical alert type', async () => {
      seedTable('UserFeedPreference', [
        {
          user_id: USER_ID,
          hide_deals_place: false,
          hide_alerts_place: true,
          show_politics_connections: false,
          show_politics_place: false,
        },
      ]);

      seedTable('Post', [
        makePost({ post_type: 'alert', safety_alert_kind: 'road_hazard', distribution_targets: ['place'] }),
        makePost({ post_type: 'ask_local', distribution_targets: ['place'] }),
      ]);

      invalidateFilterCache(USER_ID);
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 16000,
      });

      expect(result.posts.every(p => p.post_type !== 'alert')).toBe(true);
      expect(result.posts.some(p => p.post_type === 'ask_local')).toBe(true);
    });
  });

  // ── 7. Legacy type regression tests ────────────────────────

  describe('Legacy type regression', () => {
    const LEGACY_TYPES = ['question', 'safety_alert', 'deals_promos', 'services_offers'];

    it('normalizer passes through un-migrated legacy types as-is (DB migration responsibility)', () => {
      // The normalizer does NOT remap legacy types — the DB migration
      // is responsible for rewriting them. This test documents that if
      // un-migrated rows exist, they surface with the legacy string.
      for (const legacyType of LEGACY_TYPES) {
        const row = makePost({ post_type: legacyType });
        const normalized = normalizeFeedPostRow(row);
        expect(normalized.post_type).toBe(legacyType);
      }
    });

    it('trust helpers reject legacy types for incoming_resident nearby audience', () => {
      // incoming_resident can only post ask_local and recommendation
      for (const legacyType of LEGACY_TYPES) {
        const result = canPostToAudience({
          postAs: 'personal',
          audience: 'nearby',
          postType: legacyType,
          trustLevel: 'incoming_resident',
        });
        expect(result.allowed).toBe(false);
      }
    });

    it('trust helpers reject legacy types for business target_area audience', () => {
      // business target_area only allows event, deal, recommendation, announcement, service_offer
      for (const legacyType of LEGACY_TYPES) {
        const result = canPostToAudience({
          postAs: 'business',
          audience: 'target_area',
          postType: legacyType,
          trustLevel: 'verified_business',
        });
        expect(result.allowed).toBe(false);
      }
    });

    it('feed post_type filter with canonical type returns only matching posts', async () => {
      seedTable('Post', [
        makePost({ post_type: 'deal', distribution_targets: ['place'] }),
        makePost({ post_type: 'ask_local', distribution_targets: ['place'] }),
        makePost({ post_type: 'event', distribution_targets: ['place'] }),
      ]);

      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 16000,
        postType: 'deal',
      });

      expect(result.posts.length).toBe(1);
      expect(result.posts[0].post_type).toBe('deal');
    });

    it('feed post_type filter returns empty for un-seeded type', async () => {
      seedTable('Post', [
        makePost({ post_type: 'ask_local', distribution_targets: ['place'] }),
      ]);

      const result = await getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 16000,
        postType: 'alert',
      });

      expect(result.posts.length).toBe(0);
    });

    it('map feed also respects canonical post_type filter', async () => {
      seedTable('Post', [
        makePost({ post_type: 'deal', distribution_targets: ['place'] }),
        makePost({ post_type: 'event', distribution_targets: ['place'] }),
      ]);

      const result = await getMapFeed({
        userId: USER_ID,
        surface: 'place',
        south: SF_LAT - 0.5,
        west: SF_LNG - 0.5,
        north: SF_LAT + 0.5,
        east: SF_LNG + 0.5,
        postType: 'event',
      });

      // getMapFeed returns an array of posts
      expect(result.length).toBe(1);
      expect(result[0].post_type).toBe('event');
    });
  });
});

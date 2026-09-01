// ============================================================
// TEST: Feed Service — Comprehensive Regression Tests
//
// Unit tests for surface isolation, pagination correctness,
// mute filtering, and map/list agreement.
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

const { getListFeed, getMapFeed, invalidateFilterCache } = require('../../services/feedService');

// ── Helpers ──────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER = 'bbbbbbbb-bbbb-2bbb-8bbb-bbbbbbbbbbbb';
const UNCONNECTED_USER = 'cccccccc-cccc-3ccc-8ccc-cccccccccccc';
const PERSONA_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PERSONA_TIER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

// San Francisco center
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;

// ~5 miles away (within 10-mile radius)
const NEARBY_LAT = 37.8199;
const NEARBY_LNG = -122.4194;

// ~50 miles away (well outside 10-mile radius)
const DISTANT_LAT = 38.4;
const DISTANT_LNG = -122.4;

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
    post_type: 'general',
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
    deal_expires_at: null,
    deal_business_name: null,
    lost_found_type: null,
    lost_found_contact_pref: null,
    service_category: null,
    ref_listing_id: null,
    ref_task_id: null,
    purpose: null,
    utility_score: 0,
    show_on_profile: true,
    profile_visibility_scope: 'public',
    is_visitor_post: false,
    state: 'open',
    solved_at: null,
    not_helpful_count: 0,
    creator: { id: OTHER_USER, username: 'other', name: 'Other User', first_name: 'Other', last_name: 'User', profile_picture_url: null, city: 'SF', state: 'CA' },
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
describe('Feed Service', () => {
  beforeEach(() => {
    resetTables();
    postCounter = 0;
    invalidateFilterCache(USER_ID);
    seedEmptyFilterTables();
  });

  // ────────────────────────────────────────────────────────────
  // 1. place_excludes_non_place_targets
  // ────────────────────────────────────────────────────────────
  it('place surface excludes posts without place distribution target', async () => {
    seedTable('Post', [
      makePost({ distribution_targets: ['connections'], effective_latitude: SF_LAT, effective_longitude: SF_LNG }),
      makePost({ distribution_targets: ['persona_followers'], effective_latitude: SF_LAT, effective_longitude: SF_LNG }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'place',
      latitude: SF_LAT,
      longitude: SF_LNG,
      radiusMeters: 16000,
    });

    expect(result.posts).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────
  // 2. place_excludes_distant_posts
  // ────────────────────────────────────────────────────────────
  it('place surface excludes posts outside the radius', async () => {
    seedTable('Post', [
      makePost({
        distribution_targets: ['place'],
        latitude: DISTANT_LAT,
        longitude: DISTANT_LNG,
        effective_latitude: DISTANT_LAT,
        effective_longitude: DISTANT_LNG,
      }),
    ]);

    const radiusMiles = 10;
    const result = await getListFeed({
      userId: USER_ID,
      surface: 'place',
      latitude: SF_LAT,
      longitude: SF_LNG,
      radiusMeters: Math.round(radiusMiles * 1609.34),
    });

    expect(result.posts).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────
  // 3. place_includes_nearby_posts
  // ────────────────────────────────────────────────────────────
  it('place surface includes posts within the radius', async () => {
    const posts = [
      makePost({
        distribution_targets: ['place'],
        latitude: NEARBY_LAT,
        longitude: NEARBY_LNG,
        effective_latitude: NEARBY_LAT,
        effective_longitude: NEARBY_LNG,
      }),
      makePost({
        distribution_targets: ['place'],
        latitude: SF_LAT,
        longitude: SF_LNG,
        effective_latitude: SF_LAT,
        effective_longitude: SF_LNG,
      }),
    ];
    seedTable('Post', posts);

    const radiusMiles = 10;
    const result = await getListFeed({
      userId: USER_ID,
      surface: 'place',
      latitude: SF_LAT,
      longitude: SF_LNG,
      radiusMeters: Math.round(radiusMiles * 1609.34),
    });

    expect(result.posts).toHaveLength(2);
  });

  // ────────────────────────────────────────────────────────────
  // 4. connections_includes_connected_authors
  // ────────────────────────────────────────────────────────────
  it('connections surface includes posts from connected users', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);
    seedTable('Post', [
      makePost({ user_id: OTHER_USER, distribution_targets: ['connections'] }),
      makePost({ user_id: OTHER_USER, distribution_targets: ['connections'] }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'connections',
    });

    expect(result.posts).toHaveLength(2);
  });

  // ────────────────────────────────────────────────────────────
  // 5. connections_excludes_unconnected
  // ────────────────────────────────────────────────────────────
  it('connections surface excludes posts from unconnected users', async () => {
    // No accepted connections for USER_ID
    seedTable('Relationship', []);
    seedTable('Post', [
      makePost({
        user_id: UNCONNECTED_USER,
        distribution_targets: ['connections'],
        creator: { id: UNCONNECTED_USER, username: 'stranger', name: 'Stranger', first_name: 'Str', last_name: 'Anger', profile_picture_url: null, city: 'SF', state: 'CA' },
      }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'connections',
    });

    // No connections → empty feed
    expect(result.posts).toHaveLength(0);
  });

  it('personas surface includes Beacon updates from followed persona Posts', async () => {
    seedTable('PersonaTier', [
      { id: PERSONA_TIER_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower' },
    ]);
    seedTable('PersonaMembership', [
      {
        id: 'membership-1',
        persona_id: PERSONA_ID,
        user_id: USER_ID,
        tier_id: PERSONA_TIER_ID,
        relationship_type: 'follower',
        status: 'active',
      },
    ]);
    seedTable('PublicPersona', [
      {
        id: PERSONA_ID,
        user_id: OTHER_USER,
        handle: 'maya',
        display_name: 'Maya Builds',
        avatar_url: null,
        status: 'active',
      },
    ]);
    seedTable('Post', [
      makePost({
        id: 'broadcast-1',
        user_id: OTHER_USER,
        author_user_id: OTHER_USER,
        identity_context_type: 'persona',
        identity_context_id: PERSONA_ID,
        content: 'Follower update',
        post_type: 'personal_update',
        visibility: 'followers',
        visibility_scope: 'global',
        location_precision: 'none',
        latitude: null,
        longitude: null,
        effective_latitude: null,
        effective_longitude: null,
        location_name: null,
        post_as: 'persona',
        audience: 'followers',
        distribution_targets: ['persona_followers'],
        profile_visibility_scope: 'followers',
        broadcast_channel_id: 'channel-1',
        target_tier_rank: null,
        created_at: '2026-05-10T10:00:00.000Z',
        updated_at: '2026-05-10T10:00:00.000Z',
        creator: { id: OTHER_USER, username: 'other', name: 'Other User' },
      }),
    ]);
    seedTable('BroadcastMessage', []);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'personas',
    });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      id: 'broadcast-1',
      content: 'Follower update',
      post_type: 'personal_update',
      identity_context_type: 'persona',
      identity_context_id: PERSONA_ID,
    });
    expect(result.posts[0].author).toMatchObject({
      type: 'persona',
      id: PERSONA_ID,
      handle: 'maya',
      displayName: 'Maya Builds',
    });
  });

  it('personas surface includes the viewer-owned Beacon posts', async () => {
    seedTable('PersonaMembership', []);
    seedTable('PublicPersona', [
      {
        id: PERSONA_ID,
        user_id: USER_ID,
        handle: 'ownerbeacon',
        display_name: 'Owner Beacon',
        avatar_url: null,
        status: 'active',
      },
    ]);
    seedTable('Post', [
      makePost({
        id: 'owner-beacon-feed-post',
        user_id: USER_ID,
        author_user_id: USER_ID,
        identity_context_type: 'persona',
        identity_context_id: PERSONA_ID,
        content: 'My own Beacon update',
        post_type: 'personal_update',
        visibility: 'followers',
        visibility_scope: 'global',
        location_precision: 'none',
        latitude: null,
        longitude: null,
        effective_latitude: null,
        effective_longitude: null,
        location_name: null,
        post_as: 'persona',
        audience: 'followers',
        distribution_targets: ['persona_followers'],
        profile_visibility_scope: 'followers',
        target_tier_rank: null,
        created_at: '2026-05-10T11:00:00.000Z',
        updated_at: '2026-05-10T11:00:00.000Z',
        creator: { id: USER_ID, username: 'owner' },
      }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'personas',
    });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      id: 'owner-beacon-feed-post',
      content: 'My own Beacon update',
      identity_context_type: 'persona',
      identity_context_id: PERSONA_ID,
    });
    expect(result.posts[0].author).toMatchObject({
      type: 'persona',
      id: PERSONA_ID,
      handle: 'ownerbeacon',
      displayName: 'Owner Beacon',
      viewer: expect.objectContaining({ isOwner: true }),
    });
  });

  // ────────────────────────────────────────────────────────────
  // 7. pagination_no_duplicates
  // ────────────────────────────────────────────────────────────
  it('pagination returns no duplicate post IDs', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);
    const posts = [];
    for (let i = 0; i < 50; i++) {
      posts.push(makePost({
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }));
    }
    seedTable('Post', posts);

    const allIds = [];
    let cursorCreatedAt = null;
    let cursorId = null;

    for (let page = 0; page < 5; page++) {
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'connections',
        limit: 10,
        cursorCreatedAt,
        cursorId,
      });
      allIds.push(...result.posts.map(p => p.id));

      if (!result.pagination.hasMore) break;
      cursorCreatedAt = result.pagination.nextCursor.createdAt;
      cursorId = result.pagination.nextCursor.id;
    }

    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  // ────────────────────────────────────────────────────────────
  // 8. pagination_no_skips
  // ────────────────────────────────────────────────────────────
  it('pagination returns all 50 posts with no skips', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);
    const posts = [];
    for (let i = 0; i < 50; i++) {
      posts.push(makePost({
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }));
    }
    seedTable('Post', posts);

    const allIds = [];
    let cursorCreatedAt = null;
    let cursorId = null;

    for (let page = 0; page < 10; page++) {
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'connections',
        limit: 10,
        cursorCreatedAt,
        cursorId,
      });
      allIds.push(...result.posts.map(p => p.id));

      if (!result.pagination.hasMore) break;
      cursorCreatedAt = result.pagination.nextCursor.createdAt;
      cursorId = result.pagination.nextCursor.id;
    }

    expect(allIds).toHaveLength(50);
    expect(new Set(allIds).size).toBe(50);
  });

  it('pagination does not skip newer unpinned posts after older pinned posts', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);

    seedTable('Post', [
      makePost({
        id: 'pinned-newer',
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        is_pinned: true,
        created_at: '2026-03-01T10:00:00.000Z',
      }),
      makePost({
        id: 'pinned-older',
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        is_pinned: true,
        created_at: '2026-03-01T09:00:00.000Z',
      }),
      makePost({
        id: 'unpinned-newest',
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        is_pinned: false,
        created_at: '2026-03-01T12:00:00.000Z',
      }),
      makePost({
        id: 'unpinned-middle',
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        is_pinned: false,
        created_at: '2026-03-01T11:00:00.000Z',
      }),
      makePost({
        id: 'unpinned-older',
        user_id: OTHER_USER,
        distribution_targets: ['connections'],
        is_pinned: false,
        created_at: '2026-03-01T08:00:00.000Z',
      }),
    ]);

    const seenIds = [];
    let cursorCreatedAt = null;
    let cursorId = null;

    for (let page = 0; page < 3; page++) {
      const result = await getListFeed({
        userId: USER_ID,
        surface: 'connections',
        limit: 2,
        cursorCreatedAt,
        cursorId,
      });

      seenIds.push(...result.posts.map((p) => p.id));

      if (!result.pagination.hasMore) break;
      cursorCreatedAt = result.pagination.nextCursor.createdAt;
      cursorId = result.pagination.nextCursor.id;
    }

    expect(seenIds).toEqual([
      'pinned-newer',
      'pinned-older',
      'unpinned-newest',
      'unpinned-middle',
      'unpinned-older',
    ]);
  });

  // ────────────────────────────────────────────────────────────
  // 9. place_requires_location
  // ────────────────────────────────────────────────────────────
  it('place surface without location returns empty with requiresViewingLocation', async () => {
    seedTable('Post', [
      makePost({ distribution_targets: ['place'] }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'place',
      // No latitude/longitude provided
    });

    expect(result.posts).toHaveLength(0);
    expect(result.requiresViewingLocation).toBe(true);
  });

  // ────────────────────────────────────────────────────────────
  // 10. mute_filtering
  // ────────────────────────────────────────────────────────────
  it('muted user posts are excluded from the feed', async () => {
    const MUTED_USER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
      { id: 'r-2', requester_id: USER_ID, addressee_id: MUTED_USER, status: 'accepted' },
    ]);
    seedTable('PostMute', [
      { id: 'mute-1', user_id: USER_ID, muted_entity_type: 'user', muted_entity_id: MUTED_USER },
    ]);
    seedTable('Post', [
      makePost({ user_id: OTHER_USER, distribution_targets: ['connections'] }),
      makePost({
        user_id: MUTED_USER,
        distribution_targets: ['connections'],
        creator: { id: MUTED_USER, username: 'muted', name: 'Muted', first_name: 'M', last_name: 'U', profile_picture_url: null, city: 'SF', state: 'CA' },
      }),
      makePost({
        user_id: MUTED_USER,
        distribution_targets: ['connections'],
        creator: { id: MUTED_USER, username: 'muted', name: 'Muted', first_name: 'M', last_name: 'U', profile_picture_url: null, city: 'SF', state: 'CA' },
      }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'connections',
    });

    // Only OTHER_USER's post should remain
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].user_id).toBe(OTHER_USER);
  });

  // ────────────────────────────────────────────────────────────
  // 11. topic_mute_filtering
  // ────────────────────────────────────────────────────────────
  it('muted topic posts are excluded from the feed', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);
    seedTable('PostMute', [
      { id: 'topic-mute-1', user_id: USER_ID, muted_entity_type: 'topic', muted_entity_id: 'deal', surface: null },
    ]);
    seedTable('Post', [
      makePost({ user_id: OTHER_USER, post_type: 'deal', distribution_targets: ['connections'] }),
      makePost({ user_id: OTHER_USER, post_type: 'ask_local', distribution_targets: ['connections'] }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'connections',
    });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].post_type).toBe('ask_local');
  });

  // ────────────────────────────────────────────────────────────
  // 12. surface_scoped_topic_mute
  // ────────────────────────────────────────────────────────────
  it('surface-scoped topic mute only applies to that surface', async () => {
    seedTable('Relationship', [
      { id: 'r-1', requester_id: USER_ID, addressee_id: OTHER_USER, status: 'accepted' },
    ]);
    seedTable('PostMute', [
      { id: 'topic-mute-2', user_id: USER_ID, muted_entity_type: 'topic', muted_entity_id: 'deal', surface: 'place' },
    ]);
    seedTable('Post', [
      makePost({ user_id: OTHER_USER, post_type: 'deal', distribution_targets: ['connections'] }),
    ]);

    // On connections surface, the deal should NOT be muted (mute is scoped to place)
    const result = await getListFeed({
      userId: USER_ID,
      surface: 'connections',
    });

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].post_type).toBe('deal');
  });

  // ────────────────────────────────────────────────────────────
  // 12b. own_posts_not_removed_by_topic_mute
  // ────────────────────────────────────────────────────────────
  it('keeps own posts visible even when that topic is muted', async () => {
    seedTable('PostMute', [
      { id: 'topic-mute-own-1', user_id: USER_ID, muted_entity_type: 'topic', muted_entity_id: 'recommendation', surface: 'place' },
    ]);
    seedTable('Post', [
      makePost({
        id: 'own-rec',
        user_id: USER_ID,
        post_type: 'recommendation',
        distribution_targets: ['place'],
        creator: { id: USER_ID, username: 'me', name: 'Me', first_name: 'Me', last_name: 'User', profile_picture_url: null, city: 'SF', state: 'CA' },
      }),
      makePost({
        id: 'other-rec',
        user_id: OTHER_USER,
        post_type: 'recommendation',
        distribution_targets: ['place'],
      }),
    ]);

    const result = await getListFeed({
      userId: USER_ID,
      surface: 'place',
      latitude: SF_LAT,
      longitude: SF_LNG,
      radiusMeters: 16000,
    });

    const ids = result.posts.map((p) => p.id);
    expect(ids).toContain('own-rec');
    expect(ids).not.toContain('other-rec');
  });

  // ────────────────────────────────────────────────────────────
  // 13. map_list_agreement
  // ────────────────────────────────────────────────────────────
  it('map post IDs are a subset of list post IDs', async () => {
    const posts = [];
    for (let i = 0; i < 10; i++) {
      posts.push(makePost({
        distribution_targets: ['place'],
        latitude: SF_LAT + (i * 0.001),
        longitude: SF_LNG,
        effective_latitude: SF_LAT + (i * 0.001),
        effective_longitude: SF_LNG,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }));
    }
    seedTable('Post', posts);

    const box = {
      south: SF_LAT - 0.2,
      north: SF_LAT + 0.2,
      west: SF_LNG - 0.2,
      east: SF_LNG + 0.2,
    };

    const [listResult, mapResult] = await Promise.all([
      getListFeed({
        userId: USER_ID,
        surface: 'place',
        latitude: SF_LAT,
        longitude: SF_LNG,
        radiusMeters: 20000,
        limit: 50,
      }),
      getMapFeed({
        userId: USER_ID,
        surface: 'place',
        ...box,
        limit: 50,
      }),
    ]);

    const listIds = new Set(listResult.posts.map(p => p.id));
    const mapIds = mapResult.map(p => p.id);

    // Every map post should also appear in the list feed
    for (const mapId of mapIds) {
      expect(listIds.has(mapId)).toBe(true);
    }
    // Both should have found posts
    expect(mapResult.length).toBeGreaterThan(0);
  });

  it('map feed strips exact home address for non-author viewers', async () => {
    seedTable('Post', [
      makePost({
        id: 'home-map-post',
        user_id: OTHER_USER,
        home_id: 'home-1',
        home: { id: 'home-1', address: '123 Private Way', city: 'San Francisco' },
        location_precision: 'exact_place',
        distribution_targets: ['place'],
        latitude: SF_LAT,
        longitude: SF_LNG,
        effective_latitude: SF_LAT,
        effective_longitude: SF_LNG,
      }),
    ]);

    const result = await getMapFeed({
      userId: USER_ID,
      surface: 'place',
      south: SF_LAT - 0.2,
      north: SF_LAT + 0.2,
      west: SF_LNG - 0.2,
      east: SF_LNG + 0.2,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0].home.address).toBeNull();
    expect(result[0].locationUnlocked).toBe(false);
  });
});

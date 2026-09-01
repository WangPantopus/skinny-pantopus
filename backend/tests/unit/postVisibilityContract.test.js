// ============================================================
// TEST: Post Visibility Contract
//
// Route-level regression tests for inaccessible posts. If a caller
// cannot view a post, they also cannot interact with it by ID.
// ============================================================

const {
  resetTables,
  seedTable,
  getTable,
  setRpcMock,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: 'user' };
  } else {
    req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  }
  next();
});

jest.mock('../../jobs/organicMatch', () => ({
  matchBusinessesForPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/s3Service', () => ({
  getPublicUrl: jest.fn((key) => `https://cdn.example.com/${key}`),
}));

const express = require('express');
const request = require('supertest');

const VIEWER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const AUTHOR_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const POST_ID = '11111111-1111-4111-8111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

function seedRestrictedFollowersPost() {
  seedTable('Post', [
    {
      id: POST_ID,
      user_id: AUTHOR_ID,
      content: 'Followers only post',
      visibility: 'followers',
      audience: 'followers',
      distribution_targets: ['followers'],
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2026-03-01T00:00:00Z',
      media_urls: [],
      media_types: [],
      like_count: 1,
      comment_count: 1,
      share_count: 0,
      is_pinned: false,
      is_edited: false,
    },
  ]);
  seedTable('Relationship', []);
  seedTable('User', []);
  seedTable('PostLike', [
    {
      id: 'like-1',
      post_id: POST_ID,
      user_id: AUTHOR_ID,
      created_at: '2026-03-01T00:00:00Z',
    },
  ]);
  seedTable('PostComment', [
    {
      id: 'comment-1',
      post_id: POST_ID,
      user_id: AUTHOR_ID,
      comment: 'Hidden comment',
      is_deleted: false,
      created_at: '2026-03-01T00:00:00Z',
    },
  ]);
  seedTable('PostReport', []);
  seedTable('PostNotHelpful', []);
  seedTable('PostSave', []);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  setRpcMock(null);
  seedRestrictedFollowersPost();
});

describe('Post visibility contract', () => {
  it('blocks liking an inaccessible post', async () => {
    const app = createApp();
    const rpcMock = jest.fn().mockResolvedValue({
      data: { liked: true, likeCount: 2 },
      error: null,
    });
    setRpcMock(rpcMock);

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/like`)
      .set('x-test-user-id', VIEWER_ID)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('blocks fetching likes for an inaccessible post', async () => {
    const app = createApp();

    const res = await request(app)
      .get(`/api/posts/${POST_ID}/likes`)
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
  });

  it('blocks commenting on an inaccessible post', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .set('x-test-user-id', VIEWER_ID)
      .send({ comment: 'I should not be able to comment here.' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
    expect(getTable('PostComment')).toHaveLength(1);
  });

  it('blocks fetching comments for an inaccessible post', async () => {
    const app = createApp();

    const res = await request(app)
      .get(`/api/posts/${POST_ID}/comments`)
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
  });

  it('blocks reporting an inaccessible post', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/report`)
      .set('x-test-user-id', VIEWER_ID)
      .send({ reason: 'spam' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
    expect(getTable('PostReport')).toHaveLength(0);
  });

  it('blocks not-helpful flags on an inaccessible post', async () => {
    const app = createApp();

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/not-helpful`)
      .set('x-test-user-id', VIEWER_ID)
      .send({ surface: 'connections' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
    expect(getTable('PostNotHelpful')).toHaveLength(0);
  });

  it('blocks saving an inaccessible post', async () => {
    const app = createApp();
    const rpcMock = jest.fn().mockResolvedValue({ data: true, error: null });
    setRpcMock(rpcMock);

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/save`)
      .set('x-test-user-id', VIEWER_ID)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/do not have access/i);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getTable('PostSave')).toHaveLength(0);
  });

  it('still allows connections to interact with connections-only posts', async () => {
    const app = createApp();
    const rpcMock = jest.fn().mockResolvedValue({
      data: { liked: true, likeCount: 2 },
      error: null,
    });
    setRpcMock(rpcMock);
    seedTable('Relationship', [
      { id: 'r-vc', requester_id: VIEWER_ID, addressee_id: AUTHOR_ID, status: 'accepted' },
    ]);

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/like`)
      .set('x-test-user-id', VIEWER_ID)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('toggle_post_like', {
      p_post_id: POST_ID,
      p_user_id: VIEWER_ID,
    });
  });

  it('allows reading place-distributed comments from the feed surface', async () => {
    const app = createApp();
    seedTable('Post', [
      {
        id: POST_ID,
        user_id: AUTHOR_ID,
        content: 'Nearby place post',
        visibility: 'neighborhood',
        audience: 'nearby',
        distribution_targets: ['place'],
        latitude: 41.8781,
        longitude: -87.6298,
        location_name: 'Chicago',
        created_at: '2026-03-01T00:00:00Z',
        media_urls: [],
        media_types: [],
        like_count: 1,
        comment_count: 1,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
      },
    ]);

    const commentsRes = await request(app)
      .get(`/api/posts/${POST_ID}/comments`)
      .set('x-test-user-id', VIEWER_ID);

    expect(commentsRes.status).toBe(200);
    expect(Array.isArray(commentsRes.body.comments)).toBe(true);
  });

  it('allows commenting on visible local-audience place posts', async () => {
    const app = createApp();
    seedTable('Post', [
      {
        id: POST_ID,
        user_id: AUTHOR_ID,
        content: 'Nearby place post',
        visibility: 'neighborhood',
        audience: 'nearby',
        distribution_targets: ['place'],
        latitude: 41.8781,
        longitude: -87.6298,
        location_name: 'Chicago',
        created_at: '2026-03-01T00:00:00Z',
        media_urls: [],
        media_types: [],
        like_count: 1,
        comment_count: 1,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
      },
    ]);

    const commentRes = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .set('x-test-user-id', VIEWER_ID)
      .send({ comment: 'Looks great 👋' });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment?.post_id).toBe(POST_ID);
  });

  it('hides followers-only post previews from unrelated profile viewers', async () => {
    const app = createApp();
    seedTable('Post', [
      {
        id: POST_ID,
        user_id: AUTHOR_ID,
        content: 'Followers only profile preview',
        visibility: 'followers',
        audience: 'followers',
        distribution_targets: ['followers'],
        show_on_profile: true,
        profile_visibility_scope: 'public',
        archived_at: null,
        created_at: '2026-03-01T00:00:00Z',
        media_urls: [],
        media_types: [],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
      },
    ]);
    seedTable('PostLike', []);
    seedTable('PostSave', []);

    const res = await request(app)
      .get(`/api/posts/user/${AUTHOR_ID}`)
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
  });

  it('shows connections-only post previews to connections on the public profile', async () => {
    const app = createApp();
    seedTable('Post', [
      {
        id: POST_ID,
        user_id: AUTHOR_ID,
        content: 'Connections only profile preview',
        visibility: 'connections',
        audience: 'connections',
        distribution_targets: ['connections'],
        show_on_profile: true,
        profile_visibility_scope: 'public',
        archived_at: null,
        created_at: '2026-03-01T00:00:00Z',
        media_urls: [],
        media_types: [],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
      },
    ]);
    seedTable('Relationship', [
      { id: 'r-vc', requester_id: VIEWER_ID, addressee_id: AUTHOR_ID, status: 'accepted' },
    ]);
    seedTable('PostLike', []);
    seedTable('PostSave', []);

    const res = await request(app)
      .get(`/api/posts/user/${AUTHOR_ID}`)
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].id).toBe(POST_ID);
  });

  it('keeps place-distributed profile previews visible to public viewers', async () => {
    const app = createApp();
    seedTable('Post', [
      {
        id: POST_ID,
        user_id: AUTHOR_ID,
        content: 'Nearby post that was also shared to connections',
        visibility: 'neighborhood',
        audience: 'nearby',
        distribution_targets: ['place', 'connections'],
        show_on_profile: true,
        profile_visibility_scope: 'public',
        latitude: 41.8781,
        longitude: -87.6298,
        location_name: 'Chicago',
        archived_at: null,
        created_at: '2026-03-01T00:00:00Z',
        media_urls: [],
        media_types: [],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        is_pinned: false,
        is_edited: false,
      },
    ]);
    seedTable('PostLike', []);
    seedTable('PostSave', []);

    const res = await request(app)
      .get(`/api/posts/user/${AUTHOR_ID}`)
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].id).toBe(POST_ID);
  });

  it('allows deleting your own comment', async () => {
    const app = createApp();
    seedTable('PostComment', [
      {
        id: 'comment-own',
        post_id: POST_ID,
        user_id: VIEWER_ID,
        comment: 'My comment',
        is_deleted: false,
        created_at: '2026-03-01T00:00:00Z',
      },
    ]);

    const deleteRes = await request(app)
      .delete(`/api/posts/${POST_ID}/comments/comment-own`)
      .set('x-test-user-id', VIEWER_ID);

    expect(deleteRes.status).toBe(200);
    expect(getTable('PostComment').find((comment) => comment.id === 'comment-own')).toBeUndefined();
  });
});

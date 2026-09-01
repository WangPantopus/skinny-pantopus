const {
  getTable,
  resetTables,
  seedTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = {
    id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'user',
  };
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

const AUTHOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VIEWER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const POST_ID = '11111111-1111-4111-8111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

function seedPost(overrides = {}) {
  seedTable('Post', [
    {
      id: POST_ID,
      user_id: AUTHOR_ID,
      content: 'My post',
      archived_at: null,
      updated_at: '2026-05-01T00:00:00.000Z',
      ...overrides,
    },
  ]);
}

describe('Post archive routes', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  it('archives and restores an owned post', async () => {
    seedPost();
    const app = createApp();

    const archiveRes = await request(app)
      .post(`/api/posts/${POST_ID}/archive`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({});

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.archived).toBe(true);
    expect(archiveRes.body.archived_at).toEqual(expect.any(String));
    let [post] = getTable('Post');
    expect(post.archived_at).toBe(archiveRes.body.archived_at);
    expect(post.updated_at).toBe(archiveRes.body.archived_at);

    const unarchiveRes = await request(app)
      .post(`/api/posts/${POST_ID}/unarchive`)
      .set('x-test-user-id', AUTHOR_ID)
      .send({});

    expect(unarchiveRes.status).toBe(200);
    expect(unarchiveRes.body).toEqual({ archived: false, archived_at: null });
    [post] = getTable('Post');
    expect(post.archived_at).toBeNull();
    expect(post.updated_at).toEqual(expect.any(String));
  });

  it('does not let another user archive a post', async () => {
    seedPost();
    const app = createApp();

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/archive`)
      .set('x-test-user-id', VIEWER_ID)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/own posts/i);
    expect(getTable('Post')[0].archived_at).toBeNull();
  });
});

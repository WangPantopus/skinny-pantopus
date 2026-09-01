const {
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
    id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
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

const VIEWER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const AUTHOR_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

function makeSavedPost(overrides = {}) {
  return {
    id: 'save-1',
    user_id: VIEWER_ID,
    created_at: '2026-03-12T00:00:00Z',
    post: {
      id: 'post-1',
      user_id: AUTHOR_ID,
      content: 'Saved post',
      media_urls: [],
      media_types: [],
      location_precision: 'exact_place',
      latitude: 45.515232,
      longitude: -122.678391,
      location_name: 'Downtown Portland',
      location_address: '123 Main St',
      creator: {
        id: AUTHOR_ID,
        username: 'seller',
        name: 'Seller',
      },
      home: {
        id: 'home-1',
        address: '123 Main St',
        city: 'Portland',
      },
      ...overrides,
    },
  };
}

describe('Saved posts privacy contract', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  it('redacts exact location fields for saved posts owned by someone else', async () => {
    seedTable('PostSave', [makeSavedPost()]);

    const app = createApp();
    const res = await request(app)
      .get('/api/posts/saved')
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].latitude).not.toBe(45.515232);
    expect(res.body.posts[0].longitude).not.toBe(-122.678391);
    expect(res.body.posts[0].location_address).toBeNull();
    expect(res.body.posts[0].home.address).toBeNull();
    expect(res.body.posts[0].locationUnlocked).toBe(false);
  });

  it('preserves exact location fields when the viewer is the author', async () => {
    seedTable('PostSave', [
      makeSavedPost({
        user_id: VIEWER_ID,
        home: {
          id: 'home-1',
          address: '123 Main St',
          city: 'Portland',
        },
      }),
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/posts/saved')
      .set('x-test-user-id', VIEWER_ID);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].latitude).toBe(45.515232);
    expect(res.body.posts[0].longitude).toBe(-122.678391);
    expect(res.body.posts[0].location_address).toBe('123 Main St');
    expect(res.body.posts[0].home.address).toBe('123 Main St');
    expect(res.body.posts[0].locationUnlocked).toBe(true);
  });
});

// ============================================================
// TEST: Post Mute Contract
//
// Route-level regression tests for the PostMute uniqueness
// contract after migration 076 added surface-aware uniqueness.
// ============================================================

const {
  resetTables,
  seedTable,
  getTable,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
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

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedTable('PostMute', []);
});

describe('Post mute contract', () => {
  it('deduplicates repeated entity mutes without relying on the legacy conflict target', async () => {
    const app = createApp();

    const first = await request(app)
      .post('/api/posts/mute')
      .send({ entityType: 'user', entityId: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb' });

    const second = await request(app)
      .post('/api/posts/mute')
      .send({ entityType: 'user', entityId: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(getTable('PostMute')).toHaveLength(1);
    expect(getTable('PostMute')[0]).toMatchObject({
      user_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
      muted_entity_type: 'user',
      muted_entity_id: 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb',
      surface: null,
    });
  });

  it('deduplicates repeated topic mutes on the same surface', async () => {
    const app = createApp();

    const first = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'place' });

    const second = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'place' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(getTable('PostMute')).toHaveLength(1);
    expect(getTable('PostMute')[0]).toMatchObject({
      muted_entity_type: 'topic',
      muted_entity_id: 'deal',
      surface: 'place',
    });
  });

  it('allows global and surface-specific topic mutes to coexist', async () => {
    const app = createApp();

    const globalMute = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal' });

    const placeMute = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'place' });

    expect(globalMute.status).toBe(200);
    expect(placeMute.status).toBe(200);
    expect(getTable('PostMute')).toHaveLength(2);
    expect(getTable('PostMute')).toEqual(expect.arrayContaining([
      expect.objectContaining({ muted_entity_type: 'topic', muted_entity_id: 'deal', surface: null }),
      expect.objectContaining({ muted_entity_type: 'topic', muted_entity_id: 'deal', surface: 'place' }),
    ]));
  });

  it('allows the same topic to be muted on different surfaces', async () => {
    const app = createApp();

    const placeMute = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'place' });

    const connectionsMute = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'connections' });

    expect(placeMute.status).toBe(200);
    expect(connectionsMute.status).toBe(200);
    expect(getTable('PostMute')).toHaveLength(2);
    expect(getTable('PostMute')).toEqual(expect.arrayContaining([
      expect.objectContaining({ muted_entity_type: 'topic', muted_entity_id: 'deal', surface: 'place' }),
      expect.objectContaining({ muted_entity_type: 'topic', muted_entity_id: 'deal', surface: 'connections' }),
    ]));
  });

  it('rejects invalid topic mute surfaces', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/posts/mute/topic')
      .send({ postType: 'deal', surface: 'nearby' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/surface must be one of place, connections, or personas/i);
    expect(getTable('PostMute')).toHaveLength(0);
  });
});

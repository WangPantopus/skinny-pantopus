const {
  resetTables,
  seedTable,
  setRpcMock,
} = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
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

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const HOME_ID = '11111111-1111-4111-8111-111111111111';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', require('../../routes/posts'));
  return app;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  setRpcMock(null);
  seedTable('Post', []);
});

describe('Post creation home-place contract', () => {
  it('allows posting to a home Place feed without explicit location or fresh GPS', async () => {
    const app = createApp();

    seedTable('Home', [
      {
        id: HOME_ID,
        owner_id: USER_ID,
        name: 'Home Base',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        latitude: null,
        longitude: null,
        location: { type: 'Point', coordinates: [-122.3321, 47.6062] },
      },
    ]);
    seedTable('HomeOccupancy', [
      {
        id: 'occ-1',
        home_id: HOME_ID,
        user_id: USER_ID,
        role: 'owner',
        role_base: 'owner',
        is_active: true,
      },
    ]);

    const res = await request(app)
      .post('/api/posts')
      .set('x-test-user-id', USER_ID)
      .send({
        content: 'Remote update for the home Place feed.',
        postType: 'local_update',
        postAs: 'home',
        homeId: HOME_ID,
        audience: 'neighborhood',
      });

    expect(res.status).toBe(201);
    expect(res.body.post.home_id).toBe(HOME_ID);
    expect(res.body.post.latitude).toBeCloseTo(47.6062);
    expect(res.body.post.longitude).toBeCloseTo(-122.3321);
    expect(res.body.post.location_address).toContain('123 Main St');
  });

  it('still blocks ordinary nearby posts without fresh GPS or local verification', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/posts')
      .set('x-test-user-id', USER_ID)
      .send({
        content: 'Trying to post remotely to a nearby place.',
        postType: 'ask_local',
        audience: 'nearby',
        latitude: 47.6062,
        longitude: -122.3321,
        locationName: 'Seattle',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/physically present|verified resident|verified business/i);
  });
});

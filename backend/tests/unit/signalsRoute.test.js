// ============================================================
// TEST: POST /api/users/me/signals — Implicit view signals
// ============================================================

const { resetTables } = require('../__mocks__/supabaseAdmin');

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

jest.mock('../../config/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
}));

jest.mock('../../services/gig/affinityService', () => ({
  recordInteraction: jest.fn().mockResolvedValue(undefined),
  getUserAffinities: jest.fn().mockResolvedValue([]),
  getCategoryAffinity: jest.fn().mockResolvedValue(0),
  computeScore: jest.fn().mockReturnValue(0),
}));

const express = require('express');
const request = require('supertest');
const affinityService = require('../../services/gig/affinityService');
const logger = require('../../utils/logger');

const USER_1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../../routes/users'));
  return app;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('POST /api/users/me/signals', () => {
  it('processes positive signals (dwell > 10s) and records view interaction', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', category: 'Cleaning', dwell_ms: 15000, timestamp: new Date().toISOString() },
          { gig_id: 'gig-2', category: 'Moving', dwell_ms: 12000, timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(2);
    expect(affinityService.recordInteraction).toHaveBeenCalledTimes(2);
    expect(affinityService.recordInteraction).toHaveBeenCalledWith(USER_1, 'Cleaning', 'view');
    expect(affinityService.recordInteraction).toHaveBeenCalledWith(USER_1, 'Moving', 'view');
  });

  it('does NOT record view for quick-backs (dwell < 3s)', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', category: 'Cleaning', dwell_ms: 1500, timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
    expect(affinityService.recordInteraction).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('Quick-back signal', expect.objectContaining({ category: 'Cleaning' }));
  });

  it('does NOT record view for mid-range dwell (3s-10s)', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', category: 'Cleaning', dwell_ms: 5000, timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
    expect(affinityService.recordInteraction).not.toHaveBeenCalled();
  });

  it('returns 400 when signals array is missing', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signals/i);
  });

  it('returns 400 for empty signals array', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({ signals: [] });

    expect(res.status).toBe(400);
  });

  it('skips signals with missing category', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', dwell_ms: 15000, timestamp: new Date().toISOString() },
          { gig_id: 'gig-2', category: 'Cleaning', dwell_ms: 15000, timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(affinityService.recordInteraction).toHaveBeenCalledTimes(1);
  });

  it('skips signals with invalid dwell_ms', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', category: 'Cleaning', dwell_ms: 'invalid', timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
    expect(affinityService.recordInteraction).not.toHaveBeenCalled();
  });

  it('caps batch size to 50 signals', async () => {
    const app = createApp();

    const signals = Array.from({ length: 60 }, (_, i) => ({
      gig_id: `gig-${i}`,
      category: 'Cleaning',
      dwell_ms: 15000,
      timestamp: new Date().toISOString(),
    }));

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({ signals });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(50);
    expect(affinityService.recordInteraction).toHaveBeenCalledTimes(50);
  });

  it('handles mixed positive and quick-back signals', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/users/me/signals')
      .set('x-test-user-id', USER_1)
      .send({
        signals: [
          { gig_id: 'gig-1', category: 'Cleaning', dwell_ms: 15000, timestamp: new Date().toISOString() },
          { gig_id: 'gig-2', category: 'Moving', dwell_ms: 2000, timestamp: new Date().toISOString() },
          { gig_id: 'gig-3', category: 'Pet Care', dwell_ms: 20000, timestamp: new Date().toISOString() },
          { gig_id: 'gig-4', category: 'Yard Work', dwell_ms: 5000, timestamp: new Date().toISOString() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(2); // Only the >10s ones
    expect(affinityService.recordInteraction).toHaveBeenCalledWith(USER_1, 'Cleaning', 'view');
    expect(affinityService.recordInteraction).toHaveBeenCalledWith(USER_1, 'Pet Care', 'view');
  });
});

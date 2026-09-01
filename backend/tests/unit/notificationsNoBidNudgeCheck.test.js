const express = require('express');
const request = require('supertest');
const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: req.headers['x-test-user-id'] || 'mock-user-id', role: 'user' };
  next();
});

const USER_ID = '22222222-2222-2222-2222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../../routes/notifications'));
  return app;
}

describe('GET /api/notifications/no-bid-nudge-check', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  it('reports hasHome=false for active but unverified occupancies', async () => {
    seedTable('Notification', [{
      id: 'notif-1',
      user_id: USER_ID,
      type: 'no_bid_gig_nudge',
      is_read: false,
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      user_id: USER_ID,
      is_active: true,
      verification_status: 'unverified',
    }]);

    const app = createApp();
    const res = await request(app)
      .get('/api/notifications/no-bid-nudge-check')
      .set('x-test-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ eligible: true, hasHome: false });
  });

  it('reports hasHome=true only for verified occupancies', async () => {
    seedTable('Notification', [{
      id: 'notif-1',
      user_id: USER_ID,
      type: 'no_bid_gig_nudge',
      is_read: false,
    }]);
    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      user_id: USER_ID,
      is_active: true,
      verification_status: 'verified',
    }]);

    const app = createApp();
    const res = await request(app)
      .get('/api/notifications/no-bid-nudge-check')
      .set('x-test-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ eligible: true, hasHome: true });
  });
});

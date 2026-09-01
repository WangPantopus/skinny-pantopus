const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../../services/context/providerOrchestrator', () => ({
  composeScheduledBriefing: jest.fn(),
}));
jest.mock('../../services/pushService', () => ({
  sendToUser: jest.fn(),
}));

const { composeScheduledBriefing } = require('../../services/context/providerOrchestrator');
const pushService = require('../../services/pushService');

const USER_ID = '22222222-2222-2222-2222-222222222222';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/internal/briefing', require('../../routes/internalBriefing'));
  return app;
}

describe('POST /api/internal/briefing/send', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    process.env.INTERNAL_API_KEY = 'test-internal-key';
  });

  it('treats null evening preference as enabled during rollout', async () => {
    seedTable('UserNotificationPreferences', [{
      id: 'pref-1',
      user_id: USER_ID,
      daily_briefing_enabled: false,
      evening_briefing_enabled: null,
      daily_briefing_timezone: 'America/Los_Angeles',
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
    }]);

    composeScheduledBriefing.mockResolvedValue({
      should_send: false,
      skip_reason: 'low_signal_day',
      signals_snapshot: [],
      location_geohash: 'c20g8',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/internal/briefing/send')
      .set('x-internal-api-key', 'test-internal-key')
      .send({ userId: USER_ID, briefingKind: 'evening' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'skipped', skip_reason: 'low_signal_day' });
    expect(composeScheduledBriefing).toHaveBeenCalledWith(USER_ID, { kind: 'evening' });
    expect(pushService.sendToUser).not.toHaveBeenCalled();

    const deliveries = getTable('DailyBriefingDelivery');
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].briefing_kind).toBe('evening');
    expect(deliveries[0].status).toBe('skipped');
  });
});

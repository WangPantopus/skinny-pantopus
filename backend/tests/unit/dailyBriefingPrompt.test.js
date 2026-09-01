// ============================================================
// TEST: the morning-briefing opt-in
//
// `daily_briefing_enabled` defaults false while `evening_briefing_enabled`
// defaults true, so the morning briefing effectively never shipped — the
// control sits in Settings → Notifications where almost nobody finds it.
//
// The fix is an explicit one-time ask, NOT a silent default flip: turning
// on a push for existing users without asking is how a notification
// channel gets burned. These pin that the ask happens once per ACCOUNT
// and that a "no" is remembered permanently.
// ============================================================

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../services/context/providerOrchestrator', () => ({
  getHubToday: jest.fn(),
  composeScheduledBriefing: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { resetTables, getTable } = require('../__mocks__/supabaseAdmin');

const USER = '33333333-3333-3333-3333-333333333333';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/hub', require('../../routes/hub'));
  return a;
}

function prefsRow() {
  return getTable('UserNotificationPreferences').find((r) => r.user_id === USER);
}

describe('daily briefing prompt', () => {
  beforeEach(() => resetTables());

  test('defaults report never-asked, so the prompt can show exactly once', async () => {
    const res = await request(app()).get('/api/hub/preferences').set('x-test-user-id', USER);
    expect(res.status).toBe(200);
    expect(res.body.preferences.daily_briefing_enabled).toBe(false);
    expect(res.body.preferences.daily_briefing_prompted_at).toBeNull();
  });

  test('accepting records the answer AND that we asked', async () => {
    const res = await request(app())
      .put('/api/hub/preferences')
      .set('x-test-user-id', USER)
      .send({
        daily_briefing_enabled: true,
        daily_briefing_time_local: '07:00',
        daily_briefing_prompted: true,
      });

    expect(res.status).toBe(200);
    const row = prefsRow();
    expect(row.daily_briefing_enabled).toBe(true);
    expect(row.daily_briefing_time_local).toBe('07:00');
    expect(row.daily_briefing_prompted_at).toBeTruthy();
    // The client sends a boolean; the stored value is a server timestamp.
    expect(row.daily_briefing_prompted).toBeUndefined();
  });

  test('declining is remembered permanently, so the ask never returns', async () => {
    await request(app())
      .put('/api/hub/preferences')
      .set('x-test-user-id', USER)
      .send({ daily_briefing_enabled: false, daily_briefing_prompted: true });

    const row = prefsRow();
    expect(row.daily_briefing_enabled).toBe(false);
    expect(row.daily_briefing_prompted_at).toBeTruthy();
  });

  test('the timestamp is the server clock, not something the caller chose', async () => {
    await request(app())
      .put('/api/hub/preferences')
      .set('x-test-user-id', USER)
      .send({ daily_briefing_prompted: true });

    const stamped = Date.parse(prefsRow().daily_briefing_prompted_at);
    expect(Number.isFinite(stamped)).toBe(true);
    expect(Math.abs(Date.now() - stamped)).toBeLessThan(60_000);
  });

  test('rejects a raw timestamp — the field is not client-writable', async () => {
    const res = await request(app())
      .put('/api/hub/preferences')
      .set('x-test-user-id', USER)
      .send({ daily_briefing_prompted_at: '1999-01-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
  });
});

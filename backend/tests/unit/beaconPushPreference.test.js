const path = require('node:path');
const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const push = require('../__mocks__/pushService');
const notifications = require(path.resolve(__dirname, '../../services/notificationService.js'));
const app = express();
app.use(express.json());
app.use('/api/hub', require('../../routes/hub'));
const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const input = { userId, type: 'persona_broadcast', title: 'Beacon update',
  context: 'audience', link: '/post/exact-permitted-post' };
const drainPush = () => new Promise(setImmediate);

beforeEach(() => {
  db.resetTables();
  db.seedTable('MailPreferences', [{ user_id: userId, push_notifications: true }]);
});
afterEach(() => jest.restoreAllMocks());

test('GET defaults to enabled and PUT persists an account-scoped opt-out without changing other settings', async () => {
  expect((await request(app).get('/api/hub/preferences')).body.preferences.beacon_push_enabled).toBe(true);
  db.seedTable('UserNotificationPreferences', [
    { user_id: userId, gig_updates_enabled: false },
    { user_id: 'other-user', beacon_push_enabled: true },
  ]);
  const saved = await request(app).put('/api/hub/preferences').send({ beacon_push_enabled: false });
  expect(saved.status).toBe(200);
  expect(saved.body.preferences).toEqual(expect.objectContaining({ user_id: userId,
    beacon_push_enabled: false, gig_updates_enabled: false }));
  expect((await request(app).get('/api/hub/preferences')).body.preferences.beacon_push_enabled).toBe(false);
  expect(db.getTable('UserNotificationPreferences').find(row => row.user_id === 'other-user').beacon_push_enabled).toBe(true);
  expect(db.getTable('MailPreferences')[0].push_notifications).toBe(true);
  expect((await request(app).put('/api/hub/preferences').send({ beacon_push_enabled: null })).status).toBe(400);
  // Shared validation strips unknown keys; ownership still comes from auth.
  expect((await request(app).put('/api/hub/preferences').send({ beacon_push_enabled: false, user_id: 'other-user' })).status).toBe(200);
  expect(db.getTable('UserNotificationPreferences').find(row => row.user_id === 'other-user').beacon_push_enabled).toBe(true);
});

describe.each(['single', 'bulk'])('%s notification transport', mode => {
  const publish = async (overrides = {}) => {
    const row = mode === 'single'
      ? await notifications.createNotification({ ...input, ...overrides })
      : (await notifications.createBulkNotifications([{ ...input, ...overrides }]))[0];
    await drainPush();
    return row;
  };

  test('opt-out retains exact in-app row and live event; restore only sends future publications', async () => {
    const emit = jest.fn();
    notifications.init({ to: () => ({ emit }) }, new Map([[userId, new Set(['socket'])]]));
    db.seedTable('UserNotificationPreferences', [{ user_id: userId, beacon_push_enabled: false }]);
    const muted = await publish();
    expect(muted).toEqual(expect.objectContaining({ context: 'audience', link: input.link }));
    expect(emit).toHaveBeenCalledWith('notification:new', muted);
    expect(push.sendToUser).not.toHaveBeenCalled();
    await request(app).put('/api/hub/preferences').send({ beacon_push_enabled: true });
    await drainPush();
    expect(push.sendToUser).not.toHaveBeenCalled();
    await publish({ link: '/post/new-exact-post' });
    expect(db.getTable('Notification')).toHaveLength(2);
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
      data: expect.objectContaining({ link: '/post/new-exact-post', type: 'persona_broadcast' }),
    }));
    notifications.init(null, null);
  });

  test('missing preference defaults to enabled, while global opt-out still wins', async () => {
    await publish();
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    await db.from('MailPreferences').update({ push_notifications: false }).eq('user_id', userId);
    await publish();
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(db.getTable('Notification')).toHaveLength(2);
  });

  test('Beacon opt-out leaves unrelated audience notifications enabled', async () => {
    db.seedTable('UserNotificationPreferences', [{ user_id: userId, beacon_push_enabled: false }]);
    await publish({ type: 'persona_dm_received' });
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });

  test.each(['returned', 'thrown'])('preference read failure (%s) keeps the row without risking an unwanted push', async kind => {
    const from = db.from;
    jest.spyOn(db, 'from').mockImplementation(table => {
      if (table !== 'UserNotificationPreferences') return from(table);
      if (kind === 'thrown') throw new Error('Synthetic preference read failure');
      const builder = { select: () => builder, eq: () => builder,
        maybeSingle: async () => ({ data: null, error: { code: '08006' } }) };
      return builder;
    });
    expect(await publish()).toEqual(expect.objectContaining({ link: input.link }));
    expect(db.getTable('Notification')).toHaveLength(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});

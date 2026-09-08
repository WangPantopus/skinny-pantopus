const path = require('node:path');
const express = require('express');
const request = require('supertest');
const db = require('../__mocks__/supabaseAdmin');
const push = require('../__mocks__/pushService');
const notifications = require(path.resolve(__dirname, '../../services/notificationService.js'));
const router = require('../../routes/notifications');

const userId = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const app = express();
app.use(express.json());
app.use('/api/notifications', router);
beforeEach(() => db.resetTables());

describe.each([
  ['/register', { token: 'ios-token', platform: 'ios' }],
  ['/register', { token: 'android-token', platform: 'android' }],
  ['/push-token', { token: 'ExponentPushToken[legacy]' }],
])('%s (%j)', (route, body) => {
  const register = (payload = body) => request(app).post(`/api/notifications${route}`).send(payload);

  test('initializes push defaults on first registration', async () => {
    expect((await register()).status).toBe(200);
    expect(db.getTable('MailPreferences')).toEqual([
      expect.objectContaining({ user_id: userId, push_notifications: true }),
    ]);
  });

  test.each([false, true])('re-registration preserves saved push=%s and other preferences', async (enabled) => {
    const existing = { id: 'preferences', user_id: userId, push_notifications: enabled,
      email_notifications: false, updated_at: '2026-01-01T00:00:00Z' };
    db.seedTable('MailPreferences', [existing]);
    expect((await register()).status).toBe(200);
    expect(db.getTable('MailPreferences')).toEqual([existing]);
    expect(push.saveToken).toHaveBeenCalled();
  });

  test.each(['single', 'bulk'])('token rotation after opt-out keeps the %s in-app update but sends no push', async (mode) => {
    expect((await register()).status).toBe(200);
    // The settings endpoint writes this account-level preference separately.
    await db.from('MailPreferences').update({ push_notifications: false }).eq('user_id', userId);
    expect((await register({ ...body, token: `${body.token}-rotated` })).status).toBe(200);
    const input = { userId, type: 'persona_new_post', title: 'A test Beacon update',
      context: 'audience', link: '/post/test-post' };
    const notification = mode === 'single'
      ? await notifications.createNotification(input)
      : (await notifications.createBulkNotifications([input]))[0];
    await new Promise(setImmediate); // The service deliberately dispatches push asynchronously.
    expect(notification).toEqual(expect.objectContaining({ link: '/post/test-post', context: 'audience' }));
    expect(db.getTable('Notification')).toHaveLength(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  test('an explicit settings opt-in resumes push after another registration', async () => {
    db.seedTable('MailPreferences', [{ user_id: userId, push_notifications: false }]);
    await db.from('MailPreferences').update({ push_notifications: true }).eq('user_id', userId);
    expect((await register()).status).toBe(200);
    await notifications.createNotification({ userId, type: 'persona_new_post',
      title: 'Opted back in', link: '/post/new-post', context: 'audience' });
    await new Promise(setImmediate);
    expect(push.sendToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
      data: expect.objectContaining({ link: '/post/new-post' }),
    }));
  });
});

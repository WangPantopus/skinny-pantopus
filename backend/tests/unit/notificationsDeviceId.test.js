// ============================================================
// TEST: routes/notifications – push token registration carries the client
// deviceId (persistent login: PushToken.device_id links a token to the
// AuthDevice that registered it so device revoke / logout can delete
// exactly its tokens). Body `deviceId` wins over the `X-Device-Id` header;
// non-UUID values are ignored (legacy clients keep working).
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables } = require('../__mocks__/supabaseAdmin');
const pushService = require('../__mocks__/pushService');
const notificationsRouter = require('../../routes/notifications');

const DEVICE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const UID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa'; // verifyToken stub default

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
});
beforeEach(() => {
  resetTables();
});

describe('POST /api/notifications/register', () => {
  test('body deviceId is passed to pushService.saveToken', async () => {
    const res = await request(app).post('/api/notifications/register').send({ token: 'apns-token-1', platform: 'ios', provider: 'apns', deviceId: DEVICE_ID });
    expect(res.status).toBe(200);
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'apns-token-1', { platform: 'ios', provider: 'apns', deviceId: DEVICE_ID });
  });

  test('X-Device-Id header is used when the body has no deviceId', async () => {
    const res = await request(app).post('/api/notifications/register').set('X-Device-Id', DEVICE_ID.toUpperCase()).send({ token: 'fcm-token-1', platform: 'android' });
    expect(res.status).toBe(200);
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'fcm-token-1', { platform: 'android', provider: undefined, deviceId: DEVICE_ID });
  });

  test('legacy client without any device id → deviceId undefined (row linkage untouched)', async () => {
    const res = await request(app).post('/api/notifications/register').send({ token: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(200);
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'ExponentPushToken[abc]', { platform: undefined, provider: undefined, deviceId: undefined });
  });

  test('a non-UUID deviceId is ignored rather than rejected', async () => {
    const res = await request(app).post('/api/notifications/register').send({ token: 'apns-token-2', deviceId: 'not-a-uuid' });
    expect(res.status).toBe(200);
    expect(pushService.saveToken.mock.calls[0][2].deviceId).toBeUndefined();
  });
});

describe('POST /api/notifications/push-token (legacy Expo path)', () => {
  test('also forwards the device id', async () => {
    const res = await request(app).post('/api/notifications/push-token').set('X-Device-Id', DEVICE_ID).send({ token: 'ExponentPushToken[xyz]' });
    expect(res.status).toBe(200);
    expect(pushService.saveToken).toHaveBeenCalledWith(UID, 'ExponentPushToken[xyz]', { deviceId: DEVICE_ID });
  });
});

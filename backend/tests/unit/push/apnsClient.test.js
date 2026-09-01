const { generateKeyPairSync } = require('crypto');
const jwt = require('jsonwebtoken');
const apnsClient = require('../../../services/push/apnsClient');

const ENV_KEYS = [
  'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID',
  'APNS_PRIVATE_KEY', 'APNS_PRIVATE_KEY_BASE64', 'APNS_PRODUCTION', 'APNS_HOST',
];
const savedEnv = {};

beforeEach(() => {
  ENV_KEYS.forEach((k) => { savedEnv[k] = process.env[k]; delete process.env[k]; });
  apnsClient.close(); // reset cached provider token / session
});
afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

describe('push/apnsClient.isConfigured', () => {
  it('is false without credentials', () => {
    expect(apnsClient.isConfigured()).toBe(false);
  });
  it('is true once every credential is present', () => {
    process.env.APNS_KEY_ID = 'KEY123';
    process.env.APNS_TEAM_ID = 'TEAM123';
    process.env.APNS_BUNDLE_ID = 'app.pantopus.ios';
    process.env.APNS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----';
    expect(apnsClient.isConfigured()).toBe(true);
  });
});

describe('push/apnsClient.buildPayload', () => {
  it('builds the aps alert and hoists custom data to the top level', () => {
    const payload = apnsClient.buildPayload({
      title: 'New message',
      body: 'Hello',
      data: { link: '/chat/42', type: 'chat_message', aps: 'IGNORED', empty: null },
    });
    expect(payload.aps).toEqual({ alert: { title: 'New message', body: 'Hello' }, sound: 'default' });
    expect(payload.link).toBe('/chat/42');
    expect(payload.type).toBe('chat_message');
    expect(payload.aps).not.toBe('IGNORED'); // reserved key not overwritten
    expect('empty' in payload).toBe(false); // null dropped
  });

  it('tolerates a missing payload', () => {
    expect(apnsClient.buildPayload()).toEqual({ aps: { alert: { title: '', body: '' }, sound: 'default' } });
  });
});

describe('push/apnsClient.classifyApnsFailure', () => {
  it('flags dead device tokens as invalid', () => {
    expect(apnsClient.classifyApnsFailure(410, 'Unregistered')).toBe('invalid');
    expect(apnsClient.classifyApnsFailure(400, 'BadDeviceToken')).toBe('invalid');
    expect(apnsClient.classifyApnsFailure(400, 'DeviceTokenNotForTopic')).toBe('invalid');
  });
  it('treats auth/throttle failures as retryable, not invalid', () => {
    expect(apnsClient.classifyApnsFailure(403, 'ExpiredProviderToken')).toBe('retry');
    expect(apnsClient.classifyApnsFailure(429, 'TooManyRequests')).toBe('retry');
  });
  it('returns ok for 200', () => {
    expect(apnsClient.classifyApnsFailure(200, undefined)).toBe('ok');
  });
});

describe('push/apnsClient.getProviderToken (.p8 ES256 auth)', () => {
  it('mints an ES256 JWT carrying the key id and team id', () => {
    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.APNS_KEY_ID = 'KEY12345AB';
    process.env.APNS_TEAM_ID = 'TEAM98765C';
    process.env.APNS_BUNDLE_ID = 'app.pantopus.ios';
    process.env.APNS_PRIVATE_KEY = privateKey;

    const token = apnsClient.getProviderToken();
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded.header.alg).toBe('ES256');
    expect(decoded.header.kid).toBe('KEY12345AB');
    expect(decoded.payload.iss).toBe('TEAM98765C');

    // Cached: a second call returns the identical token.
    expect(apnsClient.getProviderToken()).toBe(token);
  });
});

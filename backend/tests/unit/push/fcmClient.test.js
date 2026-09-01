const { generateKeyPairSync } = require('crypto');
const fcmClient = require('../../../services/push/fcmClient');

const ENV_KEYS = [
  'FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY',
  'FCM_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS',
];
const savedEnv = {};
let savedFetch;

function rsaKey() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
}

beforeEach(() => {
  ENV_KEYS.forEach((k) => { savedEnv[k] = process.env[k]; delete process.env[k]; });
  savedFetch = global.fetch;
  fcmClient.close();
});
afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
  global.fetch = savedFetch;
});

describe('push/fcmClient.isConfigured', () => {
  it('is false without a service account', () => {
    expect(fcmClient.isConfigured()).toBe(false);
  });
  it('is true with discrete env fields', () => {
    process.env.FCM_PROJECT_ID = 'pantopus';
    process.env.FCM_CLIENT_EMAIL = 'sa@pantopus.iam.gserviceaccount.com';
    process.env.FCM_PRIVATE_KEY = rsaKey();
    expect(fcmClient.isConfigured()).toBe(true);
  });
  it('is true with a full service-account JSON', () => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'pantopus', client_email: 'sa@x.com', private_key: rsaKey(),
    });
    expect(fcmClient.isConfigured()).toBe(true);
  });
});

describe('push/fcmClient.stringifyData', () => {
  it('coerces every value to a string and drops nullish', () => {
    expect(fcmClient.stringifyData({ a: 1, b: true, c: { x: 1 }, d: null, e: undefined, f: 'ok' }))
      .toEqual({ a: '1', b: 'true', c: '{"x":1}', f: 'ok' });
  });
});

describe('push/fcmClient.buildMessage', () => {
  it('produces a data-only high-priority message with title/body folded in', () => {
    const msg = fcmClient.buildMessage('tok-1', {
      title: 'Bid received', body: 'New bid', data: { link: '/gig/9', type: 'bid_received', n: 3 },
    });
    expect(msg).toEqual({
      message: {
        token: 'tok-1',
        data: { link: '/gig/9', type: 'bid_received', n: '3', title: 'Bid received', body: 'New bid' },
        android: { priority: 'high' },
      },
    });
    expect(msg.message.notification).toBeUndefined(); // data-only by design
  });
});

describe('push/fcmClient.classifyFcmFailure', () => {
  it('flags UNREGISTERED / SENDER_ID_MISMATCH / 404 as invalid', () => {
    expect(fcmClient.classifyFcmFailure(404, null)).toBe('invalid');
    expect(fcmClient.classifyFcmFailure(400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe('invalid');
    expect(fcmClient.classifyFcmFailure(403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } })).toBe('invalid');
  });
  it('treats other failures as retryable and 200 as ok', () => {
    expect(fcmClient.classifyFcmFailure(500, { error: { status: 'INTERNAL' } })).toBe('retry');
    expect(fcmClient.classifyFcmFailure(200, {})).toBe('ok');
  });
});

describe('push/fcmClient.getAccessToken (service-account OAuth2)', () => {
  it('exchanges a jwt-bearer assertion and caches the token', async () => {
    process.env.FCM_PROJECT_ID = 'pantopus';
    process.env.FCM_CLIENT_EMAIL = 'sa@x.com';
    process.env.FCM_PRIVATE_KEY = rsaKey();

    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => ({ access_token: 'ya29.fake', expires_in: 3600 }),
    }));

    const token = await fcmClient.getAccessToken();
    expect(token).toBe('ya29.fake');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(opts.body).toContain('grant_type=urn');
    expect(opts.body).toContain('assertion=');

    // Cached — no second network call.
    await fcmClient.getAccessToken();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('push/fcmClient.sendMany (mocked transport)', () => {
  beforeEach(() => {
    process.env.FCM_PROJECT_ID = 'pantopus';
    process.env.FCM_CLIENT_EMAIL = 'sa@x.com';
    process.env.FCM_PRIVATE_KEY = rsaKey();
  });

  it('round-trips a payload and prunes only the unregistered token', async () => {
    global.fetch = jest.fn(async (url, opts) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'AT', expires_in: 3600 }) };
      }
      const token = JSON.parse(opts.body).message.token;
      if (token === 'bad') {
        return { ok: false, status: 404, json: async () => ({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }) };
      }
      return { ok: true, status: 200, json: async () => ({ name: 'projects/pantopus/messages/1' }) };
    });

    const { invalidTokens } = await fcmClient.sendMany(['good', 'bad'], {
      title: 'T', body: 'B', data: { link: '/x', type: 'system' },
    });

    expect(invalidTokens).toEqual(['bad']);
    // 1 token exchange + 2 sends
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const sendUrl = global.fetch.mock.calls[1][0];
    expect(sendUrl).toBe('https://fcm.googleapis.com/v1/projects/pantopus/messages:send');
  });

  it('no-ops when not configured', async () => {
    delete process.env.FCM_PROJECT_ID;
    global.fetch = jest.fn();
    const { invalidTokens } = await fcmClient.sendMany(['x'], { title: 'T' });
    expect(invalidTokens).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

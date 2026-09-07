const expoClient = require('../../../services/push/expoClient');
const mockExpo = {
  chunkPushNotifications: jest.fn((messages) => [messages]),
  sendPushNotificationsAsync: jest.fn(),
};
jest.mock('expo-server-sdk', () => ({ Expo: jest.fn(() => mockExpo) }));

const savedFlag = process.env.PUSH_EXPO_ENABLED;
afterEach(() => {
  if (savedFlag === undefined) delete process.env.PUSH_EXPO_ENABLED;
  else process.env.PUSH_EXPO_ENABLED = savedFlag;
});

describe('push/expoClient.sendMany (mocked SDK)', () => {
  beforeEach(() => { process.env.PUSH_EXPO_ENABLED = 'true'; });

  it('only confirms tokens with an ok ticket and receipt ID', async () => {
    mockExpo.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'ok', id: 'receipt-1' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
      { status: 'ok' },
    ]);
    const tokens = ['ok', 'dead', 'throttled', 'missing-receipt'].map((id) => `ExpoPushToken[${id}]`);
    expect(await expoClient.sendMany(tokens, {})).toEqual({
      acceptedTokens: [tokens[0]], invalidTokens: [tokens[1]],
    });
  });

  it('does not report acceptance when a chunk send throws', async () => {
    mockExpo.sendPushNotificationsAsync.mockRejectedValue(new Error('connection reset'));
    expect(await expoClient.sendMany(['ExpoPushToken[x]'], {})).toEqual({
      acceptedTokens: [], invalidTokens: [],
    });
  });

  it('does not send when disabled', async () => {
    process.env.PUSH_EXPO_ENABLED = 'false';
    expect(await expoClient.sendMany(['ExpoPushToken[x]'], {})).toEqual({
      acceptedTokens: [], invalidTokens: [],
    });
    expect(mockExpo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('push/expoClient.isConfigured (dual-write flag)', () => {
  it('defaults to enabled', () => {
    delete process.env.PUSH_EXPO_ENABLED;
    expect(expoClient.isConfigured()).toBe(true);
  });
  it('is disabled only when explicitly set to "false"', () => {
    process.env.PUSH_EXPO_ENABLED = 'false';
    expect(expoClient.isConfigured()).toBe(false);
    process.env.PUSH_EXPO_ENABLED = 'true';
    expect(expoClient.isConfigured()).toBe(true);
  });
});

describe('push/expoClient.buildMessages', () => {
  it('keeps only Expo-formatted tokens and shapes the Expo message', () => {
    const messages = expoClient.buildMessages(
      ['ExponentPushToken[abc]', 'apns-hex-not-expo', 'ExpoPushToken[def]'],
      { title: 'Hi', body: 'There', data: { link: '/x' } },
    );
    expect(messages).toEqual([
      { to: 'ExponentPushToken[abc]', sound: 'default', title: 'Hi', body: 'There', data: { link: '/x' } },
      { to: 'ExpoPushToken[def]', sound: 'default', title: 'Hi', body: 'There', data: { link: '/x' } },
    ]);
  });

  it('returns an empty array when no Expo tokens are present', () => {
    expect(expoClient.buildMessages(['plain-token'], { title: 'x' })).toEqual([]);
  });
});

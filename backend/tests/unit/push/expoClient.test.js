const expoClient = require('../../../services/push/expoClient');

const savedFlag = process.env.PUSH_EXPO_ENABLED;
afterEach(() => {
  if (savedFlag === undefined) delete process.env.PUSH_EXPO_ENABLED;
  else process.env.PUSH_EXPO_ENABLED = savedFlag;
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

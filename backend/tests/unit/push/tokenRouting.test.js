const {
  isExpoToken,
  resolveRegistration,
  classifyProvider,
} = require('../../../services/push/tokenRouting');

describe('push/tokenRouting', () => {
  describe('isExpoToken', () => {
    it('recognises Expo token formats', () => {
      expect(isExpoToken('ExponentPushToken[abc123]')).toBe(true);
      expect(isExpoToken('ExpoPushToken[abc123]')).toBe(true);
    });
    it('rejects APNs/FCM/garbage tokens', () => {
      expect(isExpoToken('a'.repeat(64))).toBe(false);
      expect(isExpoToken('fGcMtOkEn:long-opaque-string')).toBe(false);
      expect(isExpoToken('')).toBe(false);
      expect(isExpoToken(null)).toBe(false);
    });
  });

  describe('resolveRegistration', () => {
    it('maps ios → apns and android → fcm', () => {
      expect(resolveRegistration({ token: 'abc', platform: 'ios' }))
        .toEqual({ platform: 'ios', provider: 'apns' });
      expect(resolveRegistration({ token: 'abc', platform: 'android' }))
        .toEqual({ platform: 'android', provider: 'fcm' });
    });

    it('derives platform from an explicit provider', () => {
      expect(resolveRegistration({ token: 'abc', provider: 'apns' }))
        .toEqual({ platform: 'ios', provider: 'apns' });
      expect(resolveRegistration({ token: 'abc', provider: 'fcm' }))
        .toEqual({ platform: 'android', provider: 'fcm' });
    });

    it('forces provider=expo for Expo-formatted tokens regardless of platform', () => {
      expect(resolveRegistration({ token: 'ExponentPushToken[x]', platform: 'ios' }))
        .toEqual({ platform: 'ios', provider: 'expo' });
    });

    it('is case-insensitive and drops invalid values', () => {
      expect(resolveRegistration({ token: 'abc', platform: 'IOS' }))
        .toEqual({ platform: 'ios', provider: 'apns' });
      expect(resolveRegistration({ token: 'abc', platform: 'windows' }))
        .toEqual({ platform: null, provider: null });
    });
  });

  describe('classifyProvider', () => {
    it('honours the stored provider column first', () => {
      expect(classifyProvider({ token: 'abc', provider: 'apns' })).toBe('apns');
      expect(classifyProvider({ token: 'abc', provider: 'fcm' })).toBe('fcm');
      expect(classifyProvider({ token: 'abc', provider: 'expo' })).toBe('expo');
    });

    it('falls back to platform when provider is missing', () => {
      expect(classifyProvider({ token: 'abc', platform: 'ios' })).toBe('apns');
      expect(classifyProvider({ token: 'abc', platform: 'android' })).toBe('fcm');
    });

    it('sniffs Expo tokens and defaults legacy rows to expo', () => {
      expect(classifyProvider({ token: 'ExponentPushToken[x]' })).toBe('expo');
      expect(classifyProvider({ token: 'unknown-legacy-token' })).toBe('expo');
    });
  });
});

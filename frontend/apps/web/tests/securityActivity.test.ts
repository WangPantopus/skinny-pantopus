/**
 * Persistent login — presentation helpers for /app/settings/security.
 */
import {
  describeSession,
  describeUserAgent,
  formatRelativeTime,
  isSecurityAlertEvent,
  platformLabel,
  securityEventLabel,
  summarizeEventMeta,
  trustLevelLabel,
} from '../src/lib/securityActivity';

describe('securityActivity helpers', () => {
  test('securityEventLabel maps contract event types and falls back gracefully', () => {
    expect(securityEventLabel('login')).toBe('Signed in');
    expect(securityEventLabel('refresh_reuse')).toBe('Session token reuse detected — session revoked');
    expect(securityEventLabel('device_mismatch')).toBe('Device key mismatch — session revoked');
    expect(securityEventLabel('session_revoked')).toBe('Session revoked');
    expect(securityEventLabel('revoke_others')).toBe('Signed out of all other devices');
    expect(securityEventLabel('inactivity_expired')).toBe('Session expired after inactivity');
    // Backend event types (backend/services/authDeviceService.js, authNotifyService.js)
    expect(securityEventLabel('lockdown')).toBe('Signed out everywhere (lockdown)');
    expect(securityEventLabel('step_up_key_enrolled')).toBe('Biometric confirmation key enrolled on a device');
    expect(securityEventLabel('lockdown_email_sent')).toBe('Sign-out-everywhere email sent');
    expect(securityEventLabel('device_removed_email_sent')).toBe('Device-removed email sent');
    expect(securityEventLabel('security_signout_email_sent')).toBe('Security sign-out email sent');
    expect(securityEventLabel('some_new_type')).toBe('Some new type');
    expect(securityEventLabel(undefined)).toBe('Security event');
  });

  test('every event type the backend emits has copy (no raw snake_case in the UI)', () => {
    // `recordSecurityEvent` call sites: authDeviceService.js, authNotifyService.js,
    // routes/authDevices.js, routes/users.js. Keep in sync with the native maps.
    const BACKEND_EVENT_TYPES = [
      'login',
      'logout',
      'resume',
      'refresh_reuse',
      'device_mismatch',
      'device_revoked',
      'session_revoked',
      'inactivity_expired',
      'step_up',
      'step_up_key_enrolled',
      'security_prefs_changed',
      'revoke_others',
      'lockdown',
      'password_changed',
      'password_reset',
      'account_deleted',
      'new_device_email_sent',
      'device_removed_email_sent',
      'password_changed_email_sent',
      'security_signout_email_sent',
      'lockdown_email_sent',
    ];
    for (const type of BACKEND_EVENT_TYPES) {
      const label = securityEventLabel(type);
      expect(label).not.toBe('Security event');
      expect(label).not.toContain('_');
      expect(label).not.toBe(type);
    }
  });

  test('isSecurityAlertEvent flags the "we blocked something" types only', () => {
    expect(isSecurityAlertEvent({ type: 'refresh_reuse' })).toBe(true);
    expect(isSecurityAlertEvent({ type: 'device_revoked' })).toBe(true);
    expect(isSecurityAlertEvent({ type: 'session_revoked' })).toBe(true);
    expect(isSecurityAlertEvent({ type: 'lockdown' })).toBe(true);
    expect(isSecurityAlertEvent({ type: 'login' })).toBe(false);
    expect(isSecurityAlertEvent({ type: 'logout' })).toBe(false);
    expect(isSecurityAlertEvent({ type: 'step_up' })).toBe(false);
  });

  test('platformLabel + trustLevelLabel', () => {
    expect(platformLabel('ios')).toBe('iPhone / iPad');
    expect(platformLabel('android')).toBe('Android');
    expect(platformLabel('web')).toBe('Web browser');
    expect(platformLabel(null)).toBe('Unknown device');
    expect(trustLevelLabel('trusted')).toEqual({ label: 'Trusted', tone: 'ok' });
    expect(trustLevelLabel('suspect')).toEqual({ label: 'Needs attention', tone: 'warn' });
    expect(trustLevelLabel('unverified')).toEqual({ label: 'Unverified', tone: 'neutral' });
    expect(trustLevelLabel(undefined)).toEqual({ label: 'Unverified', tone: 'neutral' });
  });

  test('describeUserAgent recognises common browsers/OSes and never throws', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'),
    ).toBe('Chrome on macOS');
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'),
    ).toBe('Edge on Windows');
    expect(
      describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
    ).toBe('Safari on iOS');
    expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe('Firefox on Linux');
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36')).toBe(
      'Chrome on Android',
    );
    expect(describeUserAgent('curl/8.4.0')).toBe('Web browser');
    expect(describeUserAgent(null)).toBe('Web browser');
    expect(describeUserAgent('')).toBe('Web browser');
  });

  test('describeSession prefers the platform for native rows', () => {
    expect(describeSession({ platform: 'ios', userAgent: 'Pantopus/1.4 CFNetwork' })).toBe('iPhone / iPad');
    expect(describeSession({ platform: 'web', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/128.0' })).toBe('Firefox on Windows');
  });

  test('formatRelativeTime buckets and handles bad input', () => {
    const now = new Date('2026-08-18T12:00:00Z');
    expect(formatRelativeTime('2026-08-18T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-08-18T11:55:00Z', now)).toBe('5 min ago');
    expect(formatRelativeTime('2026-08-18T09:00:00Z', now)).toBe('3 h ago');
    expect(formatRelativeTime('2026-08-15T12:00:00Z', now)).toBe('3 d ago');
    expect(formatRelativeTime('2026-07-01T12:00:00Z', now)).toMatch(/2026/);
    expect(formatRelativeTime(Math.floor(now.getTime() / 1000) - 10, now)).toBe('just now'); // unix seconds accepted
    expect(formatRelativeTime(null, now)).toBe('Unknown');
    expect(formatRelativeTime('not a date', now)).toBe('Unknown');
  });

  test('summarizeEventMeta joins the useful bits and ignores the rest', () => {
    expect(summarizeEventMeta({ meta: { deviceName: "Ying's iPhone", ip: '203.0.113.9', reason: 'user' } })).toBe(
      "Ying's iPhone · user · IP 203.0.113.9",
    );
    expect(summarizeEventMeta({ meta: { platform: 'web', revoked: 1 } })).toBe('Web browser · 1 session');
    expect(summarizeEventMeta({ meta: { revoked: 3 } })).toBe('3 sessions');
    expect(summarizeEventMeta({ meta: null })).toBe('');
    expect(summarizeEventMeta({ meta: { unrelated: { nested: true } } })).toBe('');
  });
});

/**
 * Presentation helpers for /app/settings/security (persistent login —
 * "Where you're logged in", security activity). Pure functions, unit-tested.
 */

import type { AuthSecurityEvent, AuthSessionSummary, DeviceTrustLevel } from '@pantopus/api';

// Keys = the complete `AuthSecurityEvent.type` vocabulary the backend writes
// (`authSessionService.recordSecurityEvent` call sites in
// backend/services/authDeviceService.js + authNotifyService.js +
// routes/authDevices.js + routes/users.js). Keep this list in sync with the
// native maps (iOS `DevicesViewModel.eventTitles`, Android
// `DevicesViewModel.EVENT_LABELS`) — a type the server never emits is dead
// copy, and a type with no entry falls back to Sentence case below.
const EVENT_LABELS: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  resume: 'Restored session after reinstall',
  refresh_reuse: 'Session token reuse detected — session revoked',
  device_mismatch: 'Device key mismatch — session revoked',
  device_revoked: 'Device removed',
  session_revoked: 'Session revoked',
  inactivity_expired: 'Session expired after inactivity',
  step_up: 'Identity confirmed for a sensitive action',
  step_up_key_enrolled: 'Biometric confirmation key enrolled on a device',
  security_prefs_changed: 'Security preferences changed',
  revoke_others: 'Signed out of all other devices',
  lockdown: 'Signed out everywhere (lockdown)',
  password_changed: 'Password changed — other devices signed out',
  password_reset: 'Password reset — all devices signed out',
  account_deleted: 'Account deleted',
  new_device_email_sent: 'New-device email sent',
  device_removed_email_sent: 'Device-removed email sent',
  password_changed_email_sent: 'Password-changed email sent',
  security_signout_email_sent: 'Security sign-out email sent',
  lockdown_email_sent: 'Sign-out-everywhere email sent',
};

// "We blocked / ended something" types — same set as the native clients.
const SECURITY_ALERT_TYPES = new Set([
  'refresh_reuse',
  'device_mismatch',
  'device_revoked',
  'session_revoked',
  'lockdown',
  'password_reset',
]);

export function securityEventLabel(type: string | undefined | null): string {
  if (!type) return 'Security event';
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  // Fallback: snake_case → Sentence case
  const words = type.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Security event';
}

export function isSecurityAlertEvent(event: Pick<AuthSecurityEvent, 'type'>): boolean {
  return SECURITY_ALERT_TYPES.has(event.type);
}

export function platformLabel(platform: string | null | undefined): string {
  switch ((platform || '').toLowerCase()) {
    case 'ios':
      return 'iPhone / iPad';
    case 'android':
      return 'Android';
    case 'web':
      return 'Web browser';
    default:
      return platform ? platform : 'Unknown device';
  }
}

export function trustLevelLabel(level: DeviceTrustLevel | string | null | undefined): {
  label: string;
  tone: 'ok' | 'neutral' | 'warn';
} {
  switch (level) {
    case 'trusted':
      return { label: 'Trusted', tone: 'ok' };
    case 'suspect':
      return { label: 'Needs attention', tone: 'warn' };
    case 'unverified':
    default:
      return { label: 'Unverified', tone: 'neutral' };
  }
}

/**
 * Turn a raw User-Agent into "Chrome on macOS"-style copy. Best effort; never
 * throws; returns "Web browser" for empty/unknown strings.
 */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua || typeof ua !== 'string') return 'Web browser';
  const s = ua;

  let browser = '';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Chrome\//.test(s) || /CriOS\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
  else if (/Safari\//.test(s)) browser = 'Safari';

  let os = '';
  if (/iPhone|iPad|iPod/.test(s)) os = /iPad/.test(s) ? 'iPadOS' : 'iOS';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Linux/.test(s)) os = 'Linux';

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return `Browser on ${os}`;
  return 'Web browser';
}

export function describeSession(session: Pick<AuthSessionSummary, 'userAgent' | 'platform'>): string {
  if (session.platform && session.platform !== 'web') return platformLabel(session.platform);
  return describeUserAgent(session.userAgent);
}

/**
 * Compact relative time ("just now", "5 min ago", "3 h ago", "2 d ago",
 * otherwise a short date). `now` is injectable for tests.
 */
export function formatRelativeTime(iso: string | number | null | undefined, now: Date = new Date()): string {
  if (iso === null || iso === undefined || iso === '') return 'Unknown';
  const then = typeof iso === 'number' ? new Date(iso < 1e12 ? iso * 1000 : iso) : new Date(iso);
  const t = then.getTime();
  if (Number.isNaN(t)) return 'Unknown';
  const diffSec = Math.round((now.getTime() - t) / 1000);
  if (diffSec < 45) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days} d ago`;
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Human summary of the `meta` blob on a security event (device name, ip, reason). */
export function summarizeEventMeta(event: Pick<AuthSecurityEvent, 'meta'>): string {
  const meta = event.meta;
  if (!meta || typeof meta !== 'object') return '';
  const parts: string[] = [];
  const m = meta as Record<string, unknown>;
  const name = typeof m.deviceName === 'string' ? m.deviceName : typeof m.name === 'string' ? m.name : '';
  if (name) parts.push(name);
  if (typeof m.platform === 'string' && !name) parts.push(platformLabel(m.platform));
  if (typeof m.reason === 'string' && m.reason) parts.push(m.reason.replace(/[_-]+/g, ' '));
  if (typeof m.ip === 'string' && m.ip) parts.push(`IP ${m.ip}`);
  if (typeof m.revoked === 'number') parts.push(`${m.revoked} session${m.revoked === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

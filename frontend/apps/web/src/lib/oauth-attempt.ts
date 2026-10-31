/**
 * Google and Apple sign-in come back to /auth/callback with the session in the address itself, so the callback
 * must only accept a sign-in this tab started. Otherwise anyone could send a link carrying their own session and
 * sign the visitor into their account, where whatever the visitor then adds (their home, household, documents)
 * lands. Each attempt puts a random check on its callback address (`app_nonce`, as the iOS and Android apps do)
 * and keeps it in this tab's sessionStorage, which another site can neither read nor set. The callback accepts
 * the attempt once, and only with that check.
 */
const OAUTH_ATTEMPT_KEY = 'pantopus:oauth-attempt';
const OAUTH_ATTEMPT_MAX_AGE_MS = 30 * 60_000;

/** Shown when an attempt can't be started because the browser blocks this site's storage. */
export const OAUTH_ATTEMPT_UNAVAILABLE_ERROR =
  'Google and Apple sign-in need this browser to allow site data for Pantopus. Allow it, or sign in with your email.';

/**
 * Start an attempt in this tab: its check, or null when the browser keeps no session storage for this site. Create
 * account passes the friend's invite code from their link, so a Google or Apple sign-up credits them too.
 */
export function beginOAuthAttempt(inviteCode?: string): string | null {
  try {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify({ nonce, at: Date.now(), ...(inviteCode ? { inviteCode } : {}) }));
    return sessionStorage.getItem(OAUTH_ATTEMPT_KEY) ? nonce : null;
  } catch {
    return null;
  }
}

/** The invite code this tab's pending attempt started with, if any. Read it before `takeOAuthAttempt` uses it up. */
export function oauthAttemptInviteCode(): string | undefined {
  try {
    const raw = sessionStorage.getItem(OAUTH_ATTEMPT_KEY);
    const { inviteCode } = (raw ? JSON.parse(raw) : {}) as { inviteCode?: unknown };
    return typeof inviteCode === 'string' && inviteCode ? inviteCode : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True for the callback of this tab's pending attempt, which it then uses up. A callback without the check, with
 * another one, or after the attempt went stale is refused and leaves the pending attempt as it is.
 */
export function takeOAuthAttempt(returned: string | null | undefined): boolean {
  try {
    const raw = sessionStorage.getItem(OAUTH_ATTEMPT_KEY);
    if (!raw || !returned) return false;
    const { nonce, at } = JSON.parse(raw) as { nonce?: unknown; at?: unknown };
    if (typeof nonce !== 'string' || typeof at !== 'number' || Date.now() - at > OAUTH_ATTEMPT_MAX_AGE_MS) return false;
    if (!sameCheck(nonce, returned)) return false;
    sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
    return true;
  } catch {
    return false;
  }
}

function sameCheck(expected: string, returned: string): boolean {
  if (expected.length !== returned.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ returned.charCodeAt(i);
  return diff === 0;
}

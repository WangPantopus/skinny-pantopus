/**
 * The address a person just confirmed, carried from /verify-email to /login in the same tab so that sign-in starts
 * from it. It goes through sessionStorage rather than the URL, which keeps the address out of the history and the
 * referrer. An older hand-off is stale and ignored.
 */
const EMAIL_VERIFIED_HANDOFF_KEY = 'pantopus:email-verified';
const EMAIL_VERIFIED_HANDOFF_MAX_AGE_MS = 600_000;

export function rememberVerifiedEmail(email: string): void {
  if (!email) return;
  try {
    sessionStorage.setItem(EMAIL_VERIFIED_HANDOFF_KEY, JSON.stringify({ email, at: Date.now() }));
  } catch { /* storage disabled */ }
}

/** The confirmed address, once: reading it forgets it. Empty when there is none or it is stale. */
export function takeVerifiedEmail(): string {
  try {
    const raw = sessionStorage.getItem(EMAIL_VERIFIED_HANDOFF_KEY);
    sessionStorage.removeItem(EMAIL_VERIFIED_HANDOFF_KEY);
    if (!raw) return '';
    const { email, at } = JSON.parse(raw) as { email?: unknown; at?: unknown };
    if (typeof email !== 'string' || typeof at !== 'number') return '';
    return Date.now() - at <= EMAIL_VERIFIED_HANDOFF_MAX_AGE_MS ? email : '';
  } catch {
    return '';
  }
}

/**
 * The address a person just confirmed (or just set a new password for), carried from /verify-email or /reset-password
 * to /login in the same tab so that sign-in starts from it. It goes through sessionStorage rather than the URL, which
 * keeps the address out of the history and the referrer. An older hand-off is stale and ignored.
 */
const SIGN_IN_HANDOFF_KEY = 'pantopus:email-verified';
const SIGN_IN_HANDOFF_MAX_AGE_MS = 600_000;

export type SignInHandoffReason = 'email-confirmed' | 'password-updated';

export function rememberSignInHandoff(email: string, reason: SignInHandoffReason): void {
  if (!email) return;
  try {
    sessionStorage.setItem(SIGN_IN_HANDOFF_KEY, JSON.stringify({ email, reason, at: Date.now() }));
  } catch { /* storage disabled */ }
}

/** The address and why it was handed over, once: reading it forgets it. Null when there is none or it is stale. */
export function takeSignInHandoff(): { email: string; reason: SignInHandoffReason } | null {
  try {
    const raw = sessionStorage.getItem(SIGN_IN_HANDOFF_KEY);
    sessionStorage.removeItem(SIGN_IN_HANDOFF_KEY);
    if (!raw) return null;
    const { email, reason, at } = JSON.parse(raw) as { email?: unknown; reason?: unknown; at?: unknown };
    if (typeof email !== 'string' || typeof at !== 'number') return null;
    if (Date.now() - at > SIGN_IN_HANDOFF_MAX_AGE_MS) return null;
    return { email, reason: reason === 'password-updated' ? 'password-updated' : 'email-confirmed' };
  } catch {
    return null;
  }
}

/**
 * The password typed at sign-up, kept in this tab's memory only (never stored; gone on reload), so the tab that
 * signed up signs itself in once the email is confirmed instead of asking for the password again. The confirmation
 * link usually opens in another tab: it tells this one over a same-browser channel, then follows it into the app.
 * The message carries the address only, never the password.
 */
const PENDING_SIGN_IN_MAX_AGE_MS = 30 * 60_000;
const CHANNEL_NAME = 'pantopus:email-confirmed';

let pending: { email: string; password: string; at: number } | null = null;

export function rememberPendingSignIn(email: string, password: string): void {
  pending = { email, password, at: Date.now() };
}

/** The remembered sign-up for this address while it is fresh, or null. */
export function pendingSignInFor(email: string): { email: string; password: string } | null {
  if (!pending || pending.email !== email || Date.now() - pending.at > PENDING_SIGN_IN_MAX_AGE_MS) return null;
  return { email: pending.email, password: pending.password };
}

export function forgetPendingSignIn(): void {
  pending = null;
}

type ChannelMessage = { type: 'confirmed' | 'signed-in'; email: string };

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** On the sign-up tab: `onConfirmed` runs when another tab confirms `email`. Returns the cleanup. */
export function listenForEmailConfirmed(email: string, onConfirmed: () => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    if (event.data?.type === 'confirmed' && event.data.email === email) onConfirmed();
  };
  return () => channel.close();
}

/** On the sign-up tab, once signed in: lets the confirmation tab follow into the app. */
export function announceSignedIn(email: string): void {
  const channel = openChannel();
  channel?.postMessage({ type: 'signed-in', email } satisfies ChannelMessage);
  channel?.close();
}

/**
 * On the confirmation tab: tells a sign-up tab in this browser that `email` is confirmed, and calls `onSignedIn` if
 * that tab answers it signed in. Returns the cleanup.
 */
export function announceEmailConfirmed(email: string, onSignedIn: () => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    if (event.data?.type === 'signed-in' && event.data.email === email) onSignedIn();
  };
  channel.postMessage({ type: 'confirmed', email } satisfies ChannelMessage);
  return () => channel.close();
}

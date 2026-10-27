import type { MailboxApiError } from '@/lib/mailbox-api';

/**
 * What went wrong loading mail, in words a person can act on: offline, can't
 * reach Pantopus, the server's own sentence for "not allowed" or "not found"
 * (only errors that carry the server's stable code are written for people),
 * or server trouble.
 */
export function mailLoadMessage(error: MailboxApiError | null | undefined): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return "You're offline. Check your connection, then try again.";
  if (!error || error.code === 'NETWORK_ERROR') return "Can't reach Pantopus. Check your connection and try again.";
  if (error.serverCode && error.status < 500) return error.message;
  if (error.status === 403) return "You can't open this mail.";
  if (error.status === 404) return "This isn't available right now. Try again later.";
  return 'Pantopus is having trouble loading your mail. Try again in a moment.';
}

import { confirmStore } from '@/components/ui/confirm-store';
import type { MailboxApiError } from '@/lib/mailbox-api';
import { mailLoadMessage } from '../mailLoadMessage';

/** Why it couldn't be taken back: the server's sentence ("The carrier has already picked up your card."), else what went wrong. */
export function takeBackMessage(error: MailboxApiError | null): string {
  if (error?.serverCode && (error.status < 500 || error.serverCode === 'CARD_UNAVAILABLE')) return error.message;
  return mailLoadMessage(error);
}

/**
 * "Take your card back?": asked before a card is taken back, from the card flow (on its way, today's card) and from
 * Sent. Taking back today's card frees the day; an older one doesn't, so it doesn't say so.
 */
export function askTakeBack({ byEmail, sentToday }: { byEmail: boolean; sentToday: boolean }): Promise<boolean> {
  const what = byEmail
    ? 'The link in their email will say you took it back.'
    : 'It won’t go out with the morning mail.';
  return confirmStore.open({
    title: 'Take your card back?',
    description: sentToday ? `${what} You can send a card again today.` : what,
    confirmLabel: 'Take it back',
  });
}

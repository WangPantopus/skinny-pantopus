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
 * Sent. With digital stamps on (`postage`) the card's stamp comes back. Otherwise taking back today's card frees the
 * day; an older one doesn't, so it doesn't say so.
 */
export function askTakeBack({
  byEmail,
  byLink = false,
  sentToday,
  postage = false,
}: {
  byEmail: boolean;
  byLink?: boolean;
  sentToday: boolean;
  postage?: boolean;
}): Promise<boolean> {
  const what = byLink
    ? 'Your link will say you took it back.'
    : byEmail
      ? 'The link in their email will say you took it back.'
      : 'It won’t go out with the morning mail.';
  return confirmStore.open({
    title: 'Take your card back?',
    description: postage ? `${what} Its stamp comes back to you.` : sentToday ? `${what} You can send a card again today.` : what,
    confirmLabel: 'Take it back',
  });
}

'use client';

import { useCallback } from 'react';
import type { MailItemV2 } from '@/types/mailbox';
import { useMailboxDrawers } from '@/lib/mailbox-queries';
import { useMe } from '@/lib/me';

export type Addressee = { name: string; line: string | null };

/**
 * Who a piece is addressed to, as on the envelope: its recipient's name (or
 * yours), and its Home's address line for Home mail (or your own verified
 * address). Also returns the mailbox's time zone for times and day headings.
 */
export default function useMailAddressee() {
  const { data: drawers } = useMailboxDrawers();
  const { data: me } = useMe();
  const meName = me?.name || [me?.firstName, me?.lastName].filter(Boolean).join(' ') || '';
  const homes = drawers?.homes;
  const ownAddress = homes?.find((home) => home.mail_access === 'open')?.address_line ?? null;
  const addressee = useCallback((item: MailItemV2): Addressee => ({
    name: item.recipient_name || meName || 'Resident',
    line: (item.recipient_home_id && homes?.find((home) => home.home_id === item.recipient_home_id)?.address_line) || ownAddress,
  }), [meName, ownAddress, homes]);
  return { addressee, timeZone: drawers?.delivery?.time_zone, homes };
}

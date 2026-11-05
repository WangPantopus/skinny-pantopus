'use client';

// Launch cut #10 (Mailbox): the Mail tab's count, read here for BadgeProvider
// (contexts/BadgeContext.tsx), which loads this file only while Mailbox is on,
// so every page's first scripts leave the Mailbox's queries out while it's hidden.
//
// It shares the Mailbox's drawers request, so opening a piece there lowers it
// at once; a failed read keeps the last count. Mail arrives in one morning
// round plus the odd special delivery, and no socket event announces it, so
// it reads the drawers each minute while the page is visible (and when the
// window regains focus).

import { useEffect } from 'react';
import { getAuthToken } from '@pantopus/api';
import { useMailUnread } from '@/lib/mailbox-queries';

const MAIL_POLL_MS = 60_000;

export default function MailUnreadReader({ onCount }: { onCount: (count: number) => void }) {
  const { data: unreadMail = 0 } = useMailUnread({
    enabled: !!getAuthToken(),
    refetchInterval: MAIL_POLL_MS,
    refetchOnWindowFocus: true,
  });
  useEffect(() => { onCount(unreadMail); }, [onCount, unreadMail]);
  useEffect(() => () => onCount(0), [onCount]);
  return null;
}

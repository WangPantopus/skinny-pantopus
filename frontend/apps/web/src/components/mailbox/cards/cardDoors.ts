'use client';

// ============================================================
// The ways in to a Christmas card (TABCARD, founder 2026-11-13): the Mail
// row's own rule for when cards are open, which every other door follows (the
// Today countdown, Mail's empty-day card, a person's page, a chat's details,
// the sidebar entry and the red envelope on the Mail tab), the dates they go
// by, on this browser's clock, and the card a new account joined for.
// ============================================================

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { HolidayCards } from '@pantopus/api';
import { launchFeatures } from '@/lib/featureFlags';
import { getWaitingHolidayCard } from '@/lib/mailbox-api';
import { useHolidayCards, useMailboxDrawers } from '@/lib/mailbox-queries';
import { deliveryState, sentWaiting } from '../MailboxHero';

/**
 * Today, on this browser's clock. Outside production builds a tester can move the date with
 * localStorage `PANTOPUS_DEBUG_TODAY` = "YYYY-MM-DD" (the time of day stays); a production build never reads it.
 */
export function cardToday(now: Date = new Date()): Date {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(window.localStorage.getItem('PANTOPUS_DEBUG_TODAY') ?? '');
      if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), now.getHours(), now.getMinutes());
    } catch { /* storage off: the real date */ }
  }
  return now;
}

/** The Mail tab wears the red envelope from November 1 to December 25, inclusive (founder, 2026-11-13). */
export function isChristmasMailSeason(now: Date): boolean {
  return now.getMonth() === 10 || (now.getMonth() === 11 && now.getDate() <= 25);
}

/** Whole calendar days from today to December 25 of this year (0 on Christmas Day, negative after it). */
export function daysToChristmas(now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(now.getFullYear(), 11, 25).getTime() - today) / 86_400_000);
}

/**
 * The season's cards while they're open: what shows Mail's "Send a Christmas card" row (Christmas cards and the
 * Mailbox on, and sending open). Null while cards are off, closed or still loading, so every door hides with the row.
 */
export function useOpenCards({ enabled = true, staleTime }: { enabled?: boolean; staleTime?: number } = {}): HolidayCards | null {
  const on = launchFeatures.holidayCards && launchFeatures.mailbox;
  const { data } = useHolidayCards({ enabled: on && enabled, ...(staleTime ? { staleTime } : {}) });
  return on && enabled && data?.open ? data : null;
}

// The app's chrome (the tab and the sidebar) asks less often than the Mail screen does.
const CHROME_STALE_MS = 5 * 60_000;

/** The Mail tab's red envelope shows now: cards are open and it's November 1 to December 25 here. */
export function useChristmasMail(): boolean {
  const cards = useOpenCards({ staleTime: CHROME_STALE_MS });
  return Boolean(cards) && isChristmasMailSeason(cardToday());
}

/** The sidebar's "Send a Christmas card": cards are open. */
export function useCardsOpenInChrome(): boolean {
  return Boolean(useOpenCards({ staleTime: CHROME_STALE_MS }));
}

/**
 * Mail's top card on the personal mailbox becomes the invitation on a day with no mail ("No mail today": no round
 * came today and none is still to come, and nothing of yours waits for the pickup) while cards are open. The season's
 * cards then, else null. The "Send a Christmas card" row hides while it shows (no two doors on one screen).
 */
export function useEmptyDayCard(): HolidayCards | null {
  const cards = useOpenCards();
  const { data: drawers } = useMailboxDrawers();
  if (!cards || !drawers) return null;
  const { waiting, waitingLetters } = sentWaiting(drawers);
  if (waiting + waitingLetters > 0) return null;
  return deliveryState(drawers.delivery)?.kind === 'none' ? cards : null;
}

/** Where the app lands when a sign-in or link isn't headed anywhere in particular (lib/invitation-after-sign-in.ts). */
const DEFAULT_LANDING = '/app/place';

/**
 * Joined for a card (TABCARD 3): the first time the signed-in app loads for an account in this browser, ask once
 * whether a Christmas card is waiting for it (an account from the last 14 days, GET /api/mailbox/cards/waiting) and
 * open that piece, the page a tap on it in Mail opens (a sealed card shows its sealed envelope). Remembered per account
 * in this browser once an answer comes, a card or none; a failed read asks again on the next load. A page opened by a
 * link to somewhere in particular (anything but the default landing) keeps its link, and counts as asked.
 */
export function useWaitingCardLanding(userId: string | null | undefined): void {
  const router = useRouter();
  const askedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || askedFor.current === userId || !(launchFeatures.holidayCards && launchFeatures.mailbox)) return;
    askedFor.current = userId;
    const key = `pantopus_card_waiting_asked:${userId}`;
    const here = () => window.location.pathname + window.location.search;
    try {
      if (window.localStorage.getItem(key)) return;
    } catch {
      return; // Nothing can be remembered here: never land on the card at every load.
    }
    const remember = () => {
      try { window.localStorage.setItem(key, new Date().toISOString()); } catch { /* asked again next load */ }
    };
    if (here() !== DEFAULT_LANDING) {
      remember();
      return;
    }
    getWaitingHolidayCard()
      .then((card) => {
        remember();
        // Someone who has already moved on keeps where they went.
        if (card && here() === DEFAULT_LANDING) router.push(`/app/mailbox/personal/${encodeURIComponent(card.mail_id)}`);
      })
      .catch(() => { /* not an answer: asked again next load */ });
  }, [userId, router]);
}

'use client';

// ============================================================
// The welcome strip under the mantel (Wave 4.1, only while GET /cards says `improved` and carries `welcome`): a new
// account's first opened card, a way to write back and a way to send one. The × puts it away on this device for this
// account; it also goes once `welcome` is absent from the read (they sent a card or wrote back).
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { HolidayCards } from '@pantopus/api';
import { useHolidayCards } from '@/lib/mailbox-queries';
import { useMe } from '@/lib/me';
import { WAX } from './cardArt';

const dismissedKey = (accountId: string) => `pantopus:card-welcome-dismissed:${accountId}`;

function readDismissed(accountId: string): boolean {
  try { return window.localStorage.getItem(dismissedKey(accountId)) === '1'; } catch { return false; }
}

/** "You have 7 free stamps ready…"; no number when the balance couldn't be read; "free" only when none are bought. */
export function welcomeBody(welcome: NonNullable<HolidayCards['welcome']>, paidRemaining: number | null | undefined): string {
  const { stamps } = welcome;
  if (stamps == null) return 'Your cards stay here all season. Send one back whenever you like.';
  const free = (paidRemaining ?? 0) > 0 ? '' : 'free ';
  return `Your cards stay here all season. You have ${stamps} ${free}${stamps === 1 ? 'stamp' : 'stamps'} ready whenever you want to send one back.`;
}

export default function CardWelcomeStrip() {
  const { data } = useHolidayCards();
  const { data: me } = useMe();
  const accountId = me?.id ?? null;
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);
  const welcome = data?.improved ? data.welcome : undefined;
  if (!welcome || !accountId || dismissedNow === accountId || readDismissed(accountId)) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(dismissedKey(accountId), '1'); } catch { /* storage off: gone until the next load */ }
    setDismissedNow(accountId);
  };
  const name = welcome.from_first_name || 'Someone';

  return (
    <section
      aria-labelledby="cardWelcomeTitle"
      data-testid="cardWelcomeStrip"
      className="mx-3 mt-3 rounded-2xl border border-[#e3d8c3] bg-[#fbf6ec] px-4 pb-4 pt-3.5 text-[#111827] [@media(prefers-color-scheme:dark)]:brightness-[0.94]"
    >
      <div className="flex items-start gap-3">
        <h3 id="cardWelcomeTitle" className="min-w-0 flex-1 pt-1 text-[17px] font-semibold leading-6">{name}’s card is on your mantel</h3>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Put this away"
          data-testid="cardWelcomeDismiss"
          className="-mr-1.5 -mt-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[#4e5563] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-[14px] leading-5 text-[#374151]">{welcomeBody(welcome, data?.stamps?.paid_remaining)}</p>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        {welcome.can_write_back ? (
          <Link
            href={`/app/mailbox/personal/${encodeURIComponent(welcome.card_id)}?intent=reply`}
            data-testid="cardWelcomeWriteBack"
            className="flex min-h-11 flex-1 basis-[12rem] items-center justify-center rounded-xl px-4 text-[15px] font-semibold text-[#fff7ed] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2"
            style={{ backgroundColor: WAX }}
          >
            Write back to {name}
          </Link>
        ) : null}
        <Link
          href="/app/mailbox/cards"
          data-testid="cardWelcomeSend"
          className="flex min-h-11 flex-1 basis-[12rem] items-center justify-center rounded-xl border border-[#d6cbb6] bg-[#fffdf8] px-4 text-[15px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
        >
          {/* Once only thank-you cards are open (Wave 5), the server's words. */}
          {data?.thank_you?.only ? data.thank_you.entry : 'Send a Christmas card'}
        </Link>
      </div>
    </section>
  );
}

'use client';

// ============================================================
// Today's Christmas countdown (TABCARD 2a, drawing Today): while cards are open
// and Christmas Day is 1 to 45 days away here, a cream card on Today's loaded
// page asks who is far away this year, and opens the send flow in Mail. The
// paper and red are Mail's "Send a Christmas card" row's.
// ============================================================

import Link from 'next/link';
import { CARD_PAPER, CARD_PAPER_QUIET, CARD_PAPER_TEXT, WAX, WAX_BUTTON, WAX_INK } from './cardArt';
import { cardToday, daysToChristmas, useOpenCards } from './cardDoors';

export default function ChristmasCountdown() {
  const cards = useOpenCards();
  if (!cards) return null;
  const days = daysToChristmas(cardToday());
  if (days < 1 || days > 45) return null;

  return (
    <section aria-label="Christmas" data-testid="today.christmasCountdown" className={`rounded-2xl px-4 pb-4 pt-3.5 ${CARD_PAPER}`}>
      <p className={`text-[11px] font-bold uppercase leading-4 tracking-[0.08em] ${CARD_PAPER_QUIET}`}>CHRISTMAS</p>
      <div className="mt-2 flex items-start gap-3.5">
        <div
          role="img"
          aria-label={`${days} ${days === 1 ? 'day' : 'days'} to Christmas`}
          className={`flex h-[66px] w-[66px] flex-shrink-0 flex-col items-center justify-center rounded-xl ${WAX_INK}`}
          style={{ backgroundColor: WAX }}
        >
          <span aria-hidden className="text-[28px] font-bold leading-8 tabular-nums">{days}</span>
          <span aria-hidden className="text-[12px] font-semibold leading-4">{days === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-6" style={{ color: WAX }}>Who is far away this year?</h2>
          <p className={`mt-1 text-[15px] leading-5 ${CARD_PAPER_TEXT}`}>A card from you will mean more than you think.</p>
        </div>
      </div>
      <Link href="/app/mailbox/cards" data-testid="today.christmasCountdown.send" className={`mt-3.5 ${WAX_BUTTON}`} style={{ backgroundColor: WAX }}>
        Send a Christmas card
      </Link>
    </section>
  );
}

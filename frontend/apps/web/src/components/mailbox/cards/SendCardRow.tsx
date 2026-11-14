'use client';

// ============================================================
// The way in to Christmas cards, at the top of your own mail (Me): "Send a
// Christmas card", or today's card once it's sent (one a day), with when it
// arrives. Nothing shows while cards are off, closed or still loading; every
// other way in to a card follows this row's rule (cardDoors useOpenCards). On
// a day with no mail the top card invites you instead, and this row steps
// aside (TABCARD 2b).
// ============================================================

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { HolidayCards } from '@pantopus/api';
import { CARD_PAPER, CARD_PAPER_HOVER, CARD_PAPER_QUIET, CARD_PAPER_TEXT, cardPicture, shortDay, WAX } from './cardArt';
import { useEmptyDayCard, useOpenCards } from './cardDoors';

const FAN = ['christmas-2026-01', 'christmas-2026-08', 'christmas-2026-15'];

/** With digital stamps on: what's left to send with. */
function stampsLine(stamps: HolidayCards['stamps']): string {
  if (!stamps) return 'Pick a picture and write a note.';
  if (stamps.available === 0) return 'You’re out of stamps. Get a stamp book to send more.';
  if (stamps.free_remaining > 0 && stamps.paid_remaining <= 0) {
    return `Pick a picture and write a note. ${stamps.free_remaining} free ${stamps.free_remaining === 1 ? 'card' : 'cards'} left.`;
  }
  return `Pick a picture and write a note. ${stamps.available} ${stamps.available === 1 ? 'stamp' : 'stamps'} left.`;
}

export default function SendCardRow() {
  const data = useOpenCards();
  const emptyDay = useEmptyDayCard();
  if (!data || emptyDay) return null;
  const today = data.today && data.today.status !== 'withdrawn' ? data.today : null;

  let line = data.postage_enabled ? stampsLine(data.stamps) : 'Pick a picture and write a note. One card a day.';
  if (today) {
    if (today.by_email) line = today.status === 'claimed' ? 'They joined Pantopus and have it.' : 'Waiting for them to open the email.';
    else if (today.status === 'delivered') line = 'In their mailbox now.';
    else if (today.arrival === 'christmas_morning') line = 'Arrives on Christmas morning.';
    else line = `Arrives with their 7 a.m. mail on ${shortDay(today.arrives_on ?? today.arrives_at)}${today.opens_at ? ', sealed until Christmas' : ''}.`;
  }

  return (
    <Link
      href="/app/mailbox/cards"
      className={`mx-3 mt-3 flex items-center gap-3 rounded-xl px-3.5 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] ${CARD_PAPER} ${CARD_PAPER_HOVER}`}
    >
      <span aria-hidden className="relative h-[54px] w-[62px] flex-shrink-0">
        {(today ? [today.design] : FAN).map((design, index, all) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={design}
            src={cardPicture(design, 'thumb')}
            alt=""
            className="absolute top-0 w-[40px] rounded-[2px] shadow-[0_3px_8px_rgba(60,40,10,0.28)]"
            style={{ left: all.length === 1 ? 11 : index * 11, transform: `rotate(${all.length === 1 ? -3 : (index - 1) * 7}deg)` }}
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-5" style={{ color: today ? undefined : WAX }}>
          {today ? `Today’s card · to ${today.to_name || 'them'}` : 'Send a Christmas card'}
        </span>
        <span className={`block text-[13px] leading-[18px] ${CARD_PAPER_TEXT}`}>{line}</span>
      </span>
      <ChevronRight className={`h-5 w-5 flex-shrink-0 ${CARD_PAPER_QUIET}`} aria-hidden />
    </Link>
  );
}

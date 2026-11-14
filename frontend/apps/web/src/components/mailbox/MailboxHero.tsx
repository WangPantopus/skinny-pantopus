'use client';

// ============================================================
// The top of the Mailbox: your mailbox, your verified address and the morning
// delivery (Mail tab drawings: Main, R1-Before, R4-NoMail; contract
// `delivery` and `homes`). Mail comes once a morning, at 7:00 a.m. where the
// mailbox is; time-sensitive pieces arrive at once as Special delivery. While
// a card you sent waits for the pickup, the flag is up and it opens Sent (M1).
// ============================================================

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { HolidayCards } from '@pantopus/api';
import type { MailDelivery, MailboxDrawers, MailboxHome } from '@/types/mailbox';
import { launchFeatures } from '@/lib/featureFlags';
import MailboxIllustration from './MailboxIllustration';
import { CARD_PAPER, CARD_PAPER_QUIET, CARD_PAPER_TEXT, WAX, WAX_BUTTON } from './cards/cardArt';
import { haveWords, STAMP_ART } from './cards/StampBooks';

export type DeliveryState =
  | { kind: 'came'; at: string; count: number; unopened: number }
  | { kind: 'before' }
  | { kind: 'none' };

/** The calendar day of `at` in a time zone, as YYYY-MM-DD. */
function dayIn(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

/**
 * Where today's round stands in the mailbox's own zone: it came (and brought
 * something), it's still to come this morning, or it came empty.
 */
export function deliveryState(delivery: MailDelivery | undefined, now = new Date()): DeliveryState | null {
  if (!delivery) return null;
  const zone = delivery.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dayIn(now, zone);
  if (delivery.last_at && dayIn(new Date(delivery.last_at), zone) === today) {
    return { kind: 'came', at: delivery.last_at, count: delivery.last_count, unopened: delivery.last_unopened };
  }
  if (delivery.next_at && dayIn(new Date(delivery.next_at), zone) === today) return { kind: 'before' };
  return { kind: 'none' };
}

/**
 * What you sent that waits for the 7 a.m. pickup and puts the flag up: cards (Christmas cards on) and letters (letters
 * on), from the drawers reply.
 */
export function sentWaiting(drawers: MailboxDrawers | undefined): { waiting: number; waitingLetters: number } {
  const sentLetters = drawers?.sent?.waiting_letters ?? 0;
  return {
    waiting: launchFeatures.holidayCards ? Math.max(0, (drawers?.sent?.waiting ?? 0) - sentLetters) : 0,
    waitingLetters: launchFeatures.mailExtras ? sentLetters : 0,
  };
}

/** "7:00 a.m." in the mailbox's zone. */
export function deliveryTime(at: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  let text: string;
  try {
    text = new Date(at).toLocaleTimeString('en-US', { ...options, timeZone });
  } catch {
    text = new Date(at).toLocaleTimeString('en-US', options);
  }
  return text.replace(' AM', ' a.m.').replace(' PM', ' p.m.');
}

function piecesLine(count: number, unopened: number): string {
  const pieces = `${count} piece${count === 1 ? '' : 's'}`;
  if (count === 0) return pieces;
  if (unopened === 0) return `${pieces} · all opened`;
  return `${pieces} · ${unopened} unopened`;
}

/** The house number on the mailbox door: the address line's leading number. */
function houseNumber(addressLine: string | undefined): string | null {
  return addressLine?.match(/^\s*(\d+[A-Za-z]?)\b/)?.[1] ?? null;
}

/** What waits for the pickup, by what it is: "1 card waits", "2 letters wait", or "3 pieces wait" for both. */
function waitingLine(cards: number, letters: number): string {
  const count = cards + letters;
  const what = letters === 0 ? 'card' : cards === 0 ? 'letter' : 'piece';
  return `${count} ${what}${count === 1 ? ' waits' : 's wait'} for the 7 a.m. pickup`;
}

export default function MailboxHero({
  delivery,
  homes,
  opening = false,
  waiting = 0,
  waitingLetters = 0,
  invite = null,
}: {
  delivery?: MailDelivery;
  homes?: MailboxHome[];
  /** Today's delivery is being shown for the first time: the door is open. */
  opening?: boolean;
  /** Cards you sent that wait for the 7 a.m. pickup: the flag is up, and the mailbox opens Sent. */
  waiting?: number;
  /** Letters you sent that wait for the pickup too. */
  waitingLetters?: number;
  /** Your own mail (Me) while Christmas cards are open (cardDoors useEmptyDayCard): "No mail today" becomes the invitation. */
  invite?: HolidayCards | null;
}) {
  const state = deliveryState(delivery);
  const home = homes?.find((h) => h.mail_access === 'open');
  const flagUp = waiting + waitingLetters > 0;
  const title = flagUp ? 'Your flag is up'
    : !state ? 'Your mailbox'
      : state.kind === 'came' ? `Today's mail came at ${deliveryTime(state.at, delivery?.time_zone)}`
        : state.kind === 'before' ? 'Your mail comes this morning'
          : 'No mail today';
  const detail = flagUp ? waitingLine(waiting, waitingLetters)
    : !state ? null
      : state.kind === 'came' ? piecesLine(state.count, state.unopened)
        : state.kind === 'before' ? "Usually by 8 a.m. You'll get one notification."
          : 'Next delivery tomorrow morning.';
  const illustration = flagUp ? 'closed' : opening ? 'open-stack' : state?.kind === 'none' ? 'open-empty' : 'closed';
  const box = 'mx-4 mt-1 flex items-center gap-3.5 rounded-[20px] border border-app-border bg-app-surface px-4 py-3.5 shadow-sm md:max-w-xl';

  // A day with no mail while cards are open (TABCARD 2b, drawing MailEmptyDay): the cream invitation, with the stamps
  // left (stamp books on and the count known), the next delivery and the verified address the card shows.
  if (invite && state?.kind === 'none' && !flagUp) {
    const stamps = invite.postage_enabled && invite.stamps ? invite.stamps : null;
    return (
      <section aria-label="Nothing came today" data-testid="mail.emptyDayCard" className={`mx-4 mt-1 rounded-[20px] px-4 pb-3.5 pt-4 shadow-sm md:max-w-xl ${CARD_PAPER}`}>
        <div className="flex items-start gap-3.5">
          <MailboxIllustration state="open-empty" number={houseNumber(home?.address_line)} size={72} />
          <div className="min-w-0 flex-1 pt-1.5">
            <p className="text-[19px] font-bold leading-6" style={{ color: WAX }}>Nothing came today.</p>
            <p className={`mt-1 text-[15px] leading-5 ${CARD_PAPER_TEXT}`}>{"Put something in someone else's mailbox."}</p>
          </div>
        </div>
        {stamps ? (
          <div className="mt-3 flex items-center gap-2.5">
            {stamps.available > 0 ? (
              <span aria-hidden className="flex flex-shrink-0 gap-1.5">
                {STAMP_ART.slice(0, Math.min(3, stamps.available)).map((src, index) => (
                  // eslint-disable-next-line @next/next/no-img-element -- the stamp art is a few small static pictures
                  <img key={src} src={src} alt="" className="h-[30px] w-[24px] drop-shadow-[0_1px_1px_rgba(60,40,10,0.25)]" style={{ transform: `rotate(${(index - 1) * 4}deg)` }} />
                ))}
              </span>
            ) : null}
            <p className="text-[15px] font-semibold leading-5">{stamps.available > 0 ? haveWords(stamps) : 'No stamps left'}</p>
          </div>
        ) : null}
        <Link href="/app/mailbox/cards" data-testid="mail.emptyDayCard.send" className={`mt-3.5 ${WAX_BUTTON}`} style={{ backgroundColor: WAX }}>
          Send a Christmas card
        </Link>
        <p className={`mt-2.5 text-center text-[13px] leading-[18px] ${CARD_PAPER_TEXT}`}>{detail}</p>
        {home ? (
          <p className={`mt-1 flex items-center justify-center gap-1 text-xs font-medium leading-4 ${CARD_PAPER_QUIET}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <span className="truncate">{home.address_line} · verified home</span>
          </p>
        ) : null}
      </section>
    );
  }

  const inside = (
    <>
      <MailboxIllustration state={illustration} number={houseNumber(home?.address_line)} size={72} animate={opening && !flagUp} flagUp={flagUp} />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-base font-semibold leading-[22px] text-app-text">{title}</p>
        {detail ? <p className="text-sm leading-5 text-app-text-secondary">{detail}</p> : null}
        {home ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium leading-4 text-green-700">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <span className="truncate">{home.address_line} · verified home</span>
          </p>
        ) : null}
      </div>
    </>
  );

  // The flag up: the mailbox opens what waits for the carrier, in Sent.
  if (flagUp) {
    return (
      <Link
        href="/app/mailbox/sent"
        data-testid="mailboxHeroFlag"
        aria-label={`${title}. ${detail}. Opens Sent.`}
        className={`${box} transition-colors hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
      >
        {inside}
        <ChevronRight className="h-[18px] w-[18px] flex-shrink-0 text-app-text-muted" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-label="Your mailbox" className={box}>
      {inside}
    </section>
  );
}

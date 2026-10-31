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
import type { MailDelivery, MailboxHome } from '@/types/mailbox';
import MailboxIllustration from './MailboxIllustration';

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

export default function MailboxHero({
  delivery,
  homes,
  opening = false,
  waiting = 0,
}: {
  delivery?: MailDelivery;
  homes?: MailboxHome[];
  /** Today's delivery is being shown for the first time: the door is open. */
  opening?: boolean;
  /** Cards you sent that wait for the 7 a.m. pickup: the flag is up, and the mailbox opens Sent. */
  waiting?: number;
}) {
  const state = deliveryState(delivery);
  const home = homes?.find((h) => h.mail_access === 'open');
  const flagUp = waiting > 0;
  const title = flagUp ? 'Your flag is up'
    : !state ? 'Your mailbox'
      : state.kind === 'came' ? `Today's mail came at ${deliveryTime(state.at, delivery?.time_zone)}`
        : state.kind === 'before' ? 'Your mail comes this morning'
          : 'No mail today';
  const detail = flagUp ? `${waiting === 1 ? '1 card waits' : `${waiting} cards wait`} for the 7 a.m. pickup`
    : !state ? null
      : state.kind === 'came' ? piecesLine(state.count, state.unopened)
        : state.kind === 'before' ? "Usually by 8 a.m. You'll get one notification."
          : 'Next delivery tomorrow morning.';
  const illustration = flagUp ? 'closed' : opening ? 'open-stack' : state?.kind === 'none' ? 'open-empty' : 'closed';
  const box = 'mx-4 mt-1 flex items-center gap-3.5 rounded-[20px] border border-app-border bg-app-surface px-4 py-3.5 shadow-sm md:max-w-xl';

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

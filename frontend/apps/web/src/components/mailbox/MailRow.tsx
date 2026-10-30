'use client';

// ============================================================
// One piece in a Mailbox list: the paper drawing with a line under it saying
// when it came, whether it's opened, and when it's due (Mail tab drawings,
// Main board). The row reads as one sentence to screen readers.
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import type { MailItemV2 } from '@/types/mailbox';
import { parseDisplayDate } from '@pantopus/ui-utils';
import MailPiece, { pieceFade, pieceKind, pieceSentence } from './MailPiece';
import { isMailRead } from './MailItemCard';

/** The calendar day of `at` in a time zone, as YYYY-MM-DD. */
export function calendarDay(at: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/** When the piece went into the box (servers before the morning round: when it was made). */
export function deliveredAt(item: Pick<MailItemV2, 'delivered_at' | 'created_at'>): Date {
  return new Date(item.delivered_at || item.created_at);
}

/** The day heading a piece sits under: Today, Yesterday, Earlier this week, Earlier. */
export function deliveryDayLabel(item: Pick<MailItemV2, 'delivered_at' | 'created_at'>, timeZone?: string, now = new Date()): string {
  const days = daysBetween(calendarDay(now, timeZone), calendarDay(deliveredAt(item), timeZone));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  return 'Earlier';
}

function whenLine(item: MailItemV2, timeZone?: string, now = new Date()): string {
  const at = deliveredAt(item);
  if (Number.isNaN(at.getTime())) return '';
  const days = daysBetween(calendarDay(now, timeZone), calendarDay(at, timeZone));
  try {
    if (days <= 0) {
      return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).replace(' AM', ' a.m.').replace(' PM', ' p.m.');
    }
    if (days < 7) return at.toLocaleDateString('en-US', { weekday: 'short', timeZone });
    return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
  } catch {
    return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function dueLine(item: MailItemV2, timeZone?: string): { text: string; overdue: boolean } | null {
  // Filed or paid mail is done with: no due date on it.
  if (!item.due_date || item.lifecycle === 'filed' || item.invoice?.status === 'paid') return null;
  const due = parseDisplayDate(item.due_date);
  if (Number.isNaN(due.getTime())) return null;
  const day = due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const overdue = item.due_date.slice(0, 10) < calendarDay(new Date(), timeZone);
  return overdue ? { text: `Overdue since ${day}`, overdue } : { text: `Due ${day}`, overdue };
}

/** The words on the line under a piece: when it came, then what it is and what's been done with it. */
export function pieceLineBits(item: MailItemV2, when: string, read: boolean): string[] {
  const kind = pieceKind(item);
  return (item.card ? [
    when,
    'Christmas card',
    item.card.sealed ? 'Opens Christmas morning' : read ? 'Opened' : null,
  ] : [
    when,
    kind === 'postcard' ? 'Postcard' : kind === 'booklet' ? 'Booklet' : read && kind !== 'parcel' ? 'Opened' : null,
    item.on_counter ? 'On the Counter' : null,
  ]).filter(Boolean) as string[];
}

/** The line under a piece, as the Mailbox prints it (the row reads it out in its own sentence). */
export function PieceLine({ bits, children }: { bits: string[]; children?: ReactNode }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 px-0.5 text-xs leading-4 text-app-text-muted" aria-hidden="true">
      {bits.map((bit, index) => (
        <span key={bit} className="flex items-center gap-1.5">
          {index > 0 ? <span>·</span> : null}
          <span>{bit}</span>
        </span>
      ))}
      {children}
    </span>
  );
}

export type MailRowProps = {
  item: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  /** The mailbox's time zone, for "7:00 a.m." and the day headings. */
  timeZone?: string;
  selected?: boolean;
  onOpen: () => void;
  /** Bundles: the row opens the bundle instead of a letter. */
  expanded?: boolean;
  /** The delivery moment: this piece slides out of the box after the given delay. */
  slideInDelayMs?: number;
};

export default function MailRow({ item, recipientName, recipientLine, timeZone, selected = false, onOpen, expanded, slideInDelayMs }: MailRowProps) {
  const read = isMailRead(item);
  const kind = pieceKind(item);
  const when = whenLine(item, timeZone);
  const due = dueLine(item, timeZone);
  const bits = pieceLineBits(item, when, read);
  const sentence = [pieceSentence(item, read), when ? `Came ${when}` : null, due?.text, item.on_counter ? 'On the Counter' : null]
    .filter(Boolean).join('. ').replace(/\.\./g, '.');
  const style: CSSProperties | undefined = slideInDelayMs != null ? { animationDelay: `${slideInDelayMs}ms` } : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={sentence}
      aria-current={selected ? 'true' : undefined}
      aria-expanded={kind === 'bundle' ? !!expanded : undefined}
      className={`block w-full rounded-lg p-1 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        selected ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-app-bg' : ''
      } ${slideInDelayMs != null ? 'animate-mail-slide-out' : ''}`}
      style={style}
    >
      <MailPiece item={item} recipientName={recipientName} recipientLine={recipientLine} opened={read} fade={pieceFade(item, read)} />
      <PieceLine bits={bits}>
        {due ? (
          <span className="flex items-center gap-1.5">
            {bits.length > 0 ? <span>·</span> : null}
            <span className={`font-semibold ${due.overdue ? 'text-red-700' : 'text-amber-700'}`}>{due.text}</span>
          </span>
        ) : null}
        {kind === 'bundle' ? (
          <span className="flex items-center gap-1.5">
            <span>·</span>
            <span className="font-medium text-primary-600">{expanded ? 'Hide the pieces' : 'Show the pieces'}</span>
          </span>
        ) : null}
      </PieceLine>
    </button>
  );
}

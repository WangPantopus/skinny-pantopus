// ============================================================
// Sent's words (Mail drawings M2–M5, contract "Sent"): where a card you sent
// is now, how it reached them and its trail, said the same way in the list
// and on the card's own page. Never whether it was opened.
// ============================================================

import type { SentPiece, SentTrailStep } from '@pantopus/api';
import type { MailItemV2 } from '@/types/mailbox';
import { calendarDay } from '../MailRow';
import { shortDay } from '../cards/cardArt';

/** The first word of their name ("Maya" of "Maya O."). */
export function firstName(name: string | null | undefined): string {
  const text = (name || '').trim();
  return text.split(/\s+/)[0] || text;
}

/** "To Maya O. · Christmas card", or by email "To d***@example.com · by email". */
export function sentToLine(piece: SentPiece): string {
  return `To ${piece.to_name || 'them'} · ${piece.by_email ? 'by email' : 'Christmas card'}`;
}

/** Where it is now, in a line. Their 7 a.m. mail comes by their clock, so only their day is said. */
export function sentStatusLine(piece: SentPiece): string {
  const day = shortDay(piece.arrives_on ?? piece.arrives_at);
  switch (piece.status) {
    case 'waiting':
      if (piece.arrival === 'christmas_morning') return 'Arrives on Christmas morning';
      return `Arrives with their 7 a.m. mail on ${day}${piece.sealed ? ', sealed until Christmas' : ''}`;
    case 'picked_up':
      return 'Arrives on Christmas morning';
    case 'delivered':
      return piece.sealed ? 'In their mailbox, sealed until Christmas' : `In their mailbox since ${day}`;
    case 'email_waiting':
      return 'Waiting for them to open the email';
    case 'claimed':
      return 'They joined Pantopus and have it';
    case 'expired':
      return 'They didn’t open the email in 90 days';
    default:
      return '';
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
}

/** The day heading a card sits under, by when it was sent on your own clock: Today, Yesterday, Monday, Wednesday, December 2. */
export function sentDayLabel(sentAt: string, timeZone?: string, now = new Date()): string {
  const at = new Date(sentAt);
  if (Number.isNaN(at.getTime())) return 'Earlier';
  const days = daysBetween(calendarDay(now, timeZone), calendarDay(at, timeZone));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const options: Intl.DateTimeFormatOptions = days < 7 ? { weekday: 'long' } : { weekday: 'long', month: 'long', day: 'numeric' };
  try {
    return at.toLocaleDateString('en-US', { ...options, timeZone });
  } catch {
    return at.toLocaleDateString('en-US', options);
  }
}

/**
 * The envelope as it reached them, for the Mailbox's own drawing: the name on its card, the stamp it got (picked by
 * the card's id, as theirs), and a postmark only once the carrier has it. Never torn or opened.
 */
export function sentEnvelope(piece: SentPiece): MailItemV2 {
  return {
    id: piece.id,
    kind: 'letter',
    mail_object_type: 'envelope',
    sender_display: piece.envelope.from,
    sender_trust: 'pantopus_user',
    sender_business_name: null,
    postmark: piece.envelope.postmarked_on ? { town: null, date: piece.envelope.postmarked_on } : null,
    card: {
      design: piece.card.design ?? '',
      number: piece.card.number,
      caption: piece.card.caption,
      paper: piece.card.paper ?? '#f7eee0',
      holiday: 'christmas',
      year: piece.card.year ?? new Date(piece.sent_at).getFullYear(),
      arrival: piece.arrival,
      sealed_until: null,
      sealed: piece.sealed,
    },
  } as unknown as MailItemV2;
}

/** A step of its trail in words; one not reached yet adds "· not yet". */
export function trailLabel(step: SentTrailStep, piece: SentPiece): string {
  const first = firstName(piece.to_name) || 'them';
  let label: string;
  switch (step.step) {
    case 'sealed': label = 'Sealed by you'; break;
    case 'emailed': label = `Emailed to ${piece.status === 'claimed' ? 'them' : piece.to_name || 'them'}`; break;
    case 'picked_up': label = 'Picked up by the carrier'; break;
    case 'delivered':
      label = piece.arrival === 'christmas_morning' ? `Delivered with ${first}’s Christmas morning mail` : `Delivered with ${first}’s 7 a.m. mail`;
      break;
    case 'opens': label = 'Opens on Christmas morning'; break;
    case 'joined': label = step.done ? 'They joined Pantopus and have it' : 'They join Pantopus and have it'; break;
    case 'returned': label = 'They didn’t open the email in 90 days'; break;
    default: label = '';
  }
  return step.done ? label : `${label} · not yet`;
}

/** "WED DEC 9 · 6:12 PM" for a moment (your clock), "THU DEC 10" for a day (theirs). */
export function trailWhen(step: SentTrailStep): string | null {
  if (step.at) {
    const at = new Date(step.at);
    if (Number.isNaN(at.getTime())) return null;
    const day = at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
    return `${day} · ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`.toUpperCase();
  }
  if (step.on) return shortDay(step.on).replace(',', '').toUpperCase();
  return null;
}

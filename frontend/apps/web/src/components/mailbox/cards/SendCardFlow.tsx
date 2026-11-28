'use client';

// ============================================================
// Send a Christmas card (holiday_cards; Draft 1's flow around the founder's
// pictures): who it's for → pick a card → write on the back → seal it for the
// day → look it over (exactly what they will get) and seal and send. One card
// a day: once it's sent, this page shows today's card, which can be taken
// back until the 7 a.m. pickup (by email or link: until they open it). With
// launch key card_table it can also go as a link anyone can open. With
// digital stamps on, one card can go to a list of people and addresses
// (`max_recipients`), each getting a card of their own.
// ============================================================

import { PostageLine, StampChip, StampSheet, useStamps, type Stamps } from './StampBooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mailbox } from '@pantopus/api';
import type { CardFrame, CardMediaRef, CardSignature, HolidayCardArrival, HolidayCardCollection, HolidayCardDesign, HolidayCardList, HolidayCardListLine, HolidayCardListPreview, HolidayCardListResult, HolidayCardPreview, HolidayCards, SentHolidayCard } from '@pantopus/api';
import { ChevronLeft, Check, Image as ImageIcon, Link2, Loader2, Mail, Search, Send, X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import type { MailboxApiError } from '@/lib/mailbox-api';
import { useCardArrivals, useCardRecipients, useForgetCardSignature, useHolidayCards, usePreviewHolidayCard, usePreviewHolidayCardList, useSaveCardSignature, useSendHolidayCard, useSendHolidayCardList, useTakeBackHolidayCard } from '@/lib/mailbox-queries';
import { useMe, useOwnLocalProfile } from '@/lib/me';
import ErrorState from '@/components/ui/ErrorState';
import { launchFeatures } from '@/lib/featureFlags';
import MailPiece from '../MailPiece';
import { mailLoadMessage } from '../mailLoadMessage';
import CardFront from './CardFront';
import CardBack, { writingStyle } from './CardBack';
import { useNoteFit, useNoteLeaves } from './CardPaper';
import { SignaturePad, sameSignature } from './cardSignature';
import CardPrint, { useCardMediaUrl } from './CardPrint';
import PhotoCardStudio, { type PhotoCardMade } from './PhotoCardStudio';
import { PhotoFrontContext, type PhotoFront } from './PhotoCardFront';
import { CardStripContext } from './cardKind';
import { canRecordGreeting, GreetingObject, greetingLength, recordingClock, useGreetingPlayer, useGreetingRecorder } from './CardGreeting';
import { ON_CLOTH_BUTTON, ON_CLOTH_MUTED, Slip, StepsAtTable } from './AtTheTable';
import CardFlip from './CardFlip';
import { CardNoteHelpPanel, CardNoteHelpRow, useCardNoteHelp } from './CardNoteHelp';
import CardLinkActions from './CardLinkActions';
import LookItOver from './LookItOver';
import CardTable, { type SendMoment, type TableCard } from './CardTable';
import CardShareSheet from './CardShareSheet';
import CardRack from './CardRack';
import { CardShelves, CollectionPage, scrollerOf, shelvesBarClass, shelvesOf, type Shelf } from './CardShelves';
import { askTakeBack } from './takeBack';
import { chosenPersonFor } from './sendOneBack';
import { clearCardDraft, readCardDraft, saveCardDraft } from './cardDraft';
import TownSheet from './TownSheet';
import travelStyles from './CardTravel.module.css';
import { cardMood, cardPicture, clockTime, emailGoesAt, firstNameOf, SERIF, shortDay, tableTint, WAX, WAX_BUTTON } from './cardArt';

type Step = 'to' | 'pick' | 'write' | 'seal' | 'look' | 'sent';
/** Someone on a list (digital stamps on): a person found by name, or an address. */
type ListEntry = { kind: 'person'; userId: string; name: string } | { kind: 'email'; email: string };
/** By link, `name` (only while `improved`, Wave 3.2): the name written on its envelope, if any. */
export type Recipient = ListEntry | { kind: 'link'; name?: string }
  /** Two or more people or addresses: a card each (POST /cards/batch). */
  | { kind: 'list'; entries: ListEntry[] };

const STEPS: Step[] = ['to', 'pick', 'write', 'seal', 'look'];
/** Pick a card first (Wave 3.1, only while GET /cards says `improved`). */
const STEPS_PICK_FIRST: Step[] = ['pick', 'to', 'write', 'seal', 'look'];
const TITLES: Record<Step, string> = {
  to: 'Who it’s for',
  pick: 'Pick a card',
  write: 'Write on the back',
  seal: 'Seal it for the day',
  look: 'Look it over',
  sent: 'On its way',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The whole screen is the cream desk the card sits on (the Mailbox frame scrolls it on wider screens).
const page = 'min-h-[calc(100dvh-8rem)] bg-[#f5f0e8] text-[#111827] md:h-full md:min-h-0 md:overflow-y-auto [@media(prefers-color-scheme:dark)]:bg-app [@media(prefers-color-scheme:dark)]:text-app-text';
const primary = WAX_BUTTON;
const secondary = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d6cbb6] bg-[#fffdf8] text-[15px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50';
const muted = 'text-[#4e5563] [@media(prefers-color-scheme:dark)]:text-app-text-secondary';
// "Look it over" pinned under "Seal and send" on Seal it for the day (design check of November 17, Fix 2): a quiet
// button, not a second filled bar, on the page and on the cloth.
const LOOK_QUIET = 'mx-auto flex min-h-11 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-[#374151] underline decoration-[#374151]/35 underline-offset-4 transition hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50';
// On the cloth its words carry a soft dark shadow: at rest on a small phone what lies behind the fade shows through.
const LOOK_QUIET_ON_CLOTH = 'mx-auto flex min-h-11 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-[#f6ecd9] underline decoration-[#f6ecd9]/35 underline-offset-4 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f] disabled:opacity-50';
/** The soft fade under a pinned button (5.2): clear at its top, nearly the colour under it at the bottom. */
// On the cloth, `shade` darkens the tint toward the vignette's darker edge, so the fade meets the cloth it lies on.
const tintOf = (rgb: string, shade = 1) =>
  rgb.match(/\d+/g)?.slice(0, 3).map((c) => Math.round(Number(c) * shade)).join(', ') ?? '245, 240, 232';
const fadeOf = (rgb: string, shade = 1) => {
  const parts = tintOf(rgb, shade);
  return `linear-gradient(to bottom, rgba(${parts}, 0) 0, rgba(${parts}, 0.78) 12px, rgba(${parts}, 0.9) 100%)`;
};
const PAGE_FADE = fadeOf('rgb(245, 240, 232)');
const PAGE_TINT = tintOf('rgb(245, 240, 232)');

/**
 * Quick seal (Wave 3.5): set on this device once a card was sealed on the table here; until then the table shows only
 * the full sealing. Storage blocked reads as never sealed.
 */
const SEALED_ONCE = 'pantopus:card-sealed-once';
const sealedOnceHere = () => { try { return window.localStorage.getItem(SEALED_ONCE) === '1'; } catch { return false; } };
const markSealedOnce = () => { try { window.localStorage.setItem(SEALED_ONCE, '1'); } catch { /* storage blocked */ } };

/** Step 4 when the server can't show the look; "Seal and send" is then on step 4. */
const LOOK_UNAVAILABLE = 'Pantopus can’t show how your card will look yet. You can still seal and send it.';

/**
 * The server can't show the look: it has no Look it over yet (a 404 without the server's code, as a server from before
 * it answers). Sending still works there.
 */
/** A card's own photo and voice go with a bought stamp once the free allowance (default 2) is used. */
type MediaStamp = 'ready' | 'buy' | 'unavailable';
const MEDIA_NEEDS_STAMP = 'Free stamps send your card and note. A photo or voice greeting needs a bought stamp.';
function mediaNeedsStampText(freeAllowance?: { limit: number; remaining: number } | null): string {
  if (freeAllowance && freeAllowance.limit > 0 && freeAllowance.remaining === 0) {
    return `You’ve used your ${freeAllowance.limit} free photo or voice cards. Adding more uses a bought stamp.`;
  }
  return MEDIA_NEEDS_STAMP;
}
function freeMediaHintText(
  freeAllowance: { limit: number; remaining: number } | null | undefined,
  paidRemaining: number,
  listCount: number,
): string | null {
  if (!freeAllowance || freeAllowance.limit <= 0 || freeAllowance.remaining <= 0 || paidRemaining > 0) return null;
  if (listCount > freeAllowance.remaining) {
    const paid = listCount - freeAllowance.remaining;
    return `You have ${freeAllowance.remaining} free photo or voice ${freeAllowance.remaining === 1 ? 'card' : 'cards'} left. This list of ${listCount} will need ${paid} bought ${paid === 1 ? 'stamp' : 'stamps'}.`;
  }
  if (freeAllowance.remaining === freeAllowance.limit) {
    return `Your first ${freeAllowance.limit} cards with a photo or voice greeting are free.`;
  }
  return `${freeAllowance.remaining} free photo or voice ${freeAllowance.remaining === 1 ? 'card' : 'cards'} left — after that, they use a bought stamp.`;
}

/**
 * Where a card's own photo and voice stand: the server's word when the cards loaded, followed by the live stamp balance
 * (refreshed when the page comes back from checkout), so buying a book makes them work without leaving the step. Null:
 * an older server that doesn't ask for a bought stamp.
 */
function mediaStampOf(server: { required?: boolean; state: MediaStamp } | null | undefined,
  live: { paid_remaining: number; sales_open?: boolean } | null | undefined, improved = false): MediaStamp | null {
  if (!server || (improved && server.required === false)) return null;
  if (!live) return server.state;
  if (live.paid_remaining >= 1) return 'ready';
  return live.sales_open === false ? 'unavailable' : 'buy';
}

/** Vercel's proxy in front of the API (pantopus.com/api) refuses a body over 4.5 MB, short of the server's 10 MiB. */
const PROXY_SAFE_BYTES = 4_000_000;

/**
 * The photo as the web sends it: as chosen when it fits through the proxy, else redrawn as the card keeps it (a JPEG at
 * most `longSide` px, its EXIF left behind on the canvas). As chosen when this browser can't decode it (HEIC outside
 * Safari), so the server's or the proxy's answer still shows.
 */
async function cardPhotoToSend(file: File, longSide: number): Promise<Blob> {
  if (file.size <= PROXY_SAFE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return file; }
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))) ?? file;
  } catch {
    return file;
  }
}

/**
 * Why a photo or greeting didn't upload: the server's own sentence, else plain words. A proxy's refusal carries no
 * sentence (Vercel's 413 has `error: { code, message }`), and an object here would crash the page when drawn.
 */
function cardUploadFailure(error: unknown, kind: 'photo' | 'voice'): string {
  const { data, statusCode } = (error ?? {}) as { data?: { error?: unknown }; statusCode?: number };
  if (typeof data?.error === 'string' && data.error) return data.error;
  if (statusCode === 413) {
    return kind === 'photo' ? 'This photo is too large. Choose a smaller copy.' : 'This recording is too large. Record a shorter greeting.';
  }
  return kind === 'photo' ? 'The photo didn’t upload. Check your connection.' : 'The greeting didn’t upload. Check your connection.';
}

function lookIsUnavailable(error: MailboxApiError | null): boolean {
  return error?.status === 404 && !error.serverCode;
}

/** The server's own sentence when it sent one (a card that can't go yet, a limit), else what went wrong. */
export function sendMessage(error: MailboxApiError | null, byEmail = false): string {
  if (error?.serverCode && error.status < 500) return error.message;
  if (error?.serverCode === 'CARD_UNAVAILABLE') return error.message;
  // The server's own check of the address, stricter than ours (it knows which endings an address can have).
  if (byEmail && error?.status === 400) return 'That email address doesn’t look right. Go back to “Who it’s for” and check it.';
  return mailLoadMessage(error);
}

const letters = (text: string) => [...text].length;

type ContactsManager = { select: (properties: string[], options?: { multiple?: boolean }) => Promise<{ email?: string[] }[]> };

/** The browser's contact picker (Chrome on Android today), or null where there's none. */
function contactPicker(): ContactsManager | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined' || !('ContactsManager' in window)) return null;
  return (navigator as Navigator & { contacts?: ContactsManager }).contacts ?? null;
}

/** One address the person picks from their contacts, or null if they back out. Nothing is read or kept beyond it. */
async function pickContactEmail(): Promise<string | null> {
  try {
    const [contact] = (await contactPicker()?.select(['email'], { multiple: false })) ?? [];
    return contact?.email?.find((address) => address.includes('@'))?.trim() || null;
  } catch {
    return null;
  }
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

const entryKey = (entry: ListEntry) => (entry.kind === 'person' ? `person:${entry.userId}` : `email:${entry.email.trim().toLowerCase()}`);
const entryName = (entry: ListEntry) => (entry.kind === 'person' ? entry.name : entry.email);

/** "Maya and Theo", "Maya, Theo and 2 others". */
function listNames(entries: ListEntry[]): string {
  const names = entries.map(entryName);
  if (names.length <= 2) return names.join(' and ');
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/** Who "Help me write it" writes to: first names for people found by name, and how many the card goes to in all. */
function noteHelpFor(to: Recipient): { names: string[]; count: number } {
  if (to.kind === 'person') return { names: [firstName(to.name)], count: 1 };
  if (to.kind === 'list') {
    return { names: to.entries.flatMap((entry) => (entry.kind === 'person' ? [firstName(entry.name)] : [])), count: to.entries.length };
  }
  return { names: [], count: 1 };
}

function toName(to: Recipient | null): string {
  if (!to) return '';
  if (to.kind === 'link') return 'whoever opens your link';
  if (to.kind === 'list') return listNames(to.entries);
  return entryName(to);
}

/** The name on the envelope: a card by link has none until someone opens it; a list's first card shows. */
function envelopeName(to: Recipient): string {
  if (to.kind === 'list') return entryName(to.entries[0]);
  return to.kind === 'link' ? to.name || 'Their name' : toName(to);
}

/**
 * How a sent card arrives, in a sentence. `improved`: GET /cards says the card improvements of November 28 are on
 * (a link or an email opens before signing up); without it, the words from before them.
 */
export function arrivalLine(card: SentHolidayCard, improved = false): string {
  const who = card.to_name || 'They';
  if (card.status === 'withdrawn') return 'You took this card back.';
  if (card.by_link) {
    if (card.status === 'claimed') return `${who} opened your link and has your card.`;
    if (card.status === 'expired') return 'Nobody opened your link in 90 days.';
    if (!improved) {
      return card.arrival === 'sealed_christmas'
        ? 'It waits for someone to open your link and join. Then it’s in their mailbox and opens on Christmas morning.'
        : 'It waits for someone to open your link and join.';
    }
    return card.arrival === 'sealed_christmas'
      ? 'Ready to share. It stays sealed until Christmas morning, and anyone with your link can save it to their mailbox.'
      : 'Ready to share. Anyone with your link can open and read it right away, and save it to keep it.';
  }
  if (card.by_email && !improved) {
    if (card.status === 'claimed') return `${who} joined Pantopus and has your card.`;
    if (card.email_send_at) return `We’ll email them ${emailGoesAt(card.email_send_at)}, your time. Once they join with that address, it waits in their mailbox.`;
    return card.arrival === 'sealed_christmas'
      ? 'We emailed them. Once they join with that address, it waits in their mailbox and opens on Christmas morning.'
      : 'We emailed them. It waits for them to join with that address and open it.';
  }
  if (card.by_email) {
    if (card.status === 'claimed') return `${who} saved your card to their Pantopus mailbox.`;
    // Set for your 7 a.m. or Christmas morning: nothing is emailed before then.
    if (card.email_send_at) return `We’ll email them ${emailGoesAt(card.email_send_at)}, your time. They can open and read it right in their browser.`;
    return card.arrival === 'sealed_christmas'
      ? 'We emailed them. It stays sealed until Christmas morning, when we’ll send a reminder to open it.'
      : 'We emailed them. They can open and read it right in their browser, and join free to keep it or write back.';
  }
  // Their mail comes at 7 a.m. where they live, whatever the clock says here: the day by their clock.
  const day = shortDay(card.arrives_on ?? card.arrives_at);
  if (card.status === 'delivered') {
    return card.opens_at ? `It’s in ${who}’s mailbox, sealed until Christmas morning.` : `It’s in ${who}’s mailbox.`;
  }
  if (card.arrival === 'christmas_morning') return `${who} gets it on Christmas morning with their 7 a.m. mail.`;
  if (card.arrival === 'sealed_christmas') return `It comes with their 7 a.m. mail on ${day}, sealed until Christmas morning.`;
  return `${who} gets it with their 7 a.m. mail on ${day}.`;
}

/** Before it's sent we don't know their clock; the sent card says the time on this one. */
function takeBackBefore(to: Recipient, arrival: HolidayCardArrival | null = null): string {
  // Right away to a person (Wave 3.3, offered only while `improved`): it's in their mailbox the moment it's sealed.
  if (to.kind === 'person' && arrival === 'now') return 'This card delivers right away, so it can’t be taken back after you seal it.';
  if (to.kind === 'list') {
    const people = to.entries.some((entry) => entry.kind === 'person');
    const emails = to.entries.some((entry) => entry.kind === 'email');
    if (people && emails) return 'You can take each card back until the carrier picks it up at 7 a.m. their time, or by email until they open it.';
    return people ? 'You can take each card back until the carrier picks it up at 7 a.m. their time.' : 'You can take each card back until they open it.';
  }
  if (to.kind === 'link') return 'You can take it back until someone opens it.';
  return to.kind === 'email'
    ? 'You can take it back until they open it.'
    : 'You can take it back until the carrier picks it up at 7 a.m. their time.';
}

/** The last button. */
function sendWords(to: Recipient): string {
  return to.kind === 'link' ? 'Seal it and get the link' : 'Seal and send';
}

export function takeBackLine(card: SentHolidayCard): string | null {
  if (!card.can_take_back) return null;
  if (card.by_link) return 'You can take it back until someone opens it.';
  if (card.by_email) return 'You can take it back until they open it.';
  return `You can take it back until ${clockTime(card.take_back_until)} ${shortDay(card.take_back_until)}, when the carrier picks it up.`;
}

// ── Header ───────────────────────────────────────────────────

// After sending a card that travels (travelling card Part 2).
const TRAVEL_SENT_LINE = 'It can travel. You’ll hear when it reaches a town.';

function StepHeader({ step, title, onBack, headingRef, trailing = null, steps = STEPS }: { step: Step; title?: string; onBack: () => void; headingRef: RefObject<HTMLHeadingElement | null>; trailing?: ReactNode; steps?: Step[] }) {
  const index = steps.indexOf(step);
  return (
    <header className="flex items-center gap-1 px-1 pt-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-full text-[#1f2937] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] [@media(prefers-color-scheme:dark)]:text-app-text"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      <h1 ref={headingRef} tabIndex={-1} className="flex-1 text-[18px] font-semibold leading-6 focus:outline-none">{title ?? TITLES[step]}</h1>
      {trailing}
      {index >= 0 ? (
        <div role="img" aria-label={`Step ${index + 1} of ${steps.length}`} className="flex gap-[5px] pr-3.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className="h-[7px] rounded-full"
              style={{ width: i === index ? 20 : 7, backgroundColor: i <= index ? WAX : '#d6cbb6' }}
            />
          ))}
        </div>
      ) : null}
    </header>
  );
}

// ── Step 1: who it's for ─────────────────────────────────────

/** A name for a link's envelope (Wave 3.2): runs of whitespace folded, trimmed, at most 40 characters. */
const LINK_NAME_MAX = 40;
const linkEnvelopeName = (typed: string) => [...typed.replace(/\s+/g, ' ').trim()].slice(0, LINK_NAME_MAX).join('').trim();

/** Pick a card first (Wave 3.1): on Who it's for, the card just chosen, small, with its caption and "Change". */
function ChosenCardLine({ design, onChange, picture = null, caption = null }: {
  design: HolidayCardDesign; onChange: () => void;
  /** A photo card (Wave 4.2): its photo and front caption in place of the stock picture's. */
  picture?: string | null; caption?: string | null;
}) {
  return (
    <div data-testid="sendCardChosenCard" className="mx-4 mt-2 flex min-h-[52px] items-center gap-3 rounded-xl border border-[#e3d8c3] bg-[#fffdf8] py-1.5 pl-3 pr-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={picture ?? cardPicture(design.id, 'thumb')} alt="" className="h-10 w-8 flex-shrink-0 -rotate-2 rounded-[2px] object-cover shadow-[0_3px_8px_rgba(60,40,10,0.25)]" />
      <p className="min-w-0 flex-1 truncate text-[14px] font-medium leading-[18px] text-[#374151]">{caption ?? design.caption}</p>
      <button
        type="button"
        data-testid="sendCardChangeCard"
        onClick={onChange}
        aria-label={`Change the card (${caption ?? design.caption})`}
        className="flex min-h-[44px] flex-shrink-0 items-center rounded-lg px-2.5 text-[14px] font-semibold text-[#8b1d1d] underline underline-offset-4 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
      >
        Change
      </button>
    </div>
  );
}

export function ToStep({
  onChoose,
  max = 1,
  listed = [],
  onToggle,
  onAdd,
  onContinue,
  onPaper = false,
  linkName = false,
  cardName = 'Christmas card',
}: {
  /** What the card is called in its words (a thank-you card's `name`, Wave 5). */
  cardName?: string;
  /** By link, ask first for an optional name for its envelope (Wave 3.2, only while `improved`). */
  linkName?: boolean;
  onChoose: (to: Recipient) => void;
  /** On the cream paper of a sheet (Pass it on): the same picker, its lines always in the paper's ink. */
  onPaper?: boolean;
  /** How many one card can go to at once; more than one (digital stamps on): people and addresses go on a list. */
  max?: number;
  listed?: ListEntry[];
  onToggle?: (entry: ListEntry) => void;
  onAdd?: (entry: ListEntry) => void;
  onContinue?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [byEmail, setByEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [byLink, setByLink] = useState(false);
  const [envelope, setEnvelope] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);
  const results = useCardRecipients(debounced);
  const people = results.data ?? [];
  const emailOk = EMAIL.test(email.trim());
  const many = max > 1;
  const chosen = new Set(listed.map(entryKey));
  const full = listed.length >= max;
  const m = onPaper ? 'text-[#4e5563]' : muted;
  // The card improvements of November 28 (GET /cards `improved`): the words for opening before signing up.
  const improved = Boolean(useHolidayCards().data?.improved);

  // A list: the people and addresses on it, each taken off with its ×, and the button on to the next step.
  const list = many ? (
    <div className="px-4">
      {listed.length ? (
        <ul aria-label="Who it’s for" data-testid="sendCardList" className="mt-3 flex flex-wrap gap-2">
          {listed.map((entry) => (
            <li key={entryKey(entry)} className="max-w-full">
              <button
                type="button"
                onClick={() => onToggle?.(entry)}
                aria-label={`Take ${entryName(entry)} off the list`}
                className="flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[#d6cbb6] bg-[#fffdf8] pl-3.5 pr-2.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
              >
                <span className="truncate">{entryName(entry)}</span>
                <X className="h-4 w-4 flex-none text-[#6b7280]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={`mt-2.5 text-[13px] leading-[18px] ${m}`}>
        {full ? `That’s ${max}, the most for one send. ` : null}Each person gets their own card. No one sees who else got one.
      </p>
    </div>
  ) : null;
  const next = many && listed.length ? (
    <div className="sticky bottom-0 mt-5 bg-[#f5f0e8] px-4 pb-4 pt-2 [@media(prefers-color-scheme:dark)]:bg-app">
      <button type="button" data-testid="sendCardContinue" onClick={onContinue} className={primary} style={{ backgroundColor: WAX }}>
        {listed.length === 1 ? `Continue with ${firstName(entryName(listed[0]))}` : `Continue with ${listed.length} people`}
      </button>
    </div>
  ) : null;

  // By link (Wave 3.2): an optional name in ink on the envelope, laid out as the email form is.
  if (byLink) {
    return (
      <form
        className="mt-4 px-4"
        data-testid="sendCardLinkForm"
        onSubmit={(event) => {
          event.preventDefault();
          const name = linkEnvelopeName(envelope);
          onChoose(name ? { kind: 'link', name } : { kind: 'link' });
        }}
      >
        <label htmlFor="card-link-name" className="text-[14px] font-semibold">Name on the envelope (optional)</label>
        <input
          id="card-link-name"
          type="text"
          autoComplete="off"
          autoFocus
          maxLength={LINK_NAME_MAX}
          value={envelope}
          onChange={(event) => setEnvelope(event.target.value)}
          placeholder="e.g. Mom, Aunt Lin, The Patel family"
          data-testid="sendCardLinkName"
          className="mt-2 h-12 w-full rounded-xl border border-[#d6cbb6] bg-[#fffdf8] px-4 text-[16px] text-[#111827] focus:border-[#8b1d1d] focus:outline-none focus:ring-2 focus:ring-[#8b1d1d]/30"
        />
        <p className={`mt-2 text-[14px] leading-5 ${m}`}>
          Written in ink on the front of the envelope. Leave blank if you&rsquo;d rather keep it unnamed.
        </p>
        <p className={`mt-3 text-[14px] leading-5 ${m}`}>
          Anyone with the link can open and read your card right away — no account needed. The first person to save it
          to a mailbox keeps it.
        </p>
        <button type="submit" data-testid="sendCardLinkDone" className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>Continue</button>
        <button type="button" onClick={() => setByLink(false)} className={`${secondary} mt-2.5`}>Search Pantopus instead</button>
      </form>
    );
  }

  if (byEmail) {
    return (
      <>
      {list}
      <form
        className="mt-4 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!emailOk) return;
          if (!many) { onChoose({ kind: 'email', email: email.trim() }); return; }
          onAdd?.({ kind: 'email', email: email.trim() });
          setEmail('');
          setByEmail(false);
        }}
      >
        <div className="flex items-end justify-between gap-2">
          <label htmlFor="card-email" className="text-[14px] font-semibold">Their email address</label>
          {/* The browser's own contact picker (design plan 11.7), only where there is one: it hands over the one
              address chosen, asks for no permission, and nothing is kept. */}
          {launchFeatures.cardTable && contactPicker() ? (
            <button
              type="button"
              data-testid="sendCardContacts"
              onClick={() => { void pickContactEmail().then((picked) => { if (picked) setEmail(picked); }); }}
              className="min-h-[44px] px-1 text-[14px] font-semibold text-[#8b1d1d] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
            >
              Choose from contacts
            </button>
          ) : null}
        </div>
        <input
          id="card-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          className="mt-2 h-12 w-full rounded-xl border border-[#d6cbb6] bg-[#fffdf8] px-4 text-[16px] text-[#111827] focus:border-[#8b1d1d] focus:outline-none focus:ring-2 focus:ring-[#8b1d1d]/30"
        />
        <p className={`mt-2 text-[14px] leading-5 ${m}`}>
          {improved ? (
            <>
              They get an email saying you sent them a {cardName}. They can open and read it right away — no account
              needed — and join free anytime to keep it or write back. The email never shows your note.
            </>
          ) : (
            <>
              They get an email saying you sent them a {cardName}. They join Pantopus with this address to open it. The
              email never shows your note.
            </>
          )}
        </p>
        <button type="submit" data-testid="sendCardEmailDone" disabled={!emailOk || (many && full)} className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>
          {many ? 'Add to the list' : 'Continue'}
        </button>
        <button type="button" onClick={() => setByEmail(false)} className={`${secondary} mt-2.5`}>{many ? 'Back to search' : 'Search Pantopus instead'}</button>
      </form>
      {next}
      </>
    );
  }

  return (
    <>
    {list}
    <div className="mt-3 px-4">
      <label htmlFor="card-search" className="sr-only">Search by name</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6b7280]" aria-hidden />
        <input
          id="card-search"
          type="search"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          className="h-12 w-full rounded-xl border border-[#d6cbb6] bg-[#fffdf8] pl-11 pr-4 text-[16px] text-[#111827] focus:border-[#8b1d1d] focus:outline-none focus:ring-2 focus:ring-[#8b1d1d]/30"
        />
      </div>
      <div aria-live="polite" className="mt-3">
        {debounced.trim().length < 2 ? (
          <p className={`px-1 text-[14px] leading-5 ${m}`}>Type two letters or more of their name.</p>
        ) : results.isPending ? (
          <p className={`flex items-center gap-2 px-1 text-[14px] ${m}`}><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking…</p>
        ) : results.isError ? (
          <p role="alert" className="px-1 text-[14px] text-[#a81a1a]">Couldn&rsquo;t search just now. {mailLoadMessage(results.error)}</p>
        ) : people.length === 0 ? (
          <p className={`px-1 text-[14px] leading-5 ${m}`}>No one by that name. Check the spelling, or send it to their email.</p>
        ) : (
          <ul className="divide-y divide-[#e7dcc6] overflow-hidden rounded-xl border border-[#e3d8c3] bg-[#fffdf8]">
            {people.map((person) => {
              const entry: ListEntry = { kind: 'person', userId: person.userId, name: person.name };
              const on = many && chosen.has(entryKey(entry));
              return (
                <li key={person.userId}>
                  <button
                    type="button"
                    data-testid={`sendCardPerson.${person.userId}`}
                    onClick={() => (many ? onToggle?.(entry) : onChoose(entry))}
                    disabled={many && full && !on}
                    aria-pressed={many ? on : undefined}
                    className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f5efe3] focus:outline-none focus-visible:bg-[#f5efe3] disabled:opacity-50"
                  >
                    <span aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ebe3d4] text-[15px] font-semibold text-[#5b4a36]">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#111827]">{person.name}</span>
                      <span className="block truncate text-[13px] text-[#4e5563]">
                        {[person.username ? `@${person.username}` : null, person.homeAddress].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {on ? (
                      <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[#fff7ed]" style={{ backgroundColor: WAX }}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* Sending to someone not on Pantopus already invites them (design plan 11.6): said once, above both ways. */}
      {launchFeatures.cardTable ? (
        <p data-testid="sendCardInviteLine" className={`mt-5 text-center text-[14px] leading-5 ${m}`}>
          {improved ? <>They don&rsquo;t need Pantopus. They can open and read it right away.</> : <>They don&rsquo;t need Pantopus yet. They join to open it.</>}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="sendCardByEmail"
        onClick={() => setByEmail(true)}
        disabled={many && full}
        className={`${launchFeatures.cardTable ? 'mt-1.5' : 'mt-5'} flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#8b1d1d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50`}
      >
        <Mail className="h-[18px] w-[18px]" aria-hidden />
        {many
          ? (launchFeatures.cardTable ? 'Not on Pantopus yet? Add their email' : 'Not on Pantopus? Add their email')
          : (launchFeatures.cardTable ? 'Not on Pantopus yet? Send it to their email' : 'Not on Pantopus? Send it to their email')}
      </button>
      {launchFeatures.cardTable && !listed.length ? (
        <div className="mt-2.5 text-center">
          <button
            type="button"
            data-testid="sendCardByLink"
            onClick={() => (linkName ? setByLink(true) : onChoose({ kind: 'link' }))}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#8b1d1d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]${onPaper ? '' : ' [@media(prefers-color-scheme:dark)]:text-[#e8b996]'}`}
          >
            <Link2 className="h-[18px] w-[18px]" aria-hidden />
            Send it by link
          </button>
          <p className={`mx-auto mt-0.5 max-w-[340px] text-[13px] leading-[18px] ${m}`}>{improved ? 'Text it, or paste it anywhere. They can open it right away, and save it to keep it.' : 'Text it, or paste it anywhere. The first person to open it keeps the card.'}</p>
        </div>
      ) : null}
    </div>
    {next}
    </>
  );
}

// ── Step 2: pick a card ──────────────────────────────────────

const collectionTab = (id: string) => `card-collection-${id}`;

function PickStep({
  designs,
  collections,
  year,
  chosen,
  onChoose,
  onNext,
  shelving = null,
  nextLabel = 'Write on this card',
}: {
  /** The button on to the next step (Pick a card first, `improved`: "Choose who it’s for" while no one is chosen). */
  nextLabel?: string;
  designs: HolidayCardDesign[];
  /** The server's collections, in order; none (a server from before collections): one grid of every design. */
  collections: HolidayCardCollection[];
  year: number;
  chosen: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
  /** The shelves (server key card_shelves; null: today's screen) and the collection whose page is open. */
  shelving?: ShelvesState | null;
}) {
  if (shelving) return <ShelvesPick designs={designs} year={year} chosen={chosen} onChoose={onChoose} onNext={onNext} shelving={shelving} nextLabel={nextLabel} />;
  return <TodaysPick designs={designs} collections={collections} year={year} chosen={chosen} onChoose={onChoose} onNext={onNext} nextLabel={nextLabel} />;
}

/** Step 2 as shelves (card shelves SPEC Part C): what the flow keeps while it's open. */
type ShelvesState = {
  shelves: Shelf[];
  /** The collection whose page is open, or null for the shelves. */
  open: Shelf | null;
  onOpenCollection: (shelf: Shelf) => void;
  /** The opening row's order of collections (the server's `opening`, SPEC E2). */
  opening: string[] | null;
  /** Where the shelves were scrolled when a collection's page opened (null: start at the chosen card's shelf). */
  restoreTop: number | null;
};

/**
 * "Pick a card" as shelves: the shelves or a collection's page, the card rack among the collection's cards (with
 * card_table on; off, a tap chooses the card as today's grid does), and the bar, which shows only once a card is chosen.
 */
function ShelvesPick({ designs: list, year, chosen, onChoose, onNext, shelving, nextLabel }: {
  nextLabel: string;
  designs: HolidayCardDesign[];
  year: number;
  chosen: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
  shelving: ShelvesState;
}) {
  const [large, setLarge] = useState<HolidayCardDesign | null>(null);
  const [rack, setRack] = useState<{ id: string; shelf: Shelf } | null>(null);
  const designs = useMemo(() => new Map(list.map((design) => [design.id, design])), [list]);
  const picked = (chosen && designs.get(chosen)) || null;
  const shelfOf = (id: string) => shelving.shelves.find((s) => s.cards.some((c) => c.id === id)) ?? null;
  const open = (id: string, shelf: Shelf) => {
    if (launchFeatures.cardTable) { setRack({ id, shelf }); return; }
    if (id === chosen) setLarge(designs.get(id) ?? null);
    else onChoose(id);
  };
  const seeLarger = () => {
    if (!picked) return;
    const shelf = shelfOf(picked.id);
    if (launchFeatures.cardTable && shelf) setRack({ id: picked.id, shelf });
    else setLarge(picked);
  };
  return (
    <div className="mt-3 px-4">
      {shelving.open ? (
        <CollectionPage key={shelving.open.id} shelf={shelving.open} chosen={chosen} onOpen={(id) => open(id, shelving.open as Shelf)} />
      ) : (
        <CardShelves shelves={shelving.shelves} opening={shelving.opening} chosen={chosen} restoreTop={shelving.restoreTop} onOpen={open} onAll={shelving.onOpenCollection} />
      )}
      {/* Hidden until a card is chosen; then it comes up from the bottom, and the page ends above it. */}
      {picked ? (
        <div
          data-testid="sendCardPickBar"
          className={`${shelvesBarClass} sticky bottom-0 z-10 -mx-4 mt-5 border-t border-[#e3d8c3] bg-[#f5f0e8] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_16px_rgba(60,40,10,0.08)] md:-bottom-6 [@media(prefers-color-scheme:dark)]:border-app [@media(prefers-color-scheme:dark)]:bg-app`}
        >
          {/* On the wide page the chosen card and the button keep the other steps' width, in the middle. */}
          <div className="mx-auto max-w-[528px]">
          <div className="flex min-h-[48px] items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardPicture(picked.id, 'thumb')} alt="" className="w-10 flex-shrink-0 -rotate-2 rounded-[2px] shadow-[0_3px_8px_rgba(60,40,10,0.25)]" />
            <p className="min-w-0 flex-1 text-[14px] font-medium leading-[18px] text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-secondary">{picked.caption}</p>
            <button
              type="button"
              data-testid="sendCardSeeLarger"
              onClick={seeLarger}
              className="flex min-h-[44px] flex-shrink-0 items-center rounded-xl border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
            >
              See it larger
            </button>
          </div>
          <button type="button" data-testid="sendCardWriteOn" onClick={onNext} className={`${primary} mt-2`} style={{ backgroundColor: WAX }}>{nextLabel}</button>
          </div>
        </div>
      ) : null}
      {rack ? (
        <CardRack
          designs={rack.shelf.cards}
          collectionName={rack.shelf.name}
          start={rack.id}
          year={year}
          onClose={(lastSeen) => { onChoose(lastSeen); setRack(null); }}
          onWrite={(id) => { onChoose(id); setRack(null); onNext(); }}
          writeLabel={nextLabel}
        />
      ) : null}
      {large ? <LargeCard design={large} year={year} onClose={() => setLarge(null)} onChoose={(id) => { onChoose(id); setLarge(null); }} /> : null}
    </div>
  );
}

/** "See it larger" without the card rack (card_table off): the card's front, with Close and Choose this card. */
function LargeCard({ design, year, onClose, onChoose }: { design: HolidayCardDesign; year: number; onClose: () => void; onChoose: (id: string) => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={design.caption} data-testid="sendCardLarge" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div style={{ width: 'min(720px, calc((100vh - 120px) * 0.72), 100%)' }} onClick={(event) => event.stopPropagation()}>
        <CardFront design={design.id} caption={design.caption} paper={design.paper} year={year} size="card" className="rounded-[3px] shadow-2xl" />
        <div className="mt-3 flex gap-2.5">
          <button type="button" data-testid="sendCardLargeClose" onClick={onClose} className={secondary}><X className="h-4 w-4" aria-hidden /> Close</button>
          <button type="button" data-testid="sendCardChooseThis" onClick={() => onChoose(design.id)} className={primary} style={{ backgroundColor: WAX }}>Choose this card</button>
        </div>
      </div>
    </div>
  );
}

/** Today's "Pick a card": a row of the collections' names and one collection's grid at a time. */
function TodaysPick({
  designs, collections, year, chosen, onChoose, onNext, nextLabel,
}: {
  nextLabel: string;
  designs: HolidayCardDesign[];
  collections: HolidayCardCollection[];
  year: number;
  chosen: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
}) {
  const [large, setLarge] = useState<HolidayCardDesign | null>(null);
  // The card rack (launch key card_table, design plan Part 5): the picture it's open at.
  const [rack, setRack] = useState<string | null>(null);
  const byId = useMemo(() => new Map(designs.map((design) => [design.id, design])), [designs]);
  const shelves = useMemo(() => collections.filter((c) => c.designs.some((id) => byId.has(id))), [collections, byId]);
  // The collection that holds the chosen card (coming back from step 3), else the first. Switching keeps the card.
  const [shownId, setShownId] = useState(() => (shelves.find((c) => chosen && c.designs.includes(chosen)) ?? shelves[0])?.id);
  const shown = shelves.find((c) => c.id === shownId) ?? shelves[0] ?? null;
  const grid = shown ? shown.designs.flatMap((id) => byId.get(id) ?? []) : designs;
  const picked = (chosen && byId.get(chosen)) || null;
  const rowRef = useRef<HTMLDivElement>(null);

  // On narrow screens the row scrolls sideways (wider ones wrap it): keep the chosen collection's chip in sight, also
  // after the screen turns. Only the row moves, never the page.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const reveal = () => {
      const chip = row.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!chip) return;
      const box = row.getBoundingClientRect();
      const at = chip.getBoundingClientRect();
      if (at.left < box.left + 16) row.scrollLeft -= box.left + 16 - at.left;
      else if (at.right > box.right - 16) row.scrollLeft += at.right - (box.right - 16);
    };
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
  }, [shownId]);

  // A picture chosen before this step (on a public card page, or by the assistant's button) is in sight when it opens.
  useEffect(() => {
    if (!chosen) return undefined;
    const reveal = () => document.querySelector('[role="radio"][aria-checked="true"]')?.scrollIntoView({ block: 'center' });
    reveal();
    // The pictures above it take their height as they load, which pushes it out of sight again: it is brought back
    // as each one loads, for a moment, or until the person moves the page themselves.
    const moves = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    const stop = () => {
      document.removeEventListener('load', reveal, true);
      moves.forEach((name) => window.removeEventListener(name, stop));
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(stop, 2500);
    document.addEventListener('load', reveal, true);
    moves.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    return stop;
    // Only as the step opens: choosing another card doesn't move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrow keys, Home and End move along the row, as tabs do.
  const onRowKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = shelves.findIndex((c) => c.id === shown?.id);
    const moves: Partial<Record<string, number>> = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shelves.length - 1 };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = shelves[(to + shelves.length) % shelves.length];
    setShownId(next.id);
    document.getElementById(collectionTab(next.id))?.focus();
  };

  const gridView = (
    <div role="radiogroup" aria-label={shown?.name ?? 'Christmas cards'} className={launchFeatures.cardTable ? 'grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-3' : 'grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4'}>
      {grid.map((design) => {
        const selected = design.id === chosen;
        return (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={design.caption}
            data-testid={`sendCardDesign.${design.id}`}
            onClick={() => (launchFeatures.cardTable ? setRack(design.id) : selected ? setLarge(design) : onChoose(design.id))}
            className="group flex flex-col items-center gap-1.5 rounded-lg p-1 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
          >
            <span
              className="relative block w-full overflow-hidden rounded-[3px] transition"
              style={{ boxShadow: selected ? `0 0 0 3px ${WAX}, 0 6px 14px rgba(60, 40, 10, 0.25)` : '0 4px 10px rgba(60, 40, 10, 0.22)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardPicture(design.id, 'thumb')} alt="" className="block w-full" loading="lazy" />
              {selected ? (
                <span aria-hidden className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[#fff7ed]" style={{ backgroundColor: WAX }}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : null}
            </span>
            <span className={`${launchFeatures.cardTable ? 'text-[13px] leading-[18px]' : 'line-clamp-2 text-[12px] leading-4'} font-medium text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-secondary`}>{design.caption}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mt-3 px-4">
      {shown ? (
        <>
          <div
            ref={rowRef}
            role="tablist"
            aria-label="Collections"
            data-testid="sendCardCollections"
            onKeyDown={onRowKey}
            className="-mx-4 flex scroll-px-4 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
          >
            {shelves.map((collection) => {
              const selected = collection.id === shown.id;
              return (
                <button
                  key={collection.id}
                  id={collectionTab(collection.id)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="card-collection-panel"
                  tabIndex={selected ? 0 : -1}
                  data-testid={`sendCardCollection.${collection.id}`}
                  onClick={() => setShownId(collection.id)}
                  className={`h-9 flex-shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2 ${
                    selected ? 'border-[#8b1d1d] bg-[#8b1d1d] text-[#fff7ed]' : 'border-[#d6cbb6] bg-[#fffdf8] text-[#374151] hover:bg-[#f5efe3]'
                  }`}
                >
                  {collection.name}
                </button>
              );
            })}
          </div>
          <div id="card-collection-panel" role="tabpanel" aria-labelledby={collectionTab(shown.id)}>
            <p data-testid="sendCardCollectionLine" className={`mt-2 text-[14px] leading-5 ${muted}`}>{shown.line}</p>
            <div className="mt-3">{gridView}</div>
          </div>
        </>
      ) : gridView}
      {/* On the table's paper (launch key card_table) the main button stays in sight at the bottom edge while the
          pictures scroll, with the chosen picture beside it (design plan 1.1). */}
      {launchFeatures.cardTable ? (
        <div
          data-testid="sendCardPickBar"
          className="sticky bottom-0 z-10 -mx-4 mt-5 md:-bottom-6 border-t border-[#e3d8c3] bg-[#f5f0e8] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_16px_rgba(60,40,10,0.08)] [@media(prefers-color-scheme:dark)]:border-app [@media(prefers-color-scheme:dark)]:bg-app"
        >
          <div className="flex min-h-[48px] items-center gap-3">
            {picked ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cardPicture(picked.id, 'thumb')} alt="" className="w-10 flex-shrink-0 -rotate-2 rounded-[2px] shadow-[0_3px_8px_rgba(60,40,10,0.25)]" />
                <p className="min-w-0 flex-1 text-[14px] font-medium leading-[18px] text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-secondary">{picked.caption}</p>
                <button
                  type="button"
                  data-testid="sendCardSeeLarger"
                  onClick={() => setRack(picked.id)}
                  className="flex min-h-[44px] flex-shrink-0 items-center rounded-xl border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
                >
                  See it larger
                </button>
              </>
            ) : (
              <p className={`flex-1 text-center text-[14px] ${muted}`}>Tap a picture to choose it.</p>
            )}
          </div>
          <button type="button" data-testid="sendCardWriteOn" disabled={!picked} onClick={onNext} className={`${primary} mt-2`} style={{ backgroundColor: WAX }}>{nextLabel}</button>
        </div>
      ) : (
        <div className="mt-6 space-y-2.5 pb-4">
          {picked ? (
            <button type="button" data-testid="sendCardSeeLarger" onClick={() => setLarge(picked)} className={secondary}>See it larger</button>
          ) : (
            <p className={`text-center text-[14px] ${muted}`}>Tap a picture to choose it.</p>
          )}
          <button type="button" data-testid="sendCardWriteOn" disabled={!picked} onClick={onNext} className={primary} style={{ backgroundColor: WAX }}>{nextLabel}</button>
        </div>
      )}

      {rack ? (
        <CardRack
          designs={grid}
          collectionName={shown?.name ?? null}
          start={rack}
          year={year}
          onClose={(lastSeen) => { onChoose(lastSeen); setRack(null); }}
          onWrite={(id) => { onChoose(id); setRack(null); onNext(); }}
          writeLabel={nextLabel}
        />
      ) : null}
      {large ? (
        <div role="dialog" aria-modal="true" aria-label={large.caption} data-testid="sendCardLarge" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={() => setLarge(null)}>
          <div style={{ width: 'min(720px, calc((100vh - 120px) * 0.72), 100%)' }} onClick={(event) => event.stopPropagation()}>
            <CardFront design={large.id} caption={large.caption} paper={large.paper} year={year} size="card" className="rounded-[3px] shadow-2xl" />
            <div className="mt-3 flex gap-2.5">
              <button type="button" data-testid="sendCardLargeClose" onClick={() => setLarge(null)} className={secondary}><X className="h-4 w-4" aria-hidden /> Close</button>
              <button
                type="button"
                data-testid="sendCardChooseThis"
                onClick={() => { onChoose(large.id); setLarge(null); }}
                className={primary}
                style={{ backgroundColor: WAX }}
              >
                Choose this card
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Step 3: write on the back ────────────────────────────────

/** The card's own photo while it's written: the chosen file, its upload, and the server's reference once stored. */
type PhotoDraft = {
  status: 'uploading' | 'ready' | 'failed';
  progress: number;
  /** The chosen file; none once a reload brought the draft back (only its reference is kept). */
  file: File | null;
  localUrl: string | null;
  ref: CardMediaRef | null;
  error: string | null;
};

/** The card's own voice greeting while it's written (memories plan step 7): the recording, its upload, the server's reference. */
type VoiceDraft = {
  status: 'uploading' | 'ready' | 'failed';
  /** The recording; none once a reload brought the draft back (it then plays from the server). */
  blob: Blob | null;
  localUrl: string | null;
  ref: CardMediaRef | null;
  error: string | null;
};

function WriteStep({
  design,
  year,
  fromName,
  toFirstName,
  toList = false,
  limit,
  message,
  onMessage,
  signature,
  onSignature,
  canSign,
  signatureKeeping = null,
  photo = null,
  photoAlt = '',
  onPhotoAlt,
  canAddPhoto = false,
  onAddPhoto,
  onRemovePhoto,
  onRetryPhoto,
  voice = null,
  canAddVoice = false,
  greetingFor = 'you',
  onRecorded,
  onRemoveVoice,
  onRetryVoice,
  mediaStamp = null,
  mediaNeedsStampLine = MEDIA_NEEDS_STAMP,
  freeMediaHint = null,
  photoIsFront = false,
  onGetStamps,
  noteHelp = null,
  onCloth = false,
  onNext,
}: {
  design: HolidayCardDesign;
  year: number;
  fromName: string;
  toFirstName: string;
  /** A list: each person gets the same note, so the grey example line names no one. */
  toList?: boolean;
  limit: number;
  message: string;
  onMessage: (text: string) => void;
  /** Signed beside FROM (design plan 8.2), or null for the typed first name. */
  signature: CardSignature | null;
  onSignature: (signature: CardSignature | null) => void;
  /** The server keeps signatures (GET /cards `signature`, launch key card_table). */
  canSign: boolean;
  /**
   * The account keeps one signature for the next cards (GET /cards `signature.saves`): the saved one (or null), and
   * saving and forgetting it. Null: no "Keep this signature" box.
   */
  signatureKeeping?: { saved: CardSignature | null; onKeep: (signature: CardSignature) => Promise<void>; onForget: () => Promise<void> } | null;
  /** The card's own photo (memories plan step 4, launch key holiday_card_memories): uploading, ready or failed. */
  photo?: PhotoDraft | null;
  photoAlt?: string;
  onPhotoAlt?: (text: string) => void;
  /** GET /cards says a photo can go on this card now. */
  canAddPhoto?: boolean;
  onAddPhoto?: (file: File) => void;
  onRemovePhoto?: () => void;
  onRetryPhoto?: () => void;
  /** The card's own voice greeting (memories plan step 7): uploading, ready or failed. */
  voice?: VoiceDraft | null;
  /** GET /cards says a greeting can go on this card now; it's recorded only where the browser makes AAC (Firefox: no). */
  canAddVoice?: boolean;
  /** "For {first}" on the cassette: the person's first name, or "you". */
  greetingFor?: string;
  onRecorded?: (recording: Blob) => void;
  onRemoveVoice?: () => void;
  onRetryVoice?: () => void;
  /** 'buy': no bought stamp left, so the photo and voice buttons open the stamp books (founder 2026-11-11). */
  mediaStamp?: MediaStamp | null;
  mediaNeedsStampLine?: string;
  freeMediaHint?: string | null;
  /** A photo card (Wave 4.2): its photo is the front, so it isn't offered again here; Seal it still waits for it. */
  photoIsFront?: boolean;
  onGetStamps?: () => void;
  /**
   * "Help me write it" (GET /cards `note_help`, launch key card_note_help): the first names the card is to and how
   * many people it goes to. Null: no button.
   */
  noteHelp?: { names: string[]; count: number } | null;
  /** On the card's cloth (design plan Part 9): cream words and glass buttons. */
  onCloth?: boolean;
  onNext: () => void;
}) {
  const ghost = onCloth ? ON_CLOTH_BUTTON : 'inline-flex min-h-[40px] items-center rounded-full border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]';
  const quiet = onCloth ? ON_CLOTH_MUTED : muted;
  const [showBack, setShowBack] = useState(true);
  const [signing, setSigning] = useState(false);
  // Done with "Keep this signature" ticked, but the account didn't keep it: this card is still signed.
  const [keepFailed, setKeepFailed] = useState(false);
  const signedWithSaved = Boolean(signatureKeeping && sameSignature(signature, signatureKeeping.saved));
  // A note picked from "Help me write it" lands on the back, face up.
  const help = useCardNoteHelp({
    designId: design.id,
    names: noteHelp?.names ?? [],
    count: noteHelp?.count ?? 1,
    message,
    limit,
    onMessage: (text) => { setShowBack(true); onMessage(text); },
  });
  const photoInput = useRef<HTMLInputElement>(null);
  const count = letters(message);
  // The pen fits the note as it's typed (Part 1): the same measure the finished card uses.
  const noteStyle = writingStyle(useNoteFit(message));
  // On the table a long note runs onto a second leaf (Part 9); the box stays as it is and says so under it.
  const runsOnto = Boolean(useNoteLeaves(message, null, launchFeatures.cardTable));
  // Seal it waits until the photo is uploaded; a failed one is tried again or removed, never dropped.
  const photoWait = photo && photo.status !== 'ready'
    ? (photo.status === 'failed' ? 'The photo didn’t upload. Try again, or remove it.' : 'Waiting for the photo to finish uploading.')
    : null;
  // Recorded only where this browser makes AAC (checked once it's in the browser, so the page renders the same first).
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => { setCanRecord(canAddVoice && canRecordGreeting()); }, [canAddVoice]);
  const recorder = useGreetingRecorder((recording) => onRecorded?.(recording));
  const listen = useGreetingPlayer(voice?.ref ? { own: voice.ref.file_id } : null, voice?.localUrl ?? null);
  // Seal it waits for the greeting as for the photo.
  const voiceWait = recorder.recording ? 'Stop the recording first.'
    : voice && voice.status !== 'ready'
      ? (voice.status === 'failed' ? 'The greeting didn’t upload. Try again, or remove it.' : 'Waiting for the greeting to finish uploading.')
      : null;
  const mediaWait = photoWait || voiceWait;
  const showPhoto = !photoIsFront && (canAddPhoto || Boolean(photo));
  const showVoice = (canAddVoice && canRecord) || Boolean(voice) || recorder.recording;
  // No bought stamp left: adding or recording opens the stamp books instead, and says why.
  const needsStamp = mediaStamp === 'buy';
  const record = () => { if (needsStamp) { onGetStamps?.(); return; } listen.stop(); void recorder.start(); };
  const choosePhoto = () => { if (needsStamp) { onGetStamps?.(); return; } photoInput.current?.click(); };
  // Christmas with Jesus Christ: a gift tag, as the reader will see it (wave 4 drawing 4).
  const gift = cardMood(design.number, design.id, design.mood) === 'reverence';
  return (
    <div className="mt-3 px-4">
      <CardFlip
        className={`mx-auto max-w-[420px] ${onCloth ? 'drop-shadow-[0_18px_28px_rgba(6,3,4,0.5)]' : ''}`}
        showBack={showBack}
        front={<CardFront design={design.id} caption={design.caption} paper={design.paper} year={year} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]" />}
        back={(
          <CardBack number={design.number} paper={design.paper} fromName={fromName} year={year} signature={signature} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]">
            <label htmlFor="card-note" className="sr-only">Your note on the back of the card</label>
            <textarea
              id="card-note"
              value={message}
              onChange={(event) => onMessage([...event.target.value].slice(0, limit).join(''))}
              placeholder={toList ? 'Dear friends,' : `Dear ${toFirstName || 'friend'},`}
              className="h-full w-full resize-none border-0 bg-transparent p-0 placeholder:text-[#2c4a8a]/45 focus:outline-none focus:ring-0"
              style={noteStyle}
              tabIndex={showBack ? 0 : -1}
            />
          </CardBack>
        )}
      />
      <div className="mx-auto mt-3 flex max-w-[420px] items-center justify-between">
        <button
          type="button"
          onClick={() => setShowBack((back) => !back)}
          aria-pressed={!showBack}
          className={ghost}
        >
          {showBack ? 'Turn it over' : 'Back to writing'}
        </button>
        <span aria-live="polite" className={`text-[13px] ${count >= limit ? `font-semibold ${onCloth ? 'text-[#ffb4a8]' : 'text-[#8b1d1d]'}` : quiet}`}>{count} of {limit} letters</span>
      </div>
      <p aria-live="polite" data-testid="sendCardSecondLeaf" className={`mx-auto max-w-[420px] text-right text-[13px] leading-5 ${quiet} ${runsOnto ? 'mt-1' : ''}`}>
        {runsOnto ? 'This note runs onto a second leaf.' : ''}
      </p>
      {noteHelp ? (
        <>
          <CardNoteHelpRow help={help} ghost={ghost} quiet={quiet} />
          <CardNoteHelpPanel help={help} limit={limit} onCloth={onCloth} />
        </>
      ) : null}
      {canSign ? (
        <div className="mx-auto mt-2 flex max-w-[420px] items-center gap-2">
          <button
            type="button"
            data-testid="sendCardSign"
            onClick={() => { setShowBack(true); setSigning(true); }}
            className={ghost}
          >
            {signature ? 'Sign again' : 'Sign your name'}
          </button>
          <span className={`text-[13px] ${quiet}`} data-testid="sendCardSignState">
            {signedWithSaved ? 'Your saved signature is beside FROM.' : signature ? 'Signed beside FROM.' : `Or leave ${firstName(fromName)} typed.`}
          </span>
        </div>
      ) : null}
      {canSign && keepFailed ? (
        <p role="alert" className={`mx-auto mt-1 max-w-[420px] text-[13px] ${quiet}`}>This card is signed, but your signature couldn’t be kept for next time. Sign again to try once more.</p>
      ) : null}
      {signing ? (
        <SignaturePad
          initial={signature}
          wax={WAX}
          onDone={(signed, keep) => {
            onSignature(signed);
            setSigning(false);
            setKeepFailed(false);
            if (keep && signatureKeeping && !sameSignature(signed, signatureKeeping.saved)) {
              signatureKeeping.onKeep(signed).catch(() => setKeepFailed(true));
            }
          }}
          onTyped={() => { onSignature(null); setSigning(false); }}
          onClose={() => setSigning(false)}
          keeping={signatureKeeping ? { saved: signatureKeeping.saved, onForget: signatureKeeping.onForget } : undefined}
        />
      ) : null}
      {showPhoto || showVoice ? (
        // The card's own photo and voice greeting (wave 4 drawings 1 and 2): under the note, each uploaded as soon as
        // it's added, with its own progress; the note stays first and required.
        <div className="mx-auto mt-4 max-w-[420px]" data-testid="sendCardMedia">
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="sendCardPhotoInput"
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onAddPhoto?.(file); }}
          />
          {!photo && !voice && !recorder.recording ? (
            <div className="flex flex-wrap gap-2">
              {showPhoto ? <button type="button" data-testid="sendCardAddPhoto" onClick={choosePhoto} className={ghost}>Add a photo</button> : null}
              {showVoice ? <button type="button" data-testid="sendCardRecord" onClick={record} className={ghost}>Record a greeting</button> : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 items-start gap-4">
              <div className="min-w-0" data-testid="sendCardPhoto">
                {photo ? (
                  <>
                    <div className="w-[92%] [container-type:inline-size]">
                      <CardPrint
                        source={photo.ref ? { own: photo.ref.file_id } : null}
                        localUrl={photo.localUrl}
                        width={photo.ref?.width}
                        height={photo.ref?.height}
                        alt={photoAlt}
                        uploading={photo.status === 'uploading'}
                        className="w-full"
                      />
                    </div>
                    <p aria-live="polite" className={`mt-2 text-[13px] ${quiet}`}>
                      {photo.status === 'uploading' ? 'Uploading…' : photo.status === 'ready' ? 'Added.' : ''}
                    </p>
                    {photo.status === 'failed' ? <p role="alert" className={`mt-1 text-[13px] font-semibold ${onCloth ? 'text-[#ffb4a8]' : 'text-[#8b1d1d]'}`}>{photo.error}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {photo.status === 'failed'
                        ? <button type="button" data-testid="sendCardPhotoRetry" onClick={onRetryPhoto} className={ghost}>Try again</button>
                        : <button type="button" data-testid="sendCardPhotoReplace" onClick={choosePhoto} className={ghost}>Replace</button>}
                      <button type="button" data-testid="sendCardPhotoRemove" onClick={onRemovePhoto} className={ghost}>Remove</button>
                    </div>
                  </>
                ) : showPhoto ? (
                  <button type="button" data-testid="sendCardAddPhoto" onClick={choosePhoto} className={ghost}>Add a photo</button>
                ) : null}
              </div>
              <div className="min-w-0" data-testid="sendCardVoice">
                {recorder.recording ? (
                  <>
                    <div className="w-[92%] [container-type:inline-size]"><GreetingObject forName={greetingFor} gift={gift} turning recording tilt={2} /></div>
                    <p aria-live="polite" className={`mt-2 flex items-center gap-1.5 text-[13px] ${quiet}`}>
                      <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#e0453a] motion-reduce:animate-none" />
                      Recording {recordingClock(recorder.elapsed)} of 1:00
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" data-testid="sendCardRecordStop" onClick={recorder.stop} className={ghost}>Stop</button>
                    </div>
                  </>
                ) : voice ? (
                  <>
                    <div className="w-[92%] [container-type:inline-size]"><GreetingObject forName={greetingFor} gift={gift} turning={listen.playing} durationMs={voice.ref?.duration_ms ?? null} tilt={2} /></div>
                    <p aria-live="polite" className={`mt-2 text-[13px] ${quiet}`}>
                      {voice.status === 'uploading' ? 'Uploading…' : voice.status === 'ready' ? 'Added.' : ''}
                    </p>
                    {voice.status === 'failed' ? <p role="alert" className={`mt-1 text-[13px] font-semibold ${onCloth ? 'text-[#ffb4a8]' : 'text-[#8b1d1d]'}`}>{voice.error}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {voice.status === 'failed' ? (
                        <button type="button" data-testid="sendCardVoiceRetry" onClick={onRetryVoice} className={ghost}>Try again</button>
                      ) : (
                        <button type="button" data-testid="sendCardListen" aria-pressed={listen.playing} onClick={listen.toggle} className={ghost}>
                          {listen.playing ? '❚❚ Pause' : `▶ Listen${voice.ref?.duration_ms ? ` ${greetingLength(voice.ref.duration_ms)}` : ''}`}
                        </button>
                      )}
                      {canRecord ? <button type="button" data-testid="sendCardRecordAgain" onClick={record} className={ghost}>Record again</button> : null}
                      <button type="button" data-testid="sendCardVoiceRemove" onClick={() => { listen.stop(); onRemoveVoice?.(); }} className={ghost}>Remove</button>
                    </div>
                  </>
                ) : showVoice ? (
                  <button type="button" data-testid="sendCardRecord" onClick={record} className={ghost}>Record a greeting</button>
                ) : null}
              </div>
            </div>
          )}
          {needsStamp ? <p className={`mt-3 text-[13px] ${quiet}`} data-testid="sendCardMediaNeedsStamp">{mediaNeedsStampLine}</p> : null}
          {!needsStamp && freeMediaHint ? <p className={`mt-3 text-[13px] ${quiet}`} data-testid="sendCardMediaFreeHint">{freeMediaHint}</p> : null}
          {recorder.refused ? <p role="alert" className={`mt-3 text-[13px] ${quiet}`} data-testid="sendCardMicRefused">{recorder.refused}</p> : null}
          {photo && !photoIsFront ? (
            <label className={`mt-3 block text-[13px] ${quiet}`}>
              Describe the photo (optional, for screen readers)
              <input
                type="text"
                value={photoAlt}
                maxLength={200}
                onChange={(event) => onPhotoAlt?.(event.target.value)}
                data-testid="sendCardPhotoAlt"
                className="mt-1 block w-full rounded-lg border border-[#d6cbb6] bg-[#fffdf8] px-3 py-2 text-[14px] text-[#1f2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto mt-5 max-w-[420px] pb-4">
        <button type="button" disabled={!message.trim() || Boolean(mediaWait)} onClick={onNext} className={primary} style={{ backgroundColor: WAX }}>Seal it</button>
        {!message.trim() ? <p className={`mt-2 text-center text-[13px] ${quiet}`}>Write a few words on the back first.</p>
          : mediaWait ? <p className={`mt-2 text-center text-[13px] ${quiet}`}>{mediaWait}</p> : null}
      </div>
    </div>
  );
}

// ── Step 4: seal it for the day ──────────────────────────────

// Their mail comes at 7 a.m. where they live: never turned into this clock's time. `theirDay` is the day of that mail
// by their clock (from the server once it's read; until then, the sender's next morning).
function arrivalChoice(
  arrival: HolidayCardArrival,
  cards: HolidayCards,
  to: Recipient,
  theirDay: string | null,
): { title: string; detail: string } {
  if (to.kind === 'list') return listArrivalChoice(arrival, cards, to.entries);
  // The card improvements of November 28 (a link or an email opens before signing up); without them, the words before.
  const improved = Boolean(cards.improved);
  const opensWhen = improved ? 'They can open and read it right in their browser.' : 'They can open it once they join with that address.';
  // By email, its email goes at your next 7 a.m. or on Christmas morning (the other person's clock isn't known).
  if (to.kind === 'email' && arrival === 'next_morning') {
    return { title: 'With the morning mail', detail: `We email them ${emailGoesAt(cards.next_round_at)}, your time. ${opensWhen}` };
  }
  if (to.kind === 'email' && arrival === 'christmas_morning') {
    return { title: 'On Christmas morning', detail: `We email them ${emailGoesAt(cards.christmas_morning_at)}, your time. ${opensWhen}` };
  }
  const day = shortDay(theirDay ?? cards.next_round_at);
  const name = to.kind === 'person' ? firstName(to.name) : 'they';
  switch (arrival) {
    case 'next_morning':
      return { title: 'With the morning mail', detail: `${day}, about 7 a.m. where ${name} lives. They can open it right away.` };
    case 'sealed_christmas':
      return {
        title: 'Sealed until Christmas',
        detail: to.kind === 'link'
          ? improved
            ? 'It waits with a “Do not open until Christmas” seal and opens on December 25. They can save it to their mailbox anytime.'
            : 'Whoever opens your link and joins gets it now, with a “Do not open until Christmas” seal. It opens on December 25.'
          : to.kind === 'email'
          ? improved
            ? 'They get an email now with a “Do not open until Christmas” seal, and a reminder on Christmas morning when it opens.'
            : 'They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.'
          : `It comes with the ${day} morning mail and waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.`,
      };
    case 'christmas_morning':
      return { title: 'On Christmas morning', detail: `${shortDay(cards.christmas_morning_at)}, with the 7 a.m. mail.` };
    default:
      // Right away to someone on Pantopus (Wave 3.3): offered only while `improved` (arrivals.person_all).
      if (to.kind === 'person') return { title: 'Right away', detail: 'Drops into their mailbox now, with a gentle notice.' };
      if (to.kind === 'link') {
        return { title: 'Right away', detail: improved ? 'Whoever opens your link can open and read the card right away — no account needed.' : 'Whoever opens your link can open the card as soon as they join.' };
      }
      return { title: 'Right away, by email', detail: improved ? 'They get an email now and can open and read it right in their browser — no account needed.' : 'They get an email now and can open it once they join with that address.' };
  }
}

// A list's one choice, as each card reads it: every person's by their own clock (the days differ, so none is named). An
// address keeps the choice where the server offers every email choice (arrivals.email_all: its email at your 7 a.m. or on
// Christmas morning); otherwise its card waits for them to open the email, sealed until Christmas for both Christmas
// choices.
function listArrivalChoice(arrival: HolidayCardArrival, cards: HolidayCards, entries: ListEntry[]): { title: string; detail: string } {
  const people = entries.some((entry) => entry.kind === 'person');
  const emails = entries.some((entry) => entry.kind === 'email');
  if (cards.arrivals.email_all) {
    if (!people) return arrivalChoice(arrival, cards, { kind: 'email', email: '' }, null);
    const later = arrival === 'christmas_morning' ? cards.christmas_morning_at : cards.next_round_at;
    const byEmail = !emails ? '' : arrival === 'sealed_christmas'
      ? ' People not on Pantopus get the email now; their card opens on Christmas morning.'
      : ` People not on Pantopus get the email ${emailGoesAt(later)}, your time.`;
    switch (arrival) {
      case 'sealed_christmas':
        return { title: 'Sealed until Christmas', detail: `It comes with each person’s next 7 a.m. mail and waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.${byEmail}` };
      case 'christmas_morning':
        return { title: 'On Christmas morning', detail: `${shortDay(cards.christmas_morning_at)}, with the 7 a.m. mail where each person lives.${byEmail}` };
      default:
        return { title: 'With the morning mail', detail: `With each person’s next 7 a.m. mail, where they live. They can open it right away.${byEmail}` };
    }
  }
  if (!people) {
    return arrival === 'sealed_christmas'
      ? { title: 'Sealed until Christmas', detail: 'They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.' }
      : { title: 'Right away, by email', detail: 'They get an email now and can open it once they join with that address.' };
  }
  const byEmail = !emails ? '' : arrival === 'next_morning'
    ? ' People not on Pantopus get the email right away.'
    : ' People not on Pantopus get the email now; their card opens on Christmas morning.';
  switch (arrival) {
    case 'sealed_christmas':
      return { title: 'Sealed until Christmas', detail: `It comes with each person’s next 7 a.m. mail and waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.${byEmail}` };
    case 'christmas_morning':
      return { title: 'On Christmas morning', detail: `${shortDay(cards.christmas_morning_at)}, with the 7 a.m. mail where each person lives.${byEmail}` };
    default:
      return { title: 'With the morning mail', detail: `With each person’s next 7 a.m. mail, where they live. They can open it right away.${byEmail}` };
  }
}

function SealStep({
  cards,
  to,
  options,
  theirDay,
  design,
  fromName,
  arrival,
  onArrival,
  looking,
  sendsHere,
  sending,
  error,
  onLook,
  onSeal,
  stamps = null,
  onGetStamps,
  onCloth = false,
  fade = PAGE_FADE,
  solid = PAGE_TINT,
  travel = null,
}: {
  cards: HolidayCards;
  to: Recipient;
  options: HolidayCardArrival[];
  theirDay: string | null;
  design: HolidayCardDesign;
  fromName: string;
  arrival: HolidayCardArrival | null;
  onArrival: (arrival: HolidayCardArrival) => void;
  /** Running the server's check (the one Look it over runs) before the sealing table or Look it over opens. */
  looking: boolean;
  /** The server can't show the look: no "Look it over", and the main button seals without it. */
  sendsHere: boolean;
  sending: boolean;
  error: string | null;
  /** "Look it over" (mail-cards-experience 5.1): the fifth page, as it is. */
  onLook: () => void;
  /** The main button: check the card, then seal it by hand on the table (or send it, without the table). */
  onSeal: () => void;
  /** Digital stamps (postage on): the postage line, and with none left the main button opens the stamp books. */
  stamps?: Stamps | null;
  onGetStamps?: () => void;
  /** On the card's cloth (design plan Part 9): the choices on a cream slip. */
  onCloth?: boolean;
  /** The soft fade the pinned buttons sit on: the cloth's colour, or the page's. */
  fade?: string;
  /** That colour as "r, g, b": solid behind "Look it over" (design re-check of November 17). */
  solid?: string;
  /** "Let it travel" (server key card_travel; travelling card Part 2): null while the server doesn't offer it. */
  travel?: { on: boolean; who: string; onToggle: () => void } | null;
}) {
  // No stamp left (for a list, fewer than its cards): the main button opens the stamp books, as Look it over's does.
  const count = to.kind === 'list' ? to.entries.length : 1;
  const needsStamps = Boolean(stamps?.balance) && (stamps?.balance?.available ?? 0) < count;
  const busy = looking || sending;
  const preview = {
    id: `preview-${design.id}`,
    sender_display: fromName,
    sender_trust: 'pantopus_user',
    postmark: null,
    card: { design: design.id, number: design.number, caption: design.caption, paper: design.paper, holiday: cards.holiday,
      year: cards.year, arrival, sealed_until: null, sealed: arrival === 'sealed_christmas' },
  } as unknown as MailItemV2;
  return (
    <div data-testid="sendCardSeal">
    <div className="mt-3 px-4">
      <div className="mx-auto max-w-[380px] rotate-1">
        <MailPiece item={preview} recipientName={envelopeName(to)} opened={false} />
      </div>
      {to.kind === 'list' ? (
        <p className={`mx-auto mt-3 max-w-[420px] text-center text-[14px] leading-5 ${onCloth ? ON_CLOTH_MUTED : muted}`}>One envelope for each of the {to.entries.length} people.</p>
      ) : null}
      {(() => {
        const choices = (
        <fieldset className={onCloth ? '' : 'mx-auto mt-6 max-w-[420px]'}>
          <legend className="text-[16px] font-semibold">When should it arrive?</legend>
          <div className="mt-2.5 space-y-2.5">
            {options.map((option) => {
              const choice = arrivalChoice(option, cards, to, theirDay);
              const checked = arrival === option;
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#fffdf8] p-3.5 text-[#111827]"
                  style={{ border: checked ? `2px solid ${WAX}` : '1px solid #e3d8c3' }}
                >
                  <input type="radio" name="arrival" value={option} checked={checked} onChange={() => onArrival(option)} className="mt-1 h-4 w-4 accent-[#8b1d1d]" />
                  <span>
                    <span className="block text-[15px] font-semibold leading-5">{choice.title}</span>
                    <span className="block text-[13px] leading-[18px] text-[#4e5563]">{choice.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        );
        // "Let it travel": one row under the arrival choices, on the same paper (travelling card Part 2, D5).
        const travelRow = travel ? (
          <div className={onCloth ? 'mt-2.5' : 'mx-auto mt-2.5 max-w-[420px]'}>
            <div className={travelStyles.travelRow} onClick={travel.onToggle} data-testid="sendCardTravelRow">
              <span className={travelStyles.words}>
                {cards.improved ? (
                  <>
                    <b id="card-travel-label">Let this card travel</b>
                    <span>Let them pass this card on free to two people. Only your city appears on the postmark — never your note, photo, or street address.</span>
                  </>
                ) : (
                  <>
                    <b id="card-travel-label">Let it travel</b>
                    <span>{travel.who} can pass this card on. Its towns show on a map, never names.</span>
                  </>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={travel.on}
                aria-labelledby="card-travel-label"
                className={travelStyles.switch}
                onClick={(event) => { event.stopPropagation(); travel.onToggle(); }}
                data-testid="sendCardTravel"
              />
            </div>
          </div>
        ) : null;
        // On the cloth, the same three choices lie on a cream slip (design plan Part 9).
        return onCloth ? <div className="mt-6"><Slip>{choices}{travelRow}</Slip></div> : <>{choices}{travelRow}</>;
      })()}
      <p className="mx-auto mt-3.5 max-w-[420px] rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
        {/* Before it's sent we don't know their clock; the sent card says the time on this one. */}
        {takeBackBefore(to, arrival)}
      </p>
      {/* The postage line too (5.1), so a sender who goes straight to the table has read both. */}
      {stamps ? <div className="mx-auto mt-3 max-w-[420px]"><PostageLine stamps={stamps} design={design.id} count={to.kind === 'list' ? count : undefined} /></div> : null}
    </div>
      {/* "Seal and send" above "Look it over" (founder, November 17), both pinned at the bottom so they're on screen the
          moment the step opens (design check of November 17, Fix 2): on the same soft fade as Look it over's button, no
          panel. The take-back and postage lines scroll above them; a refusal is one line just above the buttons. */}
      <PinnedSend fade={fade} error={error} solidUnder={sendsHere ? undefined : solid}>
        <button
          type="button"
          data-testid="sendCardSend"
          disabled={!arrival || busy}
          onClick={needsStamps ? onGetStamps : onSeal}
          className={primary}
          style={{ backgroundColor: WAX }}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : to.kind === 'list' ? `Seal and send ${count} cards` : sendWords(to)}
        </button>
        {sendsHere ? null : (
          <button type="button" data-testid="sendCardLookOver" disabled={!arrival || busy} onClick={onLook} className={`mt-1 ${onCloth ? LOOK_QUIET_ON_CLOTH : LOOK_QUIET}`}>
            Look it over
          </button>
        )}
      </PinnedSend>
    </div>
  );
}

// ── Step 5: look it over ─────────────────────────────────────

function LookStep({
  preview,
  to,
  sending,
  error,
  onSend,
  stamps = null,
  design = '',
  onGetStamps,
  onSealOnTable,
  onCloth = false,
  fade = PAGE_FADE,
  improved = false,
  arrival = null,
}: {
  /** GET /cards `improved`: the card improvements of November 28 are on. */
  improved?: boolean;
  /** The arrival chosen on Seal it for the day (Right away can't be taken back). */
  arrival?: HolidayCardArrival | null;
  preview: HolidayCardPreview;
  to: Recipient;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  /** Digital stamps (postage on): the postage line, and with none left the button opens the stamp books. */
  stamps?: Stamps | null;
  design?: string;
  onGetStamps?: () => void;
  /** Seal it by hand on the table (design plan Part 2, launch key card_table) instead of sending it from here. */
  onSealOnTable?: () => void;
  /** On the card's cloth (design plan Part 9). */
  onCloth?: boolean;
  /** The soft fade the pinned button sits on: the cloth's colour, or the page's. */
  fade?: string;
}) {
  const needsStamps = stamps?.balance?.available === 0;
  return (
    <div data-testid="sendCardLook">
      <LookItOver onCloth={onCloth} preview={preview} toName={envelopeName(to)} toFirstName={to.kind === 'person' ? firstName(to.name) : ''} byEmail={to.kind !== 'person'} byLink={to.kind === 'link'} improved={improved} />
      {/* The take-back and postage lines end the page and scroll with it (5.2); they were on Seal it for the day too. */}
      <div className="mx-auto mt-7 max-w-[420px] px-4">
        <p className="rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
          {takeBackBefore(to, arrival)}
        </p>
        {stamps ? <div className="mt-3"><PostageLine stamps={stamps} design={design} /></div> : null}
      </div>
      <PinnedSend fade={fade} error={error}>
        <button type="button" data-testid="sendCardLookSend" disabled={sending} onClick={needsStamps ? onGetStamps : onSealOnTable ?? onSend} className={primary} style={{ backgroundColor: WAX }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : sendWords(to)}
        </button>
      </PinnedSend>
    </div>
  );
}

/**
 * Look it over's main button, pinned to the bottom (mail-cards-experience 5.2): only the button, on a soft fade of the
 * cloth with no panel behind it, so the card is in sight down to the button. A refusal is one line just above it, on its
 * own cream slip in dark red (as on the iPhone and Android): the fade's top edge is clear, and red words there ran over
 * whatever lay behind them (the arrival slip, the take-back line) and couldn't be read.
 */
function PinnedSend({ fade, error, solidUnder, children }: { fade: string; error: string | null; solidUnder?: string; children: ReactNode }) {
  // With a quiet button under the main one (Seal it for the day), the colour is solid behind it, so no word of the page
  // reads through (design re-check of November 17): clear at the top edge, the full colour by the main button's middle,
  // and full from there to the bottom of the screen. Look it over's own page, one button and nothing under it, keeps
  // the fade. Still no box and no line.
  const ref = useRef<HTMLDivElement | null>(null);
  const [middle, setMiddle] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!solidUnder || !box) return undefined;
    const measure = () => {
      const main = box.querySelector('button');
      if (!main) return;
      setMiddle(Math.round(main.getBoundingClientRect().top - box.getBoundingClientRect().top + main.getBoundingClientRect().height / 2));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [solidUnder, error]);
  // Before it's measured: the main button's middle with no refusal above it (12 px above the 48 px button).
  const stop = middle === null ? 'calc(12px + 1.5rem)' : `${middle}px`;
  const background = solidUnder
    ? `linear-gradient(to bottom, rgba(${solidUnder}, 0) 0, rgba(${solidUnder}, 1) ${stop}, rgba(${solidUnder}, 1) 100%)`
    : fade;
  return (
    <div ref={ref} className="sticky bottom-0 z-10 mt-4 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:-bottom-6" style={{ backgroundImage: background }} data-testid="sendCardPinned">
      <div className="mx-auto max-w-[420px]">
        {error ? <p role="alert" className="mb-2 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-2.5 text-[14px] font-medium leading-5 text-[#a81a1a] shadow-[0_2px_8px_rgba(0,0,0,0.12)]" data-testid="sendCardRefusal">{error}</p> : null}
        {children}
      </div>
    </div>
  );
}

// ── A list: look it over, and on its way ─────────────────────

/** The small round initial the name search shows. */
function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ebe3d4] text-[14px] font-semibold text-[#5b4a36]">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** What will happen to one card on the list, in a line. */
function lineWords(line: HolidayCardListLine): string {
  if (line.status === 'refused') return `${line.error} Won’t be sent.`;
  if (line.status === 'already_sent') return 'Already sent.';
  if (line.by_email && line.email_send_at) return `Gets an email ${emailGoesAt(line.email_send_at)}, your time.`;
  if (line.by_email) return line.arrival === 'sealed_christmas' ? 'Gets an email now. The card opens on Christmas morning.' : 'Gets an email now.';
  if (line.arrival === 'christmas_morning') return 'On Christmas morning, with their 7 a.m. mail.';
  if (line.arrival === 'sealed_christmas') return `Comes with their 7 a.m. mail on ${shortDay(line.arrives_on)}, sealed until Christmas.`;
  return `With their 7 a.m. mail on ${shortDay(line.arrives_on)}.`;
}

function ListLookStep({
  look,
  entries,
  idOf,
  sending,
  error,
  onSend,
  stamps,
  design,
  onGetStamps,
  onSealOnTable,
  onCloth = false,
  fade = PAGE_FADE,
  improved = false,
}: {
  /** GET /cards `improved`: the card improvements of November 28 are on. */
  improved?: boolean;
  look: HolidayCardListPreview;
  entries: ListEntry[];
  idOf: (entry: ListEntry) => string;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  stamps: Stamps | null;
  design: string;
  onGetStamps: () => void;
  /** Seal them by hand on the table (design plan Part 2): the moment plays once for the whole list. */
  onSealOnTable?: () => void;
  /** On the card's cloth (design plan Part 9). */
  onCloth?: boolean;
  /** The soft fade the pinned button sits on (5.2). */
  fade?: string;
}) {
  const byId = new Map(entries.map((entry) => [idOf(entry), entry]));
  const ready = look.recipients.filter((line) => line.status === 'ready');
  const first = ready.length ? byId.get(ready[0].request_id) ?? null : null;
  const needsStamps = Boolean(stamps?.balance) && (stamps?.balance?.available ?? 0) < look.needed;
  const cards = look.needed === 1 ? '1 card' : `${look.needed} cards`;
  return (
    <div data-testid="sendCardLook">
      {look.piece && first ? (
        <LookItOver onCloth={onCloth} preview={look as HolidayCardPreview} toName={entryName(first)} toFirstName={first.kind === 'person' ? firstName(first.name) : ''} byEmail={first.kind !== 'person'} improved={improved} />
      ) : null}
      <div className="mx-auto mt-7 max-w-[420px] px-4">
        <section aria-label="Who it’s going to" data-testid="sendCardListLook">
          <h2 className={`text-[16px] font-semibold ${onCloth ? 'text-[#f6ecd9]' : ''}`}>Going to {ready.length} {ready.length === 1 ? 'person' : 'people'}</h2>
          <ul className="mt-2 divide-y divide-[#e7dcc6] overflow-hidden rounded-xl border border-[#e3d8c3] bg-[#fffdf8] text-[#111827]">
            {look.recipients.map((line) => {
              const entry = byId.get(line.request_id);
              const name = entry ? entryName(entry) : line.status === 'ready' ? line.to_name ?? '' : '';
              return (
                <li key={line.request_id} className="flex items-start gap-3 px-3.5 py-2.5">
                  <Initial name={name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{name}</span>
                    <span className={`block text-[13px] leading-[18px] ${line.status === 'refused' ? 'text-[#a81a1a]' : 'text-[#4e5563]'}`}>{lineWords(line)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="mt-3 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
          {takeBackBefore({ kind: 'list', entries })}
        </p>
        {stamps && look.needed ? <div className="mt-3"><PostageLine stamps={stamps} design={design} count={look.needed} /></div> : null}
        {!look.needed ? <p className={`mt-3 text-center text-[14px] ${onCloth ? ON_CLOTH_MUTED : muted}`}>None of these cards can go now.</p> : null}
      </div>
      <PinnedSend fade={fade} error={error}>
        <button type="button" data-testid="sendCardLookSend" disabled={sending || !look.needed} onClick={needsStamps ? onGetStamps : onSealOnTable ?? onSend} className={primary} style={{ backgroundColor: WAX }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : sending ? `Sending ${cards}…` : `Seal and send ${cards}`}
        </button>
      </PinnedSend>
    </div>
  );
}

// A card on a list that didn't go only because of a hiccup (or the stamps ran out meanwhile): sending again can work.
const SEND_AGAIN = new Set(['CARD_UNAVAILABLE', 'BLOCK_CHECK_UNAVAILABLE', 'STAMPS_REQUIRED']);

function SentList({
  results,
  entries,
  idOf,
  designs,
  takenBack,
  takingBack,
  takeBackError,
  onTakeBack,
  onSendRest,
  sendingRest,
  restError,
  improved = false,
}: {
  /** GET /cards `improved`: the card improvements of November 28 are on. */
  improved?: boolean;

  results: HolidayCardListResult[];
  entries: ListEntry[];
  idOf: (entry: ListEntry) => string;
  designs: HolidayCardDesign[];
  /** Cards taken back from here: their stamps came back. */
  takenBack: Set<string>;
  takingBack: string | null;
  takeBackError: { id: string; message: string } | null;
  onTakeBack: (card: SentHolidayCard) => void;
  onSendRest: () => void;
  sendingRest: boolean;
  restError: string | null;
}) {
  const byId = new Map(entries.map((entry) => [idOf(entry), entry]));
  const went = results.flatMap((result) => (result.status === 'not_sent' ? [] : [result.card]));
  const stayed = results.flatMap((result) => (result.status === 'not_sent' ? [result] : []));
  const onTheirWay = went.filter((card) => !takenBack.has(card.id)).length;
  const again = stayed.some((result) => SEND_AGAIN.has(result.code));
  return (
    <section aria-label="On its way" data-testid="sendCardSentList" className="mx-auto mt-4 max-w-[420px] px-4 pb-4">
      <p className="text-[17px] font-semibold">{onTheirWay === 1 ? '1 card is on its way.' : `${onTheirWay} cards are on their way.`}</p>
      <ul className="mt-3 space-y-2.5">
        {went.map((card) => {
          const design = designs.find((d) => d.id === card.design);
          const back = takenBack.has(card.id);
          return (
            <li key={card.id} className="flex items-start gap-3 rounded-2xl border border-[#e3d8c3] bg-[#fffdf8] p-3 text-[#111827]">
              {design ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cardPicture(design.id, 'thumb')} alt="" className="w-[48px] flex-shrink-0 -rotate-2 rounded-[2px] shadow-[0_4px_10px_rgba(60,40,10,0.22)]" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">To {card.to_name || 'them'}</p>
                <p className="mt-0.5 text-[13px] leading-[18px] text-[#374151]">
                  {back ? 'You took this card back, and its stamp is back with you.' : arrivalLine(card, improved)}
                </p>
                {takeBackError?.id === card.id ? <p role="alert" className="mt-1 text-[13px] font-medium text-[#a81a1a]">{takeBackError.message}</p> : null}
                {card.can_take_back && !back ? (
                  <button
                    type="button"
                    data-testid={`sendCardTakeBack.${card.id}`}
                    onClick={() => onTakeBack(card)}
                    disabled={takingBack === card.id}
                    className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-[#d6cbb6] bg-[#fffdf8] px-3 text-[13px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50"
                  >
                    {takingBack === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Take it back
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {stayed.length ? (
        <div className="mt-4">
          <h2 className="text-[15px] font-semibold">Not sent</h2>
          <ul className="mt-2 space-y-2">
            {stayed.map((result) => {
              const entry = byId.get(result.request_id);
              return (
                <li key={result.request_id} className="rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-2.5 text-[13px] leading-[18px] text-[#374151]">
                  <span className="font-semibold text-[#111827]">Not sent to {entry ? entryName(entry) : 'them'}:</span> {result.error}{' '}
                  {result.code === 'CARD_TAKEN_BACK' ? 'Its stamp came back.' : 'No stamp was used.'}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {restError ? <p role="alert" className="mt-3 text-center text-[14px] font-medium text-[#a81a1a]">{restError}</p> : null}
      <div className="mt-4 space-y-2.5">
        {again ? (
          <button type="button" data-testid="sendCardSendRest" onClick={onSendRest} disabled={sendingRest} className={primary} style={{ backgroundColor: WAX }}>
            {sendingRest ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            Send the rest
          </button>
        ) : null}
        <Link href="/app/mailbox/personal" className={again ? secondary : primary} style={again ? undefined : { backgroundColor: WAX }}>Back to your mail</Link>
        <Link
          href="/app/mailbox/sent"
          data-testid="sendCardSeeInSent"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold text-[#7c4a2d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] [@media(prefers-color-scheme:dark)]:text-[#e8b996]"
        >
          <Send className="h-4 w-4" aria-hidden />
          See them in Sent
        </Link>
      </div>
      <p className={`mt-3 text-center text-[13px] ${muted}`}>One digital stamp per card. Receiving and replies are free.</p>
    </section>
  );
}

// ── A sent card: just now, or today's card ───────────────────

function SentCard({
  card,
  designs,
  title,
  seeInSent = false,
  postageEnabled = false,
  link = null,
  fromName,
  onTakeBack,
  takingBack,
  takeBackError,
  improved = false,
}: {
  /** GET /cards `improved`: the card improvements of November 28 are on. */
  improved?: boolean;
  card: SentHolidayCard;
  designs: HolidayCardDesign[];
  title: string;
  /** Just sent: a way to it in Sent. */
  seeInSent?: boolean;
  postageEnabled?: boolean;
  /** Just sent by link: the link itself. */
  link?: string | null;
  fromName: string;
  onTakeBack: () => void;
  takingBack: boolean;
  takeBackError: string | null;
}) {
  const design = designs.find((d) => d.id === card.design);
  const line = takeBackLine(card);
  const linkWaiting = Boolean(card.by_link) && card.can_take_back;
  return (
    <section aria-label={title} className="mx-auto mt-4 max-w-[420px] px-4 pb-4">
      <div className="flex items-start gap-4 rounded-2xl border border-[#e3d8c3] bg-[#fffdf8] p-4 text-[#111827]">
        {design ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardPicture(design.id, 'thumb')} alt="" className="w-[84px] flex-shrink-0 -rotate-2 rounded-[2px] shadow-[0_6px_14px_rgba(60,40,10,0.25)]" />
        ) : null}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#4e5563]">{title}</p>
          <p className="mt-0.5 truncate text-[17px] font-semibold">{card.by_link && card.status !== 'claimed' ? 'To whoever opens your link' : `To ${card.to_name || 'them'}`}</p>
          <p className="mt-1 text-[14px] leading-5 text-[#374151]">{arrivalLine(card, improved)}</p>
          {card.travel ? <p className="mt-1 text-[14px] leading-5 text-[#374151]" data-testid="sendCardTravelSent">{TRAVEL_SENT_LINE}</p> : null}
        </div>
      </div>
      {linkWaiting ? (
        <div className="mt-4">
          <CardLinkActions cardId={card.id} link={link} fromName={fromName} again={!link} />
        </div>
      ) : null}
      {line ? <p className={`mt-3 text-center text-[13px] leading-[18px] ${muted}`}>{line}</p> : null}
      {takeBackError ? <p role="alert" className="mt-2 text-center text-[14px] font-medium text-[#a81a1a]">{takeBackError}</p> : null}
      <div className="mt-4 space-y-2.5">
        {card.can_take_back ? (
          <button type="button" onClick={onTakeBack} disabled={takingBack} className={secondary}>
            {takingBack ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Take it back
          </button>
        ) : null}
        <Link href="/app/mailbox/personal" className={primary} style={{ backgroundColor: WAX }}>Back to your mail</Link>
        {seeInSent ? (
          <Link
            href={`/app/mailbox/sent/${card.id}`}
            data-testid="sendCardSeeInSent"
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold text-[#7c4a2d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] [@media(prefers-color-scheme:dark)]:text-[#e8b996]"
          >
            <Send className="h-4 w-4" aria-hidden />
            See it in Sent
          </Link>
        ) : null}
      </div>
      <p className={`mt-3 text-center text-[13px] ${muted}`}>{postageEnabled ? 'One digital stamp per card. Receiving and replies are free.' : 'One card a day. You can send another tomorrow.'}</p>
    </section>
  );
}

// ── The flow ─────────────────────────────────────────────────

export default function SendCardFlow({ chosenDesign = null, chosenPerson = null, sendAgain = false, thanks = false }: {
  /** "Send a thank-you card" on an opened Christmas card (Wave 5): open at the thank-you shelf, the person chosen. */
  thanks?: boolean;
  /** The picture a public card page, or a button under one of the assistant's replies, sent them here with (?design=). */
  chosenDesign?: string | null;
  /** "Send this card to someone else" from Sent (mail-cards-experience Part 6): its picture stays chosen and Pick a card
   *  is skipped. */
  sendAgain?: boolean;
  /** Send one back (launch key card_table): the person a card on the table sent them here for. */
  chosenPerson?: string | null;
}) {
  const router = useRouter();
  const cards = useHolidayCards();
  const { data: own } = useOwnLocalProfile();
  const { data: me } = useMe();
  const fromName = own?.profile?.displayName || me?.name || 'You';
  const preview = usePreviewHolidayCard();
  const send = useSendHolidayCard();
  const takeBack = useTakeBackHolidayCard();
  const saveSignature = useSaveCardSignature();
  const forgetSignature = useForgetCardSignature();

  // The step they're on; null: the flow's first step (`first`, below), which depends on the GET /cards read.
  const [stepState, setStep] = useState<Step | null>(null);
  // The step a new card starts on, once one was started here (null: `start`, below).
  const [firstState, setFirstState] = useState<Step | null>(null);
  // Pick a card first (Wave 3.1): where Write on the back was entered from, for its Back.
  const [writeFrom, setWriteFrom] = useState<'pick' | 'to'>('to');
  // What they will get, from the server's look (step 5).
  const [look, setLook] = useState<HolidayCardPreview | null>(null);
  // A choice that closed while they looked it over, or why a card sent from step 4 didn't go: step 4 says so.
  const [sealError, setSealError] = useState<string | null>(null);
  // The server can't show the look: step 4 says so and seals and sends itself. Each visit to step 4 asks again.
  const [lookUnavailable, setLookUnavailable] = useState(false);
  const [to, setTo] = useState<Recipient | null>(null);
  // A person's arrivals and day go by their clock, read once they're chosen and again on the last step.
  const theirs = useCardArrivals(to?.kind === 'person' ? to.userId : null);
  const [designId, setDesignId] = useState<string | null>(chosenDesign);
  // A photo card (Wave 4.2): the studio, and the front it made (frame, caption, the photo's shape).
  const [studioOpen, setStudioOpen] = useState(false);
  const [front, setFront] = useState<{ frame: CardFrame; caption: string; aspect: number } | null>(null);
  // Send this card to someone else (Part 6): the picture is already chosen, so Who it's for goes on to Write on the back.
  const [keepPicture, setKeepPicture] = useState(Boolean(sendAgain && chosenDesign && launchFeatures.cardTable));
  const [message, setMessage] = useState('');
  // Signed beside FROM (design plan 8.2); null: the first name typed in the pen, as before.
  const [signature, setSignature] = useState<CardSignature | null>(null);
  // The card's own photo (memories plan step 4): uploaded as soon as it's chosen.
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [photoAlt, setPhotoAlt] = useState('');
  // Its own voice greeting (memories plan step 7): uploaded as soon as the recording stops.
  const [voice, setVoice] = useState<VoiceDraft | null>(null);
  const [arrival, setArrival] = useState<HolidayCardArrival | null>(null);
  const [sent, setSent] = useState<SentHolidayCard | null>(null);
  // A card by link, just sent: its link, to copy and share.
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [takeBackError, setTakeBackError] = useState<string | null>(null);
  const [tookBack, setTookBack] = useState(false);
  // A retry of a card that was taken back meanwhile: the server's sentence, on a new card's first step.
  const [takenBackNote, setTakenBackNote] = useState<string | null>(null);
  // One request ID per card, sent with every look and retry of it, so a send whose answer was lost is answered with the
  // card it stored, never a second one. A new card starts once this one is sent or taken back.
  const requestId = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [stampSheet, setStampSheet] = useState(false);
  // A list (digital stamps on): who's on it, a request ID for each (kept for the whole card, so every look and retry
  // of the list finds the cards it already sent), its look and what sending it did.
  const previewList = usePreviewHolidayCardList();
  const sendList = useSendHolidayCardList();
  const [listed, setListed] = useState<ListEntry[]>([]);
  const listIds = useRef(new Map<string, string>());
  const [listLook, setListLook] = useState<HolidayCardListPreview | null>(null);
  const [listSent, setListSent] = useState<HolidayCardListResult[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listTakenBack, setListTakenBack] = useState<Set<string>>(() => new Set());
  const [listTakingBack, setListTakingBack] = useState<string | null>(null);
  const [listTakeBackError, setListTakeBackError] = useState<{ id: string; message: string } | null>(null);
  // The stamp books opened because a list's cards need more stamps than are left.
  const [stampShort, setStampShort] = useState<{ cards: number; missing: number } | null>(null);
  // Why the stamp books opened when free stamps don't cover the card: its photo or voice needs a bought one.
  const [stampReason, setStampReason] = useState<string | null>(null);
  // Sealing it by hand (design plan Part 2, launch key card_table): after Look it over, the card lies on the table and
  // goes the moment the seal is pressed home. What the table shows is kept here, so it stays through the send.
  const [sealing, setSealing] = useState<{ card: TableCard; note: string; fromName: string; toName: string; who: string; count: number; quick: boolean } | null>(null);
  const [sealShare, setSealShare] = useState(false);
  const [linkSaid, setLinkSaid] = useState<string | null>(null);
  // "Let it travel" (server key card_travel): on to begin with (D5). Someone with no town is asked once, "Where does it
  // start?", when they turn it on or seal with it on (D4); `townFor` is what goes on once they've chosen.
  const [travel, setTravel] = useState(true);
  const [townFor, setTownFor] = useState<{ then: (() => void) | null } | null>(null);
  const sealingOpen = useRef(false);
  sealingOpen.current = Boolean(sealing);

  const data = cards.data;
  // The card improvements of November 28 (contract section 1): only while this read says so; never kept beyond it.
  const improved = Boolean(data?.improved);
  // Pick a card first (Wave 3.1, `improved`): Pick a card → Who it's for → Write. Arriving with a card chosen (a card's
  // page, Send this card again) starts at Who it's for; arriving with a person chosen, at Pick a card, then Write.
  // Without `improved`: Who it's for → Pick a card → Write, as before.
  const steps = improved ? STEPS_PICK_FIRST : STEPS;
  const designArrival = Boolean(chosenDesign && data?.designs.some((d) => d.id === chosenDesign));
  const start: Step = improved && !designArrival ? 'pick' : 'to';
  const first = firstState ?? start;
  const step: Step = stepState ?? first;
  /** A new card's first step: everything the first step carries (today's card, the taken-back note, Back) is there. */
  const restart = (at: Step) => { setFirstState(at); setStep(at); };
  /** On to Write on the back, remembering where from (its Back goes there). */
  const toWrite = (from: 'pick' | 'to') => { setWriteFrom(from); setStep('write'); };
  // A photo card (Wave 4.2, `photo_card` on the read while `improved`): its design is never in `designs`.
  const photoCard = improved ? data?.photo_card ?? null : null;
  const isPhotoCard = Boolean(photoCard && designId === photoCard.design);
  // Thank-you cards (Wave 5, `thank_you` on the read while `improved`): their collections after every Christmas one on
  // Pick a card, or alone once `only`; their designs are never in `designs`. Words and dates come from the read.
  const thankYou = improved ? data?.thank_you ?? null : null;
  const isThankYou = Boolean(thankYou && designId && thankYou.designs.some((d) => d.id === designId));
  const catalogDesigns = useMemo(() => (!data ? [] : thankYou?.only ? thankYou.designs : [...data.designs, ...(thankYou?.designs ?? [])]), [data, thankYou]);
  const catalogCollections = useMemo(() => (!data ? [] : thankYou?.only ? thankYou.collections : [...(data.collections ?? []), ...(thankYou?.collections ?? [])]), [data, thankYou]);
  // Every design a sent card can name (Sent's lines): the Christmas ones and the thank-you ones.
  const allDesigns = useMemo(() => (!data ? [] : [...data.designs, ...(thankYou?.designs ?? [])]), [data, thankYou]);
  // A photo card or a thank-you card never travels (no travel switch).
  const travelOffer = isPhotoCard || isThankYou ? null : data?.travel ?? null;
  // Let this card travel (Wave 3.4): while `improved` the switch starts from `travel.default_on` (absent: on, as before).
  const travelStartsOn = improved ? travelOffer?.default_on ?? true : true;
  const travelStarted = useRef(false);
  useEffect(() => {
    if (travelStarted.current || !data) return;
    travelStarted.current = true;
    setTravel(travelStartsOn);
  }, [data, travelStartsOn]);
  const travelling = Boolean(travelOffer) && travel;
  // Runs `then` now, or once they've given their town (asked only while it travels and they have none).
  const withTown = (then: () => void) => {
    if (travelling && !travelOffer?.town) { setTownFor({ then }); return; }
    then();
  };
  // Their saved signature (founder, 2026-11-16): the next card starts signed with it.
  const savedSignature = launchFeatures.cardTable ? data?.signature?.saved ?? null : null;
  const max = data?.max_recipients ?? 1;
  const stamps = useStamps(Boolean(data?.postage_enabled), `${sent?.id ?? ''}:${listSent?.length ?? 0}:${listTakenBack.size}:${tookBack}:${step}`);
  // Wave 2 (only while `improved`): the first photo or voice cards are free (`media.free_allowance`; the server leaves
  // `bought_stamp` out while some are left). The "free" line shows only to a sender with at least one stamp of any kind
  // (contract fix 4); with no stamps at all, the photo and voice buttons open the stamp books with the line from before.
  const freeMediaAllowance = improved ? data?.media?.free_allowance ?? null : null;
  const stampsLeft = data?.postage_enabled ? stamps.balance?.available ?? data?.stamps?.available ?? null : null;
  const noStampsAtAll = Boolean(freeMediaAllowance) && stampsLeft === 0 && !data?.media?.bought_stamp;
  const mediaStamp: MediaStamp | null = noStampsAtAll
    ? stamps.balance?.sales_open === false ? 'unavailable' : 'buy'
    : mediaStampOf(data?.media?.bought_stamp, data?.postage_enabled ? stamps.balance : null, improved);
  const mediaNeedsStampLine = noStampsAtAll ? MEDIA_NEEDS_STAMP : mediaNeedsStampText(freeMediaAllowance);
  const paidRemaining = stamps.balance?.paid_remaining ?? data?.stamps?.paid_remaining ?? 0;
  const freeMediaHint = noStampsAtAll ? null : freeMediaHintText(freeMediaAllowance, paidRemaining, to?.kind === 'list' ? to.entries.length : 1);
  // After a send or a take-back the free allowance may have moved: read GET /cards again (only while `improved`).
  const refreshCards = () => { if (improved) void cards.refetch(); };
  // Why the stamp books opened for a photo or voice: the server's words while `improved`, else the line from before.
  const mediaStampReason = (error: { message?: string }) => (improved ? error.message || mediaNeedsStampLine : MEDIA_NEEDS_STAMP);
  const design = useMemo<HolidayCardDesign | null>(() => catalogDesigns.find((d) => d.id === designId)
    // The photo card's stock fields, as list reads and older builds print them ("Merry Christmas" on its stock picture).
    ?? (photoCard && designId === photoCard.design
      ? { id: photoCard.design, number: 0, caption: 'Merry Christmas', paper: '#f7f0e2', table: null, mood: null }
      : null), [catalogDesigns, designId, photoCard]);
  // "Pick a card" as shelves (server key card_shelves, card shelves SPEC Part C): null for today's screen. A collection's
  // page opens inside step 2 with its own entry in the browser's history (?collection=<slug>), so the browser's Back
  // returns to the shelves, where they were scrolled.
  const shelves = useMemo(() => (data ? shelvesOf({ ...data, designs: catalogDesigns, collections: catalogCollections }) : null), [data, catalogDesigns, catalogCollections]);
  const [pickCollection, setPickCollection] = useState<string | null>(null);
  const [shelvesTop, setShelvesTop] = useState<number | null>(null);
  const collectionPushed = useRef(false);
  const openShelf = (step === 'pick' && pickCollection && shelves?.find((s) => s.id === pickCollection)) || null;
  const openCollection = (shelf: Shelf) => {
    setShelvesTop(scrollerOf(document.querySelector('[data-testid="cardShelves"]')).scrollTop);
    const url = new URL(window.location.href);
    url.searchParams.set('collection', shelf.slug || shelf.id);
    window.history.pushState(null, '', url.toString());
    collectionPushed.current = true;
    setPickCollection(shelf.id);
  };
  // Back to the shelves: through the browser's history when the page has its entry there (popstate closes it).
  const closeCollection = () => {
    if (collectionPushed.current) { window.history.back(); return; }
    setPickCollection(null);
  };
  useEffect(() => {
    const onPop = () => {
      if (!collectionPushed.current) return;
      collectionPushed.current = false;
      setPickCollection(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Onward from step 2: a collection's page closes (and leaves the history), and coming back starts at the chosen card.
  const leavePick = () => {
    if (pickCollection) closeCollection();
    setShelvesTop(null);
  };
  // A collection's page gets the heading's focus too, without moving the page.
  useEffect(() => { if (step === 'pick' && shelves) headingRef.current?.focus({ preventScroll: true }); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickCollection]);
  const today = sent ?? (data?.today && data.today.status !== 'withdrawn' ? data.today : null);
  // Another card can go now (Part 6): a stamp left, or without stamps, today's card not used yet.
  const canSendAgain = Boolean(data?.open && designId)
    && (data?.postage_enabled ? (stamps.balance?.available ?? 0) > 0 : !today);
  const options = useMemo<HolidayCardArrival[]>(() => {
    if (!data || !to) return [];
    // A thank-you card (Wave 5): its own choices, nothing sealed; a chosen person's by their clock.
    if (isThankYou && thankYou) {
      const ty = thankYou.arrivals;
      if (to.kind === 'list') return to.entries.some((entry) => entry.kind === 'person') ? ty.person : ty.email;
      if (to.kind === 'person') return (theirs.data?.arrivals_all ?? ty.person).filter((a) => ty.person.includes(a));
      return to.kind === 'email' ? ty.email : ty.link;
    }
    // By email every choice the server offers (arrivals.email_all); a link keeps its two.
    const byEmail = data.arrivals.email_all ?? data.arrivals.email;
    if (to.kind === 'list') return to.entries.some((entry) => entry.kind === 'person') ? data.arrivals.person : byEmail;
    // Right away for a person (Wave 3.3): every choice, `now` included, only while `improved`.
    if (to.kind === 'person') {
      return improved
        ? theirs.data?.arrivals_all ?? data.arrivals.person_all ?? theirs.data?.arrivals ?? data.arrivals.person
        : theirs.data?.arrivals ?? data.arrivals.person;
    }
    return to.kind === 'email' ? byEmail : data.arrivals.email;
  }, [data, to, theirs.data, improved, isThankYou, thankYou]);

  const listId = (entry: ListEntry) => {
    const key = entryKey(entry);
    if (!listIds.current.has(key)) listIds.current.set(key, crypto.randomUUID());
    return listIds.current.get(key) as string;
  };
  const sameEntry = (a: ListEntry) => (b: ListEntry) => entryKey(a) === entryKey(b);
  const toggleListed = (entry: ListEntry) => setListed((now) => (now.some(sameEntry(entry))
    ? now.filter((e) => !sameEntry(entry)(e)) : now.length >= max ? now : [...now, entry]));
  const addListed = (entry: ListEntry) => setListed((now) => (now.some(sameEntry(entry)) || now.length >= max ? now : [...now, entry]));
  // One on the list goes as today's single card; two or more as a list.
  const continueWithList = () => {
    if (!listed.length) return;
    setTo(listed.length === 1 ? listed[0] : { kind: 'list', entries: listed });
    if (improved) { if (designId) toWrite('to'); else setStep('pick'); return; }
    setStep(keepPicture && designId ? 'write' : 'pick');
  };

  // "Send a thank-you card" (Wave 5): the thank-you shelf's page opens once, on Pick a card, with the person chosen.
  const thanksOpened = useRef(false);
  useEffect(() => {
    if (!thanks || thanksOpened.current || step !== 'pick' || !shelves || !thankYou) return;
    const shelf = shelves.find((s) => thankYou.collections.some((c) => c.id === s.id));
    if (!shelf) return;
    thanksOpened.current = true;
    openCollection(shelf);
    // Once, as the flow opens at its shelf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thanks, step, shelves, thankYou]);

  // Send one back: that person is already chosen and the flow opens at Pick a card, unless today's card has gone and
  // there are no stamps to send another (then this page shows today's card, as it always does). Once, as it opens.
  const choseOnce = useRef(false);
  useEffect(() => {
    if (choseOnce.current || !launchFeatures.cardTable || !data) return;
    choseOnce.current = true;
    const person = chosenPersonFor(chosenPerson);
    if (!person || !data.open) return;
    setTo({ kind: 'person', userId: person.userId, name: person.name });
    if (!(today && !data.postage_enabled)) setStep('pick');
  }, [data, chosenPerson, today]);

  // The card being written comes back after a reload of this tab (memories plan step 4, "Drafts"): who it's for, the
  // picture, the note and signature, the uploaded photo and greeting, the arrival and the request ID, so a retry after
  // a lost answer finds the card it stored. Once, as it opens; not when it opened for someone or a picture on purpose.
  // A card the assistant put together opens on Look it over (the effect after doLook).
  const lookOnOpen = useRef(false);
  const draftRead = useRef(false);
  useEffect(() => {
    if (draftRead.current || !data || !me?.id) return;
    draftRead.current = true;
    // A collection's page after a reload: its address comes back, and the page opens again if the card is at step 2.
    const fromAddress = new URL(window.location.href).searchParams.get('collection');
    if (fromAddress) {
      const url = new URL(window.location.href);
      url.searchParams.delete('collection');
      window.history.replaceState(null, '', url.toString());
    }
    // A new card starts with their saved signature beside FROM (founder, 2026-11-16); a draft brought back keeps its own.
    const saved = launchFeatures.cardTable ? data.signature?.saved ?? null : null;
    if (saved) setSignature(saved);
    // "Send this card again" from a photo card (?again=christmas-2026-photo): its photo went with it; the studio opens empty.
    if (chosenDesign && data.improved && data.photo_card && chosenDesign === data.photo_card.design) {
      setDesignId(null);
      setStudioOpen(true);
      return;
    }
    if (chosenPerson || chosenDesign) return;
    const draft = readCardDraft(me.id);
    if (!draft || !data.open) return;
    if (draft.to) {
      // A link's envelope name is kept only while `improved` (Wave 3.2).
      setTo(!improved && draft.to.kind === 'link' ? { kind: 'link' } : draft.to);
      setListed(draft.to.kind === 'list' ? draft.to.entries : draft.to.kind === 'link' ? [] : [draft.to]);
    }
    // A photo card (Wave 4.2) comes back with its photo and front, while the read still offers photo cards.
    const photoCardHere = Boolean(data.improved && data.photo_card && draft.designId === data.photo_card.design && draft.photo && draft.front);
    const designHere = Boolean(draft.designId && (data.designs.some((d) => d.id === draft.designId) || photoCardHere));
    if (photoCardHere) setFront(draft.front ?? null);
    if (designHere) setDesignId(draft.designId);
    setMessage(draft.message.slice(0, data.message_limit));
    // A card from the assistant is a new card: it starts with their saved signature too.
    setSignature(draft.fromAssistant ? saved : draft.signature);
    if (draft.photo) {
      setPhoto({ status: 'ready', progress: 1, file: null, localUrl: null, ref: draft.photo, error: null });
      setPhotoAlt(draft.photoAlt);
    }
    if (draft.voice) setVoice({ status: 'ready', blob: null, localUrl: null, ref: draft.voice, error: null });
    setArrival(draft.arrival);
    requestId.current = draft.requestId;
    listIds.current = new Map(draft.listIds);
    // Pick a card first (`improved`): no picture yet, Pick a card; a picture and no one yet, Who it's for.
    const at = improved
      ? (!designHere ? 'pick' : !draft.to ? 'to' : draft.step)
      : (!draft.to ? 'to' : !designHere ? 'pick' : draft.step);
    setStep(at);
    // A card from the assistant opens on Look it over, where the person sees all of it (below).
    lookOnOpen.current = Boolean(draft.fromAssistant) && at === 'seal';
    const shelf = at === 'pick' && fromAddress ? shelves?.find((s) => s.slug === fromAddress || s.id === fromAddress) : undefined;
    if (shelf) openCollection(shelf);
    // Once, as the flow opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, me?.id, chosenPerson, chosenDesign]);
  // Kept as it changes (an upload only once it's stored), and gone once the card is sent, taken back or started over.
  // A send starting is a change too: the request ID it carries is kept before its answer comes.
  const sending = send.isPending || preview.isPending || sendList.isPending || previewList.isPending;
  useEffect(() => {
    if (!draftRead.current || !me?.id) return;
    if (step === 'sent' || sent || listSent || (!to && !designId && !message.trim())) { clearCardDraft(); return; }
    saveCardDraft({
      user: me.id,
      step: step === 'look' ? 'seal' : step,
      to,
      designId,
      message,
      signature,
      photo: photo?.status === 'ready' ? photo.ref : null,
      photoAlt,
      voice: voice?.status === 'ready' ? voice.ref : null,
      arrival,
      requestId: requestId.current,
      listIds: [...listIds.current],
      front,
    });
  }, [me?.id, step, sent, listSent, to, designId, message, signature, photo, photoAlt, voice, arrival, sending, front]);

  // Each step starts at its heading, for keyboards and screen readers.
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  // The arrival choices depend on who it's for; pick the first that's open.
  useEffect(() => {
    if (!options.length) return;
    if (!arrival || !options.includes(arrival)) setArrival(options[0]);
  }, [options, arrival]);

  // Back keeps everything chosen and written; only the last answers' errors go.
  const back = () => {
    if (openShelf) { closeCollection(); return; }
    if (step === 'pick') leavePick();
    if (step === first || step === 'sent') { router.push('/app/mailbox/personal'); return; }
    if (improved) {
      // Pick a card first: Write goes back where it came from; Who it's for to Pick a card, and Pick a card (opened
      // from Who it's for, a card having been chosen on arriving) back to Who it's for.
      setStep(step === 'write' ? writeFrom : step === 'to' ? 'pick' : step === 'pick' ? 'to' : STEPS[STEPS.indexOf(step) - 1]);
    } else {
      setStep(STEPS[STEPS.indexOf(step) - 1]);
    }
    setLook(null);
    setListLook(null);
    setSealError(null);
    setListError(null);
    preview.reset();
    send.reset();
    previewList.reset();
    sendList.reset();
  };

  // The list as it stands, every card with its own request ID.
  const listToSend = (entries: ListEntry[]): HolidayCardList | null => {
    if (!design || !arrival) return null;
    return {
      design: design.id,
      message: message.trim(),
      arrival,
      use_stamp: true,
      recipients: entries.map((entry) => ({
        to: entry.kind === 'person' ? { user_id: entry.userId } : { email: entry.email.trim() },
        request_id: listId(entry),
      })),
      ...(signature ? { signature } : {}),
      // A list's photo and voice go only while `improved` (Wave 2); before it a list went without.
      ...(improved && photoReady ? { photo: photoReady.file_id, ...(photoAlt.trim() ? { photo_alt: photoAlt.trim() } : {}) } : {}),
      ...(improved && voiceReady ? { voice: voiceReady.file_id } : {}),
      ...frontToSend,
      // Each address keeps the list's choice where the server offers every email choice.
      ...(data?.arrivals.email_all ? { emails_keep_arrival: true } : {}),
      ...(travelling ? { travel: true } : {}),
    };
  };

  const uploadPhoto = (file: File) => {
    setPhoto((before) => {
      if (before?.localUrl) URL.revokeObjectURL(before.localUrl);
      return { status: 'uploading', progress: 0, file, localUrl: URL.createObjectURL(file), ref: null, error: null };
    });
    const mine = (draft: PhotoDraft | null) => Boolean(draft && draft.file === file);
    cardPhotoToSend(file, data?.media?.photo.long_side || 2400)
      .then((body) => mailbox.uploadHolidayCardMedia('photo', body))
      .then(({ media }) => setPhoto((d) => (mine(d) ? { ...d!, status: 'ready', progress: 1, ref: media } : d)))
      .catch((error: unknown) => setPhoto((d) => (mine(d)
        ? { ...d!, status: 'failed', error: cardUploadFailure(error, 'photo') } : d)));
  };
  const removePhoto = () => {
    setPhoto((before) => { if (before?.localUrl) URL.revokeObjectURL(before.localUrl); return null; });
    setPhotoAlt('');
  };
  const photoReady = photo?.status === 'ready' && photo.ref ? photo.ref : null;
  // The photo card's front wherever this flow draws the card (PaperFront reads it): the photo as chosen here, or after
  // a reload its upload, read back from the sender's own route.
  const { url: ownFrontUrl } = useCardMediaUrl(isPhotoCard && front && !photo?.localUrl && photo?.ref ? { own: photo.ref.file_id } : null);
  const flowFront: PhotoFront | null = isPhotoCard && front && photoCard
    ? { design: photoCard.design, frame: front.frame, caption: front.caption || null, aspect: front.aspect, src: photo?.localUrl ?? ownFrontUrl }
    : null;
  const frontToSend = isPhotoCard && front ? { front: { frame: front.frame, ...(front.caption ? { caption: front.caption } : {}) } } : {};

  const uploadVoice = (blob: Blob) => {
    setVoice((before) => {
      if (before?.localUrl && before.blob !== blob) URL.revokeObjectURL(before.localUrl);
      return { status: 'uploading', blob, localUrl: before?.blob === blob ? before.localUrl : URL.createObjectURL(blob), ref: null, error: null };
    });
    const mine = (draft: VoiceDraft | null) => Boolean(draft && draft.blob === blob);
    mailbox.uploadHolidayCardMedia('voice', blob)
      .then(({ media }) => setVoice((d) => (mine(d) ? { ...d!, status: 'ready', ref: media } : d)))
      .catch((error: unknown) => setVoice((d) => (mine(d)
        ? { ...d!, status: 'failed', error: cardUploadFailure(error, 'voice') } : d)));
  };
  const removeVoice = () => setVoice((before) => { if (before?.localUrl) URL.revokeObjectURL(before.localUrl); return null; });
  const voiceReady = voice?.status === 'ready' && voice.ref ? voice.ref : null;

  const cardToSend = () => {
    if (!to || to.kind === 'list' || !design || !arrival) return null;
    requestId.current ??= crypto.randomUUID();
    return {
      design: design.id,
      message: message.trim(),
      arrival,
      // A link's envelope name (Wave 3.2) goes only while `improved`; without one the card is as before.
      to: to.kind === 'person' ? { user_id: to.userId } : to.kind === 'email' ? { email: to.email }
        : improved && to.name ? { link: true as const, name: to.name } : { link: true as const },
      request_id: requestId.current,
      ...(data?.postage_enabled ? { use_stamp: true } : {}),
      ...(signature ? { signature } : {}),
      ...(photoReady ? { photo: photoReady.file_id, ...(photoAlt.trim() ? { photo_alt: photoAlt.trim() } : {}) } : {}),
      ...(voiceReady ? { voice: voiceReady.file_id } : {}),
      ...frontToSend,
      ...(travelling ? { travel: true } : {}),
    };
  };

  // Everything written goes, and the next card starts on its first step with a request ID of its own.
  const startOver = () => {
    setSealing(null);
    setSealShare(false);
    requestId.current = null;
    listIds.current = new Map();
    setSent(null);
    setSentLink(null);
    setTo(null); setDesignId(null); setMessage(''); setSignature(savedSignature); removePhoto(); removeVoice(); setArrival(null); setLook(null); setLookUnavailable(false);
    setListed([]); setListLook(null); setListSent(null); setListError(null); setListTakenBack(new Set()); setListTakeBackError(null);
    setKeepPicture(false);
    setFront(null); setStudioOpen(false);
    // A new card's travel switch starts where the server says (Wave 3.4, `improved`); before, it kept the last one's.
    if (improved) setTravel(travelStartsOn);
    restart(improved ? 'pick' : 'to');
  };

  // "Make a photo card" (Wave 4.2): the studio, or with no stamp to carry a photo, the stamp books and why.
  const openStudio = () => {
    if (mediaStamp === 'buy') { setStampShort(null); setStampReason(mediaNeedsStampLine); void stamps.refresh(); setStampSheet(true); return; }
    setStudioOpen(true);
  };
  // "Use this photo card": its design, its front, and its cropped photo through the card's own upload; then on.
  const takePhotoCard = (made: PhotoCardMade) => {
    if (!photoCard) return;
    leavePick();
    setDesignId(photoCard.design);
    setFront({ frame: made.frame, caption: made.caption, aspect: made.aspect });
    setPhotoAlt('');
    uploadPhoto(made.file);
    setStudioOpen(false);
    if (to) toWrite('pick'); else setStep('to');
  };

  // "Send this card to someone else" (mail-cards-experience Part 6): the same picture and the saved signature; the note
  // starts empty and the arrival is asked again. Who it's for, then Write on the back, then Seal it for the day.
  const sendThisAgain = () => {
    const picture = designId;
    startOver();
    // A photo card's photo went with that card: the studio opens empty (Wave 4.2).
    if (photoCard && picture === photoCard.design) { setStudioOpen(true); return; }
    if (picture) { setDesignId(picture); setKeepPicture(true); if (improved) restart('to'); }
  };

  // This card already went with an earlier try whose answer was lost: show the card it sent, or, once it was taken
  // back, say so and start a new card. True when it was one of those.
  const wentEarlier = (error: MailboxApiError) => {
    const card = error.serverCode === 'CARD_REQUEST_SENT' ? (error.data?.card as SentHolidayCard | undefined) : undefined;
    if (card) {
      requestId.current = null;
      setSent(card); setLook(null); setStep('sent');
    } else if (error.serverCode === 'CARD_TAKEN_BACK') {
      setTakenBackNote(error.message);
      startOver();
    } else {
      return false;
    }
    preview.reset();
    send.reset();
    return true;
  };

  const doLook = () => {
    if (to?.kind === 'list') {
      const list = listToSend(to.entries);
      if (!list) return;
      setSealError(null);
      previewList.mutate(list, {
        onSuccess: (res) => { setListLook(res); setListError(null); setStep('look'); },
        // A refusal of the whole list (the season closed, or bought stamps needed for media) shows under the choices.
        onError: (error) => {
          if (improved && error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
            const reason = mediaStampReason(error);
            setSealError(reason);
            void stamps.refresh();
            refreshCards();
            setStampShort(null);
            setStampReason(reason);
            setStampSheet(true);
            return;
          }
          setSealError(sendMessage(error));
        },
      });
      return;
    }
    const card = cardToSend();
    if (!card) return;
    setSealError(null);
    preview.mutate(card, {
      onSuccess: (res) => {
        // An answer without the card can't be shown.
        if (!res?.piece) { setLookUnavailable(true); return; }
        setLook(res);
        setStep('look');
      },
      onError: (error) => {
        if (wentEarlier(error)) return;
        if (error.serverCode === 'CARD_TRAVEL_NEEDS_TOWN') { preview.reset(); setTownFor({ then: doLook }); return; }
        // Right away twice to one person in a day (Wave 3.3): their morning mail is offered, the server's words above it.
        if (error.serverCode === 'CARD_SAME_DAY') setArrival('next_morning');
        if (lookIsUnavailable(error)) setLookUnavailable(true);
        // Its photo or voice needs a bought stamp: the stamp books open; step 4 says why, and the card stays as it is.
        if (error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
          void stamps.refresh();
          refreshCards();
          setStampShort(null);
          setStampReason(mediaStampReason(error));
          setStampSheet(true);
        }
      },
    });
  };

  // A card the assistant put together (cardDraft.startAssistantCard) comes back at Seal it for the day with everything
  // chosen. Once, when its arrival is settled, the flow asks for the look the "Look it over" button asks for, so the
  // person lands on the whole card with "Seal and send" under it. If the look can't be had, or the card would first
  // ask where it starts its travels, they stay on Seal it for the day, which says why and has the same button.
  useEffect(() => {
    if (!lookOnOpen.current || step !== 'seal' || !design || !to || !arrival || !options.includes(arrival)) return;
    // A person's arrivals go by their clock: wait for them, so the look asks with the arrival that stays.
    if (to.kind === 'person' && theirs.isPending) return;
    lookOnOpen.current = false;
    if (travelling && !travelOffer?.town) return;
    doLook();
    // Once, when the card from the assistant is ready to be looked over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, design, to, arrival, options, theirs.isPending]);

  // "Seal and send" on Seal it for the day (mail-cards-experience 5.1): the same check Look it over runs, then straight to
  // the sealing table (without the card table, it sends from here). A refusal shows under the choices. A list with any
  // card that won't go, or too few stamps for it, opens Look it over instead, which shows each person's line.
  const doSealFromSeal = () => {
    if (lookUnavailable) {
      if (launchFeatures.cardTable) openSealing(null);
      else doSend();
      return;
    }
    if (to?.kind === 'list') {
      const list = listToSend(to.entries);
      if (!list) return;
      setSealError(null);
      previewList.mutate(list, {
        onSuccess: (res) => {
          setListLook(res);
          setListError(null);
          const everyOneGoes = res.needed > 0 && res.recipients.every((line) => line.status === 'ready');
          const enoughStamps = !stamps.balance || (stamps.balance.available ?? 0) >= res.needed;
          if (everyOneGoes && enoughStamps && launchFeatures.cardTable) openSealing(res.piece ?? null);
          else setStep('look');
        },
        onError: (error) => {
          if (improved && error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
            const reason = mediaStampReason(error);
            setSealError(reason);
            void stamps.refresh();
            refreshCards();
            setStampShort(null);
            setStampReason(reason);
            setStampSheet(true);
            return;
          }
          setSealError(sendMessage(error));
        },
      });
      return;
    }
    const card = cardToSend();
    if (!card) return;
    setSealError(null);
    preview.mutate(card, {
      onSuccess: (res) => {
        // An answer without the card can't be shown: the seal still runs every check as it sends.
        if (!res?.piece) setLookUnavailable(true);
        else setLook(res);
        if (launchFeatures.cardTable) openSealing(res?.piece ?? null);
        else doSend();
      },
      onError: (error) => {
        if (wentEarlier(error)) return;
        if (error.serverCode === 'CARD_TRAVEL_NEEDS_TOWN') { preview.reset(); setTownFor({ then: doSealFromSeal }); return; }
        if (error.serverCode === 'CARD_SAME_DAY') setArrival('next_morning');
        if (lookIsUnavailable(error)) {
          setLookUnavailable(true);
          preview.reset();
          if (launchFeatures.cardTable) openSealing(null);
          return;
        }
        if (error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
          void stamps.refresh();
          refreshCards();
          setStampShort(null);
          setStampReason(mediaStampReason(error));
          setStampSheet(true);
        }
      },
    });
  };

  const doSend = () => {
    const card = cardToSend();
    if (!card) return;
    // From step 4 (the look can't be shown), a refusal shows under its choices.
    const fromSeal = step === 'seal';
    setSealError(null);
    send.mutate(card, {
      onSuccess: (res) => { requestId.current = null; setSent(res.card); setSentLink(res.link ?? null); setLook(null); setStep('sent'); refreshCards(); },
      onError: (error) => {
        if (wentEarlier(error)) return;
        // The stamps ran out meanwhile (another tab or phone sent a card): the stamp books open; the card stays as it is.
        if (error.serverCode === 'STAMPS_REQUIRED') {
          send.reset();
          void stamps.refresh();
          setStampSheet(true);
          return;
        }
        // Its photo or voice needs a bought stamp and none is left: the same, and step 4 says why.
        if (error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
          setSealError(error.message || mediaNeedsStampLine);
          send.reset();
          void stamps.refresh();
          refreshCards();
          setStampShort(null);
          setStampReason(mediaStampReason(error));
          setStampSheet(true);
          return;
        }
        if (error.serverCode !== 'CARD_ARRIVAL_CLOSED' && error.serverCode !== 'CARD_SAME_DAY') {
          if (fromSeal) { setSealError(sendMessage(error, to?.kind === 'email')); send.reset(); }
          return;
        }
        // Right away twice to one person in a day (Wave 3.3): back on step 4 with their morning mail chosen.
        if (error.serverCode === 'CARD_SAME_DAY') setArrival('next_morning');
        // Their 7 a.m. came while they looked it over: choose again on step 4, with what's open now.
        setSealError(sendMessage(error));
        send.reset();
        setLook(null);
        setStep('seal');
        void cards.refetch();
        if (to?.kind === 'person') void theirs.refetch();
      },
    });
  };

  // Send the list, card by card; again ("Send the rest") with the same request IDs, so only the cards that didn't go
  // can go. Too few stamps: nothing went, and the stamp books open saying how many more these cards need.
  const doSendList = () => {
    if (to?.kind !== 'list') return;
    const list = listToSend(to.entries);
    if (!list) return;
    setListError(null);
    sendList.mutate(list, {
      onSuccess: (res) => { setListSent(res.results); setListLook(null); setStep('sent'); refreshCards(); },
      onError: (error) => {
        if (error.serverCode === 'STAMPS_REQUIRED') {
          const needed = Number(error.data?.needed) || list.recipients.length;
          const have = Number(error.data?.available) || 0;
          setStampShort({ cards: needed, missing: Math.max(1, needed - have) });
          void stamps.refresh();
          setStampSheet(true);
          return;
        }
        if (improved && error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
          const reason = mediaStampReason(error);
          setListError(reason);
          void stamps.refresh();
          refreshCards();
          setStampShort(null);
          setStampReason(reason);
          setStampSheet(true);
          return;
        }
        setListError(sendMessage(error));
      },
    });
  };

  // One card on a sent list taken back: its stamp comes back.
  const doTakeBackFromList = async (card: SentHolidayCard) => {
    const yes = await askTakeBack({ byEmail: card.by_email, sentToday: false, postage: true, notEmailed: Boolean(card.email_send_at) });
    if (!yes) return;
    setListTakeBackError(null);
    setListTakingBack(card.id);
    takeBack.mutate(card.id, {
      onSuccess: () => { setListTakenBack((now) => new Set(now).add(card.id)); refreshCards(); },
      onError: (error) => setListTakeBackError({ id: card.id, message: sendMessage(error) }),
      onSettled: () => setListTakingBack(null),
    });
  };

  // ── Sealing it by hand on the table ──
  // `checked`: the piece the server's check just answered with (from Seal it for the day, before its state has landed);
  // null when the look couldn't be shown; left out from Look it over.
  const openSealing = (checked?: MailItemV2 | null) => {
    if (!to || !data) return;
    const piece = checked !== undefined ? checked : to.kind === 'list' ? listLook?.piece : look?.piece;
    const card: TableCard | null = piece?.card ?? (design ? {
      design: design.id, number: design.number, caption: design.caption, paper: design.paper, table: design.table ?? null,
      mood: design.mood ?? null, year: data.year, sealed: false, signature,
    } : null);
    if (!card) return;
    setLinkSaid(null);
    setSealing({
      card,
      note: piece?.content || message.trim(),
      fromName: piece?.sender_display || fromName,
      toName: (to.kind !== 'list' && piece?.recipient_name) || envelopeName(to),
      who: to.kind === 'person' ? firstName(to.name) : toName(to),
      count: to.kind === 'list' ? to.entries.length : 1,
      // Quick seal (Wave 3.5, `improved`): only after a card was sealed on the table on this device.
      quick: improved && sealedOnceHere(),
    });
  };

  // The seal is on: send it now, with the card's request ID, as "Seal and send" does. Answers whether it went; a
  // refusal leaves the card unsent and says why (no stamps: the stamp books open over the table).
  const sealAndSend: SendMoment['onSeal'] = () => new Promise((resolve) => {
    const refused = (message: string | null = null) => resolve({ ok: false, message });
    if (to?.kind === 'list') {
      const list = listToSend(to.entries);
      if (!list) { refused(); return; }
      setListError(null);
      sendList.mutate(list, {
        onSuccess: (res) => {
          setListSent(res.results);
          refreshCards();
          resolve({ ok: true });
          if (!sealingOpen.current) { setListLook(null); setStep('sent'); }
        },
        onError: (error) => {
          if (error.serverCode === 'STAMPS_REQUIRED') {
            const needed = Number(error.data?.needed) || list.recipients.length;
            const have = Number(error.data?.available) || 0;
            setStampShort({ cards: needed, missing: Math.max(1, needed - have) });
            void stamps.refresh();
            setStampSheet(true);
            refused();
            return;
          }
          if (improved && error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
            const reason = mediaStampReason(error);
            void stamps.refresh();
            refreshCards();
            setStampShort(null);
            setStampReason(reason);
            setStampSheet(true);
            refused(reason);
            return;
          }
          refused(sendMessage(error));
        },
      });
      return;
    }
    const card = cardToSend();
    if (!card) { refused(); return; }
    send.mutate(card, {
      onSuccess: (res) => {
        requestId.current = null;
        setSent(res.card);
        setSentLink(res.link ?? null);
        refreshCards();
        resolve({ ok: true });
        if (!sealingOpen.current) { setLook(null); setStep('sent'); }
      },
      onError: (error) => {
        const earlier = error.serverCode === 'CARD_REQUEST_SENT' ? (error.data?.card as SentHolidayCard | undefined) : undefined;
        if (earlier) {
          // An earlier try went and its answer was lost: this is that card.
          requestId.current = null;
          setSent(earlier);
          send.reset();
          resolve({ ok: true });
          return;
        }
        if (error.serverCode === 'CARD_TAKEN_BACK') { refused(); wentEarlier(error); return; }
        if (error.serverCode === 'STAMPS_REQUIRED') {
          send.reset();
          void stamps.refresh();
          setStampSheet(true);
          refused();
          return;
        }
        // Its photo or voice needs a bought stamp: the stamp books open over the table, and the table says why.
        if (error.serverCode === 'CARD_MEDIA_NEEDS_STAMP') {
          send.reset();
          void stamps.refresh();
          refreshCards();
          setStampShort(null);
          setStampReason(mediaStampReason(error));
          setStampSheet(true);
          refused(error.message || mediaNeedsStampLine);
          return;
        }
        if (error.serverCode === 'CARD_ARRIVAL_CLOSED' || error.serverCode === 'CARD_SAME_DAY') {
          // Their 7 a.m. came while they looked it over: choose again on step 4, as before. Right away twice to one
          // person in a day (Wave 3.3): the same, with their morning mail chosen.
          if (error.serverCode === 'CARD_SAME_DAY') setArrival('next_morning');
          refused();
          setSealing(null);
          setSealError(sendMessage(error));
          send.reset();
          setLook(null);
          setStep('seal');
          void cards.refetch();
          if (to?.kind === 'person') void theirs.refetch();
          return;
        }
        send.reset();
        refused(sendMessage(error, to?.kind === 'email'));
      },
    });
  });

  // The table closes: what was sent shows underneath; nothing sent, they're back at Look it over.
  const closeSealing = () => {
    setSealing(null);
    setSealShare(false);
    if (sent || listSent) { setLook(null); setListLook(null); setStep('sent'); }
  };
  const listWent = listSent?.filter((result) => result.status !== 'not_sent').length ?? 0;
  const listMissed = (listSent?.length ?? 0) - listWent;
  // Done: back to the Mailbox, where the flag is up. A list with cards that didn't go shows which, to send them again.
  const sealingDone = () => {
    if (listMissed) { closeSealing(); return; }
    setSealing(null);
    router.push('/app/mailbox/personal');
  };
  const copySealedLink = async () => {
    if (!sentLink) return;
    try { await navigator.clipboard.writeText(sentLink); setLinkSaid('Link copied'); } catch { setLinkSaid('Couldn’t copy it from here. Select the link and copy it.'); }
  };
  const shareSealedLink = async () => {
    if (!sentLink) return;
    try {
      await navigator.share({ text: `A ${isThankYou && thankYou ? thankYou.name : 'Christmas card'} for you from ${firstNameOf(fromName)}: ${sentLink}` });
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') setLinkSaid('Couldn’t open the share sheet. Copy the link and send it yourself.');
    }
  };

  const doTakeBack = async () => {
    if (!today) return;
    // Today's card: taking it back frees the day.
    const yes = await askTakeBack({ byEmail: today.by_email, byLink: today.by_link, sentToday: true, postage: Boolean(data?.postage_enabled), notEmailed: Boolean(today.email_send_at) });
    if (!yes) return;
    setTakeBackError(null);
    takeBack.mutate(today.id, {
      onSuccess: () => {
        setTookBack(true);
        setTakenBackNote(null);
        refreshCards();
        startOver();
      },
      onError: (error) => setTakeBackError(sendMessage(error)),
    });
  };

  if (cards.isPending) {
    return (
      <div className={`${page} flex min-h-[60vh] items-center justify-center`} role="status" aria-label="Loading the Christmas cards">
        <Loader2 className="h-6 w-6 animate-spin text-[#8b1d1d]" aria-hidden />
      </div>
    );
  }
  if (cards.isError || !data) {
    return (
      <div className={page}>
        <ErrorState title="Couldn't load the Christmas cards" message={mailLoadMessage(cards.error)} onRetry={() => { void cards.refetch(); }} />
      </div>
    );
  }

  // Today's card, once it's sent. A card sent from elsewhere while this one is being written doesn't take over: its
  // step says why this one can't go (one card a day).
  if (today && step === first) {
    return (
      <div className={page}>
        <div className="mx-auto w-full max-w-[560px]">
          <StepHeader step="sent" title="Today's card" onBack={() => router.push('/app/mailbox/personal')} headingRef={headingRef} />
          <SentCard card={today} designs={allDesigns} title="Today's card" fromName={fromName} onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} improved={improved} />
        </div>
      </div>
    );
  }

  // Nothing can be sent: Christmas cards closed and no thank-you card open (Wave 5).
  if (!data.open && !thankYou) {
    return (
      <div className={page}>
        <StepHeader step="sent" title="Christmas cards" onBack={() => router.push('/app/mailbox/personal')} headingRef={headingRef} />
        <div className="mx-auto mt-10 max-w-[420px] px-6 text-center">
          <p className="text-[22px]" style={{ fontFamily: SERIF, color: WAX }}>Christmas cards are done for this year</p>
          <p className={`mt-2 text-[15px] leading-[22px] ${muted}`}>The cards you received stay in your mailbox.</p>
          <Link href="/app/mailbox/personal" className={`${primary} mt-6`} style={{ backgroundColor: WAX }}>Back to your mail</Link>
        </div>
      </div>
    );
  }

  // Write on the back, Seal it for the day and Look it over lie on the card's cloth (design plan Part 9, card_table).
  const atTable = launchFeatures.cardTable && Boolean(design) && (step === 'write' || step === 'seal' || step === 'look');

  // "Pick a card" as shelves is a wide page: its title, its headings and each row's first card start on one line, and
  // the rows end with the page. The other steps keep the narrow column.
  const widePage = step === 'pick' && Boolean(shelves);

  return (
    <PhotoFrontContext.Provider value={flowFront}>
    {/* A thank-you card (Wave 5): "THANK YOU, {year}" from the read under its picture and on its back. */}
    <CardStripContext.Provider value={isThankYou && thankYou ? thankYou.strip : null}>
    <div className={`${page} pb-6`}>
      <div className={`mx-auto w-full ${widePage ? 'max-w-[1240px]' : 'max-w-[560px]'}`}>
      <StepHeader
        step={step}
        title={step === 'sent' && sent?.by_link ? 'Your card is ready.' : openShelf ? 'All collections' : undefined}
        onBack={back}
        headingRef={headingRef}
        steps={steps}
        trailing={data.postage_enabled ? <StampChip stamps={stamps} onOpen={() => { setStampShort(null); setStampReason(null); setStampSheet(true); }} /> : null}
      />
      {data.postage_enabled ? (
        <StampSheet open={stampSheet} onClose={() => { setStampSheet(false); setStampShort(null); setStampReason(null); }} stamps={stamps} short={stampShort} reason={stampReason} overTable={Boolean(sealing)} />
      ) : null}
      {(tookBack || takenBackNote) && step === first ? (
        <p role="status" className="mx-4 mt-2 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-2.5 text-[14px] text-[#374151]">
          {takenBackNote ?? (data.postage_enabled ? 'You took your card back, and its stamp is back with you.' : 'You took your card back. You can send a card again today.')}
        </p>
      ) : null}
      {step !== 'to' && step !== 'sent' && to ? (
        <p className={`mt-1 px-4 text-[14px] leading-5 ${muted}`}>To {toName(to)}</p>
      ) : null}
      {/* A photo card (Wave 4.2): one quiet pill under the heading; the catalog and its order are untouched. */}
      {step === 'pick' && photoCard && mediaStamp !== 'unavailable' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2.5 px-4" data-testid="sendCardPhotoCardRow">
          <button
            type="button"
            data-testid="sendCardMakePhotoCard"
            onClick={openStudio}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e3d8c3] bg-[#fbf6ec] px-4 text-[14px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] [@media(prefers-color-scheme:dark)]:brightness-[0.94]"
          >
            <ImageIcon className="h-4 w-4" aria-hidden />
            Make a photo card
          </button>
          {isPhotoCard && front ? (
            <button type="button" data-testid="sendCardPhotoCardNext" onClick={() => { leavePick(); if (to) toWrite('pick'); else setStep('to'); }}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-[#fff7ed] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2"
              style={{ backgroundColor: WAX }}>
              {to ? 'Write on your photo card' : 'Choose who it’s for'}
            </button>
          ) : null}
        </div>
      ) : null}
      {studioOpen && photoCard ? (
        <PhotoCardStudio config={photoCard} year={data.year} onClose={() => setStudioOpen(false)} onUse={takePhotoCard} />
      ) : null}

      {step === 'to' && improved && design ? (
        <ChosenCardLine design={design} onChange={() => setStep('pick')}
          picture={isPhotoCard ? flowFront?.src ?? null : null} caption={isPhotoCard ? front?.caption || 'Your photo card' : null} />
      ) : null}
      {step === 'to' ? (
        <ToStep
          onChoose={(next) => {
            setTo(next);
            if (improved) { if (design) toWrite('to'); else setStep('pick'); return; }
            setStep(keepPicture && designId ? 'write' : 'pick');
          }}
          linkName={improved}
          cardName={isThankYou && thankYou ? thankYou.name : undefined}
          max={max}
          listed={listed}
          onToggle={toggleListed}
          onAdd={addListed}
          onContinue={continueWithList}
        />
      ) : null}
      {step === 'pick' ? (
        <PickStep
          designs={catalogDesigns}
          collections={catalogCollections}
          year={data.year}
          chosen={designId}
          // Leaving a photo card for a card from the catalog: its photo was its front, so it goes too (Wave 4.2).
          onChoose={(id) => { if (isPhotoCard) { removePhoto(); setFront(null); } setDesignId(id); }}
          // Pick a card first (`improved`): on to Who it's for while no one is chosen yet, else straight to Write.
          onNext={() => { leavePick(); if (improved && !to) setStep('to'); else toWrite('pick'); }}
          nextLabel={improved && !to ? 'Choose who it’s for' : 'Write on this card'}
          shelving={shelves ? { shelves, open: openShelf, onOpenCollection: openCollection, opening: thankYou?.only ? thankYou.collections.map((c) => c.id) : data.opening ?? null, restoreTop: shelvesTop } : null}
        />
      ) : null}
      {/* From Write on the back onward, you are at the table (design plan Part 9): the chosen card's cloth. */}
      <StepsAtTable on={atTable} table={design?.table}>
      {step === 'write' && design ? (
        <WriteStep
          design={design}
          year={data.year}
          fromName={fromName}
          toFirstName={to?.kind === 'person' ? firstName(to.name) : ''}
          toList={to?.kind === 'list'}
          limit={data.message_limit}
          message={message}
          onMessage={setMessage}
          signature={signature}
          onSignature={setSignature}
          canSign={launchFeatures.cardTable && Boolean(data.signature)}
          signatureKeeping={launchFeatures.cardTable && data.signature?.saves ? {
            saved: data.signature.saved ?? null,
            onKeep: async (signed) => { await saveSignature.mutateAsync(signed); },
            onForget: async () => { await forgetSignature.mutateAsync(); },
          } : null}
          // A card's own photo (memories plan step 4): one card to one person, and while `improved` a list too (Wave 2).
          canAddPhoto={launchFeatures.holidayCardMemories && Boolean(data.media?.photo.usable) && (improved || to?.kind !== 'list') && mediaStamp !== 'unavailable'}
          photo={photo}
          photoAlt={photoAlt}
          onPhotoAlt={setPhotoAlt}
          onAddPhoto={uploadPhoto}
          onRemovePhoto={removePhoto}
          onRetryPhoto={() => { if (photo?.file) uploadPhoto(photo.file); }}
          // Its own voice greeting (memories plan step 7), the same way.
          canAddVoice={launchFeatures.holidayCardMemories && Boolean(data.media?.voice.usable) && (improved || to?.kind !== 'list') && mediaStamp !== 'unavailable'}
          mediaStamp={mediaStamp}
          mediaNeedsStampLine={mediaNeedsStampLine}
          freeMediaHint={freeMediaHint}
          photoIsFront={isPhotoCard}
          onGetStamps={() => { setStampShort(null); setStampReason(mediaNeedsStampLine); void stamps.refresh(); setStampSheet(true); }}
          voice={voice}
          greetingFor={to?.kind === 'person' ? firstName(to.name) : 'you'}
          onRecorded={uploadVoice}
          onRemoveVoice={removeVoice}
          onRetryVoice={() => { if (voice?.blob) uploadVoice(voice.blob); }}
          noteHelp={data.note_help && to ? noteHelpFor(to) : null}
          onCloth={atTable}
          onNext={() => { setStep('seal'); setLookUnavailable(false); if (to?.kind === 'person') void theirs.refetch(); }}
        />
      ) : null}
      {step === 'seal' && design && to ? (
        <SealStep
          cards={data}
          to={to}
          options={options}
          theirDay={to.kind === 'person' ? theirs.data?.next_round_on ?? null : null}
          design={design}
          fromName={fromName}
          arrival={arrival}
          onArrival={(next) => { setArrival(next); setSealError(null); preview.reset(); previewList.reset(); }}
          looking={preview.isPending || previewList.isPending}
          sendsHere={lookUnavailable}
          sending={send.isPending}
          error={sealError ?? (lookUnavailable ? LOOK_UNAVAILABLE : preview.isError ? sendMessage(preview.error, to.kind === 'email') : null)}
          onLook={() => withTown(doLook)}
          onSeal={() => withTown(doSealFromSeal)}
          travel={travelOffer ? {
            on: travel,
            who: to.kind === 'person' ? firstName(to.name) : 'They',
            onToggle: () => {
              setSealError(null); preview.reset(); previewList.reset();
              if (!travel && !travelOffer.town) { setTravel(true); setTownFor({ then: null }); return; }
              setTravel(!travel);
            },
          } : null}
          stamps={data.postage_enabled ? stamps : null}
          onGetStamps={() => {
            // A list short of stamps: the stamp books say how many more its cards need, as Look it over's do.
            if (to.kind === 'list') {
              const have = stamps.balance?.available ?? 0;
              setStampShort({ cards: to.entries.length, missing: Math.max(1, to.entries.length - have) });
            }
            setStampSheet(true);
          }}
          onCloth={atTable}
          fade={atTable ? fadeOf(tableTint(design?.table), 0.72) : PAGE_FADE}
          solid={atTable ? tintOf(tableTint(design?.table), 0.72) : PAGE_TINT}
        />
      ) : null}
      {step === 'look' && look && to ? (
        <LookStep
          preview={look}
          to={to}
          arrival={arrival}
          sending={send.isPending}
          error={send.isError ? sendMessage(send.error, to.kind === 'email') : null}
          onSend={doSend}
          stamps={data.postage_enabled ? stamps : null}
          design={design?.id ?? ''}
          onGetStamps={() => setStampSheet(true)}
          onSealOnTable={launchFeatures.cardTable ? () => openSealing() : undefined}
          onCloth={atTable}
          fade={atTable ? fadeOf(tableTint(design?.table), 0.72) : PAGE_FADE}
          improved={improved}
        />
      ) : null}
      {step === 'look' && listLook && to?.kind === 'list' ? (
        <ListLookStep
          look={listLook}
          entries={to.entries}
          idOf={listId}
          sending={sendList.isPending}
          error={listError}
          onSend={doSendList}
          stamps={data.postage_enabled ? stamps : null}
          design={design?.id ?? ''}
          onGetStamps={() => {
            const have = stamps.balance?.available ?? 0;
            setStampShort({ cards: listLook.needed, missing: Math.max(1, listLook.needed - have) });
            setStampSheet(true);
          }}
          onSealOnTable={launchFeatures.cardTable ? () => openSealing() : undefined}
          onCloth={atTable}
          fade={atTable ? fadeOf(tableTint(design?.table), 0.72) : PAGE_FADE}
          improved={improved}
        />
      ) : null}
      </StepsAtTable>
      {step === 'sent' && listSent && to?.kind === 'list' ? (
        <SentList
          results={listSent}
          entries={to.entries}
          idOf={listId}
          designs={allDesigns}
          takenBack={listTakenBack}
          takingBack={listTakingBack}
          takeBackError={listTakeBackError}
          onTakeBack={(card) => { void doTakeBackFromList(card); }}
          onSendRest={doSendList}
          sendingRest={sendList.isPending}
          restError={listError}
          improved={improved}
        />
      ) : null}
      {step === 'sent' && sent ? (
        <SentCard postageEnabled={data.postage_enabled} card={sent} designs={allDesigns} title={sent.by_link ? 'Your card' : 'On its way'} seeInSent link={sentLink} fromName={fromName} onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} improved={improved} />
      ) : null}
      {data.postage_enabled && step === 'sent' ? (
        <div className="mx-auto max-w-[420px] space-y-2.5 px-4 pb-4">
          {canSendAgain ? (
            <button type="button" data-testid="sendThisCardAgain" className={secondary} onClick={sendThisAgain}>Send this card to someone else</button>
          ) : null}
          <button type="button" data-testid="sendAnotherCard" className={secondary} onClick={startOver}>Send another card</button>
        </div>
      ) : null}
      </div>
      {townFor ? (
        <TownSheet
          onDone={() => { const next = townFor.then; setTownFor(null); setTravel(true); if (next) next(); }}
          // Closed without a town (from the switch, "Seal and send" or "Look it over"): the card goes back to an ordinary
          // card, as on the iPhone and Android, so the sheet doesn't open again on the next press.
          onClose={() => { setTravel(false); setTownFor(null); }}
        />
      ) : null}
      {sealing ? (
        <CardTable
          card={sealing.card}
          note={sealing.note}
          fromName={sealing.fromName}
          toName={sealing.toName}
          closeLabel={sent || listSent ? 'Done' : step === 'look' ? 'Back to Look it over' : 'Back to Seal it for the day'}
          paused={sealShare || stampSheet}
          onClose={closeSealing}
          sendMoment={{
            firstName: sealing.who,
            count: sealing.count,
            // Once a sealing here ends with the card sent, this device offers Quick seal next time (Wave 3.5, `improved`).
            onSeal: () => sealAndSend().then((answer) => { if (answer.ok && improved) markSealedOnce(); return answer; }),
            quickSeal: sealing.quick,
            goneWords: listSent
              ? (listWent === 1 ? 'One card on its way.' : `${listWent} cards on their way.`)
              : sent?.by_link ? 'Your card is ready.' : `On its way to ${sealing.who}.`,
            gone: listSent ? (
              <>
                <p>{listMissed ? `${listMissed === 1 ? 'One card' : `${listMissed} cards`} didn’t go. See which, and send them again.` : to ? takeBackBefore(to, arrival) : ''}</p>
                {listSent.some((result) => result.status !== 'not_sent' && result.card.travel) ? <p data-testid="sealTravelLine">{TRAVEL_SENT_LINE}</p> : null}
                <div data-row>
                  <button type="button" data-strong data-testid="sealDone" onClick={sealingDone}>{listMissed ? 'See which' : 'Done'}</button>
                  {listMissed ? null : <button type="button" data-testid="sealSeeThem" onClick={closeSealing}>See them</button>}
                  {!listMissed && canSendAgain ? (
                    <button type="button" data-testid="sealSendAgain" onClick={() => { setSealing(null); setSealShare(false); sendThisAgain(); }}>Send this card to someone else</button>
                  ) : null}
                </div>
              </>
            ) : sent ? (
              <>
                <p>{arrivalLine(sent, improved)}</p>
                {sent.travel ? <p data-testid="sealTravelLine">{TRAVEL_SENT_LINE}</p> : null}
                {sent.by_link && sentLink ? <p data-testid="sealLink" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{sentLink}</p> : null}
                {takeBackLine(sent) ? <p>{takeBackLine(sent)}</p> : null}
                <div data-row>
                  <button type="button" data-strong data-testid="sealDone" onClick={sealingDone}>Done</button>
                  {sent.by_link && sentLink ? <button type="button" data-testid="sealCopyLink" onClick={() => { void copySealedLink(); }}>Copy link</button> : null}
                  {sent.by_link && sentLink && typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <button type="button" data-testid="sealShareLink" onClick={() => { void shareSealedLink(); }}>Share</button>
                  ) : null}
                  {sent.can_take_back ? (
                    <button type="button" data-testid="sealTakeBack" disabled={takeBack.isPending} onClick={() => { void doTakeBack(); }}>Take it back</button>
                  ) : null}
                  {/* A photo card (Wave 4.2) has no share picture or video. */}
                  {sent.by_link || isPhotoCard ? null : <button type="button" data-testid="sealShare" onClick={() => setSealShare(true)}>Share this card</button>}
                  {canSendAgain ? (
                    <button type="button" data-testid="sealSendAgain" onClick={() => { setSealing(null); setSealShare(false); sendThisAgain(); }}>Send this card to someone else</button>
                  ) : null}
                </div>
                {linkSaid || takeBackError ? <p role="status">{linkSaid ?? takeBackError}</p> : null}
              </>
            ) : null,
          }}
          overlay={sealShare && sent ? (
            <CardShareSheet
              details={{ card: { ...sealing.card, sealed: sent.arrival === 'sealed_christmas' }, note: sealing.note, fromName: sealing.fromName, mailedOn: sent.sent_at, signature: sealing.card.signature ?? null }}
              slug={data.designs.find((d) => d.id === sealing.card.design)?.slug}
              mine
              onClose={() => setSealShare(false)}
            />
          ) : null}
        />
      ) : null}
    </div>
    </CardStripContext.Provider>
    </PhotoFrontContext.Provider>
  );
}

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
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CardSignature, HolidayCardArrival, HolidayCardCollection, HolidayCardDesign, HolidayCardList, HolidayCardListLine, HolidayCardListPreview, HolidayCardListResult, HolidayCardPreview, HolidayCards, SentHolidayCard } from '@pantopus/api';
import { ChevronLeft, Check, Link2, Loader2, Mail, Search, Send, X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import type { MailboxApiError } from '@/lib/mailbox-api';
import { useCardArrivals, useCardRecipients, useHolidayCards, usePreviewHolidayCard, usePreviewHolidayCardList, useSendHolidayCard, useSendHolidayCardList, useTakeBackHolidayCard } from '@/lib/mailbox-queries';
import { useMe, useOwnLocalProfile } from '@/lib/me';
import ErrorState from '@/components/ui/ErrorState';
import { launchFeatures } from '@/lib/featureFlags';
import MailPiece from '../MailPiece';
import { mailLoadMessage } from '../mailLoadMessage';
import CardFront from './CardFront';
import CardBack, { BACK_TEXT, RULED } from './CardBack';
import { SignaturePad } from './cardSignature';
import CardFlip from './CardFlip';
import CardLinkActions from './CardLinkActions';
import LookItOver from './LookItOver';
import CardTable, { type SendMoment, type TableCard } from './CardTable';
import CardShareSheet from './CardShareSheet';
import CardRack from './CardRack';
import { askTakeBack } from './takeBack';
import { chosenPersonFor } from './sendOneBack';
import { cardPicture, clockTime, firstNameOf, SERIF, shortDay, WAX } from './cardArt';

type Step = 'to' | 'pick' | 'write' | 'seal' | 'look' | 'sent';
/** Someone on a list (digital stamps on): a person found by name, or an address. */
type ListEntry = { kind: 'person'; userId: string; name: string } | { kind: 'email'; email: string };
type Recipient = ListEntry | { kind: 'link' }
  /** Two or more people or addresses: a card each (POST /cards/batch). */
  | { kind: 'list'; entries: ListEntry[] };

const STEPS: Step[] = ['to', 'pick', 'write', 'seal', 'look'];
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
const primary = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold text-[#fff7ed] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2 disabled:opacity-50';
const secondary = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d6cbb6] bg-[#fffdf8] text-[15px] font-semibold text-[#374151] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50';
const muted = 'text-[#4e5563] [@media(prefers-color-scheme:dark)]:text-app-text-secondary';

/** Step 4 when the server can't show the look; "Seal and send" is then on step 4. */
const LOOK_UNAVAILABLE = 'Pantopus can’t show how your card will look yet. You can still seal and send it.';

/**
 * The server can't show the look: it has no Look it over yet (a 404 without the server's code, as a server from before
 * it answers). Sending still works there.
 */
function lookIsUnavailable(error: MailboxApiError | null): boolean {
  return error?.status === 404 && !error.serverCode;
}

/** The server's own sentence when it sent one (a card that can't go yet, a limit), else what went wrong. */
function sendMessage(error: MailboxApiError | null, byEmail = false): string {
  if (error?.serverCode && error.status < 500) return error.message;
  if (error?.serverCode === 'CARD_UNAVAILABLE') return error.message;
  // The server's own check of the address, stricter than ours (it knows which endings an address can have).
  if (byEmail && error?.status === 400) return 'That email address doesn’t look right. Go back to “Who it’s for” and check it.';
  return mailLoadMessage(error);
}

const letters = (text: string) => [...text].length;

function firstName(name: string): string {
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

function toName(to: Recipient | null): string {
  if (!to) return '';
  if (to.kind === 'link') return 'whoever opens your link';
  if (to.kind === 'list') return listNames(to.entries);
  return entryName(to);
}

/** The name on the envelope: a card by link has none until someone opens it; a list's first card shows. */
function envelopeName(to: Recipient): string {
  if (to.kind === 'list') return entryName(to.entries[0]);
  return to.kind === 'link' ? 'Their name' : toName(to);
}

/** How a sent card arrives, in a sentence. */
function arrivalLine(card: SentHolidayCard): string {
  const who = card.to_name || 'They';
  if (card.status === 'withdrawn') return 'You took this card back.';
  if (card.by_link) {
    if (card.status === 'claimed') return `${who} opened your link and has your card.`;
    if (card.status === 'expired') return 'Nobody opened your link in 90 days.';
    return card.arrival === 'sealed_christmas'
      ? 'It waits for someone to open your link and join. Then it’s in their mailbox and opens on Christmas morning.'
      : 'It waits for someone to open your link and join.';
  }
  if (card.by_email) {
    if (card.status === 'claimed') return `${who} joined Pantopus and has your card.`;
    return card.arrival === 'sealed_christmas'
      ? 'We emailed them. Once they join with that address, it waits in their mailbox and opens on Christmas morning.'
      : 'We emailed them. It waits for them to join with that address and open it.';
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
function takeBackBefore(to: Recipient): string {
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

function takeBackLine(card: SentHolidayCard): string | null {
  if (!card.can_take_back) return null;
  if (card.by_link) return 'You can take it back until someone opens it.';
  if (card.by_email) return 'You can take it back until they open it.';
  return `You can take it back until ${clockTime(card.take_back_until)} ${shortDay(card.take_back_until)}, when the carrier picks it up.`;
}

// ── Header ───────────────────────────────────────────────────

function StepHeader({ step, title, onBack, headingRef, trailing = null }: { step: Step; title?: string; onBack: () => void; headingRef: RefObject<HTMLHeadingElement | null>; trailing?: ReactNode }) {
  const index = STEPS.indexOf(step);
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
        <div role="img" aria-label={`Step ${index + 1} of ${STEPS.length}`} className="flex gap-[5px] pr-3.5">
          {STEPS.map((s, i) => (
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

function ToStep({
  onChoose,
  max = 1,
  listed = [],
  onToggle,
  onAdd,
  onContinue,
}: {
  onChoose: (to: Recipient) => void;
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
      <p className={`mt-2.5 text-[13px] leading-[18px] ${muted}`}>
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
        <label htmlFor="card-email" className="text-[14px] font-semibold">Their email address</label>
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
        <p className={`mt-2 text-[14px] leading-5 ${muted}`}>
          They get an email saying you sent them a Christmas card. They join Pantopus with this address to open it. The
          email doesn&rsquo;t show the card.
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
          <p className={`px-1 text-[14px] leading-5 ${muted}`}>Type two letters or more of their name.</p>
        ) : results.isPending ? (
          <p className={`flex items-center gap-2 px-1 text-[14px] ${muted}`}><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking…</p>
        ) : results.isError ? (
          <p role="alert" className="px-1 text-[14px] text-[#a81a1a]">Couldn&rsquo;t search just now. {mailLoadMessage(results.error)}</p>
        ) : people.length === 0 ? (
          <p className={`px-1 text-[14px] leading-5 ${muted}`}>No one by that name. Check the spelling, or send it to their email.</p>
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
      <button
        type="button"
        data-testid="sendCardByEmail"
        onClick={() => setByEmail(true)}
        disabled={many && full}
        className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#8b1d1d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50"
      >
        <Mail className="h-[18px] w-[18px]" aria-hidden />
        {many ? 'Not on Pantopus? Add their email' : 'Not on Pantopus? Send it to their email'}
      </button>
      {launchFeatures.cardTable && !listed.length ? (
        <div className="mt-2.5 text-center">
          <button
            type="button"
            data-testid="sendCardByLink"
            onClick={() => onChoose({ kind: 'link' })}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#8b1d1d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] [@media(prefers-color-scheme:dark)]:text-[#e8b996]"
          >
            <Link2 className="h-[18px] w-[18px]" aria-hidden />
            Send it by link
          </button>
          <p className={`mx-auto mt-0.5 max-w-[340px] text-[13px] leading-[18px] ${muted}`}>Text it, or paste it anywhere. The first person to open it keeps the card.</p>
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
}: {
  designs: HolidayCardDesign[];
  /** The server's collections, in order; none (a server from before collections): one grid of every design. */
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

  // A picture chosen on a public card page is in sight when the step opens.
  useEffect(() => {
    if (launchFeatures.cardTable && chosen) document.querySelector('[role="radio"][aria-checked="true"]')?.scrollIntoView({ block: 'center' });
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
          <button type="button" data-testid="sendCardWriteOn" disabled={!picked} onClick={onNext} className={`${primary} mt-2`} style={{ backgroundColor: WAX }}>Write on this card</button>
        </div>
      ) : (
        <div className="mt-6 space-y-2.5 pb-4">
          {picked ? (
            <button type="button" data-testid="sendCardSeeLarger" onClick={() => setLarge(picked)} className={secondary}>See it larger</button>
          ) : (
            <p className={`text-center text-[14px] ${muted}`}>Tap a picture to choose it.</p>
          )}
          <button type="button" data-testid="sendCardWriteOn" disabled={!picked} onClick={onNext} className={primary} style={{ backgroundColor: WAX }}>Write on this card</button>
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
        />
      ) : null}
      {large ? (
        <div role="dialog" aria-modal="true" aria-label={large.caption} data-testid="sendCardLarge" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={() => setLarge(null)}>
          <div style={{ width: 'min(420px, calc((100vh - 120px) * 0.72), 100%)' }} onClick={(event) => event.stopPropagation()}>
            <CardFront design={large.id} caption={large.caption} paper={large.paper} year={year} className="rounded-[3px] shadow-2xl" />
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

function WriteStep({
  design,
  year,
  fromName,
  toFirstName,
  limit,
  message,
  onMessage,
  signature,
  onSignature,
  canSign,
  onNext,
}: {
  design: HolidayCardDesign;
  year: number;
  fromName: string;
  toFirstName: string;
  limit: number;
  message: string;
  onMessage: (text: string) => void;
  /** Signed beside FROM (design plan 8.2), or null for the typed first name. */
  signature: CardSignature | null;
  onSignature: (signature: CardSignature | null) => void;
  /** The server keeps signatures (GET /cards `signature`, launch key card_table). */
  canSign: boolean;
  onNext: () => void;
}) {
  const [showBack, setShowBack] = useState(true);
  const [signing, setSigning] = useState(false);
  const count = letters(message);
  return (
    <div className="mt-3 px-4">
      <CardFlip
        className="mx-auto max-w-[420px]"
        showBack={showBack}
        front={<CardFront design={design.id} caption={design.caption} paper={design.paper} year={year} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]" />}
        back={(
          <CardBack number={design.number} paper={design.paper} fromName={fromName} year={year} signature={signature} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]">
            <label htmlFor="card-note" className="sr-only">Your note on the back of the card</label>
            <textarea
              id="card-note"
              value={message}
              onChange={(event) => onMessage([...event.target.value].slice(0, limit).join(''))}
              placeholder={`Dear ${toFirstName || 'friend'},`}
              className="h-full w-full resize-none border-0 bg-transparent p-0 placeholder:text-[#2c4a8a]/45 focus:outline-none focus:ring-0"
              style={{ ...BACK_TEXT, ...RULED }}
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
          className="inline-flex min-h-[40px] items-center rounded-full border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
        >
          {showBack ? 'Turn it over' : 'Back to writing'}
        </button>
        <span aria-live="polite" className={`text-[13px] ${count >= limit ? 'font-semibold text-[#8b1d1d]' : muted}`}>{count} of {limit} letters</span>
      </div>
      {canSign ? (
        <div className="mx-auto mt-2 flex max-w-[420px] items-center gap-2">
          <button
            type="button"
            data-testid="sendCardSign"
            onClick={() => { setShowBack(true); setSigning(true); }}
            className="inline-flex min-h-[40px] items-center rounded-full border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
          >
            {signature ? 'Sign again' : 'Sign your name'}
          </button>
          <span className={`text-[13px] ${muted}`}>{signature ? 'Signed beside FROM.' : `Or leave ${firstName(fromName)} typed.`}</span>
        </div>
      ) : null}
      {signing ? (
        <SignaturePad
          initial={signature}
          wax={WAX}
          onDone={(signed) => { onSignature(signed); setSigning(false); }}
          onTyped={() => { onSignature(null); setSigning(false); }}
          onClose={() => setSigning(false)}
        />
      ) : null}
      <div className="mx-auto mt-5 max-w-[420px] pb-4">
        <button type="button" disabled={!message.trim()} onClick={onNext} className={primary} style={{ backgroundColor: WAX }}>Seal it</button>
        {!message.trim() ? <p className={`mt-2 text-center text-[13px] ${muted}`}>Write a few words on the back first.</p> : null}
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
  const day = shortDay(theirDay ?? cards.next_round_at);
  const name = to.kind === 'person' ? firstName(to.name) : 'they';
  switch (arrival) {
    case 'next_morning':
      return { title: 'With the morning mail', detail: `${day}, about 7 a.m. where ${name} lives. They can open it right away.` };
    case 'sealed_christmas':
      return {
        title: 'Sealed until Christmas',
        detail: to.kind === 'link'
          ? 'Whoever opens your link and joins gets it now, with a “Do not open until Christmas” seal. It opens on December 25.'
          : to.kind === 'email'
          ? 'They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.'
          : `It comes with the ${day} morning mail and waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.`,
      };
    case 'christmas_morning':
      return { title: 'On Christmas morning', detail: `${shortDay(cards.christmas_morning_at)}, with the 7 a.m. mail.` };
    default:
      if (to.kind === 'link') return { title: 'Right away', detail: 'Whoever opens your link can open the card as soon as they join.' };
      return { title: 'Right away, by email', detail: 'They get an email now and can open it once they join with that address.' };
  }
}

// A list's one choice, as each card reads it: every person's by their own clock (the days differ, so none is named), and
// an address's card waits for them to open the email, sealed until Christmas for both Christmas choices.
function listArrivalChoice(arrival: HolidayCardArrival, cards: HolidayCards, entries: ListEntry[]): { title: string; detail: string } {
  const people = entries.some((entry) => entry.kind === 'person');
  const emails = entries.some((entry) => entry.kind === 'email');
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
  onSend,
  stamps = null,
  onGetStamps,
}: {
  cards: HolidayCards;
  to: Recipient;
  options: HolidayCardArrival[];
  theirDay: string | null;
  design: HolidayCardDesign;
  fromName: string;
  arrival: HolidayCardArrival | null;
  onArrival: (arrival: HolidayCardArrival) => void;
  /** Reading what they will get (the next step). */
  looking: boolean;
  /** The server can't show the look: "Seal and send" is here instead. */
  sendsHere: boolean;
  sending: boolean;
  error: string | null;
  onLook: () => void;
  onSend: () => void;
  /** Digital stamps (postage on), for when this step seals and sends itself. */
  stamps?: Stamps | null;
  onGetStamps?: () => void;
}) {
  const needsStamps = sendsHere && stamps?.balance?.available === 0;
  const preview = {
    id: `preview-${design.id}`,
    sender_display: fromName,
    sender_trust: 'pantopus_user',
    postmark: null,
    card: { design: design.id, number: design.number, caption: design.caption, paper: design.paper, holiday: cards.holiday,
      year: cards.year, arrival, sealed_until: null, sealed: arrival === 'sealed_christmas' },
  } as unknown as MailItemV2;
  return (
    <div className="mt-3 px-4">
      <div className="mx-auto max-w-[380px] rotate-1">
        <MailPiece item={preview} recipientName={envelopeName(to)} opened={false} />
      </div>
      {to.kind === 'list' ? (
        <p className={`mx-auto mt-3 max-w-[420px] text-center text-[14px] leading-5 ${muted}`}>One envelope for each of the {to.entries.length} people.</p>
      ) : null}
      <fieldset className="mx-auto mt-6 max-w-[420px]">
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
      <p className="mx-auto mt-3.5 max-w-[420px] rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
        {/* Before it's sent we don't know their clock; the sent card says the time on this one. */}
        {takeBackBefore(to)}
      </p>
      {sendsHere && stamps ? <div className="mx-auto mt-3 max-w-[420px]"><PostageLine stamps={stamps} design={design.id} /></div> : null}
      {error ? <p role="alert" className="mx-auto mt-3 max-w-[420px] text-[14px] font-medium text-[#a81a1a]">{error}</p> : null}
      <div className="mx-auto mt-5 max-w-[420px] pb-4">
        <button
          type="button"
          data-testid="sendCardSend"
          disabled={!arrival || looking || sending}
          onClick={needsStamps ? onGetStamps : sendsHere ? onSend : onLook}
          className={primary}
          style={{ backgroundColor: WAX }}
        >
          {looking || sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : sendsHere ? sendWords(to) : 'Look it over'}
        </button>
      </div>
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
}: {
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
}) {
  const needsStamps = stamps?.balance?.available === 0;
  return (
    <div data-testid="sendCardLook">
      <LookItOver preview={preview} toName={envelopeName(to)} toFirstName={to.kind === 'person' ? firstName(to.name) : ''} byEmail={to.kind !== 'person'} byLink={to.kind === 'link'} />
      <div className="mx-auto mt-7 max-w-[420px] px-4 pb-4">
        <p className="rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
          {takeBackBefore(to)}
        </p>
        {stamps ? <div className="mt-3"><PostageLine stamps={stamps} design={design} /></div> : null}
        {error ? <p role="alert" className="mt-3 text-[14px] font-medium text-[#a81a1a]">{error}</p> : null}
        <button type="button" data-testid="sendCardLookSend" disabled={sending} onClick={needsStamps ? onGetStamps : onSealOnTable ?? onSend} className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : sendWords(to)}
        </button>
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
}: {
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
}) {
  const byId = new Map(entries.map((entry) => [idOf(entry), entry]));
  const ready = look.recipients.filter((line) => line.status === 'ready');
  const first = ready.length ? byId.get(ready[0].request_id) ?? null : null;
  const needsStamps = Boolean(stamps?.balance) && (stamps?.balance?.available ?? 0) < look.needed;
  const cards = look.needed === 1 ? '1 card' : `${look.needed} cards`;
  return (
    <div data-testid="sendCardLook">
      {look.piece && first ? (
        <LookItOver preview={look as HolidayCardPreview} toName={entryName(first)} toFirstName={first.kind === 'person' ? firstName(first.name) : ''} byEmail={first.kind !== 'person'} />
      ) : null}
      <div className="mx-auto mt-7 max-w-[420px] px-4 pb-4">
        <section aria-label="Who it’s going to" data-testid="sendCardListLook">
          <h2 className="text-[16px] font-semibold">Going to {ready.length} {ready.length === 1 ? 'person' : 'people'}</h2>
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
        {!look.needed ? <p className={`mt-3 text-center text-[14px] ${muted}`}>None of these cards can go now.</p> : null}
        {error ? <p role="alert" className="mt-3 text-[14px] font-medium text-[#a81a1a]">{error}</p> : null}
        <button type="button" data-testid="sendCardLookSend" disabled={sending || !look.needed} onClick={needsStamps ? onGetStamps : onSealOnTable ?? onSend} className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {needsStamps ? 'Get stamps to send' : sending ? `Sending ${cards}…` : `Seal and send ${cards}`}
        </button>
      </div>
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
}: {
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
                  {back ? 'You took this card back, and its stamp is back with you.' : arrivalLine(card)}
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
}: {
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
          <p className="mt-1 text-[14px] leading-5 text-[#374151]">{arrivalLine(card)}</p>
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

export default function SendCardFlow({ chosenDesign = null, chosenPerson = null }: {
  /** The picture a public card page sent them here with (launch key card_table). */
  chosenDesign?: string | null;
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

  const [step, setStep] = useState<Step>('to');
  // What they will get, from the server's look (step 5).
  const [look, setLook] = useState<HolidayCardPreview | null>(null);
  // A choice that closed while they looked it over, or why a card sent from step 4 didn't go: step 4 says so.
  const [sealError, setSealError] = useState<string | null>(null);
  // The server can't show the look: step 4 says so and seals and sends itself. Each visit to step 4 asks again.
  const [lookUnavailable, setLookUnavailable] = useState(false);
  const [to, setTo] = useState<Recipient | null>(null);
  // A person's arrivals and day go by their clock, read once they're chosen and again on the last step.
  const theirs = useCardArrivals(to?.kind === 'person' ? to.userId : null);
  const [designId, setDesignId] = useState<string | null>(launchFeatures.cardTable ? chosenDesign : null);
  const [message, setMessage] = useState('');
  // Signed beside FROM (design plan 8.2); null: the first name typed in the pen, as before.
  const [signature, setSignature] = useState<CardSignature | null>(null);
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
  // Sealing it by hand (design plan Part 2, launch key card_table): after Look it over, the card lies on the table and
  // goes the moment the seal is pressed home. What the table shows is kept here, so it stays through the send.
  const [sealing, setSealing] = useState<{ card: TableCard; note: string; fromName: string; toName: string; who: string; count: number } | null>(null);
  const [sealShare, setSealShare] = useState(false);
  const [linkSaid, setLinkSaid] = useState<string | null>(null);
  const sealingOpen = useRef(false);
  sealingOpen.current = Boolean(sealing);

  const data = cards.data;
  const max = data?.max_recipients ?? 1;
  const stamps = useStamps(Boolean(data?.postage_enabled), `${sent?.id ?? ''}:${listSent?.length ?? 0}:${listTakenBack.size}:${tookBack}:${step}`);
  const design = useMemo(() => data?.designs.find((d) => d.id === designId) ?? null, [data, designId]);
  const today = sent ?? (data?.today && data.today.status !== 'withdrawn' ? data.today : null);
  const options = useMemo<HolidayCardArrival[]>(() => {
    if (!data || !to) return [];
    if (to.kind === 'list') return to.entries.some((entry) => entry.kind === 'person') ? data.arrivals.person : data.arrivals.email;
    return to.kind === 'person' ? (theirs.data?.arrivals ?? data.arrivals.person) : data.arrivals.email;
  }, [data, to, theirs.data]);

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
    setStep('pick');
  };

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

  // Each step starts at its heading, for keyboards and screen readers.
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  // The arrival choices depend on who it's for; pick the first that's open.
  useEffect(() => {
    if (!options.length) return;
    if (!arrival || !options.includes(arrival)) setArrival(options[0]);
  }, [options, arrival]);

  // Back keeps everything chosen and written; only the last answers' errors go.
  const back = () => {
    if (step === 'to' || step === 'sent') { router.push('/app/mailbox/personal'); return; }
    setStep(STEPS[STEPS.indexOf(step) - 1]);
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
    };
  };

  const cardToSend = () => {
    if (!to || to.kind === 'list' || !design || !arrival) return null;
    requestId.current ??= crypto.randomUUID();
    return {
      design: design.id,
      message: message.trim(),
      arrival,
      to: to.kind === 'person' ? { user_id: to.userId } : to.kind === 'email' ? { email: to.email } : { link: true as const },
      request_id: requestId.current,
      ...(data?.postage_enabled ? { use_stamp: true } : {}),
      ...(signature ? { signature } : {}),
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
    setTo(null); setDesignId(null); setMessage(''); setSignature(null); setArrival(null); setLook(null); setLookUnavailable(false);
    setListed([]); setListLook(null); setListSent(null); setListError(null); setListTakenBack(new Set()); setListTakeBackError(null);
    setStep('to');
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
        // A refusal of the whole list (the season closed, say) shows under the choices.
        onError: (error) => setSealError(sendMessage(error)),
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
        if (lookIsUnavailable(error)) setLookUnavailable(true);
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
      onSuccess: (res) => { requestId.current = null; setSent(res.card); setSentLink(res.link ?? null); setLook(null); setStep('sent'); },
      onError: (error) => {
        if (wentEarlier(error)) return;
        // The stamps ran out meanwhile (another tab or phone sent a card): the stamp books open; the card stays as it is.
        if (error.serverCode === 'STAMPS_REQUIRED') {
          send.reset();
          void stamps.refresh();
          setStampSheet(true);
          return;
        }
        if (error.serverCode !== 'CARD_ARRIVAL_CLOSED') {
          if (fromSeal) { setSealError(sendMessage(error, to?.kind === 'email')); send.reset(); }
          return;
        }
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
      onSuccess: (res) => { setListSent(res.results); setListLook(null); setStep('sent'); },
      onError: (error) => {
        if (error.serverCode === 'STAMPS_REQUIRED') {
          const needed = Number(error.data?.needed) || list.recipients.length;
          const have = Number(error.data?.available) || 0;
          setStampShort({ cards: needed, missing: Math.max(1, needed - have) });
          void stamps.refresh();
          setStampSheet(true);
          return;
        }
        setListError(sendMessage(error));
      },
    });
  };

  // One card on a sent list taken back: its stamp comes back.
  const doTakeBackFromList = async (card: SentHolidayCard) => {
    const yes = await askTakeBack({ byEmail: card.by_email, sentToday: false, postage: true });
    if (!yes) return;
    setListTakeBackError(null);
    setListTakingBack(card.id);
    takeBack.mutate(card.id, {
      onSuccess: () => setListTakenBack((now) => new Set(now).add(card.id)),
      onError: (error) => setListTakeBackError({ id: card.id, message: sendMessage(error) }),
      onSettled: () => setListTakingBack(null),
    });
  };

  // ── Sealing it by hand on the table ──
  const openSealing = () => {
    if (!to || !data) return;
    const piece = to.kind === 'list' ? listLook?.piece : look?.piece;
    const card: TableCard | null = piece?.card ?? (design ? {
      design: design.id, number: design.number, caption: design.caption, paper: design.paper, table: design.table ?? null, year: data.year, sealed: false,
      signature,
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
        if (error.serverCode === 'CARD_ARRIVAL_CLOSED') {
          // Their 7 a.m. came while they looked it over: choose again on step 4, as before.
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
      await navigator.share({ text: `A Christmas card for you from ${firstNameOf(fromName)}: ${sentLink}` });
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') setLinkSaid('Couldn’t open the share sheet. Copy the link and send it yourself.');
    }
  };

  const doTakeBack = async () => {
    if (!today) return;
    // Today's card: taking it back frees the day.
    const yes = await askTakeBack({ byEmail: today.by_email, byLink: today.by_link, sentToday: true, postage: Boolean(data?.postage_enabled) });
    if (!yes) return;
    setTakeBackError(null);
    takeBack.mutate(today.id, {
      onSuccess: () => {
        setTookBack(true);
        setTakenBackNote(null);
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
  if (today && step === 'to') {
    return (
      <div className={page}>
        <div className="mx-auto w-full max-w-[560px]">
          <StepHeader step="sent" title="Today's card" onBack={() => router.push('/app/mailbox/personal')} headingRef={headingRef} />
          <SentCard card={today} designs={data.designs} title="Today's card" fromName={fromName} onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} />
        </div>
      </div>
    );
  }

  if (!data.open) {
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

  return (
    <div className={`${page} pb-6`}>
      <div className="mx-auto w-full max-w-[560px]">
      <StepHeader
        step={step}
        title={step === 'sent' && sent?.by_link ? 'Your card is ready.' : undefined}
        onBack={back}
        headingRef={headingRef}
        trailing={data.postage_enabled ? <StampChip stamps={stamps} onOpen={() => { setStampShort(null); setStampSheet(true); }} /> : null}
      />
      {data.postage_enabled ? (
        <StampSheet open={stampSheet} onClose={() => { setStampSheet(false); setStampShort(null); }} stamps={stamps} short={stampShort} overTable={Boolean(sealing)} />
      ) : null}
      {(tookBack || takenBackNote) && step === 'to' ? (
        <p role="status" className="mx-4 mt-2 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-2.5 text-[14px] text-[#374151]">
          {takenBackNote ?? (data.postage_enabled ? 'You took your card back, and its stamp is back with you.' : 'You took your card back. You can send a card again today.')}
        </p>
      ) : null}
      {step !== 'to' && step !== 'sent' && to ? (
        <p className={`mt-1 px-4 text-[14px] leading-5 ${muted}`}>To {toName(to)}</p>
      ) : null}

      {step === 'to' ? (
        <ToStep
          onChoose={(next) => { setTo(next); setStep('pick'); }}
          max={max}
          listed={listed}
          onToggle={toggleListed}
          onAdd={addListed}
          onContinue={continueWithList}
        />
      ) : null}
      {step === 'pick' ? (
        <PickStep
          designs={data.designs}
          collections={data.collections ?? []}
          year={data.year}
          chosen={designId}
          onChoose={setDesignId}
          onNext={() => setStep('write')}
        />
      ) : null}
      {step === 'write' && design ? (
        <WriteStep
          design={design}
          year={data.year}
          fromName={fromName}
          toFirstName={to?.kind === 'person' ? firstName(to.name) : ''}
          limit={data.message_limit}
          message={message}
          onMessage={setMessage}
          signature={signature}
          onSignature={setSignature}
          canSign={launchFeatures.cardTable && Boolean(data.signature)}
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
          onLook={doLook}
          onSend={doSend}
          stamps={data.postage_enabled ? stamps : null}
          onGetStamps={() => setStampSheet(true)}
        />
      ) : null}
      {step === 'look' && look && to ? (
        <LookStep
          preview={look}
          to={to}
          sending={send.isPending}
          error={send.isError ? sendMessage(send.error, to.kind === 'email') : null}
          onSend={doSend}
          stamps={data.postage_enabled ? stamps : null}
          design={design?.id ?? ''}
          onGetStamps={() => setStampSheet(true)}
          onSealOnTable={launchFeatures.cardTable ? openSealing : undefined}
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
          onSealOnTable={launchFeatures.cardTable ? openSealing : undefined}
        />
      ) : null}
      {step === 'sent' && listSent && to?.kind === 'list' ? (
        <SentList
          results={listSent}
          entries={to.entries}
          idOf={listId}
          designs={data.designs}
          takenBack={listTakenBack}
          takingBack={listTakingBack}
          takeBackError={listTakeBackError}
          onTakeBack={(card) => { void doTakeBackFromList(card); }}
          onSendRest={doSendList}
          sendingRest={sendList.isPending}
          restError={listError}
        />
      ) : null}
      {step === 'sent' && sent ? (
        <SentCard postageEnabled={data.postage_enabled} card={sent} designs={data.designs} title={sent.by_link ? 'Your card' : 'On its way'} seeInSent link={sentLink} fromName={fromName} onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} />
      ) : null}
      {data.postage_enabled && step === 'sent' ? (
        <div className="mx-auto max-w-[420px] px-4 pb-4">
          <button type="button" data-testid="sendAnotherCard" className={secondary} onClick={startOver}>Send another card</button>
        </div>
      ) : null}
      </div>
      {sealing ? (
        <CardTable
          card={sealing.card}
          note={sealing.note}
          fromName={sealing.fromName}
          toName={sealing.toName}
          closeLabel={sent || listSent ? 'Done' : 'Back to Look it over'}
          paused={sealShare || stampSheet}
          onClose={closeSealing}
          sendMoment={{
            firstName: sealing.who,
            count: sealing.count,
            onSeal: sealAndSend,
            goneWords: listSent
              ? (listWent === 1 ? 'One card on its way.' : `${listWent} cards on their way.`)
              : sent?.by_link ? 'Your card is ready.' : `On its way to ${sealing.who}.`,
            gone: listSent ? (
              <>
                <p>{listMissed ? `${listMissed === 1 ? 'One card' : `${listMissed} cards`} didn’t go. See which, and send them again.` : to ? takeBackBefore(to) : ''}</p>
                <div data-row>
                  <button type="button" data-strong data-testid="sealDone" onClick={sealingDone}>{listMissed ? 'See which' : 'Done'}</button>
                  {listMissed ? null : <button type="button" data-testid="sealSeeThem" onClick={closeSealing}>See them</button>}
                </div>
              </>
            ) : sent ? (
              <>
                <p>{arrivalLine(sent)}</p>
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
                  {sent.by_link ? null : <button type="button" data-testid="sealShare" onClick={() => setSealShare(true)}>Share this card</button>}
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
  );
}

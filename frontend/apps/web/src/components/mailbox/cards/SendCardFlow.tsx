'use client';

// ============================================================
// Send a Christmas card (holiday_cards; Draft 1's flow around the founder's
// pictures): who it's for → pick a card → write on the back → seal it for the
// day → look it over (exactly what they will get) and seal and send. One card
// a day: once it's sent, this page shows today's card, which can be taken
// back until the 7 a.m. pickup (by email: until they open it).
// ============================================================

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { HolidayCardArrival, HolidayCardDesign, HolidayCardPreview, HolidayCards, SentHolidayCard } from '@pantopus/api';
import { ChevronLeft, Check, Loader2, Mail, Search, X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import type { MailboxApiError } from '@/lib/mailbox-api';
import { useCardArrivals, useCardRecipients, useHolidayCards, usePreviewHolidayCard, useSendHolidayCard, useTakeBackHolidayCard } from '@/lib/mailbox-queries';
import { useMe, useOwnLocalProfile } from '@/lib/me';
import { confirmStore } from '@/components/ui/confirm-store';
import ErrorState from '@/components/ui/ErrorState';
import MailPiece from '../MailPiece';
import { mailLoadMessage } from '../mailLoadMessage';
import CardFront from './CardFront';
import CardBack, { BACK_TEXT, RULED } from './CardBack';
import CardFlip from './CardFlip';
import LookItOver from './LookItOver';
import { cardPicture, clockTime, SERIF, shortDay, WAX } from './cardArt';

type Step = 'to' | 'pick' | 'write' | 'seal' | 'look' | 'sent';
type Recipient = { kind: 'person'; userId: string; name: string } | { kind: 'email'; email: string };

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

function toName(to: Recipient | null): string {
  if (!to) return '';
  return to.kind === 'person' ? to.name : to.email;
}

/** How a sent card arrives, in a sentence. */
function arrivalLine(card: SentHolidayCard): string {
  const who = card.to_name || 'They';
  if (card.status === 'withdrawn') return 'You took this card back.';
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

function takeBackLine(card: SentHolidayCard): string | null {
  if (!card.can_take_back) return null;
  if (card.by_email) return 'You can take it back until they open it.';
  return `You can take it back until ${clockTime(card.take_back_until)} ${shortDay(card.take_back_until)}, when the carrier picks it up.`;
}

// ── Header ───────────────────────────────────────────────────

function StepHeader({ step, title, onBack, headingRef }: { step: Step; title?: string; onBack: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
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

function ToStep({ onChoose }: { onChoose: (to: Recipient) => void }) {
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

  if (byEmail) {
    return (
      <form
        className="mt-4 px-4"
        onSubmit={(event) => { event.preventDefault(); if (emailOk) onChoose({ kind: 'email', email: email.trim() }); }}
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
        <button type="submit" disabled={!emailOk} className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>Continue</button>
        <button type="button" onClick={() => setByEmail(false)} className={`${secondary} mt-2.5`}>Search Pantopus instead</button>
      </form>
    );
  }

  return (
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
            {people.map((person) => (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => onChoose({ kind: 'person', userId: person.userId, name: person.name })}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f5efe3] focus:outline-none focus-visible:bg-[#f5efe3]"
                >
                  <span aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ebe3d4] text-[15px] font-semibold text-[#5b4a36]">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-[#111827]">{person.name}</span>
                    <span className="block truncate text-[13px] text-[#4e5563]">
                      {[person.username ? `@${person.username}` : null, person.homeAddress].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => setByEmail(true)}
        className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-[#8b1d1d] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
      >
        <Mail className="h-[18px] w-[18px]" aria-hidden />
        Not on Pantopus? Send it to their email
      </button>
    </div>
  );
}

// ── Step 2: pick a card ──────────────────────────────────────

function PickStep({
  designs,
  year,
  chosen,
  onChoose,
  onNext,
}: {
  designs: HolidayCardDesign[];
  year: number;
  chosen: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
}) {
  const [large, setLarge] = useState<HolidayCardDesign | null>(null);
  const picked = designs.find((design) => design.id === chosen) ?? null;
  return (
    <div className="mt-3 px-4">
      <div role="radiogroup" aria-label="Christmas cards" className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
        {designs.map((design) => {
          const selected = design.id === chosen;
          return (
            <button
              key={design.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={design.caption}
              onClick={() => (selected ? setLarge(design) : onChoose(design.id))}
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
              <span className="line-clamp-2 text-[12px] font-medium leading-4 text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-secondary">{design.caption}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 space-y-2.5 pb-4">
        {picked ? (
          <button type="button" onClick={() => setLarge(picked)} className={secondary}>See it larger</button>
        ) : (
          <p className={`text-center text-[14px] ${muted}`}>Tap a picture to choose it.</p>
        )}
        <button type="button" disabled={!picked} onClick={onNext} className={primary} style={{ backgroundColor: WAX }}>Write on this card</button>
      </div>

      {large ? (
        <div role="dialog" aria-modal="true" aria-label={large.caption} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={() => setLarge(null)}>
          <div style={{ width: 'min(420px, calc((100vh - 120px) * 0.72), 100%)' }} onClick={(event) => event.stopPropagation()}>
            <CardFront design={large.id} caption={large.caption} paper={large.paper} year={year} className="rounded-[3px] shadow-2xl" />
            <div className="mt-3 flex gap-2.5">
              <button type="button" onClick={() => setLarge(null)} className={secondary}><X className="h-4 w-4" aria-hidden /> Close</button>
              <button
                type="button"
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
  onNext,
}: {
  design: HolidayCardDesign;
  year: number;
  fromName: string;
  toFirstName: string;
  limit: number;
  message: string;
  onMessage: (text: string) => void;
  onNext: () => void;
}) {
  const [showBack, setShowBack] = useState(true);
  const count = letters(message);
  return (
    <div className="mt-3 px-4">
      <CardFlip
        className="mx-auto max-w-[420px]"
        showBack={showBack}
        front={<CardFront design={design.id} caption={design.caption} paper={design.paper} year={year} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]" />}
        back={(
          <CardBack paper={design.paper} fromName={fromName} year={year} className="rounded-[3px] shadow-[0_12px_26px_rgba(60,40,10,0.24)]">
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
  const day = shortDay(theirDay ?? cards.next_round_at);
  const name = to.kind === 'person' ? firstName(to.name) : 'they';
  switch (arrival) {
    case 'next_morning':
      return { title: 'With the morning mail', detail: `${day}, about 7 a.m. where ${name} lives. They can open it right away.` };
    case 'sealed_christmas':
      return {
        title: 'Sealed until Christmas',
        detail: to.kind === 'email'
          ? 'They get an email now. Once they join with that address, it waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.'
          : `It comes with the ${day} morning mail and waits in their mailbox with a “Do not open until Christmas” seal. It opens on December 25.`,
      };
    case 'christmas_morning':
      return { title: 'On Christmas morning', detail: `${shortDay(cards.christmas_morning_at)}, with the 7 a.m. mail.` };
    default:
      return { title: 'Right away, by email', detail: 'They get an email now and can open it once they join with that address.' };
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
  error,
  onLook,
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
  error: string | null;
  onLook: () => void;
}) {
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
        <MailPiece item={preview} recipientName={toName(to)} opened={false} />
      </div>
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
        {to.kind === 'email'
          ? 'You can take it back until they open it.'
          : 'You can take it back until the carrier picks it up at 7 a.m. their time.'}
      </p>
      {error ? <p role="alert" className="mx-auto mt-3 max-w-[420px] text-[14px] font-medium text-[#a81a1a]">{error}</p> : null}
      <div className="mx-auto mt-5 max-w-[420px] pb-4">
        <button type="button" disabled={!arrival || looking} onClick={onLook} className={primary} style={{ backgroundColor: WAX }}>
          {looking ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Look it over
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
}: {
  preview: HolidayCardPreview;
  to: Recipient;
  sending: boolean;
  error: string | null;
  onSend: () => void;
}) {
  return (
    <div data-testid="sendCardLook">
      <LookItOver preview={preview} toName={toName(to)} toFirstName={to.kind === 'person' ? firstName(to.name) : ''} byEmail={to.kind === 'email'} />
      <div className="mx-auto mt-7 max-w-[420px] px-4 pb-4">
        <p className="rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-3 text-[13px] leading-[18px] text-[#374151]">
          {to.kind === 'email'
            ? 'You can take it back until they open it.'
            : 'You can take it back until the carrier picks it up at 7 a.m. their time.'}
        </p>
        {error ? <p role="alert" className="mt-3 text-[14px] font-medium text-[#a81a1a]">{error}</p> : null}
        <button type="button" data-testid="sendCardLookSend" disabled={sending} onClick={onSend} className={`${primary} mt-5`} style={{ backgroundColor: WAX }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Seal and send
        </button>
      </div>
    </div>
  );
}

// ── A sent card: just now, or today's card ───────────────────

function SentCard({
  card,
  designs,
  title,
  onTakeBack,
  takingBack,
  takeBackError,
}: {
  card: SentHolidayCard;
  designs: HolidayCardDesign[];
  title: string;
  onTakeBack: () => void;
  takingBack: boolean;
  takeBackError: string | null;
}) {
  const design = designs.find((d) => d.id === card.design);
  const line = takeBackLine(card);
  return (
    <section aria-label={title} className="mx-auto mt-4 max-w-[420px] px-4 pb-4">
      <div className="flex items-start gap-4 rounded-2xl border border-[#e3d8c3] bg-[#fffdf8] p-4 text-[#111827]">
        {design ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardPicture(design.id, 'thumb')} alt="" className="w-[84px] flex-shrink-0 -rotate-2 rounded-[2px] shadow-[0_6px_14px_rgba(60,40,10,0.25)]" />
        ) : null}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#4e5563]">{title}</p>
          <p className="mt-0.5 truncate text-[17px] font-semibold">To {card.to_name || 'them'}</p>
          <p className="mt-1 text-[14px] leading-5 text-[#374151]">{arrivalLine(card)}</p>
        </div>
      </div>
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
      </div>
      <p className={`mt-3 text-center text-[13px] ${muted}`}>One card a day. You can send another tomorrow.</p>
    </section>
  );
}

// ── The flow ─────────────────────────────────────────────────

export default function SendCardFlow() {
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
  // A choice that closed while they looked it over: step 4 says so.
  const [sealError, setSealError] = useState<string | null>(null);
  const [to, setTo] = useState<Recipient | null>(null);
  // A person's arrivals and day go by their clock, read once they're chosen and again on the last step.
  const theirs = useCardArrivals(to?.kind === 'person' ? to.userId : null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [arrival, setArrival] = useState<HolidayCardArrival | null>(null);
  const [sent, setSent] = useState<SentHolidayCard | null>(null);
  const [takeBackError, setTakeBackError] = useState<string | null>(null);
  const [tookBack, setTookBack] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const data = cards.data;
  const design = useMemo(() => data?.designs.find((d) => d.id === designId) ?? null, [data, designId]);
  const today = sent ?? (data?.today && data.today.status !== 'withdrawn' ? data.today : null);
  const options = useMemo<HolidayCardArrival[]>(() => {
    if (!data || !to) return [];
    return to.kind === 'email' ? data.arrivals.email : (theirs.data?.arrivals ?? data.arrivals.person);
  }, [data, to, theirs.data]);

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
    setSealError(null);
    preview.reset();
    send.reset();
  };

  const cardToSend = () => (to && design && arrival
    ? { design: design.id, message: message.trim(), arrival, to: to.kind === 'person' ? { user_id: to.userId } : { email: to.email } }
    : null);

  const doLook = () => {
    const card = cardToSend();
    if (!card) return;
    setSealError(null);
    preview.mutate(card, { onSuccess: (res) => { setLook(res); setStep('look'); } });
  };

  const doSend = () => {
    const card = cardToSend();
    if (!card) return;
    send.mutate(card, {
      onSuccess: (res) => { setSent(res.card); setLook(null); setStep('sent'); },
      onError: (error) => {
        if (error.serverCode !== 'CARD_ARRIVAL_CLOSED') return;
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

  const doTakeBack = async () => {
    if (!today) return;
    const yes = await confirmStore.open({
      title: 'Take your card back?',
      description: today.by_email
        ? 'The link in their email will say you took it back. You can send a card again today.'
        : 'It won’t go out with the morning mail. You can send a card again today.',
      confirmLabel: 'Take it back',
    });
    if (!yes) return;
    setTakeBackError(null);
    takeBack.mutate(today.id, {
      onSuccess: () => {
        setSent(null);
        setTookBack(true);
        setTo(null); setDesignId(null); setMessage(''); setArrival(null); setLook(null);
        setStep('to');
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
          <SentCard card={today} designs={data.designs} title="Today's card" onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} />
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
      <StepHeader step={step} onBack={back} headingRef={headingRef} />
      {tookBack && step === 'to' ? (
        <p role="status" className="mx-4 mt-2 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] px-3.5 py-2.5 text-[14px] text-[#374151]">
          You took your card back. You can send a card again today.
        </p>
      ) : null}
      {step !== 'to' && step !== 'sent' && to ? (
        <p className={`mt-1 px-4 text-[14px] leading-5 ${muted}`}>To {toName(to)}</p>
      ) : null}

      {step === 'to' ? (
        <ToStep onChoose={(next) => { setTo(next); setStep('pick'); }} />
      ) : null}
      {step === 'pick' ? (
        <PickStep designs={data.designs} year={data.year} chosen={designId} onChoose={setDesignId} onNext={() => setStep('write')} />
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
          onNext={() => { setStep('seal'); if (to?.kind === 'person') void theirs.refetch(); }}
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
          onArrival={(next) => { setArrival(next); setSealError(null); preview.reset(); }}
          looking={preview.isPending}
          error={sealError ?? (preview.isError ? sendMessage(preview.error, to.kind === 'email') : null)}
          onLook={doLook}
        />
      ) : null}
      {step === 'look' && look && to ? (
        <LookStep
          preview={look}
          to={to}
          sending={send.isPending}
          error={send.isError ? sendMessage(send.error, to.kind === 'email') : null}
          onSend={doSend}
        />
      ) : null}
      {step === 'sent' && sent ? (
        <SentCard card={sent} designs={data.designs} title="On its way" onTakeBack={() => { void doTakeBack(); }} takingBack={takeBack.isPending} takeBackError={takeBackError} />
      ) : null}
      </div>
    </div>
  );
}

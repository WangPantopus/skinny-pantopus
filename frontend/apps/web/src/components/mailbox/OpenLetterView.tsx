// ============================================================
// OpenLetterView — a letter for someone who isn't on Pantopus yet,
// opened from the link in its email (or text).
// Signed out, it shows who the letter is from and a short preview,
// never the letter itself; a Christmas card shows its front (the stock
// picture the sender picked) unless it's sealed until Christmas, never
// its note. Sent by email (or a card by link), one tap emails a code to
// that address (by link: the address they type); entering it signs them
// in, with a new account if the address has none, and opens it. Signing
// in another way (password, Apple, Google) or creating an account with the
// address it was sent to comes back here, and "Read the letter" puts
// it in that person's own mailbox, where they read it. A letter sent
// as a business names only the business. Plain state, not react-query,
// like the other public token pages. With launch key card_table, a
// Christmas card's page is the table with the card lying on its open
// envelope (sealed: the shut envelope).
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { EscrowClaimErrorCode, EscrowedMailView, GuestOpenCardResponse } from '@pantopus/api';
import { BadgeCheck, Clock, Loader2, Mail, MailCheck, MailX, X, type LucideIcon } from 'lucide-react';
import { confirmStore } from '@/components/ui/confirm-store';
import { isMissingName } from '@/components/profile/NamePrompt';
import { launchFeatures } from '@/lib/featureFlags';
import CardLinkScene, { cardLinkStyles as table, type CardLinkSceneFront } from './cards/CardLinkScene';
import { PaperFront } from './cards/CardPaper';
import CardTable, { type TableMenuItem } from './cards/CardTable';
import { firstNameOf } from './cards/cardArt';
import { travelCameLine } from './cards/TravelPostmarks';
import { markCardClaimPath } from './cards/cardNoticeHold';

type Letter = EscrowedMailView['mail'];

/**
 * Off (the read has no `improved`): the letter as the page drew it before the improvements, so nothing opens before
 * signing in, whatever else the answer carries.
 */
function beforeImprovements(letter: Letter): Letter {
  if (!letter.card?.guest_open) return letter;
  const { guest_open: _guestOpen, ...card } = letter.card;
  return { ...letter, card };
}
type ClosedCode = Extract<EscrowClaimErrorCode, 'MAIL_LINK_INVALID' | 'MAIL_CLAIMED' | 'MAIL_EXPIRED' | 'MAIL_WITHDRAWN'> | 'UNAVAILABLE';
type ViewState =
  | { phase: 'loading' }
  | { phase: 'closed'; code: ClosedCode; card?: boolean; said?: string }
  /** `improved`: the read said the card improvements of November 28 are on (absent: the page from before them). */
  | { phase: 'ready'; letter: Letter; improved: boolean };

// A Christmas card (holiday_cards) closes in card words: the server marks its answer `card: true`.
const closedForCard = (err: unknown): boolean => Boolean((err as { data?: { card?: unknown } } | null)?.data?.card);
// What the server said about it, for the card on the table's page: "Someone already opened this card. A card goes to one person."
const serverWords = (err: unknown): string | undefined => {
  const said = (err as { message?: unknown } | null)?.message;
  return typeof said === 'string' && said ? said : undefined;
};
const cardWords = (text: string) => text.replace(/\bletter\b/g, 'card').replace(/\bread\b/g, 'open');

const CLOSED: Record<ClosedCode, { title: string; detail: string; icon: LucideIcon }> = {
  MAIL_LINK_INVALID: {
    title: 'This link doesn’t work',
    detail: 'Check that you opened the whole link from the email. If it still doesn’t open, ask the sender to send the letter again.',
    icon: MailX,
  },
  MAIL_EXPIRED: {
    title: 'This letter has expired',
    detail: 'A letter waits 90 days for the person it was written to. Ask the sender to send it again.',
    icon: Clock,
  },
  MAIL_WITHDRAWN: {
    title: 'The sender took this letter back',
    detail: 'They withdrew it before it was opened, so there’s nothing to read here.',
    icon: MailX,
  },
  MAIL_CLAIMED: {
    title: 'This letter is already in a mailbox',
    detail: 'If you added it to yours, it’s in your Pantopus mailbox.',
    icon: MailCheck,
  },
  UNAVAILABLE: {
    title: 'Couldn’t open the letter',
    detail: 'Check your connection and try again.',
    icon: MailX,
  },
};

const CLOSED_CODES = new Set<string>(['MAIL_LINK_INVALID', 'MAIL_CLAIMED', 'MAIL_EXPIRED', 'MAIL_WITHDRAWN']);
const closedCode = (err: unknown): ClosedCode => {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && CLOSED_CODES.has(code) ? (code as ClosedCode) : 'UNAVAILABLE';
};

const primaryButton =
  'w-full h-12 rounded-xl bg-app-text text-app-surface text-[15px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60';
const secondaryButton =
  'w-full h-12 rounded-xl border-[1.5px] border-app-border bg-app-surface text-app-text text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-app-hover transition disabled:opacity-60';

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Signed in or not, kept current when this or another tab signs in or out.
function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setSignedIn(api.hasActiveSession());
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) check(); };
    const unsubscribe = api.onTokenChange(check);
    window.addEventListener('storage', storage); window.addEventListener('focus', check); check();
    return () => { unsubscribe(); window.removeEventListener('storage', storage); window.removeEventListener('focus', check); };
  }, []);
  return signedIn;
}

/** The page's own panel; Look it over draws a card's page in it too. */
export const LINK_PAGE_PANEL = 'bg-app-surface border border-app-border rounded-2xl shadow-sm p-6';

/** What the page says about the piece: the server's answer, or (Look it over) what it will answer once it's sent. */
export type LinkPageLetter = Pick<Letter, 'senderName' | 'senderVerified' | 'senderKind' | 'subject' | 'previewText' | 'outcomeDescription' | 'sentTo' | 'createdAt' | 'card'>;

/** A card's front as the page draws it, postmarked the day it was sent; null when it's sealed or has none. */
export function linkPageFront(letter: LinkPageLetter): CardLinkSceneFront | null {
  const front = letter.card?.front;
  return front && !letter.card?.sealed ? { ...front, year: letter.card?.year ?? new Date().getFullYear(), mailedOn: letter.createdAt || null } : null;
}

/**
 * Who it's from and what it is (a Christmas card shows its front, never its note, and sealed only says it is one).
 * Look it over shows this same block before a card is sent, so the two can't drift.
 */
export function LinkPageSummary({ letter }: { letter: LinkPageLetter }) {
  const card = letter.card ?? null;
  const front = linkPageFront(letter);
  return (
    <>
      <div className="flex items-start gap-3.5">
        <span className="w-12 h-12 rounded-2xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <Mail size={24} strokeWidth={2} className="text-app-text-secondary" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-app-text-muted">{card ? 'A Christmas card for you' : 'A letter for you'}</p>
          <h1 className="text-[19px] font-bold text-app-text -tracking-[0.01em] mt-0.5 break-words">From {letter.senderName}</h1>
          {letter.senderVerified && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-app-success-light px-2.5 py-1 mt-2 text-[12px] font-semibold text-app-success">
              <BadgeCheck size={14} strokeWidth={2.25} />
              {letter.senderKind === 'business' ? 'Verified business' : 'Verified resident'}
            </p>
          )}
        </div>
      </div>

      <section aria-label={card ? 'Card' : 'Letter preview'} className="mt-5 rounded-xl border border-app-border-subtle bg-app-surface-raised p-4">
        {letter.subject && <h2 className="text-[15px] font-semibold text-app-text break-words">{letter.subject}</h2>}
        {front ? (
          <div className="mx-auto mt-3 w-[min(100%,15rem)] -rotate-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]" role="img" aria-label={`A Christmas card: ${front.caption}`} data-testid="cardLinkFront">
            <PaperFront design={front.design} caption={front.caption} paper={front.paper} year={front.year} mailedOn={front.mailedOn} />
          </div>
        ) : null}
        {card ? (
          <p className="text-[14px] text-app-text-secondary leading-[21px] mt-1">
            {front ? 'Open it to read what they wrote.' : `${card.sealed ? 'It’s sealed until Christmas morning. ' : ''}You’ll see the card once it’s in your mailbox.`}
          </p>
        ) : null}
        {letter.previewText && (
          <p className="text-[14px] text-app-text-secondary leading-[21px] mt-1 break-words line-clamp-3">{letter.previewText}</p>
        )}
        <p className="text-[12px] text-app-text-muted mt-3">
          Sent {fmtDate(letter.createdAt)}{letter.outcomeDescription ? ` · ${letter.outcomeDescription}` : ''}
        </p>
      </section>
    </>
  );
}

/** Sent by email, or a card by link: the page opens it with a code to that address. A letter by text keeps signing in. */
export const opensWithCode = (letter: LinkPageLetter): boolean => Boolean(letter.card?.by_link) || letter.sentTo.includes('@');

const RESEND_SECONDS = 30;

type CodeLook = { primary: string; secondary: string; field: string; codeField: string; line: string; small: string; alert: string; link: string };
const PANEL_LOOK: CodeLook = {
  primary: primaryButton,
  secondary: secondaryButton,
  field: 'w-full h-12 rounded-xl border-[1.5px] border-app-border bg-app-surface px-3.5 text-[15px] text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-text',
  codeField: 'w-full h-14 rounded-xl border-[1.5px] border-app-border bg-app-surface px-3.5 text-center text-[24px] font-semibold tracking-[0.35em] text-app-text placeholder:text-app-text-muted placeholder:tracking-[0.2em] focus:outline-none focus:border-app-text',
  line: 'text-[14px] text-app-text-secondary leading-[20px] text-center break-words',
  small: 'text-[12px] text-app-text-muted leading-[17px] text-center [&_a]:font-semibold [&_a]:text-app-text-secondary [&_a]:underline',
  alert: 'rounded-xl border border-app-border bg-app-surface-sunken p-3.5 text-[13px] text-app-text leading-[19px]',
  link: 'text-[14px] font-semibold text-app-text underline underline-offset-2 disabled:opacity-50 disabled:no-underline',
};
const TABLE_LOOK: CodeLook = {
  primary: table.primary, secondary: table.secondary, field: table.field, codeField: `${table.field} ${table.codeField}`,
  line: table.line, small: table.small, alert: table.alert, link: table.textButton,
};

/**
 * Opening it with a code: one tap emails a 6-digit code to the address it was sent to (a card by link: the address they
 * type), they enter it, and they're signed in (with a new account if the address has none); `onSignedIn` then puts it in
 * their mailbox. Signing in another way stays below. Without a mail id (Look it over) it's drawn as the page first
 * shows it, and does nothing.
 */
type KeepIntent = 'save' | 'reply' | 'pass-on' | 'send-back';

function CodeSignIn({ letter, look, mailId, token, loginHref, onSignedIn, initialCode = '', submitLabel }: {
  letter: LinkPageLetter;
  look: CodeLook;
  mailId?: string;
  token?: string;
  loginHref?: string;
  onSignedIn?: () => void;
  /** Pre-filled 6-digit code from the code email's return link (never auto-submitted on GET). */
  initialCode?: string;
  /** Optional custom CTA label on the code confirmation button (e.g. "Save card & write back"). */
  submitLabel?: string;
}) {
  const card = letter.card ?? null;
  const byLink = Boolean(card?.by_link);
  const noun = card ? 'card' : 'letter';
  const live = Boolean(mailId && token);
  const hasPrefill = Boolean(initialCode && !byLink && letter.sentTo);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(hasPrefill ? letter.sentTo : null);
  const [code, setCode] = useState(hasPrefill ? initialCode : '');
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialCode && !byLink && letter.sentTo && !sentTo) {
      setSentTo(letter.sentTo);
      setCode(initialCode);
    }
  }, [initialCode, byLink, letter.sentTo, sentTo]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const tick = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(tick);
  }, [wait]);

  const send = async () => {
    if (!live || busy) return;
    const typed = email.trim();
    if (byLink && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) { setSaid('Enter your email address.'); return; }
    setBusy('send');
    setSaid(null);
    try {
      const res = await api.mailCompose.sendEscrowCode(mailId as string, token as string, byLink ? typed : undefined);
      setSentTo(res.sent_to);
      setCode('');
      setWait(RESEND_SECONDS);
      setTimeout(() => codeInput.current?.focus(), 0);
    } catch (err: unknown) {
      setSaid(serverWords(err) ?? 'Couldn’t send your code. Check your connection and try again.');
    }
    setBusy(null);
  };

  const check = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!live || busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length < 6) { setSaid('Enter the 6-digit code from the email.'); return; }
    setBusy('check');
    setSaid(null);
    try {
      await api.auth.signInWithMailCode({ mailId: mailId as string, token: token as string, code: digits, ...(byLink ? { email: email.trim() } : {}) });
      onSignedIn?.();
    } catch (err: unknown) {
      setSaid(serverWords(err) ?? 'Couldn’t check your code. Check your connection and try again.');
      setBusy(null);
    }
  };

  const terms = (
    <p className={look.small}>
      By continuing you agree to Pantopus’s <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
      {' '}New to Pantopus? This makes your free account.
    </p>
  );
  const otherWay = loginHref
    ? <Link href={loginHref} className={look.secondary}>Sign in another way</Link>
    : <span className={look.secondary}>Sign in another way</span>;

  if (sentTo) {
    return (
      <form className="flex w-full flex-col gap-2.5" onSubmit={(event) => void check(event)} data-testid="cardLinkCodeStep">
        <p className={look.line}>Enter the code we emailed to {sentTo}. It works for 10 minutes.</p>
        <input
          ref={codeInput}
          className={look.codeField}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          aria-label="Code from the email"
          data-testid="cardLinkCode"
        />
        <button type="submit" className={look.primary} disabled={busy !== null} data-testid="cardLinkCodeOpen">
          {busy === 'check' ? <Loader2 size={18} className="animate-spin" /> : null}
          {submitLabel ?? (card ? 'Open your card' : 'Read the letter')}
        </button>
        {said ? <div role="alert" className={look.alert}>{said}</div> : null}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <button type="button" className={look.link} disabled={busy !== null || wait > 0} onClick={() => void send()}>
            {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          </button>
          {byLink ? (
            <button type="button" className={look.link} disabled={busy !== null} onClick={() => { setSentTo(null); setCode(''); setSaid(null); }}>
              Use a different email
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      {byLink ? (
        <>
          <p className={look.line}>Enter your email and we’ll send you a code. The first person to open it keeps the {noun}.</p>
          <input
            className={look.field}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void send(); }}
            autoComplete="email"
            placeholder="you@example.com"
            aria-label="Your email"
            readOnly={!live}
            data-testid="cardLinkEmail"
          />
        </>
      ) : (
        <p className={look.line}>We’ll email a code to {letter.sentTo}, the address this {noun} was sent to.</p>
      )}
      {live ? (
        <button type="button" className={look.primary} disabled={busy !== null} onClick={() => void send()} data-testid="cardLinkSendCode">
          {busy === 'send' ? <Loader2 size={18} className="animate-spin" /> : null}
          Email me a code
        </button>
      ) : <span className={look.primary}>Email me a code</span>}
      {said ? <div role="alert" className={look.alert}>{said}</div> : null}
      {terms}
      {otherWay}
    </div>
  );
}

/**
 * Before it's opened, an account with no name (a code just made it, or an older one that never gave one) gives its name,
 * so the sender's "arrived" notice and their Sent list say who has it instead of "They". Saved on the profile, as
 * the app's own name prompt does, which then doesn't ask again.
 */
function NameStep({ letter, look, busy, onOpen }: {
  letter: LinkPageLetter;
  look: Pick<CodeLook, 'primary' | 'field' | 'line' | 'alert'>;
  busy: boolean;
  onOpen: () => void;
}) {
  const card = Boolean(letter.card);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || busy) return;
    if (!firstName.trim() || !lastName.trim()) { setSaid('Enter your first and last name.'); return; }
    setSaving(true);
    setSaid(null);
    try {
      await api.users.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      onOpen();
    } catch (err: unknown) {
      setSaid(serverWords(err) ?? 'Your name wasn’t saved. Check your connection and try again.');
    }
    setSaving(false);
  };

  return (
    <form className="flex w-full flex-col gap-2.5" onSubmit={(event) => void save(event)} data-testid="cardLinkNameStep">
      <p className={look.line}>What’s your name? {letter.senderName} will see it, so they know the {card ? 'card' : 'letter'} reached you.</p>
      <input ref={first} className={look.field} value={firstName} onChange={(event) => setFirstName(event.target.value)}
        autoComplete="given-name" placeholder="First name" aria-label="First name" maxLength={255} data-testid="cardLinkFirstName" />
      <input className={look.field} value={lastName} onChange={(event) => setLastName(event.target.value)}
        autoComplete="family-name" placeholder="Last name" aria-label="Last name" maxLength={255} data-testid="cardLinkLastName" />
      <button type="submit" className={look.primary} disabled={saving || busy} data-testid="cardLinkNameOpen">
        {saving || busy ? <Loader2 size={18} className="animate-spin" /> : null}
        {card ? 'Open your card' : 'Read the letter'}
      </button>
      {said ? <div role="alert" className={look.alert}>{said}</div> : null}
    </form>
  );
}

/**
 * After the name, for someone with no home yet: the card is already theirs, and adding their home address (the app's
 * own Add home page) is offered, never needed. It's for digital cards, mail and coupons only, never paper, and the words say so.
 */
function HomeStep({ letter, look, letterHref }: {
  letter: LinkPageLetter;
  look: Pick<CodeLook, 'primary' | 'secondary' | 'line'>;
  letterHref: string;
}) {
  const card = Boolean(letter.card);
  return (
    <div className="flex w-full flex-col gap-2.5" data-testid="cardLinkHomeStep">
      <p className={look.line}>
        Your {card ? 'card' : 'letter'} is in your Pantopus mailbox. If you like, add your home address too, so it’s
        easier to get digital cards, digital mail and digital coupons here later. All of it is digital: nothing physical
        is sent to your door.
      </p>
      <Link href={letterHref} className={look.primary} data-testid="cardLinkHomeSkip">{card ? 'Open your card' : 'Read the letter'}</Link>
      <Link href="/app/homes/new" className={look.secondary} data-testid="cardLinkHomeAdd">Add my home address</Link>
    </div>
  );
}

/**
 * Signed out: sign in or create an account with the address it was sent to. Without links (Look it over) it's drawn
 * as the page shows it, and does nothing.
 */
export function LinkPageSignIn({ letter, loginHref, registerHref, mailId, token, onSignedIn, initialCode = '' }: {
  letter: LinkPageLetter; loginHref?: string; registerHref?: string; mailId?: string; token?: string; onSignedIn?: () => void; initialCode?: string;
}) {
  if (opensWithCode(letter)) {
    return (
      <div className="mt-5">
        <CodeSignIn letter={letter} look={PANEL_LOOK} mailId={mailId} token={token} loginHref={loginHref} onSignedIn={onSignedIn} initialCode={initialCode} />
      </div>
    );
  }
  const card = letter.card ?? null;
  const byLink = Boolean(card?.by_link);
  const byNumber = !letter.sentTo.includes('@');
  const sentToLabel = `${letter.sentTo}, the ${byNumber ? 'number' : 'address'} this ${card ? 'card' : 'letter'} was sent to`;
  const signIn = card ? 'Sign in to open it' : 'Sign in to read it';
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {loginHref ? <Link href={loginHref} className={primaryButton}>{signIn}</Link> : <span className={primaryButton}>{signIn}</span>}
      {registerHref
        ? <Link href={registerHref} className={secondaryButton}>Create a free account</Link>
        : <span className={secondaryButton}>Create a free account</span>}
      {byLink ? null : (
        <p className="text-[13px] text-app-text-secondary leading-[19px] text-center mt-1">
          Use {sentToLabel}.
        </p>
      )}
    </div>
  );
}

/** The card on the table's page: who it's from, in words that say nothing of the note. Look it over draws these too. */
export function CardLinkWords({ letter }: { letter: LinkPageLetter }) {
  return (
    <div className={table.words}>
      <h1>A Christmas card for you</h1>
      <p className={table.from}>From {letter.senderName}</p>
      {/* A travelling card past its first stop (Part 7): how far it came. */}
      {travelCameLine(letter.card?.travel) ? <p className={table.line} data-testid="cardLinkTravelLine">{travelCameLine(letter.card?.travel)}</p> : null}
      {letter.senderVerified ? <span className={table.badge}>{letter.senderKind === 'business' ? 'Verified business' : 'Verified resident'}</span> : null}
      {letter.card?.sealed ? <p className={table.sealed}>It’s sealed until Christmas morning.</p> : null}
    </div>
  );
}

/** Signed out, on the table: open the card right away (when guest_open is on), or sign in with a code to save/keep it. */
export function CardLinkSignIn({
  letter,
  loginHref,
  registerHref,
  mailId,
  token,
  onSignedIn,
  onGuestOpen,
  openingGuest = false,
  guestOpenError = null,
  guestOpenedOnce = false,
  initialCode = '',
}: {
  letter: LinkPageLetter;
  loginHref?: string;
  registerHref?: string;
  mailId?: string;
  token?: string;
  onSignedIn?: () => void;
  onGuestOpen?: () => void;
  openingGuest?: boolean;
  guestOpenError?: string | null;
  guestOpenedOnce?: boolean;
  initialCode?: string;
}) {
  const card = letter.card ?? null;
  const byLink = Boolean(card?.by_link);
  const byNumber = !letter.sentTo.includes('@');
  const sealed = Boolean(card?.sealed);
  const guestOpen = Boolean(card?.guest_open);
  const live = Boolean(mailId && token);
  const first = firstNameOf(letter.senderName);
  const [showSignIn, setShowSignIn] = useState(Boolean(initialCode || guestOpenedOnce));

  useEffect(() => {
    if (initialCode || guestOpenedOnce) setShowSignIn(true);
  }, [initialCode, guestOpenedOnce]);

  if (guestOpen) {
    const primaryWords = sealed
      ? (guestOpenedOnce ? 'Peek at the envelope again' : 'Peek at the envelope')
      : (guestOpenedOnce ? 'Open it again' : 'Open your card');
    const subline = sealed
      ? (byLink
        ? 'Save it to your mailbox so it’s waiting for you on Christmas morning.'
        : 'We’ll email you on Christmas morning when the seal lifts — or save it to your mailbox now.')
      : guestOpenedOnce
        ? `Save ${first}’s card to your free Pantopus mailbox to keep it on your Mantel, write back, or send your own.`
        : 'Open and read it right here — no account needed.';
    return (
      <div className={table.actions} data-testid="cardLinkGuestActions">
        {live && onGuestOpen ? (
          <button type="button" className={table.primary} disabled={openingGuest} onClick={onGuestOpen} data-testid="cardLinkGuestOpen">
            {openingGuest ? <Loader2 size={18} className="animate-spin" /> : null}
            {primaryWords}
          </button>
        ) : (
          <span className={table.primary}>{primaryWords}</span>
        )}
        <p className={table.line}>{subline}</p>
        {guestOpenError ? <div role="alert" className={table.alert}>{guestOpenError}</div> : null}
        {!live ? (
          <span className={table.secondary}>{sealed ? 'Save for Christmas morning' : 'Save to my mailbox'}</span>
        ) : showSignIn ? (
          <div className="mt-1 flex w-full flex-col gap-2.5" data-testid="cardLinkSavePanel">
            <div className={table.keepDivider}>{sealed ? 'Save to your mailbox' : 'Keep it or write back'}</div>
            {opensWithCode(letter) ? (
              <CodeSignIn
                letter={letter}
                look={TABLE_LOOK}
                mailId={mailId}
                token={token}
                loginHref={loginHref}
                onSignedIn={onSignedIn}
                initialCode={initialCode}
                submitLabel="Save to my mailbox"
              />
            ) : (
              <>
                {loginHref ? <Link href={loginHref} className={table.secondary}>Sign in</Link> : null}
                {registerHref ? <Link href={registerHref} className={table.secondary}>Create a free account</Link> : null}
              </>
            )}
          </div>
        ) : (
          <button type="button" className={table.secondary} onClick={() => setShowSignIn(true)} data-testid="cardLinkShowSave">
            {sealed ? 'Save for Christmas morning' : 'Save to my mailbox'}
          </button>
        )}
      </div>
    );
  }

  if (opensWithCode(letter)) {
    return (
      <div className={table.actions}>
        <h2>Open your card</h2>
        <CodeSignIn letter={letter} look={TABLE_LOOK} mailId={mailId} token={token} loginHref={loginHref} onSignedIn={onSignedIn} initialCode={initialCode} />
      </div>
    );
  }
  return (
    <div className={table.actions}>
      <h2>Open your card</h2>
      <p className={table.line}>You’ll need a free Pantopus account to open it and keep it.</p>
      {loginHref ? <Link href={loginHref} className={table.primary}>Sign in</Link> : <span className={table.primary}>Sign in</span>}
      {registerHref ? <Link href={registerHref} className={table.secondary}>Create a free account</Link> : <span className={table.secondary}>Create a free account</span>}
      {byLink ? null : <p className={table.small}>Use {letter.sentTo}, the {byNumber ? 'number' : 'address'} this card was sent to.</p>}
    </div>
  );
}

/** Modal sheet over the full-screen guest CardTable when the reader taps Write back, Pass it on, or Save. */
function GuestKeepSheet({
  intent,
  letter,
  mailId,
  token,
  loginHref,
  signedIn,
  askName,
  wrongAccount,
  account,
  claiming,
  switching,
  problem,
  ownWords,
  initialCode,
  onClose,
  onSignedIn,
  onNamed,
  onClaim,
  onSwitchAccount,
}: {
  intent: KeepIntent;
  letter: LinkPageLetter;
  mailId: string;
  token: string;
  loginHref: string;
  signedIn: boolean | null;
  askName: boolean;
  wrongAccount: boolean;
  account: string;
  claiming: boolean;
  switching: boolean;
  problem: 'MAIL_OWN_LETTER' | 'FAILED' | 'SIGN_OUT' | null;
  ownWords: string;
  initialCode: string;
  onClose: () => void;
  onSignedIn: () => void;
  onNamed: () => void;
  onClaim: () => void;
  onSwitchAccount: () => void;
}) {
  const first = firstNameOf(letter.senderName);
  const byNumber = !letter.sentTo.includes('@');
  const copy: Record<KeepIntent, { title: string; intro: string; cta: string }> = {
    reply: {
      title: `Write back to ${first}`,
      intro: `Save ${first}’s card to your free Pantopus mailbox and send a note back.`,
      cta: `Save & write back`,
    },
    'pass-on': {
      title: 'Pass this card on',
      intro: `Save ${first}’s card to your free Pantopus mailbox, then pass it on free to up to two people.`,
      cta: 'Save & pass it on',
    },
    'send-back': {
      title: `Send ${first} a Christmas card`,
      intro: `Save ${first}’s card to your free Pantopus mailbox — your first 7 cards are free.`,
      cta: 'Save & send a card',
    },
    save: {
      title: 'Save to your mailbox',
      intro: `Keep ${first}’s card on your Mantel, write back anytime, or send up to 7 free cards.`,
      cta: 'Save to my mailbox',
    },
  };
  const words = copy[intent];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className={table.keepShade} data-ui onClick={onClose} data-testid="cardGuestKeepSheet">
      <section role="dialog" aria-modal="true" aria-labelledby="cardGuestKeepTitle" className={table.keepSheet} data-scroll onClick={(event) => event.stopPropagation()}>
        <div className={table.keepHead}>
          <h2 id="cardGuestKeepTitle">{words.title}</h2>
          <button type="button" className={table.keepClose} onClick={onClose} aria-label="Close" data-testid="cardGuestKeepClose">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={table.keepIntro}>{words.intro}</p>
        {signedIn === false ? (
          <CodeSignIn
            letter={letter}
            look={TABLE_LOOK}
            mailId={mailId}
            token={token}
            loginHref={loginHref}
            onSignedIn={onSignedIn}
            initialCode={initialCode}
            submitLabel={words.cta}
          />
        ) : signedIn === true && wrongAccount ? (
          <div className="flex flex-col gap-2.5">
            <div role="alert" className={table.alert}>
              This card was sent to {letter.sentTo}
              {account ? <>, and you’re signed in as <b>{account}</b></> : null}.
              {' '}Sign in or create an account with that {byNumber ? 'number' : 'address'} to save it.
            </div>
            <button type="button" onClick={onSwitchAccount} disabled={switching} className={table.primary}>
              {switching && <Loader2 size={18} className="animate-spin" />}
              Use another account
            </button>
            {problem === 'SIGN_OUT' && <p role="alert" className={table.line}>Sign-out couldn’t be confirmed. Try again before using another account.</p>}
          </div>
        ) : signedIn === true && askName ? (
          <div className="flex flex-col gap-2.5">
            <NameStep letter={letter} look={TABLE_LOOK} busy={claiming} onOpen={onNamed} />
            {problem === 'MAIL_OWN_LETTER' && <div role="alert" className={table.alert}>{ownWords}</div>}
            {problem === 'FAILED' && <div role="alert" className={table.alert}>Couldn’t add the card to your mailbox. Check your connection and try again.</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={onClaim} disabled={claiming} className={table.primary} data-testid="cardGuestKeepConfirm">
              {claiming ? <Loader2 size={18} className="animate-spin" /> : null}
              {words.cta}
            </button>
            {problem === 'MAIL_OWN_LETTER' && <div role="alert" className={table.alert}>{ownWords}</div>}
            {problem === 'FAILED' && <div role="alert" className={table.alert}>Couldn’t add the card to your mailbox. Check your connection and try again.</div>}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-app-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className={LINK_PAGE_PANEL}>{children}</div>
        <p className="text-[12px] text-app-text-muted leading-[18px] mt-4 text-center">
          Pantopus — your household, organized.{' '}
          <Link href="/start" className="text-primary-600 font-semibold hover:underline">What is Pantopus?</Link>
        </p>
      </div>
    </main>
  );
}

export default function OpenLetterView({ mailId, token, isCard = false }: {
  mailId: string;
  token: string;
  /** The server already knows it's a card on the table (launch key card_table): it starts on the table. */
  isCard?: boolean;
}) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [state, setState] = useState<ViewState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [problem, setProblem] = useState<'MAIL_OWN_LETTER' | 'FAILED' | 'SIGN_OUT' | null>(null);
  // Signed in with an account the letter wasn't sent to, and that account's email.
  const [wrongAccount, setWrongAccount] = useState(false);
  const [account, setAccount] = useState('');
  const [switching, setSwitching] = useState(false);
  // A card by link someone already has: signed in, the person who has it goes on to it.
  const [checkingTaken, setCheckingTaken] = useState(false);
  // An account with no name gives one before it opens (NameStep). Known once read: null until then.
  const [hasName, setHasName] = useState<boolean | null>(null);
  const [askName, setAskName] = useState(false);
  // Someone who just gave their name and has no home yet is offered one once the card is theirs (HomeStep).
  const justNamed = useRef(false);
  const [askHome, setAskHome] = useState(false);
  // Pre-filled 6-digit code from the code email's return link (never auto-submitted; stripped from the URL on mount).
  const [initialCode, setInitialCode] = useState('');
  // Guest card opening before sign-up (POST /api/mailbox/claim/:mailId/open): full tactile CardTable right in browser.
  const [guestCard, setGuestCard] = useState<GuestOpenCardResponse | null>(null);
  const [guestTableOpen, setGuestTableOpen] = useState(false);
  const [guestOpenedOnce, setGuestOpenedOnce] = useState(false);
  const [openingGuest, setOpeningGuest] = useState(false);
  const [guestOpenError, setGuestOpenError] = useState<string | null>(null);
  const [guestReplay, setGuestReplay] = useState(0);
  const intentKey = `pantopus:card-keep-intent:${mailId}`;
  const [keepIntent, setKeepIntentState] = useState<KeepIntent | null>(null);
  const setKeepIntent = (next: KeepIntent | null) => {
    setKeepIntentState(next);
    try {
      if (next) window.sessionStorage.setItem(intentKey, next);
      else window.sessionStorage.removeItem(intentKey);
    } catch { /* storage blocked */ }
  };
  const readStoredIntent = (): KeepIntent | null => {
    try {
      const value = window.sessionStorage.getItem(intentKey);
      return value === 'save' || value === 'reply' || value === 'pass-on' || value === 'send-back' ? value : null;
    } catch {
      return null;
    }
  };
  const clearStoredIntent = () => {
    try { window.sessionStorage.removeItem(intentKey); } catch { /* storage blocked */ }
  };

  const here = `/open/${mailId}?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirectTo=${encodeURIComponent(here)}`;
  // A claimed letter is the person's own: it is in their Personal drawer.
  const letterHref = `/app/mailbox/personal/${mailId}`;

  // Only while the read says the improvements are on; before them the page left `?code=` alone.
  const improvedRead = state.phase === 'ready' && state.improved;
  useEffect(() => {
    if (typeof window === 'undefined' || !improvedRead) return;
    const url = new URL(window.location.href);
    const rawCode = (url.searchParams.get('code') || '').replace(/\D/g, '').slice(0, 10);
    if (rawCode.length >= 6) {
      setInitialCode(rawCode);
      url.searchParams.delete('code');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, [improvedRead]);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ phase: 'closed', code: 'MAIL_LINK_INVALID' });
      return;
    }
    setState({ phase: 'loading' });
    api.mailCompose.getEscrowedMailPublic(mailId, token)
      .then((res) => { if (!cancelled) setState({ phase: 'ready', letter: res.improved ? res.mail : beforeImprovements(res.mail), improved: Boolean(res.improved) }); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ phase: 'closed', code: closedCode(err), card: closedForCard(err) || (isCard && closedCode(err) === 'UNAVAILABLE'), said: closedCode(err) === 'UNAVAILABLE' ? undefined : serverWords(err) });
      });
    return () => { cancelled = true; };
    // `isCard` is what the server said when the page was made; it doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailId, token, attempt]);

  // Already opened: the person who has it, opening its link again, goes on to their card. Anyone else is told.
  const taken = launchFeatures.cardTable && state.phase === 'closed' && state.code === 'MAIL_CLAIMED' && Boolean(state.card);
  useEffect(() => {
    if (!taken || !signedIn) return undefined;
    let cancelled = false;
    setCheckingTaken(true);
    api.mailCompose.claimEscrowedMail(mailId, token)
      .then(() => { if (!cancelled) router.replace(letterHref); })
      .catch(() => { if (!cancelled) setCheckingTaken(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, signedIn, mailId, token]);

  // The sender's notice names whoever opens it: an account with no name is asked for one first (NameStep). A profile
  // that can't be read doesn't stop it opening.
  const readName = async (): Promise<boolean> => {
    const profile = await api.users.getMyProfile().catch(() => null);
    const named = !profile || profile.accountType === 'business' || !isMissingName(profile);
    setHasName(named);
    if (!named) setAskName(true);
    return named;
  };

  // Signed in, it asks at once: a code sign-in remounts this page, so the claim it started never asks.
  const ready = state.phase === 'ready';
  useEffect(() => {
    if (signedIn !== true || !ready || hasName !== null) return;
    void readName();
  }, [signedIn, ready, hasName]);

  const openGuest = async () => {
    if (openingGuest) return;
    if (guestCard) {
      setGuestTableOpen(true);
      setGuestOpenedOnce(true);
      return;
    }
    setOpeningGuest(true);
    setGuestOpenError(null);
    try {
      const opened = await api.mailCompose.openEscrowedCardGuest(mailId, token);
      setGuestCard(opened);
      setGuestTableOpen(true);
      setGuestOpenedOnce(true);
    } catch (err: unknown) {
      const code = (err as { code?: unknown } | null)?.code;
      if (typeof code === 'string' && CLOSED_CODES.has(code)) {
        setState({ phase: 'closed', code: code as ClosedCode, card: true, said: serverWords(err) });
      } else {
        setGuestOpenError(serverWords(err) ?? 'Couldn’t open the card just now. Check your connection and try again.');
      }
    } finally {
      setOpeningGuest(false);
    }
  };

  const claim = async (explicitIntent: KeepIntent | null = null) => {
    setClaiming(true);
    setProblem(null);
    if (hasName === null && !(await readName())) { setClaiming(false); return; }
    const intent = state.phase === 'ready' && state.improved ? explicitIntent ?? keepIntent ?? readStoredIntent() : null;
    const targetHref = intent && intent !== 'save' ? `${letterHref}?intent=${encodeURIComponent(intent)}` : letterHref;
    try {
      await api.mailCompose.claimEscrowedMail(mailId, token);
      // Wave 4.1: on the way to their card, nothing is put over it (cardNoticeHold); only from a read that said `improved`.
      if (state.phase === 'ready' && state.improved && state.letter.card) markCardClaimPath(mailId);
      clearStoredIntent();
      if (justNamed.current && (!intent || intent === 'save')) {
        const mine = await api.homes.getMyHomes().catch(() => null);
        if (mine && mine.homes.length === 0) {
          setGuestTableOpen(false);
          setKeepIntentState(null);
          setAskHome(true);
          setClaiming(false);
          return;
        }
      }
      router.push(targetHref);
    } catch (err: unknown) {
      const code = (err as { code?: unknown } | null)?.code;
      if (typeof code === 'string' && CLOSED_CODES.has(code)) {
        setGuestTableOpen(false);
        setKeepIntent(null);
        setState({ phase: 'closed', code: code as ClosedCode, card: closedForCard(err) || Boolean(state.phase === 'ready' && state.letter.card), said: serverWords(err) });
      } else if (code === 'MAIL_UNAVAILABLE' && state.phase === 'ready' && state.letter.card) {
        // Refused for a reason it doesn't name (one of them has blocked the other): the server's words, on the same page as a closed card.
        setGuestTableOpen(false);
        setKeepIntent(null);
        setState({ phase: 'closed', code: 'MAIL_WITHDRAWN', card: true, said: serverWords(err) });
      } else if (code === 'MAIL_CONTACT_MISMATCH') {
        setWrongAccount(true);
        api.users.getMyProfile().then((profile) => setAccount(profile.email || '')).catch(() => setAccount(''));
      } else if (code === 'MAIL_OWN_LETTER') {
        setProblem('MAIL_OWN_LETTER');
      } else {
        setProblem('FAILED');
      }
      setClaiming(false);
    }
  };

  const switchAccount = async () => {
    const yes = await confirmStore.open({
      title: 'Use another account?',
      description: 'You’ll be signed out, then you can sign in or create an account with the address this letter was sent to.',
      confirmLabel: 'Sign out and continue',
    });
    if (!yes) return;
    setSwitching(true);
    try {
      // Signed out, this page offers signing in and creating an account, both coming back here.
      await api.auth.logout();
      setWrongAccount(false);
      setAccount('');
      setHasName(null);
      setAskName(false);
      setProblem(null);
    } catch {
      setProblem('SIGN_OUT');
    }
    setSwitching(false);
  };

  if (state.phase === 'loading' || (taken && checkingTaken)) {
    if (launchFeatures.cardTable && isCard) {
      return (
        <CardLinkScene>
          <div role="status" className={table.status}><Loader2 size={17} className="animate-spin" /> Opening your card…</div>
        </CardLinkScene>
      );
    }
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center">
        <div role="status" className="flex items-center gap-2.5 text-[14px] text-app-text-secondary">
          <Loader2 size={17} className="animate-spin text-app-text-muted" /> Opening your letter…
        </div>
      </main>
    );
  }

  if (state.phase === 'closed' && launchFeatures.cardTable && state.card) {
    // On the table, in the server's own sentence where it sent one: "Someone already opened this card. A card goes to one person."
    const title = state.code === 'UNAVAILABLE' ? 'Couldn’t open the card' : (state.said ?? cardWords(CLOSED[state.code].title));
    return (
      <CardLinkScene>
        <div className={table.words}>
          <h1>{title}</h1>
        </div>
        <div className={table.actions}>
          {state.code === 'MAIL_EXPIRED' ? <p className={table.line}>Ask the sender to send it again.</p> : null}
          {state.code === 'UNAVAILABLE' ? (
            <>
              <p className={table.line}>Check your connection and try again.</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={table.primary}>Try again</button>
            </>
          ) : null}
          {state.code === 'MAIL_CLAIMED' && signedIn !== null ? (
            <>
              {signedIn ? <Link href="/app/mailbox/personal" className={table.secondary}>Open my mailbox</Link> : null}
              {signedIn ? null : <p className={table.line}>If it’s yours, sign in and it opens.</p>}
              {signedIn ? null : <Link href={loginHref} className={table.secondary}>Sign in</Link>}
            </>
          ) : null}
          <p className={table.small}>Pantopus — your household, organized. <Link href="/start">What is Pantopus?</Link></p>
        </div>
      </CardLinkScene>
    );
  }

  if (state.phase === 'closed') {
    const words = state.card ? cardWords : (text: string) => text;
    const closed = { ...CLOSED[state.code], title: words(CLOSED[state.code].title), detail: words(CLOSED[state.code].detail) };
    const Icon = closed.icon;
    return (
      <Shell>
        <div className="text-center">
          <span className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-app-surface-sunken">
            <Icon size={26} strokeWidth={2} className="text-app-text-secondary" />
          </span>
          <h1 className="text-[19px] font-bold text-app-text -tracking-[0.01em] mt-4">{closed.title}</h1>
          <p className="text-[14px] text-app-text-secondary leading-[21px] mt-2">{closed.detail}</p>
          {state.code === 'MAIL_CLAIMED' && signedIn !== null && (
            <Link
              href={signedIn ? letterHref : `/login?redirectTo=${encodeURIComponent(letterHref)}`}
              className={`${primaryButton} mt-5`}
            >
              {signedIn ? 'Open my mailbox' : 'Sign in'}
            </Link>
          )}
          {state.code === 'UNAVAILABLE' && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${primaryButton} mt-5`}>
              Try again
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const { letter, improved } = state;
  // A Christmas card shows its front (unless it's sealed until Christmas), never its note, until it's in their mailbox.
  const card = letter.card ?? null;
  const noun = card ? 'card' : 'letter';
  const byNumber = !letter.sentTo.includes('@');
  const byLink = Boolean(card?.by_link);
  const ownWords = byLink ? 'This is your own card. Send the link to the person it’s for.' : `You sent this ${noun}. It’s waiting for the person you wrote to.`;

  if (launchFeatures.cardTable && card) {
    const first = firstNameOf(letter.senderName);
    if (guestTableOpen && guestCard) {
      const guestSealed = guestCard.card.sealed;
      const guestMenu: TableMenuItem[] = [
        { label: 'Open it again', onSelect: () => setGuestReplay((n) => n + 1) },
        { label: guestSealed ? 'Save for Christmas morning' : 'Save to my mailbox', onSelect: () => setKeepIntent('save') },
        ...(guestSealed ? [] : [
          { label: `Write back to ${first}`, onSelect: () => setKeepIntent('reply') },
          { label: `Send ${first} a card`, onSelect: () => setKeepIntent('send-back') },
        ]),
        ...(guestCard.journey && !guestSealed ? [{ label: 'See its journey', onSelect: () => router.push(`/cards/journey/${guestCard.journey}`) }] : []),
      ];
      return (
        <CardTable
          card={guestCard.card}
          improved={improved}
          note={guestCard.note}
          fromName={guestCard.senderName}
          toName={guestCard.toName || 'You'}
          mailedOn={guestCard.mailedOn}
          replay={guestReplay}
          paused={keepIntent !== null}
          closeLabel="Close card"
          menu={guestMenu}
          writeBack={guestSealed ? null : { label: `Write back to ${first}`, short: 'Write back', onSelect: () => setKeepIntent('reply') }}
          sendBack={guestSealed ? null : { label: 'Save to my mailbox', short: 'Save card', onSelect: () => setKeepIntent('save') }}
          passOn={!guestSealed && guestCard.journey ? { label: 'Pass it on', onSelect: () => setKeepIntent('pass-on') } : null}
          journey={!guestSealed && guestCard.journey ? { label: 'See its journey', onSelect: () => router.push(`/cards/journey/${guestCard.journey}`) } : null}
          mediaFrom={(fileId) => ({ claim: mailId, token, fileId })}
          onClose={() => { setKeepIntent(null); setGuestTableOpen(false); }}
          overlay={keepIntent ? (
            <GuestKeepSheet
              intent={keepIntent}
              letter={letter}
              mailId={mailId}
              token={token}
              loginHref={loginHref}
              signedIn={signedIn}
              askName={askName}
              wrongAccount={wrongAccount}
              account={account}
              claiming={claiming}
              switching={switching}
              problem={problem}
              ownWords={ownWords}
              initialCode={initialCode}
              onClose={() => setKeepIntent(null)}
              onSignedIn={() => void claim(keepIntent)}
              onNamed={() => { justNamed.current = true; setHasName(true); void claim(keepIntent); }}
              onClaim={() => void claim(keepIntent)}
              onSwitchAccount={() => void switchAccount()}
            />
          ) : null}
        />
      );
    }

    return (
      <CardLinkScene front={linkPageFront(letter)} postmarks={letter.card?.travel?.postmarks ?? null} improved={improved}>
        <CardLinkWords letter={letter} />

        {signedIn === false && (
          <CardLinkSignIn
            letter={letter}
            loginHref={loginHref}
            registerHref={`/register?redirectTo=${encodeURIComponent(here)}`}
            mailId={mailId}
            token={token}
            onSignedIn={() => void claim()}
            onGuestOpen={() => void openGuest()}
            openingGuest={openingGuest}
            guestOpenError={guestOpenError}
            guestOpenedOnce={guestOpenedOnce}
            initialCode={initialCode}
          />
        )}

        {signedIn === true && wrongAccount && (
          <div className={table.actions}>
            <div role="alert" className={table.alert}>
              This card was sent to {letter.sentTo}
              {account ? <>, and you’re signed in as <b>{account}</b></> : null}.
              {' '}Sign in or create an account with that {byNumber ? 'number' : 'address'} to {improved ? 'save' : 'open'} it.
            </div>
            {card.guest_open ? (
              <button type="button" onClick={() => void openGuest()} disabled={openingGuest} className={table.primary} data-testid="cardLinkGuestOpen">
                {openingGuest ? <Loader2 size={18} className="animate-spin" /> : null}
                {card.sealed ? 'Peek at the envelope' : 'Open and read anyway'}
              </button>
            ) : null}
            <button type="button" onClick={() => void switchAccount()} disabled={switching} className={card.guest_open ? table.secondary : table.primary}>
              {switching && <Loader2 size={18} className="animate-spin" />}
              Use another account
            </button>
            {problem === 'SIGN_OUT' && <p role="alert" className={table.line}>Sign-out couldn’t be confirmed. Try again before using another account.</p>}
          </div>
        )}

        {signedIn === true && !wrongAccount && askHome && (
          <div className={table.actions}>
            <HomeStep letter={letter} look={TABLE_LOOK} letterHref={letterHref} />
          </div>
        )}

        {signedIn === true && !wrongAccount && askName && !askHome && (
          <div className={table.actions}>
            <NameStep letter={letter} look={TABLE_LOOK} busy={claiming} onOpen={() => { justNamed.current = true; setHasName(true); void claim(); }} />
            {problem === 'MAIL_OWN_LETTER' && <div role="alert" className={table.alert}>{ownWords}</div>}
            {problem === 'FAILED' && <div role="alert" className={table.alert}>Couldn’t add the card to your mailbox. Check your connection and try again.</div>}
          </div>
        )}

        {signedIn === true && !wrongAccount && hasName !== null && !askName && (
          <div className={table.actions}>
            <button type="button" data-testid="cardLinkOpen" onClick={() => void claim()} disabled={claiming} className={table.primary}>
              {claiming ? <Loader2 size={18} className="animate-spin" /> : null}
              Open your card
            </button>
            <p className={table.line}>It goes into your Pantopus mailbox, where only you can open it.</p>
            {problem === 'MAIL_OWN_LETTER' && <div role="alert" className={table.alert}>{ownWords}</div>}
            {problem === 'FAILED' && <div role="alert" className={table.alert}>Couldn’t add the card to your mailbox. Check your connection and try again.</div>}
          </div>
        )}

        <p className={table.small}>
          {letter.expiresAt ? `It waits until ${fmtDate(letter.expiresAt)}. ` : ''}
          {byLink
            ? (card.guest_open ? 'The first person to save it to a mailbox keeps it. ' : 'The first person to open it keeps it. ')
            : `Only the account with that ${byNumber ? 'number' : 'address'} can ${improved ? 'save it to' : 'add it to'} a mailbox. `}
          <Link href="/start">What is Pantopus?</Link>
        </p>
      </CardLinkScene>
    );
  }

  return (
    <Shell>
      <LinkPageSummary letter={letter} />

      {signedIn === false && (
        <LinkPageSignIn letter={letter} loginHref={loginHref} registerHref={`/register?redirectTo=${encodeURIComponent(here)}`}
          mailId={mailId} token={token} onSignedIn={() => void claim()} initialCode={initialCode} />
      )}

      {signedIn === true && wrongAccount && (
        <div className="mt-5 flex flex-col gap-2.5">
          <div role="alert" className="rounded-xl border border-app-border bg-app-surface-sunken p-3.5 text-[13px] text-app-text leading-[19px]">
            This {noun} was sent to {letter.sentTo}
            {account ? <>, and you’re signed in as <span className="font-semibold break-all">{account}</span></> : null}.
            {' '}Sign in or create an account with that {byNumber ? 'number' : 'address'} to {card ? 'open' : 'read'} it.
          </div>
          <button type="button" onClick={() => void switchAccount()} disabled={switching} className={primaryButton}>
            {switching && <Loader2 size={18} className="animate-spin" />}
            Use another account
          </button>
          {problem === 'SIGN_OUT' && (
            <p role="alert" className="text-[13px] text-app-error leading-[19px] text-center">
              Sign-out couldn’t be confirmed. Try again before using another account.
            </p>
          )}
        </div>
      )}

      {signedIn === true && !wrongAccount && askHome && (
        <div className="mt-5 flex flex-col gap-2.5">
          <HomeStep letter={letter} look={PANEL_LOOK} letterHref={letterHref} />
        </div>
      )}

      {signedIn === true && !wrongAccount && askName && !askHome && (
        <div className="mt-5 flex flex-col gap-2.5">
          <NameStep letter={letter} look={PANEL_LOOK} busy={claiming} onOpen={() => { justNamed.current = true; setHasName(true); void claim(); }} />
          {problem === 'MAIL_OWN_LETTER' && <div role="alert" className={PANEL_LOOK.alert}>{ownWords}</div>}
          {problem === 'FAILED' && (
            <p role="alert" className="text-[13px] text-app-error leading-[19px] text-center">
              Couldn’t add the {noun} to your mailbox. Check your connection and try again.
            </p>
          )}
        </div>
      )}

      {signedIn === true && !wrongAccount && hasName !== null && !askName && (
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="button" onClick={() => void claim()} disabled={claiming} className={primaryButton}>
            {claiming ? <Loader2 size={18} className="animate-spin" /> : <MailCheck size={18} strokeWidth={2.25} />}
            {card ? 'Open the card' : 'Read the letter'}
          </button>
          <p className="text-[13px] text-app-text-secondary leading-[19px] text-center">
            It goes into your Pantopus mailbox, where only you can {card ? 'open' : 'read'} it.
          </p>
          {problem === 'MAIL_OWN_LETTER' && (
            <div role="alert" className="rounded-xl border border-app-border bg-app-surface-sunken p-3.5 text-[13px] text-app-text leading-[19px]">
              {ownWords}
            </div>
          )}
          {problem === 'FAILED' && (
            <p role="alert" className="text-[13px] text-app-error leading-[19px] text-center">
              Couldn’t add the {noun} to your mailbox. Check your connection and try again.
            </p>
          )}
        </div>
      )}

      <p className="text-[12px] text-app-text-muted leading-[17px] mt-5 pt-4 border-t border-app-border-subtle">
        {signedIn && !byLink ? `Sent to ${letter.sentTo}. ` : ''}
        {letter.expiresAt ? `It waits for you until ${fmtDate(letter.expiresAt)}. ` : ''}
        {byLink ? 'The first person to open it keeps it.' : <>Only the account with that {byNumber ? 'number' : 'address'} can add it to a mailbox.</>}
      </p>
    </Shell>
  );
}

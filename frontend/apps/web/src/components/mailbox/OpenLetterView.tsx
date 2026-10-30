// ============================================================
// OpenLetterView — a letter for someone who isn't on Pantopus yet,
// opened from the link in its email (or text).
// Signed out, it shows who the letter is from and a short preview,
// never the letter itself. Signing in or creating an account with the
// address it was sent to comes back here, and "Read the letter" puts
// it in that person's own mailbox, where they read it. A letter sent
// as a business names only the business. Plain state, not react-query,
// like the other public token pages.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { EscrowClaimErrorCode, EscrowedMailView } from '@pantopus/api';
import { BadgeCheck, Clock, Loader2, Mail, MailCheck, MailX, type LucideIcon } from 'lucide-react';
import { confirmStore } from '@/components/ui/confirm-store';

type Letter = EscrowedMailView['mail'];
type ClosedCode = Extract<EscrowClaimErrorCode, 'MAIL_LINK_INVALID' | 'MAIL_CLAIMED' | 'MAIL_EXPIRED' | 'MAIL_WITHDRAWN'> | 'UNAVAILABLE';
type ViewState =
  | { phase: 'loading' }
  | { phase: 'closed'; code: ClosedCode; card?: boolean }
  | { phase: 'ready'; letter: Letter };

// A Christmas card (holiday_cards) closes in card words: the server marks its answer `card: true`.
const closedForCard = (err: unknown): boolean => Boolean((err as { data?: { card?: unknown } } | null)?.data?.card);
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-app-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">{children}</div>
        <p className="text-[12px] text-app-text-muted leading-[18px] mt-4 text-center">
          Pantopus — your household, organized.{' '}
          <Link href="/start" className="text-primary-600 font-semibold hover:underline">What is Pantopus?</Link>
        </p>
      </div>
    </main>
  );
}

export default function OpenLetterView({ mailId, token }: { mailId: string; token: string }) {
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

  const here = `/open/${mailId}?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirectTo=${encodeURIComponent(here)}`;
  // A claimed letter is the person's own: it is in their Personal drawer.
  const letterHref = `/app/mailbox/personal/${mailId}`;

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ phase: 'closed', code: 'MAIL_LINK_INVALID' });
      return;
    }
    setState({ phase: 'loading' });
    api.mailCompose.getEscrowedMailPublic(mailId, token)
      .then((res) => { if (!cancelled) setState({ phase: 'ready', letter: res.mail }); })
      .catch((err: unknown) => { if (!cancelled) setState({ phase: 'closed', code: closedCode(err), card: closedForCard(err) }); });
    return () => { cancelled = true; };
  }, [mailId, token, attempt]);

  const claim = async () => {
    setClaiming(true);
    setProblem(null);
    try {
      await api.mailCompose.claimEscrowedMail(mailId, token);
      router.push(letterHref);
    } catch (err: unknown) {
      const code = (err as { code?: unknown } | null)?.code;
      if (typeof code === 'string' && CLOSED_CODES.has(code)) {
        setState({ phase: 'closed', code: code as ClosedCode, card: closedForCard(err) || Boolean(state.phase === 'ready' && state.letter.card) });
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
      setProblem(null);
    } catch {
      setProblem('SIGN_OUT');
    }
    setSwitching(false);
  };

  if (state.phase === 'loading') {
    return (
      <main className="min-h-screen bg-app-bg flex items-center justify-center">
        <div role="status" className="flex items-center gap-2.5 text-[14px] text-app-text-secondary">
          <Loader2 size={17} className="animate-spin text-app-text-muted" /> Opening your letter…
        </div>
      </main>
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

  const { letter } = state;
  // A Christmas card says only that it is one: no picture, no note, until it's in their mailbox.
  const card = letter.card ?? null;
  const noun = card ? 'card' : 'letter';
  const byNumber = !letter.sentTo.includes('@');
  const sentToLabel = `${letter.sentTo}, the ${byNumber ? 'number' : 'address'} this ${noun} was sent to`;

  return (
    <Shell>
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
              {letter.senderKind === 'business' ? 'Verified business' : 'Verified neighbor'}
            </p>
          )}
        </div>
      </div>

      <section aria-label={card ? 'Card' : 'Letter preview'} className="mt-5 rounded-xl border border-app-border-subtle bg-app-surface-raised p-4">
        {letter.subject && <h2 className="text-[15px] font-semibold text-app-text break-words">{letter.subject}</h2>}
        {card ? (
          <p className="text-[14px] text-app-text-secondary leading-[21px] mt-1">
            {card.sealed ? 'It’s sealed until Christmas morning. ' : ''}You’ll see the card once it’s in your mailbox.
          </p>
        ) : null}
        {letter.previewText && (
          <p className="text-[14px] text-app-text-secondary leading-[21px] mt-1 break-words line-clamp-3">{letter.previewText}</p>
        )}
        <p className="text-[12px] text-app-text-muted mt-3">
          Sent {fmtDate(letter.createdAt)}{letter.outcomeDescription ? ` · ${letter.outcomeDescription}` : ''}
        </p>
      </section>

      {signedIn === false && (
        <div className="mt-5 flex flex-col gap-2.5">
          <Link href={loginHref} className={primaryButton}>{card ? 'Sign in to open it' : 'Sign in to read it'}</Link>
          <Link href={`/register?redirectTo=${encodeURIComponent(here)}`} className={secondaryButton}>Create a free account</Link>
          <p className="text-[13px] text-app-text-secondary leading-[19px] text-center mt-1">
            Use {sentToLabel}.
          </p>
        </div>
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

      {signedIn === true && !wrongAccount && (
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
              You sent this {noun}. It’s waiting for the person you wrote to.
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
        {signedIn ? `Sent to ${letter.sentTo}. ` : ''}
        {letter.expiresAt ? `It waits for you until ${fmtDate(letter.expiresAt)}. ` : ''}
        Only the account with that {byNumber ? 'number' : 'address'} can add it to a mailbox.
      </p>
    </Shell>
  );
}

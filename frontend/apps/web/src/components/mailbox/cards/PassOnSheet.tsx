'use client';

// ============================================================
// "Pass it on" (travelling card Part 4; server key card_travel): the reply's sheet with two fields more, drawn as the
// sample's paper sheet (sample/page.html .sheet). Who gets it next (the picker of "Who it's for": search, an email
// address, a link), the note for them in the pen, the line saying which town goes on the journey, "Send it on" and
// what it costs (nothing) and when it goes. It runs the server's checks (pass-on preview), then hands the card to the
// sealing table, which seals it by hand as a card is sealed.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { CardSignature, PassOnBody, PassOnPreview } from '@pantopus/api';
import { useHolidayCards } from '@/lib/mailbox-queries';
import * as mailboxApi from '@/lib/mailbox-api';
import type { MailboxApiError } from '@/lib/mailbox-api';
import { cardPen } from './cardFont';
import { ToStep, firstName, sendMessage, type Recipient } from './SendCardFlow';
import TownSheet from './TownSheet';
import styles from './CardTravel.module.css';

const LIMIT = 300;
const PEN = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;

/** Who it goes to, in the sheet's words: a first name, or "them" for an address or a link. */
export function passOnWho(to: Recipient): string {
  return to.kind === 'person' ? firstName(to.name) : 'them';
}

/** The line under "Send it on": free, and when it goes. */
export function passOnFree(to: Recipient): string {
  if (to.kind === 'link') return 'Free. Share the link yourself.';
  if (to.kind === 'email') return `Free. We email ${to.email.trim()} now.`;
  if (to.kind === 'person') return `Free. It leaves with the morning mail. Only ${firstName(to.name)} reads your note.`;
  return 'Free.';
}

export interface PassOnReady {
  to: Recipient;
  body: PassOnBody;
  preview: PassOnPreview;
}

export default function PassOnSheet({ cardId, place, signature, onReady, onClose }: {
  /** The card the reader received. */
  cardId: string;
  /** `card.travel.next_place`. */
  place: number;
  /** Their saved signature (null: their typed first name), as a reply carries it. */
  signature: CardSignature | null;
  /** Checked by the server: seal it by hand on the table. */
  onReady: (ready: PassOnReady) => void;
  onClose: () => void;
}) {
  const cards = useHolidayCards();
  const town = cards.data?.travel?.town ?? null;
  const [to, setTo] = useState<Recipient | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [askTown, setAskTown] = useState(false);
  // One request ID per pass-on draft, sent again with every retry of it (a lost answer never sends a second card).
  const requestId = useRef<string>(crypto.randomUUID());
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const count = [...message].length;

  useEffect(() => { if (to) noteRef.current?.focus({ preventScroll: true }); }, [to]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !checking && !askTown) { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, checking, askTown]);

  // `townKept`: they've just given their town, so don't ask again.
  const check = (townKept = false) => {
    if (!to) return;
    if (!message.trim()) { setError('Write a few words first.'); return; }
    if (!town && !townKept) { setAskTown(true); return; }
    if (to.kind === 'list') return;
    const body: PassOnBody = {
      to: to.kind === 'person' ? { user_id: to.userId } : to.kind === 'email' ? { email: to.email.trim() } : { link: true },
      message: message.trim(),
      request_id: requestId.current,
      place,
      ...(signature ? { signature } : {}),
    };
    setError(null);
    setChecking(true);
    mailboxApi.previewPassOn(cardId, body)
      .then(({ pass_on: preview }) => onReady({ to, body, preview }))
      .catch((err: MailboxApiError) => {
        if (err.serverCode === 'CARD_TRAVEL_NEEDS_TOWN') { setAskTown(true); return; }
        setError(sendMessage(err, to.kind === 'email'));
      })
      .finally(() => setChecking(false));
  };

  return createPortal(
    <div className={styles.backdrop} onClick={(event) => { if (event.target === event.currentTarget && !checking) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="passOnSheet">
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose} disabled={checking}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h2 id={titleId} className={styles.title}>Pass it on</h2>
        <p className={styles.sub}>The same card goes on, with a note from you.</p>

        <p className={styles.label}>Who gets it next</p>
        {to ? (
          <div className={styles.who} data-testid="passOnWho">
            <i aria-hidden="true">{to.kind === 'person' ? to.name.charAt(0).toUpperCase() : to.kind === 'email' ? '@' : '↗'}</i>
            <b>{to.kind === 'person' ? to.name : to.kind === 'email' ? to.email : 'Whoever opens your link'}</b>
            <button type="button" className={styles.quiet} onClick={() => { setTo(null); setError(null); }} disabled={checking}>Change</button>
          </div>
        ) : (
          <div className={styles.picker} data-testid="passOnPicker">
            <ToStep onChoose={(next) => { setTo(next); setError(null); }} onPaper />
          </div>
        )}

        {to ? (
          <>
            <label htmlFor={`${titleId}-note`} className={styles.label}>Your note for {passOnWho(to)}</label>
            <div className={styles.draft}>
              <textarea
                id={`${titleId}-note`}
                ref={noteRef}
                value={message}
                onChange={(event) => setMessage([...event.target.value].slice(0, LIMIT).join(''))}
                placeholder={to.kind === 'person' ? `Dear ${firstName(to.name)},` : ''}
                style={{ fontFamily: PEN }}
                disabled={checking}
                data-testid="passOnNote"
              />
            </div>
            <p aria-live="polite" className={styles.count}>{count} of {LIMIT} letters</p>
            {town ? <p className={styles.tip} data-testid="passOnTown">Your town, {town}, goes on its journey. Never your name or address.</p> : null}
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
            <button type="button" className={styles.send} onClick={() => check()} disabled={checking} data-testid="passOnSend">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Send it on
            </button>
            <p className={styles.free}>{passOnFree(to)}</p>
          </>
        ) : null}
      </div>
      {askTown ? (
        <TownSheet
          onDone={() => { setAskTown(false); check(true); }}
          onClose={() => setAskTown(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}

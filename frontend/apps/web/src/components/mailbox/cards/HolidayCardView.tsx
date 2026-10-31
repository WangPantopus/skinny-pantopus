'use client';

// ============================================================
// Reading a Christmas card (holiday_cards). Sealed until Christmas morning:
// the envelope with its seal and how long until it opens. The first time it's
// opened: the envelope opens and the card slides out picture side up. Then
// "Turn it over" to read the note. With Reduce Motion nothing slides or turns.
// The sealed notice and the slide-out are shared with Look it over, the
// sender's look before sending, so it shows exactly this.
// ============================================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { MailItemV2 } from '@/types/mailbox';
import MailPiece from '../MailPiece';
import CardFront from './CardFront';
import CardBack from './CardBack';
import CardFlip from './CardFlip';
import { inDays, SERIF, WAX } from './cardArt';

const MOTION = `
@keyframes pantopus-card-rise { from { transform: translateY(38%) scale(0.92); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pantopus-envelope-away { from { transform: none; opacity: 1; } to { transform: translateY(55%); opacity: 0; } }
`;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    setReduced(query.matches);
    const change = () => setReduced(query.matches);
    query.addEventListener?.('change', change);
    return () => query.removeEventListener?.('change', change);
  }, []);
  return reduced;
}

/**
 * The card leaving its envelope: envelope → opening (it rises out as the envelope drops away, about 0.7 s) → card.
 * `open` plays it from the start, again if asked; with Reduce Motion the card is simply there.
 */
export function useCardOpening(firstOpen: boolean) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<'envelope' | 'opening' | 'card'>(firstOpen ? 'envelope' : 'card');
  const [plays, setPlays] = useState(0);

  useEffect(() => {
    if (stage !== 'opening') return;
    const done = window.setTimeout(() => setStage('card'), 760);
    return () => window.clearTimeout(done);
  }, [stage, plays]);

  const open = useCallback(() => {
    if (reduced) { setStage('card'); return; }
    setPlays((n) => n + 1);
    setStage('opening');
  }, [reduced]);

  return { stage, plays, open };
}

/** What a sealed card says when it's tapped before Christmas morning. */
export function SealedNotice({ from, day, when, className = '' }: { from: string; day: string; when?: string | null; className?: string }) {
  return (
    <section aria-label="Sealed until Christmas" className={`rounded-2xl border border-[#e7dcc6] bg-[#fbf6ec] px-5 py-4 text-center [@media(prefers-color-scheme:dark)]:brightness-[0.94] ${className}`}>
      <p className="text-[22px] leading-7" style={{ fontFamily: SERIF, color: WAX }}>Do not open until Christmas</p>
      <p className="mt-2 text-[15px] leading-[22px] text-[#374151]">
        {from} sealed this card. It opens on Christmas morning, {day}{when ? `, ${when}` : ''}.
      </p>
    </section>
  );
}

/**
 * The card out of its envelope, picture side up, with what goes under it (`children`: its buttons); while `opening`
 * it rises out as the envelope drops away below.
 */
export function CardFromEnvelope({
  piece,
  recipientName,
  recipientLine,
  opening,
  plays = 0,
  showBack,
  children,
}: {
  piece: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  opening: boolean;
  /** Each play starts the movement again from the beginning. */
  plays?: number;
  showBack: boolean;
  children?: ReactNode;
}) {
  const card = piece.card!;
  const from = piece.sender_display || 'Someone';
  return (
    <div className="relative">
      <style>{MOTION}</style>
      <div key={plays} style={opening ? { animation: 'pantopus-card-rise 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both' } : undefined}>
        <CardFlip
          showBack={showBack}
          front={<CardFront design={card.design} caption={card.caption} paper={card.paper} year={card.year} mailedOn={piece.postmark?.date || piece.created_at} className="rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]" />}
          back={<CardBack paper={card.paper} fromName={from} year={card.year} message={piece.content || ''} className="rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]" />}
        />
      </div>
      {opening ? (
        <div key={`away-${plays}`} className="pointer-events-none absolute inset-x-0 bottom-0" style={{ animation: 'pantopus-envelope-away 720ms ease-in both' }}>
          <MailPiece item={piece} recipientName={recipientName} recipientLine={recipientLine} opened />
        </div>
      ) : null}
      {children}
    </div>
  );
}

const button = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export default function HolidayCardView({
  piece,
  recipientName,
  recipientLine,
  firstOpen,
  onOpenEnvelope,
}: {
  piece: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  /** It hadn't been opened before this visit: it opens from its envelope. */
  firstOpen: boolean;
  /** Who sent it and its trail. */
  onOpenEnvelope: () => void;
}) {
  const card = piece.card!;
  const from = piece.sender_display || 'Someone';
  // The caption as a sentence for screen readers: most end in a full stop or a question mark already.
  const caption = card.caption || 'A Christmas picture';
  const captionSentence = /[.!?]$/.test(caption) ? caption : `${caption}.`;
  const { stage, plays, open } = useCardOpening(firstOpen);
  const [showBack, setShowBack] = useState(false);

  const envelope = (
    <button
      type="button"
      onClick={onOpenEnvelope}
      aria-label={`Christmas card from ${from}${card.sealed ? ', sealed until Christmas morning' : ''}. Show who sent it and its trail`}
      className="block w-full rounded-lg text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <MailPiece item={piece} recipientName={recipientName} recipientLine={recipientLine} opened={false} />
    </button>
  );

  if (card.sealed) {
    const opens = card.sealed_until ? new Date(card.sealed_until) : null;
    const day = opens ? opens.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'December 25';
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
        {envelope}
        <SealedNotice from={from} day={day} when={card.sealed_until ? inDays(card.sealed_until) : null} className="mt-5" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
      {stage === 'envelope' ? (
        <div>
          {envelope}
          <p className="mt-4 text-center text-[15px] leading-[22px] text-app-text-secondary">A Christmas card from {from.replace(/\.$/, '')}.</p>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={open}
              className={`${button} text-[#fff7ed] focus-visible:ring-[#8b1d1d]`}
              style={{ backgroundColor: WAX }}
            >
              Open the envelope
            </button>
          </div>
        </div>
      ) : (
        <CardFromEnvelope piece={piece} recipientName={recipientName} recipientLine={recipientLine} opening={stage === 'opening'} plays={plays} showBack={showBack}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowBack((back) => !back)}
              aria-pressed={showBack}
              className={`${button} border border-[#d6cbb6] bg-[#fffdf8] text-[#374151] hover:bg-[#f5efe3] focus-visible:ring-[#8b1d1d]`}
            >
              {showBack ? 'Turn it back' : 'Turn it over'}
            </button>
            <button
              type="button"
              onClick={onOpenEnvelope}
              className={`${button} text-app-text-secondary hover:text-app-text focus-visible:ring-primary-500`}
            >
              The envelope
            </button>
          </div>
          {/* The note for screen readers, whichever side is up */}
          <p className="sr-only">{`Card from ${from}: ${captionSentence} On the back: ${piece.content || ''}`}</p>
        </CardFromEnvelope>
      )}
    </div>
  );
}

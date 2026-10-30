'use client';

// ============================================================
// Reading a Christmas card (holiday_cards). Sealed until Christmas morning:
// the envelope with its seal and how long until it opens. The first time it's
// opened: the envelope opens and the card slides out picture side up. Then
// "Turn it over" to read the note. With Reduce Motion nothing slides or turns.
// ============================================================

import { useEffect, useState } from 'react';
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

function useReducedMotion(): boolean {
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
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<'envelope' | 'opening' | 'card'>(firstOpen ? 'envelope' : 'card');
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    if (stage !== 'opening') return;
    const done = window.setTimeout(() => setStage('card'), 760);
    return () => window.clearTimeout(done);
  }, [stage]);

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
        <section aria-label="Sealed until Christmas" className="mt-5 rounded-2xl border border-[#e7dcc6] bg-[#fbf6ec] px-5 py-4 text-center [@media(prefers-color-scheme:dark)]:brightness-[0.94]">
          <p className="text-[22px] leading-7" style={{ fontFamily: SERIF, color: WAX }}>Do not open until Christmas</p>
          <p className="mt-2 text-[15px] leading-[22px] text-[#374151]">
            {from} sealed this card. It opens on Christmas morning, {day}
            {card.sealed_until ? `, ${inDays(card.sealed_until)}` : ''}.
          </p>
        </section>
      </div>
    );
  }

  const theCard = (
    <CardFlip
      showBack={showBack}
      front={<CardFront design={card.design} caption={card.caption} paper={card.paper} year={card.year} mailedOn={piece.postmark?.date || piece.created_at} className="rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]" />}
      back={<CardBack paper={card.paper} fromName={from} year={card.year} message={piece.content || ''} className="rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]" />}
    />
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
      <style>{MOTION}</style>
      {stage === 'envelope' ? (
        <div>
          {envelope}
          <p className="mt-4 text-center text-[15px] leading-[22px] text-app-text-secondary">A Christmas card from {from.replace(/\.$/, '')}.</p>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setStage(reduced ? 'card' : 'opening')}
              className={`${button} text-[#fff7ed] focus-visible:ring-[#8b1d1d]`}
              style={{ backgroundColor: WAX }}
            >
              Open the envelope
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div style={stage === 'opening' ? { animation: 'pantopus-card-rise 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both' } : undefined}>
            {theCard}
          </div>
          {stage === 'opening' ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ animation: 'pantopus-envelope-away 720ms ease-in both' }}>
              <MailPiece item={piece} recipientName={recipientName} recipientLine={recipientLine} opened />
            </div>
          ) : null}
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
          <p className="sr-only">{`Card from ${from}: ${card.caption || 'a Christmas picture'}. On the back: ${piece.content || ''}`}</p>
        </div>
      )}
    </div>
  );
}

'use client';

// ============================================================
// The back of a Christmas card: the same card stock, faint lines, the note in
// fountain-pen blue, and who it's from printed at the bottom. It fills the box
// it's given (the flip lays it over the picture side, the same size).
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import { launchFeatures } from '@/lib/featureFlags';
import { INK, paperStyle, SERIF } from './cardArt';
import { cardPen } from './cardFont';
import { PaperBack } from './CardPaper';
import type { CardSignature } from '@pantopus/api';

export const BACK_TEXT: CSSProperties = launchFeatures.cardTable ? {
  fontFamily: `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`,
  fontSize: '6cqw',
  lineHeight: '7.6cqw',
  color: '#1b2a5c',
} : {
  fontFamily: SERIF,
  fontStyle: 'italic',
  fontSize: '4.7cqw',
  lineHeight: '7.6cqw',
  color: INK,
};

/** Faint ruled lines under the writing, one per line of text. */
export const RULED: CSSProperties = {
  backgroundImage: launchFeatures.cardTable
    ? 'repeating-linear-gradient(180deg, transparent 0 calc(7.6cqw - 1px), rgba(74, 84, 118, 0.2) calc(7.6cqw - 1px) 7.6cqw)'
    : 'repeating-linear-gradient(180deg, transparent 0 calc(7.6cqw - 1px), rgba(120, 100, 70, 0.22) calc(7.6cqw - 1px) 7.6cqw)',
  backgroundAttachment: 'local',
};

export default function CardBack({
  number,
  paper,
  fromName,
  year,
  message,
  signature,
  children,
  className = '',
}: {
  /** The picture's number: the new pen's small shifts are seeded from it. */
  number?: number | null;
  paper: string;
  fromName: string;
  year: number;
  /** The note; or pass `children` (the writing box while it's being written). */
  message?: string;
  /** Signed beside FROM (design plan 8.2, card table only). */
  signature?: CardSignature | null;
  children?: ReactNode;
  className?: string;
}) {
  if (launchFeatures.cardTable) {
    return <PaperBack number={number} paper={paper} fromName={fromName} year={year} note={message} writing={children} signature={signature} className={className} />;
  }
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ ...paperStyle(paper), containerType: 'inline-size' }}>
      <div className="absolute flex flex-col" style={{ left: '8cqw', right: '8cqw', top: '8cqw', bottom: '15cqw' }}>
        {children ?? (
          <p className="h-full overflow-hidden whitespace-pre-wrap break-words" style={{ ...BACK_TEXT, ...RULED }}>{message}</p>
        )}
      </div>
      <p
        className="absolute truncate"
        style={{ left: '8cqw', right: '8cqw', bottom: '7.5cqw', fontFamily: SERIF, fontSize: '3cqw', letterSpacing: '0.2em', color: '#4a3f33' }}
      >
        FROM {fromName.toUpperCase()}
      </p>
      <p
        className="absolute text-center"
        style={{ left: 0, right: 0, bottom: '3cqw', fontFamily: SERIF, fontSize: '1.9cqw', letterSpacing: '0.3em', color: '#8a7a62' }}
      >
        PANTOPUS POST · CHRISTMAS {year}
      </p>
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 3cqw rgba(110, 80, 30, 0.13)' }} />
    </div>
  );
}

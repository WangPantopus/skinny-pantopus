'use client';

// ============================================================
// The back of a Christmas card: the same card stock, faint lines, the note in
// fountain-pen blue, and who it's from printed at the bottom. It fills the box
// it's given (the flip lays it over the picture side, the same size).
// ============================================================

import { useContext, type CSSProperties, type ReactNode } from 'react';
import { launchFeatures } from '@/lib/featureFlags';
import { INK, paperStyle, SERIF } from './cardArt';
import { cardPen } from './cardFont';
import { PaperBack, type NoteFit, type NoteLeaves } from './CardPaper';
import { CardStripContext, stripFooter } from './cardKind';
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

/** Faint ruled lines under the writing, one per line of text (`line` in cqw). */
const ruledAt = (line: number): CSSProperties => ({
  backgroundImage: launchFeatures.cardTable
    ? `repeating-linear-gradient(180deg, transparent 0 calc(${line}cqw - 1px), rgba(74, 84, 118, 0.2) calc(${line}cqw - 1px) ${line}cqw)`
    : `repeating-linear-gradient(180deg, transparent 0 calc(${line}cqw - 1px), rgba(120, 100, 70, 0.22) calc(${line}cqw - 1px) ${line}cqw)`,
  backgroundAttachment: 'local',
});
export const RULED: CSSProperties = ruledAt(7.6);

/**
 * The writing box's pen (mail-cards-experience Part 1): on the card table it follows the same fit as the finished card,
 * so the pen starts large and steps down as the note needs more lines (and back up as words are deleted), on rules at
 * that line height. Without the card table, the old card's fixed type.
 */
export function writingStyle(fit: NoteFit): CSSProperties {
  if (!launchFeatures.cardTable) return { ...BACK_TEXT, ...RULED };
  return {
    ...BACK_TEXT,
    fontSize: `${fit.size}cqw`,
    lineHeight: `${fit.line}cqw`,
    ...(fit.rules ? ruledAt(fit.line) : {}),
    // The pen's tall letters overhang the last line by a few pixels; a scrollbar for that would narrow the lines.
    scrollbarWidth: 'none',
  };
}

export default function CardBack({
  number,
  paper,
  fromName,
  year,
  message,
  signature,
  leaves = null,
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
  /** A long note on two leaves (mail-cards-experience Part 9, card table only): this back is the second leaf. */
  leaves?: NoteLeaves | null;
  children?: ReactNode;
  className?: string;
}) {
  // A thank-you card (Wave 5): its strip on the back's last line.
  const backStrip = useContext(CardStripContext);
  if (launchFeatures.cardTable) {
    return <PaperBack number={number} paper={paper} fromName={fromName} year={year} note={message} writing={children} signature={signature} leaves={leaves} className={className} />;
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
        PANTOPUS POST · {backStrip ? stripFooter(backStrip) : `CHRISTMAS ${year}`}
      </p>
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 3cqw rgba(110, 80, 30, 0.13)' }} />
    </div>
  );
}

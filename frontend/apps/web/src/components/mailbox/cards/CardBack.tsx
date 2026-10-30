'use client';

// ============================================================
// The back of a Christmas card: the same card stock, faint lines, the note in
// fountain-pen blue, and who it's from printed at the bottom. It fills the box
// it's given (the flip lays it over the picture side, the same size).
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import { INK, paperStyle, SERIF } from './cardArt';

export const BACK_TEXT: CSSProperties = {
  fontFamily: SERIF,
  fontStyle: 'italic',
  fontSize: '4.7cqw',
  lineHeight: '7.6cqw',
  color: INK,
};

/** Faint ruled lines under the writing, one per line of text. */
export const RULED: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 calc(7.6cqw - 1px), rgba(120, 100, 70, 0.22) calc(7.6cqw - 1px) 7.6cqw)',
  backgroundAttachment: 'local',
};

export default function CardBack({
  paper,
  fromName,
  year,
  message,
  children,
  className = '',
}: {
  paper: string;
  fromName: string;
  year: number;
  /** The note; or pass `children` (the writing box while it's being written). */
  message?: string;
  children?: ReactNode;
  className?: string;
}) {
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

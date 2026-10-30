'use client';

// ============================================================
// The picture side of a Christmas card: the founder's photo (with its own
// cream border) and, under it, the strip the app prints as the original card
// had it: the picture's caption by hand, CHRISTMAS, 2026, and a red postmark
// with the day it was mailed. Sizes scale with the card's width.
// ============================================================

import { cardPicture, paperStyle, postmarkDay, POSTMARK_RED, SERIF } from './cardArt';
import { cardHand } from './cardFont';

export type CardFrontProps = {
  design: string;
  caption: string | null;
  paper: string;
  year: number;
  /** The day it was mailed (the postmark); none while it's being written. */
  mailedOn?: string | null;
  size?: 'full' | 'thumb';
  className?: string;
};

function Postmark({ day, year }: { day: string; year: number }) {
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden="true">
      <g opacity="0.82" fill="none" stroke={POSTMARK_RED} strokeWidth="1.6">
        <circle cx="36" cy="30" r="22" />
        <circle cx="36" cy="30" r="18.5" strokeWidth="0.8" />
        <path d="M58 21 q6 -4 12 0 t12 0 t12 0" />
        <path d="M58 30 q6 -4 12 0 t12 0 t12 0" />
        <path d="M58 39 q6 -4 12 0 t12 0 t12 0" />
      </g>
      <g fill={POSTMARK_RED} opacity="0.86" fontFamily={SERIF} textAnchor="middle">
        <text x="36" y={day ? 28 : 33} fontSize={day ? 7.6 : 10} fontWeight="700">{day || 'DEC'}</text>
        <text x="36" y={day ? 40 : 45} fontSize="8.5" fontWeight="700">{year}</text>
      </g>
    </svg>
  );
}

export default function CardFront({ design, caption, paper, year, mailedOn, size = 'full', className = '' }: CardFrontProps) {
  const text = caption || '';
  // About the size the original cards printed it; a long caption gets smaller so it stays on one line beside the
  // postmark (the hand runs up to 0.53 em a letter).
  const captionSize = Math.min(4.8, 70 / Math.max(1, text.length * 0.53));
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ ...paperStyle(paper), containerType: 'inline-size' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardPicture(design, size)} alt="" className="block w-full select-none" draggable={false} />
      <div className="relative" style={{ height: '15cqw' }}>
        <p
          className={`${cardHand.className} absolute whitespace-nowrap text-center leading-none`}
          style={{ left: '4cqw', right: '22cqw', top: '3.4cqw', fontSize: `${captionSize}cqw`, color: '#1d2b63' }}
        >
          {text}
        </p>
        <p
          className="absolute text-center"
          style={{ left: '4cqw', right: '22cqw', top: '10.2cqw', fontFamily: SERIF, fontSize: '2.2cqw', letterSpacing: '0.42em', color: '#2b2622' }}
        >
          CHRISTMAS, {year}
        </p>
        <div className="absolute" style={{ right: '2cqw', top: '1.8cqw', width: '20cqw', height: '12cqw' }}>
          <Postmark day={postmarkDay(mailedOn)} year={year} />
        </div>
      </div>
      {/* Aged edges, over the picture's border and the printed strip alike */}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 3cqw rgba(110, 80, 30, 0.13)' }} />
    </div>
  );
}

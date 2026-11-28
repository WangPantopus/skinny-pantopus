'use client';

// ============================================================
// A photo as the card's front (Wave 4.2, card improvements, only while `improved`): the sender's own photo in one of
// three frames drawn in code, as the paper front is (no picture files):
//  - Heirloom Cream: the cotton paper, the photo with a crisp border inset 1.67%, the caption by hand in ink, the spaced
//    serif year and the red postmark;
//  - Midnight Velvet: dark stock, a thin gold hairline frame, a cream serif caption and year, a gold-ink postmark;
//  - Winter Arch: an alabaster mat, the photo under a gently rounded top arch, a quiet serif caption below.
// The face keeps the paper front's size (5:6, 1cqw = 1% of its width), so every table, preview and print lays it out
// as any card. PaperFront draws it in place of the stock picture where a PhotoFrontContext names its design.
// ============================================================

import { createContext, type CSSProperties, type ReactNode } from 'react';
import type { CardFrame } from '@pantopus/api';
import { PAPER_SERIF, postmarkDay } from './cardArt';
import { cardHand } from './cardFont';
import paper from './CardPaper.module.css';
import styles from './PhotoCardFront.module.css';

/** What a PaperFront of the photo card's design draws instead of its stock picture. */
export type PhotoFront = {
  /** The photo card's design id (`photo_card.design`, christmas-2026-photo). */
  design: string;
  frame: CardFrame;
  caption: string | null;
  /** The photo's width / height (its crop's shape); null until it is known. */
  aspect: number | null;
  /** The photo's address, or null while it loads or stays covered. */
  src: string | null;
  /** Covered until the reader taps it ("Tap to view {name}’s photo"). */
  covered?: { name: string; onUncover: () => void } | null;
  /** The studio's crop in place of the photo: it fills the photo's box. */
  crop?: ReactNode;
  alt?: string | null;
};

export const PhotoFrontContext = createContext<PhotoFront | null>(null);

/** The paper front's postmark (CardPaper's CardPostmarkSvg), in this frame's ink. */
function Postmark({ day, year, ink }: { day: string; year: number; ink: string }) {
  return (
    <svg viewBox="0 0 100 60" fill="none" stroke={ink} strokeOpacity=".86" aria-hidden="true">
      <circle cx="36" cy="30" r="22" strokeWidth="1.6" />
      <circle cx="36" cy="30" r="18.5" strokeWidth=".8" />
      <path strokeWidth="1.6" d="M58 21q6-8 12 0t12 0t12 0M58 30q6-8 12 0t12 0t12 0M58 39q6-8 12 0t12 0t12 0" />
      <text x="36" y="28" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="7.6" fill={ink} stroke="none">{day}</text>
      <text x="36" y="40" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="8.5" fill={ink} stroke="none">{year}</text>
    </svg>
  );
}

export const FRAME_NAMES: Record<CardFrame, string> = { heirloom: 'Heirloom Cream', midnight: 'Midnight Velvet', arch: 'Winter Arch' };

/** The box the photo may fill, in cqw (the face is 100 wide, 120 high), per frame. */
const AREA: Record<CardFrame, { left: number; top: number; width: number; height: number }> = {
  heirloom: { left: 1.67, top: 1.67, width: 96.66, height: 103 },
  midnight: { left: 5, top: 5, width: 90, height: 96.5 },
  arch: { left: 9, top: 7, width: 82, height: 92 },
};

/** The photo's box inside its frame's area: as large as fits, centred, at the photo's own shape. */
export function photoBox(frame: CardFrame, aspect: number | null) {
  const area = AREA[frame];
  const ratio = aspect && aspect > 0 ? aspect : 4 / 5;
  if (ratio >= area.width / area.height) {
    const height = area.width / ratio;
    return { left: area.left, top: area.top + (area.height - height) / 2, width: area.width, height };
  }
  const width = area.height * ratio;
  return { left: area.left + (area.width - width) / 2, top: area.top, width, height: area.height };
}

export default function PhotoCardFront({
  front,
  year,
  mailedOn,
  className = '',
  style,
  children,
}: {
  front: PhotoFront;
  year: number;
  mailedOn?: string | null;
  className?: string;
  style?: CSSProperties;
  /** What moves over the face on the table (sheen, shade). */
  children?: ReactNode;
}) {
  const { frame, caption } = front;
  const box = photoBox(frame, front.aspect);
  const text = (caption || '').trim();
  const hand = frame === 'heirloom';
  const captionSize = hand ? Math.min(4.8, 70 / Math.max(1, text.length * 0.53)) : Math.min(4.2, 82 / Math.max(1, text.length * 0.55));
  const day = postmarkDay(mailedOn || new Date().toISOString());
  const boxStyle: CSSProperties = { left: `${box.left}cqw`, top: `${box.top}cqw`, width: `${box.width}cqw`, height: `${box.height}cqw` };
  return (
    <div className={`${paper.face} ${className}`} style={{ '--card-serif': PAPER_SERIF, ...style } as CSSProperties} data-frame={frame}>
      <div className={`${paper.inner} ${styles[frame]}`}>
        {frame === 'midnight' ? (
          <div className={styles.hairline} style={{ left: `${box.left - 1.6}cqw`, top: `${box.top - 1.6}cqw`, width: `${box.width + 3.2}cqw`, height: `${box.height + 3.2}cqw` }} />
        ) : null}
        <div className={`${styles.box} ${styles[`box_${frame}`]}`} style={boxStyle} data-testid="photoCardBox">
          {front.crop ?? (front.covered ? (
            <button type="button" className={styles.veil} data-ui onClick={front.covered.onUncover} data-testid="photoCardUncover">
              <span>Tap to view {front.covered.name}’s photo</span>
            </button>
          ) : front.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={front.src} alt={front.alt || ''} className={styles.photo} draggable={false} />
          ) : <div className={styles.waiting} aria-hidden="true" />)}
        </div>
        {text ? (
          <div className={`${styles.caption} ${styles[`caption_${frame}`]} ${hand ? cardHand.className : ''}`} style={{ fontSize: `${captionSize}cqw` }} data-testid="photoCardCaption">{text}</div>
        ) : null}
        <div className={`${styles.year} ${styles[`year_${frame}`]}`}>CHRISTMAS, {year}</div>
        {frame === 'arch' ? null : (
          <div className={paper.pm}><Postmark day={day} year={year} ink={frame === 'midnight' ? '#d8b76f' : '#b2413a'} /></div>
        )}
        <div className={`${paper.grain} ${frame === 'midnight' ? styles.grainDark : paper.grainFront}`} />
        <div className={paper.edges} />
        {children}
      </div>
    </div>
  );
}

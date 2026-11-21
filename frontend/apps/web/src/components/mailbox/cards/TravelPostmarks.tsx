'use client';

// ============================================================
// The postmarks on a travelling card's envelope (server key card_travel; travelling card Part 3): one for each town on
// the way to this person, the first cancelling the stamp as today's postmark does. Drawn as the sample draws them
// (docs/product/travelling-card-2026-11-21/sample/page.html, SLOTS and postmark()): a ring 27% of the envelope's width,
// two circles, the town and state round the top, "PANTOPUS POST" round the bottom, the day and the year in the middle;
// the first keeps today's five wavy lines to its right. Today's ink; every third, starting with the second, blue-black.
// More than nine: the newest nine, and "+ 4 more towns" in the gold of "CHRISTMAS CARD". Sizes are shares of --ew,
// the envelope's width, which the table sets.
// ============================================================

import { useId, useMemo, type CSSProperties } from 'react';
import type { CardTravelPostmark } from '@pantopus/api';
import styles from './CardTravel.module.css';

// Where each ring's centre goes, in % of the envelope, and its turn (the plan's Part 3).
const SLOTS: [number, number, number][] = [[66, 15, -8], [23, 30, 11], [80, 37, -14], [27, 70, 6], [79, 69, -5], [61, 88, 13],
  [13, 52, -18], [89, 58, 9], [46, 28, -3]];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TOP_SIZE = 11.6;
const TOP_SPACING = 1.3;
// The top arc (radius 41.5) is 130 units long; the words keep a little off each end.
const TOP_ROOM = 118;
const FONT = 'Georgia, "Times New Roman", serif';

let measurer: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, size: number): number {
  if (measurer === undefined) {
    try { measurer = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { measurer = null; }
  }
  if (measurer) {
    measurer.font = `700 ${size}px ${FONT}`;
    return measurer.measureText(text).width + TOP_SPACING * Math.max(0, [...text].length - 1);
  }
  // No canvas (server render): Georgia's bold capitals are about 0.72 of their size wide.
  return [...text].length * (size * 0.72 + TOP_SPACING);
}

/** The words round the top and their size: smaller to fit, down to two thirds; then without the state. */
export function postmarkTop(mark: Pick<CardTravelPostmark, 'town' | 'state'>): { text: string; size: number } {
  const town = mark.town.toUpperCase();
  const withState = mark.state ? `${town} · ${mark.state.toUpperCase()}` : town;
  const fit = (text: string) => Math.min(TOP_SIZE, (TOP_SIZE * TOP_ROOM) / textWidth(text, TOP_SIZE));
  const full = fit(withState);
  if (full >= (TOP_SIZE * 2) / 3 || withState === town) return { text: withState, size: Math.max(full, (TOP_SIZE * 2) / 3) };
  return { text: town, size: Math.max(fit(town), (TOP_SIZE * 2) / 3) };
}

function dayOf(on: string): { day: string; year: string } {
  const [y, m, d] = String(on || '').split('-').map(Number);
  if (!y || !m || !d) return { day: '', year: '' };
  return { day: `${MONTHS[m - 1]} ${d}`, year: String(y) };
}

function Postmark({ mark, slot, newest, id, className }: {
  mark: CardTravelPostmark; slot: number; newest: boolean; id: string; className?: string;
}) {
  const [x, y, r] = SLOTS[slot];
  const waves = slot === 0;
  const w = waves ? 232 : 120;
  const top = postmarkTop(mark);
  const { day, year } = dayOf(mark.on);
  const style = {
    left: `calc(${x}% - var(--ew) * 0.135)`, top: `calc(${y}% - var(--ew) * 0.135)`,
    width: `calc(var(--ew) * ${(0.27 * w) / 120})`, height: 'calc(var(--ew) * 0.27)', '--r': `${r}deg`,
  } as CSSProperties;
  return (
    <svg
      className={`${styles.pm} ${slot % 3 === 1 ? styles.pmBlue : ''} ${newest ? styles.pmNewest : ''} ${className ?? ''}`}
      viewBox={`0 0 ${w} 120`}
      style={style}
      aria-hidden="true"
      data-testid="travelPostmark"
    >
      <g filter={`url(#${id}-ink)`}>
        <circle cx="60" cy="60" r="55.5" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <text fontSize={top.size.toFixed(2)} letterSpacing={TOP_SPACING}>
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{top.text}</textPath>
        </text>
        <text fontSize="8.2" letterSpacing="1.6">
          <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">PANTOPUS POST</textPath>
        </text>
        <text x="60" y="59" textAnchor="middle" fontSize="15.5">{day}</text>
        <text x="60" y="74" textAnchor="middle" fontSize="11.5">{year}</text>
        {waves ? [36, 48, 60, 72, 84].map((yy) => (
          <path key={yy} d={`M124,${yy} q13,-9 26,0 t26,0 t26,0 t26,0`} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        )) : null}
      </g>
    </svg>
  );
}

/**
 * The postmarks, oldest first as the server gives them. `arrive`: the envelope has just arrived, so the newest is struck
 * last, with today's postmark's thump. While a card is being sealed, the newest waits for the table's own thump.
 */
export default function TravelPostmarks({ marks, arrive = false }: { marks: CardTravelPostmark[]; arrive?: boolean }) {
  const id = `pm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const shown = useMemo(() => marks.slice(-SLOTS.length), [marks]);
  const more = marks.length - shown.length;
  if (!shown.length) return null;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <path id={`${id}-top`} d="M 18.5,60 A 41.5,41.5 0 0 1 101.5,60" />
          <path id={`${id}-bot`} d="M 10,60 A 50,50 0 0 0 110,60" />
          <filter id={`${id}-ink`} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="3" seed="11" result="s" />
            <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.75" result="m" />
            <feComposite in="d" in2="m" operator="in" />
          </filter>
        </defs>
      </svg>
      {shown.map((mark, i) => (
        <Postmark
          key={`${i}-${mark.town}-${mark.on}`}
          mark={mark}
          slot={i}
          newest={i === shown.length - 1}
          id={id}
          className={arrive && i === shown.length - 1 ? styles.pmArrive : undefined}
        />
      ))}
      {more > 0 ? <div className={styles.pmMore} data-testid="travelPostmarksMore">+ {more} more {more === 1 ? 'town' : 'towns'}</div> : null}
    </>
  );
}

/** "It came 2,692 miles through 4 towns to reach you." for a card past its first stop, else null. */
export function travelCameLine(travel: { miles: number; towns: number } | null | undefined): string | null {
  if (!travel || travel.towns < 2) return null;
  return `It came ${travel.miles.toLocaleString('en-US')} miles through ${travel.towns} towns to reach you.`;
}

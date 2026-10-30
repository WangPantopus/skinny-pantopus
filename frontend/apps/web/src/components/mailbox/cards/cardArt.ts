// ============================================================
// Christmas cards (launch key holiday_cards): the shared look. The pictures
// ship with the web app (public/holiday-cards/<design>.jpg, and a -thumb for
// grids); the card prints its caption, "CHRISTMAS, 2026" and a postmark under
// the picture, on paper the colour of the picture's own border.
// ============================================================

import type { CSSProperties } from 'react';

export const SERIF = "'Iowan Old Style', 'Hoefler Text', Charter, Georgia, serif";
/** The writing on the back: fountain-pen blue. */
export const INK = '#2c4a8a';
/** The flow's buttons and seals: wax red. */
export const WAX = '#8b1d1d';
export const POSTMARK_RED = '#b2413a';

export function cardPicture(design: string, size: 'full' | 'thumb' = 'full'): string {
  return `/holiday-cards/${design}${size === 'thumb' ? '-thumb' : ''}.jpg`;
}

/** Paper grain over a flat colour, so the printed strip reads as card stock. */
export function paperStyle(paper: string): CSSProperties {
  return {
    backgroundColor: paper,
    backgroundImage: 'radial-gradient(rgba(120, 95, 60, 0.07) 1px, transparent 1.3px)',
    backgroundSize: '6px 6px',
  };
}

/** "DEC 18" for the postmark, from a calendar day (YYYY-MM-DD) or a time. */
export function postmarkDay(when: string | null | undefined): string {
  if (!when) return '';
  const date = new Date(when.length === 10 ? `${when}T12:00:00` : when);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

/** Days from now until `iso`, counted by calendar day in this browser. */
export function daysUntil(iso: string, now = new Date()): number {
  const at = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** "in 6 days", "tomorrow", "today". */
export function inDays(iso: string, now = new Date()): string {
  const days = daysUntil(iso, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** "Sat, Dec 19", from a time or a calendar day ("2026-12-19", read at noon here so no zone moves it a day). */
export function shortDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "7 a.m." */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: date.getMinutes() ? '2-digit' : undefined })
    .replace(' AM', ' a.m.').replace(' PM', ' p.m.');
}

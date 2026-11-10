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

/** A picture trimmed to the one shape every card has (launch key card_table). */
export function cardTrimmedPicture(design: string): string {
  return `/holiday-cards/card/${design}.jpg`;
}

/** The card on the table's art (launch key card_table). */
export const TABLE_ART = '/holiday-cards/table/';
/** The serif the card on the table prints in. */
export const PAPER_SERIF = 'ui-serif, "New York", Georgia, "Times New Roman", serif';

/** The small stamp a card carries, by its picture's number: the same in every app. */
export function cardStampFile(number: number | null | undefined, design: string): string {
  const picture = number ?? Number(design.split('-').pop());
  const stamps = ['fir', 'peak', 'river'];
  return `${TABLE_ART}stamp-${stamps[((Number.isInteger(picture) && picture > 0 ? picture : 1) - 1) % 3]}.webp`;
}

/** The one shared grey cloth is multiplied by this colour to make a picture's table. */
export function tableTint(hex: string | null | undefined): string {
  const value = /^#[0-9a-f]{6}$/i.test(hex ?? '') ? (hex as string) : '#3b4c6e';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const channel = (c: number) => Math.round(Math.min(1, Math.max(0, (lum + (c - lum) * 1.12) * (0.135 / lum) * 1.7)) * 255);
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}

/** The table's colour at the darkened edge of the screen, for the browser's own bars. */
export function tableEdge(hex: string | null | undefined): string {
  const [r, g, b] = (tableTint(hex).match(/\d+/g) ?? ['45', '60', '89']).map((c) => Math.round(Number(c) * 0.5));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * A Bible verse reference ("John 3:16 (KJV)"), the caption of the Christmas with Jesus Christ pictures. It prints in the
 * card's serif, italic, not in the pen, so the colon reads (design plan 1.12). Stored captions don't change.
 */
export function isVerseReference(caption: string | null | undefined): boolean {
  return /\d+:\d+(?:[-\u2013]\d+)?(?:\s*\([A-Z]+\))?$/u.test((caption || '').trim());
}

/** The first name of a shown name ("Juniper H." is Juniper). */
export function firstNameOf(name: string | null | undefined): string {
  return (name || '').trim().split(/\s+/)[0] || 'Someone';
}

/** A small repeatable random: the same seed draws the same numbers in every app. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
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

/** "in 6 days", "tomorrow", "today", for a count of days. */
export function daysAway(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** "in 6 days", "tomorrow", "today". */
export function inDays(iso: string, now = new Date()): string {
  return daysAway(daysUntil(iso, now));
}

/** "Friday, December 25", from a calendar day ("2026-12-25", read at noon here so no zone moves it a day) or a time. */
export function longDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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

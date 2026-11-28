'use client';

// ============================================================
// The Christmas card on real paper (launch key card_table): the picture side
// and the back, drawn the same at any size. The note is in the pen, with each
// word a little off the line (seeded from the card, so it looks the same every
// time). The pen is as large as the note allows (mail-cards-experience Part 1):
// three sizes on the rules, then today's shrinking for a longer note. On a
// table a long note runs onto a second leaf in the largest pen instead (Part 9).
// ============================================================

import { useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cardTrimmedPicture, firstNameOf, isVerseReference, PAPER_SERIF, postmarkDay, seededRandom } from './cardArt';
import { cardHand, cardPen } from './cardFont';
import { SignatureInk, drawableSignature } from './cardSignature';
import type { CardSignature } from '@pantopus/api';
import styles from './CardPaper.module.css';
import PhotoCardFront, { PhotoFrontContext } from './PhotoCardFront';

const SERIF_VAR = { '--card-serif': PAPER_SERIF } as CSSProperties;
const PEN_STACK = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;

/** The note's size, as shares of the card's width. `rules` says whether its lines still sit on the printed rules. */
export type NoteFit = { size: number; line: number; rules: boolean };
const NOTE_FIT: NoteFit = { size: 6, line: 7.6, rules: true };
const NOTE_WIDTH = 85;
export const NOTE_HEIGHT = 83.6;
/**
 * The pen's three sizes, largest first (mail-cards-experience Part 1): 9, 10 or 11 ruled lines, each set filling the same
 * 83.6u from 9u down, so FROM and the foot never move. The largest at which the note fits its lines is used.
 */
const PEN_SIZES: NoteFit[] = [
  { size: 7.8, line: NOTE_HEIGHT / 9, rules: true },
  { size: 7.0, line: NOTE_HEIGHT / 10, rules: true },
  NOTE_FIT,
];

/** One word of the note in the pen (or the space between two), with the small shift, turn and ink it gets. */
export type PenWord = { word: string; shift: number; turn: number; ink: number };
/** The note's paragraphs, each a run of words and spaces. */
export type PenLines = PenWord[][];

/** The note's lines and words, with the small shift and turn each word gets. Shared with the share pictures. */
export function penWords(note: string, number: number | null | undefined): PenLines {
  const random = seededRandom((number ?? 1) * 7 + 3);
  return note.split('\n').map((line) => line.split(/( )/).map((word) => {
    if (word === ' ' || word === '') return { word, shift: 0, turn: 0, ink: 1 };
    const shift = (random() - 0.5) * 0.34;
    const turn = (random() - 0.5) * 1.5;
    return { word, shift, turn, ink: 0.93 + random() * 0.07 };
  }));
}

/**
 * The note laid out off screen as the card lays it out: a row per paragraph, a box per word (the same parts as
 * penWords, so a word's place here is its place there). The caller removes the box.
 */
function noteBox(note: string) {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-9999px;top:0;visibility:hidden;width:${NOTE_WIDTH * 8}px;font-family:${PEN_STACK}`;
  const rows = note.split('\n').map((line) => {
    const row = document.createElement('p');
    row.style.cssText = 'margin:0;min-height:1lh';
    const words = line.split(/( )/).map((word) => {
      if (word === ' ') { row.append(' '); return null; }
      const span = document.createElement('span');
      span.style.cssText = 'display:inline-block;max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere';
      span.textContent = word;
      row.append(span);
      return span;
    });
    box.append(row);
    return { row, words };
  });
  document.body.append(box);
  const pen = (size: number, line: number) => {
    box.style.fontSize = `${size * 8}px`;
    box.style.lineHeight = `${line * 8}px`;
  };
  return { box, rows, pen };
}

/**
 * Largest size at which `note` fits: the pen's three sizes on their rules, then (as before November 17) smaller pens on the
 * 11 rules, then tighter lines for a note of many short lines. Every place the back is drawn on one side asks this one
 * function; a table deals a long note onto two leaves first (measureLeaves).
 */
export function measureNote(note: string): NoteFit {
  const { box, pen } = noteBox(note);
  // `byLines`: the words take no more lines than the rules hold (the rows' own height). Each word is an inline box as
  // tall as a line that hangs a little below its row, so the box's scroll height counts that overhang once more; the
  // smaller pens past 11 lines keep measuring that way, as they always have.
  const fits = (size: number, line: number, byLines = false) => {
    pen(size, line);
    return (byLines ? box.offsetHeight : box.scrollHeight) <= (NOTE_HEIGHT * 8) + 2;
  };
  let answer: NoteFit | null = PEN_SIZES.find((size) => fits(size.size, size.line, true)) ?? null;
  if (!answer) {
    for (const size of [5.6, 5.2, 4.8, 4.4]) {
      if (fits(size, 7.6)) { answer = { size, line: 7.6, rules: true }; break; }
    }
  }
  if (!answer) {
    // More lines than the rules hold: tighter lines, off the rules.
    for (let line = 7; line >= 2.4; line -= 0.2) {
      const size = Math.max(2.2, line * 0.72);
      if (fits(size, line)) { answer = { size, line, rules: false }; break; }
    }
  }
  box.remove();
  return answer ?? { size: 2.2, line: 2.4, rules: false };
}

/** How the note fits. Starts at the full size and settles once the pen has loaded. */
export function useNoteFit(note: string): NoteFit {
  const [fit, setFit] = useState<NoteFit>(NOTE_FIT);
  useEffect(() => {
    let live = true;
    const measure = () => { if (live) setFit(measureNote(note)); };
    measure();
    void document.fonts?.load(`48px ${PEN_STACK}`).then(measure).catch(() => {});
    return () => { live = false; };
  }, [note]);
  return fit;
}

/** A long note over two leaves (mail-cards-experience Part 9): the pen both leaves use, and the words on each. */
export type NoteLeaves = { fit: NoteFit; first: PenLines; rest: PenLines };
/** Where the pen breaks a long note: the line each part of each paragraph is on, the first leaf's lines, the second's start. */
type LeafCut = { note: string; fit: NoteFit; lineOf: number[][]; first: number; start: number };

/**
 * Part 9's rule. A note that fits 9 lines in the largest pen or 10 in the middle one stays on one side (null). A longer
 * one goes on two leaves at the first pen that holds it, 9, 10 or 11 lines a leaf: the first leaf takes that many lines as
 * the pen wraps them and the second the rest, without a blank line at its top and never fewer than two lines, except one
 * line the writer began after a blank line, which stands alone with the blank line left out. A word is never
 * split between the leaves or cut: a word wider than a line (a web address) covers several lines, and the first leaf ends
 * before a word that would cross the break. A note that no pen holds on two leaves (very many short lines, or one word
 * taller than a leaf) stays on one side with Part 1's shrinking (null).
 */
export function measureLeaves(note: string): LeafCut | null {
  if (!note.trim()) return null;
  const { box, rows, pen } = noteBox(note);
  try {
    const fitsOneSide = PEN_SIZES.slice(0, 2).some((size) => {
      pen(size.size, size.line);
      return box.offsetHeight <= (NOTE_HEIGHT * 8) + 2;
    });
    if (fitsOneSide) return null;
    for (const size of PEN_SIZES) {
      pen(size.size, size.line);
      const height = size.line * 8;
      const perLeaf = Math.round(NOTE_HEIGHT / size.line);
      const total = Math.round(box.offsetHeight / height);
      // A word's line is where its box starts; a space, or an empty part between two spaces, stays on its word's line.
      // A word wider than a line wraps inside its box and covers every line down to the box's foot.
      const blank = new Set<number>();
      const spans: Array<[number, number]> = [];
      const lineOf = rows.map(({ row, words }) => {
        let line = Math.round(row.offsetTop / height);
        if (words.length === 1 && !words[0]?.textContent) blank.add(line);
        return words.map((word) => {
          if (word?.textContent) {
            line = Math.round(word.offsetTop / height);
            const last = Math.round((word.offsetTop + word.offsetHeight) / height) - 1;
            if (last > line) spans.push([line, last]);
          }
          return line;
        });
      });
      const crosses = (first: number) => spans.some(([top, last]) => top < first && last >= first);
      for (let first = Math.min(perLeaf, total - 2); first >= 1; first -= 1) {
        if (crosses(first)) continue;
        const start = blank.has(first) ? first + 1 : first;
        const rest = total - start;
        if (rest > perLeaf) break;
        // One line left may stand alone when the writer began it after a blank line (a closing such as "Merry Christmas!").
        const closing = rest === 1 && start > first && !blank.has(start);
        if (rest >= 2 || closing) return { note, fit: size, lineOf, first, start };
      }
    }
    return null;
  } finally {
    box.remove();
  }
}

/**
 * The lines dealt to the two leaves. The shift, turn and ink are drawn for the whole note in order first, so each word
 * looks as it would on one side; a paragraph the break falls in goes on both leaves, each with its own words.
 */
export function dealLeaves(lines: PenLines, cut: Pick<LeafCut, 'lineOf' | 'first' | 'start'>): { first: PenLines; rest: PenLines } {
  const first: PenLines = [];
  const rest: PenLines = [];
  lines.forEach((words, p) => {
    const lineOf = cut.lineOf[p] ?? [];
    const before = words.filter((_, k) => (lineOf[k] ?? 0) < cut.first);
    const after = words.filter((_, k) => (lineOf[k] ?? 0) >= cut.start);
    while (after.length && after[0].word === ' ') after.shift();
    if (before.length) first.push(before);
    if (after.length) rest.push(after);
  });
  return { first, rest };
}

/**
 * The note on two leaves, or null for one side. `on` is false where the card can't be turned (a still keeps Part 1's
 * one-side fitting). Measured again once the pen has loaded, as useNoteFit is.
 */
export function useNoteLeaves(note: string, number: number | null | undefined, on: boolean): NoteLeaves | null {
  const [cut, setCut] = useState<LeafCut | null>(null);
  useEffect(() => {
    if (!on) { setCut(null); return undefined; }
    let live = true;
    const measure = () => { if (live) setCut(measureLeaves(note)); };
    measure();
    void document.fonts?.load(`48px ${PEN_STACK}`).then(measure).catch(() => {});
    return () => { live = false; };
  }, [note, on]);
  return useMemo(() => {
    if (!on || !cut || cut.note !== note) return null;
    return { fit: cut.fit, ...dealLeaves(penWords(note, number), cut) };
  }, [cut, note, number, on]);
}

/** The note's words in the pen, a paragraph to a row, each word a little off the line. */
function NoteWords({ lines }: { lines: PenLines }) {
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} dir="auto">
          {line.map((part, k) => (part.word === ' ' || part.word === '' ? part.word : (
            <span key={k} className={styles.word} style={{ transform: `translateY(${part.shift.toFixed(3)}em) rotate(${part.turn.toFixed(2)}deg)`, opacity: Number(part.ink.toFixed(2)) }}>{part.word}</span>
          )))}
        </p>
      ))}
    </>
  );
}

/**
 * The first leaf of a long note (Part 9): the card's paper and ruled lines with the note's first lines, no FROM, no
 * signature and no foot, and "over" with an arrow at its foot. It lies on the card's back (`lying` is its place there,
 * e.g. turned with the back and a hair in front of it) and lifts from its foot, hinged along its top edge, when `lifted`.
 */
export function PaperLeaf({
  leaves,
  paper,
  lifted,
  lying = '',
  soft = false,
  className = '',
  style,
}: {
  leaves: NoteLeaves;
  paper: string;
  lifted: boolean;
  /** The transform that lays it on the back; the lift turns it about its top edge from there. */
  lying?: string;
  /** Away from the table's light: the lighter grain the back has there. */
  soft?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { fit } = leaves;
  return (
    <div
      className={`${styles.face} ${styles.leaf} ${lifted ? styles.leafLifted : ''} ${className}`}
      style={{ ...SERIF_VAR, '--leaf-lying': lying || 'translateZ(0)', ...style } as CSSProperties}
      aria-hidden="true"
      data-testid="cardFirstLeaf"
      data-lifted={lifted ? 'true' : 'false'}
    >
      <div className={styles.inner} style={{ backgroundColor: paper }}>
        <div className={styles.rules} style={{ '--rule': `${fit.line}cqw` } as CSSProperties} />
        <div className={styles.note} style={{ fontFamily: PEN_STACK, fontSize: `${fit.size}cqw`, lineHeight: `${fit.line}cqw` }}>
          <NoteWords lines={leaves.first} />
        </div>
        <div className={styles.over} style={{ fontFamily: PEN_STACK }}>
          <span>over</span>
          <svg viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9.5C10 7.2 22 7 36 8" />
            <path d="M29.5 3.2 36.6 8 29 13" />
          </svg>
        </div>
        <div className={`${styles.grain} ${soft ? styles.grainSoft : ''}`} />
        <div className={styles.edges} />
        <div className={styles.leafShade} />
      </div>
    </div>
  );
}

export function CardPostmarkSvg({ day, year }: { day: string; year: number }) {
  return (
    <svg viewBox="0 0 100 60" fill="none" stroke="#b2413a" strokeOpacity=".86" aria-hidden="true">
      <circle cx="36" cy="30" r="22" strokeWidth="1.6" />
      <circle cx="36" cy="30" r="18.5" strokeWidth=".8" />
      <path strokeWidth="1.6" d="M58 21q6-8 12 0t12 0t12 0M58 30q6-8 12 0t12 0t12 0M58 39q6-8 12 0t12 0t12 0" />
      <text x="36" y="28" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="7.6" fill="#b2413a" stroke="none">{day}</text>
      <text x="36" y="40" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="8.5" fill="#b2413a" stroke="none">{year}</text>
    </svg>
  );
}

export function PaperFront({
  design,
  caption,
  paper,
  year,
  mailedOn,
  className = '',
  style,
  children,
  strip = null,
}: {
  /** What prints under the picture in place of "CHRISTMAS, {year}" (a thank-you card's `strip`, Wave 5). */
  strip?: string | null;
  design: string;
  caption: string | null;
  paper: string;
  year: number;
  /** The day it was mailed; today while it's being written. */
  mailedOn?: string | null;
  className?: string;
  style?: CSSProperties;
  /** What moves over the face on the table (sheen, shade). */
  children?: ReactNode;
}) {
  // A photo card (Wave 4.2): where the page knows its photo and frame, its front is the photo in its frame.
  const photoFront = useContext(PhotoFrontContext);
  const text = caption || '';
  const captionSize = Math.min(4.8, 70 / Math.max(1, text.length * 0.53));
  const day = postmarkDay(mailedOn || new Date().toISOString());
  if (photoFront && photoFront.design === design) {
    return <PhotoCardFront front={photoFront} year={year} mailedOn={mailedOn} className={className} style={style}>{children}</PhotoCardFront>;
  }
  return (
    <div className={`${styles.face} ${className}`} style={{ ...SERIF_VAR, ...style }}>
      <div className={styles.inner} style={{ backgroundColor: paper }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cardTrimmedPicture(design)} alt="" className={styles.photo} draggable={false} />
        <div className={`${styles.caption} ${isVerseReference(text) ? styles.verse : cardHand.className}`} style={{ fontSize: `${captionSize}cqw` }}>{text}</div>
        <div className={styles.year}>{strip ?? `CHRISTMAS, ${year}`}</div>
        <div className={styles.pm}><CardPostmarkSvg day={day} year={year} /></div>
        <div className={`${styles.grain} ${styles.grainFront}`} />
        <div className={styles.edges} />
        {children}
      </div>
    </div>
  );
}

export function PaperBack({
  number,
  paper,
  fromName,
  year,
  note,
  writing,
  signature,
  leaves = null,
  className = '',
  style,
  children,
}: {
  /** The picture's number: the note's small shifts are seeded from it. */
  number?: number | null;
  paper: string;
  fromName: string;
  year: number;
  note?: string;
  /** Signed beside FROM (design plan 8.2): drawn in the pen's ink in place of the typed first name. */
  signature?: CardSignature | null;
  /** The writing box while it's being written, in place of the note. */
  writing?: ReactNode;
  /** A long note on two leaves (Part 9): this back is the second leaf, with the rest of the note in the leaves' pen. */
  leaves?: NoteLeaves | null;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const text = note ?? '';
  const ownFit = useNoteFit(leaves ? '' : text);
  const fit = leaves ? leaves.fit : ownFit;
  const signed = drawableSignature(signature);
  const ownLines = useMemo(() => penWords(text, number), [text, number]);
  const lines = leaves ? leaves.rest : ownLines;
  return (
    <div className={`${styles.face} ${className}`} style={{ ...SERIF_VAR, ...style }}>
      <div className={styles.inner} style={{ backgroundColor: paper }}>
        {writing ? <div className={styles.writing}>{writing}</div> : (
          <>
            {fit.rules ? <div className={styles.rules} style={{ '--rule': `${fit.line}cqw` } as CSSProperties} /> : null}
            {/* On the second leaf a screen reader hears the whole note once, not only the rest. */}
            {leaves ? <div className={styles.srOnly}>{text}</div> : null}
            <div className={styles.note} style={{ fontFamily: PEN_STACK, fontSize: `${fit.size}cqw`, lineHeight: `${fit.line}cqw` }} aria-hidden={leaves ? true : undefined}>
              <NoteWords lines={lines} />
            </div>
          </>
        )}
        <div className={styles.from}>
          <b>FROM</b>
          {signed ? (
            <span className={styles.signed} data-testid="cardSignature">
              <span className={styles.srOnly}>{firstNameOf(fromName)}</span>
              <SignatureInk signature={signed} className={styles.signInk} />
            </span>
          ) : <span style={{ fontFamily: PEN_STACK }}>{firstNameOf(fromName)}</span>}
        </div>
        <div className={styles.foot}>PANTOPUS POST · CHRISTMAS {year}</div>
        {/* Full grain under the table's light; away from it, lighter, so the back reads as the same paper. */}
        <div className={`${styles.grain} ${children ? '' : styles.grainSoft}`} />
        <div className={styles.edges} />
        {children}
      </div>
    </div>
  );
}

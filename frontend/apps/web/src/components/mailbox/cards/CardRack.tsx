'use client';

// ============================================================
// Choosing a card at the card rack (launch key card_table, design plan Part 5):
// a picture opens large on its own cloth, with the table's light. Swipe (or the
// arrows) to the next card in the collection; the cloth changes with each card.
// "Write on this card" chooses it; ✕ goes back to the grid with the last card
// seen ticked. A verse card shows its whole verse under it.
// ============================================================

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { HolidayCardDesign } from '@pantopus/api';
import { PaperFront } from './CardPaper';
import { TABLE_ART, tableEdge, tableTint } from './cardArt';
import { useDarkPage } from './useDarkPage';
import styles from './CardRack.module.css';

const art = (name: string) => `${TABLE_ART}${name}`;

export default function CardRack({
  designs,
  collectionName,
  start,
  year,
  onClose,
  onWrite,
}: {
  /** The collection's pictures, in grid order. */
  designs: HolidayCardDesign[];
  collectionName: string | null;
  /** The picture it opens at. */
  start: string;
  year: number;
  /** Back to the grid: the last card seen is the one ticked. */
  onClose: (lastSeen: string) => void;
  onWrite: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [at, setAt] = useState(() => Math.max(0, designs.findIndex((d) => d.id === start)));
  const [drag, setDrag] = useState(0);
  const dragRef = useRef<{ id: number; x0: number; y0: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const design = designs[at] ?? designs[0];
  const atRef = useRef(at);
  atRef.current = at;

  useEffect(() => { setMounted(true); }, []);
  useDarkPage(mounted, tableEdge(design?.table));

  const go = useCallback((step: -1 | 1) => {
    setAt((now) => Math.min(designs.length - 1, Math.max(0, now + step)));
  }, [designs.length]);

  // Keys: arrows move along the rack, Escape goes back. Focus stays on the rack while it's open.
  useEffect(() => {
    if (!mounted) return undefined;
    const before = document.activeElement as HTMLElement | null;
    stageRef.current?.focus({ preventScroll: true });
    const page = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(designs[atRef.current]?.id ?? start); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      else if (event.key === 'Tab' && stageRef.current) {
        const focusable = [...stageRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = page;
      before?.focus?.({ preventScroll: true });
    };
    // Set up once as the rack opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // A finger (or a mouse) swipes the card along the rack.
  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 8) return;
    d.moved = true;
    // At either end it gives a little and springs back.
    const end = (dx > 0 && at === 0) || (dx < 0 && at === designs.length - 1);
    setDrag(end ? dx * 0.25 : dx);
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== event.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - d.x0;
    setDrag(0);
    if (d.moved && Math.abs(dx) > 56) go(dx < 0 ? 1 : -1);
  };

  if (!mounted || !design) return null;
  const table = design.table ?? null;
  return createPortal(
    <div
      ref={stageRef}
      className={styles.rack}
      role="dialog"
      aria-modal="true"
      aria-label={collectionName ? `${collectionName}: the card rack` : 'The card rack'}
      tabIndex={-1}
      data-testid="cardRack"
    >
      <div className={styles.layers} aria-hidden="true" style={{ backgroundColor: tableEdge(table) }}>
        <div className={styles.table} style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(table) }} />
        <div className={styles.light} style={{ backgroundImage: `url(${art('light.webp')})` }} />
        <div className={styles.vignette} />
        <div className={styles.grain} style={{ backgroundImage: `url(${art('grain.png')})` }} />
      </div>
      <div className={styles.top}>
        <button type="button" className={styles.round} aria-label="Back to the cards" data-testid="cardRackClose" onClick={() => onClose(design.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className={styles.where}>
          {collectionName ? <p className={styles.collection}>{collectionName}</p> : null}
          <div className={styles.nav}>
            <button type="button" className={styles.step} aria-label="The card before" disabled={at === 0} data-testid="cardRackPrev" onClick={() => go(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <span className={styles.count} aria-hidden="true">{at + 1} of {designs.length}</span>
            <button type="button" className={styles.step} aria-label="The next card" disabled={at === designs.length - 1} data-testid="cardRackNext" onClick={() => go(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <span className={styles.spacer} />
      </div>
      <div className={styles.middle}>
        <div
          className={styles.cardArea}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div
            key={design.id}
            className={`${styles.card} ${design.verse ? styles.withVerse : ''} ${drag ? styles.dragging : ''}`}
            style={{ transform: `translateX(${drag}px) rotate(-1.4deg)` }}
            role="img"
            aria-label={`${design.caption}${design.verse ? `. ${design.verse}` : ''}`}
            data-testid="cardRackCard"
          >
            <PaperFront design={design.id} caption={design.caption} paper={design.paper} year={year} />
          </div>
          {design.verse ? <blockquote className={styles.verse} aria-hidden="true" data-testid="cardRackVerse">{design.verse}</blockquote> : null}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">{`${design.caption}, ${at + 1} of ${designs.length}`}</p>
      <div className={styles.bottom}>
        <button type="button" className={styles.primary} data-testid="cardRackWrite" onClick={() => onWrite(design.id)}>Write on this card</button>
        <p className={styles.hint} aria-hidden="true">{designs.length > 1 ? 'Swipe for the next card' : ''}</p>
      </div>
    </div>,
    document.body,
  );
}

'use client';

// The list as a sheet over the map (Pulse, reinvented, PHASE-6 A3 and D). At a phone's width it rests at three heights:
// peek (its header and one line), half (about 45% of the board) and full (up to under the top line). It moves only when
// its header is dragged, flung or tapped: scrolling the list inside it never moves it, at any rest, and it never closes by
// itself. While a finger drags it, it follows the finger with no React render (the list's rows and the map's pins are not
// built again); on release it springs to the rest the finger's speed points at. At 700 px wide or more (PHASE-6 E) it is
// a floating panel at the left of the map instead, 380 px wide, with a tab on its right edge that folds it to a 28 px peek.

import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Rest = 'peek' | 'half' | 'full';

const UP: Record<Rest, Rest> = { peek: 'half', half: 'full', full: 'full' };
const DOWN: Record<Rest, Rest> = { full: 'half', half: 'peek', peek: 'peek' };
/** What a tap on the header does: peek to half, half to full; at full it goes back to half. */
const TAP: Record<Rest, Rest> = { peek: 'half', half: 'full', full: 'half' };

/** The header's height at peek (grabber and one line), and the share of the board the sheet takes at half. */
const PEEK_PX = 64;
const HALF_SHARE = 0.45;
/** Movement before a press on the header counts as a drag rather than a tap. */
const SLOP_PX = 6;
/** How far ahead a fling is projected, in milliseconds of its release speed. */
const FLING_MS = 220;

interface Props {
  rest: Rest;
  onRest(rest: Rest): void;
  /** A floating panel at the left (the board is 700 px wide or more). */
  wide: boolean;
  folded: boolean;
  onFold(folded: boolean): void;
  /** Where full stops: the bottom of the top line, in pixels from the board's top. */
  topInset: number;
  /** The header's one line ("23 here · Tonight"). */
  line: ReactNode;
  /** Small controls at the header's right (they stay buttons: a tap on them is theirs, a drag from them still moves the sheet). */
  tools?: ReactNode;
  /** The "+" that rides the sheet on a phone: 12 px above its top edge, and in its header at full. */
  create?: ReactNode;
  scrollerRef: Ref<HTMLDivElement>;
  onScroll?(top: number): void;
  busy?: boolean;
  children: ReactNode;
}

export default function PulseSheet({ rest, onRest, wide, folded, onFold, topInset, line, tools, create, scrollerRef, onScroll, busy, children }: Props) {
  const sheet = useRef<HTMLElement>(null);
  // The board's height, read by a ResizeObserver; the rests are measured from it.
  const boardH = useRef(0);
  const drag = useRef<{ id: number; y0: number; d0: number; moved: boolean; trail: { y: number; t: number }[] } | null>(null);
  const restRef = useRef(rest);
  restRef.current = rest;

  /** How far below full each rest sits, in pixels (full is 0). */
  const offsets = useCallback((): Record<Rest, number> => {
    const H = boardH.current;
    const tall = Math.max(0, H - topInset);
    return {
      full: 0,
      half: Math.max(0, tall - Math.round(H * HALF_SHARE)),
      peek: Math.max(0, tall - PEEK_PX),
    };
  }, [topInset]);

  const place = useCallback(
    (d: number, animate: boolean) => {
      const el = sheet.current;
      if (!el || wide) return;
      if (animate) delete el.dataset.dragging;
      else el.dataset.dragging = '';
      el.style.transform = `translate3d(0, ${Math.round(d)}px, 0)`;
    },
    [wide],
  );

  // The list keeps room at its end for the part of the sheet below the board's edge, so its last rows can be reached at
  // every rest. Set once a rest is reached, never while dragging.
  const settle = useCallback(() => {
    const el = sheet.current;
    if (!el) return;
    if (wide) {
      el.style.transform = '';
      el.style.removeProperty('--rp-sheet-below');
      return;
    }
    const d = offsets()[restRef.current];
    place(d, true);
    el.style.setProperty('--rp-sheet-below', `${d}px`);
  }, [offsets, place, wide]);

  useLayoutEffect(() => {
    const el = sheet.current?.parentElement;
    if (!el) return undefined;
    boardH.current = el.clientHeight;
    settle();
    const watch = new ResizeObserver(() => {
      if (boardH.current === el.clientHeight) return;
      boardH.current = el.clientHeight;
      if (!drag.current) settle();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [settle]);
  useEffect(() => {
    if (!drag.current) settle();
  }, [rest, settle]);

  // ── The header is the handle ──
  const swallow = useRef(false);
  // The press is the sheet's from the moment it lands on the header: its moves and its release are followed on the window,
  // so a mouse whose first move leaves the header still drags the sheet (LEAD-7's look, 04:50). Followed on the window
  // rather than by pointer capture so a tap on one of the header's buttons stays that button's click.
  const follow = useRef<(() => void) | null>(null);
  useEffect(() => () => follow.current?.(), []);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (wide || (e.pointerType === 'mouse' && e.button !== 0)) return;
    follow.current?.();
    drag.current = { id: e.pointerId, y0: e.clientY, d0: offsets()[restRef.current], moved: false, trail: [{ y: e.clientY, t: e.timeStamp }] };
    const move = (ev: PointerEvent) => onMove(ev);
    const up = (ev: PointerEvent) => {
      stop();
      onUp(ev);
    };
    const cancel = (ev: PointerEvent) => {
      stop();
      onCancel(ev);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      follow.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    follow.current = stop;
  };
  const onMove = (e: PointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y0;
    if (!g.moved) {
      if (Math.abs(dy) < SLOP_PX) return;
      // From here the drag is the sheet's, even if it started on one of the header's buttons.
      g.moved = true;
    }
    // A mouse drag never selects the page's text.
    if (e.pointerType === 'mouse') window.getSelection()?.removeAllRanges();
    const o = offsets();
    // Past full or below peek it gives a little, then stops.
    let d = g.d0 + dy;
    if (d < 0) d = d / 4;
    if (d > o.peek) d = o.peek + (d - o.peek) / 4;
    place(d, false);
    g.trail.push({ y: e.clientY, t: e.timeStamp });
    if (g.trail.length > 6) g.trail.shift();
  };
  const onUp = (e: PointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    drag.current = null;
    if (!g.moved) return; // a tap: handled by the click (on a button, the button's own; elsewhere, the header's)
    // Swallow the click that follows a drag that began on one of the header's buttons.
    swallow.current = true;
    window.setTimeout(() => (swallow.current = false), 300);
    const first = g.trail[0], last = g.trail[g.trail.length - 1];
    const v = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0; // px per ms, down is positive
    const o = offsets();
    const now = Math.min(o.peek, Math.max(0, g.d0 + (e.clientY - g.y0)));
    const aim = now + v * FLING_MS;
    const rests: Rest[] = ['full', 'half', 'peek'];
    let to = rests.reduce((best, r) => (Math.abs(o[r] - aim) < Math.abs(o[best] - aim) ? r : best), rests[0]);
    // A clear fling never stays where it started.
    if (to === restRef.current && Math.abs(v) > 0.5) to = v < 0 ? UP[to] : DOWN[to];
    if (to === restRef.current) settle();
    else onRest(to);
  };
  const onCancel = (e: PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    settle();
  };
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  const onHeaderClick = (e: ReactMouseEvent) => {
    if (wide) return;
    // A tap on one of the header's own controls is that control's.
    if ((e.target as HTMLElement).closest('button, a, input, label, [role="switch"]')) return;
    onRest(TAP[restRef.current]);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onRest(UP[restRef.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onRest(DOWN[restRef.current]);
    }
  };

  return (
    <section
      ref={sheet}
      className="rp-sheet"
      aria-label="Pulse list"
      data-rest={wide ? undefined : rest}
      data-wide={wide ? '' : undefined}
      data-folded={wide && folded ? '' : undefined}
      style={wide ? undefined : { top: topInset }}
    >
      {!wide && create}
      <div
        className="rp-sheet-head"
        onPointerDown={onDown}
        onClickCapture={onClickCapture}
        onClick={onHeaderClick}
      >
        {!wide && (
          <button
            type="button"
            className="rp-grabber"
            aria-label={rest === 'full' ? 'Show more of the map' : 'Show more of the list'}
            aria-keyshortcuts="ArrowUp ArrowDown"
            onClick={(e) => {
              e.stopPropagation();
              onRest(TAP[rest]);
            }}
            onKeyDown={onKey}
          >
            <span aria-hidden />
          </button>
        )}
        <div className="rp-sheet-line">
          <p role="status">{line}</p>
          {tools && <div className="rp-sheet-tools">{tools}</div>}
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="rp-list"
        aria-busy={busy || undefined}
        aria-hidden={(!wide && rest === 'peek') || (wide && folded) || undefined}
        onScroll={onScroll ? (e) => onScroll(e.currentTarget.scrollTop) : undefined}
      >
        {children}
      </div>
      {wide && (
        <button
          type="button"
          className="rp-fold"
          aria-label={folded ? 'Show the list' : 'Fold the list away'}
          aria-expanded={!folded}
          onClick={() => onFold(!folded)}
        >
          {folded ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
        </button>
      )}
    </section>
  );
}

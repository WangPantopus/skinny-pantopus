'use client';

import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * A mouse drags a sideways row (the alive strip, the circles' windows) as a finger does (LEAD-7's look, 08:39: a sideways
 * wheel and a finger scrolled the strip, a mouse drag did nothing). Only a clearly sideways drag of a mouse; a tap stays the
 * card's own, and the click that ends a drag opens nothing. A finger and a pen keep the browser's own scrolling.
 */
export function useMouseDragScroll<T extends HTMLElement>() {
  const row = useRef<T>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent<T>) => {
    const el = row.current;
    if (e.pointerType !== 'mouse' || e.button !== 0 || !el || el.scrollWidth <= el.clientWidth) return;
    const id = e.pointerId,
      x0 = e.clientX,
      y0 = e.clientY,
      left0 = el.scrollLeft;
    let on = false;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - x0;
      if (!on && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(ev.clientY - y0)) on = dragged.current = true;
      if (on) {
        ev.preventDefault();
        el.scrollLeft = left0 - dx;
      }
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  return { ref: row, onPointerDown, onClickCapture };
}

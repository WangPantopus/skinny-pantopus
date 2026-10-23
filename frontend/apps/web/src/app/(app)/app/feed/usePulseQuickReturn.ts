'use client';

// Quick return for the Pulse header (founder request 2026-10-22, spec §3), as in Facebook:
// scrolling the list down, or dragging the map's content up, slides the header away; scrolling
// back up, or a deliberate drag down, brings it back. It never hides while there is nothing to
// scroll, while the keyboard or the area search is inside it, or on a surface that keeps it.

import { useCallback, useEffect, useRef, useState, type FocusEvent, type RefObject } from 'react';

/** List mode: scroll travel in one direction before the header toggles. */
const SCROLL_HYSTERESIS_PX = 12;
/** Map mode: content dragged up this far (mostly vertically) hides the header… */
const PAN_HIDE_PX = 16;
/** …and dragged down this far shows it again: panning around doesn't keep bringing it back. */
const PAN_SHOW_PX = 48;
/** Scrolls this soon after the screen opens or the view changes are the page settling (a
 *  restored scroll position, a list growing), not the reader. */
const SETTLE_MS = 400;

interface Options {
  mode: 'list' | 'map';
  /** False while there is nothing to scroll (loading, empty, error) or on a surface that keeps the header. */
  canHide: boolean;
  /** A change shows the header again: mode, surface, filter, topic, area, the area search opening. */
  resetKey: string;
  /** The list's own scroll area; the window scrolls too. */
  listScrollRef: RefObject<HTMLElement | null>;
}

/** Keyboard focus (or the area search field) inside the header keeps it on screen. */
function isKeyboardOrTextFocus(el: Element): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  try {
    return el.matches(':focus-visible');
  } catch {
    return true; // No :focus-visible support: treat every focus as the keyboard's.
  }
}

export function usePulseQuickReturn({ mode, canHide, resetKey, listScrollRef }: Options) {
  const [hideRequested, setHideRequested] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const hideAllowed = canHide && !focusInside;
  const hidden = hideRequested && hideAllowed;

  const hideAllowedRef = useRef(hideAllowed);
  hideAllowedRef.current = hideAllowed;
  const headerHeightRef = useRef(headerHeight);
  headerHeightRef.current = headerHeight;
  const settleUntil = useRef(0);
  const scrollAcc = useRef(0);
  const panAcc = useRef({ x: 0, y: 0 });

  const show = useCallback(() => setHideRequested(false), []);
  const hideIfAllowed = useCallback(() => {
    if (hideAllowedRef.current) setHideRequested(true);
  }, []);

  // A header that may not hide comes back, and doesn't slide away again once it may.
  useEffect(() => {
    if (!hideAllowed) setHideRequested(false);
  }, [hideAllowed]);

  // Mode, surface, filter, topic or area changes, and opening the area search, show it again.
  useEffect(() => {
    setHideRequested(false);
    scrollAcc.current = 0;
    panAcc.current = { x: 0, y: 0 };
    settleUntil.current = Date.now() + SETTLE_MS;
  }, [resetKey]);

  // The header's own height (offsetHeight ignores the slide), for the map's top items and the list's top.
  const observer = useRef<ResizeObserver | null>(null);
  const headerRef = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setHeaderHeight(el.offsetHeight);
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
      observer.current.observe(el);
    }
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);

  // List mode: the window scrolls the header's flow space, the posts and the cards above them;
  // the posts list scrolls inside its own box. Both count, with one accumulator.
  useEffect(() => {
    if (mode !== 'list') return undefined;
    let lastWindowY = window.scrollY;
    let lastInner: HTMLElement | null = null;
    let lastInnerTop = 0;
    const onScroll = (event: Event) => {
      const target = event.target;
      let delta: number;
      if (target === document || target === document.documentElement || target === document.body) {
        const y = window.scrollY;
        delta = y - lastWindowY;
        lastWindowY = y;
      } else if (target instanceof HTMLElement && target === listScrollRef.current) {
        if (target !== lastInner) {
          lastInner = target;
          lastInnerTop = target.scrollTop;
          return;
        }
        delta = target.scrollTop - lastInnerTop;
        lastInnerTop = target.scrollTop;
      } else {
        return;
      }
      if (delta === 0 || Date.now() < settleUntil.current) return;
      // Near the top the header is still in its place in the page: it always shows there.
      if (window.scrollY < headerHeightRef.current) {
        scrollAcc.current = 0;
        setHideRequested(false);
        return;
      }
      if (scrollAcc.current !== 0 && (delta > 0) !== (scrollAcc.current > 0)) scrollAcc.current = 0;
      scrollAcc.current += delta;
      if (scrollAcc.current >= SCROLL_HYSTERESIS_PX) {
        scrollAcc.current = SCROLL_HYSTERESIS_PX;
        hideIfAllowed();
      } else if (scrollAcc.current <= -SCROLL_HYSTERESIS_PX) {
        scrollAcc.current = -SCROLL_HYSTERESIS_PX;
        setHideRequested(false);
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [mode, listScrollRef, hideIfAllowed]);

  // Map mode: a one-finger (or mouse) pan of the map is the scroll. Zooming, rotating, tilting
  // and the map's own moves never call these.
  const mapPanStart = useCallback(() => {
    panAcc.current = { x: 0, y: 0 };
  }, []);
  /** The map content moved by (dx, dy) screen pixels during a person's drag. */
  const mapPan = useCallback((dx: number, dy: number) => {
    const acc = panAcc.current;
    if (dy !== 0 && acc.y !== 0 && (dy > 0) !== (acc.y > 0)) {
      acc.x = 0;
      acc.y = 0;
    }
    acc.x += dx;
    acc.y += dy;
    if (Math.abs(acc.y) <= Math.abs(acc.x)) return; // Mostly sideways: just panning.
    if (acc.y <= -PAN_HIDE_PX) hideIfAllowed();
    else if (acc.y >= PAN_SHOW_PX) setHideRequested(false);
  }, [hideIfAllowed]);

  // The keyboard (or a screen reader moving focus) inside the header shows it and keeps it.
  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    setHideRequested(false);
    if (isKeyboardOrTextFocus(event.target)) setFocusInside(true);
  }, []);
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocusInside(false);
  }, []);

  return {
    hidden,
    headerHeight,
    headerRef,
    show,
    mapPanStart,
    mapPan,
    headerFocusProps: { onFocus, onBlur },
  };
}

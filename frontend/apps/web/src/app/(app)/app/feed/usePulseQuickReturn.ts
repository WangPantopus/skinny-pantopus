'use client';

// Quick return for the Pulse header (founder request 2026-10-22, spec §3), as in Facebook:
// scrolling the list down, or dragging the map's content up, slides the header away; scrolling
// back up, or a deliberate drag down, brings it back. Over the map the header itself can be
// flicked up out of the way, and the reveal capsule pulled down (or clicked) to bring it back.
// It never hides while there is nothing to scroll, while the keyboard or the area search is
// inside it, or on a surface that keeps it.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** List mode: scroll travel in one direction before the header toggles. */
const SCROLL_HYSTERESIS_PX = 12;
/** Map mode: content dragged up this far (mostly vertically) hides the header… */
const PAN_HIDE_PX = 16;
/** …and dragged down this far shows it again: panning around doesn't keep bringing it back. */
const PAN_SHOW_PX = 48;
/** Scrolls this soon after the screen opens or the view changes are the page settling (a
 *  restored scroll position, a list growing), not the reader. */
const SETTLE_MS = 400;
/** Map mode: a press that moves this far is a drag, not a click. */
const DRAG_SLOP_PX = 6;
/** A drag on the header this far up tucks it away… */
const FLICK_HIDE_PX = 24;
/** …and a quick flick sooner: once it has gone this far at this speed (px per ms). */
const FLICK_MIN_PX = 10;
const FLICK_SPEED = 0.9;
/** Pulling the reveal capsule down this far brings the header back. */
const REVEAL_PULL_PX = 16;
/** The header's follow-the-finger offset (px, up is negative), read by its transform. */
const DRAG_VAR = '--pulse-header-drag';
/** A drag that starts in one of these is for the field: typing and selecting text. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

interface Options {
  mode: 'list' | 'map';
  /** False while there is nothing to scroll (loading, empty, error) or on a surface that keeps the header. */
  canHide: boolean;
  /** A change shows the header again: mode, surface, filter, topic, area, the area search opening. */
  resetKey: string;
  /** The list's own scroll area; the window scrolls too. */
  listScrollRef: RefObject<HTMLElement | null>;
  /** Reduce Motion: a flick fades the header out instead of the header following the finger. */
  reducedMotion: boolean;
}

/** A drag that starts in a text field, or in a list that scrolls up and down inside the header
 *  (the area search's suggestions), is that element's own. */
function isOwnDrag(target: EventTarget | null, header: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(TEXT_ENTRY)) return true;
  for (let el: Element | null = target; el && el !== header; el = el.parentElement) {
    // A sideways chip row computes overflow-y: auto too, and may overflow by a shadow's pixels.
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 8) return true;
  }
  return false;
}

/** The click a drag ends with (on whatever is under the pointer) isn't a click on that control. */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
}

/** Follows one pointer from its press until it lifts: `onMove` with its travel, `onEnd` with
 *  whether it was lifted (not cancelled). Returns the function that stops following it. */
function followPointer(
  press: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>,
  onMove: (dx: number, dy: number, event: PointerEvent) => void,
  onEnd: (lifted: boolean, dy: number) => void,
): () => void {
  const { pointerId, clientX, clientY } = press;
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId === pointerId) onMove(event.clientX - clientX, event.clientY - clientY, event);
  };
  const finish = (lifted: boolean) => (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    stop();
    onEnd(lifted, event.clientY - clientY);
  };
  const up = finish(true);
  const cancel = finish(false);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  return stop;
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

export function usePulseQuickReturn({ mode, canHide, resetKey, listScrollRef, reducedMotion }: Options) {
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

  // Map mode: the header itself, dragged up by a finger or the mouse, follows it (not with Reduce
  // Motion) and tucks away once it has gone FLICK_HIDE_PX or been flicked; let go sooner, it
  // springs back. A sideways drag is left to the chip rows, and a drag that starts in a text
  // field is the field's. The flick hides it as a map drag would, so the map's drags carry on.
  const headerEl = useRef<HTMLElement | null>(null);
  const flickAllowed = mode === 'map' && hideAllowed && !hidden;
  const flickAllowedRef = useRef(flickAllowed);
  flickAllowedRef.current = flickAllowed;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const stopFollowing = useRef<(() => void) | null>(null);
  useEffect(() => () => stopFollowing.current?.(), []);
  // Hidden, the header's transform no longer reads the drag; clear it before it shows again.
  useEffect(() => {
    if (hidden) headerEl.current?.style.removeProperty(DRAG_VAR);
  }, [hidden]);

  // A native listener on the header element: the map's chip row is portalled into it, and React
  // sends a portal's events to its React parent (the map), not to the header around it.
  const onHeaderPointerDown = useCallback((press: PointerEvent) => {
    const el = headerEl.current;
    if (!el || !flickAllowedRef.current || !press.isPrimary || press.button !== 0) return;
    if (isOwnDrag(press.target, el)) return;
    stopFollowing.current?.();
    let vertical: boolean | null = null;
    let tucked = false;
    let speed = 0; // px per ms, smoothed; < 0 going up
    let lastY = press.clientY;
    let lastT = press.timeStamp;
    const springBack = () => el.style.removeProperty(DRAG_VAR);
    const tuck = () => {
      tucked = true;
      el.removeAttribute('data-pulse-dragging'); // its slide (or fade) eases it the rest of the way
      if (!hideAllowedRef.current) {
        springBack();
        return;
      }
      panAcc.current = { x: 0, y: 0 };
      setHideRequested(true);
    };
    stopFollowing.current = followPointer(
      press,
      (dx, dy, event) => {
        if (vertical === null) {
          if (Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
          vertical = Math.abs(dy) > Math.abs(dx);
          if (!vertical) {
            stopFollowing.current?.();
            stopFollowing.current = null;
            return;
          }
          el.setAttribute('data-pulse-dragging', '');
          // Text the mouse began selecting in the header before the drag took over.
          const selection = window.getSelection();
          if (selection?.anchorNode && el.contains(selection.anchorNode)) selection.removeAllRanges();
        }
        const dt = event.timeStamp - lastT;
        if (dt > 0) speed = 0.8 * ((event.clientY - lastY) / dt) + 0.2 * speed;
        lastY = event.clientY;
        lastT = event.timeStamp;
        if (tucked) return;
        if (!reducedMotionRef.current) el.style.setProperty(DRAG_VAR, `${Math.min(0, dy)}px`);
        if (dy <= -FLICK_HIDE_PX || (dy <= -FLICK_MIN_PX && speed <= -FLICK_SPEED)) tuck();
      },
      (lifted, dy) => {
        stopFollowing.current = null;
        if (!vertical) return;
        el.removeAttribute('data-pulse-dragging');
        if (lifted) swallowNextClick();
        if (tucked) return;
        if (lifted && dy <= -FLICK_MIN_PX && speed <= -FLICK_SPEED) tuck();
        else springBack();
      },
    );
  }, []);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Over the map a drag that starts on a link or an image doesn't drag it out of the page.
  const onHeaderDragStart = useCallback((event: DragEvent) => {
    if (modeRef.current === 'map') event.preventDefault();
  }, []);

  // Focus moving into the header shows it; keyboard focus (or the area search) keeps it there until focus moves on
  // or leaves. Native listeners, as for the flick: React sent the focus and blur of the map's portalled chips and
  // count to the map, so focus arriving there went unseen and focus leaving from there left the header stuck.
  const onHeaderFocusIn = useCallback((event: FocusEvent) => {
    setHideRequested(false);
    setFocusInside(event.target instanceof Element && isKeyboardOrTextFocus(event.target));
  }, []);
  const onHeaderFocusOut = useCallback((event: FocusEvent) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !headerEl.current?.contains(next)) setFocusInside(false);
  }, []);

  // The header's own height (offsetHeight ignores the slide), for the map's top items and the list's top.
  const observer = useRef<ResizeObserver | null>(null);
  const headerRef = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    headerEl.current?.removeEventListener('pointerdown', onHeaderPointerDown);
    headerEl.current?.removeEventListener('dragstart', onHeaderDragStart);
    headerEl.current?.removeEventListener('focusin', onHeaderFocusIn);
    headerEl.current?.removeEventListener('focusout', onHeaderFocusOut);
    // List and map draw separate header elements: focus in the one going away (removing it sends no blur) doesn't
    // keep the new one in view.
    if (el !== headerEl.current) setFocusInside(false);
    headerEl.current = el;
    if (!el) return;
    el.addEventListener('pointerdown', onHeaderPointerDown);
    el.addEventListener('dragstart', onHeaderDragStart);
    el.addEventListener('focusin', onHeaderFocusIn);
    el.addEventListener('focusout', onHeaderFocusOut);
    setHeaderHeight(el.offsetHeight);
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
      observer.current.observe(el);
    }
  }, [onHeaderPointerDown, onHeaderDragStart, onHeaderFocusIn, onHeaderFocusOut]);
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

  /** The reveal capsule pulled down REVEAL_PULL_PX (mostly vertically): `onReveal`, as its click does. */
  const onRevealPointerDown = useCallback((press: ReactPointerEvent<HTMLElement>, onReveal: () => void) => {
    if (!press.isPrimary || press.button !== 0) return;
    stopFollowing.current?.();
    stopFollowing.current = followPointer(
      press,
      (dx, dy) => {
        if (dy < REVEAL_PULL_PX || dy <= Math.abs(dx)) return;
        stopFollowing.current?.();
        stopFollowing.current = null;
        swallowNextClick();
        onReveal();
      },
      () => {
        stopFollowing.current = null;
      },
    );
  }, []);

  return {
    hidden,
    headerHeight,
    headerRef,
    show,
    mapPanStart,
    mapPan,
    onRevealPointerDown,
  };
}

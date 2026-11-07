'use client';

// Coming back to Nearby opens the Pulse list on the card it was left on, in the same place on screen.
// A profile, a post's page or another tab unmounts this screen while the router and TanStack Query keep
// its posts; this keeps where each list was left, in memory for this page load. A list (surface,
// post-type filter, topic lane and area, as its cache key) reopens there while that card is still in
// it. A reload, a new area, or a surface or filter change on the screen opens a list at its top.

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';

interface KeptPlace {
  /** The card at the top of the list box, and how far it was scrolled past the box's top edge. */
  cardKey: VirtualItem['key'];
  cardOffset: number;
  /** The list box's top on screen: the window's scroll, which moves the header, the cards above the list and the box. */
  listTop: number;
  headerHidden: boolean;
  /** The heights the cards were measured at, so the cards above that one lay out as they did. */
  measurements: VirtualItem[];
}

/** Where each list was when Nearby was left, by list key; the oldest go first. */
const keptPlaces = new Map<string, KeptPlace>();
const KEPT_LISTS = 10;

export interface PulsePlaceRestore {
  /** The list's scroll that puts that card back where it was. */
  offset: number;
  measurements: VirtualItem[];
  listTop: number;
  headerHidden: boolean;
}

/** Read once as the screen opens: the place to reopen this list at, if it was left there and still has that card. */
export function useKeptPulsePlace(
  listKey: string,
  posts: readonly { id: string }[],
  estimateSize: number,
): PulsePlaceRestore | null {
  const [restore] = useState<PulsePlaceRestore | null>(() => {
    const place = keptPlaces.get(listKey);
    if (!place) return null;
    const index = posts.findIndex((post) => post.id === place.cardKey);
    if (index < 0) return null;
    // Where that card starts now: the heights it was laid out with, in today's order (a post taken out above it moves it up).
    const sizes = new Map(place.measurements.map((item) => [item.key, item.size]));
    let start = 0;
    for (let i = 0; i < index; i++) start += sizes.get(posts[i].id) ?? estimateSize;
    return { offset: start + place.cardOffset, measurements: place.measurements, listTop: place.listTop, headerHidden: place.headerHidden };
  });
  return restore;
}

interface KeepOptions {
  restore: PulsePlaceRestore | null;
  listKey: string;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  listScrollRef: RefObject<HTMLDivElement | null>;
  /** The list is on screen (list mode, with posts). */
  listShown: boolean;
  headerHidden: boolean;
}

/**
 * Puts the list box back in its place on screen as the screen reopens, opens another list at its top,
 * and keeps the place when the screen goes.
 */
export function useKeepPulsePlace({ restore, listKey, virtualizer, listScrollRef, listShown, headerHidden }: KeepOptions) {
  // The list it opened on was used: leaving it on the screen (another surface, filter or area) doesn't bring it back.
  const openedKey = useRef(listKey);
  useLayoutEffect(() => {
    keptPlaces.delete(openedKey.current);
  }, []);

  // The virtualizer scrolls the list itself (initialOffset); the window puts the box where it was.
  useLayoutEffect(() => {
    if (!restore) return undefined;
    const place = () => {
      const box = listScrollRef.current;
      if (!box) return;
      const delta = Math.round(box.getBoundingClientRect().top - restore.listTop);
      if (delta !== 0) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
    };
    place();
    // A tab's link scrolls the window to the top once the screen has mounted: again before the frame is drawn.
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [restore, listScrollRef]);

  // Another list opens at its top. Without this the virtualizer scrolls it to where the last list was read
  // (it keeps the offset while the skeleton shows, and a kept list reuses the same box).
  const shownKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!listShown || !listScrollRef.current) return;
    if (shownKey.current !== null && shownKey.current !== listKey) virtualizer.scrollToOffset(0);
    shownKey.current = listKey;
  });

  const keepPlace = useRef(() => {});
  keepPlace.current = () => {
    const box = listScrollRef.current;
    if (!listShown || !box) return;
    const card = virtualizer.getVirtualItemForOffset(box.scrollTop);
    if (!card) return;
    keptPlaces.delete(listKey);
    keptPlaces.set(listKey, {
      cardKey: card.key,
      cardOffset: box.scrollTop - card.start,
      listTop: box.getBoundingClientRect().top,
      headerHidden,
      measurements: virtualizer.measurementsCache,
    });
    for (const key of keptPlaces.keys()) {
      if (keptPlaces.size <= KEPT_LISTS) break;
      keptPlaces.delete(key);
    }
  };
  // A layout cleanup: as the screen goes, its elements are still in place and the window hasn't moved yet.
  useLayoutEffect(() => () => keepPlace.current(), []);
}

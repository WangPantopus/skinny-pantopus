import { useEffect, useRef, useState } from 'react';

/**
 * Animation state applied to each pin.
 *  - `entering` — new pin, will get the `pin-enter` CSS class (200 ms fade-in).
 *  - `stable`   — already visible, no animation.
 *  - `exiting`  — removed from data but kept in DOM for the fade-out (150 ms).
 */
export type AnimState = 'entering' | 'stable' | 'exiting';

const EXIT_DURATION_MS = 150;
const ENTER_DURATION_MS = 200;

/**
 * Returns the CSS class name for a Leaflet DivIcon `className` given an
 * animation state, composed with an optional base class.
 */
export function pinAnimClass(state: AnimState, base = ''): string {
  const anim = state === 'entering' ? 'pin-enter' : state === 'exiting' ? 'pin-exit' : '';
  return [base, anim].filter(Boolean).join(' ');
}

/**
 * Returns the CSS class name for cluster icons — includes `cluster-pop` so the
 * count badge pops whenever the icon is re-created by React.
 */
export function clusterAnimClass(state: AnimState, base = ''): string {
  const anim = state === 'entering' ? 'pin-enter cluster-pop' : state === 'exiting' ? 'pin-exit' : 'cluster-pop';
  return [base, anim].filter(Boolean).join(' ');
}

export interface AnimatedPin<T> {
  pin: T;
  animState: AnimState;
}

/**
 * Manages enter/exit animation lifecycle for an array of map pins.
 *
 * - Pins that appear in `currentPins` but weren't in the previous render
 *   are tagged `entering` (cleared to `stable` after 200 ms).
 * - Pins that disappear from `currentPins` are kept in the returned array
 *   as `exiting` for 150 ms, then removed.
 *
 * Requires each pin to carry a string/number `id` for stable identity.
 */
export function useAnimatedPins<T extends { id: string | number }>(
  currentPins: T[],
): AnimatedPin<T>[] {
  // Refs to track previous pin set and exiting pins
  const prevIdsRef = useRef<Set<string | number>>(new Set());
  const exitingRef = useRef<Map<string | number, T>>(new Map());
  const enteringRef = useRef<Set<string | number>>(new Set());
  const [, tick] = useState(0);

  const currentIds = new Set(currentPins.map((p) => p.id));

  // Identify entering pins (new ids not in previous set AND not already exiting → re-entering)
  const newEntering: (string | number)[] = [];
  for (const pin of currentPins) {
    if (!prevIdsRef.current.has(pin.id)) {
      newEntering.push(pin.id);
      // If this pin was in the middle of exiting, cancel the exit
      exitingRef.current.delete(pin.id);
    }
  }

  // Detect exiting pins during render (prevPinsRef still has previous value here)
  const prevPinsRef = useRef<T[]>([]);
  const newExiting: T[] = [];
  for (const prev of prevPinsRef.current) {
    if (!currentIds.has(prev.id) && !exitingRef.current.has(prev.id)) {
      newExiting.push(prev);
      exitingRef.current.set(prev.id, prev);
    }
  }

  // Stable identity key for effects — changes only when pin set changes
  const currentIdsKey = currentPins.map((p) => p.id).join(',');

  // Update refs for next render (after detection above)
  prevIdsRef.current = currentIds;
  prevPinsRef.current = currentPins;

  // Schedule exiting pin removal after animation
  useEffect(() => {
    if (newExiting.length === 0) return;
    tick((n) => n + 1);
    const timer = setTimeout(() => {
      for (const pin of newExiting) {
        exitingRef.current.delete(pin.id);
      }
      tick((n) => n + 1);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdsKey]);

  // Schedule entering → stable transition
  useEffect(() => {
    if (newEntering.length === 0) return;
    for (const id of newEntering) {
      enteringRef.current.add(id);
    }
    tick((n) => n + 1);

    const timer = setTimeout(() => {
      for (const id of newEntering) {
        enteringRef.current.delete(id);
      }
      tick((n) => n + 1);
    }, ENTER_DURATION_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdsKey]);

  // Build output array
  const result: AnimatedPin<T>[] = [];

  for (const pin of currentPins) {
    result.push({
      pin,
      animState: enteringRef.current.has(pin.id) ? 'entering' : 'stable',
    });
  }

  for (const [, pin] of exitingRef.current) {
    // Only include if not also in current (re-entered)
    if (!currentIds.has(pin.id)) {
      result.push({ pin, animState: 'exiting' });
    }
  }

  return result;
}

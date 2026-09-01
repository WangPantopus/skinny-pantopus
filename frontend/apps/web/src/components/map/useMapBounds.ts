import { useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export type Bounds = { south: number; west: number; north: number; east: number };

/** Approximate area of a bounds rect (degree²). */
function boundsArea(b: Bounds): number {
  return Math.abs((b.north - b.south) * (b.east - b.west));
}

/** True when new bounds differ from old by less than 10% of area. */
export function boundsChangedSignificantly(prev: Bounds | null, next: Bounds): boolean {
  if (!prev) return true;
  const prevArea = boundsArea(prev);
  if (prevArea === 0) return true;
  // Compare center shift + area change
  const centerLatShift = Math.abs(
    (prev.north + prev.south) / 2 - (next.north + next.south) / 2,
  );
  const centerLngShift = Math.abs(
    (prev.east + prev.west) / 2 - (next.east + next.west) / 2,
  );
  const latSpan = prev.north - prev.south;
  const lngSpan = prev.east - prev.west;
  // Suppress if center moved less than 10% of span AND area changed less than 10%
  if (
    latSpan > 0 && lngSpan > 0 &&
    centerLatShift / latSpan < 0.1 &&
    centerLngShift / lngSpan < 0.1 &&
    Math.abs(boundsArea(next) - prevArea) / prevArea < 0.1
  ) {
    return false;
  }
  return true;
}

/**
 * Debounced map bounds/zoom watcher.
 * Calls `onBoundsChange` after the user stops moving/zooming for `debounceMs`.
 * Suppresses callback when bounds changed by less than 10% (tiny pans).
 * Also fires once on mount with the initial bounds.
 */
export function useMapBounds(
  onBoundsChange: (bounds: Bounds, zoom: number) => void,
  debounceMs = 400,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedInitial = useRef(false);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const map = useMap();

  const fire = () => {
    const b = map.getBounds();
    const next: Bounds = {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    };
    if (!boundsChangedSignificantly(lastBoundsRef.current, next)) return;
    lastBoundsRef.current = next;
    onBoundsChange(next, map.getZoom());
  };

  const schedulefire = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fire, debounceMs);
  };

  useMapEvents({
    moveend: schedulefire,
    zoomend: schedulefire,
  });

  // Fire initial bounds synchronously on first render
  if (!firedInitial.current) {
    firedInitial.current = true;
    // Use queueMicrotask so the map is fully initialized
    queueMicrotask(fire);
  }
}

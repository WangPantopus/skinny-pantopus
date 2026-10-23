// What the Pulse map's two renderers (the 3D Mapbox GL map, PulseGlMap, and the flat Leaflet
// map in FeedMap) share with FeedMap: the view they report, the camera FeedMap moves, and the
// markers they draw.

import { boundsChangedSignificantly, type Bounds } from '@/components/map/useMapBounds';

/** A settled view of the map. Zoom is on Leaflet's scale (256 px tiles) for both renderers. */
export interface PulseView {
  /** The visible area (on a tilted map, the box around it): what the posts are read for. */
  bounds: Bounds;
  zoom: number;
  center: { lat: number; lng: number };
  /** The map's size on screen, px. */
  size: { w: number; h: number };
}

/** The map's own moves. Zoom on Leaflet's scale. */
export interface PulseCamera {
  /** Flies there; `onEnd` gets the view it lands on. */
  flyTo(lat: number, lng: number, zoom: number, durationSec: number, onEnd?: (view: PulseView) => void): void;
  fitBounds(bounds: Bounds, paddingPx: number): void;
}

/** A pin or cluster as the renderers draw it (HTML from ./pulseMapPins.ts). */
export interface PulseMarker {
  id: string;
  lat: number;
  lng: number;
  html: string;
  /** Its accessible name ("Event post", "Cluster of 12 posts"). */
  label: string;
  /** Enter/exit animation classes (components/map/useAnimatedPins). */
  animCls: string;
  selected: boolean;
  exiting: boolean;
}

/** Web Mercator y of a latitude: 0 at the north edge of the world, 1 at the south. */
function mercatorY(lat: number): number {
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

/**
 * Did the camera leave the view the posts were read for (so "Search this area" shows)?
 * It compares the centre and the zoom, not the visible bounds: a tilted map's bounds are the box
 * around a trapezoid, far larger than the view, and tilting or turning it changes them without
 * moving anything. A move of over a tenth of the map's width or height, or a zoom change of over
 * 0.1 (about 15% in area), counts.
 */
export function viewMovedSignificantly(prev: PulseView, next: PulseView): boolean {
  if (prev.size.w <= 0 || prev.size.h <= 0) return boundsChangedSignificantly(prev.bounds, next.bounds);
  if (Math.abs(next.zoom - prev.zoom) > 0.1) return true;
  const worldPx = 256 * 2 ** prev.zoom;
  let dLng = next.center.lng - prev.center.lng;
  if (dLng > 180) dLng -= 360;
  else if (dLng < -180) dLng += 360;
  const dx = (dLng / 360) * worldPx;
  const dy = (mercatorY(next.center.lat) - mercatorY(prev.center.lat)) * worldPx;
  return Math.abs(dx) > prev.size.w * 0.1 || Math.abs(dy) > prev.size.h * 0.1;
}

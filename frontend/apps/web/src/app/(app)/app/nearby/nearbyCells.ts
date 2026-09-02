// ============================================================
// The Nearby window's cell styling — pure, so it can be tested without
// Leaflet. A cell's bucket is the ONLY thing the server tells us about
// it; the viewer's own cell gets an outline, never a dot.
// ============================================================

import type { NeighborhoodCellBucket } from '@pantopus/api';

export interface CellStyle {
  fillColor: string;
  fillOpacity: number;
  color: string;
  weight: number;
  dashArray?: string;
}

// Tailwind primary-600 / primary-400 as hex, because Leaflet paints SVG
// paths directly and cannot read CSS variables.
const PRIMARY = '#2563eb';
const OUTLINE = '#0f172a';

const FILL_OPACITY: Record<NeighborhoodCellBucket, number> = {
  none: 0,
  forming: 0.14,
  few: 0.32,
  growing: 0.55,
};

export function cellStyle(bucket: NeighborhoodCellBucket, isHome: boolean): CellStyle {
  return {
    fillColor: PRIMARY,
    fillOpacity: FILL_OPACITY[bucket] ?? 0,
    color: isHome ? OUTLINE : PRIMARY,
    weight: isHome ? 2 : 1,
    dashArray: isHome ? undefined : '3 4',
  };
}

export const LEGEND_ORDER: NeighborhoodCellBucket[] = ['none', 'forming', 'few', 'growing'];

/** Leaflet zoom that shows a 5×5 grid of geohash-6 cells (~6 km across). */
export const CELLS_ZOOM = 13;

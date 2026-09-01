'use client';

import { useCallback } from 'react';

// ─── Geo helpers ────────────────────────────────────────────

/** Haversine distance in miles between two lat/lon points. */
function haversineMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3958.8; // earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns a cardinal direction label (N, NE, E, …) from point A to point B. */
function cardinalDirection(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): string {
  const dLat = toLat - fromLat;
  const dLon = toLon - fromLon;
  const angle = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;

  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(angle / 45) % 8;
  return DIRS[idx];
}

// ─── Component ──────────────────────────────────────────────

export interface NearestActivityCenter {
  latitude: number;
  longitude: number;
}

interface NearestActivityPromptProps {
  /** The center of the current viewport (used to compute distance & direction). */
  viewCenter: { latitude: number; longitude: number };
  /** The nearest activity point returned by the API (null means no data). */
  nearest: NearestActivityCenter | null | undefined;
  /** Noun shown in "No [content] here" – e.g. "tasks", "posts" */
  contentLabel?: string;
  /** Called when the user taps "Go there" — receives the target coords. */
  onFlyTo?: (target: NearestActivityCenter) => void;
}

/**
 * Overlay shown when the viewport query returned zero results but the backend
 * found activity elsewhere. Displays direction, distance, and a fly-to button.
 */
export function NearestActivityPrompt({
  viewCenter,
  nearest,
  contentLabel = 'activity',
  onFlyTo,
}: NearestActivityPromptProps) {
  const handleFlyTo = useCallback(() => {
    if (nearest && onFlyTo) onFlyTo(nearest);
  }, [nearest, onFlyTo]);

  if (!nearest) return null;

  const miles = haversineMiles(
    viewCenter.latitude, viewCenter.longitude,
    nearest.latitude, nearest.longitude,
  );
  const dir = cardinalDirection(
    viewCenter.latitude, viewCenter.longitude,
    nearest.latitude, nearest.longitude,
  );

  const distLabel = miles < 1 ? `${Math.round(miles * 5280)} ft` : `${Math.round(miles)} mi`;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] flex flex-col items-center gap-2 bg-app-surface/95 backdrop-blur rounded-2xl px-5 py-4 shadow-lg text-sm text-app-text-secondary max-w-xs text-center">
      <span className="text-base">🗺️</span>
      <p>
        No {contentLabel} here. Nearest activity is{' '}
        <strong className="text-app-text">{distLabel} {dir}</strong>.
      </p>
      {onFlyTo && (
        <button
          onClick={handleFlyTo}
          className="mt-1 rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition"
        >
          Go there →
        </button>
      )}
    </div>
  );
}

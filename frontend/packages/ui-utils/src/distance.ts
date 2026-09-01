// ============================================================
// DISTANCE FORMATTING UTILITIES
// Single source of truth — replaces inline formatDistance
// ============================================================

const METERS_PER_MILE = 1609.34;
const MAX_MAP_LATITUDE_DELTA = 120;

/**
 * Format a distance in meters to a human-readable string (imperial).
 *
 * - null / 0     → ""
 * - < 160 m      → "nearby"
 * - < 1 mile     → "0.X mi"
 * - >= 1 mile    → "X.X mi"  (or "X mi" when ≥ 10)
 */
export function formatDistance(meters: number | null | undefined): string {
  if (!meters || meters <= 0) return '';

  if (meters < 160) return 'nearby';

  const miles = meters / METERS_PER_MILE;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Convert a radius in miles to a map latitudeDelta that shows
 * roughly 2× the radius as visible area.
 *
 * 1 degree latitude ≈ 69 miles.
 */
export function radiusMilesToLatDelta(radiusMiles: number): number {
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) return 1;
  return Math.min((radiusMiles * 2) / 69, MAX_MAP_LATITUDE_DELTA);
}

/**
 * Map configuration — single source of truth for frontend map settings.
 *
 * All tokens come from environment variables; nothing is hardcoded.
 * The tile URL is assembled at runtime via getTileUrl() so that
 * hot-reloads and SSR both pick up the correct token.
 */

// ── Tokens ───────────────────────────────────────────────────

/** Public Mapbox token for tile and style requests (client-safe). */
const MAP_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ── Tile configuration ──────────────────────────────────────

/** Mapbox base tile URL pattern. */
const MAPBOX_TILE_URL_BASE =
  'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}';

/**
 * Returns the full tile URL with the current public token appended.
 * Prefer this over the static TILE_URL export in components that may
 * render before env vars are available (SSR, tests).
 */
export function getTileUrl(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
  return `${MAPBOX_TILE_URL_BASE}?access_token=${token}`;
}

/** Static tile URL — evaluated once at module load. */
export const TILE_URL = `${MAPBOX_TILE_URL_BASE}?access_token=${MAP_PUBLIC_TOKEN}`;

/** Attribution string — Mapbox ToS requires this when using Mapbox tiles. */
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '<a href="https://www.mapbox.com/map-feedback/">Improve this map</a>';

// ── Map defaults ─────────────────────────────────────────────

/** Default map center [lat, lng] — Portland, OR. */
export const DEFAULT_CENTER: [number, number] = [45.5152, -122.6784];

/** Default zoom level. */
export const DEFAULT_ZOOM = 13;

/**
 * Geo / Map configuration — single source of truth for all geo and map settings.
 *
 * Client-facing values (tile URL, attribution, defaults) are safe to expose.
 * Server-only values (GEO_SERVER_TOKEN) must never be sent to the client.
 */

const logger = require('../utils/logger');

// ── Tokens ───────────────────────────────────────────────────

/** Public Mapbox token for client-side tile requests. */
const MAP_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/** Secret Mapbox token for server-side geocoding. */
const GEO_SERVER_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

// ── Provider selection ───────────────────────────────────────

/** Active geo provider name (default: 'mapbox'). */
const GEO_PROVIDER = (process.env.GEO_PROVIDER || 'mapbox').toLowerCase();

// ── Tile configuration ──────────────────────────────────────

/** Mapbox raster tile URL pattern (uses public token). */
const MAP_TILE_URL =
  'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}';

/** Full attribution string required by Mapbox ToS. */
const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '<a href="https://www.mapbox.com/map-feedback/">Improve this map</a>';

// ── Map defaults ─────────────────────────────────────────────

/** Default map center [lat, lng] — Portland, OR. */
const DEFAULT_CENTER = [45.5152, -122.6784];

/** Default zoom level. */
const DEFAULT_ZOOM = 13;

// ── Startup validation ──────────────────────────────────────

if (!GEO_SERVER_TOKEN) {
  logger.warn('MAPBOX_ACCESS_TOKEN not set — server-side geocoding will fail');
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  MAP_PUBLIC_TOKEN,
  GEO_SERVER_TOKEN,
  GEO_PROVIDER,
  MAP_TILE_URL,
  MAP_TILE_ATTRIBUTION,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
};

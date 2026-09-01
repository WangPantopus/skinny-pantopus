import { getTileUrl } from '@/components/map/constants';

const SESSION_KEY = 'pantopus-tiles-prefetched';
const CACHE_NAME = 'pantopus-map-tiles-v1';

/**
 * Convert lat/lng to slippy-map tile coordinates at a given zoom level.
 * Standard OSM / Mapbox formula.
 */
function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Prefetch map tiles for zoom levels 12–14 in a 3×3 grid around the
 * user's home coordinates. Stores tiles in the same Cache API bucket
 * used by CachedTileLayer so they are available for offline fallback.
 *
 * Wrapped in requestIdleCallback to avoid blocking the main thread.
 * Guarded by sessionStorage so it only runs once per browser session.
 */
export function prefetchHomeTiles(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;
  if (typeof caches === 'undefined') return;

  // Only prefetch once per session
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage unavailable — skip guard, still prefetch
  }

  const tileTemplate = getTileUrl();
  const zoomLevels = [12, 13, 14];

  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200);

  schedule(async () => {
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    if (!cache) return;

    for (const z of zoomLevels) {
      const center = latLngToTile(lat, lng, z);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const url = tileTemplate
            .replace('{z}', String(z))
            .replace('{x}', String(center.x + dx))
            .replace('{y}', String(center.y + dy));
          // Skip if already cached
          const existing = await cache.match(url).catch(() => null);
          if (existing) continue;
          try {
            const resp = await fetch(url);
            if (resp.ok) await cache.put(url, resp);
          } catch {
            // Network error — silently skip this tile
          }
        }
      }
    }
  });
}

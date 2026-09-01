'use client';

/**
 * CachedTileLayer — Leaflet TileLayer wrapper that caches loaded tiles
 * using the browser Cache API. When offline, serves cached tiles instead
 * of showing blank white squares.
 *
 * Strategy:
 *  - On every tile load, store the image blob in a Cache Storage bucket.
 *  - On fetch failure (offline), serve from cache if available.
 *  - No external dependencies; uses standard Cache API (all modern browsers).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const CACHE_NAME = 'pantopus-map-tiles-v1';

function openTileCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return Promise.resolve(null);
  return caches.open(CACHE_NAME).catch(() => null);
}

/**
 * Custom Leaflet TileLayer that intercepts tile loading to cache/serve
 * tiles via the Cache API.
 */
const CachedTileLayerClass = L.TileLayer.extend({
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLImageElement {
    const tile = document.createElement('img');
    const url = this.getTileUrl(coords);

    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    // Crossorigin needed for CORS tiles from Mapbox CDN
    tile.crossOrigin = 'anonymous';

    openTileCache().then(async (cache) => {
      if (!cache) {
        // Cache API unavailable — fall through to normal load
        tile.src = url;
        return;
      }

      try {
        // Try network first
        const resp = await fetch(url);
        if (resp.ok) {
          // Store a clone in cache, use original for tile
          cache.put(url, resp.clone()).catch(() => {});
          const blob = await resp.blob();
          tile.src = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(tile.src);
            done(undefined, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(tile.src);
            done(new Error('Tile load error'), tile);
          };
          return;
        }
        throw new Error('Network response not ok');
      } catch {
        // Network failed — try cache
        try {
          const cached = await cache.match(url);
          if (cached) {
            const blob = await cached.blob();
            tile.src = URL.createObjectURL(blob);
            tile.onload = () => {
              URL.revokeObjectURL(tile.src);
              done(undefined, tile);
            };
            tile.onerror = () => {
              URL.revokeObjectURL(tile.src);
              done(new Error('Cached tile load error'), tile);
            };
            // Signal that we served from cache (component listens)
            this.fire('tilecachehit');
            return;
          }
        } catch {
          // Cache miss too
        }
        // Nothing available — show error tile
        done(new Error('Tile unavailable offline'), tile);
        this.fire('tilecachemiss');
      }
    });

    return tile;
  },
});

interface CachedTileLayerProps {
  url: string;
  attribution: string;
  onOfflineTileServed?: () => void;
}

export function CachedTileLayer({ url, attribution, onOfflineTileServed }: CachedTileLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);
  const callbackRef = useRef(onOfflineTileServed);
  callbackRef.current = onOfflineTileServed;

  const handleCacheHit = useCallback(() => {
    callbackRef.current?.();
  }, []);

  useEffect(() => {
    const layer = new (CachedTileLayerClass as any)(url, {
      attribution,
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
    });

    layer.on('tilecachehit', handleCacheHit);
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.off('tilecachehit', handleCacheHit);
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, url, attribution, handleCacheHit]);

  return null;
}

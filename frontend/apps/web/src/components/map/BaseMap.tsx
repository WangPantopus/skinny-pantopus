'use client';

import { type ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../map/leaflet-setup'; // patch Leaflet icons once
import { TILE_URL, TILE_ATTRIBUTION, DEFAULT_CENTER, DEFAULT_ZOOM } from './constants';
import { useMapBounds, type Bounds } from './useMapBounds';
import { MapSkeleton } from './MapSkeleton';
import { CachedTileLayer } from './CachedTileLayer';
import { OfflineIndicator, useOnlineStatus } from './OfflineIndicator';

// ─── Internal: bounds watcher ────────────────────────────────
function BoundsWatcher({
  onBoundsChange,
  debounceMs,
}: {
  onBoundsChange: (bounds: Bounds, zoom: number) => void;
  debounceMs: number;
}) {
  useMapBounds(onBoundsChange, debounceMs);
  return null;
}

// ─── Internal: fly to new center/zoom when props change ──────
function RecenterOnChange({
  center,
  zoom,
}: {
  center: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  const prev = useRef({ center, zoom });
  useEffect(() => {
    const centerChanged =
      center[0] !== prev.current.center[0] || center[1] !== prev.current.center[1];
    const zoomChanged = zoom != null && zoom !== prev.current.zoom;

    if (centerChanged || zoomChanged) {
      map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.6 });
      prev.current = { center, zoom };
    }
  }, [center, map, zoom]);
  return null;
}

// ─── Internal: expose map instance via ref ────────────────────
function MapRefBinder({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// ─── Internal: notify when first tile load completes ──────────
function TilesLoadWatcher({ onLoaded }: { onLoaded: () => void }) {
  const map = useMap();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    const handler = () => {
      if (!fired.current) {
        fired.current = true;
        onLoaded();
      }
    };
    map.on('load', handler);
    // TileLayer also fires 'load' on the map — fallback via the tileload event
    map.eachLayer((layer) => {
      if ((layer as any)._url) {
        (layer as L.TileLayer).on('load', handler);
      }
    });
    // If tiles are already loaded (cached), fire immediately
    const tilePane = map.getPane('tilePane');
    if (tilePane && tilePane.querySelectorAll('img').length > 0) {
      handler();
    }
    return () => {
      map.off('load', handler);
    };
  }, [map, onLoaded]);
  return null;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  /** Debounced callback when user pans/zooms */
  onBoundsChange?: (bounds: Bounds, zoom: number) => void;
  /** Debounce delay in ms (default 400) */
  boundsDebounceMs?: number;
  /** If true, fly to `center` whenever it changes */
  recenterOnChange?: boolean;
  /** Ref to the underlying Leaflet Map instance */
  mapRef?: React.MutableRefObject<L.Map | null>;
  /** Timestamp of the latest successful data fetch (for stale-data display) */
  lastFetchedAt?: Date | null;
  children: ReactNode;
}

export function BaseMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = 'h-full w-full z-0',
  onBoundsChange,
  boundsDebounceMs = 400,
  recenterOnChange = false,
  mapRef,
  lastFetchedAt,
  children,
}: BaseMapProps) {
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const handleTilesLoaded = useCallback(() => setTilesLoaded(true), []);
  const { isOnline } = useOnlineStatus();
  const [servingCachedTiles, setServingCachedTiles] = useState(false);
  const handleOfflineTileServed = useCallback(() => setServingCachedTiles(true), []);

  // Reset cached-tiles flag when back online
  useEffect(() => {
    if (isOnline) setServingCachedTiles(false);
  }, [isOnline]);

  return (
    <div className="relative h-full w-full">
      {/* Skeleton shown until first tile load */}
      {!tilesLoaded && (
        <div className="absolute inset-0 z-[1]">
          <MapSkeleton />
        </div>
      )}

      <MapContainer
        center={center}
        zoom={zoom}
        className={className}
        scrollWheelZoom
        zoomControl={false}
      >
        <CachedTileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          onOfflineTileServed={handleOfflineTileServed}
        />
        <TilesLoadWatcher onLoaded={handleTilesLoaded} />

        {onBoundsChange && (
          <BoundsWatcher onBoundsChange={onBoundsChange} debounceMs={boundsDebounceMs} />
        )}
        {recenterOnChange && <RecenterOnChange center={center} zoom={zoom} />}
        {mapRef && <MapRefBinder mapRef={mapRef} />}

        {children}
      </MapContainer>

      {/* Offline connectivity indicator */}
      <OfflineIndicator
        isOffline={!isOnline}
        servingCachedTiles={servingCachedTiles}
        lastFetchedAt={lastFetchedAt}
      />
    </div>
  );
}

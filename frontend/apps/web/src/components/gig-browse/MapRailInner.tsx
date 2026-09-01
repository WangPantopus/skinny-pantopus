'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GigListItem } from '@pantopus/types';
import { formatPrice } from '@pantopus/ui-utils';
import { BaseMap, LocateMeButton, useAnimatedPins, pinAnimClass, clusterAnimClass } from '@/components/map';
import type { Bounds } from '@/components/map';
import { getCategoryColor } from './MapRail';

// ─── Constants ─────────────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [45.5152, -122.6784]; // Portland
const DEFAULT_ZOOM = 12;

// ─── Clustering ────────────────────────────────────────────────

interface ClusteredPin {
  id: string;
  lat: number;
  lng: number;
  isCluster: boolean;
  count: number;
  gig?: GigListItem;
  gigs: GigListItem[];
}

function clusterGigs(gigs: GigListItem[], zoom: number): ClusteredPin[] {
  const valid = gigs
    .map((g) => {
      const lat = Number(g.approx_latitude ?? g.location?.latitude);
      const lng = Number(g.approx_longitude ?? g.location?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { gig: g, lat, lng } : null;
    })
    .filter(Boolean) as { gig: GigListItem; lat: number; lng: number }[];

  if (valid.length === 0) return [];

  // No clustering at high zoom
  if (zoom >= 14) {
    return valid.map((v) => ({
      id: `pin-${v.gig.id}`,
      lat: v.lat,
      lng: v.lng,
      isCluster: false,
      count: 1,
      gig: v.gig,
      gigs: [v.gig],
    }));
  }

  const cellSize = 0.015 * Math.pow(2, 14 - zoom);
  const buckets = new Map<string, typeof valid>();

  for (const item of valid) {
    const key = `${Math.floor(item.lat / cellSize)}_${Math.floor(item.lng / cellSize)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return Array.from(buckets.values()).map((bucket) => {
    if (bucket.length === 1) {
      return {
        id: `pin-${bucket[0].gig.id}`,
        lat: bucket[0].lat,
        lng: bucket[0].lng,
        isCluster: false,
        count: 1,
        gig: bucket[0].gig,
        gigs: [bucket[0].gig],
      };
    }
    const avgLat = bucket.reduce((s, p) => s + p.lat, 0) / bucket.length;
    const avgLng = bucket.reduce((s, p) => s + p.lng, 0) / bucket.length;
    return {
      id: `cluster-${bucket
        .map((b) => b.gig.id)
        .join('-')
        .slice(0, 60)}`,
      lat: avgLat,
      lng: avgLng,
      isCluster: true,
      count: bucket.length,
      gig: bucket[0].gig,
      gigs: bucket.map((b) => b.gig),
    };
  });
}

// ─── Icon factories ────────────────────────────────────────────

function createCategoryPinIcon(category?: string | null, selected = false, animCls = ''): L.DivIcon {
  const color = getCategoryColor(category);
  const size = selected ? 18 : 12;
  const border = selected ? '3px solid #fff' : '2px solid #fff';
  const shadow = selected
    ? '0 0 0 2px ' + color + ',0 2px 8px rgba(0,0,0,.3)'
    : '0 1px 4px rgba(0,0,0,.25)';
  return L.divIcon({
    className: animCls,
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:${shadow};transition:all .15s ease;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createClusterPinIcon(count: number, animCls = ''): L.DivIcon {
  const size = count >= 20 ? 40 : count >= 8 ? 34 : 28;
  return L.divIcon({
    className: animCls,
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1a5276;color:#fff;font-size:${size > 34 ? 13 : 11}px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Selected Pin Preview ──────────────────────────────────────

function PinPreview({
  gig,
  onSelect,
  onClose,
}: {
  gig: GigListItem;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-app-surface rounded-xl shadow-lg border border-app-border p-3">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-app-text-muted hover:text-app-text-secondary text-sm leading-none p-1"
        aria-label="Close preview"
      >
        &times;
      </button>
      <button onClick={() => onSelect(gig.id)} className="w-full text-left pr-6">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-app-text truncate">{gig.title}</h4>
          <span className="shrink-0 text-sm font-bold text-green-600 dark:text-green-400">
            {formatPrice(Number(gig.price) || 0)}
          </span>
        </div>
        <p className="text-xs text-app-text-secondary mt-0.5">
          {gig.category || 'General'}
          {gig.distance_meters != null && (
            <> &middot; {(gig.distance_meters / 1609.34).toFixed(1)} mi</>
          )}
        </p>
      </button>
    </div>
  );
}

// ─── Cluster Preview ───────────────────────────────────────────

function ClusterPreview({
  gigs,
  onSelect,
  onClose,
}: {
  gigs: GigListItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-app-surface rounded-xl shadow-lg border border-app-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-app-text">{gigs.length} tasks here</span>
        <button
          onClick={onClose}
          className="text-app-text-muted hover:text-app-text-secondary text-sm leading-none p-1"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {gigs.slice(0, 8).map((gig) => (
          <button
            key={gig.id}
            onClick={() => onSelect(gig.id)}
            className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-app-hover transition"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-app-text truncate">{gig.title}</span>
              <span className="shrink-0 text-xs font-bold text-green-600 dark:text-green-400">
                {formatPrice(Number(gig.price) || 0)}
              </span>
            </div>
          </button>
        ))}
        {gigs.length > 8 && (
          <p className="text-[11px] text-app-text-muted text-center py-1">
            +{gigs.length - 8} more
          </p>
        )}
      </div>
    </div>
  );
}

// ─── FitBounds helper (inside MapContainer) ────────────────────

function FitToGigs({ gigs }: { gigs: GigListItem[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || gigs.length === 0) return;
    const coords: [number, number][] = [];
    for (const g of gigs) {
      const lat = Number(g.approx_latitude ?? g.location?.latitude);
      const lng = Number(g.approx_longitude ?? g.location?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lat, lng]);
    }
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(([la, ln]) => L.latLng(la, ln)));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      fitted.current = true;
    }
  }, [gigs, map]);

  return null;
}

// ─── Main Inner Component ──────────────────────────────────────

interface MapRailInnerProps {
  gigs: GigListItem[];
  userLocation: { lat: number; lng: number } | null;
  selectedGigId?: string | null;
  onGigSelect: (gigId: string) => void;
  onBoundsChange?: (bounds: Bounds) => void;
}

export default function MapRailInner({
  gigs,
  userLocation,
  selectedGigId,
  onGigSelect,
  onBoundsChange,
}: MapRailInnerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [preview, setPreview] = useState<GigListItem | null>(null);
  const [clusterPreview, setClusterPreview] = useState<GigListItem[]>([]);

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : DEFAULT_CENTER;

  // Track zoom for clustering
  const handleBoundsChange = useCallback(
    (bounds: Bounds, newZoom: number) => {
      setZoom(newZoom);
      onBoundsChange?.(bounds);
    },
    [onBoundsChange]
  );

  // Cluster the gigs
  const pins = useMemo(() => clusterGigs(gigs, zoom), [gigs, zoom]);

  // Animated enter/exit transitions
  const animatedPins = useAnimatedPins(pins);

  // Handle pin click
  const handlePinClick = useCallback(
    (pin: ClusteredPin) => {
      if (pin.isCluster) {
        // Zoom into the cluster
        if (mapRef.current && pin.gigs.length > 0) {
          const coords = pin.gigs
            .map((g) => {
              const lat = Number(g.approx_latitude ?? g.location?.latitude);
              const lng = Number(g.approx_longitude ?? g.location?.longitude);
              return Number.isFinite(lat) && Number.isFinite(lng) ? L.latLng(lat, lng) : null;
            })
            .filter(Boolean) as L.LatLng[];
          if (coords.length > 0) {
            mapRef.current.fitBounds(L.latLngBounds(coords), {
              padding: [40, 40],
              maxZoom: Math.min((mapRef.current.getZoom() || 12) + 2, 16),
            });
          }
        }
        setClusterPreview(pin.gigs);
        setPreview(null);
      } else if (pin.gig) {
        setPreview(pin.gig);
        setClusterPreview([]);
        // Also tell the parent so the list can highlight it
        onGigSelect(pin.gig.id);
      }
    },
    [onGigSelect]
  );

  // When selectedGigId changes externally (hover on list row), pan to it
  useEffect(() => {
    if (!selectedGigId || !mapRef.current) return;
    const gig = gigs.find((g) => g.id === selectedGigId);
    if (!gig) return;
    const lat = Number(gig.approx_latitude ?? gig.location?.latitude);
    const lng = Number(gig.approx_longitude ?? gig.location?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // Don't fly — just ensure the marker is visible
      const map = mapRef.current;
      const point = L.latLng(lat, lng);
      if (!map.getBounds().contains(point)) {
        map.panTo(point, { animate: true, duration: 0.4 });
      }
    }
    setPreview(gig);
    setClusterPreview([]);
  }, [selectedGigId, gigs]);

  return (
    <div className="h-full w-full relative">
      <BaseMap
        center={center}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        onBoundsChange={handleBoundsChange}
        mapRef={mapRef}
        recenterOnChange
      >
        <FitToGigs gigs={gigs} />

        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 2px #3b82f6,0 2px 8px rgba(0,0,0,.25);"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
            interactive={false}
          />
        )}

        {/* Task pins */}
        {animatedPins.map(({ pin, animState }) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={
              pin.isCluster
                ? createClusterPinIcon(pin.count, clusterAnimClass(animState))
                : createCategoryPinIcon(pin.gig?.category, pin.gig?.id === selectedGigId, pinAnimClass(animState))
            }
            eventHandlers={{
              click: () => animState !== 'exiting' && handlePinClick(pin),
            }}
          />
        ))}

        <LocateMeButton className="leaflet-bottom leaflet-right" />
      </BaseMap>

      {/* Task count overlay */}
      <div className="absolute top-2 left-2 z-[1000] bg-app-surface/90 rounded-full px-2.5 py-1 text-[11px] font-semibold text-app-text shadow-sm border border-app-border-subtle">
        {gigs.length} task{gigs.length !== 1 ? 's' : ''}
      </div>

      {/* Pin preview */}
      {preview && !clusterPreview.length && (
        <PinPreview gig={preview} onSelect={onGigSelect} onClose={() => setPreview(null)} />
      )}

      {/* Cluster preview */}
      {clusterPreview.length > 0 && (
        <ClusterPreview
          gigs={clusterPreview}
          onSelect={onGigSelect}
          onClose={() => setClusterPreview([])}
        />
      )}
    </div>
  );
}

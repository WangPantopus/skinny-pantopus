// @ts-nocheck
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import * as api from '@pantopus/api';
import { formatTimeAgo, formatPrice, matchesPriceFilter, gigMatchesFilters, sortGigs } from '@pantopus/ui-utils';
import type { PriceFilterKey, SortKey } from '@pantopus/ui-utils';
import { BaseMap, useCluster, MapProgressBar, boundsChangedSignificantly, useAnimatedPins, pinAnimClass, clusterAnimClass, ZoomGateOverlay, NearestActivityPrompt } from '@/components/map';
import type { Bounds } from '@/components/map';
import type { ClusterPoint } from '@/components/map';
import type { NearestActivityCenter } from '@/components/map';
import type { MapTaskListItem } from '@/components/gig-browse/mapTaskTypes';

// ─── Types ─────────────────────────────────────────────────
type PriceFilter = PriceFilterKey;
type SortOption = SortKey;
export type GigMapPin = MapTaskListItem;

// ─── Marker Icons ──────────────────────────────────────────
function createPriceIcon(price: number | null, active = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${active ? '#0f172a' : '#0284c7'};color:#fff;font-weight:700;font-size:12px;padding:4px 10px;border-radius:14px;border:2px solid ${active ? '#fbbf24' : '#fff'};white-space:nowrap;text-align:center;box-shadow:${active ? '0 10px 20px rgba(15,23,42,0.3)' : '0 6px 14px rgba(2,132,199,0.18)'};transform:${active ? 'scale(1.06)' : 'scale(1)'};">${formatPrice(Number(price) || 0)}</div>`,
    iconSize: [64, 30],
    iconAnchor: [32, 15],
  });
}

function createClusterIcon(count: number, active = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${active ? '#1d4ed8' : '#111827'};color:#fff;font-weight:700;font-size:12px;width:${active ? 36 : 32}px;height:${active ? 36 : 32}px;border-radius:50%;border:2px solid ${active ? '#bfdbfe' : '#fff'};display:flex;align-items:center;justify-content:center;box-shadow:${active ? '0 10px 20px rgba(29,78,216,0.28)' : '0 8px 18px rgba(17,24,39,0.18)'};">${count}</div>`,
    iconSize: [active ? 36 : 32, active ? 36 : 32],
    iconAnchor: [active ? 18 : 16, active ? 18 : 16],
  });
}

// ─── Defaults ──────────────────────────────────────────────
const GIGS_DEFAULT_CENTER: [number, number] = [45.5231, -122.6765]; // Portland/Vancouver metro
const DEFAULT_ZOOM = 10;
const GEOLOCATED_ZOOM = 12;

// ─── Main Component ────────────────────────────────────────
export default function GigsMap({
  searchQuery,
  selectedCategory,
  priceFilter,
  sortOption,
  onGigClick,
  tasksPanelOpen = false,
  onToggleTasksPanel,
  onVisibleGigsChange,
  onLoadingChange,
  activeGigId,
  onPinSelect,
}: GigsMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(GIGS_DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);
  const [pins, setPins] = useState<GigMapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<GigMapPin | null>(null);
  const [selectedClusterGigs, setSelectedClusterGigs] = useState<GigMapPin[]>([]);
  const [nearestActivity, setNearestActivity] = useState<NearestActivityCenter | null>(null);

  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const geolocatedRef = useRef(false);
  const prevFiltersRef = useRef({ searchQuery, selectedCategory, priceFilter, sortOption });

  // Geolocate on mount
  useEffect(() => {
    if (geolocatedRef.current) return;
    geolocatedRef.current = true;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const center: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(center);
          setMapZoom(GEOLOCATED_ZOOM);
        },
        () => {
          // Keep defaults on failure
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Fetch pins for current bounds
  const ZOOM_GATE = 8;
  const fetchPins = useCallback(
    async (bounds: Bounds) => {
      try {
        setLoading(true);
        const result = await api.gigs.getGigsInBounds({
          min_lat: bounds.south,
          max_lat: bounds.north,
          min_lon: bounds.west,
          max_lon: bounds.east,
          status: 'open',
          limit: 200,
        });

        const items = ((result.gigs || []) as GigMapPin[]).filter((gig) => {
          const lat = Number(gig.latitude);
          const lon = Number(gig.longitude);
          return Number.isFinite(lat) && Number.isFinite(lon);
        });

        const filtered = items
          .filter((gig) =>
            gigMatchesFilters(
              {
                title: gig.title,
                description: gig.description,
                category: gig.category || undefined,
              },
              selectedCategory,
              searchQuery
            )
          )
          .filter((gig) => matchesPriceFilter(gig, priceFilter));
        const sorted = sortGigs(filtered, sortOption) as GigMapPin[];

        setPins(sorted);
        setNearestActivity(result.nearest_activity_center ?? null);
        onVisibleGigsChange?.(sorted);
        boundsRef.current = bounds;

        setSelectedPin((prev: GigMapPin | null) => {
          if (!prev) return null;
          return sorted.find((g) => g.id === prev.id) || null;
        });
        setSelectedClusterGigs((prev: GigMapPin[]) => {
          if (!prev.length) return prev;
          const byId = new Set(sorted.map((g) => g.id));
          return prev.filter((g) => byId.has(g.id));
        });
      } catch (err) {
        console.warn('Failed to fetch gig pins:', err);
        setPins([]);
        setNearestActivity(null);
        onVisibleGigsChange?.([]);
      } finally {
        setLoading(false);
      }
    },
    [onVisibleGigsChange, priceFilter, searchQuery, selectedCategory, sortOption]
  );

  // On bounds change from map movement (already debounced 400ms by BaseMap/useMapBounds)
  const handleBoundsChanged = useCallback(
    (bounds: Bounds, zoom: number) => {
      setCurrentBounds(bounds);
      setCurrentZoom(zoom);
      if (!mapReady) {
        boundsRef.current = bounds;
        setMapReady(true);
        if (zoom >= ZOOM_GATE) fetchPins(bounds);
        return;
      }
      boundsRef.current = bounds;
      if (zoom >= ZOOM_GATE) {
        fetchPins(bounds);
      } else {
        setPins([]);
        setNearestActivity(null);
        onVisibleGigsChange?.([]);
      }
    },
    [mapReady, fetchPins, onVisibleGigsChange]
  );

  // When filters change, refetch immediately
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.searchQuery !== searchQuery ||
      prev.selectedCategory !== selectedCategory ||
      prev.priceFilter !== priceFilter ||
      prev.sortOption !== sortOption;
    prevFiltersRef.current = { searchQuery, selectedCategory, priceFilter, sortOption };

    if (changed && boundsRef.current) {
      fetchPins(boundsRef.current);
    }
  }, [searchQuery, selectedCategory, priceFilter, sortOption, fetchPins]);


  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Recenter to user
  const recenter = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const center: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(center);
          setMapZoom(GEOLOCATED_ZOOM);
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Supercluster-based clustering
  const clusteredPins = useCluster(pins, currentZoom, currentBounds);

  // Animated enter/exit transitions
  const animatedPins = useAnimatedPins(clusteredPins);

  // Handle marker click — cluster click zooms to expansion zoom
  const handleMarkerClick = useCallback(
    (pin: ClusterPoint<GigMapPin>) => {
      if (pin.isCluster && pin.items.length > 0) {
        if (mapRef.current && pin.expansionZoom != null) {
          mapRef.current.flyTo([pin.latitude, pin.longitude], pin.expansionZoom, { duration: 0.5 });
        }
        setSelectedClusterGigs(pin.items);
        setSelectedPin(null);
        onPinSelect?.(null);
        return;
      }
      setSelectedPin(pin.item || null);
      setSelectedClusterGigs([]);
      onPinSelect?.(pin.item?.id || null);
    },
    [onPinSelect]
  );

  // Fly to nearest activity center
  const handleFlyToNearest = useCallback((target: NearestActivityCenter) => {
    if (mapRef.current) {
      mapRef.current.flyTo([target.latitude, target.longitude], 12, { duration: 1.2 });
    }
  }, []);

  // Viewport center for NearestActivityPrompt distance calculation
  const viewCenter = currentBounds
    ? { latitude: (currentBounds.south + currentBounds.north) / 2, longitude: (currentBounds.west + currentBounds.east) / 2 }
    : { latitude: mapCenter[0], longitude: mapCenter[1] };

  const belowZoomGate = currentZoom < ZOOM_GATE;

  return (
    <div className="relative w-full h-full">
      <BaseMap
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        onBoundsChange={handleBoundsChanged}
        recenterOnChange
        mapRef={mapRef}
      >
        {animatedPins.map(({ pin, animState }) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={
              pin.isCluster
                ? createClusterIcon(
                    pin.count,
                    Boolean(activeGigId && pin.items.some((gig) => gig.id === activeGigId)),
                    clusterAnimClass(animState),
                  )
                : createPriceIcon(
                    pin.item?.price ?? null,
                    pin.item?.id === activeGigId,
                    pinAnimClass(animState),
                  )
            }
            eventHandlers={{
              click: () => animState !== 'exiting' && handleMarkerClick(pin),
            }}
          />
        ))}
      </BaseMap>

      {/* ── Overlay Controls ── */}

      {/* Top-left: pins count */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        {onToggleTasksPanel && (
          <button
            onClick={onToggleTasksPanel}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-md transition ${
              tasksPanelOpen
                ? 'border-primary-300 bg-primary-600 text-white'
                : 'border-app-border bg-app-surface/95 text-app-text hover:bg-app-hover'
            }`}
            title={tasksPanelOpen ? 'Hide tasks in this area' : 'Show tasks in this area'}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span>Tasks</span>
          </button>
        )}
        <div className="flex items-center gap-2 rounded-full bg-app-surface/95 px-3 py-2 shadow-md text-sm font-semibold text-app-text">
          <span>💼</span>
          <span>{pins.length} tasks in this area</span>
        </div>
      </div>

      {/* Top-right: recenter + add */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => onGigClick('new')}
          className="w-10 h-10 rounded-full bg-app-surface/95 shadow-md flex items-center justify-center hover:bg-app-hover transition text-lg"
          title="Post Task"
        >
          +
        </button>
        <button
          onClick={recenter}
          className="w-10 h-10 rounded-full bg-app-surface/95 shadow-md flex items-center justify-center hover:bg-app-hover transition"
          title="Recenter"
        >
          <svg className="w-5 h-5 text-app-text-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>

      {/* Top progress bar — replaces the old spinner overlay */}
      <MapProgressBar visible={loading} />

      {/* Zoom gate overlay */}
      <ZoomGateOverlay visible={belowZoomGate && mapReady} contentLabel="tasks" />

      {/* Nearest activity prompt (when results are empty and zoom is adequate) */}
      {!loading && !belowZoomGate && pins.length === 0 && mapReady && (
        <NearestActivityPrompt
          viewCenter={viewCenter}
          nearest={nearestActivity}
          contentLabel="tasks"
          onFlyTo={handleFlyToNearest}
        />
      )}

      {/* Cluster preview cards */}
      {!tasksPanelOpen && selectedClusterGigs.length > 1 && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] mx-auto w-[min(96%,720px)] bg-app-surface rounded-xl p-3 shadow-lg border border-app-border">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-app-text">{selectedClusterGigs.length} tasks in this area</p>
            <button
              onClick={() => setSelectedClusterGigs([])}
              className="text-app-text-muted hover:text-app-text-secondary text-lg leading-none"
              aria-label="Close task previews"
            >
              &times;
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {selectedClusterGigs.map((gig) => (
              <button
                key={gig.id}
                onClick={() => onGigClick(String(gig.id))}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-left hover:bg-app-hover transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-app-text line-clamp-1">{gig.title}</p>
                  <span className="text-sm font-bold text-green-600 whitespace-nowrap">{formatPrice(Number(gig.price) || 0)}</span>
                </div>
                <p className="mt-1 text-xs text-app-text-secondary">
                  {gig.category || 'General'} &middot; {gig.created_at ? formatTimeAgo(String(gig.created_at)) : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Single pin preview card */}
      {!tasksPanelOpen && selectedPin && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-app-surface rounded-xl p-4 shadow-lg max-w-md mx-auto">
          <button
            onClick={() => {
              setSelectedPin(null);
              setSelectedClusterGigs([]);
            }}
            className="absolute top-2 right-2 text-app-text-muted hover:text-app-text-secondary text-lg"
          >
            &times;
          </button>
          <div className="flex items-start justify-between gap-3 pr-6">
            <h3 className="font-bold text-app-text truncate">{selectedPin.title}</h3>
            <span className="text-green-600 font-bold text-lg whitespace-nowrap">
              {formatPrice(Number(selectedPin.price) || 0)}
            </span>
          </div>
          <p className="text-xs text-app-text-secondary mt-1">
            {selectedPin.category || 'General'} &middot; {selectedPin.created_at ? formatTimeAgo(String(selectedPin.created_at)) : ''}
          </p>
          <button
            onClick={() => onGigClick(String(selectedPin.id))}
            className="mt-3 w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary-700 transition"
          >
            Open Task &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

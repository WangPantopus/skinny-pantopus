// @ts-nocheck
'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { TILE_URL, TILE_ATTRIBUTION } from '@/components/map/constants';
import { boundsChangedSignificantly, type Bounds } from '@/components/map';
import { ZoomGateOverlay } from '@/components/map/ZoomGateOverlay';
import { NearestActivityPrompt, type NearestActivityCenter } from '@/components/map/NearestActivityPrompt';
import { Store, Camera } from 'lucide-react';
import Image from 'next/image';
import { formatTimeAgo } from '@pantopus/ui-utils';
import type { Listing } from '@pantopus/api';

// ── Leaflet icon fix ─────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, any>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

// ── Types ────────────────────────────────────────────────────
import { useCluster } from '@/components/map';
import type { ClusterPoint } from '@/components/map';

type Bounds = { south: number; west: number; north: number; east: number };

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

// ── Layer colors for pin coloring ────────────────────────────
const LAYER_COLORS: Record<string, string> = {
  goods: '#7c3aed',     // purple
  gigs: '#f97316',      // orange
  rentals: '#16a34a',   // green
  vehicles: '#dc2626',  // red
};

// ── Leaflet divIcon factories ────────────────────────────────
function makePriceIcon(listing: Listing, isSelected: boolean): L.DivIcon {
  const isFree = listing?.is_free;
  const isWanted = listing?.is_wanted;
  const price = Number(listing?.price || 0);
  const label = isWanted ? 'WANTED' : isFree ? 'FREE' : `$${price.toFixed(0)}`;
  const layerColor = listing?.layer ? (LAYER_COLORS[listing.layer] || '#7c3aed') : '#7c3aed';
  const bg = isFree ? '#16a34a' : isWanted ? '#d97706' : layerColor;
  const trusted = listing?.is_address_attached;
  const scale = isSelected ? 'scale(1.2)' : '';
  const zIndex = isSelected ? 'z-index: 100;' : '';
  const ring = isSelected ? 'box-shadow: 0 0 0 3px #3b82f6, 0 2px 8px rgba(0,0,0,.25);' : 'box-shadow: 0 2px 8px rgba(0,0,0,.25);';

  const html = `<div style="
    transform: translate(-50%, -50%) ${scale};
    padding: 4px 10px;
    border-radius: 9999px;
    background: ${bg};
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    ${ring}
    border: 2px solid ${trusted ? '#22c55e' : '#fff'};
    cursor: pointer;
    user-select: none;
    ${zIndex}
    transition: transform 0.15s ease;
  ">${label}</div>`;

  return L.divIcon({ html, className: 'marketplace-price-marker', iconSize: [1, 1], iconAnchor: [0, 0] });
}

function makeClusterIcon(count: number): L.DivIcon {
  const size = count >= 50 ? 48 : count >= 10 ? 40 : 34;
  const html = `<div style="
    transform: translate(-50%, -50%);
    width: ${size}px;
    height: ${size}px;
    border-radius: 9999px;
    background: #374151;
    color: #fff;
    font-size: ${count >= 100 ? 11 : 13}px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.3);
    border: 2px solid #fff;
    cursor: pointer;
    user-select: none;
  ">${count}</div>`;

  return L.divIcon({ html, className: 'marketplace-cluster-marker', iconSize: [1, 1], iconAnchor: [0, 0] });
}

// ── Map event watchers ───────────────────────────────────────
function MapEvents({
  onMoveEnd,
}: {
  onMoveEnd: (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => void;
}) {
  useMapEvents({
    moveend(e) {
      const map = e.target;
      onMoveEnd(map.getBounds(), map.getCenter(), map.getZoom());
    },
  });
  return null;
}

function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function FlyToCenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!center) return;
    const key = `${center[0]},${center[1]}`;
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.flyTo(center, 13, { duration: 1 });
  }, [center, map]);
  return null;
}

function FitBoundsControl({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bounds) return;
    const key = bounds.toBBoxString();
    if (prevRef.current === key) return;
    prevRef.current = key;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────
interface MarketplaceMapProps {
  /** Shared listings from parent — same array rendered in grid */
  listings: Listing[];
  /** Currently selected listing ID (e.g., from grid hover) */
  selectedId: string | null;
  /** Callback when map bounds change after user pan/zoom */
  onBoundsChange: (bounds: Bounds) => void;
  /** Callback when user clicks a listing pin */
  onListingSelect: (id: string | null) => void;
  /** Loading state from parent */
  loading: boolean;
  /** User location for initial center */
  userLocation: { latitude: number; longitude: number } | null;
  /** UI callbacks */
  onOpenCategoryModal: () => void;
  onOpenCreateModal: () => void;
  /** Total listings count in current bounds */
  totalCount?: number;
  /** Save toggle — owned by parent so grid + map share the same state */
  onSave?: (listingId: string) => void;
  /** Nearest activity center for empty viewport snap-to */
  nearestActivityCenter?: NearestActivityCenter | null;
}

// ── Main component ───────────────────────────────────────────
export default function MarketplaceMap({
  listings,
  selectedId,
  onBoundsChange,
  onListingSelect,
  loading,
  userLocation,
  onOpenCategoryModal,
  onOpenCreateModal,
  totalCount,
  onSave,
  nearestActivityCenter,
}: MarketplaceMapProps) {
  const router = useRouter();

  // Local UI state
  const [selectedPin, setSelectedPin] = useState<Listing | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<Listing[]>([]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [fitTarget, setFitTarget] = useState<L.LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Map zoom + bounds for supercluster
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState<Bounds | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (userLocation) return [userLocation.latitude, userLocation.longitude];
    return [45.5152, -122.6784];
  }, [userLocation]);

  // Debounce bounds changes to avoid rapid-fire fetches
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const initialBoundsReported = useRef(false);

  // ── Supercluster-based clustering ───────────────────────────
  const clusteredPins = useCluster(listings, mapZoom, mapBounds);

  // ── Build icons (rebuild when selection changes) ────────────
  const iconMap = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    for (const pin of clusteredPins) {
      const isSelected = !pin.isCluster && pin.item?.id === selectedId;
      m.set(pin.id, pin.isCluster ? makeClusterIcon(pin.count) : makePriceIcon(pin.item!, isSelected));
    }
    return m;
  }, [clusteredPins, selectedId]);

  // ── Map event handlers ─────────────────────────────────────
  const handleMoveEnd = useCallback((leafletBounds: L.LatLngBounds, _leafletCenter: L.LatLng, zoom: number) => {
    const b: Bounds = {
      south: leafletBounds.getSouth(),
      west: leafletBounds.getWest(),
      north: leafletBounds.getNorth(),
      east: leafletBounds.getEast(),
    };

    // Update zoom + bounds for supercluster
    setMapZoom(zoom);
    setMapBounds(b);

    setMapReady(true);
    setSelectedPin(null);
    setSelectedCluster([]);

    // Debounce bounds → parent (400ms after pan/zoom stops)
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    if (!initialBoundsReported.current) {
      // First bounds report: immediate
      initialBoundsReported.current = true;
      lastBoundsRef.current = b;
      onBoundsChange(b);
    } else if (boundsChangedSignificantly(lastBoundsRef.current, b)) {
      boundsTimerRef.current = setTimeout(() => {
        lastBoundsRef.current = b;
        onBoundsChange(b);
      }, 400);
    }
  }, [onBoundsChange]);

  // Cleanup timer
  useEffect(() => {
    return () => { if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current); };
  }, []);

  // ── Actions ────────────────────────────────────────────────
  const recenterToMe = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {}
    );
  }, []);

  const fitAllPins = useCallback(() => {
    if (listings.length === 0) return;
    const coords = listings
      .map(l => [Number(l.latitude), Number(l.longitude)] as [number, number])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
    setFitTarget(bounds);
  }, [listings]);

  const fitCluster = useCallback((clusterListings: Listing[]) => {
    const coords = clusterListings
      .map((l) => [Number(l.latitude), Number(l.longitude)] as [number, number])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
    setFitTarget(bounds);
  }, []);

  const handleMarkerClick = useCallback((pin: ClusterPoint<Listing>) => {
    if (pin.isCluster) {
      setSelectedPin(null);
      setSelectedCluster(pin.items);
      // Zoom to expansion zoom on cluster click
      if (mapRef.current && pin.expansionZoom != null) {
        mapRef.current.flyTo([pin.latitude, pin.longitude], pin.expansionZoom, { duration: 0.5 });
      } else {
        fitCluster(pin.items);
      }
      onListingSelect(null);
    } else {
      setSelectedCluster([]);
      setSelectedPin(pin.item || null);
      onListingSelect(pin.item?.id || null);
    }
  }, [fitCluster, onListingSelect]);

  const handleSave = (listingId: string) => {
    if (onSave) onSave(listingId);
  };

  const displayCount = totalCount ?? listings.length;

  // ── Zoom gate + nearest activity ───────────────────────────
  const ZOOM_GATE = 8;
  const belowZoomGate = mapZoom < ZOOM_GATE;
  const viewCenter = mapBounds
    ? { latitude: (mapBounds.south + mapBounds.north) / 2, longitude: (mapBounds.west + mapBounds.east) / 2 }
    : center
      ? { latitude: center[0], longitude: center[1] }
      : { latitude: 45.5152, longitude: -122.6784 };
  const showNearestPrompt = !loading && !belowZoomGate && listings.length === 0 && mapReady;

  const handleFlyToNearest = useCallback((target: NearestActivityCenter) => {
    mapRef.current?.flyTo([target.latitude, target.longitude], 12, { duration: 1.2 });
  }, []);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full min-h-[400px]">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />

        <MapRefSetter mapRef={mapRef} />
        <MapEvents onMoveEnd={handleMoveEnd} />
        <FlyToCenter center={flyTarget} />
        <FitBoundsControl bounds={fitTarget} />

        {clusteredPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={iconMap.get(pin.id)}
            eventHandlers={{ click: () => handleMarkerClick(pin) }}
          />
        ))}

        {/* Blur radius circles for approximate-location listings */}
        {clusteredPins
          .filter((pin) => !pin.isCluster && pin.item && !pin.item.locationUnlocked)
          .map((pin) => (
            <Circle
              key={`blur-${pin.id}`}
              center={[pin.latitude, pin.longitude]}
              radius={500}
              pathOptions={{
                color: '#7c3aed',
                fillColor: '#7c3aed',
                fillOpacity: 0.08,
                weight: 1,
                opacity: 0.25,
                dashArray: '4 4',
              }}
              interactive={false}
            />
          ))}
      </MapContainer>

      {/* ── Overlay controls ─────────────────────────────────── */}

      {/* Category filter — top left */}
      <button
        onClick={onOpenCategoryModal}
        className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-2 bg-app-surface rounded-lg shadow-md border border-app-border text-sm font-medium text-app-text-strong hover:bg-app-hover"
      >
        <svg className="w-3.5 h-3.5 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm2 5a1 1 0 011-1h12a1 1 0 010 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h6a1 1 0 010 2H9a1 1 0 01-1-1z" />
        </svg>
        All Categories
        <svg className="w-3 h-3 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Listing count — top right */}
      <button
        onClick={fitAllPins}
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-2 bg-app-surface rounded-lg shadow-md border border-app-border text-sm font-medium text-app-text-strong hover:bg-app-hover"
      >
        <Store className="w-4 h-4 inline-block" /> {displayCount} listing{displayCount !== 1 ? 's' : ''}
      </button>

      {/* Re-center button — bottom left */}
      <button
        onClick={recenterToMe}
        className="absolute bottom-4 left-3 z-30 w-10 h-10 bg-app-surface rounded-full shadow-md border border-app-border flex items-center justify-center hover:bg-app-hover transition"
        title="Re-center to my location"
      >
        <svg className="w-5 h-5 text-app-text-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* + New Listing FAB — bottom right */}
      <button
        onClick={onOpenCreateModal}
        className="absolute bottom-4 right-3 z-30 w-12 h-12 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-700 transition"
        title="New Listing"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-app-surface/90 rounded-full shadow-md border border-app-border text-sm text-app-text-secondary">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
          Loading listings...
        </div>
      )}

      {/* Empty state: zoom gate or nearest activity prompt */}
      <ZoomGateOverlay visible={belowZoomGate} contentLabel="listings" />

      {showNearestPrompt && (
        <NearestActivityPrompt
          viewCenter={viewCenter}
          nearest={nearestActivityCenter}
          contentLabel="listings"
          onFlyTo={handleFlyToNearest}
        />
      )}

      {/* ── Cluster card stack ─────────────────────────────────── */}
      {selectedCluster.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-app-surface border-t border-app-border shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between px-4 py-2 border-b border-app-border-subtle">
            <span className="text-sm font-semibold text-app-text-strong">
              {selectedCluster.length} listing{selectedCluster.length !== 1 ? 's' : ''} in this cluster
            </span>
            <button
              onClick={() => setSelectedCluster([])}
              className="text-app-text-muted hover:text-app-text-secondary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex overflow-x-auto gap-3 px-4 py-3 snap-x snap-mandatory">
            {selectedCluster.map((item: Listing) => {
              const thumb = item.media_urls?.[0];
              const name = (item as any).creator?.name || (item as any).creator?.username || 'Seller';
              const creatorUsername = (item as any).creator?.username as string | undefined;
              const profileHref = creatorUsername ? `/${creatorUsername}` : null;
              return (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-56 snap-start bg-app-surface-raised border border-app-border rounded-lg p-3 cursor-pointer hover:shadow-md transition"
                  onClick={() => router.push(`/app/marketplace/${item.id}`)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {thumb ? (
                      <Image src={thumb} alt="" width={40} height={40} sizes="40px" quality={75} className="rounded-md object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-app-surface-sunken flex items-center justify-center text-app-text-muted"><Camera className="w-4 h-4" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app-text truncate">{item.title}</p>
                      <p className="text-xs font-bold text-purple-600">
                        {item.is_free ? 'FREE' : `$${Number(item.price || 0).toFixed(0)}`}
                      </p>
                    </div>
                  </div>
                  {item.condition && (
                    <span className="inline-block px-1.5 py-0.5 bg-app-surface-sunken text-app-text-secondary text-[10px] rounded mb-1">
                      {CONDITION_LABELS[item.condition] || item.condition}
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        onClick={(event) => event.stopPropagation()}
                        className="text-[10px] text-app-text-muted"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="text-[10px] text-app-text-muted">{name}</span>
                    )}
                    <span className="text-[10px] text-primary-600 font-medium">Tap for details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Single listing preview card ────────────────────────── */}
      {selectedPin && selectedCluster.length === 0 && (
        <div className="absolute bottom-4 left-3 right-3 z-20 bg-app-surface rounded-xl shadow-lg border border-app-border overflow-hidden">
          <div
            className="flex items-center gap-3 p-3 cursor-pointer"
            onClick={() => router.push(`/app/marketplace/${selectedPin.id}`)}
          >
            {/* Thumbnail */}
            {selectedPin.media_urls?.[0] ? (
              <Image src={selectedPin.media_urls[0]} alt="" width={64} height={64} sizes="64px" quality={75} className="rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-app-surface-sunken flex items-center justify-center text-gray-300 flex-shrink-0"><Camera className="w-6 h-6" /></div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text truncate">{selectedPin.title}</p>
              <p className="text-sm font-bold text-purple-600">
                {selectedPin.is_free ? 'FREE' : selectedPin.price != null ? `$${Number(selectedPin.price).toFixed(0)}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedPin.condition && (
                  <span className="px-1.5 py-0.5 bg-app-surface-sunken text-app-text-secondary text-[10px] rounded">
                    {CONDITION_LABELS[selectedPin.condition] || selectedPin.condition}
                  </span>
                )}
                <span className="text-[10px] text-app-text-muted">{formatTimeAgo(selectedPin.created_at)}</span>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleSave(selectedPin.id); }}
              className="w-8 h-8 rounded-full bg-app-surface-raised flex items-center justify-center hover:bg-app-hover flex-shrink-0"
            >
              {(selectedPin as any).userHasSaved ? (
                <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              )}
            </button>
          </div>

          {/* View Listing button */}
          <button
            onClick={() => router.push(`/app/marketplace/${selectedPin.id}`)}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition"
          >
            View Listing
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as api from '@pantopus/api';
import {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User,
  Heart, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPostTypeConfig, POST_TYPE_ICONS_LUCIDE, type PostTypeConfig } from '@pantopus/ui-utils';
import type { FeedSurface, MapMarker, PostType } from '@pantopus/api';
import { BaseMap, MapSkeleton, useCluster, useAnimatedPins, useMapBounds, pinAnimClass, clusterAnimClass, ZoomGateOverlay, NearestActivityPrompt, RETINA_TILE_URL } from '@/components/map';
import type { Bounds } from '@/components/map';
import type { ClusterPoint } from '@/components/map/useCluster';
import type { NearestActivityCenter } from '@/components/map';
import { useReducedMotion } from '@/components/scheduling/polish/a11y';
import { chosenUsername } from '@pantopus/utils';
import { MAP_FILTERS } from './pulseMapFilters';
import { PIN_SIZE, clusterLabel, clusterSize, liveMarkerIds, pinLabel, pulseClusterHtml, pulsePinHtml } from './pulseMapPins';
import { viewMovedSignificantly, type PulseCamera, type PulseMarker, type PulseView } from './pulseMapView';

// The 3D map (mapbox-gl and its CSS) loads only here, when it's used. If its code can't be
// fetched, the flat map takes over.
function GlMapUnavailable({ onUnavailable }: { onUnavailable: (reason: string) => void }) {
  useEffect(() => onUnavailable('chunk'), [onUnavailable]);
  return <MapSkeleton />;
}
const PulseGlMap = dynamic(
  () => import('./PulseGlMap').catch(() => ({ default: GlMapUnavailable })),
  { ssr: false, loading: () => <MapSkeleton /> },
);

/** Mapbox's public token: the 3D map needs it (the flat map's tiles do too). */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/** WebGL 2, which the 3D map needs (mapboxgl.supported() checks the GPU once it has loaded). */
function webGl2Present(): boolean {
  return typeof window !== 'undefined' && typeof window.WebGL2RenderingContext !== 'undefined';
}

// Chip text on the map's own surfaces follows the theme: the palette's `textColor`
// in light mode and `darkTextColor` in dark mode (inline colors can't reach `dark:`).
const POST_TYPE_THEMED_TEXT = 'text-[color:var(--post-type-text)] dark:text-[color:var(--post-type-text-dark)]';
const postTypeTextVars = (config: PostTypeConfig) =>
  ({ '--post-type-text': config.textColor, '--post-type-text-dark': config.darkTextColor }) as CSSProperties;

// ─── Lucide icon lookup ─────────────────────────────────────
const LUCIDE_MAP: Record<string, LucideIcon> = {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User,
};
function getTypeReactIcon(type: string): LucideIcon {
  const name = POST_TYPE_ICONS_LUCIDE[type] || 'Pencil';
  return LUCIDE_MAP[name] || Pencil;
}

function MapPostPopupCard({
  pin,
  onClose,
  onViewPost,
}: {
  pin: MapMarker;
  onClose: () => void;
  onViewPost: (postId: string) => void;
}) {
  const config = getPostTypeConfig(pin.post_type || 'general');
  const TypeIcon = getTypeReactIcon(pin.post_type || 'general');
  const author = pin.creator?.name || chosenUsername(pin.creator?.username) || 'Neighbor';
  const snippet = (pin.content || pin.title || 'No content yet').trim();

  return (
    <div className="feed-map-popup-card">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onViewPost(pin.id)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${POST_TYPE_THEMED_TEXT}`}
              style={{
                background: `${config.color}15`,
                ...postTypeTextVars(config),
              }}
            >
              <TypeIcon className="h-3 w-3" />
              {config.label}
            </span>
            {pin.location_name && (
              <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {pin.location_name}
              </span>
            )}
          </div>

          <div className="mt-2 text-xs font-semibold text-slate-950 dark:text-slate-50">
            {author}
          </div>
          <p className="mt-1 line-clamp-4 text-[13px] font-medium leading-5 text-slate-800 dark:text-slate-100">
            {snippet}
          </p>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {pin.like_count != null && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <Heart className="h-3 w-3" />
            {pin.like_count}
          </span>
        )}
        {pin.comment_count != null && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <MessageCircle className="h-3 w-3" />
            {pin.comment_count}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onViewPost(pin.id)}
          className="rounded-xl bg-primary-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-primary-700"
        >
          View details
        </button>
      </div>
    </div>
  );
}

// ─── Leaflet divIcons (pins and clusters: ./pulseMapPins.ts) ─
function makePostDivIcon(html: string, animCls: string) {
  return L.divIcon({
    html,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    className: animCls,
  });
}

function makeClusterDivIcon(html: string, count: number, animCls: string) {
  const size = clusterSize(count);
  return L.divIcon({
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: animCls,
  });
}

// ─── A person's drag of the map, for the header's quick return ───
// Leaflet fires drag events only for a pointer pan: not for wheel or pinch zoom, and not for the
// map's own moves (flyTo, fitBounds, popup auto-pan, inertia).
function PanWatcher({ onStart, onMove }: { onStart?: () => void; onMove?: (dx: number, dy: number) => void }) {
  const anchor = useRef<{ latlng: L.LatLng; point: L.Point } | null>(null);
  const map = useMapEvents({
    dragstart: () => {
      const latlng = map.getCenter();
      anchor.current = { latlng, point: map.latLngToContainerPoint(latlng) };
      onStart?.();
    },
    drag: () => {
      const a = anchor.current;
      if (!a) return;
      // Where a fixed spot on the map moved on screen: the content's movement.
      const point = map.latLngToContainerPoint(a.latlng);
      onMove?.(point.x - a.point.x, point.y - a.point.y);
      a.point = point;
    },
    dragend: () => {
      anchor.current = null;
    },
  });
  return null;
}

// ─── The flat map's view and camera, in the shape both renderers share ───
function leafletView(map: L.Map, bounds?: Bounds, zoom?: number): PulseView {
  const b = map.getBounds();
  const c = map.getCenter();
  const size = map.getSize();
  return {
    bounds: bounds ?? { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
    zoom: zoom ?? map.getZoom(),
    center: { lat: c.lat, lng: c.lng },
    size: { w: size.x, h: size.y },
  };
}

function leafletCamera(map: L.Map | null): PulseCamera | null {
  if (!map) return null;
  return {
    flyTo: (lat, lng, zoom, durationSec, onEnd) => {
      map.flyTo([lat, lng], zoom, { duration: durationSec });
      // Listen after flyTo: stopping a pan still in progress fires moveend at once.
      if (onEnd) map.once('moveend', () => onEnd(leafletView(map)));
    },
    fitBounds: (b, paddingPx) => {
      map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [paddingPx, paddingPx] });
    },
  };
}

/** Reports the flat map's view once it settles (debounced, small moves ignored), and on open. */
function LeafletViewWatcher({ onView }: { onView: (view: PulseView) => void }) {
  const map = useMap();
  useMapBounds((bounds, zoom) => onView(leafletView(map, bounds, zoom)), 400);
  return null;
}

// ═══════════════════════════════════════════════════════════════
// FEED MAP COMPONENT
// ═══════════════════════════════════════════════════════════════

interface FeedMapProps {
  postTypeFilter: string;
  onFilterChange?: (filter: string) => void;
  surface: FeedSurface;
  userLat: number | null;
  userLng: number | null;
  onUseCurrentLocation?: (coords?: { latitude: number; longitude: number }) => void;
  onViewPost: (postId: string) => void;
  /** The Pulse header's slot for the map's intent chips and post count: they're header items and
   *  move with it. Without one they float at the map's top. */
  headerSlot?: HTMLElement | null;
  /** Where the map's free area starts (px from its top: the header's bottom edge, or the reveal
   *  capsule's). "Search this area" and the other top pills sit 12 px below it. */
  topInset?: number;
  /** A person's drag of the map: the content moved by (dx, dy) screen px. */
  onUserPanStart?: () => void;
  onUserPan?: (dx: number, dy: number) => void;
}

export default function FeedMap({
  postTypeFilter,
  onFilterChange,
  surface,
  userLat,
  userLng,
  onUseCurrentLocation,
  onViewPost,
  headerSlot,
  topInset = 44,
  onUserPanStart,
  onUserPan,
}: FeedMapProps) {
  const isPlaceSurface = surface === 'place';
  const [pins, setPins] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);
  const [clusterPosts, setClusterPosts] = useState<MapMarker[]>([]);
  // The map's settled view (bounds, zoom, centre, size).
  const [view, setView] = useState<PulseView | null>(null);
  const bounds = view?.bounds ?? null;
  const zoom = view?.zoom ?? 13;
  // The view the pins were read for (none before the first read or below the zoom gate).
  const [searched, setSearched] = useState<PulseView | null>(null);
  const [nearestActivity, setNearestActivity] = useState<NearestActivityCenter | null>(null);
  const reducedMotion = useReducedMotion();

  // The 3D map (Mapbox GL, Standard style) where it can run; the flat Leaflet map otherwise.
  const [renderer, setRenderer] = useState<'3d' | 'flat'>(() => (MAPBOX_TOKEN && webGl2Present() ? '3d' : 'flat'));
  const rendererRef = useRef(renderer);
  rendererRef.current = renderer;
  const glCamera = useRef<PulseCamera | null>(null);
  const handleGlUnavailable = useCallback((reason: string) => {
    if (rendererRef.current !== '3d') return;
    console.warn(`[pulse-map] 3D map unavailable (${reason}); showing the flat map.`);
    glCamera.current = null;
    // The flat map's first view reads its posts.
    setView(null);
    setSearched(null);
    setRenderer('flat');
  }, []);

  // Derive map filter directly from the shared postTypeFilter prop — single source of truth
  const mapFilter = isPlaceSurface ? postTypeFilter : 'all';
  // The surface and filter the pins were read with.
  const [readWith, setReadWith] = useState(`${surface}:${mapFilter}`);

  const mapRef = useRef<L.Map | null>(null);
  const requestGeneration = useRef(0);
  const camera = useCallback(
    (): PulseCamera | null => (rendererRef.current === '3d' ? glCamera.current : leafletCamera(mapRef.current)),
    [],
  );

  const center: [number, number] = useMemo(
    () => [userLat ?? 40.7128, userLng ?? -74.006],
    [userLat, userLng]
  );

  // ─── Fetch pins ──────────────────────────────────────────
  const ZOOM_GATE = 8;
  const fetchPins = useCallback(async (currentBounds: Bounds | null) => {
    if (!currentBounds) return;
    const requestId = ++requestGeneration.current;
    const token = api.getAuthToken();
    const isCurrent = () => requestId === requestGeneration.current && token === api.getAuthToken();
    setLoading(true);
    try {
      const res = await api.posts.getMapMarkers({
        south: currentBounds.south,
        west: currentBounds.west,
        north: currentBounds.north,
        east: currentBounds.east,
        postType: isPlaceSurface && mapFilter !== 'all' ? mapFilter as PostType : undefined,
        surface,
        limit: 200,
      });
      if (!isCurrent()) return;
      const postPins = (res.markers || []).filter(
        (m) => m.layer_type === 'post' || !m.layer_type
      );
      setError(false);
      setPins(postPins);
      setNearestActivity(res.nearest_activity_center ?? null);
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [isPlaceSurface, mapFilter, surface]);

  // Read the searched view, and read it again when the filter or surface changes
  const searchedBounds = searched?.bounds ?? null;
  useEffect(() => {
    if (searchedBounds) fetchPins(searchedBounds);
    const requests = requestGeneration;
    return () => { requests.current++; };
  }, [searchedBounds, fetchPins]);

  // The map's own moves (to the viewing area, My location or the nearest activity) read the posts
  // where they land, so they never show "Search this area".
  const flyToAndSearch = useCallback((target: [number, number], targetZoom: number, duration: number) => {
    camera()?.flyTo(target[0], target[1], targetZoom, duration, (landed) => {
      setView(landed);
      if (landed.zoom >= ZOOM_GATE) setSearched(landed);
    });
  }, [camera]);

  useEffect(() => {
    if (userLat == null || userLng == null) return;
    flyToAndSearch([userLat, userLng], 13, 0.8);
  }, [userLat, userLng, flyToAndSearch]);

  // ─── Clustered pins (Supercluster) ─────────────────────
  const clusteredPins = useCluster(pins, zoom, bounds);

  // Animated enter/exit transitions
  const animatedPins = useAnimatedPins(clusteredPins);

  // Posts from the last 24 hours wear a "live" halo (the newest 20).
  const liveIds = useMemo(() => liveMarkerIds(pins), [pins]);

  // ─── Map events ──────────────────────────────────────────
  // As in the iOS and Android apps, moving the map doesn't read its posts: a move off the
  // searched view shows "Search this area" instead.
  const handleViewChange = useCallback((next: PulseView) => {
    setView(next);
    if (next.zoom < ZOOM_GATE) {
      // Too far out for posts: drop the read, so zooming back in reads the view again.
      requestGeneration.current++;
      setSearched(null);
      setPins([]);
      setNearestActivity(null);
      setError(false);
      setLoading(false);
      return;
    }
    // The first view (and the first one back past the zoom gate) reads its posts.
    setSearched((current) => current ?? next);
  }, []);

  const belowZoomGate = zoom < ZOOM_GATE;
  // Centre and zoom, so tilting or turning the 3D map doesn't count as moving it.
  const mapDirty = !!view && !!searched && viewMovedSignificantly(searched, view);

  // A new surface or filter reads the view on screen, as in the apps. Adjusted while rendering,
  // so the read above runs once, with the new filter and the new view together.
  if (readWith !== `${surface}:${mapFilter}`) {
    setReadWith(`${surface}:${mapFilter}`);
    if (mapDirty) setSearched(view);
  }

  // Reads the posts for the view on screen (new bounds, so the same view reads again).
  const searchView = () => {
    if (view && !belowZoomGate) setSearched({ ...view, bounds: { ...view.bounds } });
  };

  const handleSearchArea = () => {
    searchView();
    setSelectedPin(null);
    setClusterPosts([]);
  };

  const handleRecenter = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        flyToAndSearch([latitude, longitude], 14, 1);
        onUseCurrentLocation?.({ latitude, longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFitAll = () => {
    if (pins.length === 0) return;
    const lats = pins.map((p) => p.latitude).filter(Boolean) as number[];
    const lngs = pins.map((p) => p.longitude).filter(Boolean) as number[];
    if (lats.length === 0) return;
    camera()?.fitBounds({
      south: Math.min(...lats), west: Math.min(...lngs),
      north: Math.max(...lats), east: Math.max(...lngs),
    }, 40);
  };

  // ─── Pin click handlers ──────────────────────────────────
  const handleMarkerClick = useCallback((cp: ClusterPoint<MapMarker>) => {
    if (cp.isCluster) {
      if (cp.expansionZoom != null) camera()?.flyTo(cp.latitude, cp.longitude, cp.expansionZoom, 0.5);
      setClusterPosts(cp.items);
      setSelectedPin(null);
      return;
    }
    setSelectedPin(cp.item || null);
    setClusterPosts([]);
  }, [camera]);

  // ─── Derived ─────────────────────────────────────────────
  // The pins stay where they were read, so a move can leave some of them out of view.
  const postCount = bounds
    ? pins.filter((p) => p.latitude >= bounds.south && p.latitude <= bounds.north
      && p.longitude >= bounds.west && p.longitude <= bounds.east).length
    : pins.length;
  const authorName = (p: MapMarker) => p.creator?.name || chosenUsername(p.creator?.username) || 'Neighbor';
  const postType = (p: MapMarker) => p.post_type || 'general';

  // The camera's centre (a tilted map's bounds aren't centred on it).
  const viewCenter = view
    ? { latitude: view.center.lat, longitude: view.center.lng }
    : { latitude: center[0], longitude: center[1] };

  const handleFlyToNearest = useCallback((target: NearestActivityCenter) => {
    flyToAndSearch([target.latitude, target.longitude], 12, 1.2);
  }, [flyToAndSearch]);

  // Each pin's and cluster's look, for either map.
  const pinLooks = animatedPins.map(({ pin: cp, animState }) => {
    const selected = !cp.isCluster && !!cp.item && selectedPin?.id === cp.item.id;
    const live = cp.items.some((item) => !!item && liveIds.has(item.id));
    const html = cp.isCluster
      ? pulseClusterHtml(cp.count, cp.items, { live })
      : pulsePinHtml(cp.item!, { selected, live });
    const animCls = cp.isCluster ? clusterAnimClass(animState) : pinAnimClass(animState);
    return { cp, animState, html, animCls, selected };
  });

  // Flat map: marker icons are kept while their look is unchanged. Leaflet redraws a marker given
  // a new icon, which would restart its halo and pop every cluster on each render of the screen.
  const iconCache = useRef(new Map<string, L.DivIcon>());
  const nextIcons = new Map<string, L.DivIcon>();
  const markers = renderer === 'flat' ? pinLooks.map((look) => {
    const { cp, html, animCls } = look;
    const key = `${cp.id}|${animCls}|${html}`;
    const icon = iconCache.current.get(key) ?? nextIcons.get(key)
      ?? (cp.isCluster ? makeClusterDivIcon(html, cp.count, animCls) : makePostDivIcon(html, animCls));
    nextIcons.set(key, icon);
    return { ...look, icon };
  }) : [];
  iconCache.current = nextIcons;

  // 3D map: the same pins on GL markers (it redraws one only when its look changes).
  const glMarkers: PulseMarker[] = renderer === '3d' ? pinLooks.map(({ cp, animState, html, animCls, selected }) => ({
    id: cp.id,
    lat: cp.latitude,
    lng: cp.longitude,
    html,
    label: cp.isCluster ? clusterLabel(cp.count) : pinLabel(cp.item!),
    animCls,
    selected,
    exiting: animState === 'exiting',
  })) : [];
  const pinLooksRef = useRef(pinLooks);
  pinLooksRef.current = pinLooks;
  const handleGlMarkerClick = useCallback((id: string) => {
    const look = pinLooksRef.current.find((l) => l.cp.id === id);
    if (look && look.animState !== 'exiting') handleMarkerClick(look.cp);
  }, [handleMarkerClick]);
  const handlePopupClosed = useCallback((pinId: string) => {
    setSelectedPin((current) => (current?.id === pinId ? null : current));
  }, []);
  const popupPin = selectedPin && !clusterPosts.length && selectedPin.latitude != null && selectedPin.longitude != null
    ? selectedPin
    : null;

  // The intent chips and the post count: a row of the Pulse header in Map mode.
  const chipsRow = (
    <div className="pointer-events-none mx-auto flex max-w-2xl items-start gap-2 px-3 pt-3">
      {isPlaceSurface && (
        <div className="pointer-events-auto flex min-w-0 gap-1.5 overflow-x-auto scrollbar-hide">
          {MAP_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange?.(f.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shadow-md transition ${
                mapFilter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-app-surface/95 backdrop-blur text-app-muted border border-app hover-bg-app'
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Post count badge: fits the map to every post */}
      <button
        onClick={handleFitAll}
        className="pointer-events-auto ml-auto shrink-0 bg-app-surface/95 backdrop-blur text-app text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md border border-app hover-bg-app transition"
      >
        {error && pins.length === 0 ? 'Unavailable' : `${postCount} in view`}
      </button>
    </div>
  );

  return (
    <div className="relative w-full h-full">
      {renderer === '3d' ? (
        <PulseGlMap
          token={MAPBOX_TOKEN}
          center={center}
          zoom={13}
          markers={glMarkers}
          onMarkerClick={handleGlMarkerClick}
          popupPin={popupPin}
          renderPopup={(pin) => (
            <MapPostPopupCard pin={pin} onClose={() => setSelectedPin(null)} onViewPost={onViewPost} />
          )}
          onPopupClosed={handlePopupClosed}
          // Open below the header (or its capsule) and the "Search this area" pill.
          popupTopPadding={topInset + 56}
          onView={handleViewChange}
          onUserPanStart={onUserPanStart}
          onUserPan={onUserPan}
          cameraRef={glCamera}
          onUnavailable={handleGlUnavailable}
          reducedMotion={reducedMotion}
        />
      ) : (
        <BaseMap
          center={center}
          zoom={13}
          mapRef={mapRef}
          tileUrl={RETINA_TILE_URL}
        >
          <LeafletViewWatcher onView={handleViewChange} />
          <PanWatcher onStart={onUserPanStart} onMove={onUserPan} />
          {markers.map(({ cp, animState, icon, selected }) => (
            <Marker
              key={cp.id}
              position={[cp.latitude, cp.longitude]}
              icon={icon}
              zIndexOffset={selected ? 1000 : 0}
              eventHandlers={{ click: () => animState !== 'exiting' && handleMarkerClick(cp) }}
            />
          ))}

          {popupPin && (
            <Popup
              key={popupPin.id}
              position={[popupPin.latitude, popupPin.longitude]}
              className="feed-map-popup"
              closeButton={false}
              autoPan
              // Open below the header (or its capsule) and the "Search this area" pill.
              autoPanPaddingTopLeft={[12, topInset + 56]}
              offset={[0, -16]}
              eventHandlers={{
                remove: () => handlePopupClosed(popupPin.id),
                popupclose: () => handlePopupClosed(popupPin.id),
              }}
            >
              <MapPostPopupCard
                pin={popupPin}
                onClose={() => setSelectedPin(null)}
                onViewPost={onViewPost}
              />
            </Popup>
          )}
        </BaseMap>
      )}

      {/* ─── Header row: intent chips + post count (in the Pulse header when there is one) ─── */}
      {headerSlot
        ? createPortal(chipsRow, headerSlot)
        : <div className="absolute inset-x-0 top-0 z-[500]">{chipsRow}</div>}

      {/* ─── Top pills: Search this area, loading, error. They sit 12 px under the header,
           or under its capsule while it's away, and move with it. ─── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-center px-3 transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${topInset + 12}px)` }}
      >
        {mapDirty && !error && !loading && (
          <button
            onClick={handleSearchArea}
            className="pointer-events-auto bg-app-surface/95 backdrop-blur text-primary-600 dark:text-primary-300 text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search this area
          </button>
        )}

        {error && !loading && (
          <div role="alert" className="pointer-events-auto bg-app-surface/95 backdrop-blur-sm border border-app text-app-muted text-xs font-medium px-4 py-2 rounded-full shadow-md flex items-center gap-2">
            <span>Couldn&apos;t load posts.</span>
            <button
              onClick={searchView}
              className="font-bold text-primary-600 dark:text-primary-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="bg-app-surface/95 backdrop-blur-sm border border-app text-app-muted text-xs font-medium px-4 py-2 rounded-full shadow-md flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-app border-t-primary-500 rounded-full animate-spin" />
            Loading posts...
          </div>
        )}
      </div>

      {/* ─── Overlay: Re-center button (bottom-left) ───────── */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-20 left-3 z-[500] bg-app-surface/95 backdrop-blur px-3 h-10 rounded-full shadow-lg border border-app flex items-center justify-center gap-1.5 hover-bg-app transition"
        title="Re-center on my location"
      >
        <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[11px] font-semibold text-app">My location</span>
      </button>

      {/* ─── Overlay: Zoom gate ─────────────────────────────── */}
      <ZoomGateOverlay visible={belowZoomGate} contentLabel="posts" />

      {/* ─── Overlay: Empty state / Nearest activity ───────── */}
      {!error && !loading && !belowZoomGate && pins.length === 0 && bounds && (
        <NearestActivityPrompt
          viewCenter={viewCenter}
          nearest={nearestActivity}
          contentLabel="posts"
          onFlyTo={handleFlyToNearest}
        />
      )}

      {/* ─── Overlay: Cluster card list ────────────────────── */}
      {clusterPosts.length > 0 && (
        <div className="absolute bottom-20 left-3 right-3 z-[500] bg-app-surface/95 backdrop-blur rounded-2xl shadow-2xl border border-app overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-app">
            <span className="text-xs font-semibold text-app">{clusterPosts.length} posts in this area</span>
            <button
              onClick={() => setClusterPosts([])}
              aria-label="Close"
              className="p-1 text-app-muted hover:text-app transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
            {clusterPosts.map((p) => {
              const pt = postType(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onViewPost(p.id)}
                  className="flex-shrink-0 w-48 bg-surface-muted rounded-xl p-3 text-left hover-bg-app transition border border-app"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase ${POST_TYPE_THEMED_TEXT}`}
                      style={{
                        background: `${getPostTypeConfig(pt).color}15`,
                        ...postTypeTextVars(getPostTypeConfig(pt)),
                      }}
                    >
                      {(() => { const Icon = getTypeReactIcon(pt); return <Icon className="w-3 h-3 inline-block" />; })()} {getPostTypeConfig(pt).label}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-app truncate">{authorName(p)}</div>
                  <p className="text-[10px] text-app-muted line-clamp-2 mt-0.5 leading-relaxed">
                    {p.content || p.title || 'No content'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {p.like_count != null && <span className="text-[9px] text-app-muted inline-flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {p.like_count}</span>}
                    {p.comment_count != null && <span className="text-[9px] text-app-muted inline-flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {p.comment_count}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

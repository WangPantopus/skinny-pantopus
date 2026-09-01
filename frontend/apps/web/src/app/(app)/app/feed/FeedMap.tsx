'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as api from '@pantopus/api';
import {
  MessageCircle, Star, CalendarDays, Search, Megaphone, AlertTriangle,
  Pencil, Siren, Tag, Wrench, Newspaper, Trophy, Compass, User,
  Heart, Home as HomeIcon, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPostTypeConfig, POST_TYPE_ICONS_LUCIDE } from '@pantopus/ui-utils';
import type { FeedSurface, MapMarker, PostType } from '@pantopus/api';
import { BaseMap, useCluster, useAnimatedPins, pinAnimClass, clusterAnimClass, ZoomGateOverlay, NearestActivityPrompt } from '@/components/map';
import type { Bounds } from '@/components/map';
import type { ClusterPoint } from '@/components/map/useCluster';
import type { NearestActivityCenter } from '@/components/map';

// SVG icon strings for Leaflet divIcon HTML (not React components)
// Keys use canonical PostType values only — no legacy aliases.
const POST_TYPE_SVG_ICONS: Record<string, string> = {
  ask_local: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  recommendation: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  event: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  lost_found: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  alert: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  deal: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  local_update: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  neighborhood_win: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  visitor_guide: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  general: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  personal_update: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  announcement: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  service_offer: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>',
  resources_howto: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  progress_wins: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
};

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
  const author = pin.creator?.name || pin.creator?.username || 'Neighbor';
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
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: `${config.color}15`,
                color: config.color,
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

// ─── Filter chips ───────────────────────────────────────────
const MAP_FILTERS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'All', icon: HomeIcon },
  { key: 'ask_local', label: 'Ask', icon: MessageCircle },
  { key: 'recommendation', label: 'Recs', icon: Star },
  { key: 'event', label: 'Events', icon: CalendarDays },
  { key: 'lost_found', label: 'Lost', icon: Search },
  { key: 'alert', label: 'Alerts', icon: AlertTriangle },
  { key: 'deal', label: 'Deals', icon: Tag },
  { key: 'local_update', label: 'Updates', icon: Newspaper },
  { key: 'neighborhood_win', label: 'Wins', icon: Trophy },
];

// ─── Custom Leaflet divIcon builders ────────────────────────
function makePostDivIcon(post: MapMarker, animCls = '') {
  const postType = post.post_type || 'general';
  const color = getPostTypeConfig(postType).color;
  const icon = POST_TYPE_SVG_ICONS[postType] || POST_TYPE_SVG_ICONS.general;
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${icon}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: animCls,
  });
}

function makeClusterDivIcon(count: number, animCls = '') {
  return L.divIcon({
    html: `<div style="background:#1F2937;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: animCls,
  });
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
}

export default function FeedMap({
  postTypeFilter,
  onFilterChange,
  surface,
  userLat,
  userLng,
  onUseCurrentLocation,
  onViewPost,
}: FeedMapProps) {
  const isPlaceSurface = surface === 'place';
  const [pins, setPins] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPin, setSelectedPin] = useState<MapMarker | null>(null);
  const [clusterPosts, setClusterPosts] = useState<MapMarker[]>([]);
  const [mapDirty, setMapDirty] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(13);
  const [nearestActivity, setNearestActivity] = useState<NearestActivityCenter | null>(null);

  // Derive map filter directly from the shared postTypeFilter prop — single source of truth
  const mapFilter = isPlaceSurface ? postTypeFilter : 'all';

  const mapRef = useRef<L.Map | null>(null);

  const center: [number, number] = useMemo(
    () => [userLat ?? 40.7128, userLng ?? -74.006],
    [userLat, userLng]
  );

  useEffect(() => {
    if (!mapRef.current || userLat == null || userLng == null) return;
    mapRef.current.flyTo([userLat, userLng], 13, { duration: 0.8 });
  }, [userLat, userLng]);

  // ─── Fetch pins ──────────────────────────────────────────
  const ZOOM_GATE = 8;
  const fetchPins = useCallback(async (currentBounds: Bounds | null) => {
    if (!currentBounds) return;
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
      const postPins = (res.markers || []).filter(
        (m) => m.layer_type === 'post' || !m.layer_type
      );
      setPins(postPins);
      setNearestActivity(res.nearest_activity_center ?? null);
    } catch {
      setPins([]);
      setNearestActivity(null);
    } finally {
      setLoading(false);
    }
  }, [isPlaceSurface, mapFilter, surface]);

  // Fetch on filter change
  useEffect(() => {
    if (bounds) fetchPins(bounds);
  }, [bounds, fetchPins]);

  // ─── Clustered pins (Supercluster) ─────────────────────
  const clusteredPins = useCluster(pins, zoom, bounds);

  // Animated enter/exit transitions
  const animatedPins = useAnimatedPins(clusteredPins);

  // ─── Map events ──────────────────────────────────────────
  const handleBoundsChange = useCallback((b: Bounds, z: number) => {
    setBounds(b);
    setZoom(z);
    setMapDirty(true);
    if (z < ZOOM_GATE) {
      setPins([]);
      setNearestActivity(null);
    }
  }, []);

  const handleSearchArea = () => {
    fetchPins(bounds);
    setMapDirty(false);
    setSelectedPin(null);
    setClusterPosts([]);
  };

  const handleRecenter = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        mapRef.current?.flyTo([latitude, longitude], 14, { duration: 1 });
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
    mapRef.current?.fitBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ], { padding: [40, 40] });
  };

  // ─── Pin click handlers ──────────────────────────────────
  const handleMarkerClick = useCallback((cp: ClusterPoint<MapMarker>) => {
    if (cp.isCluster) {
      if (mapRef.current && cp.expansionZoom != null) {
        mapRef.current.flyTo([cp.latitude, cp.longitude], cp.expansionZoom, { duration: 0.5 });
      }
      setClusterPosts(cp.items);
      setSelectedPin(null);
      return;
    }
    setSelectedPin(cp.item || null);
    setClusterPosts([]);
  }, []);

  // ─── Derived ─────────────────────────────────────────────
  const postCount = pins.length;
  const authorName = (p: MapMarker) => p.creator?.name || p.creator?.username || 'Neighbor';
  const postType = (p: MapMarker) => p.post_type || 'general';

  const belowZoomGate = zoom < ZOOM_GATE;
  const viewCenter = bounds
    ? { latitude: (bounds.south + bounds.north) / 2, longitude: (bounds.west + bounds.east) / 2 }
    : { latitude: center[0], longitude: center[1] };

  const handleFlyToNearest = useCallback((target: NearestActivityCenter) => {
    mapRef.current?.flyTo([target.latitude, target.longitude], 12, { duration: 1.2 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <BaseMap
        center={center}
        zoom={13}
        onBoundsChange={handleBoundsChange}
        mapRef={mapRef}
      >
        {animatedPins.map(({ pin: cp, animState }) => (
          <Marker
            key={cp.id}
            position={[cp.latitude, cp.longitude]}
            icon={
              cp.isCluster
                ? makeClusterDivIcon(cp.count, clusterAnimClass(animState))
                : makePostDivIcon(cp.item!, pinAnimClass(animState))
            }
            eventHandlers={{ click: () => animState !== 'exiting' && handleMarkerClick(cp) }}
          />
        ))}

        {selectedPin && !clusterPosts.length && selectedPin.latitude != null && selectedPin.longitude != null && (
          <Popup
            key={selectedPin.id}
            position={[selectedPin.latitude, selectedPin.longitude]}
            className="feed-map-popup"
            closeButton={false}
            autoPan
            offset={[0, -16]}
            eventHandlers={{
              remove: () => setSelectedPin((current) => (current?.id === selectedPin.id ? null : current)),
              popupclose: () => setSelectedPin((current) => (current?.id === selectedPin.id ? null : current)),
            }}
          >
            <MapPostPopupCard
              pin={selectedPin}
              onClose={() => setSelectedPin(null)}
              onViewPost={onViewPost}
            />
          </Popup>
        )}
      </BaseMap>

      {/* ─── Overlay: Filter chips (top-left) ──────────────── */}
      {isPlaceSurface && (
        <div className="absolute top-3 left-3 z-[500] flex gap-1.5 overflow-x-auto max-w-[calc(100%-120px)] scrollbar-hide">
          {MAP_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { onFilterChange?.(f.key); setMapDirty(false); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shadow-md transition ${
                mapFilter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface/95 backdrop-blur text-app-muted border border-app hover-bg-app'
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Overlay: Post count badge (top-right) ─────────── */}
      <button
        onClick={handleFitAll}
        className="absolute top-3 right-3 z-[500] bg-surface/95 backdrop-blur text-app text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md border border-app hover-bg-app transition"
      >
        {postCount} in view
      </button>

      {/* ─── Overlay: Search this area ─────────────────────── */}
      {mapDirty && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[500]">
          <button
            onClick={handleSearchArea}
            className="bg-surface/95 backdrop-blur text-primary-600 dark:text-primary-300 text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search this area
          </button>
        </div>
      )}

      {/* ─── Overlay: Re-center button (bottom-left) ───────── */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-20 left-3 z-[500] bg-surface/95 backdrop-blur px-3 h-10 rounded-full shadow-lg border border-app flex items-center justify-center gap-1.5 hover-bg-app transition"
        title="Re-center on my location"
      >
        <svg className="w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[11px] font-semibold text-app">My location</span>
      </button>

      {/* ─── Overlay: Loading spinner ──────────────────────── */}
      {loading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[500] bg-surface/95 backdrop-blur-sm border border-app text-app-muted text-xs font-medium px-4 py-2 rounded-full shadow-md flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-app border-t-primary-500 rounded-full animate-spin" />
          Loading posts...
        </div>
      )}

      {/* ─── Overlay: Zoom gate ─────────────────────────────── */}
      <ZoomGateOverlay visible={belowZoomGate} contentLabel="posts" />

      {/* ─── Overlay: Empty state / Nearest activity ───────── */}
      {!loading && !belowZoomGate && pins.length === 0 && bounds && (
        <NearestActivityPrompt
          viewCenter={viewCenter}
          nearest={nearestActivity}
          contentLabel="posts"
          onFlyTo={handleFlyToNearest}
        />
      )}

      {/* ─── Overlay: Cluster card list ────────────────────── */}
      {clusterPosts.length > 0 && (
        <div className="absolute bottom-20 left-3 right-3 z-[500] bg-surface/95/90 backdrop-blur rounded-2xl shadow-2xl border border-app overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-app">
            <span className="text-xs font-semibold text-app">{clusterPosts.length} posts in this area</span>
            <button
              onClick={() => setClusterPosts([])}
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
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase"
                      style={{
                        background: `${getPostTypeConfig(pt).color}15`,
                        color: getPostTypeConfig(pt).color,
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

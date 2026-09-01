'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as api from '@pantopus/api';
import type { MapBusinessMarker, MapMarker } from '@pantopus/api';
import { BaseMap, LocateMeButton, MapProgressBar, clusterMarkers, makeClusterIcon, ZoomGateOverlay, NearestActivityPrompt } from '@/components/map';
import type { Bounds } from '@/components/map';
import type { NearestActivityCenter } from '@/components/map';

// ─── Types ───────────────────────────────────────────────────

export type MapLayerKey = 'businesses' | 'gigs' | 'posts';

export type MeasureFrom = 'home' | 'here';

interface GigPin {
  id: string;
  title: string;
  price: number | null;
  category: string | null;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
  poster_display_name?: string | null;
  poster_username?: string | null;
}

// ─── Pin creation helpers ────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  lawn_care: '#22C55E',
  pet_care: '#22C55E',
  cleaning: '#3B82F6',
  plumbing: '#3B82F6',
  electrical: '#3B82F6',
  handyman: '#3B82F6',
  food_catering: '#F97316',
  beauty: '#A855F7',
  childcare: '#EC4899',
  tutoring: '#6366F1',
  moving: '#EAB308',
  photography: '#14B8A6',
};

const DEFAULT_PIN_COLOR = '#94A3B8';

function getCategoryColor(categories: string[]): string {
  for (const c of categories) {
    if (CATEGORY_COLORS[c]) return CATEGORY_COLORS[c];
  }
  return DEFAULT_PIN_COLOR;
}

function makeBusinessIcon(marker: MapBusinessMarker, animCls = ''): L.DivIcon {
  const size = marker.pin_tier === 'large' ? 36 : marker.pin_tier === 'medium' ? 28 : 22;
  const fontSize = marker.pin_tier === 'large' ? 14 : marker.pin_tier === 'medium' ? 11 : 9;
  const bg = getCategoryColor(marker.categories);
  const initial = (marker.name || '?')[0].toUpperCase();
  const star = marker.is_new_business ? '<span style="position:absolute;top:-4px;right:-4px;font-size:10px">⭐</span>' : '';

  const html = `
    <div style="
      position:relative;
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${bg};
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:${fontSize}px;
      border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      transform:translate(-50%,-50%);
    ">${initial}${star}</div>
  `;

  return L.divIcon({
    html,
    className: ['discover-biz-pin', animCls].filter(Boolean).join(' '),
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function makeGigIcon(animCls = ''): L.DivIcon {
  const html = `
    <div style="
      width:20px;
      height:20px;
      border-radius:9999px;
      background:transparent;
      border:3px dashed #F59E0B;
      box-shadow:0 1px 4px rgba(0,0,0,.15);
      transform:translate(-50%,-50%);
    "></div>
  `;
  return L.divIcon({
    html,
    className: ['discover-gig-pin', animCls].filter(Boolean).join(' '),
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function makePostIcon(marker: MapMarker, animCls = ''): L.DivIcon {
  const postAge = marker.created_at
    ? Math.min(1, (Date.now() - new Date(marker.created_at).getTime()) / (7 * 86400000))
    : 0.5;
  const opacity = Math.max(0.35, 1 - postAge * 0.6);

  const emoji =
    marker.post_type === 'recommendation' ? '⭐' :
    marker.post_type === 'alert' ? '⚠️' :
    marker.post_type === 'event' ? '📅' :
    marker.post_type === 'ask_local' ? '❓' :
    '💬';

  const html = `
    <div style="
      width:24px;
      height:24px;
      border-radius:6px;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:14px;
      border:1.5px solid #D1D5DB;
      box-shadow:0 1px 4px rgba(0,0,0,.12);
      opacity:${opacity};
      transform:translate(-50%,-50%);
    ">${emoji}</div>
  `;
  return L.divIcon({
    html,
    className: ['discover-post-pin', animCls].filter(Boolean).join(' '),
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function makeHomeIcon(): L.DivIcon {
  const html = `
    <div style="
      width:32px;
      height:32px;
      border-radius:9999px;
      background:#0D9488;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:16px;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(13,148,136,.3), 0 2px 8px rgba(0,0,0,.2);
      transform:translate(-50%,-50%);
      animation: pulse-ring 2s ease-out infinite;
    ">🏠</div>
  `;
  return L.divIcon({
    html,
    className: 'discover-home-pin',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function makeGpsIcon(): L.DivIcon {
  const html = `
    <div style="
      width:16px;
      height:16px;
      border-radius:9999px;
      background:#3B82F6;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(59,130,246,.3), 0 2px 6px rgba(0,0,0,.2);
      transform:translate(-50%,-50%);
    "></div>
  `;
  return L.divIcon({
    html,
    className: 'discover-gps-pin',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN MAP COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DiscoverMapProps {
  homeCenter: [number, number] | null;
  gpsCenter: [number, number] | null;
  layers: Set<MapLayerKey>;
  measureFrom: MeasureFrom;
  categories?: string[];
  openNow?: boolean;
  onSelectBusiness?: (marker: MapBusinessMarker) => void;
  onSelectGig?: (gig: GigPin) => void;
  onSelectPost?: (marker: MapMarker) => void;
}

const DISCOVER_DEFAULT_CENTER: [number, number] = [45.5231, -122.6765];

export default function DiscoverMap({
  homeCenter,
  gpsCenter,
  layers,
  measureFrom,
  categories,
  openNow,
  onSelectBusiness,
  onSelectGig,
  onSelectPost,
}: DiscoverMapProps) {
  const mapCenter = useMemo(() => {
    if (measureFrom === 'here' && gpsCenter) return gpsCenter;
    return homeCenter ?? gpsCenter ?? DISCOVER_DEFAULT_CENTER;
  }, [homeCenter, gpsCenter, measureFrom]);

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(13);
  const mapRef = useRef<L.Map | null>(null);

  // ── Data state ──────────────────────────────────────────────
  const [bizMarkers, setBizMarkers] = useState<MapBusinessMarker[]>([]);
  const [gigPins, setGigPins] = useState<GigPin[]>([]);
  const [postPins, setPostPins] = useState<MapMarker[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [loadingGigs, setLoadingGigs] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [nearestActivity, setNearestActivity] = useState<NearestActivityCenter | null>(null);

  const abortBiz = useRef<AbortController | null>(null);
  const abortGigs = useRef<AbortController | null>(null);
  const abortPosts = useRef<AbortController | null>(null);

  // ── Fetch businesses when bounds change ─────────────────────
  const fetchBusinesses = useCallback(
    async (b: Bounds) => {
      if (!layers.has('businesses')) return;
      abortBiz.current?.abort();
      const ctrl = new AbortController();
      abortBiz.current = ctrl;
      setLoadingBiz(true);
      try {
        const params: Parameters<typeof api.businesses.getBusinessesForMap>[0] = {
          south: b.south, west: b.west, north: b.north, east: b.east, limit: 200,
        };
        if (categories && categories.length > 0) params.categories = categories.join(',');
        if (openNow) params.open_now = true;
        const res = await api.businesses.getBusinessesForMap(params);
        if (!ctrl.signal.aborted) {
          setBizMarkers(res.markers);
          setNearestActivity(res.nearest_activity_center ?? null);
        }
      } catch {
        // Silently handle
      } finally {
        if (!ctrl.signal.aborted) setLoadingBiz(false);
      }
    },
    [layers, categories, openNow],
  );

  // ── Fetch gigs when bounds change ───────────────────────────
  const fetchGigs = useCallback(
    async (b: Bounds) => {
      if (!layers.has('gigs')) return;
      abortGigs.current?.abort();
      const ctrl = new AbortController();
      abortGigs.current = ctrl;
      setLoadingGigs(true);
      try {
        const res = await api.getGigsInBounds({
          min_lat: b.south, min_lon: b.west, max_lat: b.north, max_lon: b.east, status: 'open', limit: 200,
        });
        if (!ctrl.signal.aborted) setGigPins(res.gigs as GigPin[]);
      } catch {
        // Silently handle
      } finally {
        if (!ctrl.signal.aborted) setLoadingGigs(false);
      }
    },
    [layers],
  );

  // ── Fetch posts when bounds change ──────────────────────────
  const fetchPosts = useCallback(
    async (b: Bounds) => {
      if (!layers.has('posts')) return;
      abortPosts.current?.abort();
      const ctrl = new AbortController();
      abortPosts.current = ctrl;
      setLoadingPosts(true);
      try {
        const res = await api.posts.getMapMarkers({
          south: b.south, west: b.west, north: b.north, east: b.east, layers: 'posts', limit: 200,
        });
        if (!ctrl.signal.aborted) setPostPins(res.markers);
      } catch {
        // Silently handle
      } finally {
        if (!ctrl.signal.aborted) setLoadingPosts(false);
      }
    },
    [layers],
  );

  const ZOOM_GATE = 8;

  // ── Trigger fetches on bounds change ────────────────────────
  const handleBoundsChange = useCallback(
    (b: Bounds, z: number) => {
      setBounds(b);
      setZoom(z);
      if (z >= ZOOM_GATE) {
        fetchBusinesses(b);
        fetchGigs(b);
        fetchPosts(b);
      } else {
        setBizMarkers([]);
        setGigPins([]);
        setPostPins([]);
        setNearestActivity(null);
      }
    },
    [fetchBusinesses, fetchGigs, fetchPosts],
  );

  // ── Re-fetch when layers/filters change with existing bounds
  useEffect(() => {
    if (!bounds) return;
    fetchBusinesses(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, categories, openNow]);

  useEffect(() => {
    if (!bounds) return;
    fetchGigs(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  useEffect(() => {
    if (!bounds) return;
    fetchPosts(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // Clear data for toggled-off layers
  useEffect(() => {
    if (!layers.has('businesses')) setBizMarkers([]);
    if (!layers.has('gigs')) setGigPins([]);
    if (!layers.has('posts')) setPostPins([]);
  }, [layers]);

  // ── Clustered data ─────────────────────────────────────────
  const bizClusters = useMemo(() => clusterMarkers(bizMarkers, zoom), [bizMarkers, zoom]);
  const gigClusters = useMemo(() => clusterMarkers(gigPins, zoom, 15), [gigPins, zoom]);
  const postClusters = useMemo(() => clusterMarkers(postPins, zoom, 15), [postPins, zoom]);

  const isLoading = loadingBiz || loadingGigs || loadingPosts;
  const belowZoomGate = zoom < ZOOM_GATE;
  const allEmpty = bizMarkers.length === 0 && gigPins.length === 0 && postPins.length === 0;
  const viewCenter = bounds
    ? { latitude: (bounds.south + bounds.north) / 2, longitude: (bounds.west + bounds.east) / 2 }
    : { latitude: mapCenter[0], longitude: mapCenter[1] };
  const handleFlyToNearest = useCallback((target: NearestActivityCenter) => {
    mapRef.current?.flyTo([target.latitude, target.longitude], 12, { duration: 1.2 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <BaseMap
        center={mapCenter}
        zoom={13}
        className="h-full w-full rounded-xl z-0"
        onBoundsChange={handleBoundsChange}
        recenterOnChange
        mapRef={mapRef}
      >
        <LocateMeButton />

        {/* Home pin */}
        {homeCenter && (
          <Marker position={homeCenter} icon={makeHomeIcon()} zIndexOffset={1000}>
            <Popup>
              <div className="text-sm font-medium">🏠 Your Home</div>
            </Popup>
          </Marker>
        )}

        {/* GPS "here" dot */}
        {gpsCenter && measureFrom === 'here' && (
          <Marker position={gpsCenter} icon={makeGpsIcon()} zIndexOffset={900}>
            <Popup>
              <div className="text-sm font-medium">📍 Current Location</div>
            </Popup>
          </Marker>
        )}

        {/* Business markers / clusters */}
        {layers.has('businesses') &&
          bizClusters.map((cluster, idx) => {
            if (cluster.items.length > 1) {
              return (
                <Marker
                  key={`biz-cluster-${idx}`}
                  position={cluster.center}
                  icon={makeClusterIcon(cluster.items.length, '#0EA5E9', 'pin-enter cluster-pop')}
                  zIndexOffset={500}
                >
                  <Popup>
                    <div className="text-sm font-medium">
                      {cluster.items.length} businesses — zoom in to see details
                    </div>
                  </Popup>
                </Marker>
              );
            }

            const m = cluster.items[0];
            return (
              <Marker
                key={`biz-${m.business_user_id}`}
                position={[m.latitude, m.longitude]}
                icon={makeBusinessIcon(m, 'pin-enter')}
                zIndexOffset={600}
                eventHandlers={{ click: () => onSelectBusiness?.(m) }}
              >
                <Popup>
                  <BusinessPinPopup marker={m} onContact={onSelectBusiness} />
                </Popup>
              </Marker>
            );
          })}

        {/* Gig markers / clusters */}
        {layers.has('gigs') &&
          gigClusters.map((cluster, idx) => {
            if (cluster.items.length > 1) {
              return (
                <Marker
                  key={`gig-cluster-${idx}`}
                  position={cluster.center}
                  icon={makeClusterIcon(cluster.items.length, '#F59E0B', 'pin-enter cluster-pop')}
                  zIndexOffset={400}
                >
                  <Popup>
                    <div className="text-sm font-medium">
                      {cluster.items.length} active gigs
                    </div>
                  </Popup>
                </Marker>
              );
            }

            const g = cluster.items[0];
            return (
              <Marker
                key={`gig-${g.id}`}
                position={[g.latitude, g.longitude]}
                icon={makeGigIcon('pin-enter')}
                zIndexOffset={300}
                eventHandlers={{ click: () => onSelectGig?.(g) }}
              >
                <Popup>
                  <GigPinPopup gig={g} onSelect={onSelectGig} />
                </Popup>
              </Marker>
            );
          })}

        {/* Post markers / clusters */}
        {layers.has('posts') &&
          postClusters.map((cluster, idx) => {
            if (cluster.items.length > 1) {
              return (
                <Marker
                  key={`post-cluster-${idx}`}
                  position={cluster.center}
                  icon={makeClusterIcon(cluster.items.length, '#6B7280', 'pin-enter cluster-pop')}
                  zIndexOffset={200}
                >
                  <Popup>
                    <div className="text-sm font-medium">
                      {cluster.items.length} neighborhood posts
                    </div>
                  </Popup>
                </Marker>
              );
            }

            const p = cluster.items[0];
            return (
              <Marker
                key={`post-${p.id}`}
                position={[p.latitude, p.longitude]}
                icon={makePostIcon(p, 'pin-enter')}
                zIndexOffset={100}
                eventHandlers={{ click: () => onSelectPost?.(p) }}
              >
                <Popup>
                  <PostPinPopup marker={p} />
                </Popup>
              </Marker>
            );
          })}
      </BaseMap>

      {/* Top progress bar — replaces the old spinner overlay */}
      <MapProgressBar visible={isLoading} />

      {/* Zoom gate overlay */}
      <ZoomGateOverlay visible={belowZoomGate} contentLabel="businesses" />

      {/* Nearest activity prompt (when all layers are empty) */}
      {!isLoading && !belowZoomGate && allEmpty && bounds && (
        <NearestActivityPrompt
          viewCenter={viewCenter}
          nearest={nearestActivity}
          contentLabel="businesses"
          onFlyTo={handleFlyToNearest}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POPUP COMPONENTS
// ═══════════════════════════════════════════════════════════════

function BusinessPinPopup({
  marker,
  onContact,
}: {
  marker: MapBusinessMarker;
  onContact?: (m: MapBusinessMarker) => void;
}) {
  const ratingText =
    marker.average_rating != null
      ? `★ ${marker.average_rating.toFixed(1)} (${marker.review_count})`
      : 'New';

  return (
    <div className="min-w-[180px] space-y-1.5">
      <div className="flex items-center gap-2">
        {marker.profile_picture_url ? (
          <Image
            src={marker.profile_picture_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
            width={32}
            height={32}
            sizes="32px"
            quality={75}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-app-surface-sunken flex items-center justify-center text-xs font-bold text-app-text-secondary">
            {(marker.name || '?')[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{marker.name}</p>
          <p className="text-xs text-app-text-secondary">@{marker.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-app-text-secondary flex-wrap">
        <span>{ratingText}</span>
        {marker.is_open_now && (
          <span className="text-green-600 font-medium">● Open</span>
        )}
        {marker.is_new_business && (
          <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
            New
          </span>
        )}
      </div>

      {marker.categories.length > 0 && (
        <p className="text-[11px] text-app-text-muted truncate">
          {marker.categories.slice(0, 3).join(' · ')}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContact?.(marker);
          }}
          className="flex-1 text-xs font-semibold text-primary-600 hover:text-primary-800 transition"
        >
          Contact
        </button>
        <a
          href={`/b/${marker.username}`}
          className="flex-1 text-xs font-semibold text-app-text-secondary hover:text-app-text transition text-right"
        >
          Profile →
        </a>
      </div>
    </div>
  );
}

function GigPinPopup({
  gig,
  onSelect,
}: {
  gig: GigPin;
  onSelect?: (g: GigPin) => void;
}) {
  return (
    <div className="min-w-[160px] space-y-1">
      <p className="text-sm font-semibold">{gig.title || 'Task'}</p>
      {gig.price != null && (
        <p className="text-xs text-app-text-secondary">${gig.price}</p>
      )}
      {gig.category && (
        <p className="text-[11px] text-app-text-muted">{gig.category}</p>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(gig);
        }}
        className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition"
      >
        View Task →
      </button>
    </div>
  );
}

function PostPinPopup({ marker }: { marker: MapMarker }) {
  const content = marker.content?.slice(0, 120) || '';
  return (
    <div className="min-w-[160px] space-y-1">
      {marker.creator && (
        <p className="text-xs font-medium text-app-text-strong">
          {marker.creator.name || marker.creator.username}
        </p>
      )}
      <p className="text-xs text-app-text-secondary line-clamp-3">{content}{content.length >= 120 ? '…' : ''}</p>
      {marker.like_count != null && (
        <p className="text-[11px] text-app-text-muted">
          ❤️ {marker.like_count} · 💬 {marker.comment_count ?? 0}
        </p>
      )}
      <a
        href={`/app/posts/${marker.id}`}
        className="text-xs font-semibold text-app-text-secondary hover:text-app-text transition"
      >
        View Post →
      </a>
    </div>
  );
}

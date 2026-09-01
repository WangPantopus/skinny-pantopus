'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { HomeMapPin, MapPinType } from '@/types/mailbox';
import { useMapPins, useAddPinToCalendar } from '@/lib/mailbox-queries';
import { TrustBadge } from '@/components/mailbox';
import { TILE_URL, TILE_ATTRIBUTION } from '@/components/map/constants';

// ── Leaflet must be loaded client-side only ──────────────────
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import('react-leaflet').then(m => m.Marker),
  { ssr: false },
);

// ── Pin type config ──────────────────────────────────────────

type PinFilter = MapPinType | 'all';

const PIN_FILTERS: { value: PinFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'permit', label: 'Permits' },
  { value: 'utility_work', label: 'Utility' },
  { value: 'civic', label: 'Civic' },
  { value: 'community', label: 'Community' },
  { value: 'delivery', label: 'Deliveries' },
];

const PIN_COLORS: Record<MapPinType, string> = {
  permit: '#f97316',     // orange-500
  utility_work: '#eab308', // yellow-500
  civic: '#3b82f6',      // blue-500
  community: '#22c55e',  // green-500
  delivery: '#374151',   // gray-700
  notice: '#a855f7',     // purple-500
};

const PIN_ICONS: Record<MapPinType, string> = {
  permit: '🏗',
  utility_work: '⚡',
  civic: '📢',
  community: '🌟',
  delivery: '📦',
  notice: '📋',
};

const TRUST_MAP: Record<string, 'verified_gov' | 'verified_utility' | 'verified_business' | 'pantopus_user' | 'unknown'> = {
  verified_gov: 'verified_gov',
  verified_utility: 'verified_utility',
  verified_business: 'verified_business',
  pantopus_user: 'pantopus_user',
};

// ── Stub: home profile context (replace with real hook) ──────
function useHomeProfile() {
  // In production this would come from a profile context or API
  return {
    homeId: 'home_1',
    lat: 45.5945,
    lng: -122.4065,
    address: 'Camas, WA',
  };
}

// ── Main Page ────────────────────────────────────────────────

export default function MailMapPage() {
  const home = useHomeProfile();
  const hasLocation = home.lat !== 0 && home.lng !== 0;

  const [activeFilter, setActiveFilter] = useState<PinFilter>('all');
  const [selectedPin, setSelectedPin] = useState<HomeMapPin | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const calendarMutation = useAddPinToCalendar();

  const { data: pins, isLoading } = useMapPins(home.homeId, undefined, {
    enabled: hasLocation,
  });

  // Load leaflet on client
  useEffect(() => {
    import('leaflet').then(L => {
      leafletRef.current = L;
      setLeafletReady(true);
    });
  }, []);

  // Create icon for a pin type
  const makeIcon = useCallback((pinType: MapPinType, isSelected: boolean) => {
    const L = leafletRef.current;
    if (!L) return undefined;

    const color = PIN_COLORS[pinType] || PIN_COLORS.civic;
    const emoji = PIN_ICONS[pinType] || '📋';
    const size = isSelected ? 40 : 32;
    const border = isSelected ? '3px solid #fff' : '2px solid #fff';

    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      html: `<div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};display:flex;align-items:center;justify-content:center;
        border:${border};box-shadow:0 4px 12px rgba(0,0,0,.25);
        font-size:${isSelected ? 18 : 14}px;
        transition:transform 0.15s;
        ${isSelected ? 'transform:scale(1.15);z-index:999;' : ''}
      ">${emoji}</div>`,
    });
  }, []);

  // Home icon
  const homeIcon = useMemo(() => {
    const L = leafletRef.current;
    if (!L) return undefined;
    return L.divIcon({
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      html: `<div style="
        width:36px;height:36px;border-radius:9999px;
        background:#0ea5e9;display:flex;align-items:center;justify-content:center;
        border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3);
        font-size:16px;
      ">🏠</div>`,
    });
  }, [leafletReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPins = useMemo(() => {
    if (!pins) return [];
    if (activeFilter === 'all') return pins;
    return pins.filter(p => p.pin_type === activeFilter);
  }, [pins, activeFilter]);

  const dimmedPinIds = useMemo(() => {
    if (activeFilter === 'all' || !pins) return new Set<string>();
    return new Set(pins.filter(p => p.pin_type !== activeFilter).map(p => p.id));
  }, [pins, activeFilter]);

  const handleAddToCalendar = useCallback((pinId: string) => {
    calendarMutation.mutate(pinId);
  }, [calendarMutation]);

  // ── No home location ──────────────────────────────────────
  if (!hasLocation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-app-surface-raised">
        <div className="text-center px-6">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4\" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted">
            Set your home address to see your mail on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-app-border bg-app-surface flex-shrink-0 overflow-x-auto z-10">
        {PIN_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              activeFilter === f.value
                ? 'bg-primary-600 text-white'
                : 'bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}

        {isLoading && (
          <div className="ml-auto flex-shrink-0">
            <div className="w-4 h-4 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── Map ──────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {leafletReady && (
          <MapContainer
            center={[home.lat, home.lng]}
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution={TILE_ATTRIBUTION}
              url={TILE_URL}
            />

            {/* Home marker */}
            {homeIcon && (
              <Marker
                position={[home.lat, home.lng]}
                icon={homeIcon}
              />
            )}

            {/* Pin markers */}
            {filteredPins.map((pin) => {
              const icon = makeIcon(pin.pin_type, selectedPin?.id === pin.id);
              if (!icon) return null;
              return (
                <Marker
                  key={pin.id}
                  position={[pin.lat, pin.lng]}
                  icon={icon}
                  opacity={dimmedPinIds.has(pin.id) ? 0.35 : 1}
                  eventHandlers={{
                    click: () => setSelectedPin(pin),
                  }}
                />
              );
            })}
          </MapContainer>
        )}

        {/* Empty state overlay */}
        {!isLoading && pins && pins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-20">
            <div className="bg-app-surface px-6 py-4 rounded-xl shadow-lg text-center max-w-xs pointer-events-auto">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-app-text-secondary dark:text-app-text-muted">
                No map pins yet. Mail from verified government and utility senders will pin automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── Side panel (pin detail) ────────────────────────── */}
        {selectedPin && (
          <div className="absolute top-0 right-0 h-full w-80 bg-app-surface border-l border-app-border shadow-xl z-30 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
              <span className="text-xl">{PIN_ICONS[selectedPin.pin_type] || '📋'}</span>
              <h3 className="text-sm font-semibold text-app-text flex-1 truncate">
                {selectedPin.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPin(null)}
                className="p-1 text-app-text-muted hover:text-app-text-secondary dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Sender + trust */}
              {selectedPin.sender_display && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-app-text-strong">
                    {selectedPin.sender_display}
                  </span>
                  {selectedPin.sender_trust && TRUST_MAP[selectedPin.sender_trust] && (
                    <TrustBadge trust={TRUST_MAP[selectedPin.sender_trust]} />
                  )}
                </div>
              )}

              {/* Pin type + visibility */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                  style={{ background: PIN_COLORS[selectedPin.pin_type] || '#6b7280' }}
                >
                  {selectedPin.pin_type.replace(/_/g, ' ')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted">
                  {selectedPin.visible_to === 'household' ? 'Household' : 'Neighborhood'}
                </span>
              </div>

              {/* Body */}
              {selectedPin.body && (
                <p className="text-sm text-app-text-secondary dark:text-app-text-muted whitespace-pre-wrap leading-relaxed">
                  {selectedPin.body}
                </p>
              )}

              {/* Expiry */}
              {selectedPin.expires_at && (
                <p className="text-xs text-app-text-muted">
                  Expires {new Date(selectedPin.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Panel actions */}
            <div className="border-t border-app-border-subtle px-4 py-3 flex flex-col gap-2 flex-shrink-0">
              {selectedPin.mail_id && (
                <a
                  href={`/app/mailbox/home/${selectedPin.mail_id}`}
                  className="w-full py-2 text-center text-sm font-medium text-primary-600 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  View full notice
                </a>
              )}
              <button
                type="button"
                onClick={() => handleAddToCalendar(selectedPin.id)}
                disabled={calendarMutation.isPending}
                className={`w-full py-2 text-center text-sm font-semibold rounded-lg transition-colors ${
                  calendarMutation.isPending
                    ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                    : calendarMutation.isSuccess
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {calendarMutation.isPending
                  ? 'Adding...'
                  : calendarMutation.isSuccess
                    ? 'Added to Calendar'
                    : 'Add to Calendar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

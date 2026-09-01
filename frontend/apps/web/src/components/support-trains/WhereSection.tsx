'use client';

import { useCallback, useState } from 'react';
import { Home as HomeIcon, Navigation, CheckCircle2, MapPin, Pencil } from 'lucide-react';
import * as api from '@pantopus/api';
import AddressAutocomplete from '../AddressAutocomplete';

export type LocationOption = 'home' | 'current' | 'other' | null;

export interface ResolvedLocation {
  mode: 'home' | 'current' | 'address';
  latitude: number;
  longitude: number;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  place_id?: string | null;
  homeId?: string | null;
}

export interface HomeInfo {
  id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  hasLocation?: boolean;
}

interface WhereSectionProps {
  homes: HomeInfo[];
  locationOption: LocationOption;
  onLocationOptionChange: (o: LocationOption) => void;
  resolvedLocation: ResolvedLocation | null;
  onResolvedLocationChange: (loc: ResolvedLocation | null) => void;
}

const PILLS: { value: NonNullable<LocationOption>; emoji: string; label: string }[] = [
  { value: 'home', emoji: '🏠', label: 'My Home' },
  { value: 'current', emoji: '📍', label: 'Current' },
  { value: 'other', emoji: '✏️', label: 'Other' },
];

function formatLocationLabel(loc: ResolvedLocation): string {
  return [loc.address, loc.city, loc.state].filter(Boolean).join(', ') || 'Unknown location';
}

export default function WhereSection({
  homes,
  locationOption,
  onLocationOptionChange,
  resolvedLocation,
  onResolvedLocationChange,
}: WhereSectionProps) {
  const primaryHome = homes[0] ?? null;
  const primaryHomeHasLocation = !!primaryHome?.hasLocation;

  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [editingGpsAddress, setEditingGpsAddress] = useState(false);

  const [addressQuery, setAddressQuery] = useState('');

  const handlePillClick = useCallback(
    async (value: NonNullable<LocationOption>) => {
      if (locationOption === value) {
        onLocationOptionChange(null);
        onResolvedLocationChange(null);
        setAddressQuery('');
        setGpsError('');
        setEditingGpsAddress(false);
        return;
      }
      onLocationOptionChange(value);
      setAddressQuery('');
      setGpsError('');
      setEditingGpsAddress(false);

      if (value === 'home') {
        if (primaryHome && primaryHomeHasLocation) {
          onResolvedLocationChange({
            mode: 'home',
            latitude: primaryHome.latitude,
            longitude: primaryHome.longitude,
            address: primaryHome.address || primaryHome.name,
            city: primaryHome.city || null,
            state: primaryHome.state || null,
            zip: null,
            homeId: primaryHome.id,
          });
        } else {
          onResolvedLocationChange(null);
        }
      } else if (value === 'current') {
        onResolvedLocationChange(null);
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          setGpsError('Geolocation not supported in this browser');
          return;
        }
        setGpsLocating(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            let resolved: ResolvedLocation = {
              mode: 'current',
              latitude: lat,
              longitude: lng,
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              city: null,
              state: null,
              zip: null,
            };
            try {
              const result = await api.geo.reverseGeocode(lat, lng);
              if (result?.normalized) {
                const n = result.normalized;
                resolved = {
                  mode: 'current',
                  latitude: lat,
                  longitude: lng,
                  address: n.address || resolved.address,
                  city: n.city || null,
                  state: n.state || null,
                  zip: n.zipcode || null,
                  place_id: n.place_id || null,
                };
              }
            } catch {
              /* keep fallback */
            }
            onResolvedLocationChange(resolved);
            setGpsLocating(false);
          },
          (err) => {
            setGpsError(
              err.code === err.PERMISSION_DENIED
                ? 'Location permission not granted'
                : 'Failed to get current location',
            );
            setGpsLocating(false);
          },
          { timeout: 10000, maximumAge: 60000 },
        );
      } else {
        onResolvedLocationChange(null);
      }
    },
    [locationOption, onLocationOptionChange, onResolvedLocationChange, primaryHome, primaryHomeHasLocation],
  );

  const showAddressInput =
    locationOption === 'other' || (locationOption === 'current' && editingGpsAddress);

  return (
    <div className="space-y-3">
      <p className="text-xs text-app-text-muted">
        Where helpers should bring meals or supplies. Hidden by default — only revealed after signup.
      </p>

      {/* Pills */}
      <div className="flex flex-wrap gap-2">
        {PILLS.map((p) => {
          const isActive = locationOption === p.value;
          const isDisabled = p.value === 'home' && !primaryHome;
          return (
            <button
              key={p.value}
              disabled={isDisabled}
              onClick={() => handlePillClick(p.value)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : isDisabled
                    ? 'border-app-border text-app-text-muted opacity-50 cursor-not-allowed'
                    : 'border-app-border text-app-text-secondary hover:border-primary-400'
              }`}
            >
              {p.emoji} {p.label}
            </button>
          );
        })}
      </div>

      {/* Home state */}
      {locationOption === 'home' && primaryHome && primaryHomeHasLocation && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-app-border bg-app-surface-sunken">
          <HomeIcon className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
          <p className="flex-1 text-sm text-app-text truncate">
            {[primaryHome.address, primaryHome.city, primaryHome.state].filter(Boolean).join(', ') || primaryHome.name}
          </p>
        </div>
      )}
      {locationOption === 'home' && !primaryHome && (
        <p className="text-xs italic text-amber-600 dark:text-amber-400">
          No home address saved. Add one in Settings, or choose Current / Other.
        </p>
      )}
      {locationOption === 'home' && primaryHome && !primaryHomeHasLocation && (
        <p className="text-xs italic text-amber-600 dark:text-amber-400">
          This home is missing map coordinates. Update the home address or choose Current / Other.
        </p>
      )}

      {/* Current (GPS) state */}
      {locationOption === 'current' && gpsLocating && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-app-border bg-app-surface-sunken">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-sm text-app-text-muted">Getting your location…</p>
        </div>
      )}
      {locationOption === 'current' && !gpsLocating && gpsError && (
        <p className="text-xs italic text-amber-600 dark:text-amber-400">{gpsError}</p>
      )}
      {locationOption === 'current' && !gpsLocating && resolvedLocation && !editingGpsAddress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-app-border bg-app-surface-sunken">
          <Navigation className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
          <p className="flex-1 text-sm text-app-text truncate">{formatLocationLabel(resolvedLocation)}</p>
          <button
            onClick={() => {
              setEditingGpsAddress(true);
              setAddressQuery(resolvedLocation.address);
            }}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        </div>
      )}

      {/* Address autocomplete (for Other, or editing GPS) */}
      {showAddressInput && (
        <div>
          <AddressAutocomplete
            value={addressQuery}
            onChange={setAddressQuery}
            onSelectNormalized={(n) => {
              if (n.latitude == null || n.longitude == null) return;
              onResolvedLocationChange({
                mode: locationOption === 'current' ? 'current' : 'address',
                latitude: n.latitude,
                longitude: n.longitude,
                address: n.address,
                city: n.city || null,
                state: n.state || null,
                zip: n.zipcode || null,
                place_id: n.place_id || null,
              });
              setEditingGpsAddress(false);
            }}
            placeholder="Search for an address…"
          />
          {locationOption === 'other' && resolvedLocation && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="flex-1 text-sm text-emerald-800 dark:text-emerald-300 truncate">
                {formatLocationLabel(resolvedLocation)}
              </p>
            </div>
          )}
        </div>
      )}

      {locationOption == null && (
        <p className="flex items-center gap-1.5 text-xs text-app-text-muted">
          <MapPin className="w-3 h-3" /> Pick one of the options above.
        </p>
      )}
    </div>
  );
}

// ── Helpers used by the parent page ───────────────────────────────

export function toSupportTrainDeliveryLocation(resolved: ResolvedLocation | null) {
  if (!resolved) return undefined;
  if (!Number.isFinite(resolved.latitude) || !Number.isFinite(resolved.longitude)) return undefined;
  const addr = (resolved.address || '').trim();
  if (addr.length < 3) return undefined;
  const mode: 'home' | 'current' | 'address' =
    resolved.mode === 'home' ? 'home' : resolved.mode === 'current' ? 'current' : 'address';
  return {
    mode,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    address: addr,
    city: resolved.city ?? null,
    state: resolved.state ?? null,
    zip: resolved.zip ?? null,
    home_id: resolved.homeId ?? null,
    place_id: resolved.place_id ?? null,
  };
}

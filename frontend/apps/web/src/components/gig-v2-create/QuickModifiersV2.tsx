'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  MapPin,
  Home,
  Navigation,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { ScheduleType } from '@pantopus/types';

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
}

interface QuickModifiersV2Props {
  scheduleType: ScheduleType;
  onScheduleChange: (s: ScheduleType) => void;
  scheduledDate: Date | null;
  onScheduledDateChange: (d: Date | null) => void;
  locationOption: LocationOption;
  onLocationChange: (l: LocationOption) => void;
  resolvedLocation: ResolvedLocation | null;
  onResolvedLocationChange: (loc: ResolvedLocation | null) => void;
  homes: HomeInfo[];
  customPrice: string;
  onCustomPriceChange: (v: string) => void;
  openToOffers: boolean;
  onOpenToOffersChange: (v: boolean) => void;
}

const SCHEDULE_PILLS: { value: ScheduleType; icon: string; label: string }[] = [
  { value: 'asap', icon: '\u26A1', label: 'Now' },
  { value: 'today', icon: '\uD83D\uDCC5', label: 'Today' },
  { value: 'scheduled', icon: '\uD83D\uDDD3\uFE0F', label: 'Schedule' },
  { value: 'flexible', icon: '\uD83E\uDD37', label: 'Flexible' },
];

const LOCATION_PILLS: { value: NonNullable<LocationOption>; icon: string; label: string }[] = [
  { value: 'home', icon: '\uD83C\uDFE0', label: 'My Home' },
  { value: 'current', icon: '\uD83D\uDCCD', label: 'Current' },
  { value: 'other', icon: '\u270F\uFE0F', label: 'Other' },
];

const BUDGET_PRESETS = [20, 40, 60];

export default function QuickModifiersV2({
  scheduleType,
  onScheduleChange,
  scheduledDate,
  onScheduledDateChange,
  locationOption,
  onLocationChange,
  resolvedLocation,
  onResolvedLocationChange,
  homes,
  customPrice,
  onCustomPriceChange,
  openToOffers,
  onOpenToOffersChange,
}: QuickModifiersV2Props) {
  // GPS state
  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [editingGpsAddress, setEditingGpsAddress] = useState(false);

  // Address autocomplete
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup debounce/abort on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const primaryHome = homes[0] ?? null;

  // ── Schedule handlers ──
  const handleSchedulePress = (value: ScheduleType) => {
    onScheduleChange(value);
    if (value === 'scheduled') {
      if (!scheduledDate) onScheduledDateChange(new Date());
    } else {
      onScheduledDateChange(null);
    }
  };

  // ── Location handlers ──
  const handleLocationPillPress = useCallback(
    async (value: NonNullable<LocationOption>) => {
      if (locationOption === value) {
        onLocationChange(null);
        onResolvedLocationChange(null);
        setAddressQuery('');
        setSuggestions([]);
        setGpsError('');
        setEditingGpsAddress(false);
        return;
      }

      onLocationChange(value);
      setAddressQuery('');
      setSuggestions([]);
      setGpsError('');
      setEditingGpsAddress(false);

      if (value === 'home') {
        if (primaryHome?.latitude && primaryHome?.longitude) {
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
        if (!navigator.geolocation) {
          setGpsError('Geolocation is not supported by your browser');
          return;
        }
        setGpsLocating(true);
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            }),
          );
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
            // keep fallback
          }

          onResolvedLocationChange(resolved);
        } catch {
          setGpsError('Failed to get current location');
        } finally {
          setGpsLocating(false);
        }
      } else {
        onResolvedLocationChange(null);
      }
    },
    [locationOption, onLocationChange, onResolvedLocationChange, primaryHome],
  );

  // ── Address autocomplete ──
  const handleAddressQueryChange = useCallback(
    (text: string) => {
      setAddressQuery(text);

      if (text.trim().length < 3) {
        setSuggestions([]);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoadingSuggestions(true);
        try {
          const data = await api.geo.autocompleteWithAbort(text, ac.signal);
          setSuggestions(data.suggestions || []);
        } catch (e: any) {
          if (e?.name !== 'AbortError' && e?.code !== 'ERR_CANCELED') {
            setSuggestions([]);
          }
        } finally {
          setLoadingSuggestions(false);
        }
      }, 300);
    },
    [],
  );

  const handleSuggestionSelect = useCallback(
    async (s: any) => {
      setSuggestions([]);
      setAddressQuery(s.label || s.primary_text);
      setEditingGpsAddress(false);

      try {
        const data = await api.geo.resolve(s.suggestion_id);
        const n = data.normalized;
        onResolvedLocationChange({
          mode: locationOption === 'current' ? 'current' : 'address',
          latitude: n.latitude ?? s.center?.lat,
          longitude: n.longitude ?? s.center?.lng,
          address: n.address,
          city: n.city || null,
          state: n.state || null,
          zip: n.zipcode || null,
          place_id: n.place_id || null,
        });
      } catch {
        if (s.center) {
          onResolvedLocationChange({
            mode: locationOption === 'current' ? 'current' : 'address',
            latitude: s.center.lat,
            longitude: s.center.lng,
            address: s.label || s.primary_text,
            city: null,
            state: null,
            zip: null,
          });
        }
      }
    },
    [locationOption, onResolvedLocationChange],
  );

  // ── Budget handlers ──
  const handlePresetPress = (amt: number) => {
    onCustomPriceChange(String(amt));
    onOpenToOffersChange(false);
  };

  // ── Helpers ──
  const formatLocationLabel = (loc: ResolvedLocation) => {
    const parts = [loc.address, loc.city, loc.state].filter(Boolean);
    return parts.join(', ') || 'Unknown location';
  };

  const showAddressInput =
    locationOption === 'other' || (locationOption === 'current' && editingGpsAddress);

  // Format date for datetime-local input
  const dateInputValue = scheduledDate
    ? new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';

  return (
    <div className="space-y-4">
      {/* When */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide">When</p>
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_PILLS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleSchedulePress(p.value)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                scheduleType === p.value
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border'
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {scheduleType === 'scheduled' && (
          <input
            type="datetime-local"
            value={dateInputValue}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => {
              const d = e.target.value ? new Date(e.target.value) : null;
              onScheduledDateChange(d);
            }}
            className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400 max-w-[260px]"
          />
        )}
      </div>

      {/* Where */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide">
          Where <span className="font-normal text-app-text-muted">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_PILLS.map((p) => {
            const isActive = locationOption === p.value;
            const isDisabled = p.value === 'home' && !primaryHome;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => !isDisabled && handleLocationPillPress(p.value)}
                disabled={isDisabled}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : isDisabled
                      ? 'bg-app-surface border-app-border text-app-text-muted opacity-40 cursor-not-allowed'
                      : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border'
                }`}
              >
                {p.icon} {p.label}
              </button>
            );
          })}
        </div>

        {/* Home resolved */}
        {locationOption === 'home' && primaryHome && (
          <div className="flex items-center gap-2 px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm">
            <Home className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
            <span className="text-app-text truncate">
              {[primaryHome.address, primaryHome.city, primaryHome.state].filter(Boolean).join(', ') || primaryHome.name}
            </span>
          </div>
        )}
        {locationOption === 'home' && !primaryHome && (
          <p className="text-xs text-amber-500 italic">No home address saved. Add one in Settings.</p>
        )}

        {/* GPS loading */}
        {locationOption === 'current' && gpsLocating && (
          <div className="flex items-center gap-2 px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm">
            <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
            <span className="text-app-text-secondary">Getting your location...</span>
          </div>
        )}
        {locationOption === 'current' && !gpsLocating && gpsError && (
          <p className="text-xs text-amber-500 italic">{gpsError}</p>
        )}
        {locationOption === 'current' && !gpsLocating && resolvedLocation && !editingGpsAddress && (
          <div className="flex items-center gap-2 px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm">
            <Navigation className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
            <span className="text-app-text truncate flex-1">{formatLocationLabel(resolvedLocation)}</span>
            <button
              type="button"
              onClick={() => {
                setEditingGpsAddress(true);
                setAddressQuery(resolvedLocation.address);
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Edit
            </button>
          </div>
        )}

        {/* Address autocomplete input */}
        {showAddressInput && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 border border-app-border rounded-lg px-3 py-2 bg-app-surface focus-within:ring-2 focus-within:ring-emerald-400">
              <Search className="w-4 h-4 text-app-text-muted flex-shrink-0" />
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => handleAddressQueryChange(e.target.value)}
                placeholder="Search for an address..."
                autoFocus
                className="flex-1 text-sm text-app-text bg-transparent outline-none placeholder:text-app-text-muted"
              />
              {loadingSuggestions && (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
              )}
              {addressQuery.length > 0 && !loadingSuggestions && (
                <button
                  type="button"
                  onClick={() => { setAddressQuery(''); setSuggestions([]); }}
                >
                  <X className="w-4 h-4 text-app-text-muted hover:text-app-text" />
                </button>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="border border-app-border rounded-lg bg-app-surface overflow-hidden">
                {suggestions.slice(0, 5).map((s: any) => (
                  <button
                    key={s.suggestion_id}
                    type="button"
                    onClick={() => handleSuggestionSelect(s)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-app-border-subtle last:border-b-0 hover:bg-app-hover text-left transition"
                  >
                    <MapPin className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-app-text truncate">{s.primary_text}</p>
                      <p className="text-xs text-app-text-muted truncate">{s.secondary_text}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {locationOption === 'other' && resolvedLocation && suggestions.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-app-text truncate">{formatLocationLabel(resolvedLocation)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide">
          Budget <span className="font-normal text-app-text-muted">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_PRESETS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => handlePresetPress(amt)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                customPrice === String(amt) && !openToOffers
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border'
              }`}
            >
              ${amt}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onOpenToOffersChange(!openToOffers);
              if (!openToOffers) onCustomPriceChange('');
            }}
            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
              openToOffers
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border'
            }`}
          >
            Open to offers
          </button>
        </div>

        {!openToOffers && (
          <input
            type="text"
            inputMode="decimal"
            placeholder="Custom amount ($)"
            value={customPrice}
            onChange={(e) => {
              onCustomPriceChange(e.target.value);
              onOpenToOffersChange(false);
            }}
            className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400 max-w-[200px] placeholder:text-app-text-muted"
          />
        )}
        {!customPrice && !openToOffers && (
          <p className="text-xs text-app-text-muted">Leave empty — AI will suggest a price range</p>
        )}
      </div>
    </div>
  );
}

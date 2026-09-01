'use client';

import { useEffect, useMemo, useState } from 'react';
import * as api from '@pantopus/api';
import AddressAutocomplete from './AddressAutocomplete';
import type { Home } from '@pantopus/types';
import { getAuthToken } from '@pantopus/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Normalized payload the Gig create route expects.
export type SelectedLocation = {
  mode: 'current' | 'home' | 'address' | 'custom';
  latitude: number;
  longitude: number;
  address: string; // full formatted address label
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  homeId?: string | null;
  place_id?: string | null;
  label: string;
};

type Props = {
  value: SelectedLocation | null;
  onChange: (v: SelectedLocation | null) => void;
  className?: string;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function coordsFromHome(h: Record<string, any>) {
  // Try multiple location formats
  
  // 1. GeoJSON object: { type: 'Point', coordinates: [lng, lat] }
  const loc = h?.location as Record<string, any> | undefined;
  const coords = loc?.coordinates as number[] | undefined;
  if (coords && coords.length >= 2) {
    const [lng, lat] = coords;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }

  // 2. Direct lat/lng fields on the home (backend may add these)
  if (Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude)) {
    return { latitude: h.latitude as number, longitude: h.longitude as number };
  }

  // 3. WKT string: "POINT(lng lat)"
  if (typeof h?.location === 'string') {
    const m = h.location.match(/POINT\(([^ ]+) ([^ ]+)\)/i);
    if (m) {
      const lng = parseFloat(m[1]), lat = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    }
  }

  // 4. Nested coords alias
  const locCoords = loc?.coords as number[] | undefined;
  if (locCoords && locCoords.length >= 2) {
    const [lng, lat] = locCoords;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }

  return { latitude: null as number | null, longitude: null as number | null };
}

function homeLabel(h: Record<string, any>) {
  const line1 = [h.address, (h.address2 || h.unit_number) as string | undefined].filter(Boolean).join(' ');
  const line2 = [h.city, h.state, (h.zipcode || h.zip_code) as string | undefined].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

async function reverseGeocode(lat: number, lon: number) {
  const r = await fetch(`${API_BASE}/api/geo/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { headers: { ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || 'Reverse geocode failed');
  const n = data?.normalized;
  if (!n?.address) throw new Error('Could not resolve address for that location');
  return n;
}

export default function LocationPicker({ value, onChange, className }: Props) {
  const [tab, setTab] = useState<'current' | 'home' | 'address'>(() => {
    if (!value) return 'current';
    return value.mode === 'home' ? 'home' : value.mode === 'current' ? 'current' : 'address';
  });

  const [homes, setHomes] = useState<Home[]>([]);
  const [homesLoading, setHomesLoading] = useState(false);
  const [homesError, setHomesError] = useState('');

  const [customText, setCustomText] = useState('');
  const [geoError, setGeoError] = useState('');

  // State for editing the current-location address inline
  const [editingCurrentAddress, setEditingCurrentAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [editGeoError, setEditGeoError] = useState('');
  const [editGeoLoading, setEditGeoLoading] = useState(false);

  useEffect(() => {
    // Keep tab in sync if parent changes value
    if (!value?.mode) return;
    setTab(value.mode === 'home' ? 'home' : value.mode === 'current' ? 'current' : 'address');
  }, [value?.mode]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setHomesLoading(true);
      setHomesError('');
      try {
        const res = await api.homes.getMyHomes();
        const list = (res as Record<string, any>)?.homes ?? (res as Record<string, any>)?.data ?? res ?? [];
        if (mounted) setHomes(Array.isArray(list) ? list : []);
      } catch (e: unknown) {
        if (mounted) setHomes([]);
        if (mounted) setHomesError(e instanceof Error ? e.message : 'Failed to load homes');
      } finally {
        if (mounted) setHomesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const currentSelectedLabel = useMemo(() => {
    if (!value) return '';
    return value.label || '';
  }, [value]);

  const pickCurrent = async () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          const n = await reverseGeocode(latitude, longitude);

          onChange({
            mode: 'current',
            latitude,
            longitude,
            address: n.address,
            city: n.city || null,
            state: n.state || null,
            zip: n.zipcode || n.zip || null,
            place_id: n.place_id || null,
            label: n.address || 'Current location',
          });
          setTab('current');
        } catch (e: unknown) {
          setGeoError(e instanceof Error ? e.message : 'Failed to get current location');
        }
      },
      (err) => {
        setGeoError(err?.message || 'Failed to get current location');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const pickHome = async (homeId: string) => {
    const h = homes.find((x) => x.id === homeId) as (Home & Record<string, any>) | undefined;
    if (!h) return;

    setHomesError('');
    let { latitude, longitude } = coordsFromHome(h);

    // If no coords, try to forward-geocode from the home's address
    if (latitude == null || longitude == null) {
      const addr = homeLabel(h);
      if (!addr) {
        setHomesError('That home has no address or coordinates.');
        return;
      }

      try {
        setHomesError('');
        // Use the autocomplete endpoint to resolve the address
        const data = await api.geo.autocomplete(addr);
        const best = (data?.suggestions || [])[0];
        if (best?.center) {
          longitude = best.center.lng;
          latitude = best.center.lat;

          // Save coordinates back to the home so this doesn't happen again
          try {
            await api.homes.updateHome(h.id, {
              location: { latitude, longitude },
            } as Record<string, any>);
          } catch {
            // Non-critical, just use the coords for this gig
          }
        }
      } catch {
        // geocode failed
      }
    }

    if (latitude == null || longitude == null) {
      setHomesError('Could not determine coordinates for this home. Try using "Address" mode instead.');
      return;
    }

    const addr = homeLabel(h);

    onChange({
      mode: 'home',
      homeId: h.id,
      latitude,
      longitude,
      address: addr,
      city: (h.city as string) || null,
      state: (h.state as string) || null,
      zip: ((h as Record<string, any>).zipcode || (h as Record<string, any>).zip_code) as string || null,
      label: addr,
    });
    setTab('home');
  };

  const selectCustomNormalized = (n: Record<string, any>) => {
    const latitude = n.latitude as number ?? null;
    const longitude = n.longitude as number ?? null;

    if (latitude == null || longitude == null || !n.address) {
      onChange(null);
      return;
    }

    onChange({
      mode: 'address',
      latitude,
      longitude,
      address: n.address as string,
      city: (n.city as string) || null,
      state: (n.state as string) || null,
      zip: (n.zipcode as string) || null,
      place_id: (n.place_id as string) || null,
      label: (n.address as string) || 'Custom address',
    });
    setTab('address');
  };

  const startEditCurrentAddress = () => {
    setEditedAddress(value?.address || '');
    setEditingCurrentAddress(true);
    setEditGeoError('');
  };

  const cancelEditCurrentAddress = () => {
    setEditingCurrentAddress(false);
    setEditedAddress('');
    setEditGeoError('');
  };

  const saveEditedCurrentAddress = async () => {
    if (!editedAddress.trim()) {
      setEditGeoError('Please enter an address');
      return;
    }

    setEditGeoLoading(true);
    setEditGeoError('');

    try {
      const data = await api.geo.autocomplete(editedAddress.trim());
      const best = (data?.suggestions || [])[0];

      if (!best?.center) {
        setEditGeoError('Could not find that address. Try being more specific.');
        return;
      }

      // Resolve the best suggestion to get structured address fields
      const resolved = await api.geo.resolve(best.suggestion_id);
      const n = resolved.normalized;

      onChange({
        mode: 'current',
        latitude: n.latitude ?? best.center.lat,
        longitude: n.longitude ?? best.center.lng,
        address: n.address || best.label,
        city: n.city || null,
        state: n.state || null,
        zip: n.zipcode || null,
        place_id: n.place_id || null,
        label: n.address || best.label,
      });

      setEditingCurrentAddress(false);
      setEditedAddress('');
    } catch (e: unknown) {
      setEditGeoError(e instanceof Error ? e.message : 'Failed to resolve address');
    } finally {
      setEditGeoLoading(false);
    }
  };

  return (
    <div className={classNames('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('current')}
          className={classNames(
            'px-3 py-1.5 rounded-full text-sm font-medium border',
            tab === 'current'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-app-surface text-app-text-strong border-app-border hover:bg-app-hover'
          )}
        >
          Current
        </button>
        <button
          type="button"
          onClick={() => setTab('home')}
          className={classNames(
            'px-3 py-1.5 rounded-full text-sm font-medium border',
            tab === 'home'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-app-surface text-app-text-strong border-app-border hover:bg-app-hover'
          )}
        >
          Home
        </button>
        <button
          type="button"
          onClick={() => setTab('address')}
          className={classNames(
            'px-3 py-1.5 rounded-full text-sm font-medium border',
            tab === 'address'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-app-surface text-app-text-strong border-app-border hover:bg-app-hover'
          )}
        >
          Address
        </button>
      </div>

      {tab === 'current' && (
        <div className="rounded-xl border border-app-border p-4 bg-app-surface">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-app-text">Use your current location</div>
              <div className="text-xs text-app-text-secondary">We take a one-time snapshot (not continuous tracking).</div>
            </div>
            <button
              type="button"
              onClick={pickCurrent}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black"
            >
              Use current
            </button>
          </div>

          {value?.mode === 'current' && !editingCurrentAddress && (
            <p className="mt-2 text-xs text-amber-600">
              GPS may not be perfectly accurate. You can edit the address below to use your exact location.
            </p>
          )}

          {geoError && <p className="mt-2 text-sm text-red-600">{geoError}</p>}
        </div>
      )}

      {tab === 'home' && (
        <div className="rounded-xl border border-app-border p-4 bg-app-surface">
          <div className="text-sm font-semibold text-app-text">Pick a home</div>
          <div className="text-xs text-app-text-secondary">Fastest option for repeat posting. Uses your home coordinates.</div>

          <div className="mt-3">
            {homesLoading ? (
              <p className="text-sm text-app-text-secondary">Loading homes…</p>
            ) : homes.length === 0 ? (
              <p className="text-sm text-app-text-secondary">
                No homes found yet. For MVP, you can post using Current or Address.
              </p>
            ) : (
              <select
                className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={value?.mode === 'home' ? (value.homeId || '') : ''}
                onChange={(e) => pickHome(e.target.value)}
              >
                <option value="" disabled>
                  Select a home…
                </option>
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {homeLabel(h as unknown as Record<string, any>)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {homesError && <p className="mt-2 text-sm text-red-600">{homesError}</p>}
        </div>
      )}

      {tab === 'address' && (
        <div className="rounded-xl border border-app-border p-4 bg-app-surface space-y-2">
          <div>
            <div className="text-sm font-semibold text-app-text">Search an address</div>
            <div className="text-xs text-app-text-secondary">Pick a suggestion to verify and capture coordinates.</div>
          </div>

          <AddressAutocomplete
            value={customText}
            onChange={setCustomText}
            onSelectNormalized={selectCustomNormalized}
            placeholder="123 Main St"
          />

          <div className="text-xs text-app-text-secondary">
            Tip: after you select an address, you can still edit the title/description above before posting.
          </div>
        </div>
      )}

      {value && (
        <div className="rounded-xl border border-app-border p-3 bg-app-surface">
          <div className="text-xs text-app-text-secondary">Selected</div>

          {editingCurrentAddress ? (
            <div className="mt-1 space-y-2">
              <input
                type="text"
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveEditedCurrentAddress(); }
                  if (e.key === 'Escape') cancelEditCurrentAddress();
                }}
                placeholder="Enter your exact address..."
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-app-text-secondary">
                Edit to your exact address since GPS may not be accurate.
              </p>
              {editGeoError && <p className="text-xs text-red-600">{editGeoError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEditedCurrentAddress}
                  disabled={editGeoLoading}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {editGeoLoading ? 'Resolving...' : 'Save Address'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditCurrentAddress}
                  className="px-3 py-1.5 border border-app-border text-app-text-strong text-xs font-medium rounded-lg hover:bg-app-hover transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-app-text min-w-0">
                {currentSelectedLabel || value.address}
              </div>
              {value.mode === 'current' && (
                <button
                  type="button"
                  onClick={startEditCurrentAddress}
                  className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 transition"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
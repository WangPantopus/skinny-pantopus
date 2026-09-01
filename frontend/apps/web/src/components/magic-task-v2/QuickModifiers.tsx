'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { ScheduleType, Home } from '@pantopus/types';
import AddressAutocomplete from '../AddressAutocomplete';

type LocationTab = 'home' | 'current' | 'other' | 'remote';
type PriceOption = 'ai' | 'custom';

/**
 * Normalized location payload the magic-post endpoint expects.
 * Backend's `normalizeMagicPostLocation()` drops any location that is missing
 * a finite latitude, longitude, or non-empty address — so all three must be
 * set before we treat a physical location as "resolved".
 *
 * For tasks that don't need a physical location (logo design, translation,
 * online tutoring, etc.) we use a separate sentinel { mode: 'remote' } so the
 * Post-Task gate is satisfied without requiring lat/lng/address.
 */
export type SelectedLocation =
  | {
      mode: 'home' | 'current' | 'address';
      latitude: number;
      longitude: number;
      address: string;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
      homeId?: string | null;
      place_id?: string | null;
    }
  | { mode: 'remote' };

interface QuickModifiersProps {
  scheduleType: ScheduleType;
  onScheduleChange: (s: ScheduleType) => void;
  selectedLocation: SelectedLocation | null;
  onSelectedLocationChange: (loc: SelectedLocation | null) => void;
  priceOption: PriceOption;
  onPriceChange: (p: PriceOption) => void;
  customPrice: string;
  onCustomPriceChange: (v: string) => void;
  scheduledDate: string;
  onScheduledDateChange: (d: string) => void;
}

const SCHEDULE_PILLS: { value: ScheduleType; icon: string; label: string }[] = [
  { value: 'asap', icon: '⚡', label: 'Now' },
  { value: 'today', icon: '📅', label: 'Today' },
  { value: 'scheduled', icon: '🗓️', label: 'Schedule' },
];

const LOCATION_PILLS: { value: LocationTab; icon: string; label: string }[] = [
  { value: 'home', icon: '🏠', label: 'My Home' },
  { value: 'current', icon: '📍', label: 'Current' },
  { value: 'other', icon: '📌', label: 'Other' },
  { value: 'remote', icon: '💻', label: 'Remote' },
];

const PRICE_PILLS: { value: PriceOption; icon: string; label: string }[] = [
  { value: 'ai', icon: '💰', label: 'AI suggested' },
  { value: 'custom', icon: '💰', label: 'Custom' },
];

// ── Helpers (mirrored from LocationPicker.tsx, extended to handle the real Home schema) ──
function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coordsFromHome(h: Record<string, any>): { latitude: number | null; longitude: number | null } {
  // 1. map_center_lat / map_center_lng — the actual flat coordinate columns on Home (see migration 082).
  //    These are the most reliable source when the home was created through the standard onboarding.
  const mapLat = toFiniteNumber(h?.map_center_lat);
  const mapLng = toFiniteNumber(h?.map_center_lng);
  if (mapLat != null && mapLng != null) {
    return { latitude: mapLat, longitude: mapLng };
  }

  // 2. GeoJSON { type:'Point', coordinates:[lng,lat] } — if Supabase serialized the PostGIS column.
  const loc = h?.location as Record<string, any> | undefined;
  const coords = loc?.coordinates as number[] | undefined;
  if (coords && coords.length >= 2) {
    const lat = toFiniteNumber(coords[1]);
    const lng = toFiniteNumber(coords[0]);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  // 3. Direct lat/lng fields (some API shapes alias them at the top level).
  const directLat = toFiniteNumber(h?.latitude);
  const directLng = toFiniteNumber(h?.longitude);
  if (directLat != null && directLng != null) {
    return { latitude: directLat, longitude: directLng };
  }

  // 4. WKT string "POINT(lng lat)".
  if (typeof h?.location === 'string') {
    const m = h.location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) {
      const lng = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    }
  }

  return { latitude: null, longitude: null };
}

function homeLabel(h: Record<string, any>): string {
  const line1 = [h.address, (h.address2 || h.unit_number) as string | undefined].filter(Boolean).join(' ');
  const line2 = [h.city, h.state, (h.zipcode || h.zip_code) as string | undefined].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

function initialTabFor(loc: SelectedLocation | null): LocationTab {
  if (loc?.mode === 'current') return 'current';
  if (loc?.mode === 'address') return 'other';
  if (loc?.mode === 'remote') return 'remote';
  return 'home';
}

export default function QuickModifiers({
  scheduleType,
  onScheduleChange,
  selectedLocation,
  onSelectedLocationChange,
  priceOption,
  onPriceChange,
  customPrice,
  onCustomPriceChange,
  scheduledDate,
  onScheduledDateChange,
}: QuickModifiersProps) {
  // ── Location state ──
  const [locationTab, setLocationTab] = useState<LocationTab>(() => initialTabFor(selectedLocation));
  const [homes, setHomes] = useState<Home[]>([]);
  const [primaryHome, setPrimaryHome] = useState<Home | null>(null);
  const [homesLoading, setHomesLoading] = useState(false);
  const [homesError, setHomesError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [customText, setCustomText] = useState('');
  const [editingCurrentAddress, setEditingCurrentAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [editGeoError, setEditGeoError] = useState('');
  const [editGeoLoading, setEditGeoLoading] = useState(false);

  const showDatePicker = scheduleType === 'scheduled';
  const showPriceInput = priceOption === 'custom';

  // Load user's homes on mount so "My Home" can auto-resolve. Fetch both the full list
  // (for the multi-home dropdown) and the primary residence (for the default selection).
  useEffect(() => {
    let mounted = true;
    (async () => {
      setHomesLoading(true);
      setHomesError('');
      try {
        const [myRes, primaryRes] = await Promise.all([
          api.homes.getMyHomes().catch(() => ({ homes: [] as Home[] })),
          api.homes.getPrimaryHome().catch(() => ({ home: null as Home | null })),
        ]);
        const list = (myRes as { homes?: Home[] })?.homes ?? [];
        const primary = (primaryRes as { home?: Home | null })?.home ?? null;
        if (mounted) {
          const safeList = Array.isArray(list) ? list : [];
          // Make sure the primary home is present in the list even if getMyHomes missed it.
          const merged = primary && !safeList.some((h) => h.id === primary.id)
            ? [primary, ...safeList]
            : safeList;
          setHomes(merged);
          setPrimaryHome(primary);
        }
      } catch (e: unknown) {
        if (mounted) {
          setHomes([]);
          setHomesError(e instanceof Error ? e.message : 'Failed to load homes');
        }
      } finally {
        if (mounted) setHomesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Resolvers ──────────────────────────────────────────────────────────
  const resolveHome = async (home: Home) => {
    const h = home as Home & Record<string, any>;
    let { latitude, longitude } = coordsFromHome(h);
    let usedFallbackGeocode = false;

    if (latitude == null || longitude == null) {
      // The home has no stored coordinates — forward-geocode its address as a fallback.
      const addr = homeLabel(h);
      if (!addr) {
        setHomesError('That home has no address on file.');
        return;
      }
      try {
        const data = await api.geo.autocomplete(addr);
        const best = data?.suggestions?.[0];
        if (best?.center && Number.isFinite(best.center.lat) && Number.isFinite(best.center.lng)) {
          latitude = best.center.lat;
          longitude = best.center.lng;
          usedFallbackGeocode = true;
        }
      } catch {
        // fall through — handled below
      }
    }

    if (latitude == null || longitude == null) {
      setHomesError(
        'We have this home on file but no coordinates for it yet. Open the home in Settings to verify its location, or use Current / Other for now.',
      );
      return;
    }

    // If we had to geocode, persist the coords back so we don't hit this path next time.
    if (usedFallbackGeocode) {
      try {
        await api.homes.updateHome(h.id, {
          location: { latitude, longitude },
        } as Record<string, any>);
      } catch {
        // Non-critical — keep the coords for this post.
      }
    }

    const addr = homeLabel(h);
    onSelectedLocationChange({
      mode: 'home',
      homeId: h.id,
      latitude,
      longitude,
      address: addr,
      city: (h.city as string) || null,
      state: (h.state as string) || null,
      zip: ((h.zipcode || h.zip_code) as string) || null,
    });
  };

  const pickHome = async (homeId?: string) => {
    setHomesError('');
    // Preference: explicit homeId > primary residence > first home in list.
    const target = homeId
      ? homes.find((x) => x.id === homeId)
      : primaryHome || homes[0];
    if (!target) {
      setHomesError('No homes on file yet. Add one in Settings, or use Current / Other.');
      return;
    }
    await resolveHome(target);
  };

  const pickCurrent = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const r = await api.geo.reverseGeocode(latitude, longitude);
          const n = r.normalized;
          if (!n?.address) throw new Error('Could not resolve an address for that location.');
          onSelectedLocationChange({
            mode: 'current',
            latitude,
            longitude,
            address: n.address,
            city: n.city || null,
            state: n.state || null,
            zip: n.zipcode || null,
            place_id: n.place_id || null,
          });
        } catch (e: unknown) {
          setGeoError(e instanceof Error ? e.message : 'Failed to resolve current location');
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoError(err?.message || 'Failed to get current location');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  // ── Tab selection ──────────────────────────────────────────────────────
  const onSelectLocationTab = async (tab: LocationTab) => {
    setLocationTab(tab);
    setHomesError('');
    setGeoError('');
    setEditingCurrentAddress(false);
    // When changing tab, discard the previous resolved location unless it matches
    const currentMatches =
      (tab === 'home' && selectedLocation?.mode === 'home') ||
      (tab === 'current' && selectedLocation?.mode === 'current') ||
      (tab === 'other' && selectedLocation?.mode === 'address') ||
      (tab === 'remote' && selectedLocation?.mode === 'remote');
    if (!currentMatches) {
      onSelectedLocationChange(null);
    }
    if (tab === 'home') {
      // Auto-resolve immediately
      await pickHome();
    } else if (tab === 'current') {
      // Auto-trigger geolocation
      pickCurrent();
    } else if (tab === 'other') {
      // Wait for user to type + pick
      setCustomText('');
    } else if (tab === 'remote') {
      // No physical location needed — set the sentinel so canPost is satisfied.
      onSelectedLocationChange({ mode: 'remote' });
    }
  };

  const onAutocompleteSelect = (n: {
    address: string;
    city: string;
    state: string;
    zipcode: string;
    latitude?: number | null;
    longitude?: number | null;
    place_id?: string | null;
  }) => {
    if (
      n.latitude == null ||
      n.longitude == null ||
      !Number.isFinite(n.latitude) ||
      !Number.isFinite(n.longitude) ||
      !n.address
    ) {
      return;
    }
    onSelectedLocationChange({
      mode: 'address',
      latitude: n.latitude,
      longitude: n.longitude,
      address: n.address,
      city: n.city || null,
      state: n.state || null,
      zip: n.zipcode || null,
      place_id: n.place_id || null,
    });
  };

  // ── Edit-current-address flow ──────────────────────────────────────────
  const startEditCurrentAddress = () => {
    const addr = selectedLocation && selectedLocation.mode !== 'remote' ? selectedLocation.address : '';
    setEditedAddress(addr || '');
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
      const best = data?.suggestions?.[0];
      if (!best?.center) {
        setEditGeoError('Could not find that address. Try being more specific.');
        return;
      }
      const resolved = await api.geo.resolve(best.suggestion_id);
      const n = resolved.normalized;
      onSelectedLocationChange({
        mode: 'current',
        latitude: n.latitude ?? best.center.lat,
        longitude: n.longitude ?? best.center.lng,
        address: n.address || best.label,
        city: n.city || null,
        state: n.state || null,
        zip: n.zipcode || null,
        place_id: n.place_id || null,
      });
      setEditingCurrentAddress(false);
      setEditedAddress('');
    } catch (e: unknown) {
      setEditGeoError(e instanceof Error ? e.message : 'Failed to resolve address');
    } finally {
      setEditGeoLoading(false);
    }
  };

  // ── Derived booleans for UI ────────────────────────────────────────────
  const tabMatchesSelection =
    (locationTab === 'home' && selectedLocation?.mode === 'home') ||
    (locationTab === 'current' && selectedLocation?.mode === 'current') ||
    (locationTab === 'other' && selectedLocation?.mode === 'address') ||
    (locationTab === 'remote' && selectedLocation?.mode === 'remote');
  const showHomePicker = locationTab === 'home' && homes.length > 1;
  const showOtherAutocomplete = locationTab === 'other';
  const showRemoteHint = locationTab === 'remote';
  const showSelectedAddress =
    !!selectedLocation &&
    tabMatchesSelection &&
    selectedLocation.mode !== 'remote'; // remote has no address to display

  return (
    <div className="modifiers">
      {/* ── WHEN ──────────────────────────────────────────────── */}
      <section className="group">
        <h4 className="group-label">When</h4>
        <div className="pill-row">
          {SCHEDULE_PILLS.map((p) => (
            <button
              key={p.value}
              className={`pill${scheduleType === p.value ? ' active' : ''}`}
              onClick={() => onScheduleChange(p.value)}
              type="button"
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        {showDatePicker && (
          <div className="group-input">
            <input
              type="datetime-local"
              className="modifier-input"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
            />
          </div>
        )}
      </section>

      {/* ── WHERE ─────────────────────────────────────────────── */}
      <section className="group">
        <h4 className="group-label">Where</h4>
        <div className="pill-row">
          {LOCATION_PILLS.map((p) => (
            <button
              key={p.value}
              className={`pill${locationTab === p.value ? ' active' : ''}`}
              onClick={() => onSelectLocationTab(p.value)}
              type="button"
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        {locationTab !== 'remote' && (
          <p className="privacy-note">
            🔒 Your exact address stays private — helpers only see the general area until you accept their offer.
          </p>
        )}

        {showHomePicker && (
          <div className="group-input">
            <select
              className="modifier-input"
              value={selectedLocation && selectedLocation.mode === 'home' ? (selectedLocation.homeId || '') : ''}
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
          </div>
        )}

        {showOtherAutocomplete && (
          <div className="group-input other-autocomplete">
            <AddressAutocomplete
              value={customText}
              onChange={setCustomText}
              onSelectNormalized={onAutocompleteSelect}
              placeholder="Start typing an address…"
            />
          </div>
        )}

        {showRemoteHint && (
          <div className="remote-hint">
            <span className="remote-hint-icon">💻</span>
            <span>Remote task — done online or over the phone. No address needed.</span>
          </div>
        )}

        {(homesLoading && locationTab === 'home') && (
          <div className="location-status">Loading your home…</div>
        )}
        {(geoLoading && locationTab === 'current') && (
          <div className="location-status">Locating you…</div>
        )}
        {homesError && locationTab === 'home' && (
          <div className="location-error">{homesError}</div>
        )}
        {geoError && locationTab === 'current' && (
          <div className="location-error">{geoError}</div>
        )}

        {showSelectedAddress && !editingCurrentAddress && selectedLocation && (
          <div className="selected-address">
            <span className="selected-icon">📍</span>
            <span className="selected-text" title={selectedLocation.address}>
              {selectedLocation.address}
            </span>
            {locationTab === 'current' && (
              <button
                type="button"
                onClick={startEditCurrentAddress}
                className="selected-edit"
              >
                Edit
              </button>
            )}
            {locationTab === 'current' && (
              <button
                type="button"
                onClick={pickCurrent}
                className="selected-edit"
                title="Re-locate"
              >
                ↻
              </button>
            )}
          </div>
        )}

        {editingCurrentAddress && (
          <div className="edit-address-box">
            <input
              type="text"
              value={editedAddress}
              onChange={(e) => setEditedAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveEditedCurrentAddress(); }
                if (e.key === 'Escape') cancelEditCurrentAddress();
              }}
              placeholder="Enter your exact address…"
              className="modifier-input"
              autoFocus
            />
            <p className="edit-address-hint">
              GPS can be imprecise — you can set your exact address here.
            </p>
            {editGeoError && <p className="location-error">{editGeoError}</p>}
            <div className="edit-address-actions">
              <button
                type="button"
                onClick={saveEditedCurrentAddress}
                disabled={editGeoLoading}
                className="edit-save-btn"
              >
                {editGeoLoading ? 'Resolving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEditCurrentAddress}
                className="edit-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── PRICE ─────────────────────────────────────────────── */}
      <section className="group">
        <h4 className="group-label">Price</h4>
        <div className="pill-row">
          {PRICE_PILLS.map((p) => (
            <button
              key={p.value}
              className={`pill${priceOption === p.value ? ' active' : ''}`}
              onClick={() => onPriceChange(p.value)}
              type="button"
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        {showPriceInput && (
          <div className="group-input">
            <input
              type="number"
              className="modifier-input"
              placeholder="Your price ($)"
              value={customPrice}
              onChange={(e) => onCustomPriceChange(e.target.value)}
              min="1"
              step="1"
            />
          </div>
        )}
      </section>

      <style jsx>{`
        .modifiers {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .group-label {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgb(var(--app-text-muted));
        }
        .pill-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 9999px;
          border: 1px solid rgb(var(--app-border));
          background: rgb(var(--app-surface));
          color: rgb(var(--app-text-secondary));
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .pill:hover {
          border-color: rgb(var(--app-border-strong));
          background: rgb(var(--app-surface-raised));
        }
        .pill.active {
          background: var(--color-primary-600);
          color: #ffffff;
          border-color: var(--color-primary-600);
        }
        .group-input {
          animation: slideDown 0.2s ease;
        }
        .other-autocomplete {
          /* Give the autocomplete popup room to render without the flex row squeezing it */
          width: 100%;
        }
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 120px; }
        }
        .modifier-input {
          width: 100%;
          max-width: 320px;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid rgb(var(--app-border));
          border-radius: 10px;
          outline: none;
          background: rgb(var(--app-surface));
          color: rgb(var(--app-text));
          color-scheme: light dark;
          transition: border-color 0.2s, background 0.2s;
          font-family: inherit;
        }
        .modifier-input::placeholder {
          color: rgb(var(--app-text-muted));
        }
        .modifier-input:focus {
          border-color: var(--color-primary-600);
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }
        .modifier-input[type='datetime-local']::-webkit-calendar-picker-indicator {
          opacity: 0.7;
          cursor: pointer;
        }
        @media (prefers-color-scheme: dark) {
          .modifier-input[type='datetime-local']::-webkit-calendar-picker-indicator {
            filter: invert(1);
            opacity: 0.8;
          }
        }

        /* ─── Privacy reassurance under Where pills ─── */
        .privacy-note {
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
          color: rgb(var(--app-text-muted));
        }

        /* ─── Remote hint ─── */
        .remote-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: rgb(var(--app-text-secondary));
          background: rgb(var(--app-surface-raised));
          border: 1px dashed rgb(var(--app-border));
          border-radius: 10px;
        }
        .remote-hint-icon {
          flex-shrink: 0;
        }

        /* ─── Selected address display ─── */
        .selected-address {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(2, 132, 199, 0.08);
          border: 1px solid rgba(2, 132, 199, 0.25);
          border-radius: 10px;
          font-size: 13px;
          color: rgb(var(--app-text));
        }
        .selected-icon {
          flex-shrink: 0;
        }
        .selected-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .selected-edit {
          flex-shrink: 0;
          padding: 2px 8px;
          font-size: 12px;
          color: var(--color-primary-600);
          background: transparent;
          border: 1px solid rgb(var(--app-border));
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .selected-edit:hover {
          background: rgb(var(--app-surface-raised));
        }
        @media (prefers-color-scheme: dark) {
          .selected-edit {
            color: var(--color-primary-300);
          }
        }

        /* ─── Inline edit box for Current ─── */
        .edit-address-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px;
          background: rgb(var(--app-surface-raised));
          border: 1px solid rgb(var(--app-border));
          border-radius: 10px;
        }
        .edit-address-hint {
          margin: 0;
          font-size: 11px;
          color: rgb(var(--app-text-muted));
        }
        .edit-address-actions {
          display: flex;
          gap: 8px;
        }
        .edit-save-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          background: var(--color-primary-600);
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        .edit-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .edit-cancel-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: rgb(var(--app-text-secondary));
          background: transparent;
          border: 1px solid rgb(var(--app-border));
          border-radius: 8px;
          cursor: pointer;
        }

        /* ─── Status / error text ─── */
        .location-status {
          font-size: 12px;
          color: rgb(var(--app-text-muted));
          padding: 2px 4px;
        }
        .location-error {
          font-size: 12px;
          color: var(--color-error);
          padding: 2px 4px;
        }
      `}</style>
    </div>
  );
}

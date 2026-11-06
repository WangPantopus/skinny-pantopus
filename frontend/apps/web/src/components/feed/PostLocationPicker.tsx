'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import {
  Activity, Building2, Bus, Camera, Coffee, GraduationCap, Landmark, MapPin, Palette, PawPrint, Plane, ShoppingBag,
  Stethoscope, Ticket, Trees, UsersRound, Utensils, Waves, type LucideIcon,
} from 'lucide-react';
import * as api from '@pantopus/api';

export interface PostLocation {
  latitude: number;
  longitude: number;
  locationName: string;
  /** Many venues have none; a post can't carry an empty one. */
  locationAddress?: string;
  source?: 'gps' | 'search';
  gpsTimestamp?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  /** A row of the place list: its id (`osm:…` records the post as OpenStreetMap's) and its kind. */
  geocodePlaceId?: string;
  geocodeAccuracy?: string;
}

interface PostLocationPickerProps {
  value: PostLocation | null;
  onChange: (loc: PostLocation | null) => void;
  accentColor?: string;
  /** The chip's text in light mode (defaults to `accentColor`). */
  textColor?: string;
  /** The chip's text in dark mode (defaults to `textColor`). */
  darkTextColor?: string;
}

type PickerMode = 'closed' | 'search';

type GeoPlace = api.geo.GeoPlace;

// Where the list and the name search look: the device's fix, or without one the saved viewing area. Only a fix
// (gpsTimestamp) says the person is there.
type PlaceAnchor = { latitude: number; longitude: number; gpsTimestamp?: string; label?: string };

type NearbyList = {
  status: 'waiting' | 'ready' | 'failed';
  places: GeoPlace[];
  locality: GeoPlace | null;
  attribution: string | null;
  /** The server is still gathering a new area's venues. */
  finding: boolean;
};
const NO_NEARBY_LIST: NearbyList = { status: 'waiting', places: [], locality: null, attribution: null, finding: false };

// As the apps: a slow fix gets 4 seconds, and a list still gathering is asked for again every 3 seconds, 8 times.
const FIX_WAIT_MS = 4000;
const FINDING_POLL_MS = 3000;
const MAX_FINDING_POLLS = 8;

// The popover's width (w-72) and the gap it keeps from the edge of the screen.
const POPOVER_WIDTH = 288;
const SCREEN_GUTTER = 16;

// Row icons by the server's venue `icon` key, as the apps draw them; a pin for a town or anything unknown.
const PLACE_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  bar: Utensils,
  cafe: Coffee,
  school: GraduationCap,
  worship: Landmark,
  museum: Landmark,
  government: Landmark,
  library: Landmark,
  park: Trees,
  stadium: Ticket,
  venue: Ticket,
  arts: Palette,
  sports: Activity,
  attraction: Camera,
  zoo: PawPrint,
  pet: PawPrint,
  shop: ShoppingBag,
  hotel: Building2,
  transit: Bus,
  airport: Plane,
  health: Stethoscope,
  community: UsersRound,
  water: Waves,
};

/** A venue: its kind and address ("Barbecue restaurant · 123 Elm St"). Otherwise whichever line the row has. */
function placeDetail(place: GeoPlace): string {
  const venueLine = place.icon ? [place.category, place.address].filter(Boolean).join(' · ') : '';
  return venueLine || place.address || place.category || (place.full_address !== place.name && place.full_address) || '';
}

/** "450 ft" under a tenth of a mile, "0.3 mi" beyond. */
function placeDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(1)} mi`;
}

function PlaceRow({ place, onSelect }: { place: GeoPlace; onSelect: (place: GeoPlace) => void }) {
  const Icon = (place.icon && PLACE_ICONS[place.icon]) || MapPin;
  const detail = placeDetail(place);
  const distance = place.contains ? 'Here' : place.distance_m != null ? placeDistance(place.distance_m) : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(place)}
      className="w-full text-left px-3 py-2.5 hover-bg-app transition flex items-start gap-2.5 border-b border-app last:border-0"
    >
      <Icon className="w-3.5 h-3.5 text-app-muted flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-app truncate">{place.name}</div>
        {detail && <div className="text-[10px] text-app-muted truncate">{detail}</div>}
      </div>
      {distance && <span className="flex-shrink-0 mt-0.5 text-[10px] tabular-nums text-app-muted">{distance}</span>}
    </button>
  );
}

function FindingRows() {
  return (
    <div role="status" aria-label="Finding places nearby" className="px-3 py-2.5 space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="space-y-1.5 animate-pulse">
          <div className="h-2.5 w-2/3 rounded bg-surface-muted" />
          <div className="h-2 w-1/2 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

// The chip's text follows the theme, like the post-type labels on PostCard (inline colors can't reach `dark:`).
const CHIP_THEMED_TEXT = 'text-[color:var(--post-type-text)] dark:text-[color:var(--post-type-text-dark)]';

// Simple debounce hook
function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PostLocationPicker({
  value, onChange, accentColor = '#0284c7', textColor, darkTextColor,
}: PostLocationPickerProps) {
  const [mode, setMode] = useState<PickerMode>('closed');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Record<string, any>[]>([]);
  const [foundPlaces, setFoundPlaces] = useState<GeoPlace[]>([]);
  const [foundAttribution, setFoundAttribution] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PlaceAnchor | null>(null);
  const [anchorSettled, setAnchorSettled] = useState(false);
  const [nearby, setNearby] = useState<NearbyList>(NO_NEARBY_LIST);
  const [nearbyAttempt, setNearbyAttempt] = useState(0);
  const [popoverLeft, setPopoverLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The newest pick wins: a slow lookup still running when another place is picked must not replace it.
  const latestPick = useRef(0);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebounced(trimmedQuery, 250);
  // Two characters start a search, as in the apps; until then the nearby list stays.
  const searchActive = trimmedQuery.length >= 2;
  const searching = searchActive && (loading || trimmedQuery !== debouncedQuery);
  const attribution = searchActive ? (searching ? null : foundAttribution) : nearby.attribution;
  // The device's fix goes with whatever is picked: it says where the person is, not where the place is.
  const deviceFix = anchor?.gpsTimestamp
    ? { gpsTimestamp: anchor.gpsTimestamp, gpsLatitude: anchor.latitude, gpsLongitude: anchor.longitude }
    : {};

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (mode !== 'closed') setMode('closed');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mode]);

  // Focus input when opening, except on a touch screen, where the keyboard would cover the nearby list
  useEffect(() => {
    if (mode === 'search' && inputRef.current && window.matchMedia?.('(pointer: fine)').matches) {
      inputRef.current.focus();
    }
  }, [mode]);

  // The list's anchor: the device's fix, or the saved viewing area if there's no fix (yet). A fix that comes late,
  // such as after the browser's permission question, still takes over.
  useEffect(() => {
    if (mode !== 'search') return;
    let closed = false;
    let askedForArea = false;
    const fallBackToSavedArea = async () => {
      if (askedForArea) return;
      askedForArea = true;
      try {
        const area = (await api.location.resolveLocation())?.viewingLocation;
        if (!closed && area?.latitude != null && area?.longitude != null) {
          const { latitude, longitude, label } = area;
          setAnchor((current) => (current?.gpsTimestamp ? current : { latitude, longitude, label: label || undefined }));
        }
      } catch {
        // No list around a saved area: the name search and the hint remain.
      }
      if (!closed) setAnchorSettled(true);
    };
    const fixWait = setTimeout(() => void fallBackToSavedArea(), FIX_WAIT_MS);
    const noFix = () => {
      clearTimeout(fixWait);
      if (!closed) void fallBackToSavedArea();
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fixWait);
          if (closed) return;
          setAnchor({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            gpsTimestamp: new Date(pos.timestamp || Date.now()).toISOString(),
          });
          setAnchorSettled(true);
        },
        noFix,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    } else {
      noFix();
    }
    return () => {
      closed = true;
      clearTimeout(fixWait);
      setAnchor(null);
      setAnchorSettled(false);
    };
  }, [mode]);

  // The nearby list. A reply still `loading` is shown and asked for again until the venues arrive.
  useEffect(() => {
    setNearby(NO_NEARBY_LIST);
    if (mode !== 'search' || !anchor) return;
    const controller = new AbortController();
    let nextAsk: ReturnType<typeof setTimeout> | undefined;
    const ask = async (asked: number) => {
      try {
        const reply = await api.geo.nearbyPlaces(anchor.latitude, anchor.longitude, controller.signal);
        if (controller.signal.aborted) return;
        const finding = reply.loading === true && asked < MAX_FINDING_POLLS;
        setNearby({
          status: 'ready',
          places: reply.places || [],
          locality: reply.locality ?? null,
          attribution: reply.attribution ?? null,
          finding,
        });
        if (finding) nextAsk = setTimeout(() => void ask(asked + 1), FINDING_POLL_MS);
      } catch {
        if (controller.signal.aborted) return;
        // A failed ask-again keeps the rows already listed.
        setNearby((list) => (list.places.length > 0 || list.locality
          ? { ...list, finding: false }
          : { ...NO_NEARBY_LIST, status: 'failed' }));
      }
    };
    void ask(0);
    return () => {
      controller.abort();
      if (nextAsk) clearTimeout(nextAsk);
    };
  }, [mode, anchor, nearbyAttempt]);

  // The search: venues by name around the anchor, then what the address search finds. That search still answers for
  // addresses, towns and ZIP codes (the place search has no ZIP codes), so only venues are taken from the place search.
  useEffect(() => {
    setSearchFailed(false);
    if (debouncedQuery.length < 2 || mode !== 'search') {
      setSuggestions([]);
      setFoundPlaces([]);
      setFoundAttribution(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    (async () => {
      setLoading(true);
      // Same-origin shared client, so the web session cookie authenticates both.
      const [named, addresses] = await Promise.allSettled([
        api.geo.searchPlaces(debouncedQuery, anchor, controller.signal),
        debouncedQuery.length >= 3
          ? api.geo.autocompleteWithAbort(debouncedQuery, controller.signal)
          : { suggestions: [] },
      ]);
      if (controller.signal.aborted) return;
      const places = named.status === 'fulfilled' ? (named.value.places || []).filter((place) => place.kind === 'poi') : [];
      const found = addresses.status === 'fulfilled' ? addresses.value?.suggestions || [] : [];
      setFoundPlaces(places);
      setFoundAttribution(named.status === 'fulfilled' ? named.value.attribution ?? null : null);
      setSuggestions(found);
      // A failed search is not "No results found".
      setSearchFailed(places.length + found.length === 0 && (named.status === 'rejected' || addresses.status === 'rejected'));
      setLoading(false);
    })();

    return () => controller.abort();
  }, [debouncedQuery, mode, searchAttempt, anchor]);

  // On a narrow screen the button can sit far enough right to push the popover off the edge.
  const handleOpen = () => {
    const buttonLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
    setPopoverLeft(Math.min(0, window.innerWidth - SCREEN_GUTTER - POPOVER_WIDTH - buttonLeft));
    setError('');
    setMode('search');
  };

  // Pick a venue or town from the list or the search. Like a searched address it has to pass the place check (it may
  // be far from the person), and the device's fix counts there.
  const handleSelectPlace = (place: GeoPlace) => {
    latestPick.current += 1;
    onChange({
      latitude: place.center.lat,
      longitude: place.center.lng,
      locationName: place.name,
      locationAddress: place.address || place.full_address || undefined,
      source: 'search',
      geocodePlaceId: place.place_id || undefined,
      geocodeAccuracy: place.kind,
      ...deviceFix,
    });
    setMode('closed');
    setQuery('');
    setError('');
  };

  // Select a suggestion
  const handleSelectSuggestion = async (suggestion: Record<string, any>) => {
    const center = suggestion?.center as { lat: number; lng: number } | undefined;
    if (!center) return;

    const suggestionId = suggestion.suggestion_id as string;
    const pick = ++latestPick.current;

    try {
      const data = await api.geo.resolve(suggestionId);
      if (pick !== latestPick.current) return;
      const n = data.normalized;
      const shortLabel = n.city || n.address?.split(',')[0] || (suggestion.primary_text as string) || 'Selected location';

      onChange({
        latitude: n.latitude ?? center.lat,
        longitude: n.longitude ?? center.lng,
        locationName: shortLabel,
        locationAddress: n.address || (suggestion.label as string) || shortLabel,
        source: 'search',
        ...deviceFix,
      });
    } catch {
      if (pick !== latestPick.current) return;
      // Fall back to suggestion fields
      onChange({
        latitude: center.lat,
        longitude: center.lng,
        locationName: (suggestion.primary_text as string) || 'Selected location',
        locationAddress: (suggestion.label as string) || 'Selected location',
        source: 'search',
        ...deviceFix,
      });
    }

    setMode('closed');
    setQuery('');
    setSuggestions([]);
    setError('');
  };

  // Use GPS
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not available in this browser');
      return;
    }

    setGpsLoading(true);
    setError('');
    const pick = ++latestPick.current;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          let n: { address?: string; city?: string } | undefined;
          try {
            n = (await api.geo.reverseGeocode(latitude, longitude))?.normalized;
          } catch {
            n = undefined; // Keep the GPS point with a coordinate label, as before.
          }
          if (pick !== latestPick.current) return;

          if (n?.address) {
            const city = n.city || '';
            const shortLabel = city || n.address.split(',')[0] || 'Your location';
            const gpsTimestamp = new Date().toISOString();

            onChange({
              latitude,
              longitude,
              locationName: shortLabel,
              locationAddress: n.address,
              source: 'gps',
              gpsTimestamp,
              gpsLatitude: latitude,
              gpsLongitude: longitude,
            });
          } else {
            const gpsTimestamp = new Date().toISOString();
            onChange({
              latitude,
              longitude,
              locationName: 'Your location',
              locationAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              source: 'gps',
              gpsTimestamp,
              gpsLatitude: latitude,
              gpsLongitude: longitude,
            });
          }

          setMode('closed');
          setError('');
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Failed to resolve location');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setError(err.message || 'Location access denied');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Remove location
  const handleRemove = () => {
    onChange(null);
    setMode('closed');
    setQuery('');
    setError('');
  };

  // ─── If a location is set, show the compact badge ──────
  if (value && mode === 'closed') {
    return (
      <div ref={containerRef} className="flex items-center gap-1.5">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium max-w-[260px] ${CHIP_THEMED_TEXT}`}
          style={{
            background: `${accentColor}10`,
            border: `1px solid ${accentColor}20`,
            '--post-type-text': textColor ?? accentColor,
            '--post-type-text-dark': darkTextColor ?? textColor ?? accentColor,
          } as CSSProperties}
        >
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{value.locationName}</span>
        </div>
        <button
          onClick={handleRemove}
          className="p-1 rounded-md hover-bg-app transition text-app-muted hover:text-app"
          title="Remove location"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* ─── Trigger button ─────────────────────── */}
      {mode === 'closed' && (
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-app-muted hover-bg-app transition"
          title="Add location"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Location</span>
        </button>
      )}

      {/* ─── Search mode ────────────────────────── */}
      {mode === 'search' && (
        <div
          className="absolute bottom-full mb-1 w-72 bg-surface rounded-xl shadow-xl border border-app z-40 animate-[fadeIn_0.15s_ease-out]"
          style={{ left: popoverLeft }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-app">
            <svg className="w-3.5 h-3.5 text-app-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setMode('closed'); setQuery(''); }
              }}
              placeholder="Search a place, address or ZIP…"
              className="flex-1 text-xs outline-none bg-transparent text-app placeholder:text-app-muted"
            />
            {searching && (
              <div className="w-3.5 h-3.5 border-2 border-app border-t-primary-500 rounded-full animate-spin flex-shrink-0" />
            )}
            <button aria-label="Close"
              onClick={() => { setMode('closed'); setQuery(''); }}
              className="text-app-muted hover:text-app p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* The nearby list, or the results once a search is on */}
          <div className="max-h-64 overflow-y-auto">
            {error && (
              <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>
            )}
            {!searchActive && (
              <>
                <button
                  type="button"
                  onClick={handleUseGPS}
                  disabled={gpsLoading}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover-bg-app transition border-b border-app"
                >
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-app">
                      {gpsLoading ? 'Getting location…' : 'Use current location'}
                    </div>
                    <div className="text-[10px] text-app-muted">Auto-detect via GPS</div>
                  </div>
                </button>
                {anchorSettled && !anchor ? (
                  <div className="px-3 py-4 text-center text-xs text-app-muted">
                    Turn on location access to see nearby places, or search above.
                  </div>
                ) : nearby.status === 'failed' ? (
                  <div className="px-3 py-4 text-center text-xs text-app-muted">
                    Couldn&apos;t load nearby places.{' '}
                    <button
                      type="button"
                      onClick={() => setNearbyAttempt((n) => n + 1)}
                      className="font-semibold text-primary-600 hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : nearby.status === 'waiting' || (nearby.finding && nearby.places.length === 0 && !nearby.locality) ? (
                  <FindingRows />
                ) : nearby.places.length === 0 && !nearby.locality ? (
                  <div className="px-3 py-4 text-center text-xs text-app-muted">
                    No places nearby. Search for a restaurant, café or landmark instead.
                  </div>
                ) : (
                  <>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                      {anchor?.label ? `Near ${anchor.label}` : 'Nearby'}
                    </div>
                    {nearby.places.map((place, idx) => (
                      <PlaceRow key={place.place_id || idx} place={place} onSelect={handleSelectPlace} />
                    ))}
                    {nearby.finding && <FindingRows />}
                    {nearby.locality && <PlaceRow place={nearby.locality} onSelect={handleSelectPlace} />}
                  </>
                )}
              </>
            )}
            {searching && <div role="status" className="px-3 py-4 text-center text-xs text-app-muted">Searching…</div>}
            {searchFailed && searchActive && !searching && (
              <div className="px-3 py-4 text-center text-xs text-app-muted">
                Couldn&apos;t search places right now.{' '}
                <button
                  type="button"
                  onClick={() => setSearchAttempt((n) => n + 1)}
                  className="font-semibold text-primary-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            )}
            {!searchFailed && foundPlaces.length === 0 && suggestions.length === 0 && searchActive && !searching && (
              <div className="px-3 py-4 text-center text-xs text-app-muted">No results found</div>
            )}
            {!searching && searchActive && foundPlaces.map((place, idx) => (
              <PlaceRow key={place.place_id || idx} place={place} onSelect={handleSelectPlace} />
            ))}
            {!searching && searchActive && suggestions.map((s, idx) => {
              const suggestionId = typeof s.suggestion_id === 'string' ? s.suggestion_id : null;
              const primaryText = typeof s.primary_text === 'string' ? s.primary_text : (typeof s.label === 'string' ? (s.label as string).split(',')[0] : 'Selected place');
              const secondaryText = typeof s.secondary_text === 'string' ? s.secondary_text : '';

              return (
                <button
                  key={suggestionId || idx}
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2.5 hover-bg-app transition flex items-start gap-2.5 border-b border-app last:border-0"
                >
                  <svg className="w-3.5 h-3.5 text-app-muted flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-app truncate">{primaryText}</div>
                    <div className="text-[10px] text-app-muted truncate">{secondaryText}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* The credit the OpenStreetMap license asks for, whenever its venues are listed */}
          {attribution && (
            <div className="border-t border-app px-3 py-1.5 text-[10px] text-app-muted">{attribution}</div>
          )}
        </div>
      )}
    </div>
  );
}

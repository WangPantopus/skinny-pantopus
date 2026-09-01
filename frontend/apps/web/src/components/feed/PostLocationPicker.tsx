'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, Search } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface PostLocation {
  latitude: number;
  longitude: number;
  locationName: string;
  locationAddress: string;
  source?: 'gps' | 'search';
  gpsTimestamp?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

interface PostLocationPickerProps {
  value: PostLocation | null;
  onChange: (loc: PostLocation | null) => void;
  accentColor?: string;
}

type PickerMode = 'closed' | 'options' | 'search' | 'gps';

// Simple debounce hook
function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PostLocationPicker({ value, onChange, accentColor = '#0284c7' }: PostLocationPickerProps) {
  const [mode, setMode] = useState<PickerMode>('closed');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debouncedQuery = useDebounced(query, 250);

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

  // Focus input when opening search
  useEffect(() => {
    if (mode === 'search' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  // Autocomplete search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3 || mode !== 'search') {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    (async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const r = await fetch(
          `${API_BASE}/api/geo/autocomplete?q=${encodeURIComponent(debouncedQuery)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          }
        );
        const data = await r.json();
        if (!controller.signal.aborted) {
          setSuggestions(data?.suggestions || []);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') setSuggestions([]);
        else if (!(e instanceof Error)) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, mode]);

  // Select a suggestion
  const handleSelectSuggestion = async (suggestion: Record<string, any>) => {
    const center = suggestion?.center as { lat: number; lng: number } | undefined;
    if (!center) return;

    const suggestionId = suggestion.suggestion_id as string;

    try {
      const data = await api.geo.resolve(suggestionId);
      const n = data.normalized;
      const shortLabel = n.city || n.address?.split(',')[0] || (suggestion.primary_text as string) || 'Selected location';

      onChange({
        latitude: n.latitude ?? center.lat,
        longitude: n.longitude ?? center.lng,
        locationName: shortLabel,
        locationAddress: n.address || (suggestion.label as string) || shortLabel,
        source: 'search',
      });
    } catch {
      // Fall back to suggestion fields
      onChange({
        latitude: center.lat,
        longitude: center.lng,
        locationName: (suggestion.primary_text as string) || 'Selected location',
        locationAddress: (suggestion.label as string) || 'Selected location',
        source: 'search',
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

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const token = getAuthToken();
          const r = await fetch(
            `${API_BASE}/api/geo/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          const data = await r.json();
          const n = data?.normalized;

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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium max-w-[260px]"
          style={{ background: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}20` }}
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
          onClick={() => setMode('options')}
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

      {/* ─── Options dropdown ───────────────────── */}
      {mode === 'options' && (
        <div className="absolute bottom-full left-0 mb-1 w-56 bg-surface rounded-xl shadow-xl border border-app py-1 z-20 animate-[fadeIn_0.15s_ease-out]">
          <button
            onClick={handleUseGPS}
            disabled={gpsLoading}
            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover-bg-app transition"
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-app">
                {gpsLoading ? 'Getting location…' : 'Use current location'}
              </div>
              <div className="text-[10px] text-app-muted">Auto-detect via GPS</div>
            </div>
          </button>
          <button
            onClick={() => setMode('search')}
            className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover-bg-app transition"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-app">Search a place</div>
              <div className="text-[10px] text-app-muted">Address, park, business…</div>
            </div>
          </button>
          <div className="border-t border-app mt-1 pt-1">
            <button
              onClick={() => setMode('closed')}
              className="w-full text-left px-3 py-2 text-xs text-app-muted hover:text-app transition"
            >
              Cancel
            </button>
          </div>
          {error && (
            <div className="px-3 py-2 text-[10px] text-red-500">{error}</div>
          )}
        </div>
      )}

      {/* ─── Search mode ────────────────────────── */}
      {mode === 'search' && (
        <div className="absolute bottom-full left-0 mb-1 w-72 bg-surface rounded-xl shadow-xl border border-app z-20 animate-[fadeIn_0.15s_ease-out]">
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
              placeholder="Search address or place…"
              className="flex-1 text-xs outline-none bg-transparent text-app placeholder:text-app-muted"
            />
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-app border-t-primary-500 rounded-full animate-spin flex-shrink-0" />
            )}
            <button
              onClick={() => { setMode('closed'); setQuery(''); }}
              className="text-app-muted hover:text-app p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <div className="max-h-48 overflow-y-auto">
            {suggestions.length === 0 && query.length >= 3 && !loading && (
              <div className="px-3 py-4 text-center text-xs text-app-muted">No results found</div>
            )}
            {suggestions.length === 0 && query.length < 3 && (
              <div className="px-3 py-4 text-center text-xs text-app-muted">Type at least 3 characters…</div>
            )}
            {suggestions.map((s, idx) => {
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

          {/* Back to options */}
          <div className="border-t border-app px-3 py-1.5">
            <button
              onClick={() => { setMode('options'); setQuery(''); setSuggestions([]); }}
              className="text-[10px] text-app-muted hover:text-app transition"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

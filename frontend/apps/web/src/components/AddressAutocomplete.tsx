'use client';

import { useEffect, useRef, useState } from 'react';
import { geo } from '@pantopus/api';

type GeoSuggestion = geo.GeoSuggestion;

type Props = {
  value: string;
  onChange: (v: string) => void;

  // Called when user selects a suggestion.
  onSelectNormalized: (n: {
    address: string;
    city: string;
    state: string;
    zipcode: string;
    latitude?: number | null;
    longitude?: number | null;
    place_id?: string | null;
    verified: boolean;
    source: string;
  }) => void;

  placeholder?: string;
};

function useDebounced<T>(value: T, delayMs: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelectNormalized,
  placeholder = '123 Main St',
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [error, setError] = useState<string>('');

  const debounced = useDebounced(value, 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setError('');
    if ((debounced || '').trim().length < 4) {
      setSuggestions([]);
      return;
    }

    const run = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const data = await geo.autocompleteWithAbort(debounced, ac.signal);
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } catch (e: unknown) {
        if (!(e instanceof DOMException) || e.name !== 'AbortError') setError('Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [debounced]);

  const selectSuggestion = async (s: GeoSuggestion) => {
    setOpen(false);
    setSuggestions([]);

    try {
      const data = await geo.resolve(s.suggestion_id);
      const n = data.normalized;
      onChange(n.address);
      onSelectNormalized(n);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resolve address');
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => value.trim().length >= 4 && setOpen(true)}
        onBlur={() => {
          // let click register before closing
          setTimeout(() => setOpen(false), 120);
        }}
        className="w-full px-4 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-secondary caret-gray-900 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder={placeholder}
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-3 top-2.5 text-app-text-muted text-sm">
          …
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-app-surface border border-app-border rounded-lg shadow-lg overflow-hidden [color-scheme:light]">
          {suggestions.map((s) => (
            <button
              key={s.suggestion_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-4 py-2 hover:bg-app-hover text-sm text-app-text"
            >
              <span className="font-medium">{s.primary_text}</span>
              {s.secondary_text && (
                <span className="text-app-text-secondary ml-1">{s.secondary_text}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-app-text-secondary">
        Start typing, then pick a suggestion to verify.
      </p>
    </div>
  );
}

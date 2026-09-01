'use client';

/**
 * AddressSearch — Google Places autocomplete input for address entry flows.
 *
 * Key behaviors:
 *  - Shows suggestions as the user types (debounced, via /api/geo/autocomplete)
 *  - User MUST select a structured result; free-form text entry is blocked
 *  - On selection, parses the structured result and calls onSelect with a
 *    structured { line1, city, state, zip } object suitable for POST /validate
 */

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';

type StructuredAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
};

type Suggestion = api.geo.GeoSuggestion;

type Props = {
  /** Called when a user selects a suggestion (structured result) */
  onSelect: (addr: StructuredAddress, raw: Suggestion) => void;
  placeholder?: string;
  disabled?: boolean;
};

function useDebounced<T>(value: T, delayMs: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

/**
 * Parse a geo/normalize response into structured fields.
 * The backend returns { address, city, state, zipcode } — map to our format.
 */
function normalizedToStructured(n: Record<string, any>): StructuredAddress | null {
  if (!n?.address || !n?.city || !n?.state || !n?.zipcode) return null;
  return {
    line1: n.address as string,
    city: n.city as string,
    state: n.state as string,
    zip: n.zipcode as string,
  };
}

export default function AddressSearch({
  onSelect,
  placeholder = 'Start typing your address...',
  disabled = false,
}: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(false);

  const debounced = useDebounced(text, 250);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch suggestions when debounced text changes
  useEffect(() => {
    if (selected) return; // Don't re-fetch after user selected
    setError('');
    if ((debounced || '').trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const run = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const data = await api.geo.autocompleteWithAbort(debounced, ac.signal);
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') setError('Failed to load suggestions');
        else if (!(e instanceof Error)) setError('Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [debounced, selected]);

  const handleSelect = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setSelected(true);
    setText(s.label);

    try {
      const data = await api.geo.resolve(s.suggestion_id);
      const structured = normalizedToStructured(data.normalized as unknown as Record<string, any>);
      if (!structured) throw new Error('Could not parse address');

      onSelect(structured, s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process address');
      setSelected(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setSelected(false);
    setOpen(true);
  };

  const handleClear = () => {
    setText('');
    setSelected(false);
    setSuggestions([]);
    setOpen(false);
    setError('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={text}
          onChange={handleChange}
          onFocus={() => !selected && text.trim().length >= 3 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          disabled={disabled}
          className={`w-full px-4 py-3 border rounded-xl bg-app-surface text-app-text placeholder:text-app-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : 'border-app-border'}
            ${selected ? 'pr-10' : ''}`}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="address-suggestions-list"
          aria-haspopup="listbox"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-app-border border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}

        {selected && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-secondary"
            aria-label="Clear address"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          id="address-suggestions-list"
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-app-surface border border-app-border rounded-xl shadow-lg overflow-hidden animate-fade-in"
        >
          {suggestions.map((s) => (
            <li key={s.suggestion_id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 hover:bg-app-hover text-sm text-app-text border-b border-app-border-subtle last:border-b-0 transition-colors"
              >
                <span className="text-app-text-muted mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </span>
                <strong>{s.primary_text}</strong> {s.secondary_text}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Helper text */}
      {!selected && !error && (
        <p className="mt-1.5 text-xs text-app-text-secondary">
          Start typing, then select a suggestion to verify your address.
        </p>
      )}

      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}

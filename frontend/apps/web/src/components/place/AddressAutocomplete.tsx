// ============================================================
// AddressAutocomplete — public typeahead for the signed-out funnel.
//
// Uses api.geo (services/geo, country=us) which is public — unlike
// check-address/property-suggestions, which require auth. Each
// suggestion already carries its center {lat,lng}, so selecting one
// gives us the coords we need to save the place after sign-up.
// ============================================================

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MapPin, CornerDownLeft, Loader2 } from 'lucide-react';
import * as api from '@pantopus/api';
import type { GeoSuggestion } from '@pantopus/api';

export interface SelectedAddress {
  label: string;
  latitude: number;
  longitude: number;
}

export interface AddressAutocompleteProps {
  onSelect: (place: SelectedAddress) => void;
  /** Cleared when the user edits after selecting (coords no longer match). */
  onClear?: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 200;
const MIN_CHARS = 3;

export default function AddressAutocomplete({
  onSelect,
  onClear,
  onSubmit,
  placeholder = 'Enter your address',
  autoFocus = false,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState(false);

  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    api.geo
      .autocompleteWithAbort(q, controller.signal)
      .then((res) => {
        setSuggestions(res.suggestions ?? []);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        // aborted or failed — keep the field usable, just no dropdown
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    if (selected) {
      setSelected(false);
      onClear?.();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }
    timerRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
  };

  const choose = (s: GeoSuggestion) => {
    setQuery(s.label);
    setSelected(true);
    setOpen(false);
    setSuggestions([]);
    onSelect({ label: s.label, latitude: s.center.lat, longitude: s.center.lng });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        choose(suggestions[activeIndex]);
      } else if (selected) {
        e.preventDefault();
        onSubmit?.();
      }
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const active = open || loading;

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2.5 h-[54px] px-3.5 bg-app-surface rounded-2xl border transition ${
          active ? 'border-primary-600 ring-4 ring-primary-600/10' : 'border-app-border shadow-sm'
        }`}
      >
        <MapPin size={19} strokeWidth={2} className={active ? 'text-primary-600 shrink-0' : 'text-app-text-muted shrink-0'} />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setOpen(false), 120);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="flex-1 min-w-0 bg-transparent text-base text-app-text placeholder:text-app-text-muted focus:outline-none -tracking-[0.01em]"
        />
        {loading ? <Loader2 size={17} className="shrink-0 text-app-text-muted animate-spin" /> : null}
      </div>

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-2 bg-app-surface border border-app-border rounded-2xl shadow-lg p-1 max-h-72 overflow-auto"
        >
          {suggestions.map((s, i) => {
            const on = i === activeIndex;
            return (
              <li
                key={s.suggestion_id}
                role="option"
                aria-selected={on}
                // onMouseDown (not onClick) so it fires before the input blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-pointer ${on ? 'bg-primary-50' : ''}`}
              >
                <MapPin size={16} strokeWidth={2} className={on ? 'text-primary-600 shrink-0' : 'text-app-text-muted shrink-0'} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold text-app-text -tracking-[0.01em] truncate">{s.primary_text}</span>
                  <span className="block text-[12.5px] text-app-text-secondary truncate">{s.secondary_text}</span>
                </span>
                {on ? <CornerDownLeft size={15} strokeWidth={2} className="shrink-0 text-primary-600" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

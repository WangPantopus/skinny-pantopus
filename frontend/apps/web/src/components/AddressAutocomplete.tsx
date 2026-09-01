'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  /** Id of the visible <label> for this field, so the combobox is named. */
  labelId?: string;
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
 * Address autocomplete, implemented as an ARIA 1.2 combobox.
 *
 * UX-03: this previously had no combobox semantics at all — no role, no
 * aria-expanded, no aria-activedescendant, and no keyboard handler. A screen
 * reader user heard "edit text, Search address", was never told suggestions had
 * appeared, could not reach them with the arrow keys, and got nothing from
 * Enter. Since selecting a suggestion is the only way to populate the
 * normalized address the Next button requires, step 1 of Add Home could not be
 * completed at all without a mouse. That is WCAG 1.3.1 / 2.1.1 / 3.3.2 / 4.1.2,
 * and a total block rather than friction.
 *
 * The suggestion list is also no longer built from <button>s inside a 120ms
 * blur race: options are non-focusable <li role="option"> elements, focus stays
 * on the input, and selection is driven by aria-activedescendant, which is what
 * the pattern calls for and what removes the race.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelectNormalized,
  placeholder = '123 Main St',
  labelId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [error, setError] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const statusId = `${reactId}-status`;
  const errorId = `${reactId}-error`;
  const hintId = `${reactId}-hint`;
  const optionId = (i: number) => `${reactId}-option-${i}`;

  const debounced = useDebounced(value, 300);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setError('');
    if ((debounced || '').trim().length < 4) {
      setSuggestions([]);
      setActiveIndex(-1);
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
        setActiveIndex(-1);
        setOpen(true);
      } catch (e: unknown) {
        if (!(e instanceof DOMException) || e.name !== 'AbortError') setError('Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [debounced]);

  // Keep the active option scrolled into view for sighted keyboard users.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex))}`);
    // Purely cosmetic: never let a missing/unsupported API break selection.
    if (typeof el?.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const selectSuggestion = async (s: GeoSuggestion) => {
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);

    try {
      const data = await geo.resolve(s.suggestion_id);
      const n = data.normalized;
      onChange(n.address);
      onSelectNormalized(n);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resolve address');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasOptions = open && suggestions.length > 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!hasOptions) {
          if (suggestions.length > 0) setOpen(true);
          return;
        }
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!hasOptions) return;
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;

      case 'Home':
        if (!hasOptions) return;
        e.preventDefault();
        setActiveIndex(0);
        break;

      case 'End':
        if (!hasOptions) return;
        e.preventDefault();
        setActiveIndex(suggestions.length - 1);
        break;

      case 'Enter':
        if (!hasOptions || activeIndex < 0) return;
        // Only swallow Enter when it is actually selecting an option, so the
        // key still submits the form otherwise.
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
        break;

      case 'Escape':
        if (!open) return;
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;

      case 'Tab':
        // Moving on closes the list; never trap focus.
        setOpen(false);
        setActiveIndex(-1);
        break;

      default:
        break;
    }
  };

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="relative">
      <input
        // ARIA 1.2 combobox: the input owns the popup rather than being wrapped in one.
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-labelledby={labelId}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => value.trim().length >= 4 && setOpen(true)}
        // Options call preventDefault on mousedown, so focus never leaves the
        // input when one is clicked — a plain blur close is safe here and does
        // not reintroduce the 120ms race the old timeout was working around.
        // Without it the popup had no dismissal path at all for a mouse user
        // and stayed overlaid on the rest of step 1.
        onBlur={() => {
          setOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-secondary caret-gray-900 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />

      {loading && (
        <div className="absolute right-3 top-2.5 text-app-text-muted text-sm" aria-hidden="true">
          …
        </div>
      )}

      {/* Announces suggestion availability, which was previously silent. */}
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {loading
          ? 'Searching addresses'
          : open && suggestions.length > 0
            ? `${suggestions.length} address ${suggestions.length === 1 ? 'suggestion' : 'suggestions'} available. Use the up and down arrow keys to review, and Enter to select.`
            : ''}
      </p>

      <ul
        id={listboxId}
        ref={listRef}
        role="listbox"
        aria-label="Address suggestions"
        className={
          open && suggestions.length > 0
            ? 'absolute z-50 mt-2 w-full bg-app-surface border border-app-border rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto [color-scheme:light]'
            : 'hidden'
        }
      >
        {suggestions.map((s, i) => (
          <li
            key={s.suggestion_id}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            // Focus stays on the input; the mouse path must not steal it,
            // which is what the old 120ms blur timeout was working around.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => selectSuggestion(s)}
            className={`cursor-pointer px-4 py-2 text-sm text-app-text ${
              i === activeIndex ? 'bg-app-hover' : ''
            }`}
          >
            <span className="font-medium">{s.primary_text}</span>
            {s.secondary_text && (
              <span className="text-app-text-secondary ml-1">{s.secondary_text}</span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
      <p id={hintId} className="mt-1 text-xs text-app-text-secondary">
        Start typing, then pick a suggestion to verify.
      </p>
    </div>
  );
}

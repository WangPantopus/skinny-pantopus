'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@pantopus/api';
import { CategoryIcon } from '@/app/(app)/app/marketplace/iconMap';
import { CATEGORIES } from '@/app/(app)/app/marketplace/constants';

const SUGGESTION_CHIPS = ['Furniture', 'Free Stuff', 'Electronics', 'Tools', 'Baby & Kids'];
const STORAGE_KEY = 'pantopus_marketplace_recent';
const MAX_RECENT = 10;

function getRecentSearches(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
  recent.unshift(trimmed);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  sessionStorage.removeItem(STORAGE_KEY);
}

interface MarketplaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  /** Called when user wants to expand bounds 2x after zero results */
  onExpandBounds?: () => void;
  /** Called when user clicks "Post [query] as a listing" CTA */
  onCreateListing?: (prefill?: string) => void;
  /** Current result count — drives zero-results UI */
  resultCount?: number;
  /** User lat/lng for location-aware autocomplete */
  userLocation?: { latitude: number; longitude: number } | null;
}

export default function MarketplaceSearch({
  value,
  onChange,
  onSearch,
  onExpandBounds,
  onCreateListing,
  resultCount,
  userLocation,
}: MarketplaceSearchProps) {
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<{ titles: string[]; categories: string[] }>({
    titles: [],
    categories: [],
  });
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on focus
  useEffect(() => {
    if (focused) setRecentSearches(getRecentSearches());
  }, [focused]);

  // Autocomplete debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!q) {
      setSuggestions({ titles: [], categories: [] });
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const params: { q: string; lat?: number; lng?: number; limit?: number } = { q, limit: 6 };
        if (userLocation) {
          params.lat = userLocation.latitude;
          params.lng = userLocation.longitude;
        }
        const result = await api.listings.autocompleteListings(params);
        setSuggestions({ titles: result.titles || [], categories: result.categories || [] });
      } catch {
        setSuggestions({ titles: [], categories: [] });
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, userLocation]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [suggestions]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const submitSearch = useCallback(
    (query: string) => {
      const q = query.trim();
      if (q) saveSearch(q);
      onChange(q);
      onSearch(q);
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange, onSearch],
  );

  // Flatten suggestions for keyboard nav
  const allItems: { type: 'title' | 'category' | 'recent'; text: string }[] = [];
  const q = value.trim();
  if (q) {
    suggestions.titles.forEach((t) => allItems.push({ type: 'title', text: t }));
    suggestions.categories.forEach((c) => allItems.push({ type: 'category', text: c }));
  } else {
    recentSearches.slice(0, 5).forEach((s) => allItems.push({ type: 'recent', text: s }));
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focused || allItems.length === 0) {
      if (e.key === 'Enter') {
        submitSearch(value);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < allItems.length) {
        submitSearch(allItems[highlightIndex].text);
      } else {
        submitSearch(value);
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  const showDropdown = focused && (q ? allItems.length > 0 : true);

  // Find matching category icon for category suggestions
  function getCategoryIcon(catName: string) {
    const match = CATEGORIES.find(
      (c) => c.label.toLowerCase() === catName.toLowerCase() || c.key === catName.toLowerCase().replace(/\s+/g, '_'),
    );
    if (match) return <CategoryIcon name={match.emoji} className="w-4 h-4 text-primary-500" />;
    return (
      <svg className="w-4 h-4 shrink-0 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    );
  }

  function highlightMatch(text: string, query: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong className="font-bold text-app-text-strong">{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  }

  // Zero results state (shown below the search input, not in dropdown)
  const showZeroResults = q.length >= 2 && !focused && resultCount === 0;

  return (
    <div className="relative">
      <div ref={containerRef} className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search listings..."
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="marketplace-search-listbox"
          aria-activedescendant={
            highlightIndex >= 0 && highlightIndex < allItems.length
              ? `marketplace-search-option-${highlightIndex}`
              : undefined
          }
          aria-label="Search listings"
          className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-app-border bg-app-surface text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={() => {
              onChange('');
              onSearch('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            id="marketplace-search-listbox"
            role="listbox"
            aria-label="Search suggestions"
            className="absolute z-50 top-full mt-1 w-full bg-app-surface border border-app-border rounded-xl shadow-lg overflow-hidden"
          >
            {q ? (
              // ── Autocomplete results ──
              <div>
                {suggestions.titles.map((title, i) => (
                  <button
                    key={`t-${title}`}
                    id={`marketplace-search-option-${i}`}
                    role="option"
                    aria-selected={highlightIndex === i}
                    onClick={() => submitSearch(title)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      highlightIndex === i
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'hover:bg-app-hover text-app-text-secondary'
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>{highlightMatch(title, q)}</span>
                  </button>
                ))}
                {suggestions.categories.map((cat, i) => (
                  <button
                    key={`c-${cat}`}
                    id={`marketplace-search-option-${suggestions.titles.length + i}`}
                    role="option"
                    aria-selected={highlightIndex === suggestions.titles.length + i}
                    onClick={() => submitSearch(cat)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      highlightIndex === suggestions.titles.length + i
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'hover:bg-app-hover text-app-text-secondary'
                    }`}
                  >
                    {getCategoryIcon(cat)}
                    <span>
                      {highlightMatch(cat, q)}{' '}
                      <span className="text-xs text-app-text-muted">category</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              // ── Empty input: recent + suggestion chips ──
              <div>
                {recentSearches.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wide">
                        Recent Searches
                      </span>
                      <button
                        onClick={() => {
                          clearRecentSearches();
                          setRecentSearches([]);
                        }}
                        className="text-xs text-app-text-muted transition hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        Clear
                      </button>
                    </div>
                    {recentSearches.slice(0, 5).map((search, i) => (
                      <button
                        key={search}
                        id={`marketplace-search-option-${i}`}
                        role="option"
                        aria-selected={highlightIndex === i}
                        onClick={() => submitSearch(search)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
                          highlightIndex === i
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'hover:bg-app-hover text-app-text-secondary'
                        }`}
                      >
                        <svg className="w-4 h-4 shrink-0 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {search}
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-4 pt-3 pb-2">
                  <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wide">
                    Try searching for...
                  </span>
                </div>
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => submitSearch(chip)}
                      className="rounded-full border border-app-border bg-app-surface-raised px-3 py-1.5 text-xs font-medium transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:border-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-300"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zero results state */}
      {showZeroResults && (
        <div className="mt-2 p-4 rounded-xl border border-app-border bg-app-surface-raised text-center">
          <p className="text-sm text-app-text-secondary mb-3">
            No listings found for <strong className="text-app-text-strong">&ldquo;{q}&rdquo;</strong> in this area
          </p>
          <div className="flex items-center justify-center gap-3">
            {onExpandBounds && (
              <button
                onClick={onExpandBounds}
                className="px-4 py-2 text-xs font-medium border border-app-border rounded-lg hover:bg-app-hover transition"
              >
                Try a wider area
              </button>
            )}
            {onCreateListing && (
              <button
                onClick={() => onCreateListing(q)}
                className="px-4 py-2 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Post &ldquo;{q}&rdquo; as a listing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

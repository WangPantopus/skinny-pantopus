'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { GigCluster } from '@pantopus/types';
import type { FilterState } from './FilterChipBar';

// ─── Distance / Price / Time filter definitions ────────────

const DISTANCE_OPTIONS = [
  { label: 'Within 1 mi', value: 1609 },
  { label: 'Within 3 mi', value: 4828 },
  { label: 'Within 5 mi', value: 8047 },
] as const;

const PRICE_OPTIONS = [
  { label: 'Under $50', key: 'under50', min: undefined, max: 50 },
  { label: '$50 – $150', key: '50_150', min: 50, max: 150 },
  { label: '$150+', key: '150plus', min: 150, max: undefined },
] as const;

const TIME_OPTIONS = [
  { label: 'Today only', value: 'today' },
  { label: 'This week', value: 'this_week' },
] as const;

// ─── Types ──────────────────────────────────────────────────

interface CategoryRailProps {
  clusters: GigCluster[];
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

// ─── Component ──────────────────────────────────────────────

export default function CategoryRail({
  clusters,
  activeFilters,
  onFilterChange,
}: CategoryRailProps) {
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  // Fetch hidden categories on mount
  useEffect(() => {
    api.gigs
      .getHiddenCategories()
      .then((res) => setHiddenCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  // ── Category helpers ──

  const clusterMap = new Map(clusters.map((c) => [c.category, c]));
  const selectedCategories = activeFilters.categories ?? [];

  const toggleCategory = useCallback(
    (cat: string) => {
      const current = activeFilters.categories ?? [];
      const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      onFilterChange({ ...activeFilters, categories: next.length ? next : undefined });
    },
    [activeFilters, onFilterChange]
  );

  const clearCategories = useCallback(() => {
    onFilterChange({ ...activeFilters, categories: undefined });
  }, [activeFilters, onFilterChange]);

  // ── Distance helpers ──

  const activeDistance = activeFilters.max_distance;

  const setDistance = useCallback(
    (value: number | undefined) => {
      onFilterChange({ ...activeFilters, max_distance: value });
    },
    [activeFilters, onFilterChange]
  );

  // ── Price helpers ──

  const activePriceKey = (() => {
    if (activeFilters.maxPrice === 50 && !activeFilters.minPrice) return 'under50';
    if (activeFilters.minPrice === 50 && activeFilters.maxPrice === 150) return '50_150';
    if (activeFilters.minPrice === 150 && !activeFilters.maxPrice) return '150plus';
    return null;
  })();

  const setPrice = useCallback(
    (opt: (typeof PRICE_OPTIONS)[number] | null) => {
      const next = { ...activeFilters };
      delete next.minPrice;
      delete next.maxPrice;
      if (opt) {
        if (opt.min != null) next.minPrice = opt.min;
        if (opt.max != null) next.maxPrice = opt.max;
      }
      onFilterChange(next);
    },
    [activeFilters, onFilterChange]
  );

  // ── Time helpers ──

  const activeTime = activeFilters.deadline;

  const setTime = useCallback(
    (value: string | undefined) => {
      onFilterChange({ ...activeFilters, deadline: value });
    },
    [activeFilters, onFilterChange]
  );

  // ── Unhide ──

  const unhideCategory = useCallback((cat: string) => {
    api.gigs.unhideCategory(cat).catch(() => {});
    setHiddenCategories((prev) => prev.filter((c) => c !== cat));
  }, []);

  return (
    <aside
      className="w-60 shrink-0 hidden lg:block"
      role="navigation"
      aria-label="Category filters"
    >
      <div className="sticky top-20 space-y-6 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 pb-8 scrollbar-thin">
        {/* ── Section 1: Categories ── */}
        <div>
          <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Categories
          </h3>

          {/* All Categories */}
          <button
            onClick={clearCategories}
            aria-pressed={selectedCategories.length === 0}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              selectedCategories.length === 0
                ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-app-text-strong hover:bg-app-hover'
            }`}
          >
            <span>All Categories</span>
          </button>

          {/* Category list from clusters */}
          <div className="mt-1 space-y-0.5">
            {clusters.map((cluster) => {
              const isActive = selectedCategories.includes(cluster.category);
              return (
                <button
                  key={cluster.category}
                  onClick={() => toggleCategory(cluster.category)}
                  aria-pressed={isActive}
                  aria-label={`${cluster.category}, ${cluster.count} task${cluster.count !== 1 ? 's' : ''}`}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-app-text-strong hover:bg-app-hover'
                  }`}
                >
                  <span className="truncate">{cluster.category}</span>
                  <span
                    className={`text-xs tabular-nums ${
                      isActive ? 'text-primary-600 dark:text-primary-400' : 'text-app-text-muted'
                    }`}
                    aria-hidden="true"
                  >
                    {cluster.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Filters ── */}
        <div>
          <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Filters
          </h3>

          {/* Distance */}
          <p className="text-xs text-app-text-secondary mb-1 px-2.5">Distance</p>
          <div className="space-y-0.5 mb-3">
            {DISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDistance(activeDistance === opt.value ? undefined : opt.value)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition ${
                  activeDistance === opt.value
                    ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-app-text-strong hover:bg-app-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Price */}
          <p className="text-xs text-app-text-secondary mb-1 px-2.5">Price</p>
          <div className="space-y-0.5 mb-3">
            {PRICE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPrice(activePriceKey === opt.key ? null : opt)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition ${
                  activePriceKey === opt.key
                    ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-app-text-strong hover:bg-app-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Time */}
          <p className="text-xs text-app-text-secondary mb-1 px-2.5">Time</p>
          <div className="space-y-0.5">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTime(activeTime === opt.value ? undefined : opt.value)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition ${
                  activeTime === opt.value
                    ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-app-text-strong hover:bg-app-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section 3: Hidden Categories ── */}
        {hiddenCategories.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Hidden
            </h3>
            <div className="space-y-0.5">
              {hiddenCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                >
                  <span className="text-sm text-app-text-muted line-through">{cat}</span>
                  <button
                    onClick={() => unhideCategory(cat)}
                    aria-label={`Unhide ${cat} category`}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Unhide
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

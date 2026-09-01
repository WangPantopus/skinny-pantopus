'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Sort Options ────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'best_match', label: 'Best Match' },
  { key: 'distance', label: 'Nearest' },
  { key: 'price_high', label: 'Highest Pay' },
  { key: 'urgency', label: 'Urgent' },
  { key: 'newest', label: 'Newest' },
  { key: 'quick', label: 'Quick Jobs' },
] as const;

// ─── Filter Chip Definitions ─────────────────────────────

interface ChipDef {
  key: string;
  label: string;
  group: string; // chips in the same group are single-select
  filterKey: string; // API param key
  filterValue: string | number | boolean;
}

const DISTANCE_CHIPS: ChipDef[] = [
  {
    key: 'dist_1',
    label: 'Under 1 mi',
    group: 'distance',
    filterKey: 'max_distance',
    filterValue: 1609,
  },
  {
    key: 'dist_3',
    label: 'Under 3 mi',
    group: 'distance',
    filterKey: 'max_distance',
    filterValue: 4828,
  },
  {
    key: 'dist_5',
    label: 'Under 5 mi',
    group: 'distance',
    filterKey: 'max_distance',
    filterValue: 8047,
  },
];

const PRICE_CHIPS: ChipDef[] = [
  {
    key: 'price_under50',
    label: 'Under $50',
    group: 'price',
    filterKey: 'maxPrice',
    filterValue: 50,
  },
  {
    key: 'price_50_150',
    label: '$50–$150',
    group: 'price',
    filterKey: 'priceRange',
    filterValue: '50_150',
  },
  { key: 'price_150plus', label: '$150+', group: 'price', filterKey: 'minPrice', filterValue: 150 },
];

const TIME_CHIPS: ChipDef[] = [
  { key: 'time_today', label: 'Today', group: 'time', filterKey: 'deadline', filterValue: 'today' },
  {
    key: 'time_week',
    label: 'This Week',
    group: 'time',
    filterKey: 'deadline',
    filterValue: 'this_week',
  },
];

// ─── Types ───────────────────────────────────────────────

export interface FilterState {
  max_distance?: number;
  minPrice?: number;
  maxPrice?: number;
  deadline?: string;
  categories?: string[];
}

export interface FilterChipBarProps {
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  activeSort: string;
  onSortChange: (sort: string) => void;
  categories: string[];
}

// ─── Component ───────────────────────────────────────────

export default function FilterChipBar({
  activeFilters,
  onFilterChange,
  activeSort,
  onSortChange,
  categories,
}: FilterChipBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click or Escape
  useEffect(() => {
    if (!sortOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [sortOpen]);

  const sortLabel = SORT_OPTIONS.find((o) => o.key === activeSort)?.label ?? 'Sort';

  // ── Check if a chip is active ──

  const isChipActive = useCallback(
    (chip: ChipDef): boolean => {
      if (chip.group === 'distance') {
        return activeFilters.max_distance === chip.filterValue;
      }
      if (chip.group === 'price') {
        if (chip.key === 'price_under50')
          return activeFilters.maxPrice === 50 && !activeFilters.minPrice;
        if (chip.key === 'price_50_150')
          return activeFilters.minPrice === 50 && activeFilters.maxPrice === 150;
        if (chip.key === 'price_150plus')
          return activeFilters.minPrice === 150 && !activeFilters.maxPrice;
      }
      if (chip.group === 'time') {
        return activeFilters.deadline === chip.filterValue;
      }
      return false;
    },
    [activeFilters]
  );

  // ── Toggle a chip ──

  const toggleChip = useCallback(
    (chip: ChipDef) => {
      const next = { ...activeFilters };
      const wasActive = isChipActive(chip);

      if (chip.group === 'distance') {
        next.max_distance = wasActive ? undefined : (chip.filterValue as number);
      } else if (chip.group === 'price') {
        // Clear price first (single-select group)
        delete next.minPrice;
        delete next.maxPrice;
        if (!wasActive) {
          if (chip.key === 'price_under50') {
            next.maxPrice = 50;
          } else if (chip.key === 'price_50_150') {
            next.minPrice = 50;
            next.maxPrice = 150;
          } else if (chip.key === 'price_150plus') {
            next.minPrice = 150;
          }
        }
      } else if (chip.group === 'time') {
        next.deadline = wasActive ? undefined : (chip.filterValue as string);
      }

      onFilterChange(next);
    },
    [activeFilters, isChipActive, onFilterChange]
  );

  // ── Category toggle (multi-select) ──

  const toggleCategory = useCallback(
    (cat: string) => {
      const current = activeFilters.categories ?? [];
      const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      onFilterChange({ ...activeFilters, categories: next.length ? next : undefined });
    },
    [activeFilters, onFilterChange]
  );

  // ── Has any filter active? ──

  const hasActiveFilters = !!(
    activeFilters.max_distance ||
    activeFilters.minPrice ||
    activeFilters.maxPrice ||
    activeFilters.deadline ||
    (activeFilters.categories && activeFilters.categories.length > 0)
  );

  const clearAll = useCallback(() => {
    onFilterChange({});
  }, [onFilterChange]);

  // ── Render ──

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
      role="toolbar"
      aria-label="Task filters"
    >
      {/* Sort dropdown */}
      <div ref={sortRef} className="relative shrink-0">
        <button
          onClick={() => setSortOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          aria-label={`Sort by: ${sortLabel}`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-app-border bg-app-surface text-xs font-semibold text-app-text-strong hover:bg-app-hover transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <svg
            className="w-3.5 h-3.5 text-app-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
          {sortLabel}
          <svg
            className={`w-3 h-3 text-app-text-muted transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {sortOpen && (
          <div
            className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-app-border bg-app-surface shadow-lg py-1"
            role="listbox"
            aria-label="Sort options"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                role="option"
                aria-selected={activeSort === opt.key}
                onClick={() => {
                  onSortChange(opt.key);
                  setSortOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:bg-app-hover ${
                  activeSort === opt.key
                    ? 'bg-primary-50 text-primary-700 font-semibold dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-app-text-strong hover:bg-app-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-app-border-subtle shrink-0" />

      {/* Distance chips */}
      {DISTANCE_CHIPS.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          active={isChipActive(chip)}
          onClick={() => toggleChip(chip)}
        />
      ))}

      {/* Price chips */}
      {PRICE_CHIPS.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          active={isChipActive(chip)}
          onClick={() => toggleChip(chip)}
        />
      ))}

      {/* Time chips */}
      {TIME_CHIPS.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          active={isChipActive(chip)}
          onClick={() => toggleChip(chip)}
        />
      ))}

      {/* Category chips */}
      {categories.length > 0 && (
        <>
          <div className="w-px h-5 bg-app-border-subtle shrink-0" />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={activeFilters.categories?.includes(cat) ?? false}
              onClick={() => toggleCategory(cat)}
            />
          ))}
        </>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <>
          <div className="w-px h-5 bg-app-border-subtle shrink-0" />
          <button
            onClick={clearAll}
            aria-label="Clear all filters"
            className="shrink-0 whitespace-nowrap px-1 text-xs font-medium text-primary-600 transition hover:text-primary-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}

// ─── Chip Sub-component ──────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="button"
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? 'bg-primary-600 text-white border-primary-600 scale-[1.02]'
          : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border hover:bg-app-hover scale-100'
      }`}
    >
      {label}
    </button>
  );
}

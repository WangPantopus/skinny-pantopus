'use client';

import {
  CATEGORIES,
  DEFAULT_RADIUS_MILES,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
} from './constants';

export interface DiscoveryFilters {
  categories: string[];
  radiusMiles: number;
  workedNearby: boolean;
  openNow: boolean;
  acceptsGigs: boolean;
  ratingMin: number | null;
  newOnPantopus: boolean;
  foundingOnly: boolean;
  verifiedOnly: boolean;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  categories: [],
  radiusMiles: DEFAULT_RADIUS_MILES,
  workedNearby: false,
  openNow: false,
  acceptsGigs: false,
  ratingMin: null,
  newOnPantopus: false,
  foundingOnly: false,
  verifiedOnly: false,
};

export default function DiscoveryFilterPanel({
  filters,
  onChange,
  collapsed,
  onToggleCollapse,
}: {
  filters: DiscoveryFilters;
  onChange: (f: DiscoveryFilters) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const set = <K extends keyof DiscoveryFilters>(key: K, val: DiscoveryFilters[K]) =>
    onChange({ ...filters, [key]: val });

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    set('categories', next);
  };

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app overflow-hidden">
      {/* Mobile collapse toggle */}
      <button
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="discovery-filter-content"
        className="md:hidden flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-app-strong"
      >
        <span>Filters</span>
        <svg
          className={`w-4 h-4 text-app-muted transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div id="discovery-filter-content" className={`${collapsed ? 'hidden md:block' : ''} px-4 pb-4 md:pt-4 space-y-5`}>
        {/* ─── Worked Nearby (most prominent) ─── */}
        <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.workedNearby}
              onChange={(e) => set('workedNearby', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-teal-600 focus:ring-teal-500"
            />
            <div className="min-w-0">
              <span className="text-sm font-semibold text-teal-800 block">Worked with homes near me</span>
              <span className="text-[11px] text-teal-600 leading-tight block mt-0.5">
                Only show businesses with verified local work history
              </span>
            </div>
          </label>
        </div>

        {/* ─── Category ─── */}
        <div>
          <h3 className="text-xs font-bold text-app-secondary uppercase tracking-wider mb-2">Category</h3>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = filters.categories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-muted text-app-secondary hover:bg-surface-raised'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Distance Radius ─── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-app-secondary uppercase tracking-wider">Distance</h3>
            <span className="text-xs text-app-secondary font-medium">
              {filters.radiusMiles < 1
                ? `${filters.radiusMiles} mi`
                : `${Math.round(filters.radiusMiles)} mi`}
            </span>
          </div>
          <input
              type="range"
              min={MIN_RADIUS_MILES}
              max={MAX_RADIUS_MILES}
              step={0.5}
              value={filters.radiusMiles}
              onChange={(e) => set('radiusMiles', parseFloat(e.target.value))}
              className="w-full accent-primary-600"
              aria-label={`Search radius: ${filters.radiusMiles < 1 ? filters.radiusMiles : Math.round(filters.radiusMiles)} miles`}
            />
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-app-muted">0.5 mi</span>
            <span className="text-[10px] text-app-muted">25 mi</span>
          </div>
        </div>

        {/* ─── Toggles ─── */}
        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(e) => set('openNow', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-app-strong">Open now</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.acceptsGigs}
              onChange={(e) => set('acceptsGigs', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-app-strong">Accepts task requests</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.newOnPantopus}
              onChange={(e) => set('newOnPantopus', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-app-strong">New on Pantopus</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.foundingOnly}
              onChange={(e) => set('foundingOnly', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-app-strong">Founding businesses</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => set('verifiedOnly', e.target.checked)}
              className="w-4 h-4 rounded border-app-strong text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-app-strong">Verified only</span>
          </label>
        </div>

        {/* ─── Minimum Rating ─── */}
        <div>
          <h3 className="text-xs font-bold text-app-secondary uppercase tracking-wider mb-2">Minimum Rating</h3>
          <div className="flex gap-1">
            {[null, 1, 2, 3, 4, 5].map((r) => (
              <button
                key={r ?? 'any'}
                onClick={() => set('ratingMin', r)}
                aria-pressed={filters.ratingMin === r}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filters.ratingMin === r
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-muted text-app-secondary hover:bg-surface-raised'
                }`}
              >
                {r === null ? 'Any' : `${r}★+`}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Reset ─── */}
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="w-full py-2 text-xs font-medium text-app-secondary hover:text-app transition"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}

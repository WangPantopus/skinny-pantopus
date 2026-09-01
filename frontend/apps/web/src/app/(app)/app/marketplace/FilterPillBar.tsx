'use client';

import { FILTER_PILLS, type FilterPillKey } from './constants';

interface FilterPillBarProps {
  activeFilters: FilterPillKey[];
  onToggle: (key: FilterPillKey) => void;
}

export default function FilterPillBar({ activeFilters, onToggle }: FilterPillBarProps) {
  return (
    <div role="toolbar" aria-label="Filter listings" className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {FILTER_PILLS.map((pill) => {
        const isActive = pill.key === 'all'
          ? activeFilters.length === 0
          : activeFilters.includes(pill.key);

        return (
          <button
            key={pill.key}
            onClick={() => onToggle(pill.key)}
            aria-pressed={isActive}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
              isActive
                ? 'bg-app-text text-app-surface dark:bg-white dark:text-gray-900'
                : 'bg-app-surface text-app-text-secondary border border-app-border hover:bg-app-hover'
            }`}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { SCOPE_TABS, isSearchScopeAvailable } from './discoverTypes';
import type { SearchScope } from './discoverTypes';

export function ScopePills({ value, onChange }: { value: SearchScope; onChange: (s: SearchScope) => void }) {
  // Launch cuts: scopes of hidden features are left out; with a single scope
  // left besides "All", the two would match the same results, so no row.
  const tabs = SCOPE_TABS.filter((tab) => isSearchScopeAvailable(tab.key));
  if (tabs.filter((tab) => tab.key !== 'all').length <= 1) return null;
  return (
    <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Search scope">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
            value === tab.key
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-surface text-app-secondary border-app hover:bg-surface-raised hover:text-app-strong'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default ScopePills;

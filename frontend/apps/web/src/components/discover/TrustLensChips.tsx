'use client';

import { TRUST_LENS_OPTIONS, LS_TRUST_LENS_KEY, type DiscoverySort } from './constants';

export default function TrustLensChips({
  value,
  onChange,
}: {
  value: DiscoverySort;
  onChange: (sort: DiscoverySort) => void;
}) {
  const handleChange = (sort: DiscoverySort) => {
    onChange(sort);
    try {
      localStorage.setItem(LS_TRUST_LENS_KEY, sort);
    } catch {}
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" role="radiogroup" aria-label="Sort by trust signal">
      {TRUST_LENS_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => handleChange(opt.value)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              active
                ? 'bg-gray-900 text-white'
                : 'bg-surface-muted text-app-secondary hover:bg-surface-raised'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

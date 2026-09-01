// ============================================================
// TabStrip — under-header segmented tabs with optional counts.
// Active tab uses primary-600 text + 2px primary-600 underline.
// ============================================================

'use client';

import type { ReactNode } from 'react';

export interface TabStripItem {
  key: string;
  label: ReactNode;
  count?: number | null;
}

export interface TabStripProps {
  tabs: TabStripItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** When true, tabs scroll horizontally instead of filling width. */
  scrollable?: boolean;
  className?: string;
}

export default function TabStrip({
  tabs,
  activeKey,
  onChange,
  scrollable,
  className = '',
}: TabStripProps) {
  return (
    <div
      role="tablist"
      className={`flex border-b border-app-border ${scrollable ? 'overflow-x-auto no-scrollbar' : ''} ${className}`}
    >
      {tabs.map((t) => {
        const on = t.key === activeKey;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            type="button"
            className={[
              'px-4 py-3 text-sm transition border-b-2 -mb-px whitespace-nowrap',
              scrollable ? '' : 'flex-1',
              on
                ? 'text-primary-600 font-semibold border-primary-600'
                : 'text-app-text-secondary font-medium border-transparent hover:text-app-text',
            ].join(' ')}
          >
            {t.label}
            {t.count != null ? <span className="ml-1.5 text-app-text-muted font-normal">({t.count})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

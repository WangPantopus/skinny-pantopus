'use client';

import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: string;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Total number of items in the list */
  itemCount: number;
  /** How many items to show when collapsed */
  collapsedCount: number;
  /** Optional element to render at the right side of the header */
  headerRight?: ReactNode;
  /** Render function that receives the number of visible items */
  children: (visibleCount: number) => ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  icon,
  defaultExpanded = true,
  itemCount,
  collapsedCount,
  headerRight,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const needsFold = itemCount > collapsedCount;
  const visibleCount = expanded ? itemCount : collapsedCount;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border">
      {/* Header */}
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-base flex-shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-text">{title}</h3>
            {subtitle && <p className="text-xs text-app-text-secondary mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
        </div>
      </div>

      {/* Content */}
      {children(visibleCount)}

      {/* Show More / Show Less toggle */}
      {needsFold && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full px-5 py-2.5 text-center text-xs font-medium text-app-text-secondary hover:text-app-text hover:bg-app-hover border-t border-app-border-subtle transition"
        >
          {expanded
            ? `Show less`
            : `Show all ${itemCount} items`}
        </button>
      )}
    </div>
  );
}

'use client';

import { type ReactNode } from 'react';
import VisibilityChip from './VisibilityChip';

interface DashboardCardProps {
  title: string;
  icon: ReactNode;
  visibility?: 'public' | 'members' | 'managers' | 'sensitive';
  count?: number;
  badge?: string;
  onClick?: () => void;
  children: ReactNode;
  emptyState?: ReactNode;
}

export default function DashboardCard({
  title,
  icon,
  visibility,
  count,
  badge,
  onClick,
  children,
  emptyState,
}: DashboardCardProps) {
  const hasContent = children !== null && children !== undefined;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-app-border bg-app-surface shadow-sm p-4 transition ${
        onClick ? 'hover:shadow-md cursor-pointer' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <h3 className="text-sm font-semibold text-app-text truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {visibility && <VisibilityChip visibility={visibility} />}
          {count != null && count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary min-w-[20px] text-center">
              {count}
            </span>
          )}
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {hasContent ? children : emptyState || null}
    </div>
  );
}

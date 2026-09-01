'use client';

import type { GigCluster } from '@pantopus/types';
import { formatPrice, formatDistance, formatTimeAgo } from '@pantopus/ui-utils';

// Category accent colors — deterministic by category name hash
const ACCENT_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-purple-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-orange-500',
  'border-l-indigo-500',
];

function colorForCategory(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash + category.charCodeAt(i)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

interface CategoryClusterProps {
  cluster: GigCluster;
  onClick: (category: string) => void;
}

export default function CategoryCluster({ cluster, onClick }: CategoryClusterProps) {
  const accent = colorForCategory(cluster.category);
  const priceRange =
    cluster.price_min === cluster.price_max
      ? formatPrice(cluster.price_min)
      : `${formatPrice(cluster.price_min)} – ${formatPrice(cluster.price_max)}`;
  const nearest = formatDistance(cluster.nearest_distance);

  return (
    <button
      onClick={() => onClick(cluster.category)}
      aria-label={`${cluster.category}: ${cluster.count} task${cluster.count !== 1 ? 's' : ''}, ${priceRange}`}
      className={`w-full text-left rounded-lg border border-app-border bg-app-surface p-3 border-l-[3px] ${accent} hover:shadow-sm hover:bg-app-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-app-text">{cluster.category}</h3>
        <span className="text-xs font-medium text-app-text-secondary">
          {cluster.count} task{cluster.count !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
        <span>{priceRange}</span>
        {nearest && (
          <>
            <span>·</span>
            <span>Nearest {nearest}</span>
          </>
        )}
        {cluster.newest_at && (
          <>
            <span>·</span>
            <span>{formatTimeAgo(cluster.newest_at, 'full')}</span>
          </>
        )}
      </div>
    </button>
  );
}

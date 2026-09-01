'use client';

import Image from 'next/image';
import { Camera } from 'lucide-react';
import type { ListingCategoryCluster } from '@pantopus/api';

// Accent colors — deterministic by category name hash
const ACCENT_COLORS = [
  'border-l-purple-500',
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
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

function formatCategoryName(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ListingCategoryClusterCardProps {
  cluster: ListingCategoryCluster;
  onClick: (category: string) => void;
}

export default function ListingCategoryClusterCard({ cluster, onClick }: ListingCategoryClusterCardProps) {
  const accent = colorForCategory(cluster.category);
  const hasImage = !!cluster.representative_image;

  const priceLabel =
    cluster.price_min == null
      ? null
      : cluster.price_min === cluster.price_max || cluster.price_max == null
        ? `$${cluster.price_min.toFixed(0)}`
        : `$${cluster.price_min.toFixed(0)} – $${cluster.price_max.toFixed(0)}`;

  return (
    <button
      onClick={() => onClick(cluster.category)}
      aria-label={`${formatCategoryName(cluster.category)}: ${cluster.count} listing${cluster.count !== 1 ? 's' : ''}${priceLabel ? `, ${priceLabel}` : ''}`}
      className={`w-full text-left rounded-xl border border-app-border bg-app-surface border-l-[3px] ${accent} hover:shadow-sm hover:bg-app-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 overflow-hidden`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-app-surface-sunken flex-shrink-0">
          {hasImage ? (
            <Image
              src={cluster.representative_image!}
              alt=""
              width={48}
              height={48}
              className="w-full h-full object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              quality={80}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-app-text-muted">
              <Camera className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-app-text truncate">
              {formatCategoryName(cluster.category)}
            </h3>
            <span className="text-xs font-medium text-app-text-secondary ml-2 flex-shrink-0">
              {cluster.count} listing{cluster.count !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-app-text-muted">
            {priceLabel && <span>{priceLabel}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

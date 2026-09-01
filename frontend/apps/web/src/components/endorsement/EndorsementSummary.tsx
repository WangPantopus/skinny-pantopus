'use client';

/**
 * EndorsementSummary — a card showing the endorsement breakdown
 * for a business profile page. Includes the "Endorse" CTA.
 *
 * Displays:
 *   - Total endorsement count
 *   - Category bars with proportional widths
 *   - EndorsementButton for the current viewer
 */

import { useState, useEffect } from 'react';
import * as api from '@pantopus/api';
import type { EndorsementInfo } from '@pantopus/api';
import { CATEGORY_MAP } from '@/components/discover/constants';
import EndorsementButton from './EndorsementButton';

interface EndorsementSummaryProps {
  businessId: string;
  categories: string[];
  currentUserId?: string;
  businessOwnerId?: string;
  viewerHomeId?: string;
}

export default function EndorsementSummary({
  businessId,
  categories,
  currentUserId,
  businessOwnerId,
  viewerHomeId,
}: EndorsementSummaryProps) {
  const [info, setInfo] = useState<EndorsementInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params: Parameters<typeof api.businesses.getEndorsements>[1] = {};
        if (viewerHomeId) params.viewer_home_id = viewerHomeId;
        const res = await api.businesses.getEndorsements(businessId, params);
        if (!cancelled) setInfo(res);
      } catch {
        // Graceful fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId, viewerHomeId]);

  const isOwner = currentUserId != null && currentUserId === businessOwnerId;

  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-5 animate-pulse">
        <div className="h-4 w-32 bg-app-surface-sunken rounded mb-3" />
        <div className="h-3 w-48 bg-app-surface-sunken rounded mb-2" />
        <div className="h-3 w-40 bg-app-surface-sunken rounded" />
      </div>
    );
  }

  const count = info?.count ?? 0;
  const byCategory = info?.by_category ?? [];

  // Don't show if show=false and count=0
  if (!info?.show && count === 0) return null;

  const maxCatCount = Math.max(1, ...byCategory.map((c) => c.count));

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">👍</span>
          <div>
            <h3 className="text-sm font-bold text-app-text">
              Neighbor Endorsements
            </h3>
            {count > 0 && (
              <p className="text-xs text-app-text-secondary">
                {count} endorsement{count !== 1 ? 's' : ''} from nearby residents
              </p>
            )}
          </div>
        </div>

        {/* Endorse CTA */}
        {!isOwner && categories.length > 0 && (
          <EndorsementButton
            businessId={businessId}
            categories={categories}
            isOwner={isOwner}
            onCountChange={() => {
              // Re-fetch to update counts
              api.businesses.getEndorsements(businessId, viewerHomeId ? { viewer_home_id: viewerHomeId } : undefined)
                .then(setInfo)
                .catch(() => {});
            }}
          />
        )}
      </div>

      {/* Category breakdown bars */}
      {byCategory.length > 0 ? (
        <div className="space-y-2">
          {byCategory.map(({ category, count: catCount }) => {
            const pct = Math.round((catCount / maxCatCount) * 100);
            const label = CATEGORY_MAP[category] || category;
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-app-text-secondary">{label}</span>
                  <span className="text-xs font-semibold text-teal-600">{catCount}</span>
                </div>
                <div className="h-1.5 bg-app-surface-sunken rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={catCount}
                    aria-valuemin={0}
                    aria-valuemax={maxCatCount}
                    aria-label={`${label}: ${catCount} endorsement${catCount !== 1 ? 's' : ''}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-app-text-muted">No endorsements yet</p>
          <p className="text-xs text-gray-300 mt-1">
            Be the first neighbor to endorse this business
          </p>
        </div>
      )}
    </div>
  );
}

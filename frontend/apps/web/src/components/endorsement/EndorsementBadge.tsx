'use client';

/**
 * EndorsementBadge — displays the endorsement count with a breakdown popover.
 *
 * Usage:
 *   <EndorsementBadge businessId="..." />
 *
 * Fetches endorsement data on mount and shows:
 *   - "👍 N endorsed" pill (teal)
 *   - Hover/click: category breakdown popover
 *
 * If count < threshold (default 1), renders nothing.
 */

import { useState, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import type { EndorsementInfo } from '@pantopus/api';
import { CATEGORY_MAP } from '@/components/discover/constants';

interface EndorsementBadgeProps {
  /** Business to show endorsements for */
  businessId: string;
  /** Pre-loaded count (skips fetch if provided) */
  preloadedCount?: number;
  /** Minimum count to show the badge */
  minCount?: number;
  /** Viewer home id for proximity filtering */
  viewerHomeId?: string;
  /** Compact mode for cards */
  compact?: boolean;
}

export default function EndorsementBadge({
  businessId,
  preloadedCount,
  minCount = 1,
  viewerHomeId,
  compact = false,
}: EndorsementBadgeProps) {
  const [info, setInfo] = useState<EndorsementInfo | null>(null);
  const [loading, setLoading] = useState(preloadedCount == null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Fetch endorsement info
  useEffect(() => {
    if (preloadedCount != null && preloadedCount < minCount) return;

    let cancelled = false;
    async function load() {
      try {
        const params: Parameters<typeof api.businesses.getEndorsements>[1] = {};
        if (viewerHomeId) params.viewer_home_id = viewerHomeId;

        const res = await api.businesses.getEndorsements(businessId, params);
        if (!cancelled) setInfo(res);
      } catch {
        // Graceful fallback — endorsements might not be implemented yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId, viewerHomeId, preloadedCount, minCount]);

  // Close on outside click or touch
  useEffect(() => {
    if (!showBreakdown) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setShowBreakdown(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBreakdown(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [showBreakdown]);

  // Determine count
  const count = info?.count ?? preloadedCount ?? 0;
  if (loading || count < minCount) return null;

  const byCategory = info?.by_category ?? [];

  return (
    <div className="relative inline-block" ref={popRef}>
      <button
        onClick={() => byCategory.length > 0 && setShowBreakdown((s) => !s)}
        aria-expanded={showBreakdown}
        aria-haspopup={byCategory.length > 0 ? 'true' : undefined}
        className={`
          inline-flex items-center gap-1 rounded-full font-medium transition
          bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100
          ${compact
            ? 'text-[10px] px-1.5 py-0.5'
            : 'text-xs px-2 py-0.5'
          }
          ${byCategory.length > 0 ? 'cursor-pointer' : 'cursor-default'}
        `}
      >
        <span aria-hidden="true">👍</span>
        <span>{count} endorsed</span>
      </button>

      {/* Category breakdown popover */}
      {showBreakdown && byCategory.length > 0 && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-app-surface rounded-xl shadow-xl border border-app-border py-2 min-w-[180px] animate-fade-in">
          <div className="px-3 pb-1.5 border-b border-app-border-subtle">
            <p className="text-[11px] font-semibold text-app-text-secondary uppercase tracking-wider">
              Endorsed for
            </p>
          </div>
          <div className="py-1">
            {byCategory.map(({ category, count: catCount }) => (
              <div key={category} className="flex items-center justify-between px-3 py-1.5">
                <span className="text-sm text-app-text-strong">
                  {CATEGORY_MAP[category] || category}
                </span>
                <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                  {catCount}
                </span>
              </div>
            ))}
          </div>
          <div className="px-3 pt-1.5 border-t border-app-border-subtle">
            <p className="text-[10px] text-app-text-muted">
              Endorsements from verified neighbors
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

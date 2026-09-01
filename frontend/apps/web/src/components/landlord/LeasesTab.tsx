'use client';

/**
 * LeasesTab — Timeline/list view of leases with color-coded status.
 * Active (green), upcoming renewals (blue), ending soon (yellow), overstays (red).
 */

import { useState, useCallback, useMemo } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

type Props = {
  homeId: string;
  leases: landlord.HomeLease[];
  onRefresh: () => void;
};

// ── Lease categorization ────────────────────────────────────

type LeaseCategory = 'active' | 'ending_soon' | 'overstay' | 'pending' | 'ended';

function categorizeLease(lease: landlord.HomeLease): LeaseCategory {
  if (lease.state === 'pending') return 'pending';
  if (lease.state === 'ended' || lease.state === 'canceled') return 'ended';

  if (lease.state === 'active') {
    if (!lease.end_at) return 'active';
    const daysRemaining = Math.ceil(
      (new Date(lease.end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysRemaining < 0) return 'overstay';
    if (daysRemaining <= 30) return 'ending_soon';
    return 'active';
  }

  return 'ended';
}

const CATEGORY_CONFIG: Record<LeaseCategory, { label: string; bg: string; text: string; dot: string; border: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  ending_soon: { label: 'Ending Soon', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  overstay: { label: 'Overstay', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-l-red-500' },
  pending: { label: 'Pending', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-l-blue-500' },
  ended: { label: 'Ended', bg: 'bg-app-surface-raised', text: 'text-app-text-secondary', dot: 'bg-gray-400', border: 'border-l-gray-300' },
};

function CategoryBadge({ category }: { category: LeaseCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Filter tabs ─────────────────────────────────────────────

type FilterOption = 'all' | LeaseCategory;

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'ending_soon', label: 'Ending Soon' },
  { key: 'overstay', label: 'Overstays' },
  { key: 'pending', label: 'Pending' },
  { key: 'ended', label: 'Ended' },
];

// ── Main component ──────────────────────────────────────────

export default function LeasesTab({ homeId: _homeId, leases, onRefresh }: Props) {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [endingId, setEndingId] = useState<string | null>(null);

  const categorized = useMemo(() => {
    return leases.map((l) => ({
      ...l,
      _category: categorizeLease(l),
    }));
  }, [leases]);

  const filtered = useMemo(() => {
    if (filter === 'all') return categorized;
    return categorized.filter((l) => l._category === filter);
  }, [categorized, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: categorized.length };
    for (const l of categorized) {
      c[l._category] = (c[l._category] || 0) + 1;
    }
    return c;
  }, [categorized]);

  const handleEndLease = useCallback(async (leaseId: string) => {
    setEndingId(leaseId);
    try {
      await api.landlord.endLease(leaseId);
      onRefresh();
    } catch (err: unknown) {
      console.error('End lease failed:', err);
    } finally {
      setEndingId(null);
    }
  }, [onRefresh]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (leases.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-app-surface-sunken flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-app-text-muted" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm text-app-text-secondary">No leases yet. Invite tenants to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map((opt) => {
          const count = counts[opt.key] || 0;
          if (opt.key !== 'all' && count === 0) return null;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
              }`}
            >
              {opt.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                filter === opt.key ? 'bg-glass/20 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lease list */}
      <div className="space-y-2">
        {filtered.map((lease) => {
          const config = CATEGORY_CONFIG[lease._category];
          return (
            <div
              key={lease.id}
              className={`rounded-xl border border-app-border bg-app-surface pl-1 ${config.border} border-l-4`}
            >
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Tenant info */}
                  <div className="w-8 h-8 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-app-text-secondary">
                      {(lease.primary_resident?.name || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-app-text text-sm truncate">
                      {lease.primary_resident?.name || 'Unknown tenant'}
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      {formatDate(lease.start_at)}
                      {lease.end_at ? ` \u2013 ${formatDate(lease.end_at)}` : ' \u2013 Open'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <CategoryBadge category={lease._category} />

                  {/* End lease action */}
                  {lease.state === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleEndLease(lease.id)}
                      disabled={endingId === lease.id}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {endingId === lease.id ? 'Ending...' : 'End Lease'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-app-text-secondary py-6">
          No leases match this filter.
        </p>
      )}
    </div>
  );
}

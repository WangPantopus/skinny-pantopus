'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';

interface SavedGig {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  price?: number | string;
  budget_min?: number;
  category?: string;
  created_at?: string;
  createdAt?: string;
  is_urgent?: boolean;
  tags?: string[];
}

export default function SavedGigsPage() {
  const router = useRouter();
  const [gigs, setGigs] = useState<SavedGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [unsavingIds, setUnsavingIds] = useState<Set<string>>(new Set());

  const loadSavedGigs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await api.gigs.getSavedGigs();
      setGigs(result?.gigs as SavedGig[] || (result as Record<string, any>)?.data as SavedGig[] || []);
    } catch (err: unknown) {
      // 404 from backend (e.g. /api/gigs/saved matched as /api/gigs/:id) = no saved gigs
      const errObj = err && typeof err === 'object' ? (err as Record<string, any>) : null;
      if (errObj?.statusCode === 404 || (errObj?.response as Record<string, any>)?.status === 404) {
        setGigs([]);
        return;
      }
      console.error('Failed to load saved gigs:', err);
      setGigs([]);
      setFetchError('Failed to load saved tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadSavedGigs();
  }, [router, loadSavedGigs]);

  const handleUnsave = async (gigId: string) => {
    // Optimistic removal
    setGigs((prev) => prev.filter((g) => g.id !== gigId));
    setUnsavingIds((prev) => new Set(prev).add(gigId));
    try {
      await api.gigs.unsaveGig(gigId);
    } catch {
      // Revert on error — reload all
      await loadSavedGigs();
    } finally {
      setUnsavingIds((prev) => {
        const next = new Set(prev);
        next.delete(gigId);
        return next;
      });
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)]">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-app-text mb-6 flex items-center gap-2">
            <span>🔖</span> Saved Tasks
          </h1>
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-4 text-app-text-secondary">Loading saved tasks...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (fetchError && gigs.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)]">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-app-text mb-6 flex items-center gap-2">
            <span>🔖</span> Saved Tasks
          </h1>
          <div className="text-center py-16 bg-app-surface rounded-xl border border-red-200 dark:border-red-800">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-app-text mb-2">Something went wrong</h3>
            <p className="text-app-text-secondary mb-6">{fetchError}</p>
            <button
              onClick={() => loadSavedGigs()}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Empty state
  if (gigs.length === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)]">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-app-text mb-6 flex items-center gap-2">
            <span>🔖</span> Saved Tasks
          </h1>
          <div className="text-center py-16 bg-app-surface rounded-xl border border-app-border">
            <div className="text-7xl mb-4 text-gray-300">🔖</div>
            <h3 className="text-xl font-semibold text-app-text mb-2">No saved tasks yet</h3>
            <p className="text-app-text-secondary mb-6">Browse tasks to find ones you&apos;re interested in</p>
            <button
              onClick={() => router.push('/app/gigs')}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Browse Tasks
            </button>
          </div>
        </main>
      </div>
    );
  }

  // List
  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
            <span>🔖</span> Saved Tasks
            <span className="text-base font-normal text-app-text-secondary">({gigs.length})</span>
          </h1>
          <button
            onClick={() => router.push('/app/gigs')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            Browse More
          </button>
        </div>

        <div className="space-y-4">
          {gigs.map((gig) => {
            const price = gig.price || gig.budget_min;
            const priceNum = Number(price);
            const priceDisplay = Number.isFinite(priceNum) && priceNum > 0 ? `$${priceNum}` : 'Flexible';
            const createdAt = gig.created_at || gig.createdAt;
            const statusColors: Record<string, string> = {
              open: 'bg-green-100 text-green-800',
              assigned: 'bg-blue-100 text-blue-800',
              in_progress: 'bg-blue-100 text-blue-800',
              completed: 'bg-purple-100 text-purple-800',
              cancelled: 'bg-app-surface-sunken text-app-text-secondary',
            };

            return (
              <div
                key={gig.id}
                className="bg-app-surface rounded-xl border border-app-border p-5 hover:shadow-md transition shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {gig.is_urgent && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full">
                          URGENT
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-app-text truncate">{gig.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                          statusColors[gig.status || 'open'] || statusColors.open
                        }`}
                      >
                        {(gig.status || 'open').replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {gig.description && (
                      <p className="text-app-text-secondary text-sm mb-2 line-clamp-2">{gig.description}</p>
                    )}

                    <div className="flex items-center flex-wrap gap-3 text-sm text-app-text-secondary">
                      <span className="font-semibold text-green-600">{priceDisplay}</span>
                      <span className="text-gray-300">|</span>
                      <span>{gig.category || 'General'}</span>
                      {createdAt && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{timeAgo(createdAt)}</span>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    {Array.isArray(gig.tags) && gig.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {gig.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-app-surface-sunken text-app-text-secondary text-xs rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-app-border-subtle">
                  <button
                    onClick={() => router.push(`/app/gigs/${gig.id}`)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleUnsave(gig.id)}
                    disabled={unsavingIds.has(gig.id)}
                    className="px-4 py-2 border border-app-border text-app-text-strong rounded-lg hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 font-medium text-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>🔖</span>
                    <span>{unsavingIds.has(gig.id) ? 'Removing...' : 'Unsave'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';
import type { Listing } from '@pantopus/types';

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

export default function SavedListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    setLoading(true);
    try {
      const result = await api.listings.getSavedListings({ limit: 50 });
      setListings(((result as Record<string, any>)?.listings || []) as Listing[]);
    } catch (err) {
      console.error('Failed to load saved listings:', err);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  // Optimistic unsave — removes card from list immediately
  const unsaveMutation = useMutation({
    mutationFn: (listingId: string) => api.listings.toggleSave(listingId),
    onMutate: (listingId) => {
      const prev = listings;
      setListings((l) => l.filter((item) => item.id !== listingId));
      return { prev };
    },
    onError: (_err, _listingId, context) => {
      if (context) setListings(context.prev);
    },
  });

  const handleUnsave = (listingId: string) => {
    unsaveMutation.mutate(listingId);
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Saved Listings</h1>
            <p className="text-sm text-app-text-secondary mt-0.5">
              {listings.length} saved item{listings.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchSaved}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-app-border bg-app-surface text-app-text-strong rounded-lg hover:bg-app-hover font-medium text-sm disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        {loading && listings.length === 0 ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-app-text-secondary">Loading saved listings...</p>
          </div>
        ) : listings.length === 0 ? (
          /* ── Empty state ──────────────────────────────────── */
          <div className="text-center py-16 bg-app-surface rounded-xl border border-app-border">
            <div className="text-6xl mb-4">🔖</div>
            <h3 className="text-lg font-semibold text-app-text mb-2">No saved listings yet</h3>
            <p className="text-app-text-secondary mb-6">
              Browse the Marketplace and save items you&apos;re interested in!
            </p>
            <button
              onClick={() => router.push('/app/marketplace')}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          /* ── Grid (matches marketplace browse) ────────────── */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map((item) => (
              <SavedListingCard
                key={item.id}
                item={item}
                onUnsave={() => handleUnsave(item.id)}
                onClick={() => router.push(`/app/marketplace/${item.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Card Component (matches marketplace browse cards) ────────────
function SavedListingCard({
  item,
  onUnsave,
  onClick,
}: {
  item: Listing;
  onUnsave: () => void;
  onClick: () => void;
}) {
  const coverUrl = item.media_urls?.[0];

  return (
    <div
      className="bg-app-surface rounded-xl border border-app-border overflow-hidden hover:shadow-md transition cursor-pointer group"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-app-surface-sunken">
        {coverUrl ? (
          <Image src={coverUrl} alt={item.title} width={200} height={150} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
            📷
          </div>
        )}

        {/* Price badge - bottom left */}
        <div className="absolute bottom-2 left-2">
          {item.is_free ? (
            <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded-md">
              FREE
            </span>
          ) : item.price != null ? (
            <span className="px-2 py-0.5 bg-gray-900/80 text-white text-xs font-bold rounded-md">
              ${Number(item.price).toFixed(0)}
            </span>
          ) : null}
        </div>

        {/* Unsave button - top right (always filled since it's saved) */}
        <button
          onClick={(e) => { e.stopPropagation(); onUnsave(); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-app-surface/90 hover:bg-app-surface flex items-center justify-center shadow-sm transition"
          title="Unsave"
        >
          <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-app-text truncate">{item.title}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.condition && (
            <span className="px-1.5 py-0.5 bg-app-surface-sunken text-app-text-secondary text-[11px] font-medium rounded">
              {CONDITION_LABELS[item.condition] || item.condition}
            </span>
          )}
          {item.created_at && (
            <span className="text-[11px] text-app-text-muted">{formatTimeAgo(item.created_at)}</span>
          )}
        </div>
        {item.location_name && (
          <p className="text-[11px] text-app-text-muted mt-1 truncate">
            📍 {item.location_name}
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Store, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { DiscoverySearchResult } from '@pantopus/api';
import useViewerHome from '@/hooks/useViewerHome';
import { CATEGORY_MAP } from '@/components/discover/constants';

// ─── Provider Mini-Card ──────────────────────────────────────

function ProviderMiniCard({
  biz,
  onContact,
}: {
  biz: DiscoverySearchResult;
  onContact: (id: string, name: string) => void;
}) {
  const router = useRouter();

  const ratingText =
    biz.average_rating != null
      ? `★ ${biz.average_rating.toFixed(1)}`
      : null;

  const categoryLabel =
    biz.categories.length > 0
      ? CATEGORY_MAP[biz.categories[0]] || biz.categories[0]
      : null;

  return (
    <div className="flex-shrink-0 w-44 bg-surface rounded-xl border border-app shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Top — avatar + name */}
      <button
        onClick={() => router.push(`/b/${biz.username}`)}
        className="w-full p-3 pb-2 text-left"
      >
        <div className="flex items-center gap-2 mb-1.5">
          {biz.profile_picture_url ? (
            <Image
              src={biz.profile_picture_url}
              alt={biz.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              width={32}
              height={32}
              sizes="32px"
              quality={75}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 flex-shrink-0">
              {(biz.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-app truncate leading-tight">
              {biz.name}
            </p>
            {categoryLabel && (
              <p className="text-[10px] text-app-muted truncate">{categoryLabel}</p>
            )}
          </div>
        </div>

        {/* Trust signals row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ratingText && (
            <span className="text-[10px] font-medium text-amber-600">{ratingText}</span>
          )}
          {biz.distance_miles != null && (
            <span className="text-[10px] text-app-muted">
              {biz.distance_miles < 0.1
                ? '<0.1 mi'
                : `${biz.distance_miles.toFixed(1)} mi`}
            </span>
          )}
          {biz.neighbor_count >= 2 && (
            <span className="text-[10px] bg-teal-50 text-teal-700 px-1 py-0.5 rounded-full font-medium">
              {biz.neighbor_count} neighbors
            </span>
          )}
          {biz.is_new_business && (
            <span className="text-[10px] bg-sky-50 text-sky-600 px-1 py-0.5 rounded-full font-medium">
              New
            </span>
          )}
        </div>
      </button>

      {/* Bottom — CTA */}
      <div className="px-3 pb-2.5 flex gap-1.5">
        <button
          onClick={() => onContact(biz.business_user_id, biz.name)}
          className="flex-1 text-[10px] font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-md py-1.5 transition"
          aria-label={`Contact ${biz.name}`}
        >
          Contact
        </button>
        <button
          onClick={() => router.push(`/b/${biz.username}`)}
          className="flex-1 text-[10px] font-semibold text-app-muted hover:text-app bg-surface-muted hover-bg-app rounded-md py-1.5 transition"
          aria-label={`View ${biz.name} profile`}
        >
          Profile
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function ProviderMiniSkeleton() {
  return (
    <div className="flex-shrink-0 w-44 bg-surface rounded-xl border border-app p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-surface-muted" />
        <div className="flex-1 min-w-0">
          <div className="h-3 w-20 bg-surface-muted rounded mb-1" />
          <div className="h-2 w-14 bg-surface-muted rounded" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-2 w-10 bg-surface-muted rounded" />
        <div className="h-2 w-8 bg-surface-muted rounded" />
      </div>
      <div className="flex gap-1.5 mt-3">
        <div className="flex-1 h-6 bg-surface-muted rounded-md" />
        <div className="flex-1 h-6 bg-surface-muted rounded-md" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEARBY PROVIDERS CARD
// ═══════════════════════════════════════════════════════════════

interface NearbyProvidersCardProps {
  /** User's current GPS lat for fallback */
  userLat?: number | null;
  /** User's current GPS lng for fallback */
  userLng?: number | null;
  /** Called when user taps Contact on a provider */
  onContact?: (businessUserId: string, businessName: string) => void;
  /** Max providers to show */
  limit?: number;
}

export default function NearbyProvidersCard({
  userLat,
  userLng,
  onContact,
  limit = 10,
}: NearbyProvidersCardProps) {
  const router = useRouter();
  const { viewerHome, loading: homeLoading } = useViewerHome();
  const [providers, setProviders] = useState<DiscoverySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  const lat = viewerHome?.lat ?? userLat ?? null;
  const lng = viewerHome?.lng ?? userLng ?? null;

  // Reset fetch guard when location changes so we re-fetch for new coordinates
  const prevLocationRef = useRef<string | null>(null);
  const locationKey = lat != null && lng != null ? `${lat},${lng}` : null;
  if (locationKey !== prevLocationRef.current) {
    prevLocationRef.current = locationKey;
    hasFetched.current = false;
  }

  const fetchProviders = useCallback(async () => {
    if (lat == null || lng == null) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    setLoading(true);
    try {
      const res = await api.businesses.searchNearbyBusinesses({
        lat,
        lng,
        radius_miles: 5,
        sort: 'relevance',
        page: 1,
        page_size: limit,
        viewer_home_id: viewerHome?.homeId,
      });
      setProviders(res.results);
    } catch (err) {
      console.warn('NearbyProvidersCard fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, limit, viewerHome?.homeId]);

  useEffect(() => {
    if (homeLoading) return;
    fetchProviders();
  }, [homeLoading, fetchProviders]);

  // Don't render if dismissed, still loading home, or no results
  if (dismissed) return null;
  if (homeLoading || loading) {
    return (
      <div className="bg-surface rounded-2xl shadow-sm border border-app p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-app-muted" aria-hidden="true" />
            <h3 className="text-xs font-bold text-app-muted uppercase tracking-wider">
              Nearby Providers
            </h3>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          <ProviderMiniSkeleton />
          <ProviderMiniSkeleton />
          <ProviderMiniSkeleton />
        </div>
      </div>
    );
  }

  if (providers.length === 0) return null;

  const handleContact = (id: string, name: string) => {
    onContact?.(id, name);
  };

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-app-muted" aria-hidden="true" />
          <h3 className="text-xs font-bold text-app-muted uppercase tracking-wider">
            Nearby Providers
          </h3>
          <span className="text-[10px] text-app-muted font-medium">
            {providers.length} near you
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => router.push('/app/discover')}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-800 transition"
          >
            See all →
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-app-muted hover:text-app transition"
            aria-label="Dismiss nearby providers"
            title="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontally scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
        role="list"
        aria-label="Nearby business providers"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {providers.map((biz) => (
          <ProviderMiniCard
            key={biz.business_user_id}
            biz={biz}
            onContact={handleContact}
          />
        ))}

        {/* "Discover more" tail card */}
        <button
          onClick={() => router.push('/app/discover')}
          className="flex-shrink-0 w-32 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border border-primary-200 flex flex-col items-center justify-center gap-2 hover:from-primary-100 hover:to-primary-200 transition-colors"
        >
          <Search className="w-6 h-6 text-primary-600" aria-hidden="true" />
          <span className="text-xs font-semibold text-primary-700">Discover more</span>
        </button>
      </div>
    </div>
  );
}

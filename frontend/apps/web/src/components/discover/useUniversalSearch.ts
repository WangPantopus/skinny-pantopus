'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { SearchScope, UnifiedResult } from './discoverTypes';
import { queryKeys } from '@/lib/query-keys';

/**
 * Performs universal search across profile identities, businesses, tasks, and
 * listings based on the current scope and debounced query.
 *
 * Uses a composite useQuery so:
 *  - Rapid typing produces key changes → React Query cancels stale requests
 *    and only the latest query's result is applied.
 *  - The AbortSignal passed to queryFn is checked after Promise.allSettled,
 *    so even if the in-flight API calls can't be plumbed through to axios,
 *    stale results never reach the component.
 */
export function useUniversalSearch(
  debouncedQuery: string,
  scope: SearchScope,
  showUniversalUI: boolean,
) {
  const trimmed = debouncedQuery.trim();
  const enabled = showUniversalUI && trimmed.length >= 2;

  const query = useQuery<UnifiedResult[]>({
    queryKey: queryKeys.discover('universal', { query: trimmed, scope }),
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const unified: UnifiedResult[] = [];
      const limit = scope === 'all' ? 5 : 20;

      const shouldSearchProfiles = scope === 'all' || scope === 'local_profiles' || scope === 'public_profiles';
      const shouldSearchBiz = scope === 'all';
      const shouldSearchTasks = scope === 'all' || scope === 'tasks';
      const shouldSearchListings = scope === 'all' || scope === 'listings';

      const promises: Promise<void>[] = [];

      if (shouldSearchProfiles) {
        promises.push(
          api.identitySearch.searchProfiles({
            q: trimmed,
            scope: scope === 'local_profiles' || scope === 'public_profiles' ? scope : 'all',
            limit,
          }).then((res) => {
            for (const profile of res?.results || []) {
              if (profile.type !== 'local_profile' && profile.type !== 'public_profile') continue;
              unified.push({
                id: profile.id,
                type: profile.type,
                title: profile.title,
                subtitle: profile.subtitle ?? undefined,
                meta: profile.meta ?? undefined,
                imageUrl: profile.imageUrl ?? null,
                href: profile.href,
                badges: profile.badges ?? [],
                linkedProfile: profile.linkedProfile ?? null,
              });
            }
          }).catch(() => {}),
        );
      }

      if (shouldSearchBiz) {
        promises.push(
          api.businesses.discoverBusinesses({ q: trimmed, limit }).then((res) => {
            for (const b of res?.businesses || []) {
              unified.push({
                id: b.id,
                type: 'business',
                title: b.name || b.username || 'Business',
                subtitle: b.business_type || undefined,
                meta: [b.city, b.state].filter(Boolean).join(', ') || undefined,
                imageUrl: b.profile_picture_url || null,
                href: b.username ? `/business/${b.username}` : '/app/discover',
              });
            }
          }).catch(() => {}),
        );
      }

      if (shouldSearchTasks) {
        promises.push(
          api.gigs.searchGigs(trimmed, { limit } as Parameters<typeof api.gigs.searchGigs>[1]).then((res) => {
            for (const g of res?.gigs || []) {
              const gig = g as typeof g & { poster_profile_picture_url?: string | null };
              unified.push({
                id: g.id,
                type: 'task',
                title: g.title || 'Untitled Task',
                subtitle: g.category || undefined,
                meta: g.price ? `$${Number(g.price).toFixed(0)}` : undefined,
                imageUrl: gig.poster_profile_picture_url || g.poster?.profile_picture_url || null,
                href: `/app/gigs/${g.id}`,
              });
            }
          }).catch(() => {}),
        );
      }

      if (shouldSearchListings) {
        promises.push(
          api.listings.getListings({ q: trimmed, limit }).then((res) => {
            for (const l of res?.listings || []) {
              const legacyImages = (l as { images?: Array<{ url?: string | null }> }).images;
              unified.push({
                id: l.id,
                type: 'listing',
                title: l.title || 'Untitled Listing',
                subtitle: l.category || undefined,
                meta: l.price != null ? `$${Number(l.price).toFixed(0)}` : l.is_free ? 'Free' : undefined,
                imageUrl: legacyImages?.[0]?.url || l.media_urls?.[0] || null,
                href: `/app/marketplace/${l.id}`,
              });
            }
          }).catch(() => {}),
        );
      }

      await Promise.allSettled(promises);

      // Discard results from superseded queries.
      if (signal.aborted) throw new Error('aborted');
      return unified;
    },
  });

  return {
    uniResults: query.data ?? [],
    uniLoading: enabled && query.isPending,
  };
}

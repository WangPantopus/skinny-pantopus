'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as api from '@pantopus/api';
import type { PriceFilterKey, SortKey } from '@pantopus/ui-utils';
import type { GigListItem } from '@pantopus/types';
import useViewerHome from './useViewerHome';

const PAGE_SIZE = 15;

function dedupeGigsById(items: any[]) {
  const byId = new Map<string, any>();
  for (const item of items) {
    const id = String(item?.id ?? '');
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, item);
    }
  }
  return Array.from(byId.values());
}

export function useGigsData() {
  // ── Location from viewer's primary home ──
  const { viewerHome } = useViewerHome();

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filter state ──
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceFilter, setPriceFilter] = useState<PriceFilterKey>('all');
  const [sortOption, setSortOption] = useState<SortKey>('newest');
  const [includeRemote, setIncludeRemote] = useState(true);

  // ── Data state ──
  const [gigs, setGigs] = useState<GigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ── Debounce search query (400ms) ──
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  // ── Fetch gigs (server-side filtering) ──
  const fetchGigs = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        setError(null);
        const filters: any = {
          page: pageNum,
          limit: PAGE_SIZE,
          status: ['open'],
          sort: sortOption,
        };

        if (selectedCategory !== 'All') {
          filters.category = selectedCategory;
        }

        if (debouncedSearch.trim()) {
          filters.search = debouncedSearch.trim();
        }

        // Map price filter buckets to server-side minPrice/maxPrice (dollars)
        if (priceFilter === 'under_50') {
          filters.maxPrice = 50;
        } else if (priceFilter === '50_to_150') {
          filters.minPrice = 50;
          filters.maxPrice = 150;
        } else if (priceFilter === 'over_150') {
          filters.minPrice = 150;
        }

        // Add location params from the viewer's primary home
        if (viewerHome) {
          filters.latitude = viewerHome.lat;
          filters.longitude = viewerHome.lng;
          filters.radiusMiles = 100;
          filters.includeRemote = includeRemote;
        }

        const result = await api.gigs.getGigs(filters);
        const items = (result as any)?.data || (result as any)?.gigs || [];

        if (append) {
          setGigs((prev) => dedupeGigsById([...prev, ...items]));
        } else {
          setGigs(dedupeGigsById(items));
        }

        setHasMore(items.length >= PAGE_SIZE);
        setPage(pageNum);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch gigs');
      }
    },
    [selectedCategory, debouncedSearch, priceFilter, sortOption, viewerHome?.lat, viewerHome?.lng, includeRemote]
  );

  // ── Auto-fetch when filters or debounced search change ──
  useEffect(() => {
    setLoading(true);
    fetchGigs(1, false).finally(() => setLoading(false));
  }, [selectedCategory, sortOption, priceFilter, debouncedSearch, fetchGigs]);

  // ── Refresh (page 1) ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGigs(1, false);
    setRefreshing(false);
  }, [fetchGigs]);

  // ── Load more (next page) ──
  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchGigs(page + 1, true);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, fetchGigs]);

  // ── Active filter count ──
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'All') count += 1;
    if (priceFilter !== 'all') count += 1;
    if (sortOption !== 'newest') count += 1;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [selectedCategory, priceFilter, sortOption, searchQuery]);

  // ── Clear all filters ──
  const clearAllFilters = useCallback(() => {
    setSelectedCategory('All');
    setPriceFilter('all');
    setSortOption('newest');
    setSearchQuery('');
  }, []);

  return {
    // State
    searchQuery,
    debouncedSearch,
    selectedCategory,
    priceFilter,
    sortOption,
    gigs,
    loading,
    error,
    refreshing,
    loadingMore,
    page,
    hasMore,

    // Setters
    setSearchQuery,
    setSelectedCategory,
    setPriceFilter,
    setSortOption,
    includeRemote,
    setIncludeRemote,

    // Actions
    fetchGigs,
    onRefresh,
    onLoadMore,

    // Computed
    activeFilterCount,
    clearAllFilters,
  };
}

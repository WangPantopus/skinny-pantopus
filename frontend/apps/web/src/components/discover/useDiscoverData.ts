'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { DiscoverySearchResult, DiscoverySearchResponse, MapBusinessMarker } from '@pantopus/api';
import useViewerHome from '@/hooks/useViewerHome';
import { DEFAULT_FILTERS } from './DiscoveryFilterPanel';
import { LS_TRUST_LENS_KEY } from './constants';
import { queryKeys } from '@/lib/query-keys';
import type { DiscoveryFilters } from './DiscoveryFilterPanel';
import type { DiscoverySort } from './constants';
import type { MapLayerKey, MeasureFrom } from './DiscoverMap';
import type { ViewMode, SearchScope, UnifiedResult } from './discoverTypes';
import { PAGE_SIZE } from './discoverTypes';
import { useUniversalSearch } from './useUniversalSearch';

const URL_SEARCH_SCOPES: SearchScope[] = ['all', 'local_profiles', 'public_profiles', 'businesses', 'tasks', 'listings'];

function loadTrustLens(): DiscoverySort {
  if (typeof window === 'undefined') return 'relevance';
  try {
    const saved = localStorage.getItem(LS_TRUST_LENS_KEY);
    if (saved && ['relevance', 'distance', 'rating', 'fastest_response'].includes(saved)) {
      return saved as DiscoverySort;
    }
  } catch {}
  return 'relevance';
}

export function useDiscoverData() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q')?.trim() ?? '';
  const urlScope = searchParams.get('scope') ?? '';
  const initialScope = URL_SEARCH_SCOPES.includes(urlScope as SearchScope)
    ? (urlScope as SearchScope)
    : urlQuery
      ? 'all'
      : 'businesses';
  const { viewerHome, loading: homeLoading, hasHome } = useViewerHome();

  // ── Search ────────────────────────────────────────────────
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [scope, setScope] = useState<SearchScope>(initialScope);

  // ── Trust Lens ────────────────────────────────────────────
  const [sort, setSort] = useState<DiscoverySort>('relevance');

  // ── Filters ───────────────────────────────────────────────
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // ── GPS fallback ──────────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);

  // ── Inline chat drawer ───────────────────────────────────
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string } | null>(null);

  // ── View Mode ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const isMapView = viewMode === 'map';
  const isListView = viewMode === 'list';

  // ── Map state ─────────────────────────────────────────────
  const [mapLayers, setMapLayers] = useState<Set<MapLayerKey>>(() => new Set(['businesses']));
  const [measureFrom, setMeasureFrom] = useState<MeasureFrom>('home');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const handledUrlSearchRef = useRef('');

  // Determine whether we're in "business discovery" mode vs "universal search" mode
  const isBusinessMode = scope === 'businesses' && !debouncedQuery.trim();
  const showBusinessUI = scope === 'businesses';
  const showUniversalUI = scope !== 'businesses';

  // When query is typed while in a non-business scope, search universally
  const showUniResults = showUniversalUI && debouncedQuery.trim().length >= 2;

  // Load Trust Lens from localStorage on mount
  useEffect(() => {
    setSort(loadTrustLens());
  }, []);

  useEffect(() => {
    const key = `${urlQuery}\n${urlScope}`;
    if (!urlQuery && !urlScope) return;
    if (handledUrlSearchRef.current === key) return;
    handledUrlSearchRef.current = key;

    if (urlQuery) {
      setQuery(urlQuery);
      setDebouncedQuery(urlQuery);
    }

    if (URL_SEARCH_SCOPES.includes(urlScope as SearchScope)) {
      setScope(urlScope as SearchScope);
    } else if (urlQuery) {
      setScope('all');
    }
  }, [urlQuery, urlScope]);

  // GPS fallback if no home
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Debounce search query 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Resolve center coordinates
  const centerLat = viewerHome?.lat ?? gpsLat;
  const centerLng = viewerHome?.lng ?? gpsLng;

  // Map center helpers
  const homeCenter = useMemo<[number, number] | null>(
    () => (viewerHome ? [viewerHome.lat, viewerHome.lng] : null),
    [viewerHome],
  );
  const gpsCenter = useMemo<[number, number] | null>(
    () => (gpsLat != null && gpsLng != null ? [gpsLat, gpsLng] : null),
    [gpsLat, gpsLng],
  );

  // ── Universal search (extracted hook) ──────────────────────
  const { uniResults, uniLoading } = useUniversalSearch(debouncedQuery, scope, showUniversalUI);

  // Resolve no-location state
  const noLocation = !homeLoading && centerLat == null && centerLng == null;

  // ── Fetch businesses via useInfiniteQuery ─────────────────
  // Stable filter object for the query key — each combination caches independently.
  const discoverFilters = useMemo(() => ({
    centerLat,
    centerLng,
    radiusMiles: filters.radiusMiles,
    sort,
    query: debouncedQuery.trim(),
    categories: filters.categories.join(','),
    openNow: !!filters.openNow,
    workedNearby: !!filters.workedNearby,
    acceptsGigs: !!filters.acceptsGigs,
    newOnPantopus: !!filters.newOnPantopus,
    ratingMin: filters.ratingMin ?? null,
    foundingOnly: !!filters.foundingOnly,
    verifiedOnly: !!filters.verifiedOnly,
    viewerHomeId: viewerHome?.homeId ?? null,
  }), [centerLat, centerLng, filters, sort, debouncedQuery, viewerHome]);

  const enabled =
    showBusinessUI &&
    !homeLoading &&
    centerLat != null &&
    centerLng != null;

  const businessesQuery = useInfiniteQuery<
    DiscoverySearchResponse,
    Error,
    InfiniteData<DiscoverySearchResponse>,
    ReturnType<typeof queryKeys.discover>,
    number
  >({
    queryKey: queryKeys.discover('businesses', discoverFilters as Record<string, unknown>),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        throw new Error('Not authenticated');
      }

      const params: Parameters<typeof api.businesses.searchNearbyBusinesses>[0] = {
        lat: centerLat as number,
        lng: centerLng as number,
        radius_miles: filters.radiusMiles,
        sort,
        page: pageParam,
        page_size: PAGE_SIZE,
        viewer_home_id: viewerHome?.homeId,
        open_now: filters.openNow || undefined,
        worked_nearby: filters.workedNearby || undefined,
        accepts_gigs: filters.acceptsGigs || undefined,
        new_on_pantopus: filters.newOnPantopus || undefined,
        rating_min: filters.ratingMin ?? undefined,
        founding_only: filters.foundingOnly || undefined,
        verified_only: filters.verifiedOnly || undefined,
      };

      if (filters.categories.length > 0) {
        params.categories = filters.categories.join(',');
      }
      if (debouncedQuery.trim()) {
        params.q = debouncedQuery.trim();
      }

      const res = await api.businesses.searchNearbyBusinesses(params);
      if (signal.aborted) throw new Error('aborted');
      return res;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.has_more ? (lastPage.pagination.page + 1) : undefined,
    enabled,
    staleTime: 30_000,
  });

  // Derived state (preserves the old useState shape consumed below)
  const results = useMemo<DiscoverySearchResult[]>(() => {
    const pages = businessesQuery.data?.pages ?? [];
    const seen = new Set<string>();
    const out: DiscoverySearchResult[] = [];
    for (const page of pages) {
      for (const r of page.results || []) {
        if (seen.has(r.business_user_id)) continue;
        seen.add(r.business_user_id);
        out.push(r);
      }
    }
    return out;
  }, [businessesQuery.data]);

  const lastPage = businessesQuery.data?.pages[businessesQuery.data.pages.length - 1];
  const totalCount = lastPage?.pagination.total_count ?? 0;
  const banner = lastPage?.banner ?? null;
  const hasMore = businessesQuery.hasNextPage ?? false;
  const loading = enabled && businessesQuery.isPending;
  const loadingMore = businessesQuery.isFetchingNextPage;
  const error = businessesQuery.error
    ? (businessesQuery.error instanceof TypeError && businessesQuery.error.message.includes('fetch')
        ? 'Unable to reach the server. Check your connection and try again.'
        : 'No businesses found yet. Try adjusting your filters or check back later.')
    : null;

  // Imperative refetch shim (preserves external API)
  const fetchBusinesses = useCallback(
    async (_pageNum: number, reset: boolean) => {
      if (reset) await businessesQuery.refetch();
      else await businessesQuery.fetchNextPage();
    },
    [businessesQuery],
  );

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || !showBusinessUI) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
          void businessesQuery.fetchNextPage();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [businessesQuery, loading, loadingMore, hasMore, showBusinessUI]);

  // ── Contact handler ───────────────────────────────────────
  const handleContact = (businessUserId: string) => {
    const biz = results.find((r) => r.business_user_id === businessUserId);
    setChatTarget({ id: businessUserId, name: biz?.name || '' });
  };

  // ── Map pin handlers ──────────────────────────────────────
  const handleMapBusinessSelect = useCallback((marker: MapBusinessMarker) => {
    setChatTarget({ id: marker.business_user_id, name: marker.name });
  }, []);

  const handleMapGigSelect = useCallback(
    (gig: { id: string }) => {
      router.push(`/app/gigs/${gig.id}`);
    },
    [router],
  );

  // ── Grouped uni results for "All" scope ────────────────────
  const groupedUniResults = useMemo(() => {
    if (scope !== 'all') return null;
    const groups: { type: UnifiedResult['type']; label: string; items: UnifiedResult[] }[] = [
      { type: 'local_profile', label: 'Profiles', items: [] },
      { type: 'public_profile', label: 'Beacons', items: [] },
      { type: 'business', label: 'Businesses', items: [] },
      { type: 'task', label: 'Tasks', items: [] },
      { type: 'listing', label: 'Listings', items: [] },
    ];
    for (const r of uniResults) {
      const g = groups.find((g) => g.type === r.type);
      if (g) g.items.push(r);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [scope, uniResults]);

  const showLoading = showBusinessUI && (loading || homeLoading);

  // When switching scope, force map to list for non-business scopes
  useEffect(() => {
    if (showUniversalUI && viewMode === 'map') {
      setViewMode('list');
    }
  }, [showUniversalUI, viewMode]);

  return {
    // Viewer / location
    viewerHome,
    homeLoading,
    hasHome,
    noLocation,
    homeCenter,
    gpsCenter,

    // Search
    query,
    setQuery,
    debouncedQuery,
    scope,
    setScope,

    // Trust Lens
    sort,
    setSort,

    // Filters
    filters,
    setFilters,
    filtersCollapsed,
    setFiltersCollapsed,

    // Business results
    results,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    banner,
    error,
    fetchBusinesses,

    // Universal results
    uniResults,
    uniLoading,
    showUniResults,
    groupedUniResults,

    // Chat target
    chatTarget,
    setChatTarget,
    handleContact,

    // View mode
    viewMode,
    setViewMode,
    isMapView,
    isListView,

    // Map
    mapLayers,
    setMapLayers,
    measureFrom,
    setMeasureFrom,
    handleMapBusinessSelect,
    handleMapGigSelect,

    // Derived
    isBusinessMode,
    showBusinessUI,
    showUniversalUI,
    showLoading,

    // Refs
    sentinelRef,
  };
}

// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { GIG_BROWSE_CATEGORIES } from '@pantopus/ui-utils';
import type { SortKey, PriceFilterKey } from '@pantopus/ui-utils';
import { Maximize2, Minimize2, Search, X } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { ProBadge } from '@/components/ProBadge';
import ErrorState from '@/components/ui/ErrorState';
import { ShimmerLine, ShimmerBlock } from '@/components/ui/Shimmer';
import { TaskRow, FilterChipBar, BrowseFeed, CategoryRail, SupportTrainRow } from '@/components/gig-browse';
import MapTaskDrawer from '@/components/gig-browse/MapTaskDrawer';
import SmartSearch from '@/components/gig-browse/SmartSearch';
import NewTasksBanner from '@/components/gig-browse/NewTasksBanner';
import { useSocketEvent } from '@/hooks/useSocket';
import { useRadiusSuggestion } from '@/hooks/useRadiusSuggestion';
import type { FilterState } from '@/components/gig-browse';
import type { GigListItem, GigCluster, BrowseResponse } from '@pantopus/types';
import type { GigMapPin } from './GigsMap';

const GigsMap = dynamic(() => import('./GigsMap'), { ssr: false });

// ─── Constants ─────────────────────────────────────────────
const PAGE_SIZE = 15;
const METERS_PER_MILE = 1609.344;

// ─── Helpers ───────────────────────────────────────────────

function dedupeGigsById(items: GigListItem[]): GigListItem[] {
  const byId = new Map<string, GigListItem>();
  for (const item of items) {
    const id = String(item?.id ?? '');
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, item);
  }
  return Array.from(byId.values());
}

/** Convert FilterState to API query params */
function buildApiFilters(
  filters: FilterState,
  sort: string,
  search: string,
  pageNum: number,
  location?: { latitude: number; longitude: number; radiusMiles?: number }
): Record<string, any> {
  const params: Record<string, any> = {
    page: pageNum,
    limit: PAGE_SIZE,
    status: ['open'],
    sort,
  };

  // Category — support single or multi-select
  if (filters.categories && filters.categories.length === 1) {
    params.category = filters.categories[0];
  } else if (filters.categories && filters.categories.length > 1) {
    // Backend currently only supports single category; use first for now
    params.category = filters.categories[0];
  }

  // Search
  if (search.trim()) params.search = search.trim();

  // Price (dollars)
  if (filters.minPrice) params.minPrice = filters.minPrice;
  if (filters.maxPrice) params.maxPrice = filters.maxPrice;

  // Distance (meters) — exclude remote tasks when filtering by distance
  if (filters.max_distance) {
    params.max_distance = filters.max_distance;
    params.includeRemote = 'false';
  }

  // Deadline
  if (filters.deadline) params.deadline = filters.deadline;

  if (location?.latitude != null && location?.longitude != null) {
    params.latitude = location.latitude;
    params.longitude = location.longitude;
    params.radiusMiles = location.radiusMiles || 100;
  }

  return params;
}

function formatRadiusLabel(miles: number): string {
  return miles === 25000 ? 'Global' : `${miles} mi`;
}

// ─── Legacy bridge: convert FilterState to PriceFilterKey for GigsMap ──

function filterStateToPriceFilter(f: FilterState): PriceFilterKey {
  if (f.maxPrice === 50 && !f.minPrice) return 'under_50';
  if (f.minPrice === 50 && f.maxPrice === 150) return '50_to_150';
  if (f.minPrice === 150 && !f.maxPrice) return 'over_150';
  return 'all';
}

function filterStateToCategory(f: FilterState): string {
  if (f.categories && f.categories.length === 1) return f.categories[0];
  return 'All';
}

/** True when any filter chip or search is active */
function hasActiveFilters(filters: FilterState, search: string): boolean {
  if (search.trim()) return true;
  if (filters.categories && filters.categories.length > 0) return true;
  if (filters.minPrice != null) return true;
  if (filters.maxPrice != null) return true;
  if (filters.max_distance != null) return true;
  if (filters.deadline != null) return true;
  return false;
}

// ─── Main Component ────────────────────────────────────────
export default function GigsBrowsePage() {
  const router = useRouter();

  // Auth check
  useEffect(() => {
    const token = getAuthToken();
    if (!token) router.push('/login');
  }, [router]);

  // ── User location (for browse sections API) ──
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(100);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {
        // Geolocation denied/unavailable — browse feed will not render,
        // fall back to flat list automatically
      },
      { timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  // ── Filter & Sort State (server-side) ──
  const [filters, setFilters] = useState<FilterState>({});
  const [sortOption, setSortOption] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Force flat list mode (set when browse feed errors or user clicks "See all") ──
  const [forceFlatList, setForceFlatList] = useState(false);

  // ── New tasks banner (WebSocket) ──
  const [newGigCount, setNewGigCount] = useState(0);
  const newGigCountRef = useRef(0);

  useSocketEvent<{ id: string }>(
    'gig:new',
    useCallback(() => {
      newGigCountRef.current += 1;
      setNewGigCount(newGigCountRef.current);
    }, [])
  );

  const [browseRefreshKey, setBrowseRefreshKey] = useState(0);

  const resetNewGigCount = useCallback(() => {
    newGigCountRef.current = 0;
    setNewGigCount(0);
  }, []);

  // ── Cluster data from BrowseFeed (for CategoryRail) ──
  const [clusters, setClusters] = useState<GigCluster[]>([]);
  const [browseTaskCount, setBrowseTaskCount] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);

  const handleBrowseDataLoaded = useCallback((data: BrowseResponse) => {
    setClusters(data.sections.clusters);
    setBrowseTaskCount(data.total_active || 0);
  }, []);

  // ── Map view drawer state ──
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [mapViewportGigs, setMapViewportGigs] = useState<GigMapPin[]>([]);
  const [mapViewportLoading, setMapViewportLoading] = useState(false);
  const [mapSelectedGigId, setMapSelectedGigId] = useState<string | null>(null);
  const [mapHoveredGigId, setMapHoveredGigId] = useState<string | null>(null);
  const activeMapGigId = mapHoveredGigId ?? mapSelectedGigId;

  // ── View mode ──
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const isMapView = viewMode === 'map';
  const isListView = viewMode === 'list';

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pantopus_gigs_view_mode');
      if (saved === 'list' || saved === 'map') setViewMode(saved);
    } catch {}
  }, []);

  const handleSetViewMode = useCallback((mode: 'list' | 'map') => {
    setViewMode(mode);
    try {
      localStorage.setItem('pantopus_gigs_view_mode', mode);
    } catch {}
  }, []);

  // ── Determine feed mode ──
  const filtersActive = hasActiveFilters(filters, debouncedSearch);
  const showSectionFeed = !filtersActive && !forceFlatList && userLat != null && userLng != null;

  // ── Data state (flat list) ──
  const [gigs, setGigs] = useState<GigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Feed kind (Tasks vs Support Trains) ──
  const [feedKind, setFeedKind] = useState<'tasks' | 'support_trains'>('tasks');
  const [nearbyTrains, setNearbyTrains] = useState<any[]>([]);
  const [trainsLoading, setTrainsLoading] = useState(false);
  const [trainsError, setTrainsError] = useState<string | null>(null);

  // Fetch nearby support trains when tab is active + geolocation is available
  useEffect(() => {
    if (feedKind !== 'support_trains') return;
    if (userLat == null || userLng == null) {
      setNearbyTrains([]);
      return;
    }
    let cancelled = false;
    setTrainsLoading(true);
    setTrainsError(null);
    const radiusMeters = filters.max_distance ?? radiusMiles * METERS_PER_MILE;
    api.supportTrains
      .listNearbySupportTrains({
        latitude: userLat,
        longitude: userLng,
        radius_meters: radiusMeters,
        limit: 50,
      })
      .then((res) => {
        if (cancelled) return;
        setNearbyTrains(res?.support_trains || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Failed to fetch nearby Support Trains:', err);
        setTrainsError('Failed to load Support Trains.');
        setNearbyTrains([]);
      })
      .finally(() => {
        if (!cancelled) setTrainsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedKind, userLat, userLng, filters.max_distance, radiusMiles]);

  // ── Search debounce ──
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // ── Fetch gigs (server-side filter + sort) — only when in flat list mode ──
  const fetchGigs = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        setFetchError(null);
        const location =
          userLat != null && userLng != null
            ? { latitude: userLat, longitude: userLng, radiusMiles }
            : undefined;
        const apiParams = buildApiFilters(
          filters,
          sortOption,
          debouncedSearch,
          pageNum,
          location
        );

        const result = await api.gigs.getGigs(apiParams);
        const resultData = result as Record<string, any>;
        const raw = (resultData?.gigs ?? resultData?.data ?? []) as GigListItem[];
        const items = Array.isArray(raw) ? raw : [];

        if (append) {
          setGigs((prev) => dedupeGigsById([...prev, ...items]));
        } else {
          setGigs(dedupeGigsById(items));
        }

        setHasMore(items.length >= PAGE_SIZE);
        setPage(pageNum);
      } catch (err) {
        console.warn('Failed to fetch gigs:', err);
        if (!append) setFetchError('Failed to load tasks. Please try again.');
      }
    },
    [filters, debouncedSearch, sortOption, userLat, userLng, radiusMiles]
  );

  // Fetch flat list when NOT in section mode
  useEffect(() => {
    if (showSectionFeed) return;
    setLoading(true);
    resetNewGigCount();
    fetchGigs(1, false).finally(() => setLoading(false));
  }, [fetchGigs, showSectionFeed, resetNewGigCount]);

  // Load more
  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchGigs(page + 1, true);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, fetchGigs]);

  // Refresh
  const onRefresh = useCallback(async () => {
    setLoading(true);
    resetNewGigCount();
    await fetchGigs(1, false);
    setLoading(false);
  }, [fetchGigs, resetNewGigCount]);

  // Banner tap → refresh feed (both flat list and section modes)
  const handleBannerTap = useCallback(() => {
    resetNewGigCount();
    if (showSectionFeed) {
      setBrowseRefreshKey((k) => k + 1);
    } else {
      onRefresh();
    }
  }, [resetNewGigCount, onRefresh, showSectionFeed]);

  // Handle gig click from map
  const handleMapGigClick = useCallback(
    (gigId: string) => {
      if (gigId === 'new') {
        router.push('/app/gigs-v2/new');
      } else {
        router.push(`/app/gigs/${gigId}`);
      }
    },
    [router]
  );

  const handleOpenMapGig = useCallback(
    (gigId: string) => {
      setMapSelectedGigId(gigId);
      handleMapGigClick(gigId);
    },
    [handleMapGigClick]
  );

  // ── Browse feed callbacks ──
  const handleCategoryClick = useCallback((category: string) => {
    setFilters({ categories: [category] });
    setForceFlatList(false); // will switch to flat list automatically via filtersActive
  }, []);

  const handleSeeAllClick = useCallback(() => {
    setForceFlatList(true);
  }, []);

  const handleBrowseError = useCallback(() => {
    setForceFlatList(true);
  }, []);

  useEffect(() => {
    if (showSectionFeed) setBrowseLoading(true);
  }, [showSectionFeed, userLat, userLng, radiusMiles, browseRefreshKey]);

  // When filters are cleared, reset forceFlatList so section feed shows again
  const handleFilterChange = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);
      if (!hasActiveFilters(newFilters, searchQuery)) {
        setForceFlatList(false);
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    if (!mapSelectedGigId) return;
    if (!mapViewportGigs.some((gig) => gig.id === mapSelectedGigId)) {
      setMapSelectedGigId(null);
    }
  }, [mapSelectedGigId, mapViewportGigs]);

  const visibleTaskCount = showSectionFeed ? browseTaskCount : gigs.length;
  const radiusSuggestion = useRadiusSuggestion(
    visibleTaskCount,
    radiusMiles,
    setRadiusMiles,
    {
      enabled:
        isListView &&
        feedKind === 'tasks' &&
        !filtersActive &&
        !loading &&
        (!showSectionFeed || !browseLoading) &&
        userLat != null &&
        userLng != null,
      singularLabel: 'task',
      pluralLabel: 'tasks',
    }
  );

  // ── Shared header bar ──
  const headerBar = (
    <div className="bg-app-surface border-b border-app-border-subtle">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-app-text flex items-center gap-2">
            <span>💼</span> Tasks
            <ProBadge />
          </h1>
          <div className="flex bg-app-surface-sunken rounded-lg p-0.5">
            <button
              onClick={() => handleSetViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                isListView
                  ? 'bg-primary-600 text-white'
                  : 'text-app-text-secondary hover:text-app-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              List
            </button>
            <button
              onClick={() => handleSetViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                isMapView
                  ? 'bg-primary-600 text-white'
                  : 'text-app-text-secondary hover:text-app-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Map
            </button>
          </div>
        </div>
        <button
          onClick={() => router.push('/app/gigs-v2/new')}
          className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post Task
        </button>
      </div>
      <div className="border-t border-app-border-subtle">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 px-4 py-2 text-xs text-app-text-secondary">
          <span>Looking for your own tasks?</span>
          <button
            onClick={() => router.push('/app/my-gigs')}
            className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Go to My Tasks
          </button>
          <span className="text-app-text-muted">·</span>
          <button
            onClick={() => router.push('/app/support-trains')}
            className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
          >
            My Support Trains
          </button>
        </div>
      </div>
    </div>
  );

  // ── Map view ──
  if (isMapView) {
    return (
      <div className="relative min-h-screen bg-app">
        {headerBar}
        <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden">
          <GigsMap
            searchQuery={searchQuery}
            selectedCategory={filterStateToCategory(filters)}
            priceFilter={filterStateToPriceFilter(filters)}
            sortOption={sortOption as SortKey}
            onGigClick={handleMapGigClick}
            tasksPanelOpen={mapDrawerOpen}
            onToggleTasksPanel={() => setMapDrawerOpen((open) => !open)}
            onVisibleGigsChange={setMapViewportGigs}
            onLoadingChange={setMapViewportLoading}
            activeGigId={activeMapGigId}
            onPinSelect={(id) => {
              setMapSelectedGigId(id);
              if (id) setMapDrawerOpen(true);
            }}
          />
          <MapTaskDrawer
            open={mapDrawerOpen}
            loading={mapViewportLoading}
            tasks={mapViewportGigs}
            selectedGigId={mapSelectedGigId}
            onClose={() => setMapDrawerOpen(false)}
            onOpenGig={handleOpenMapGig}
            onHoverGig={setMapHoveredGigId}
          />
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="min-h-screen bg-app-surface-raised">
      {/* Skip link for keyboard users */}
      <a
        href="#task-feed"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to task feed
      </a>
      {headerBar}

      <div className="flex">
        {/* ── Main content area ── */}
        <div className="flex-1 min-w-0">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            {/* ── Search Bar ── */}
            <SmartSearch
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={(q) => setSearchQuery(q)}
            />

            {/* ── Two-column layout: CategoryRail (desktop) + main content ── */}
            <div className="flex gap-6">
              {/* Left: Category Rail — desktop only */}
              {clusters.length > 0 && (
                <CategoryRail
                  clusters={clusters}
                  activeFilters={filters}
                  onFilterChange={handleFilterChange}
                />
              )}

              {/* Right: Filter chips + feed */}
              <div className="flex-1 min-w-0">
                {/* ── Feed Kind Tabs (Tasks / Support Trains) ── */}
                <div className="flex gap-2 mb-3">
                  {([
                    { key: 'tasks', label: 'Tasks' },
                    { key: 'support_trains', label: 'Support Trains' },
                  ] as const).map(({ key, label }) => {
                    const active = feedKind === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFeedKind(key)}
                        className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition ${
                          active
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-app-surface border-app-border text-app-text-secondary hover:text-app-text'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* ── Filter Chip Bar (hidden in Support Trains mode) ── */}
                {feedKind === 'tasks' && (
                  <div className="mb-4">
                    <FilterChipBar
                      activeFilters={filters}
                      onFilterChange={handleFilterChange}
                      activeSort={sortOption}
                      onSortChange={setSortOption}
                      categories={[...GIG_BROWSE_CATEGORIES]}
                    />
                  </div>
                )}

                {/* ── New Tasks Banner ── */}
                {newGigCount > 0 && (
                  <div className="mb-4 flex justify-center">
                    <NewTasksBanner
                      count={newGigCount}
                      onTap={handleBannerTap}
                      onDismiss={resetNewGigCount}
                    />
                  </div>
                )}

                {feedKind === 'tasks' && radiusSuggestion.suggestion && (
                  <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
                    {radiusSuggestion.suggestion.direction === 'expand' ? (
                      <Maximize2 className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
                    ) : (
                      <Minimize2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    )}
                    <span className="min-w-0 flex-1">{radiusSuggestion.suggestion.reason}</span>
                    <button
                      type="button"
                      onClick={radiusSuggestion.applySuggestion}
                      className="shrink-0 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {formatRadiusLabel(radiusSuggestion.suggestion.suggestedRadius)}
                    </button>
                    <button
                      type="button"
                      onClick={radiusSuggestion.dismiss}
                      aria-label="Dismiss radius suggestion"
                      className="shrink-0 rounded-md p-1 text-sky-700 transition hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* ── Support Trains feed ── */}
                {feedKind === 'support_trains' ? (
                  <div id="task-feed" role="feed" aria-label="Support Trains list">
                    {trainsError && (
                      <ErrorState
                        message={trainsError}
                        onRetry={() => {
                          // re-trigger fetch by toggling
                          setFeedKind('tasks');
                          setTimeout(() => setFeedKind('support_trains'), 0);
                        }}
                      />
                    )}
                    {!trainsError && trainsLoading && nearbyTrains.length === 0 ? (
                      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 px-4 py-3 border-b border-app-border-subtle last:border-b-0"
                          >
                            <ShimmerBlock className="h-11 w-11 rounded-lg shrink-0" />
                            <div className="flex flex-col gap-1.5 flex-1">
                              <ShimmerLine width="w-48" />
                              <ShimmerLine width="w-64" className="h-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : nearbyTrains.length === 0 ? (
                      <EmptyState
                        icon={Search}
                        title={
                          userLat == null || userLng == null
                            ? 'Location needed'
                            : 'No nearby Support Trains'
                        }
                        description={
                          userLat == null || userLng == null
                            ? 'Enable location to see Support Trains near you.'
                            : 'No published Support Trains in your area yet. Start one to organize meals, rides, or help for a neighbor.'
                        }
                        actionLabel="Start a Support Train"
                        onAction={() => router.push('/app/support-trains/new')}
                      />
                    ) : (
                      <>
                        <p className="text-xs text-app-text-muted mb-2">
                          Showing {nearbyTrains.length} Support Train
                          {nearbyTrains.length !== 1 ? 's' : ''} near you
                        </p>
                        <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
                          {nearbyTrains.map((train) => (
                            <SupportTrainRow key={train.support_train_id} train={train} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : showSectionFeed ? (
                  <BrowseFeed
                    lat={userLat}
                    lng={userLng}
                    radiusMeters={Math.round(radiusMiles * METERS_PER_MILE)}
                    onCategoryClick={handleCategoryClick}
                    onSeeAllClick={handleSeeAllClick}
                    onError={handleBrowseError}
                    onDataLoaded={handleBrowseDataLoaded}
                    onLoadingChange={setBrowseLoading}
                    refreshKey={browseRefreshKey}
                  />
                ) : (
                  <div id="task-feed" role="feed" aria-label="Task list">
                    {/* ── Error Banner ── */}
                    {fetchError && !loading && gigs.length === 0 && (
                      <ErrorState message={fetchError} onRetry={onRefresh} />
                    )}
                    {fetchError && gigs.length > 0 && (
                      <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3">
                        <p className="text-sm text-red-700 dark:text-red-300">{fetchError}</p>
                        <button
                          onClick={onRefresh}
                          className="ml-4 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* ── Content: Compact Row List ── */}
                    {loading && gigs.length === 0 ? (
                      <div className="space-y-0 rounded-xl border border-app-border bg-app-surface overflow-hidden">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 px-4 py-3 border-b border-app-border-subtle last:border-b-0"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <div className="flex flex-col gap-1.5 flex-1">
                              <div className="flex justify-between">
                                <ShimmerLine width="w-48" />
                                <ShimmerLine width="w-12" />
                              </div>
                              <div className="flex gap-2">
                                <ShimmerLine width="w-16" className="h-3" />
                                <ShimmerLine width="w-12" className="h-3" />
                              </div>
                              <ShimmerLine width="w-64" className="h-3" />
                            </div>
                            <ShimmerBlock className="h-12 w-12 rounded-lg shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : gigs.length === 0 ? (
                      <div>
                        <EmptyState
                          icon={Search}
                          title={
                            debouncedSearch
                              ? `No tasks found for "${debouncedSearch}"`
                              : 'No tasks match your filters'
                          }
                          description={
                            debouncedSearch
                              ? 'Try these instead:'
                              : 'Try expanding your search or check back later.'
                          }
                          actionLabel={
                            debouncedSearch ? `Post "${debouncedSearch}" as a task` : 'Post a Task'
                          }
                          onAction={() =>
                            router.push(
                              debouncedSearch
                                ? `/app/gigs/new?title=${encodeURIComponent(debouncedSearch)}`
                                : '/app/gigs-v2/new'
                            )
                          }
                        />
                        {debouncedSearch && (
                          <div className="flex justify-center gap-2 mt-3">
                            {['Pet Care', 'Handyman', 'Cleaning', 'Tutoring'].map((chip) => (
                              <button
                                key={chip}
                                onClick={() => setSearchQuery(chip)}
                                className="px-3 py-1.5 text-xs font-medium bg-app-surface border border-app-border rounded-full hover:bg-primary-50 dark:hover:bg-primary-950 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-400 dark:hover:border-primary-600 transition"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Results count */}
                        <p className="text-xs text-app-text-muted mb-2">
                          Showing {gigs.length} task
                          {gigs.length !== 1 ? 's' : ''}
                          {hasMore ? '+' : ''}
                        </p>

                        {/* Task rows */}
                        <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
                          {gigs.map((gig) => (
                            <TaskRow key={gig.id} gig={gig} />
                          ))}
                        </div>

                        {/* Load More */}
                        {hasMore && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={onLoadMore}
                              disabled={loadingMore}
                              className="px-6 py-2.5 bg-app-surface border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                              {loadingMore ? (
                                <span className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                                  Loading...
                                </span>
                              ) : (
                                'Load More'
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

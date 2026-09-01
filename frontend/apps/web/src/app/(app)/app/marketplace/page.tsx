'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient, useMutation, type InfiniteData } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import MarketplaceSnapshotCard from '@/components/dashboard/MarketplaceSnapshotCard';
import type {
  Listing,
  MarketplaceBrowseParams,
  MarketplaceBrowseResponse,
  MarketplaceDiscoverResponse,
} from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

import { Store, ArrowUpDown, Clock, Navigation, TrendingDown, TrendingUp, Check, Maximize2, Minimize2, X } from 'lucide-react';
import ListingCard from './ListingCard';
import MarketplaceTabs from './MarketplaceTabs';
import FilterPillBar from './FilterPillBar';
import CreateListingModal from './CreateListingModal';
import SnapSellListingModal from './SnapSellListingModal';
import type { SnapSellListingBootstrap } from './snapSellTypes';
import MarketplaceDiscoveryFeed from '@/components/marketplace-browse/MarketplaceDiscoveryFeed';
import MarketplaceSearch from '@/components/marketplace-browse/MarketplaceSearch';
import NewListingsBanner from '@/components/marketplace-browse/NewListingsBanner';
import { useSocketEvent } from '@/hooks/useSocket';
import { useRadiusSuggestion } from '@/hooks/useRadiusSuggestion';
import { CATEGORIES, type MarketplaceTab, type FilterPillKey } from './constants';
import { CategoryIcon } from './iconMap';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

const MarketplaceMap = dynamic(() => import('./MarketplaceMap'), { ssr: false });

// ── Helpers ──────────────────────────────────────────────────

const DEFAULT_RADIUS_MILES = 100;
const GLOBAL_RADIUS_MILES = 25000;
const METERS_PER_MILE = 1609.344;
const WORLD_BOUNDS = { south: -90, west: -180, north: 90, east: 180 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Convert center coords and radius to API bounds. */
function boundsFromCenter(lat: number, lng: number, radiusMiles = DEFAULT_RADIUS_MILES) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return WORLD_BOUNDS;

  const radius = Number.isFinite(radiusMiles) && radiusMiles > 0
    ? radiusMiles
    : DEFAULT_RADIUS_MILES;
  if (radius >= GLOBAL_RADIUS_MILES) return WORLD_BOUNDS;

  const latDelta = radius / 69;
  const cosLat = Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 0.01);
  const lngDelta = radius / (69 * cosLat);
  const west = lng - lngDelta;
  const east = lng + lngDelta;

  return {
    south: clamp(lat - latDelta, -90, 90),
    north: clamp(lat + latDelta, -90, 90),
    west: west < -180 || east > 180 || lngDelta >= 180 ? -180 : west,
    east: west < -180 || east > 180 || lngDelta >= 180 ? 180 : east,
  };
}

function formatRadiusLabel(miles: number): string {
  return miles === GLOBAL_RADIUS_MILES ? 'Global' : `${miles} mi`;
}

type Bounds = { south: number; west: number; north: number; east: number };
type NearestActivityCenter = { latitude: number; longitude: number };
type MarketplaceBrowseResponseWithNearest = MarketplaceBrowseResponse & {
  nearest_activity_center?: NearestActivityCenter | null;
};
type SortKey = 'newest' | 'nearest' | 'price_low' | 'price_high';
type NewListingEvent = {
  id: string;
  category?: string;
  layer?: string;
  listing_type?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_free?: boolean;
  is_wanted?: boolean;
};

const MAX_DEDUP_IDS = 100;

const PRICE_PILL_KEYS: FilterPillKey[] = ['price_0_25', 'price_25_100', 'price_100_up'];

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'newest', label: 'Newest', icon: Clock },
  { key: 'nearest', label: 'Nearest', icon: Navigation },
  { key: 'price_low', label: 'Price: Low → High', icon: TrendingDown },
  { key: 'price_high', label: 'Price: High → Low', icon: TrendingUp },
];

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ── View + filter state ──────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('near');
  const [activeFilters, setActiveFilters] = useState<FilterPillKey[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // ── Bounds (source of truth for Browse Mode queries) ─────────
  const [activeBounds, setActiveBounds] = useState<Bounds | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);

  // ── UI state ─────────────────────────────────────────────────
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSnapSellModal, setShowSnapSellModal] = useState(false);
  const [snapSellBootstrap, setSnapSellBootstrap] = useState<SnapSellListingBootstrap | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Real-time new listings banner ──────────────────────────
  const [newListingCount, setNewListingCount] = useState(0);
  const newListingCountRef = useRef(0);
  const seenIdsRef = useRef(new Set<string>());

  useSocketEvent<NewListingEvent>('listing:new', useCallback((data: NewListingEvent) => {
    // Dedup: skip if already seen
    if (!data.id || seenIdsRef.current.has(data.id)) return;
    seenIdsRef.current.add(data.id);
    if (seenIdsRef.current.size > MAX_DEDUP_IDS) {
      const first = seenIdsRef.current.values().next().value;
      if (first !== undefined) seenIdsRef.current.delete(first);
    }

    // Check bounds: listing must be within activeBounds (or be remote when remote pill active)
    const isRemote = data.latitude == null || data.longitude == null;
    const remoteActive = activeFilters.includes('remote');

    if (remoteActive) {
      // Remote pill → only count NULL-coordinate listings
      if (!isRemote) return;
    } else if (activeBounds) {
      // Normal view → listing must be within current map bounds
      if (isRemote) return; // remote listings don't match bounded views
      if (
        data.latitude! < activeBounds.south || data.latitude! > activeBounds.north ||
        data.longitude! < activeBounds.west || data.longitude! > activeBounds.east
      ) return;
    }

    // Check category filter
    if (category !== 'all' && data.category !== category) return;

    // Check tab/layer filter
    if (activeTab === 'gigs' && data.layer !== 'gigs') return;

    // Check filter pills
    if (activeFilters.includes('free') && !data.is_free) return;
    if (activeFilters.includes('wanted') && !data.is_wanted) return;

    newListingCountRef.current += 1;
    setNewListingCount(newListingCountRef.current);
  }, [activeBounds, category, activeTab, activeFilters]));

  const handleNewListingsDismiss = useCallback(() => {
    newListingCountRef.current = 0;
    setNewListingCount(0);
  }, []);

  // ── Derived mode ─────────────────────────────────────────────
  const hasActiveFilters = activeFilters.length > 0 || category !== 'all' || activeTab !== 'global';
  // "Discovery" uses GET /discover (curated sections). On the default Global Finds tab that hid the
  // real browse grid and showed an empty curated state while /browse had listings. Global must use
  // unified browse (with expanded bounds in buildBrowseParams), same as map view.
  const isDiscovery =
    !hasActiveFilters && !searchQuery && viewMode === 'grid' && activeTab !== 'global';
  const isMapView = viewMode === 'map';
  const isGridView = viewMode === 'grid';

  const activeCategory = CATEGORIES.find(c => c.key === category) || CATEGORIES[0];

  // ── Build filter params for /browse ──────────────────────────
  const buildBrowseParams = useCallback((bounds: Bounds, cursorValue?: string | null): MarketplaceBrowseParams => {
    const params: MarketplaceBrowseParams = {
      south: bounds.south,
      west: bounds.west,
      north: bounds.north,
      east: bounds.east,
      sort,
      limit: 40,
    };

    if (cursorValue) params.cursor = cursorValue;
    if (category !== 'all') params.category = category;
    if (debouncedSearch.trim().length >= 2) params.search = debouncedSearch.trim();

    // Tab-based params
    if (activeTab === 'gigs') params.layer = 'gigs';
    if (activeTab === 'global') {
      // Expand bounds significantly for global tab
      const latMid = (bounds.south + bounds.north) / 2;
      const lngMid = (bounds.west + bounds.east) / 2;
      const globalBounds = boundsFromCenter(latMid, lngMid, 25000);
      params.south = globalBounds.south;
      params.north = globalBounds.north;
      params.west = globalBounds.west;
      params.east = globalBounds.east;
    }

    // Filter pills
    for (const f of activeFilters) {
      switch (f) {
        case 'free': params.is_free = true; break;
        case 'wanted': params.is_wanted = true; break;
        case 'trusted': params.trust_only = true; break;
        case 'nearby':
          if (userLocation) {
            const nearBounds = boundsFromCenter(userLocation.latitude, userLocation.longitude, 1);
            params.south = nearBounds.south;
            params.north = nearBounds.north;
            params.west = nearBounds.west;
            params.east = nearBounds.east;
          }
          params.include_remote = false;
          break;
        case 'remote':
          params.remote_only = true;
          break;
        case 'new_today': {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          params.created_after = startOfDay.toISOString();
          break;
        }
        case 'price_0_25':
          params.min_price = 0;
          params.max_price = 25;
          break;
        case 'price_25_100':
          params.min_price = 25;
          params.max_price = 100;
          break;
        case 'price_100_up':
          params.min_price = 100;
          break;
      }
    }

    // Sort-specific: add ref_lat/ref_lng for nearest
    if (sort === 'nearest' && userLocation) {
      params.ref_lat = userLocation.latitude;
      params.ref_lng = userLocation.longitude;
    }

    return params;
  }, [sort, category, debouncedSearch, activeTab, activeFilters, userLocation]);

  // ── Stable query filter object for cache keying ────────────
  const browseFilters = useMemo(() => ({
    bounds: activeBounds,
    category,
    search: debouncedSearch.trim(),
    tab: activeTab,
    filters: activeFilters,
    sort,
    userLocation,
  }), [activeBounds, category, debouncedSearch, activeTab, activeFilters, sort, userLocation]);

  // ── Browse: useInfiniteQuery keyed by filters ──────────────
  const browseQuery = useInfiniteQuery<
    MarketplaceBrowseResponseWithNearest,
    Error,
    InfiniteData<MarketplaceBrowseResponseWithNearest>,
    ReturnType<typeof queryKeys.marketplace>,
    string | null
  >({
    queryKey: queryKeys.marketplace('browse', browseFilters as Record<string, any>),
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      if (!activeBounds) throw new Error('No bounds');
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        throw new Error('Not authenticated');
      }
      const params = buildBrowseParams(activeBounds, pageParam);
      const result = await api.listings.browseListings(params);
      if (signal.aborted) throw new Error('aborted');
      return result;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.has_more ? lastPage.pagination.next_cursor || null : undefined,
    enabled: !!activeBounds && !!userLocation && !isDiscovery,
    staleTime: 30_000,
  });

  // ── Discover: curated sections ─────────────────────────────
  const discoverQuery = useQuery<MarketplaceDiscoverResponse>({
    queryKey: queryKeys.marketplace('discover', {
      lat: userLocation?.latitude ?? null,
      lng: userLocation?.longitude ?? null,
      radiusMiles,
    } as Record<string, any>),
    queryFn: async ({ signal }) => {
      if (!userLocation) throw new Error('No userLocation');
      const result = await api.listings.discoverListings({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radius: Math.round(radiusMiles * METERS_PER_MILE),
      });
      if (signal.aborted) throw new Error('aborted');
      return result;
    },
    enabled: !!userLocation && isDiscovery,
    staleTime: 30_000,
  });

  // ── Derived state (preserves the old useState shape) ───────
  const browseListings = useMemo<Listing[]>(() => {
    const pages = browseQuery.data?.pages ?? [];
    const seen = new Set<string>();
    const out: Listing[] = [];
    for (const page of pages) {
      for (const l of page?.listings || []) {
        if (seen.has(l.id)) continue;
        seen.add(l.id);
        out.push(l);
      }
    }
    return out;
  }, [browseQuery.data]);

  const lastBrowsePage = browseQuery.data?.pages[browseQuery.data.pages.length - 1];
  const totalInBounds = lastBrowsePage?.meta?.total_in_bounds || browseListings.length;
  const nearestActivityCenter = lastBrowsePage?.nearest_activity_center ?? null;
  const hasMore = browseQuery.hasNextPage ?? false;
  const loading = isDiscovery ? discoverQuery.isPending : browseQuery.isPending;
  const loadingMore = browseQuery.isFetchingNextPage;
  const discoverData = discoverQuery.data ?? null;
  const visibleListingCount = Math.max(totalInBounds, browseListings.length);
  const radiusSuggestionEnabled =
    isGridView &&
    !isDiscovery &&
    activeTab !== 'global' &&
    activeFilters.length === 0 &&
    debouncedSearch.trim().length === 0 &&
    !loading &&
    userLocation != null;
  const radiusSuggestion = useRadiusSuggestion(
    visibleListingCount,
    radiusMiles,
    setRadiusMiles,
    {
      enabled: radiusSuggestionEnabled,
      singularLabel: 'listing',
      pluralLabel: 'listings',
    }
  );

  // ── Snapshot stats ─────────────────────────────────────────
  const marketplaceSnapshot = useMemo(() => {
    return { inView: browseListings.length, newToday: 0, urgentDeadlines: 0, myPendingOffers: 0 };
  }, [browseListings.length]);

  // ── New listings banner tap → refetch browse ──────────────
  const handleNewListingsTap = useCallback(() => {
    newListingCountRef.current = 0;
    setNewListingCount(0);
    void browseQuery.refetch();
  }, [browseQuery]);

  // Clear new-listings counter on fresh load (filter/bounds change → new key)
  useEffect(() => {
    newListingCountRef.current = 0;
    setNewListingCount(0);
  }, [activeBounds, category, activeTab, activeFilters, sort, debouncedSearch]);

  // ── Viewing Location/geolocation → initial bounds ───────────
  useEffect(() => {
    let cancelled = false;

    const applyLocation = (loc: { latitude: number; longitude: number }, radius = DEFAULT_RADIUS_MILES) => {
      if (cancelled) return;
      setUserLocation(loc);
      setRadiusMiles(radius);
      setActiveBounds(boundsFromCenter(loc.latitude, loc.longitude, radius));
    };

    const applyFallbackLocation = () => {
      if (!cancelled) {
        const fallback = { latitude: 45.5152, longitude: -122.6784 };
        applyLocation(fallback);
      }
    };

    (async () => {
      try {
        const resolved = await api.location.resolveLocation();
        const vl = resolved?.viewingLocation;
        if (vl?.latitude != null && vl?.longitude != null) {
          applyLocation(
            { latitude: vl.latitude, longitude: vl.longitude },
            vl.radiusMiles || DEFAULT_RADIUS_MILES
          );
          return;
        }
      } catch {
        // Fall back to browser geolocation below.
      }

      if (!navigator.geolocation) {
        applyFallbackLocation();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        applyFallbackLocation,
        { enableHighAccuracy: false, timeout: 10000 }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'grid' || !userLocation || activeTab === 'global') return;
    setActiveBounds(boundsFromCenter(userLocation.latitude, userLocation.longitude, radiusMiles));
  }, [viewMode, userLocation, radiusMiles, activeTab]);

  // ── Auto-open create modal via ?create=true ──────────────────
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true);
      router.replace('/app/marketplace', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Open create modal from AI draft ──────────────────────────
  useEffect(() => {
    const handler = () => setShowCreateModal(true);
    window.addEventListener('ai:open-listing-modal', handler);
    return () => window.removeEventListener('ai:open-listing-modal', handler);
  }, []);

  // ── Debounced search (key-driven refetch via React Query) ───
  // Updating debouncedSearch changes the query key, which triggers
  // a new fetch automatically. In-flight fetches for old keys are
  // discarded by React Query.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // ── Map bounds change → re-fetch browse ──────────────────────
  const handleBoundsChange = useCallback((bounds: Bounds) => {
    setActiveBounds(bounds);
    // Key change triggers browseQuery refetch automatically
  }, []);

  // ── Search submit (from autocomplete selection) ─────────────
  const handleSearchSubmit = useCallback((query: string) => {
    setSearchQuery(query);
    // The debounced search effect will handle the fetch
  }, []);

  // ── Expand bounds 2x (zero-results helper) ─────────────────
  const handleExpandBounds = useCallback(() => {
    if (!activeBounds) return;
    const latMid = (activeBounds.south + activeBounds.north) / 2;
    const lngMid = (activeBounds.west + activeBounds.east) / 2;
    const latSpan = activeBounds.north - activeBounds.south;
    const lngSpan = activeBounds.east - activeBounds.west;
    setActiveBounds({
      south: latMid - latSpan,
      north: latMid + latSpan,
      west: lngMid - lngSpan,
      east: lngMid + lngSpan,
    });
  }, [activeBounds]);

  // ── Infinite scroll (cursor pagination via fetchNextPage) ────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          void browseQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, browseQuery]);

  // ── View mode toggle ────────────────────────────────────────
  const handleViewToggle = useCallback((mode: 'grid' | 'map') => {
    setViewMode(mode);
  }, []);

  // ── Optimistic save toggle ──────────────────────────────────
  const browseKey = queryKeys.marketplace('browse', browseFilters as Record<string, any>);

  // Mutate a single listing in the paginated cache.
  const updateListingInCache = useCallback((listingId: string, patch: (l: Listing) => Listing) => {
    queryClient.setQueryData<InfiniteData<MarketplaceBrowseResponseWithNearest>>(browseKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          listings: (page.listings || []).map((l) => (l.id === listingId ? patch(l) : l)),
        })),
      };
    });
  }, [queryClient, browseKey]);

  // ── Save listing (useMutation with optimistic + rollback) ──
  const saveMutation = useMutation({
    mutationFn: (listingId: string) => api.listings.toggleSave(listingId),
    onMutate: (listingId) => {
      const current = browseListings.find((l) => l.id === listingId);
      const wasSaved = current?.userHasSaved ?? false;
      const savedCount = current?.save_count ?? 0;
      updateListingInCache(listingId, (l) => ({
        ...l,
        userHasSaved: !l.userHasSaved,
        save_count: l.userHasSaved ? Math.max((l.save_count || 1) - 1, 0) : (l.save_count || 0) + 1,
      }));
      return { listingId, wasSaved, savedCount };
    },
    onSuccess: ({ saved, saveCount }, listingId) => {
      updateListingInCache(listingId, (l) => ({
        ...l,
        userHasSaved: saved,
        save_count: saveCount ?? l.save_count,
      }));
    },
    onError: (_err, _listingId, context) => {
      if (!context) return;
      updateListingInCache(context.listingId, (l) => ({
        ...l,
        userHasSaved: context.wasSaved,
        save_count: context.savedCount,
      }));
    },
  });

  const handleSave = (listingId: string) => {
    saveMutation.mutate(listingId);
  };

  // ── Filter pill toggle ──────────────────────────────────────
  const handleFilterToggle = (key: FilterPillKey) => {
    if (key === 'all') {
      setActiveFilters([]);
    } else {
      setActiveFilters(prev => {
        const isActive = prev.includes(key);
        if (isActive) return prev.filter(f => f !== key);
        // Price pills are mutually exclusive with each other and with 'free'
        const isPriceKey = PRICE_PILL_KEYS.includes(key);
        const isFreeKey = key === 'free';
        let base = prev;
        if (isPriceKey) {
          base = base.filter(f => !PRICE_PILL_KEYS.includes(f) && f !== 'free');
        } else if (isFreeKey) {
          base = base.filter(f => !PRICE_PILL_KEYS.includes(f));
        }
        return [...base, key];
      });
    }
  };

  // ── Tab change ──────────────────────────────────────────────
  const handleTabChange = (tab: MarketplaceTab) => {
    setActiveTab(tab);
    setActiveFilters([]);
  };

  const handleSnapSellBootstrapConsumed = useCallback(() => {
    setSnapSellBootstrap(null);
  }, []);

  const handleSnapSellComplete = useCallback((bootstrap: SnapSellListingBootstrap) => {
    setSnapSellBootstrap(bootstrap);
    setShowSnapSellModal(false);
    setShowCreateModal(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('snapSell') !== '1') return;
    setShowSnapSellModal(true);
    router.replace('/app/marketplace', { scroll: false });
  }, [searchParams, router]);

  // ── Handle listing created ──────────────────────────────────
  const handleListingCreated = () => {
    void browseQuery.refetch();
  };

  // ── Listing selection (map pin click → highlight in grid) ────
  const handleListingSelect = useCallback((id: string | null) => {
    setSelectedListingId(id);
  }, []);

  // ── View toggle buttons (shared between map/grid headers) ────
  const ViewToggle = (
    <div role="group" aria-label="View mode" className="flex rounded-lg border border-app-border overflow-hidden">
      <button
        onClick={() => handleViewToggle('grid')}
        aria-pressed={isGridView}
        className={`px-3 py-1.5 text-xs font-semibold transition ${
          isGridView ? 'bg-primary-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
        }`}
      >
        Grid
      </button>
      <button
        onClick={() => handleViewToggle('map')}
        aria-pressed={isMapView}
        className={`px-3 py-1.5 text-xs font-semibold transition ${
          isMapView ? 'bg-primary-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
        }`}
      >
        Map
      </button>
    </div>
  );

  // ── Sort selector ────────────────────────────────────────────
  const activeSortOption = SORT_OPTIONS.find(o => o.key === sort) || SORT_OPTIONS[0];

  const SortSelector = !isDiscovery ? (
    <div className="relative">
      <button
        onClick={() => setShowSortDropdown(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-xs font-medium text-app-text-strong hover:bg-app-hover"
        aria-label="Sort listings"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-app-text-muted" />
        {activeSortOption.label}
      </button>
      {showSortDropdown && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setShowSortDropdown(false)} />
          <div className="absolute right-0 top-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg z-[1000] py-1 min-w-[200px]">
            {SORT_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = sort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setSort(opt.key); setShowSortDropdown(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-app-hover ${isActive ? 'text-primary-600 font-semibold' : 'text-app-text-strong'}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-app-text-muted'}`} />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {isActive && <Check className="w-4 h-4 text-primary-600" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  ) : null;

  // ── Category modal (shared) ──────────────────────────────────
  const CategoryModal = showCategoryModal ? (
    <div className="fixed inset-0 bg-black/30 z-[1000] flex items-end sm:items-center justify-center" onClick={() => setShowCategoryModal(false)} role="dialog" aria-modal="true" aria-label="Select category">
      <div className="bg-app-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-app-text">Category</h3>
          <button onClick={() => setShowCategoryModal(false)} className="text-app-text-muted hover:text-app-text-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {CATEGORIES.map((c) => {
            const isActive = category === c.key;
            return (
              <button key={c.key} onClick={() => { setCategory(c.key); setShowCategoryModal(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isActive ? 'bg-primary-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary'}`}><CategoryIcon name={c.emoji} className="w-5 h-5" /></div>
                <span className={`text-xs font-medium ${isActive ? 'text-primary-600' : 'text-app-text-secondary'}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  // ── MAP VIEW ────────────────────────────────────────────────
  if (isMapView) {
    return (
      <div className="min-h-screen bg-app">
        <div>
          {/* Header */}
          <div className="bg-app-surface border-b border-app-border-subtle">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-app-text">Marketplace</h1>
                {ViewToggle}
              </div>
              <div className="flex items-center gap-2">
                {SortSelector}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
                >
                  + Post
                </button>
              </div>
            </div>
            <div className="px-4 pb-2">
              <MarketplaceTabs activeTab={activeTab} onTabChange={handleTabChange} />
            </div>
            <div className="px-4 pb-2">
              <FilterPillBar activeFilters={activeFilters} onToggle={handleFilterToggle} />
            </div>
            <div className="px-4 pb-2">
              <MarketplaceSearch
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearchSubmit}
                onExpandBounds={handleExpandBounds}
                onCreateListing={() => setShowCreateModal(true)}
                resultCount={browseListings.length}
                userLocation={userLocation}
              />
            </div>
          </div>

          {/* New listings banner */}
          {newListingCount > 0 && (
            <div className="px-4 py-1">
              <NewListingsBanner count={newListingCount} onTap={handleNewListingsTap} onDismiss={handleNewListingsDismiss} />
            </div>
          )}

          {/* Map — prop-driven, receives shared listings */}
          <div className="relative h-[calc(100vh-160px)] w-full">
            <MarketplaceMap
              listings={browseListings}
              selectedId={selectedListingId}
              onBoundsChange={handleBoundsChange}
              onListingSelect={handleListingSelect}
              loading={loading}
              userLocation={userLocation}
              onOpenCategoryModal={() => setShowCategoryModal(true)}
              onOpenCreateModal={() => setShowCreateModal(false)}
              totalCount={totalInBounds}
              onSave={handleSave}
              nearestActivityCenter={nearestActivityCenter}
            />
          </div>
        </div>

        {CategoryModal}

        {showSnapSellModal && (
          <SnapSellListingModal
            userLocation={userLocation}
            onClose={() => setShowSnapSellModal(false)}
            onComplete={handleSnapSellComplete}
          />
        )}
        {showCreateModal && (
          <CreateListingModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handleListingCreated}
            userLocation={userLocation}
            snapSellBootstrap={snapSellBootstrap}
            onSnapSellBootstrapConsumed={handleSnapSellBootstrapConsumed}
          />
        )}
      </div>
    );
  }

  // ── GRID VIEW ───────────────────────────────────────────────
  // In Discovery mode: show curated sections from /discover
  // In Browse mode: show flat browseListings grid

  const gridListings = isDiscovery ? [] : browseListings;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Marketplace</h1>
            <p className="text-sm text-app-text-secondary mt-0.5">Buy, sell, give, hire, deliver</p>
          </div>
          <div className="flex items-center gap-3">
            {SortSelector}
            {ViewToggle}
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm">+ Post</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <MarketplaceTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Search + Category */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <MarketplaceSearch
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearchSubmit}
              onExpandBounds={handleExpandBounds}
              onCreateListing={() => { setShowCreateModal(true); }}
              resultCount={!isDiscovery ? browseListings.length : undefined}
              userLocation={userLocation}
            />
          </div>
          <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-app-border bg-app-surface text-sm font-medium text-app-text-strong hover:bg-app-hover whitespace-nowrap self-start">
            <CategoryIcon name={activeCategory.emoji} className="w-4 h-4" />
            <span>{activeCategory.label}</span>
            <svg className="w-4 h-4 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* Filter pills */}
        <div className="mb-4">
          <FilterPillBar activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>

        {/* New listings banner */}
        {newListingCount > 0 && (
          <div className="mb-4">
            <NewListingsBanner count={newListingCount} onTap={handleNewListingsTap} onDismiss={handleNewListingsDismiss} />
          </div>
        )}

        {radiusSuggestionEnabled && radiusSuggestion.suggestion && (
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
              className="shrink-0 rounded-md p-1 text-sky-700 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-sky-200 dark:hover:bg-sky-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Discovery Mode: curated sections ──────────────── */}
        {isDiscovery && (
          <MarketplaceDiscoveryFeed
            data={discoverData}
            loading={loading}
            onSave={handleSave}
            onCategoryClick={(cat) => setCategory(cat)}
            onCreateListing={() => setShowCreateModal(true)}
            onSeeAllClick={() => handleViewToggle('map')}
          />
        )}

        {/* ── Browse Mode: flat grid (same data as map) ─────── */}
        {!isDiscovery && (
          <>
            {/* Snapshot card */}
            <div className="mb-6">
              <MarketplaceSnapshotCard inView={marketplaceSnapshot.inView} newToday={marketplaceSnapshot.newToday} urgentDeadlines={marketplaceSnapshot.urgentDeadlines} myPendingOffers={marketplaceSnapshot.myPendingOffers} />
            </div>

            {loading && gridListings.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <LoadingSkeleton variant="listing-card" count={8} />
              </div>
            ) : gridListings.length === 0 ? (
              <EmptyState
                icon={Store}
                title="No listings found"
                description={searchQuery ? 'Try a different search term or category' : 'Be the first to list something in your area!'}
                actionLabel="+ Create Listing"
                onAction={() => setShowCreateModal(true)}
              />
            ) : (
              <div role="feed" aria-label="Marketplace listings" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {gridListings.map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    onSave={() => handleSave(item.id)}
                    onClick={() => router.push(`/app/marketplace/${item.id}`)}
                  />
                ))}
              </div>
            )}

            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="text-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
            )}

            {!loading && !hasMore && gridListings.length > 0 && (
              <p className="text-center text-sm text-app-text-muted py-4">
                Showing {gridListings.length} of {totalInBounds} listings
              </p>
            )}
          </>
        )}
      </main>

      {CategoryModal}

      {showSnapSellModal && (
        <SnapSellListingModal
          userLocation={userLocation}
          onClose={() => setShowSnapSellModal(false)}
          onComplete={handleSnapSellComplete}
        />
      )}
      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleListingCreated}
          userLocation={userLocation}
          snapSellBootstrap={snapSellBootstrap}
          onSnapSellBootstrapConsumed={handleSnapSellBootstrapConsumed}
        />
      )}
    </div>
  );
}

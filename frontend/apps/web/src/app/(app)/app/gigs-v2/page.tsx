// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { GIG_BROWSE_CATEGORIES } from '@pantopus/ui-utils';
import type { PriceFilterKey, SortKey } from '@pantopus/ui-utils';
import { Search } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { toast } from '@/components/ui/toast-store';
import type { GigListItem } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import GigCardV2 from './GigCardV2';

// ─── Constants ─────────────────────────────────────────────
const CATEGORY_FILTERS = ['All', ...GIG_BROWSE_CATEGORIES];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'price_high', label: 'Price: High→Low' },
  { key: 'price_low', label: 'Price: Low→High' },
] as const;
const PRICE_OPTIONS = [
  { key: 'all', label: 'Any Price' },
  { key: 'under_50', label: 'Under $50' },
  { key: '50_to_150', label: '$50–$150' },
  { key: 'over_150', label: '$150+' },
] as const;

const ENGAGEMENT_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'instant_accept', label: '⚡ Instant' },
  { key: 'curated_offers', label: '📋 Offers' },
  { key: 'quotes', label: '💼 Quotes' },
] as const;

const SCHEDULE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'asap', label: 'ASAP' },
  { key: 'today', label: 'Today' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'flexible', label: 'Flexible' },
] as const;

const PAY_TYPE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'fixed', label: 'Fixed' },
  { key: 'hourly', label: 'Hourly' },
  { key: 'offers', label: 'Open to Offers' },
] as const;

type SortOption = SortKey;
type PriceOption = PriceFilterKey;
const PAGE_SIZE = 15;

function dedupeGigsById(items: GigListItem[]): GigListItem[] {
  const byId = new Map<string, GigListItem>();
  for (const item of items) {
    const id = String(item?.id ?? '');
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, item);
  }
  return Array.from(byId.values());
}

// ─── Filter reducer ────────────────────────────────────────
type FiltersState = {
  searchQuery: string;
  debouncedSearch: string;
  selectedCategory: string;
  priceFilter: PriceOption;
  sortOption: SortOption;
  engagementFilter: string;
  scheduleFilter: string;
  payTypeFilter: string;
};

type FiltersAction =
  | { type: 'SET_SEARCH'; value: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; value: string }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_PRICE'; value: PriceOption }
  | { type: 'SET_SORT'; value: SortOption }
  | { type: 'SET_ENGAGEMENT'; value: string }
  | { type: 'SET_SCHEDULE'; value: string }
  | { type: 'SET_PAY_TYPE'; value: string };

const INITIAL_FILTERS: FiltersState = {
  searchQuery: '',
  debouncedSearch: '',
  selectedCategory: 'All',
  priceFilter: 'all',
  sortOption: 'newest',
  engagementFilter: 'all',
  scheduleFilter: 'all',
  payTypeFilter: 'all',
};

function filtersReducer(state: FiltersState, action: FiltersAction): FiltersState {
  switch (action.type) {
    case 'SET_SEARCH':           return { ...state, searchQuery: action.value };
    case 'SET_DEBOUNCED_SEARCH': return { ...state, debouncedSearch: action.value };
    case 'SET_CATEGORY':         return { ...state, selectedCategory: action.value };
    case 'SET_PRICE':            return { ...state, priceFilter: action.value };
    case 'SET_SORT':             return { ...state, sortOption: action.value };
    case 'SET_ENGAGEMENT':       return { ...state, engagementFilter: action.value };
    case 'SET_SCHEDULE':         return { ...state, scheduleFilter: action.value };
    case 'SET_PAY_TYPE':         return { ...state, payTypeFilter: action.value };
    default: return state;
  }
}

// Build the API filter payload from the reducer state + pagination cursor.
function buildApiFilters(f: FiltersState, pageNum: number) {
  const filters: Record<string, any> = {
    page: pageNum,
    limit: PAGE_SIZE,
    status: ['open'],
    sort: f.sortOption,
  };
  if (f.selectedCategory !== 'All') filters.category = f.selectedCategory;
  if (f.debouncedSearch.trim()) filters.search = f.debouncedSearch.trim();
  if (f.engagementFilter !== 'all') filters.engagement_mode = f.engagementFilter;
  if (f.scheduleFilter !== 'all') filters.schedule_type = f.scheduleFilter;
  if (f.payTypeFilter !== 'all') filters.pay_type = f.payTypeFilter;
  if (f.priceFilter === 'under_50') {
    filters.maxPrice = 50;
  } else if (f.priceFilter === '50_to_150') {
    filters.minPrice = 50;
    filters.maxPrice = 150;
  } else if (f.priceFilter === 'over_150') {
    filters.minPrice = 150;
  }
  return filters;
}

// ─── Main Component ────────────────────────────────────────
export default function GigsBrowseV2Page() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (!token) router.push('/login');
  }, [router]);

  // ── Filter state (consolidated via useReducer) ──
  const [filters, dispatch] = useReducer(filtersReducer, INITIAL_FILTERS);
  const {
    searchQuery, debouncedSearch, selectedCategory,
    priceFilter, sortOption, engagementFilter,
    scheduleFilter, payTypeFilter,
  } = filters;

  // Non-filter local state
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [acceptingGigId, setAcceptingGigId] = useState<string | null>(null);

  useEffect(() => {
    const loadViewer = async () => {
      try {
        const me = await api.users.getMyProfile();
        setViewerUserId(me?.id ? String(me.id) : null);
      } catch {
        setViewerUserId(null);
      }
    };
    void loadViewer();
  }, []);

  // Debounce search (400ms)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', value: searchQuery });
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // ── Data: useInfiniteQuery keyed on filter combo ──
  // Build a stable query key from all filter dimensions that affect the server response
  const queryFilters = useMemo(() => ({
    category: selectedCategory,
    search: debouncedSearch.trim(),
    price: priceFilter,
    sort: sortOption,
    engagement: engagementFilter,
    schedule: scheduleFilter,
    payType: payTypeFilter,
  }), [selectedCategory, debouncedSearch, priceFilter, sortOption, engagementFilter, scheduleFilter, payTypeFilter]);

  const gigsQuery = useInfiniteQuery({
    queryKey: queryKeys.gigs(queryFilters),
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const apiFilters = buildApiFilters(filters, pageParam as number);
      const result = await api.gigs.getGigs(apiFilters);
      const resultData = result as Record<string, any>;
      const raw = (resultData?.gigs ?? resultData?.data ?? []) as GigListItem[];
      const items = Array.isArray(raw) ? raw : [];
      return { items, page: pageParam as number };
    },
    getNextPageParam: (lastPage) =>
      lastPage.items.length >= PAGE_SIZE ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });

  const gigs = useMemo(
    () => dedupeGigsById((gigsQuery.data?.pages ?? []).flatMap((p) => p.items)),
    [gigsQuery.data],
  );
  const loading = gigsQuery.isPending;
  const loadingMore = gigsQuery.isFetchingNextPage;
  const hasMore = gigsQuery.hasNextPage ?? false;
  const fetchError = gigsQuery.error ? 'Failed to load tasks. Please try again.' : null;

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await gigsQuery.fetchNextPage();
  }, [loadingMore, hasMore, gigsQuery]);

  const onRefresh = useCallback(async () => {
    await gigsQuery.refetch();
  }, [gigsQuery]);

  // Filter setter shims (preserve the same call sites in JSX below)
  const setSearchQuery = useCallback((v: string) => dispatch({ type: 'SET_SEARCH', value: v }), []);
  const setSelectedCategory = useCallback((v: string) => dispatch({ type: 'SET_CATEGORY', value: v }), []);
  const setPriceFilter = useCallback((v: PriceOption) => dispatch({ type: 'SET_PRICE', value: v }), []);
  const setSortOption = useCallback((v: SortOption) => dispatch({ type: 'SET_SORT', value: v }), []);
  const setEngagementFilter = useCallback((v: string) => dispatch({ type: 'SET_ENGAGEMENT', value: v }), []);
  const setScheduleFilter = useCallback((v: string) => dispatch({ type: 'SET_SCHEDULE', value: v }), []);
  const setPayTypeFilter = useCallback((v: string) => dispatch({ type: 'SET_PAY_TYPE', value: v }), []);

  const handleInstantAccept = async (gigId: string) => {
    setAcceptingGigId(gigId);
    try {
      const resp = await api.gigs.instantAccept(gigId);
      if (resp?.requiresPaymentSetup) {
        toast.success("You're assigned! Waiting for the task owner to finish payment authorization.");
      } else {
        toast.success("You're assigned! Check the gig for details.");
      }
      router.push(`/app/gigs-v2/${gigId}`);
    } catch (err: any) {
      const msg = err?.message || 'Could not accept this gig.';
      if (msg.includes('already') || err?.status === 409) {
        toast.error('This gig has already been taken.');
      } else {
        toast.error(msg);
      }
    } finally {
      setAcceptingGigId(null);
    }
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-app-surface-raised">
      {/* Header */}
      <div className="bg-app-surface border-b border-app-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-app-text flex items-center gap-2">
            <span>💼</span> Tasks v2
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/app/gigs-v2/new')}
              className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Quick Post
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-10 py-2.5 border border-app-border rounded-xl bg-app-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-secondary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedCategory(filter)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition ${
                  selectedCategory === filter
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* V2 filter rows: Engagement Mode | Schedule | Pay Type */}
        <div className="mb-3 space-y-2">
          {/* Engagement Mode */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary w-20 shrink-0">Mode</span>
            {ENGAGEMENT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setEngagementFilter(opt.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  engagementFilter === opt.key
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary w-20 shrink-0">Schedule</span>
            {SCHEDULE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setScheduleFilter(opt.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  scheduleFilter === opt.key
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Pay Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary w-20 shrink-0">Pay</span>
            {PAY_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPayTypeFilter(opt.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  payTypeFilter === opt.key
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price + Sort chips */}
        <div className="mb-3 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {PRICE_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setPriceFilter(option.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  priceFilter === option.key
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                }`}
              >
                {option.label}
              </button>
            ))}
            <span className="mx-1 border-l border-app-border" />
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setSortOption(option.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  sortOption === option.key
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border bg-app-surface text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {/* Error */}
        {fetchError && !loading && gigs.length === 0 && (
          <ErrorState message={fetchError} onRetry={onRefresh} />
        )}

        {/* Content */}
        {loading && gigs.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <LoadingSkeleton variant="gig-card" count={6} />
          </div>
        ) : gigs.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No tasks match your filters"
            description={searchQuery ? 'Try adjusting your search or changing filters' : 'Try expanding your search or check back later.'}
            actionLabel="Quick Post"
            onAction={() => router.push('/app/gigs-v2/new')}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {gigs.map((gig) => (
                <GigCardV2
                  key={gig.id}
                  gig={gig}
                  viewerUserId={viewerUserId}
                  acceptingGigId={acceptingGigId}
                  onInstantAccept={handleInstantAccept}
                  onClick={() => router.push(`/app/gigs-v2/${gig.id}`)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-app-surface border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover disabled:opacity-50 transition"
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
    </div>
  );
}


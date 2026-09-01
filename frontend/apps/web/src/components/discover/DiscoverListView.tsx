'use client';

import { RefObject } from 'react';
import { Search, Map, List, AlertTriangle } from 'lucide-react';
import type { DiscoverySearchResult } from '@pantopus/api';
import SearchInput from '@/components/SearchInput';
import PageHeader from '@/components/PageHeader';
import TrustLensChips from './TrustLensChips';
import DiscoveryFilterPanel from './DiscoveryFilterPanel';
import type { DiscoveryFilters } from './DiscoveryFilterPanel';
import BusinessResultCard, { BusinessResultCardSkeleton } from './BusinessResultCard';
import InquiryChatDrawer from './InquiryChatDrawer';
import DiscoveryErrorBoundary from './DiscoveryErrorBoundary';
import type { DiscoverySort } from './constants';
import { ScopePills } from './ScopePills';
import { EmptyState, NoHomeBanner, WorkedNearbyBanner, NoLocationBanner } from './DiscoverBanners';
import { UnifiedResultCard, UnifiedResultSkeleton } from './UnifiedResultCard';
import type { SearchScope, UnifiedResult } from './discoverTypes';

interface DiscoverListViewProps {
  // Search
  query: string;
  setQuery: (q: string) => void;
  scope: SearchScope;
  setScope: (s: SearchScope) => void;

  // View mode
  isListView: boolean;
  isMapView: boolean;
  setViewMode: (v: 'list' | 'map') => void;

  // Trust Lens
  sort: DiscoverySort;
  setSort: (s: DiscoverySort) => void;

  // Filters
  filters: DiscoveryFilters;
  setFilters: (f: DiscoveryFilters) => void;
  filtersCollapsed: boolean;
  setFiltersCollapsed: (fn: (prev: boolean) => boolean) => void;

  // Business results
  results: DiscoverySearchResult[];
  showLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  banner: string | null;
  error: string | null;
  fetchBusinesses: (page: number, reset: boolean) => void;
  handleContact: (businessUserId: string) => void;

  // Universal results
  uniResults: UnifiedResult[];
  uniLoading: boolean;
  showUniResults: boolean;
  groupedUniResults: { type: UnifiedResult['type']; label: string; items: UnifiedResult[] }[] | null;

  // Chat
  chatTarget: { id: string; name: string } | null;
  setChatTarget: (target: { id: string; name: string } | null) => void;

  // Derived
  showBusinessUI: boolean;
  showUniversalUI: boolean;
  noLocation: boolean;
  homeLoading: boolean;
  hasHome: boolean;

  // Refs
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export default function DiscoverListView({
  query,
  setQuery,
  scope,
  setScope,
  isListView,
  isMapView,
  setViewMode,
  sort,
  setSort,
  filters,
  setFilters,
  filtersCollapsed,
  setFiltersCollapsed,
  results,
  showLoading,
  loadingMore,
  hasMore,
  totalCount,
  banner,
  error,
  fetchBusinesses,
  handleContact,
  uniResults,
  uniLoading,
  showUniResults,
  groupedUniResults,
  chatTarget,
  setChatTarget,
  showBusinessUI,
  showUniversalUI,
  noLocation,
  homeLoading,
  hasHome,
  sentinelRef,
}: DiscoverListViewProps) {
  const universalPlaceholder =
    scope === 'local_profiles'
      ? 'Search Profiles...'
      : scope === 'public_profiles'
        ? 'Search Beacons...'
        : 'Search profiles, tasks, listings...';
  const scopeForGroup = (type: UnifiedResult['type']): SearchScope => {
    if (type === 'local_profile') return 'local_profiles';
    if (type === 'public_profile') return 'public_profiles';
    if (type === 'task') return 'tasks';
    if (type === 'listing') return 'listings';
    return 'businesses';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title={showBusinessUI ? 'Discover Businesses' : 'Discover'}
        subtitle={showBusinessUI ? 'Find trusted local providers near you' : 'Search across profiles, businesses, tasks, and listings'}
      >
        {/* Search bar + View toggle row */}
        <div className="flex items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={showBusinessUI ? 'Search businesses near you...' : universalPlaceholder}
            className="max-w-lg flex-1"
          />

          {/* Map / List toggle (businesses only) */}
          {showBusinessUI && (
            <div className="flex bg-surface-muted rounded-lg p-0.5 flex-shrink-0" role="tablist" aria-label="View mode">
              <button
                role="tab"
                aria-selected={isListView}
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition bg-surface text-app shadow-sm"
              >
                <List className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> List
              </button>
              <button
                role="tab"
                aria-selected={isMapView}
                onClick={() => setViewMode('map')}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition text-app-secondary hover:text-app-strong"
              >
                <Map className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> Map
              </button>
            </div>
          )}
        </div>

        {/* Scope pills */}
        <div className="mt-3">
          <ScopePills value={scope} onChange={setScope} />
        </div>

        {/* Trust Lens row (businesses only) */}
        {showBusinessUI && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <TrustLensChips value={sort} onChange={setSort} />
          </div>
        )}
      </PageHeader>

      {/* ── Business scope results ─────────────────────── */}
      {showBusinessUI && (
        <>
          {/* No Location Banner */}
          {noLocation && <NoLocationBanner />}

          {/* No Home Banner */}
          {!homeLoading && !hasHome && !noLocation && <NoHomeBanner />}

          {/* Worked Nearby Banner */}
          {banner && <WorkedNearbyBanner />}

          <DiscoveryErrorBoundary section="Search Results">
            <div className="flex gap-6">
              {/* Filter panel (sidebar on desktop, collapsible on mobile) */}
              <div className="w-full md:w-64 md:flex-shrink-0">
                <DiscoveryFilterPanel
                  filters={filters}
                  onChange={setFilters}
                  collapsed={filtersCollapsed}
                  onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
                />
              </div>

              {/* Results column */}
              <div className="flex-1 min-w-0">
                {/* Result count */}
                {!showLoading && !error && results.length > 0 && (
                  <p className="text-xs text-app-muted mb-3">
                    {totalCount} business{totalCount !== 1 ? 'es' : ''} found
                  </p>
                )}

                {/* Error state */}
                {error && !showLoading && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-sm text-amber-800 font-medium">{error}</p>
                        <button
                          onClick={() => fetchBusinesses(1, true)}
                          className="mt-2 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                        >
                          Retry Search
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading skeletons */}
                {showLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <BusinessResultCardSkeleton key={i} />
                    ))}
                  </div>
                )}

                {/* Results */}
                {!showLoading && !error && results.length > 0 && (
                  <div className="space-y-3">
                    {results.map((result) => (
                      <BusinessResultCard
                        key={result.business_user_id}
                        result={result}
                        onContact={handleContact}
                      />
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!showLoading && !error && results.length === 0 && (
                  <EmptyState
                    category={filters.categories.length === 1 ? filters.categories[0] : undefined}
                    scope={scope}
                  />
                )}

                {/* Loading more */}
                {loadingMore && (
                  <div className="space-y-3 mt-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <BusinessResultCardSkeleton key={`more-${i}`} />
                    ))}
                  </div>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-px" />

                {/* End of results */}
                {!hasMore && !showLoading && results.length > 0 && (
                  <p className="text-center text-xs text-app-muted py-6">
                    You&apos;ve seen all {totalCount} results
                  </p>
                )}
              </div>
            </div>
          </DiscoveryErrorBoundary>
        </>
      )}

      {/* ── Universal search results ──────────────────── */}
      {showUniversalUI && (
        <div className="mt-4">
          {/* Loading */}
          {uniLoading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <UnifiedResultSkeleton key={i} />
              ))}
            </div>
          )}

          {/* No query prompt */}
          {!uniLoading && !showUniResults && (
            <div className="text-center py-16 px-6">
              <div className="mb-4 flex justify-center"><Search className="w-10 h-10 text-app-muted" /></div>
              <h3 className="text-lg font-semibold text-app-strong mb-1">Search Pantopus</h3>
              <p className="text-sm text-app-muted max-w-sm mx-auto">
                Type at least 2 characters to search across {scope === 'all' ? 'profiles, businesses, tasks, and listings' : scope.replace('_', ' ')}
              </p>
            </div>
          )}

          {/* No results */}
          {!uniLoading && showUniResults && uniResults.length === 0 && (
            <EmptyState scope={scope} />
          )}

          {/* "All" scope: grouped sections */}
          {!uniLoading && scope === 'all' && groupedUniResults && groupedUniResults.length > 0 && (
            <div className="space-y-6">
              {groupedUniResults.map((group) => (
                <div key={group.type}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-app-strong">{group.label}</h3>
                    <button
                      onClick={() => setScope(scopeForGroup(group.type))}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      See all →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <UnifiedResultCard key={`${item.type}-${item.id}`} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filtered scope: flat list */}
          {!uniLoading && scope !== 'all' && uniResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-app-muted mb-3">
                {uniResults.length} result{uniResults.length !== 1 ? 's' : ''} found
              </p>
              {uniResults.map((item) => (
                <UnifiedResultCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline chat drawer */}
      {chatTarget && (
        <InquiryChatDrawer
          businessUserId={chatTarget.id}
          businessName={chatTarget.name}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
}

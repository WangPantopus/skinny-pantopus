'use client';

import dynamic from 'next/dynamic';
import type { MapBusinessMarker } from '@pantopus/api';
import { Map, List } from 'lucide-react';
import SearchInput from '@/components/SearchInput';
import TrustLensChips from './TrustLensChips';
import DiscoveryFilterPanel from './DiscoveryFilterPanel';
import type { DiscoveryFilters } from './DiscoveryFilterPanel';
import MapLayerToggle from './MapLayerToggle';
import MeasureFromChip from './MeasureFromChip';
import DiscoveryErrorBoundary from './DiscoveryErrorBoundary';
import type { DiscoverySort } from './constants';
import type { MapLayerKey, MeasureFrom } from './DiscoverMap';
import { ScopePills } from './ScopePills';
import { NoHomeBanner, NoLocationBanner } from './DiscoverBanners';
import type { ViewMode, SearchScope } from './discoverTypes';
import { MapSkeleton } from '@/components/map/MapSkeleton';

// Lazy-load map to avoid SSR issues with Leaflet
const DiscoverMap = dynamic(() => import('@/components/discover/DiscoverMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface DiscoverMapViewProps {
  query: string;
  setQuery: (q: string) => void;
  scope: SearchScope;
  setScope: (s: SearchScope) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  isMapView: boolean;
  isListView: boolean;
  sort: DiscoverySort;
  setSort: (s: DiscoverySort) => void;
  filters: DiscoveryFilters;
  setFilters: (f: DiscoveryFilters) => void;
  filtersCollapsed: boolean;
  setFiltersCollapsed: (fn: (prev: boolean) => boolean) => void;
  measureFrom: MeasureFrom;
  setMeasureFrom: (m: MeasureFrom) => void;
  mapLayers: Set<MapLayerKey>;
  setMapLayers: (s: Set<MapLayerKey>) => void;
  hasHome: boolean;
  homeLoading: boolean;
  noLocation: boolean;
  homeCenter: [number, number] | null;
  gpsCenter: [number, number] | null;
  viewerHome: { city?: string } | null;
  onSelectBusiness: (marker: MapBusinessMarker) => void;
  onSelectGig: (gig: { id: string }) => void;
}

export default function DiscoverMapView({
  query,
  setQuery,
  scope,
  setScope,
  viewMode: _viewMode,
  setViewMode,
  isMapView,
  isListView,
  sort,
  setSort,
  filters,
  setFilters,
  filtersCollapsed,
  setFiltersCollapsed,
  measureFrom,
  setMeasureFrom,
  mapLayers,
  setMapLayers,
  hasHome,
  homeLoading,
  noLocation,
  homeCenter,
  gpsCenter,
  viewerHome,
  onSelectBusiness,
  onSelectGig,
}: DiscoverMapViewProps) {
  return (
    <DiscoveryErrorBoundary section="Map">
      <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* ── Desktop filter sidebar ── */}
        <div className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-app bg-surface overflow-y-auto">
          {/* Search + view toggle */}
          <div className="px-3 pt-3 pb-2 border-b border-app space-y-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search businesses..."
              className="w-full"
            />
            <ScopePills value={scope} onChange={setScope} />
            <div className="flex items-center gap-2">
              <div className="flex bg-surface-muted rounded-lg p-0.5 flex-shrink-0" role="tablist" aria-label="View mode">
                <button
                  role="tab"
                  aria-selected={isListView}
                  onClick={() => setViewMode('list')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition text-app-secondary hover:text-app-strong"
                >
                  <List className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> List
                </button>
                <button
                  role="tab"
                  aria-selected={isMapView}
                  onClick={() => setViewMode('map')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition bg-surface text-app shadow-sm"
                >
                  <Map className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> Map
                </button>
              </div>
            </div>
          </div>

          {/* Trust lens + Measure from */}
          <div className="px-3 py-2 border-b border-app flex flex-wrap items-center gap-1.5">
            <TrustLensChips value={sort} onChange={setSort} />
            <MeasureFromChip
              value={measureFrom}
              onChange={setMeasureFrom}
              hasHome={hasHome}
              hasGps={gpsCenter != null}
              homeCity={viewerHome?.city}
            />
          </div>

          {/* No Home Banner */}
          {!homeLoading && !hasHome && !noLocation && (
            <div className="px-3 pt-2">
              <NoHomeBanner />
            </div>
          )}

          {/* No Location Banner */}
          {noLocation && (
            <div className="px-3 pt-2">
              <NoLocationBanner />
            </div>
          )}

          {/* Filters */}
          <div className="px-3 py-2 flex-1 overflow-y-auto">
            <DiscoveryFilterPanel
              filters={filters}
              onChange={setFilters}
              collapsed={false}
              onToggleCollapse={() => {}}
            />
          </div>
        </div>

        {/* ── Map container ── */}
        <div className="flex-1 relative">
          {/* Mobile floating toolbar */}
          <div className="md:hidden absolute top-0 left-0 right-0 z-10 pointer-events-none">
            <div className="px-3 pt-3">
              <div className="pointer-events-auto inline-flex flex-col gap-2 bg-surface/90 backdrop-blur-sm rounded-xl shadow-lg border border-app p-3 max-w-[calc(100%-3rem)]">
                <div className="flex items-center gap-2">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search businesses..."
                    className="flex-1 min-w-[140px]"
                  />
                  <div className="flex bg-surface-muted rounded-lg p-0.5 flex-shrink-0" role="tablist" aria-label="View mode">
                    <button
                      role="tab"
                      aria-selected={isListView}
                      onClick={() => setViewMode('list')}
                      className="px-2 py-1 text-xs font-semibold rounded-md transition text-app-secondary hover:text-app-strong"
                    >
                      <List className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> List
                    </button>
                    <button
                      role="tab"
                      aria-selected={isMapView}
                      onClick={() => setViewMode('map')}
                      className="px-2 py-1 text-xs font-semibold rounded-md transition bg-surface text-app shadow-sm"
                    >
                      <Map className="w-3.5 h-3.5 inline-block" aria-hidden="true" /> Map
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <TrustLensChips value={sort} onChange={setSort} />
                  <MeasureFromChip
                    value={measureFrom}
                    onChange={setMeasureFrom}
                    hasHome={hasHome}
                    hasGps={gpsCenter != null}
                    homeCity={viewerHome?.city}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Layer toggle — top right */}
          <div className="absolute top-3 right-3 z-10">
            <MapLayerToggle activeLayers={mapLayers} onChange={setMapLayers} />
          </div>

          {/* Mobile filter toggle — bottom left */}
          <div className="absolute bottom-4 left-4 z-10 md:hidden">
            <button
              onClick={() => setFiltersCollapsed((c) => !c)}
              className="bg-surface/95 backdrop-blur-sm shadow-lg rounded-xl px-4 py-2.5 text-xs font-semibold text-app-strong border border-app hover:bg-surface transition flex items-center gap-1.5"
              aria-label="Toggle filters"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {(filters.categories.length > 0 || filters.openNow || filters.workedNearby || filters.acceptsGigs || filters.newOnPantopus || filters.ratingMin != null) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
              )}
            </button>
          </div>

          {/* No Location Banner — mobile only */}
          {noLocation && (
            <div className="md:hidden absolute top-[5.5rem] left-4 right-4 z-10">
              <NoLocationBanner />
            </div>
          )}

          {/* No Home Banner — mobile only */}
          {!homeLoading && !hasHome && !noLocation && (
            <div className="md:hidden absolute top-[5.5rem] left-4 z-10 max-w-sm">
              <NoHomeBanner />
            </div>
          )}

          {/* The map itself */}
          <DiscoverMap
            homeCenter={homeCenter}
            gpsCenter={gpsCenter}
            layers={mapLayers}
            measureFrom={measureFrom}
            categories={filters.categories.length > 0 ? filters.categories : undefined}
            openNow={filters.openNow || undefined}
            onSelectBusiness={onSelectBusiness}
            onSelectGig={onSelectGig}
          />

          {/* Mobile filter drawer overlay */}
          {!filtersCollapsed && (
            <div className="md:hidden">
              <div
                className="absolute inset-0 z-20 bg-black/20"
                onClick={() => setFiltersCollapsed(() => true)}
                aria-hidden="true"
              />
              <div className="absolute bottom-0 left-0 z-30 w-full max-w-sm bg-surface rounded-t-2xl shadow-2xl border-t border-app p-4 max-h-[70vh] overflow-y-auto animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-app">Filters</h3>
                  <button
                    onClick={() => setFiltersCollapsed(() => true)}
                    className="p-1.5 text-app-muted hover:text-app-secondary hover:bg-surface-muted rounded-lg transition"
                    aria-label="Close filters"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <DiscoveryFilterPanel
                  filters={filters}
                  onChange={(f) => {
                    setFilters(f);
                    setFiltersCollapsed(() => true);
                  }}
                  collapsed={false}
                  onToggleCollapse={() => setFiltersCollapsed(() => true)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DiscoveryErrorBoundary>
  );
}

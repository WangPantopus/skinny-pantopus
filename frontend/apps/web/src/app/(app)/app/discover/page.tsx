'use client';

import {
  InquiryChatDrawer,
  DiscoverMapView,
  DiscoverListView,
  useDiscoverData,
} from '@/components/discover';

// ═══════════════════════════════════════════════════════════════
// MAIN DISCOVER PAGE
// ═══════════════════════════════════════════════════════════════
export default function DiscoverBusinessesPage() {
  const data = useDiscoverData();

  const {
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
    showLoading,
    loadingMore,
    hasMore,
    totalCount,
    banner,
    error,
    fetchBusinesses,
    handleContact,

    // Universal results
    uniResults,
    uniLoading,
    showUniResults,
    groupedUniResults,

    // Chat
    chatTarget,
    setChatTarget,

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
    showBusinessUI,
    showUniversalUI,

    // Refs
    sentinelRef,
  } = data;

  return (
    <>
      {/* ── MAP VIEW (full-page, business scope only) ─────────── */}
      {isMapView && showBusinessUI && (
        <DiscoverMapView
          query={query}
          setQuery={setQuery}
          scope={scope}
          setScope={setScope}
          viewMode={viewMode}
          setViewMode={setViewMode}
          isMapView={isMapView}
          isListView={isListView}
          sort={sort}
          setSort={setSort}
          filters={filters}
          setFilters={setFilters}
          filtersCollapsed={filtersCollapsed}
          setFiltersCollapsed={setFiltersCollapsed}
          measureFrom={measureFrom}
          setMeasureFrom={setMeasureFrom}
          mapLayers={mapLayers}
          setMapLayers={setMapLayers}
          hasHome={hasHome}
          homeLoading={homeLoading}
          noLocation={noLocation}
          homeCenter={homeCenter}
          gpsCenter={gpsCenter}
          viewerHome={viewerHome}
          onSelectBusiness={handleMapBusinessSelect}
          onSelectGig={handleMapGigSelect}
        />
      )}

      {/* ── LIST VIEW (standard layout) ──────────────────────── */}
      {isListView && (
        <DiscoverListView
          query={query}
          setQuery={setQuery}
          scope={scope}
          setScope={setScope}
          isListView={isListView}
          isMapView={isMapView}
          setViewMode={setViewMode}
          sort={sort}
          setSort={setSort}
          filters={filters}
          setFilters={setFilters}
          filtersCollapsed={filtersCollapsed}
          setFiltersCollapsed={setFiltersCollapsed}
          results={results}
          showLoading={showLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          totalCount={totalCount}
          banner={banner}
          error={error}
          fetchBusinesses={fetchBusinesses}
          handleContact={handleContact}
          uniResults={uniResults}
          uniLoading={uniLoading}
          showUniResults={showUniResults}
          groupedUniResults={groupedUniResults}
          chatTarget={chatTarget}
          setChatTarget={setChatTarget}
          showBusinessUI={showBusinessUI}
          showUniversalUI={showUniversalUI}
          noLocation={noLocation}
          homeLoading={homeLoading}
          hasHome={hasHome}
          sentinelRef={sentinelRef}
        />
      )}

      {/* Inline chat drawer (map mode) */}
      {viewMode === 'map' && chatTarget && (
        <InquiryChatDrawer
          businessUserId={chatTarget.id}
          businessName={chatTarget.name}
          onClose={() => setChatTarget(null)}
        />
      )}
    </>
  );
}

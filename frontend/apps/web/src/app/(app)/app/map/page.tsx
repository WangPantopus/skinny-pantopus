'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useDiscoverData } from '@/components/discover/useDiscoverData';
import { InquiryChatDrawer } from '@/components/discover';
import MapLayerToggle from '@/components/discover/MapLayerToggle';
import MeasureFromChip from '@/components/discover/MeasureFromChip';
import TrustLensChips from '@/components/discover/TrustLensChips';
import { MapSkeleton } from '@/components/map/MapSkeleton';

const DiscoverMap = dynamic(() => import('@/components/discover/DiscoverMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const CATEGORY_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cleaning', label: 'Home' },
  { key: 'food_catering', label: 'Food' },
  { key: 'lawn_care', label: 'Outdoor' },
  { key: 'beauty', label: 'Wellness' },
  { key: 'pet_care', label: 'Pets' },
  { key: 'photography', label: 'Creative' },
  { key: 'plumbing', label: 'Trades' },
];

export default function ExploreMapPage() {
  const router = useRouter();

  const {
    sort, setSort,
    filters, setFilters,
    homeCenter, gpsCenter,
    viewerHome,
    hasHome, homeLoading, noLocation,
    mapLayers, setMapLayers,
    measureFrom, setMeasureFrom,
    chatTarget, setChatTarget,
    handleMapBusinessSelect,
    handleMapGigSelect,
    results,
  } = useDiscoverData();

  const handleContact = (businessUserId: string) => {
    const biz = results.find((r) => r.business_user_id === businessUserId);
    setChatTarget({ id: businessUserId, name: biz?.name || '' });
  };

  const toggleCategory = (cat: string) => {
    if (cat === 'all') {
      setFilters({ ...filters, categories: [] });
    } else {
      const next = filters.categories.includes(cat)
        ? filters.categories.filter(c => c !== cat)
        : [...filters.categories, cat];
      setFilters({ ...filters, categories: next });
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-app-border bg-app-surface flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-lg font-semibold text-app-text flex-1">Explore Map</h1>
        <MeasureFromChip
          value={measureFrom}
          onChange={setMeasureFrom}
          hasHome={hasHome}
          hasGps={gpsCenter != null}
          homeCity={viewerHome?.city}
        />
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-app-border bg-app-surface overflow-x-auto flex-shrink-0">
        {CATEGORY_CHIPS.map(cat => {
          const isActive = cat.key === 'all'
            ? filters.categories.length === 0
            : filters.categories.includes(cat.key);
          return (
            <button key={cat.key} onClick={() => toggleCategory(cat.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
              }`}>
              {cat.label}
            </button>
          );
        })}

        <div className="w-px h-5 bg-app-border mx-1 flex-shrink-0" />

        {/* Open now toggle */}
        <button onClick={() => setFilters({ ...filters, openNow: !filters.openNow })}
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${
            filters.openNow
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
          }`}>
          Open Now
        </button>

        {/* Trust lens */}
        <div className="w-px h-5 bg-app-border mx-1 flex-shrink-0" />
        <TrustLensChips value={sort} onChange={setSort} />
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        {/* Layer toggle — top right */}
        <div className="absolute top-3 right-3 z-10">
          <MapLayerToggle activeLayers={mapLayers} onChange={setMapLayers} />
        </div>

        {/* Pin count badge — top left */}
        {!homeLoading && !noLocation && (
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-app-surface/90 backdrop-blur-sm shadow-sm border border-app-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-app-text-secondary">
              {mapLayers.size === 0 ? 'No layers active' : `${[
                mapLayers.has('businesses') ? 'Businesses' : '',
                mapLayers.has('gigs') ? 'Tasks' : '',
                mapLayers.has('posts') ? 'Posts' : '',
              ].filter(Boolean).join(' · ')}`}
            </div>
          </div>
        )}

        <DiscoverMap
          homeCenter={homeCenter}
          gpsCenter={gpsCenter}
          layers={mapLayers}
          measureFrom={measureFrom}
          categories={filters.categories.length > 0 ? filters.categories : undefined}
          openNow={filters.openNow || undefined}
          onSelectBusiness={handleMapBusinessSelect}
          onSelectGig={handleMapGigSelect}
        />
      </div>

      {/* Chat drawer */}
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

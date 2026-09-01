'use client';

import dynamic from 'next/dynamic';
import type { GigListItem } from '@pantopus/types';
import type { Bounds } from '@/components/map';

// Lazy-load the inner map (Leaflet requires window)
const MapRailInner = dynamic(() => import('./MapRailInner'), { ssr: false });

// ─── Category → Pin Color ────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Handyman: '#e67e22',
  Cleaning: '#27ae60',
  Moving: '#8e44ad',
  'Pet Care': '#e74c3c',
  'Child Care': '#f39c12',
  Tutoring: '#2980b9',
  Photography: '#1abc9c',
  Cooking: '#d35400',
  Delivery: '#2c3e50',
  'Tech Support': '#3498db',
  Gardening: '#16a085',
  'Event Help': '#c0392b',
  Other: '#7f8c8d',
};

export function getCategoryColor(category?: string | null): string {
  if (!category) return '#6b7280';
  return CATEGORY_COLORS[category] ?? '#6b7280';
}

// ─── Types ────────────────────────────────────────────────────

export interface MapRailProps {
  /** Gigs to show on the map (from browse or flat list) */
  gigs: GigListItem[];
  /** User's location for centering */
  userLocation: { lat: number; lng: number } | null;
  /** Currently selected/hovered gig ID */
  selectedGigId?: string | null;
  /** Called when a pin is clicked */
  onGigSelect: (gigId: string) => void;
  /** Called when map bounds change (for "filter by map area") */
  onBoundsChange?: (bounds: Bounds) => void;
  /** When true, filter the main list by map viewport */
  filterByArea?: boolean;
  /** Toggle for filterByArea */
  onToggleFilterByArea?: () => void;
}

// ─── Wrapper handles loading state + header ──────────────────

export default function MapRail({
  gigs,
  userLocation,
  selectedGigId,
  onGigSelect,
  onBoundsChange,
  filterByArea,
  onToggleFilterByArea,
}: MapRailProps) {
  return (
    <div className="w-full xl:w-[350px] shrink-0 flex flex-col bg-app-surface xl:border-l border-app-border xl:sticky xl:top-0 h-full xl:h-[calc(100vh-56px)]">
      {/* Map header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-app-border-subtle">
        <span className="text-xs font-semibold text-app-text-secondary">
          {gigs.length} task{gigs.length !== 1 ? 's' : ''} on map
        </span>
        {onToggleFilterByArea && (
          <button
            onClick={onToggleFilterByArea}
            className={`text-[11px] font-medium px-2 py-1 rounded-md transition ${
              filterByArea
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'text-app-text-muted hover:bg-app-hover'
            }`}
          >
            {filterByArea ? 'Area filter on' : 'Filter by area'}
          </button>
        )}
      </div>

      {/* Map body */}
      <div className="flex-1 relative">
        <MapRailInner
          gigs={gigs}
          userLocation={userLocation}
          selectedGigId={selectedGigId}
          onGigSelect={onGigSelect}
          onBoundsChange={onBoundsChange}
        />
      </div>
    </div>
  );
}

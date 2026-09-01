'use client';

import { ClipboardList, Map as MapIcon, Settings, PenSquare } from 'lucide-react';
import type { FeedSurface } from '@pantopus/api';

interface FeedHeaderProps {
  viewMode: 'list' | 'map';
  onViewModeChange: (mode: 'list' | 'map') => void;
  surface: FeedSurface;
  onOpenCompose: () => void;
  onOpenPreferences: () => void;
  locationLabel?: string;
}

export default function FeedHeader({
  viewMode,
  onViewModeChange,
  surface,
  onOpenCompose,
  onOpenPreferences,
  locationLabel,
}: FeedHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        {/* View mode toggle */}
        <div className="flex bg-app-surface-sunken rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === 'list' ? 'bg-emerald-600 text-white shadow-sm' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => onViewModeChange('map')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === 'map' ? 'bg-emerald-600 text-white shadow-sm' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" /> Map
          </button>
        </div>

        {locationLabel && surface === 'place' && (
          <span className="text-xs text-app-text-muted truncate max-w-[140px]">{locationLabel}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onOpenPreferences} title="Preferences"
          className="p-2 text-app-text-secondary hover:text-app-text hover:bg-app-hover rounded-lg transition">
          <Settings className="w-4 h-4" />
        </button>
        <button onClick={onOpenCompose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition">
          <PenSquare className="w-3.5 h-3.5" /> Post
        </button>
      </div>
    </div>
  );
}

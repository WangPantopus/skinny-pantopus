'use client';

import { MapPin, Link as LinkIcon, Radio } from 'lucide-react';
import type { FeedSurface } from '@pantopus/api';
import type { ReactNode } from 'react';

const SURFACE_TABS: { key: FeedSurface; label: string; icon: ReactNode }[] = [
  { key: 'place', label: 'Nearby', icon: <MapPin className="w-4 h-4" /> },
  { key: 'personas', label: 'Beacons', icon: <Radio className="w-4 h-4" /> },
  { key: 'connections', label: 'Connections', icon: <LinkIcon className="w-4 h-4" /> },
];

interface FeedSurfaceTabsProps {
  surface: FeedSurface;
  onSurfaceChange: (next: FeedSurface) => void;
}

export default function FeedSurfaceTabs({ surface, onSurfaceChange }: FeedSurfaceTabsProps) {
  return (
    <div className="flex">
      {SURFACE_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onSurfaceChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
            surface === tab.key
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-app-muted hover:text-app'
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

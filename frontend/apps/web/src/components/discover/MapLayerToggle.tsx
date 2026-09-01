'use client';

import type { MapLayerKey } from './DiscoverMap';

const LAYER_CONFIG: { key: MapLayerKey; label: string; emoji: string; color: string }[] = [
  { key: 'businesses', label: 'Businesses', emoji: '🏪', color: 'bg-primary-100 text-primary-700 border-primary-300' },
  { key: 'gigs', label: 'Active Tasks', emoji: '📋', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'posts', label: 'Posts', emoji: '💬', color: 'bg-surface-muted text-app-strong border-app-strong' },
];

interface MapLayerToggleProps {
  activeLayers: Set<MapLayerKey>;
  onChange: (layers: Set<MapLayerKey>) => void;
}

export default function MapLayerToggle({ activeLayers, onChange }: MapLayerToggleProps) {
  const toggle = (key: MapLayerKey) => {
    const next = new Set(activeLayers);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {LAYER_CONFIG.map(({ key, label, emoji, color }) => {
        const active = activeLayers.has(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={active}
            aria-label={`${active ? 'Hide' : 'Show'} ${label}`}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              border transition-all whitespace-nowrap
              ${active
                ? color
                : 'bg-app-surface/90 text-app-muted border-app hover:bg-app-hover'
              }
              backdrop-blur-sm shadow-sm
            `}
            title={`${active ? 'Hide' : 'Show'} ${label}`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useMemo } from 'react';

function categoryIconFor(category: string): string {
  const c = category.trim().toLowerCase();
  if (c.includes('dog') || c.includes('pet')) return '🐕';
  if (c.includes('move')) return '🚚';
  if (c.includes('clean')) return '🧹';
  if (c.includes('yard') || c.includes('lawn') || c.includes('garden')) return '🌿';
  if (c.includes('handy') || c.includes('repair') || c.includes('fix')) return '🔧';
  if (c.includes('delivery')) return '📦';
  return '📌';
}

function SuggestionItem({
  icon,
  title,
  subtitle,
  onClick,
  active = false,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 text-left p-2 rounded-lg transition ${active ? 'bg-app-surface-sunken' : 'hover:bg-app-hover'}`}
    >
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text">{title}</p>
        <p className="text-xs text-app-text-secondary">{subtitle}</p>
      </div>
    </button>
  );
}

export default function NearbyTodayCard({
  gigs,
  loading,
  selectedCategory = '',
  onSelectCategory,
}: {
  gigs: Record<string, any>[];
  loading: boolean;
  selectedCategory?: string;
  onSelectCategory?: (key: string) => void;
}) {
  const nearbyCategoryRows = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const g of gigs) {
      const raw = String(g?.category || 'General').trim();
      const label = raw || 'General';
      const key = label.toLowerCase();
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { key, label, count: 1 });
    }
    return Array.from(counts.values())
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
      .slice(0, 5);
  }, [gigs]);

  return (
    <div className="bg-app-surface rounded-xl p-4 border border-app-border shadow-sm">
      <h3 className="font-semibold text-sm text-app-text mb-3">🔥 Nearby Today</h3>
      {loading ? (
        <p className="text-xs text-app-text-secondary">Loading nearby categories…</p>
      ) : nearbyCategoryRows.length === 0 ? (
        <p className="text-xs text-app-text-secondary">No open tasks in this area yet.</p>
      ) : (
        <div className="space-y-2">
          {nearbyCategoryRows.map((row) => (
            <SuggestionItem
              key={row.key}
              icon={categoryIconFor(row.label)}
              title={row.label}
              subtitle={`${row.count} active`}
              active={selectedCategory === row.label}
              onClick={() => onSelectCategory?.(row.label)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

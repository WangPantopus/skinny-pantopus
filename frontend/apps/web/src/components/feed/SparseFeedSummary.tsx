'use client';

import type { ReactNode } from 'react';
import { Star, MessageCircle, Bell, Calendar, Home } from 'lucide-react';

export default function SparseFeedSummary({
  locationLabel,
  onFilterChange,
}: {
  locationLabel: string;
  onFilterChange?: (filter: string) => void;
}) {
  const categories: { icon: ReactNode; label: string; filter: string }[] = [
    { icon: <Star className="w-4 h-4" />, label: 'Top Recommendations', filter: 'recommendation' },
    { icon: <MessageCircle className="w-4 h-4" />, label: 'Open Questions', filter: 'ask_local' },
    { icon: <Bell className="w-4 h-4" />, label: 'Recent Alerts', filter: 'alert' },
    { icon: <Calendar className="w-4 h-4" />, label: 'Upcoming Events', filter: 'event' },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-primary-900/20 dark:to-slate-900/60 rounded-2xl border border-blue-100 dark:border-primary-800 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-5 h-5 text-app-muted" />
        <div>
          <h3 className="text-sm font-bold text-app">Discover {locationLabel}</h3>
          <p className="text-[11px] text-app-muted">Be the first to contribute — or browse what&apos;s here</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => (
          <button
            key={cat.filter}
            onClick={() => onFilterChange?.(cat.filter)}
            className="flex items-center gap-2 p-2.5 bg-surface rounded-xl border border-app text-left hover:border-blue-200 dark:hover:border-primary-700 hover:bg-blue-50/50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <span>{cat.icon}</span>
            <span className="text-xs font-medium text-app">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Hammer, User, Store, Megaphone } from 'lucide-react';
import * as api from '@pantopus/api';
import type { DiscoveryItem, DiscoveryFilter } from '@pantopus/api';

const FILTER_TABS: { key: DiscoveryFilter; label: string }[] = [
  { key: 'gigs', label: 'Tasks' },
  { key: 'people', label: 'People' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'posts', label: 'Posts' },
];

const TYPE_ICONS: Record<string, typeof Hammer> = {
  gig: Hammer, person: User, business: Store, post: Megaphone,
};

const TAG_COLORS: Record<string, string> = {
  'Quick Help': '#0284c7', 'Delivery': '#f59e0b', 'Home Service': '#16a34a',
  'Pro Service': '#7c3aed', 'Care': '#ec4899', 'Event': '#8b5cf6',
  'Remote': '#06b6d4', 'Recurring': '#d97706',
};

interface HubDiscoveryProps {
  lat?: number | null;
  lng?: number | null;
}

export default function HubDiscovery({ lat, lng }: HubDiscoveryProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<DiscoveryFilter>('gigs');
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiscovery = useCallback(async (filter: DiscoveryFilter) => {
    setLoading(true);
    try {
      const res = await api.hub.getDiscovery({
        filter,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        limit: 8,
      });
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => { fetchDiscovery(activeFilter); }, [activeFilter, fetchDiscovery]);

  const handleFilterChange = (filter: DiscoveryFilter) => {
    setActiveFilter(filter);
  };

  const handleItemPress = (item: DiscoveryItem) => {
    if (item.route) router.push(item.route);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <h2 className="text-base font-extrabold text-app-text">Discover</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/app/discover')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            Find Businesses
          </button>
          <button onClick={() => router.push('/app/map')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
            Explore Map
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button key={tab.key} onClick={() => handleFilterChange(tab.key)}
            className={`px-3.5 py-1.5 rounded-full border text-xs font-bold transition ${
              activeFilter === tab.key
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-app-surface border-app-border text-app-text-muted hover:text-app-text'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-app-text-muted">Nothing nearby yet</p>
          </div>
        ) : (
          items.map((item, i) => {
            const tagColor = TAG_COLORS[item.category || ''] || '#0284c7';
            const Icon = TYPE_ICONS[item.type] || Megaphone;
            return (
              <button key={item.id} onClick={() => handleItemPress(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-app-hover transition text-left ${
                  i < items.length - 1 ? 'border-b border-app-border-subtle' : ''
                }`}>
                <div className="w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tagColor + '15', borderColor: tagColor + '30' }}>
                  <Icon className="w-4 h-4" style={{ color: tagColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{item.title}</p>
                  {item.meta && <p className="text-xs text-app-text-muted truncate">{item.meta}</p>}
                </div>
                {item.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tagColor + '12', color: tagColor }}>
                    {item.category}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

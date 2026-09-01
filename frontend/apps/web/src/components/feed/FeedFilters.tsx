'use client';

import type { ReactNode } from 'react';
import { Home, MessageCircle, Star, Calendar, Search, AlertTriangle, Tag, Newspaper, Trophy, User, Megaphone } from 'lucide-react';
import type { PostType } from '@pantopus/api';

type FeedSurface = 'place' | 'personas' | 'connections';

const PLACE_FILTERS: { key: PostType | 'all'; label: string; icon: ReactNode; color: string }[] = [
  { key: 'all', label: 'All', icon: <Home className="w-4 h-4" />, color: '#6B7280' },
  { key: 'ask_local', label: 'Ask Local', icon: <MessageCircle className="w-4 h-4" />, color: '#3B82F6' },
  { key: 'recommendation', label: 'Recs', icon: <Star className="w-4 h-4" />, color: '#F59E0B' },
  { key: 'event', label: 'Events', icon: <Calendar className="w-4 h-4" />, color: '#8B5CF6' },
  { key: 'lost_found', label: 'Lost & Found', icon: <Search className="w-4 h-4" />, color: '#EF4444' },
  { key: 'alert', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" />, color: '#DC2626' },
  { key: 'deal', label: 'Deals', icon: <Tag className="w-4 h-4" />, color: '#059669' },
  { key: 'local_update', label: 'Updates', icon: <Newspaper className="w-4 h-4" />, color: '#0D9488' },
  { key: 'neighborhood_win', label: 'Wins', icon: <Trophy className="w-4 h-4" />, color: '#D97706' },
];

const NETWORK_FILTERS: { key: PostType | 'all'; label: string; icon: ReactNode; color: string }[] = [
  { key: 'all', label: 'All', icon: <Home className="w-4 h-4" />, color: '#6B7280' },
  { key: 'personal_update', label: 'Updates', icon: <User className="w-4 h-4" />, color: '#6366F1' },
  { key: 'ask_local', label: 'Questions', icon: <MessageCircle className="w-4 h-4" />, color: '#3B82F6' },
  { key: 'recommendation', label: 'Recs', icon: <Star className="w-4 h-4" />, color: '#F59E0B' },
  { key: 'event', label: 'Events', icon: <Calendar className="w-4 h-4" />, color: '#8B5CF6' },
  { key: 'announcement', label: 'Announce', icon: <Megaphone className="w-4 h-4" />, color: '#0D9488' },
];

interface FeedFiltersProps {
  selected: PostType | 'all';
  onChange: (filter: PostType | 'all') => void;
  counts?: Partial<Record<PostType | 'all', number>>;
  surface?: FeedSurface;
  onMuteTopic?: (postType: string) => void;
}

export default function FeedFilters({ selected, onChange, counts, surface = 'place', onMuteTopic }: FeedFiltersProps) {
  const filters = surface === 'place' ? PLACE_FILTERS : NETWORK_FILTERS;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {filters.map((ch) => {
        const isActive = selected === ch.key;
        const count = counts?.[ch.key];

        return (
          <button
            key={ch.key}
            onClick={() => onChange(ch.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
              isActive
                ? 'text-white shadow-md scale-[1.02]'
                : 'bg-surface text-app-muted border border-app hover-bg-app hover:shadow-sm'
            }`}
            style={
              isActive
                ? { background: ch.color, boxShadow: `0 4px 12px ${ch.color}30` }
                : undefined
            }
          >
            <span className="flex-shrink-0">{ch.icon}</span>
            <span>{ch.label}</span>
            {isActive && ch.key !== 'all' && onMuteTopic && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onMuteTopic(ch.key); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onMuteTopic(ch.key); } }}
                className="ml-0.5 text-white/70 hover:text-white text-xs leading-none cursor-pointer"
                title={`Mute ${ch.label} in Pulse`}
              >
                ✕
              </span>
            )}
            {count != null && count > 0 && (
              <span
                className={`min-w-[18px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center ${
                  isActive ? 'bg-glass/25 text-white' : 'bg-surface-muted text-app-muted'
                }`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

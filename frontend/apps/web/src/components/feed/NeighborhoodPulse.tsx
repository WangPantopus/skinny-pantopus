'use client';

import type { ReactNode } from 'react';
import { MessageCircle, Calendar, Search, Star } from 'lucide-react';
import type { Post } from '@pantopus/api';

/**
 * `posts` is the unfiltered Place feed for the viewed area, or null while it is unknown
 * (still loading, or its read failed): then each count shows a dash instead of a false 0.
 */
export default function NeighborhoodPulse({ posts }: { posts: Post[] | null }) {
  const now = Date.now();
  const last24h = (posts ?? []).filter((p) => now - new Date(p.created_at).getTime() < 86400000);
  const count = (matches: (p: Post) => boolean) => (posts ? last24h.filter(matches).length : null);
  const questions = count((p) => p.post_type === 'ask_local');
  const events = count((p) => p.post_type === 'event');
  const alerts = count((p) => ['lost_found', 'alert'].includes(p.post_type));
  const recs = count((p) => p.post_type === 'recommendation');

  const stats: { icon: ReactNode; label: string; value: number | null; color: string }[] = [
    { icon: <MessageCircle className="w-5 h-5" style={{ color: '#3B82F6' }} />, label: 'Questions', value: questions, color: '#3B82F6' },
    { icon: <Calendar className="w-5 h-5" style={{ color: '#8B5CF6' }} />, label: 'Events', value: events, color: '#8B5CF6' },
    { icon: <Search className="w-5 h-5" style={{ color: '#EF4444' }} />, label: 'Alerts', value: alerts, color: '#EF4444' },
    { icon: <Star className="w-5 h-5" style={{ color: '#F59E0B' }} />, label: 'Recs', value: recs, color: '#F59E0B' },
  ];

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h2 className="text-xs font-bold text-app-muted uppercase tracking-wider">Neighborhood Pulse</h2>
        </div>
        <span className="text-[10px] text-app-muted">Last 24 hours</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="text-center rounded-xl py-2.5 px-2 transition-transform hover:scale-105"
            style={{ background: `${stat.color}08` }}
          >
            <div className="flex justify-center mb-0.5">{stat.icon}</div>
            <div className="text-lg font-bold text-app">
              {stat.value ?? (
                <>
                  <span aria-hidden="true">–</span>
                  <span className="sr-only">Not available</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-app-muted font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { type ReactNode } from 'react';
import { ClipboardList, Wrench, Wallet, Package, Users, CheckCircle, Calendar } from 'lucide-react';

interface TodayCardProps {
  activeTasks: number;
  openIssues: number;
  totalDue: number;
  pendingPkgs: number;
  memberCount: number;
  events: Record<string, any>[];
  onNavigateTab: (tab: string) => void;
}

export default function TodayCard({
  activeTasks,
  openIssues,
  totalDue,
  pendingPkgs,
  memberCount,
  events,
  onNavigateTab,
}: TodayCardProps) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const upcomingEvents = events
    .filter((e) => new Date(e.start_at) >= today)
    .slice(0, 3);

  // Build summary items
  const summaryItems: { icon: ReactNode; label: string; value: string | number; accent: string; tab: string }[] = [];

  if (activeTasks > 0) {
    summaryItems.push({ icon: <ClipboardList className="w-5 h-5" />, label: 'Active tasks', value: activeTasks, accent: 'text-blue-600', tab: 'tasks' });
  }
  if (openIssues > 0) {
    summaryItems.push({ icon: <Wrench className="w-5 h-5" />, label: 'Open issues', value: openIssues, accent: 'text-red-600', tab: 'issues' });
  }
  if (totalDue > 0) {
    summaryItems.push({ icon: <Wallet className="w-5 h-5" />, label: 'Bills due', value: `$${totalDue.toFixed(0)}`, accent: 'text-amber-600', tab: 'bills' });
  }
  if (pendingPkgs > 0) {
    summaryItems.push({ icon: <Package className="w-5 h-5" />, label: 'Pending packages', value: pendingPkgs, accent: 'text-purple-600', tab: 'packages' });
  }

  const allClear = summaryItems.length === 0;

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
      {/* Date heading */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-app-text">Today</h2>
          <p className="text-xs text-app-text-secondary">{dateStr}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-app-text-secondary">
          <Users className="w-4 h-4" />
          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Summary items */}
      {allClear ? (
        <div className="text-center py-3">
          <div className="mb-1"><CheckCircle className="w-6 h-6 mx-auto text-green-500" /></div>
          <p className="text-sm font-medium text-app-text-strong">All clear!</p>
          <p className="text-xs text-app-text-muted">No pending items today</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {summaryItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => onNavigateTab(item.tab)}
              className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-app-surface/80 transition text-left"
            >
              <span>{item.icon}</span>
              <div className="min-w-0">
                <div className={`text-lg font-bold leading-tight ${item.accent}`}>{item.value}</div>
                <div className="text-[10px] text-app-text-secondary truncate">{item.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="mt-4 pt-3 border-t border-app-border-subtle">
          <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Upcoming</h4>
          <div className="space-y-1.5">
            {upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <Calendar className="w-3 h-3 text-app-text-muted" />
                <span className="font-medium text-app-text-strong truncate">{e.title}</span>
                <span className="text-app-text-muted flex-shrink-0">
                  {new Date(e.start_at).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

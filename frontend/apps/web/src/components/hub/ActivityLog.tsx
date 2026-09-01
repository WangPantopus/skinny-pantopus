'use client';

import { useRouter } from 'next/navigation';
import { formatTimeAgo } from '@pantopus/ui-utils';
import type { ActivityItem } from './types';

interface ActivityLogProps {
  items: ActivityItem[];
}

const pillarColors: Record<string, string> = {
  personal: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  home: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  business: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
};

export default function ActivityLog({ items }: ActivityLogProps) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-app-text-secondary dark:text-app-text-muted uppercase tracking-wider mb-3">
          Recent Activity
        </h2>
        <div className="bg-app-surface border border-app-border rounded-xl p-6 text-center">
          <p className="text-sm text-app-text-secondary dark:text-app-text-muted mb-2">No recent activity</p>
          <button onClick={() => router.push('/app/gigs-v2/new')} className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            Post your first task →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-app-text-secondary dark:text-app-text-muted uppercase tracking-wider">Recent Activity</h2>
        <button onClick={() => router.push('/app/notifications')} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">See all →</button>
      </div>
      <div className="bg-app-surface border border-app-border rounded-xl divide-y divide-app-border-subtle overflow-hidden">
        {items.slice(0, 10).map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(item.route)}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-app-hover dark:hover:bg-gray-700/50 transition text-left"
          >
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${pillarColors[item.pillar] || pillarColors.personal}`}>
              {item.pillar}
            </span>
            <span className={`flex-1 text-sm truncate ${item.read ? 'text-app-text-secondary dark:text-app-text-muted' : 'text-app-text dark:text-white font-medium'}`}>
              {item.title}
            </span>
            <span className="text-xs text-app-text-muted dark:text-app-text-secondary whitespace-nowrap flex-shrink-0">
              {formatTimeAgo(item.at, 'full')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import type { CounterItem } from '@/types/mailbox';
import DrawerBadge from './DrawerBadge';

type CounterCardProps = {
  item: CounterItem;
  onAction: (actionId: string) => void;
};

const urgencyStyle: Record<string, string> = {
  overdue: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-sm shadow-amber-100 dark:shadow-amber-900/20',
  due_soon: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  time_sensitive: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  none: 'bg-app-surface border-app-border',
};

export default function CounterCard({ item, onAction }: CounterCardProps) {
  const isOverdue = item.urgency === 'overdue';
  const style = urgencyStyle[item.urgency] ?? urgencyStyle.none;

  return (
    <button
      type="button"
      onClick={() => onAction(item.mail_id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left min-h-[44px] ${style} hover:brightness-95 dark:hover:brightness-110`}
    >
      {/* Action type icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isOverdue ? 'bg-amber-500 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
      }`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text truncate">
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.sender_display && (
            <span className="text-xs text-app-text-secondary truncate">{item.sender_display}</span>
          )}
          <DrawerBadge drawer={item.drawer} size="sm" />
          {item.due_date && (
            <span className={`text-xs ${isOverdue ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-app-text-muted'}`}>
              Due {new Date(item.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import type { MailItemV2 } from '@/types/mailbox';
import { useCounterItems } from '@/lib/mailbox-queries';
import { UrgencyIndicator, DrawerBadge, TrustBadge } from '@/components/mailbox';

/**
 * Counter page — shows all action-required items.
 * Sorted: overdue first, then by due_date ascending.
 */
export default function CounterPage() {
  const router = useRouter();
  const { data: items, isLoading, error, refetch } = useCounterItems();

  // Sort: overdue first, then by due_date
  const sorted = [...(items ?? [])].sort((a, b) => {
    const aOverdue = a.urgency === 'overdue' ? 0 : 1;
    const bOverdue = b.urgency === 'overdue' ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return aDate - bDate;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/app/mailbox')}
            className="md:hidden p-1 text-app-text-secondary hover:text-app-text-strong"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-app-text">
            Needs Attention
          </h1>
          {sorted.length > 0 && (
            <span className="text-xs text-app-text-secondary">
              {sorted.length} item{sorted.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-app-border">
                <div className="w-8 h-8 rounded-full bg-app-surface-sunken animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 bg-app-surface-sunken rounded animate-pulse" />
                  <div className="h-3 w-24 bg-app-surface-sunken rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-app-text-secondary mb-3">Failed to load counter items</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <svg className="w-12 h-12 text-green-300 dark:text-green-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted">All caught up</p>
            <p className="text-xs text-app-text-muted mt-1">No action-required items right now</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sorted.map((item) => (
              <CounterItemCard
                key={item.id}
                item={item}
                onClick={() => router.push(`/app/mailbox/${item.drawer}/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CounterItemCard({ item, onClick }: { item: MailItemV2; onClick: () => void }) {
  const isOverdue = item.urgency === 'overdue';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors text-left min-h-[44px] ${
        isOverdue
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-sm shadow-amber-100 dark:shadow-amber-900/20'
          : 'bg-app-surface border-app-border hover:bg-app-hover dark:hover:bg-gray-800'
      }`}
    >
      {/* Urgency icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isOverdue ? 'bg-amber-500 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
      }`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text truncate">
          {item.display_title || item.subject || 'Untitled'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.sender_display && (
            <span className="text-xs text-app-text-secondary truncate">{item.sender_display}</span>
          )}
          <TrustBadge trust={item.sender_trust} size="sm" />
          <DrawerBadge drawer={item.drawer} size="sm" />
          <UrgencyIndicator urgency={item.urgency} due_date={item.due_date} compact />
        </div>
      </div>

      <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

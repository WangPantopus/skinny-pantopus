'use client';

import { useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import type { HomeTimelineItem } from '@pantopus/types';

interface HomeTimelineProps {
  items: HomeTimelineItem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

// ── Relative time formatting ──────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Action → dot color (Tailwind classes) ─────────────────────

function getDotColorClass(action: string): string {
  if (
    action.includes('completed') ||
    action.includes('resolved') ||
    action.includes('paid') ||
    action.includes('verified')
  ) {
    return 'bg-green-500';
  }
  if (
    action.includes('created') ||
    action.includes('added') ||
    action.includes('joined') ||
    action.includes('uploaded') ||
    action.includes('delivered')
  ) {
    return 'bg-blue-500';
  }
  if (action.includes('updated') || action.includes('changed') || action.includes('claimed')) {
    return 'bg-amber-500';
  }
  if (
    action.includes('removed') ||
    action.includes('deleted') ||
    action.includes('left') ||
    action.includes('dismissed')
  ) {
    return 'bg-red-500';
  }
  return 'bg-gray-400';
}

// ── Group items by month ──────────────────────────────────────

interface TimelineSection {
  title: string;
  items: HomeTimelineItem[];
}

function groupByMonth(items: HomeTimelineItem[]): TimelineSection[] {
  const buckets: Record<string, HomeTimelineItem[]> = {};
  const order: string[] = [];

  for (const item of items) {
    const d = new Date(item.created_at);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(item);
  }

  return order.map((title) => ({ title, items: buckets[title] }));
}

// ── Component ─────────────────────────────────────────────────

export default function HomeTimeline({ items, loading, hasMore, onLoadMore }: HomeTimelineProps) {
  const sections = useMemo(() => groupByMonth(items), [items]);

  // Total item count for determining the absolute last item
  const totalItems = items.length;

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-[48px] animate-pulse">
            <div className="flex w-7 flex-col items-center">
              <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700" />
              {i < 4 && (
                <div className="my-0.5 w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 pl-3 pb-4">
              <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-2 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <div className="flex flex-col items-center gap-1 py-6">
          <Clock className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            No activity recorded yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Actions on your home will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ── Render sections ───────────────────────────────────────

  let globalIndex = 0;

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          {/* Section header */}
          <div className="pb-1.5 pt-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {section.title}
            </h3>
          </div>

          {/* Section items */}
          {section.items.map((item, itemIdx) => {
            const currentGlobal = globalIndex++;
            const isLastInSection = itemIdx === section.items.length - 1;
            const isLastSection = sectionIdx === sections.length - 1;
            const isAbsoluteLastItem = isLastInSection && isLastSection;
            const hideLine = isAbsoluteLastItem && !hasMore;
            const dotColor = getDotColorClass(item.action);

            return (
              <div key={item.id} className="flex min-h-[48px]">
                {/* Timeline line + dot */}
                <div className="flex w-7 flex-col items-center">
                  <div
                    className={`h-6 w-6 shrink-0 rounded-full ${dotColor}`}
                  />
                  {!hideLine && (
                    <div className="my-0.5 w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pl-3 pb-3.5">
                  <p className="text-sm leading-snug text-gray-900 dark:text-gray-100">
                    {item.description || item.action.replace(/_/g, ' ')}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatTimeAgo(item.created_at)}</span>
                    {item.actor_name && (
                      <span>&middot; By {item.actor_name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="mt-1 w-full py-2.5 text-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Load more
        </button>
      )}
    </div>
  );
}

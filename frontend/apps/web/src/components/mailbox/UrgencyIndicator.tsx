'use client';

import type { UrgencyLevel } from '@/types/mailbox';

type UrgencyIndicatorProps = {
  urgency: UrgencyLevel;
  due_date?: string;
  compact?: boolean;
};

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

export default function UrgencyIndicator({
  urgency,
  due_date,
  compact = false,
}: UrgencyIndicatorProps) {
  if (urgency === 'none') return null;

  if (urgency === 'due_soon') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        {!compact && (
          <span className="text-xs font-medium">
            {due_date ? formatDueDate(due_date) : 'Due soon'}
          </span>
        )}
      </span>
    );
  }

  if (urgency === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        {!compact && <span className="text-xs font-semibold">Overdue</span>}
      </span>
    );
  }

  // time_sensitive
  return (
    <span className="inline-flex items-center gap-1 text-orange-600">
      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
      {!compact && <span className="text-xs font-semibold">Urgent</span>}
    </span>
  );
}

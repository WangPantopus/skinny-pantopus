'use client';

import type { MailMemory } from '@/types/mailbox';

type MemoryCardProps = {
  memory: MailMemory;
  onView: (itemId: string) => void;
  onDismiss: () => void;
};

function memoryHeading(type: string, referenceDate: string): string {
  const date = new Date(referenceDate);
  const yearsAgo = Math.max(1, Math.round((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));

  switch (type) {
    case 'on_this_day':
      return yearsAgo === 1 ? 'One year ago today' : `${yearsAgo} years ago today`;
    case 'year_in_mail':
      return `Your ${date.getFullYear()} Year in Mail`;
    case 'first_mail_from_sender':
      return 'Your First Mail';
    default:
      return 'Memory';
  }
}

export default function MemoryCard({ memory, onView, onDismiss }: MemoryCardProps) {
  const heading = memoryHeading(memory.memory_type, memory.reference_date);

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900/40">
        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
          {heading}
        </p>
        <p className="text-[10px] text-purple-500 mt-0.5">
          {new Date(memory.reference_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-app-text">
          {memory.headline}
        </p>
        {memory.body && (
          <p className="text-xs text-app-text-secondary dark:text-app-text-muted mt-1 line-clamp-2">
            {memory.body}
          </p>
        )}
        {memory.mail_ids.length > 0 && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5">
            {memory.mail_ids.length} related mail item{memory.mail_ids.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-2 border-t border-purple-200 dark:border-purple-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => memory.mail_ids[0] && onView(memory.mail_ids[0])}
          disabled={memory.mail_ids.length === 0}
          className="px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          View
        </button>
        {!memory.dismissed && (
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import type { CounterSummary } from '@/types/mailbox';

type CounterBannerProps = {
  counter: CounterSummary;
  onClick?: () => void;
};

export default function CounterBanner({ counter, onClick }: CounterBannerProps) {
  if (counter.total === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left"
    >
      {/* Counter circle */}
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">
        {counter.total > 99 ? '99+' : counter.total}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
          {counter.total} action{counter.total !== 1 ? 's' : ''} needed
        </p>
        {counter.items.length > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 truncate mt-0.5">
            {counter.items[0].title}
            {counter.total > 1 ? ` and ${counter.total - 1} more` : ''}
          </p>
        )}
      </div>

      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

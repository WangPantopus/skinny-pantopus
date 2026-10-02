'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  useMailMemories,
  useDismissMemory,
  useYearInMail,
} from '@/lib/mailbox-queries';
import { MemoryCard } from '@/components/mailbox';

// ── Year card helpers ────────────────────────────────────────

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}



// ── Stat pill ────────────────────────────────────────────────

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-1.5 bg-app-surface-sunken rounded-lg text-center">
      <p className="text-sm font-bold text-app-text">{value}</p>
      <p className="text-[10px] text-app-text-secondary">{label}</p>
    </div>
  );
}

// ── Share card capture ───────────────────────────────────────

type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

async function captureAndShare(_element: HTMLElement, year: number): Promise<ShareResult> {
  // Use native share API with text — html2canvas would require an extra dependency
  if (navigator.share) {
    try {
      await navigator.share({
        title: `My ${year} Year in Mail`,
        text: `Check out my ${year} Year in Mail on Pantopus!`,
      });
      return 'shared';
    } catch (error) {
      // Respect cancellation; do not copy after the user dismisses sharing.
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  // Fallback: copy a summary to clipboard
  try {
    await navigator.clipboard.writeText(
      `My ${year} Year in Mail — powered by Pantopus`,
    );
    return 'copied';
  } catch {
    return 'failed';
  }
}

// ── Year in Mail Card ────────────────────────────────────────

function YearInMailCard({ year: yearNum }: { year: number }) {
  const { data: yearData, isLoading } = useYearInMail(yearNum);
  const cardRef = useRef<HTMLDivElement>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared' | 'copied' | 'failed'>('idle');

  const handleShare = useCallback(async () => {
    if (!cardRef.current || !yearData) return;
    setShareStatus('sharing');
    const result = await captureAndShare(cardRef.current, yearNum);
    setShareStatus(result === 'cancelled' ? 'idle' : result);
    if (result === 'shared' || result === 'copied') {
      setTimeout(() => setShareStatus('idle'), 3000);
    }
  }, [yearData, yearNum]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-app-border p-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 bg-app-surface-sunken rounded animate-pulse" />
          <div className="h-4 w-32 bg-app-surface-sunken rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!yearData) return null;

  const topSenders = yearData.top_senders.slice(0, 5);

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-app-border overflow-hidden bg-app-surface"
    >
      {/* Year header */}
      <div className="px-5 py-4 bg-gradient-to-r from-primary-50 to-sky-50 dark:from-primary-950/30 dark:to-sky-950/30 border-b border-app-border-subtle">
        <p className="text-3xl font-black text-app-text">
          {yearData.year}
        </p>
        <p className="text-sm text-app-text-secondary dark:text-app-text-muted mt-0.5">
          {formatK(yearData.total_items)} pieces of mail
        </p>
      </div>

      {/* Stats row */}
      <div className="px-5 py-3 border-b border-app-border-subtle">
        <div className="flex items-center gap-2 flex-wrap">
          {yearData.total_packages > 0 && (
            <StatPill value={yearData.total_packages.toString()} label="packages" />
          )}
          {yearData.by_type?.postcard && (
            <StatPill value={yearData.by_type.postcard.toString()} label="postcards" />
          )}
          {yearData.by_type?.bill && (
            <StatPill value={yearData.by_type.bill.toString()} label="bills paid" />
          )}
        </div>
      </div>

      {/* Earnings */}
      {(yearData.total_earned > 0 || yearData.total_saved > 0) && (
        <div className="px-5 py-3 border-b border-app-border-subtle flex items-center gap-4 text-sm text-app-text-secondary dark:text-app-text-muted">
          {yearData.total_earned > 0 && (
            <span>
              <span className="font-bold text-green-600 dark:text-green-400">
                ${yearData.total_earned.toFixed(2)}
              </span>{' '}
              earned
            </span>
          )}
          {yearData.total_saved > 0 && (
            <span>
              <span className="font-bold text-primary-600 dark:text-primary-400">
                ${yearData.total_saved.toFixed(2)}
              </span>{' '}
              saved
            </span>
          )}
        </div>
      )}

      {/* Top senders */}
      {topSenders.length > 0 && (
        <div className="px-5 py-3 border-b border-app-border-subtle">
          <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Top Senders
          </p>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-app-text-strong">
            {topSenders.map((sender, i) => (
              <span key={sender.sender_display} className="whitespace-nowrap">
                {sender.sender_display}{' '}
                <span className="text-app-text-muted">({sender.item_count})</span>
                {i === topSenders.length - 1 && sender.category === 'personal' && (
                  <span className="ml-0.5 text-red-400" title="Personal">&#10084;</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {yearData.most_active_month && (
        <div className="px-5 py-3 border-b border-app-border-subtle flex items-center gap-2 text-sm">
          <span>🏆</span>
          <span className="text-app-text-strong">
            Most active: <span className="font-semibold">{yearData.most_active_month}</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={shareStatus === 'sharing'}
          className={`flex-1 py-2 text-center text-sm font-medium rounded-lg transition-colors ${
            shareStatus === 'shared' || shareStatus === 'copied'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : shareStatus === 'sharing'
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'text-primary-600 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20'
          }`}
        >
          {shareStatus === 'sharing'
            ? 'Preparing...'
            : shareStatus === 'shared'
              ? 'Shared!'
              : shareStatus === 'copied'
                ? 'Copied!'
                : 'Share card'}
        </button>
      </div>
      {shareStatus === 'failed' && (
        <p role="alert" className="px-5 pb-3 text-sm text-red-600 dark:text-red-400">
          Could not share or copy this card. Try again.
        </p>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function MailMemoryPage() {
  const {
    data: memories,
    isLoading: memoriesLoading,
    isError: memoriesError,
    isFetching: memoriesFetching,
    refetch: refetchMemories,
  } = useMailMemories();
  const dismissMutation = useDismissMemory();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissError, setDismissError] = useState<string | null>(null);

  const visibleMemories = useMemo(() => {
    if (!memories) return [];
    return memories.filter((m) => !m.dismissed && !dismissed.has(m.id));
  }, [memories, dismissed]);

  const handleDismiss = useCallback(
    (memoryId: string) => {
      setDismissError(null);
      dismissMutation.mutate(memoryId, {
        onSuccess: () => setDismissed((prev) => new Set(prev).add(memoryId)),
        onError: () => setDismissError('Could not dismiss this memory. Try again.'),
      });
    },
    [dismissMutation],
  );

  const handleView = useCallback((itemId: string) => {
    window.location.href = `/app/mailbox/personal/${itemId}`;
  }, []);

  // Available years for Year in Mail (current year + previous years)
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  if (memoriesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* ── On This Day ──────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📅</span>
            <h2 className="text-sm font-bold text-app-text uppercase tracking-wider">
              On This Day
            </h2>
          </div>

          {dismissError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-3">
              {dismissError}
            </p>
          )}

          {memoriesError ? (
            <div className="rounded-xl border border-app-border p-8 text-center">
              <p role="alert" className="text-sm text-app-text-secondary">
                Could not load memories.
              </p>
              <button
                type="button"
                onClick={() => void refetchMemories()}
                disabled={memoriesFetching}
                className="mt-3 text-sm font-semibold text-primary-600 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          ) : visibleMemories.length === 0 ? (
            <div className="rounded-xl border border-app-border p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-app-text-secondary">
                Nothing to remember today — check back tomorrow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onView={handleView}
                  onDismiss={() => handleDismiss(memory.id)}
                  dismissDisabled={dismissMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Year in Mail ─────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📊</span>
            <h2 className="text-sm font-bold text-app-text uppercase tracking-wider">
              Your Years in Mail
            </h2>
          </div>

          <div className="space-y-4">
            {availableYears.map((year) => (
              <YearInMailCard key={year} year={year} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

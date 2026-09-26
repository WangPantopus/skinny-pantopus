'use client';

import { useRouter } from 'next/navigation';
import type { DeletedMail } from '@pantopus/api';
import { useDeletedMail, useRestoreMail } from '@/lib/mailbox-queries';
import { toast } from '@/components/ui/toast-store';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Recently deleted — letters deleted in the last 30 days that you could see,
 * newest first. Restore puts a letter back for everyone who could see it;
 * after 30 days the nightly purge removes it.
 */
export default function RecentlyDeletedPage() {
  const router = useRouter();
  const { data: items, isLoading, error, refetch } = useDeletedMail();
  const restore = useRestoreMail();

  const handleRestore = (item: DeletedMail) => {
    restore.mutate(item.id, {
      onSuccess: () => toast.success('Letter restored'),
      onError: (err) => toast.error(`Couldn't restore this letter. ${err.message || 'Please try again.'}`),
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/app/mailbox')}
            className="md:hidden p-1 text-app-text-secondary hover:text-app-text-strong"
            aria-label="Back to mailbox"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-app-text">
            Recently deleted
          </h1>
          {(items?.length ?? 0) > 0 && (
            <span className="text-xs text-app-text-secondary">
              {items!.length} letter{items!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-app-text-muted mt-1">
          Deleted letters stay here for 30 days. Anyone who could see a letter can restore it.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-app-border">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 bg-app-surface-sunken rounded animate-pulse" />
                  <div className="h-3 w-24 bg-app-surface-sunken rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-app-text-secondary mb-3">Couldn&apos;t load recently deleted mail</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted">Nothing deleted</p>
            <p className="text-xs text-app-text-muted mt-1">Letters deleted in the last 30 days appear here</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {items.map((item) => {
              const restoring = restore.isPending && restore.variables === item.id;
              const by = item.deleted_by_me ? 'by you' : item.deleted_by_name ? `by ${item.deleted_by_name}` : null;
              return (
                <div
                  key={item.id}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border bg-app-surface border-app-border min-h-[44px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app-text truncate">
                      {item.display_title || item.subject || 'Untitled'}
                    </p>
                    <p className="text-xs text-app-text-secondary mt-0.5 truncate">
                      {`Deleted${by ? ` ${by}` : ''} · ${shortDate(item.deleted_at)} · Restore until ${shortDate(item.restorable_until)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    disabled={restoring}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-app-border text-app-text-secondary hover:bg-app-hover disabled:opacity-60"
                  >
                    {restoring ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

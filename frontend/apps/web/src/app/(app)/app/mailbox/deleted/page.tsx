'use client';

import type { DeletedMail } from '@pantopus/api';
import { useDeletedMail, useRestoreMail } from '@/lib/mailbox-queries';
import { toast } from '@/components/ui/toast-store';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Recently shredded — mail shredded in the last 30 days that you could see,
 * newest first. Bring it back puts it back for everyone who could see it;
 * after 30 days the nightly purge removes it.
 */
export default function RecentlyDeletedPage() {
  const { data: items, isLoading, error, refetch } = useDeletedMail();
  const restore = useRestoreMail();

  const handleRestore = (item: DeletedMail) => {
    restore.mutate(item.id, {
      onSuccess: () => toast.success('Brought back to your mail'),
      onError: (err) => toast.error(`Couldn't bring it back. ${mailLoadMessage(err)}`),
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-app-text">
            Recently shredded
          </h1>
          {(items?.length ?? 0) > 0 && (
            <span className="text-xs text-app-text-secondary">
              {items!.length} letter{items!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-app-text-muted mt-1">
          Shredded mail stays here for 30 days. Anyone who could see it can bring it back.
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
            <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted">Nothing shredded</p>
            <p className="text-xs text-app-text-muted mt-1">Mail you shred stays here for 30 days</p>
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
                      {`Shredded${by ? ` ${by}` : ''} · ${shortDate(item.deleted_at)} · You can bring it back until ${shortDate(item.restorable_until)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    disabled={restoring}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-app-border text-app-text-secondary hover:bg-app-hover disabled:opacity-60"
                  >
                    {restoring ? 'Bringing it back…' : 'Bring it back'}
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

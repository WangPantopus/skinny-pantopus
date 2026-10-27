'use client';

import type { ReactNode } from 'react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { MailItemV2, MailboxPaginatedResponse } from '@/types/mailbox';
import type { MailboxApiError } from '@/lib/mailbox-api';
import ErrorState from '@/components/ui/ErrorState';
import MailRow from './MailRow';
import { mailLoadMessage } from './mailLoadMessage';
import useMailAddressee from './useMailAddressee';

type PagedPieces = UseInfiniteQueryResult<InfiniteData<MailboxPaginatedResponse<MailItemV2>>, MailboxApiError>;

/**
 * A page-at-a-time list of pieces drawn as paper (a Vault folder, Archived):
 * a skeleton while it loads, what went wrong with Try again if it can't, the
 * empty words, and "Show more" until the server has no more.
 */
export default function PieceList({
  pieces,
  label,
  failTitle,
  empty,
  onOpen,
}: {
  pieces: PagedPieces;
  label: string;
  failTitle: string;
  empty: ReactNode;
  onOpen: (item: MailItemV2) => void;
}) {
  const { addressee, timeZone } = useMailAddressee();
  const items = pieces.data?.pages.flatMap((page) => page.items) ?? [];

  if (pieces.isPending) {
    return (
      <div className="space-y-5 px-1 pt-2" role="status" aria-label={`Loading ${label}`}>
        {[1, 2].map((i) => <div key={i} className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />)}
      </div>
    );
  }
  if (pieces.isError && items.length === 0) {
    return <ErrorState title={failTitle} message={mailLoadMessage(pieces.error)} onRetry={() => { void pieces.refetch(); }} />;
  }
  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <div role="list" aria-label={label} className="space-y-4">
        {items.map((item) => {
          const to = addressee(item);
          return (
            <div role="listitem" key={item.id}>
              <MailRow item={item} recipientName={to.name} recipientLine={to.line} timeZone={timeZone} onOpen={() => onOpen(item)} />
            </div>
          );
        })}
      </div>
      {pieces.isFetchNextPageError ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
          <p>Couldn&apos;t load more. {mailLoadMessage(pieces.error)}</p>
          <button type="button" onClick={() => { void pieces.fetchNextPage(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
        </div>
      ) : pieces.hasNextPage ? (
        <button
          type="button"
          onClick={() => { void pieces.fetchNextPage(); }}
          disabled={pieces.isFetchingNextPage}
          className="mt-4 w-full rounded-xl border border-app-border bg-app-surface py-3 text-sm font-semibold text-primary-600 hover:bg-app-hover disabled:opacity-60"
        >
          {pieces.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
      ) : null}
    </>
  );
}

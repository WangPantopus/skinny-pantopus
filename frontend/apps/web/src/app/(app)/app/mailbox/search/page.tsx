'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import { useMailSearch } from '@/lib/mailbox-queries';
import MailRow from '@/components/mailbox/MailRow';
import useMailAddressee from '@/components/mailbox/useMailAddressee';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import ErrorState from '@/components/ui/ErrorState';

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

/**
 * Search all mail: every drawer you can read, filed and archived pieces too,
 * on the server (the drawer lists used to filter only the rows on screen).
 * The words stay in the address, so a reload keeps the search.
 */
export default function MailSearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get('q') ?? '');
  const [query, setQuery] = useState(() => (params.get('q') ?? '').trim());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    window.history.replaceState(null, '', query ? `/app/mailbox/search?q=${encodeURIComponent(query)}` : '/app/mailbox/search');
  }, [query]);

  const search = useMailSearch(query);
  const { addressee, timeZone } = useMailAddressee();
  const results = search.data?.pages.flatMap((page) => page.items) ?? [];
  const tooShort = query.length > 0 && query.length < MIN_LENGTH;

  const open = (item: MailItemV2) => router.push(`/app/mailbox/${item.drawer}/${item.id}`);

  return (
    <div className="mx-auto w-full max-w-2xl md:h-full md:overflow-y-auto">
      <div className="px-4 pb-2 pt-3">
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Search mail</h1>
        <form role="search" onSubmit={(event) => { event.preventDefault(); setQuery(text.trim()); }} className="relative mt-3">
          <label htmlFor="mail-search" className="sr-only">Search all mail</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" aria-hidden />
          <input
            ref={inputRef}
            id="mail-search"
            type="search"
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="A sender, a word from the letter…"
            autoComplete="off"
            className="w-full rounded-xl border border-app-border bg-app-surface py-2.5 pl-9 pr-10 text-sm text-app-text placeholder:text-app-text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {text ? (
            <button
              type="button"
              onClick={() => { setText(''); setQuery(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-app-text-muted hover:text-app-text"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </form>
      </div>

      <div className="px-3 pb-8" aria-live="polite">
        {!query ? (
          <p className="px-1 pt-4 text-sm text-app-text-secondary">
            Searches every drawer you can open, including mail you filed in the Vault or archived.
          </p>
        ) : tooShort ? (
          <p className="px-1 pt-4 text-sm text-app-text-secondary">Type at least {MIN_LENGTH} letters to search.</p>
        ) : search.isPending ? (
          <div className="space-y-5 px-1 pt-4" role="status" aria-label="Searching your mail">
            {[1, 2].map((i) => <div key={i} className="h-[150px] rounded-md bg-app-surface-sunken animate-pulse" />)}
          </div>
        ) : search.isError && results.length === 0 ? (
          <ErrorState
            title="Couldn't search your mail"
            message={mailLoadMessage(search.error)}
            onRetry={() => { void search.refetch(); }}
          />
        ) : results.length === 0 ? (
          <div className="px-1 pt-6 text-center">
            <p className="text-sm font-medium text-app-text">No mail matches &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-sm text-app-text-secondary">Try a sender&apos;s name or another word from the letter.</p>
          </div>
        ) : (
          <>
            <p className="px-1 pb-2 pt-3 text-xs text-app-text-muted">
              {results.length} {results.length === 1 ? 'piece shown' : 'pieces shown'} for &ldquo;{query}&rdquo;
            </p>
            <div role="list" aria-label="Search results" className="space-y-4">
              {results.map((item) => {
                const to = addressee(item);
                return (
                  <div role="listitem" key={item.id}>
                    <MailRow item={item} recipientName={to.name} recipientLine={to.line} timeZone={timeZone} onOpen={() => open(item)} />
                  </div>
                );
              })}
            </div>
            {search.isFetchNextPageError ? (
              <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                <p>Couldn&apos;t load more results. {mailLoadMessage(search.error)}</p>
                <button type="button" onClick={() => { void search.fetchNextPage(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
              </div>
            ) : search.hasNextPage ? (
              <button
                type="button"
                onClick={() => { void search.fetchNextPage(); }}
                disabled={search.isFetchingNextPage}
                className="mt-4 w-full rounded-xl border border-app-border bg-app-surface py-3 text-sm font-semibold text-primary-600 hover:bg-app-hover disabled:opacity-60"
              >
                {search.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

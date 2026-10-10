'use client';

// A copy of what a page with its own list state showed, kept in the session's
// query cache (memory only, dropped with the session) so coming back shows it
// at once (Instant Screens contract §3). The page seeds its state from
// `initial`, skips its first read while the copy is `fresh`, and calls `keep`
// with what it shows and when that was read from the server. A copy marked out
// of date (a change signal, Clear saved data) is never fresh.

import { useCallback, useState } from 'react';
import { hashKey, skipToken, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

export interface KeptState<T> {
  /** What the page showed last time, or null. */
  initial: T | null;
  /** The copy was read from the server less than `freshMs` ago and isn't marked out of date. */
  fresh: boolean;
  /** When the copy was read from the server (0 without one). */
  readAt: number;
  /** Keeps what the page shows now, read from the server at `readAt`. */
  keep: (data: T, readAt: number) => void;
}

export function useKeptState<T>(queryKey: QueryKey, freshMs: number): KeptState<T> {
  const client = useQueryClient();
  const [initial] = useState(() => {
    const state = client.getQueryState<T>(queryKey);
    if (state?.data === undefined) return null;
    return { data: state.data, readAt: state.dataUpdatedAt, fresh: !state.isInvalidated && Date.now() - state.dataUpdatedAt < freshMs };
  });
  // While the page is open its copy is in use, so the 30-minute drop of unused entries starts on leaving.
  useQuery({ queryKey, queryFn: skipToken });
  const hash = hashKey(queryKey);
  const keep = useCallback((data: T, readAt: number) => {
    client.setQueryData(queryKey, data, { updatedAt: readAt });
    // The key's hash stands for the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, hash]);
  return { initial: initial?.data ?? null, fresh: initial?.fresh ?? false, readAt: initial?.readAt ?? 0, keep };
}

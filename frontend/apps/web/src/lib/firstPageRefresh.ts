'use client';

// Infinite lists refresh only their first page (Instant Screens contract §4).
//
// Coming back to an infinite list after its fresh window, TanStack Query would
// refetch every page the list had loaded, one after another. Called just
// before the list's useInfiniteQuery, this trims the kept list to its first
// page when it is due for a refresh (and nobody is showing it), so the quiet
// refresh asks once. Inside the fresh window nothing changes: every loaded page
// stays, with the place you were reading.

import { useMemo } from 'react';
import { hashKey, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';

export function useFirstPageRefresh(queryKey: QueryKey, staleTime: number): void {
  const client = useQueryClient();
  const hash = hashKey(queryKey);
  useMemo(() => {
    const query = client.getQueryCache().find<InfiniteData<unknown, unknown>>({ queryKey, exact: true });
    const state = query?.state;
    const data = state?.data;
    if (!query || !state || !data || data.pages.length <= 1) return;
    if (state.fetchStatus !== 'idle' || query.getObserversCount() > 0) return;
    if (!state.isInvalidated && Date.now() - state.dataUpdatedAt < staleTime) return;
    // Keep when it was read, so the list still counts as due and refreshes that first page.
    client.setQueryData<InfiniteData<unknown, unknown>>(queryKey,
      { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }, { updatedAt: state.dataUpdatedAt });
    if (state.isInvalidated) void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
    // The key's hash stands for the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, hash, staleTime]);
}

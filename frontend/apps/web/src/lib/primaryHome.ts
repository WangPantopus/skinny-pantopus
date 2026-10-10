'use client';

// ============================================================
// Your primary home: one cache entry for GET /api/homes/primary
// (queryKeys.placePrimaryHome), shared by Place, Today's ballot card,
// Pulse, the shell's map-tile warm-up, discovery and the composers.
// Freshness follows the Instant Screens contract §4 ("Homes and
// household": 2 minutes). The entry lives in the session's query client,
// which sign-out and account switches replace.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { activeQueryClient } from '@/lib/active-query-client';
import { gatedStaleTime, showsHomeCopy, useAfterRecheck } from '@/lib/householdCopy';

export type PrimaryHomeReply = Awaited<ReturnType<typeof api.homes.getPrimaryHome>>;

export const PRIMARY_HOME_FRESH_MS = 2 * 60 * 1000;

function showsPrimaryCopy(reply: PrimaryHomeReply): boolean {
  return reply.home === null || showsHomeCopy(reply.home);
}

export function primaryHomeQuery() {
  return {
    queryKey: queryKeys.placePrimaryHome(), queryFn: () => api.homes.getPrimaryHome(),
    staleTime: gatedStaleTime(PRIMARY_HOME_FRESH_MS, showsPrimaryCopy),
  };
}

/** The primary home, shown at once when it was loaded before. */
export function usePrimaryHome(options?: { enabled?: boolean; retry?: boolean }) {
  const query = useQuery({ ...primaryHomeQuery(), ...options });
  const { data, waiting } = useAfterRecheck(query, showsPrimaryCopy);
  return { ...query, data, isPending: query.isPending || waiting, isLoading: query.isLoading || waiting,
    isSuccess: query.isSuccess && data !== undefined };
}

/** The primary home for code outside rendering: the cached copy while fresh, else one shared request. */
export function fetchPrimaryHome(): Promise<PrimaryHomeReply> {
  const client = activeQueryClient();
  return client ? client.fetchQuery(primaryHomeQuery()) : api.homes.getPrimaryHome();
}

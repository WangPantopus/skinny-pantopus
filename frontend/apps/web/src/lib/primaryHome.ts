'use client';

// ============================================================
// Your primary home: one cache entry derived from GET /api/homes/my-homes
// (queryKeys.placePrimaryHome), shared by Place, Today's ballot card,
// Pulse, the shell's map-tile warm-up, discovery and the composers.
// Freshness follows the Instant Screens contract §4 ("Homes and
// household": 2 minutes). The entry lives in the session's query client,
// which sign-out and account switches replace.
// ============================================================

import { useQuery, type QueryFunctionContext } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { activeQueryClient } from '@/lib/active-query-client';
import { gatedStaleTime, showsPrimaryCopy as showsPrimaryHomeCopy, useAfterRecheck } from '@/lib/householdCopy';
import { myHomesQuery, MY_HOMES_FRESH_MS } from '@/lib/myHomes';

export type PrimaryHomeReply = Awaited<ReturnType<typeof api.homes.getPrimaryHome>>;

// The source list can already be a minute old. Keep this derived entry for
// at most another minute so its total age stays within the two-minute contract.
export const PRIMARY_HOME_FRESH_MS = MY_HOMES_FRESH_MS;

const showsPrimaryCopy = (reply: PrimaryHomeReply): boolean => showsPrimaryHomeCopy(reply);

async function readPrimaryHome({ client }: QueryFunctionContext): Promise<PrimaryHomeReply> {
  // Use this query's session client, including while an account switch retires
  // it. Concurrent shell/Place reads share the same in-flight list request.
  const reply = await client.fetchQuery(myHomesQuery());
  if (reply.primary_home !== undefined) return { home: reply.primary_home };
  // Backward compatible with a web deploy that precedes the backend deploy.
  // A failed list read must still fail closed, rather than bypass its recheck.
  return api.homes.getPrimaryHome();
}

export function primaryHomeQuery() {
  return {
    queryKey: queryKeys.placePrimaryHome(), queryFn: readPrimaryHome,
    // The source query already retries; don't multiply its attempts here.
    retry: false,
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

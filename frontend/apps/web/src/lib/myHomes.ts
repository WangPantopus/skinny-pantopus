'use client';

// ============================================================
// Your homes (GET /api/homes/my-homes): one cache entry shared by Place, the
// Place switcher in the app shell (ProfileToggle) and My Homes (/app/homes),
// so they read it once and show the same list. Fresh for a minute (within the
// contract's 2 minutes for Homes and household); the `homes` change signal
// marks it out of date.
// ============================================================

import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

export type MyHomesReply = Awaited<ReturnType<typeof api.homes.getMyHomes>>;

export const MY_HOMES_FRESH_MS = 60 * 1000;

export function myHomesQuery() {
  return { queryKey: queryKeys.placeMyHomes(), queryFn: () => api.homes.getMyHomes(), staleTime: MY_HOMES_FRESH_MS };
}

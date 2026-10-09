'use client';

// ============================================================
// Your own profile: one cache entry for GET /api/users/profile.
//
// Screens read it with useMe(); effects, handlers and controllers with
// fetchMe(), which answers from the entry while it is fresh and otherwise
// shares one request. Edits put the server's copy back with setMe() or mark
// it out of date with refreshMe(), so every screen shows the same profile.
// Freshness follows the Instant Screens contract §4 ("You": 10 minutes).
// The entry lives in the session's query client, which sign-out and account
// switches replace (lib/query-provider.tsx).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { activeQueryClient } from '@/lib/active-query-client';

export type Me = Awaited<ReturnType<typeof api.users.getMyProfile>>;

export const ME_FRESH_MS = 10 * 60 * 1000;

function meQuery() {
  return { queryKey: queryKeys.me(), queryFn: () => api.users.getMyProfile(), staleTime: ME_FRESH_MS };
}

/** The signed-in account's profile, shown at once when it was loaded before. */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({ ...meQuery(), ...options });
}

/** The profile for code outside rendering: the cached copy while fresh, else one shared request. */
export function fetchMe(): Promise<Me> {
  const client = activeQueryClient();
  return client ? client.fetchQuery(meQuery()) : api.users.getMyProfile();
}

/** Puts a profile the server just returned (after an edit) into the entry. */
export function setMe(user: Partial<Me> | null | undefined): void {
  if (!user) return;
  activeQueryClient()?.setQueryData<Me>(queryKeys.me(), (old) => (old ? { ...old, ...user } : (user as Me)));
}

/** Marks the profile out of date after an edit whose reply doesn't carry it; shown screens refetch. */
export function refreshMe(): Promise<void> {
  return activeQueryClient()?.invalidateQueries({ queryKey: queryKeys.me() }) ?? Promise.resolve();
}

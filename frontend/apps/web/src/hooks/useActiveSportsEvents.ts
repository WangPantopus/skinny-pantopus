'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { ActiveSportsEvent } from '@pantopus/api';

/**
 * Loads the list of currently-active major sports events. Used by:
 *   - the Sports mode chip row (dynamic label for the "event" chip)
 *   - the Sports event module card above the feed
 *   - the composer (default event_key when posting under Sports > Event)
 *
 * The active-events set changes on a human-perceptible schedule (days/weeks),
 * so we cache for 5 minutes and only refetch in the background. `enabled`
 * lets callers opt in only when the Sports lane is visible, so non-sports
 * users pay nothing.
 */
export function useActiveSportsEvents(enabled: boolean) {
  const query = useQuery({
    queryKey: ['sports', 'active-events'],
    queryFn: async () => api.posts.getActiveSportsEvents(),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return {
    events: (query.data?.events ?? []) as ActiveSportsEvent[],
    primaryEvent: (query.data?.primaryEvent ?? null) as ActiveSportsEvent | null,
    loading: query.isLoading,
    error: query.error,
  };
}

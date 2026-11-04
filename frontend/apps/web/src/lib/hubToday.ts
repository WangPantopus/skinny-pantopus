import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

// Today (/app/today and /app/hub/today), the Hub's Today card and the sidebar
// share the briefing's two-minute window. Hovering or focusing the tab must
// not shorten the page's cache lifetime.
export function hubTodayQuery() {
  return {
    queryKey: queryKeys.hubToday(),
    queryFn: () => api.hub.getHubToday({ retries: 1, retryDelayMs: 800 }),
    staleTime: 120_000,
  };
}

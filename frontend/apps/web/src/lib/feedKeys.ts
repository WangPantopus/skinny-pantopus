// The Pulse feed's cache keys and page size: shared by the browser's feed
// (hooks/useFeedData.ts) and the server's first content (lib/server).
import { queryKeys } from '@/lib/query-keys';

export const FEED_PAGE_SIZE = 20;

/** The viewed area in a feed's key; only the Place surface has one. */
export function feedLocationKey(surface: string, latitude: number | null, longitude: number | null, radiusMiles: number | null): string {
  if (surface !== 'place') return 'na';
  if (latitude == null || longitude == null) return 'nogeo';
  return `${latitude.toFixed(4)},${longitude.toFixed(4)},${radiusMiles ?? 100}`;
}

// The full query key with location + topic/mode params so different
// lanes produce different cache entries. Location only applies to `place`;
// topic/sportsMode/eventKey only apply when the Sports lane is active.
export function buildFeedKey(
  surface: string,
  filter: string,
  locationKey: string,
  topic: string | null,
  sportsMode: string | null,
  eventKey: string | null,
) {
  return [
    ...queryKeys.feed(surface, filter),
    locationKey,
    topic ?? 'none',
    topic === 'sports' ? (sportsMode ?? 'for_you') : 'na',
    topic === 'sports' ? (eventKey ?? 'none') : 'na',
  ] as const;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

// The Map page's placeholder centre ("Camas, WA"). It stays the fallback for a
// Home without a stored location, so the Map renders exactly as before.
const FALLBACK_CENTER = { lat: 45.5945, lng: -122.4065 };

/**
 * The user's Home for the mailbox Home pages (records, map, community, tasks,
 * travel). Each page used to return a hard-coded `homeId: 'home_1'`.
 *
 * It reads the same primary-Home query the Place screens use (same query key,
 * so the cache is shared). `useViewerHome` doesn't fit: it drops a Home that
 * has no stored coordinates, and these pages need the Home id regardless.
 */
export default function useMailboxHome() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    staleTime: 60_000,
  });
  const home = data?.home ?? null;
  const coordinates = home?.location?.coordinates; // PostGIS order: [lng, lat]
  const place = [home?.city, home?.state].filter(Boolean).join(', ');
  return {
    isLoading,
    isError,
    refetch,
    homeId: home?.id ?? '',
    lat: Array.isArray(coordinates) ? coordinates[1] : FALLBACK_CENTER.lat,
    lng: Array.isArray(coordinates) ? coordinates[0] : FALLBACK_CENTER.lng,
    address: place,
    neighborhood: place,
  };
}

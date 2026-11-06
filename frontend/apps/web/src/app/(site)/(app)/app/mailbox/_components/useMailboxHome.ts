'use client';

import { usePrimaryHome } from '@/lib/primaryHome';

/**
 * The user's Home for the mailbox Home pages (records, map, community, tasks,
 * travel). Each page used to return a hard-coded `homeId: 'home_1'`.
 *
 * It reads the same primary-Home query the Place screens use (same query key,
 * so the cache is shared). `useViewerHome` doesn't fit: it drops a Home that
 * has no stored coordinates, and these pages need the Home id regardless.
 */
export default function useMailboxHome() {
  const { data, isLoading, isError, refetch } = usePrimaryHome();
  const home = data?.home ?? null;
  const location = home?.location as { latitude?: number; longitude?: number; coordinates?: number[] } | null;
  const lat = location?.latitude ?? location?.coordinates?.[1];
  const lng = location?.longitude ?? location?.coordinates?.[0];
  const hasLocation = typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const place = [home?.city, home?.state].filter(Boolean).join(', ');
  return {
    isLoading,
    isError,
    refetch,
    homeId: home?.id ?? '',
    lat: hasLocation ? lat : null,
    lng: hasLocation ? lng : null,
    address: place,
    neighborhood: place,
  };
}

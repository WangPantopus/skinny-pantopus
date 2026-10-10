'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAuthToken } from '@pantopus/api';
import { usePrimaryHome } from '@/lib/primaryHome';

export interface ViewerHome {
  homeId: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
}

/**
 * Resolve the authenticated user's primary home for discovery APIs, from the
 * shared primary-home entry (lib/primaryHome.ts).
 *
 * Returns:
 *   viewerHome — the primary home with lat/lng & id, or null
 *   loading    — true while fetching
 *   hasHome    — shorthand: viewerHome !== null
 */
export default function useViewerHome() {
  // The session cookie is readable only in the browser, so the server render
  // and the first client render agree on "loading" until mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!getAuthToken();
  const query = usePrimaryHome({ enabled: signedIn });
  const home = query.data?.home ?? null;

  const viewerHome = useMemo<ViewerHome | null>(() => {
    // Home list endpoints return a parsed point; older replies used GeoJSON.
    const location = home?.location as {
      latitude?: number;
      longitude?: number;
      coordinates?: [number, number];
    } | null | undefined;
    const lat = location?.latitude ?? location?.coordinates?.[1];
    const lng = location?.longitude ?? location?.coordinates?.[0];
    if (!home || typeof lat !== 'number' || typeof lng !== 'number'
      || !Number.isFinite(lat) || !Number.isFinite(lng)
      || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { homeId: home.id, lat, lng, address: home.address, city: home.city, state: home.state };
  }, [home]);

  // Non-critical: a failed read just means no neighbor trust data.
  return { viewerHome, loading: !mounted || (signedIn && query.isPending), hasHome: viewerHome !== null };
}

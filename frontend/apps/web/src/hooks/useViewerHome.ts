'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Home } from '@pantopus/types';

export interface ViewerHome {
  homeId: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
}

/**
 * Resolve the authenticated user's primary home for discovery APIs.
 *
 * Returns:
 *   viewerHome — the primary home with lat/lng & id, or null
 *   loading    — true while fetching
 *   hasHome    — shorthand: viewerHome !== null
 */
export default function useViewerHome() {
  const [viewerHome, setViewerHome] = useState<ViewerHome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const token = getAuthToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await api.homes.getPrimaryHome();
        const home: Home | null = res?.home ?? null;

        if (cancelled) return;

        if (home && home.location?.coordinates) {
          // PostGIS stores as [lng, lat]
          const [lng, lat] = home.location.coordinates;
          setViewerHome({
            homeId: home.id,
            lat,
            lng,
            address: home.address,
            city: home.city,
            state: home.state,
          });
        }
      } catch {
        // Non-critical — viewer just won't see neighbor trust data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, []);

  return { viewerHome, loading, hasHome: viewerHome !== null };
}

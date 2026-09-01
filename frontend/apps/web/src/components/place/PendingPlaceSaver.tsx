// ============================================================
// PendingPlaceSaver — the funnel's terminal step.
//
// After a stranger registers from the /start wall, they land on
// /app/place. If a place was stashed before sign-up, save it once now
// (api.savedPlaces) — this is where "registering saves the place"
// actually happens. Renders nothing.
// ============================================================

'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { queryKeys } from '@/lib/query-keys';
import { takePendingPlace } from './pendingPlace';

export default function PendingPlaceSaver() {
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!getAuthToken()) return; // authed only
    const pending = takePendingPlace();
    if (!pending) return;
    ranRef.current = true; // consume once per mount

    api.savedPlaces
      .create({
        label: pending.label,
        latitude: pending.latitude,
        longitude: pending.longitude,
        city: pending.city,
        state: pending.state,
      })
      .then(() => {
        toast.success('Place saved.');
        queryClient.invalidateQueries({ queryKey: queryKeys.placePrimaryHome() });
      })
      .catch(() => {
        // Non-fatal: the place can be claimed later from the dashboard.
      });
  }, [queryClient]);

  return null;
}

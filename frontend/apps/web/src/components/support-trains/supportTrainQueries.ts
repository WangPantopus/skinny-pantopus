'use client';

// Support Trains in the session's query cache (Instant Screens contract §4:
// a train and its slots are fresh for 1 minute). The list keeps one entry per
// role tab and each train one entry with, for its organizers, the signups.
// Anything that changes a train marks every Support Train entry out of date.

import type { QueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

export const SUPPORT_TRAIN_FRESH_MS = 60 * 1000;

export interface SupportTrainView {
  train: any;
  /** The signups, for organizers; empty for everyone else. */
  reservations: any[];
  /** Why the signups could not be read (the train itself loaded). */
  reservationError: string | null;
}

async function loadSupportTrain(id: string): Promise<SupportTrainView> {
  const train = await api.supportTrains.getSupportTrain(id) as any;
  if (train?.viewer_level !== 'organizer') return { train, reservations: [], reservationError: null };
  try {
    const res = await api.supportTrains.listReservations(id);
    return { train, reservations: res.reservations || [], reservationError: null };
  } catch (err: any) {
    return { train, reservations: [], reservationError: err?.message || 'Failed to load signups' };
  }
}

export function supportTrainQuery(id: string) {
  return {
    queryKey: queryKeys.supportTrain(id),
    queryFn: () => loadSupportTrain(id),
    // Signups that failed to load are asked again on the next visit.
    staleTime: (query: { state: { data?: SupportTrainView } }) =>
      (query.state.data?.reservationError ? 0 : SUPPORT_TRAIN_FRESH_MS),
  };
}

/** After a change to a train: shown entries refresh now, the rest on their next visit. */
export function refreshSupportTrains(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.supportTrains() });
}

/** After a train is deleted: it leaves the kept lists at once, and its own entry goes. */
export function forgetSupportTrain(queryClient: QueryClient, id: string): Promise<void> {
  queryClient.removeQueries({ queryKey: queryKeys.supportTrain(id) });
  queryClient.setQueriesData<{ support_trains?: Array<{ id: string }>; total?: number }>(
    { queryKey: queryKeys.supportTrainLists() },
    (old) => {
      if (!old?.support_trains?.some((train) => train.id === id)) return old;
      return { ...old, support_trains: old.support_trains.filter((train) => train.id !== id), total: Math.max(0, (old.total ?? 1) - 1) };
    },
  );
  return refreshSupportTrains(queryClient);
}

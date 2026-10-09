'use client';

// Founder decision 3 (Instant Screens contract §5, Household tier): owners and
// household members see the last copy of a Home screen while their access is
// checked again; guests, service providers and anyone whose access ends see
// the screen blank until the server answers. The copy stays in this tab's
// memory either way; these gates decide whether it may show before the
// re-check, and make every visit re-check one that may not. Same rules as iOS
// (MyHome.showsCopyBeforeRecheck, PlaceStoreReads.showsBeforeRecheck). The Home
// dashboard applies its own (components/home/homeDashboardCopy.ts).

import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { MyHome } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

/** The Place reads' fresh window (a home's facts for the viewer's role). */
export const PLACE_FRESH_MS = 60_000;

const NOT_HOUSEHOLD = new Set(['guest', 'service_provider', 'nonresident']);
const PLACE_HOUSEHOLD = new Set(['owner', 'renter', 'member']);

/** One of your homes is an owner's or household member's, with no end date. */
export function showsHomeCopy(home: MyHome): boolean {
  const role = (home.role_base ?? home.occupancy?.role_base ?? home.occupancy?.role ?? '').toLowerCase();
  return !NOT_HOUSEHOLD.has(role) && home.occupancy?.end_at == null;
}

/** Your homes list shows before its re-check only when every home on it may. */
export function showsMyHomesCopy(reply: { homes?: MyHome[] } | null | undefined): boolean {
  return !!reply && (reply.homes ?? []).every(showsHomeCopy);
}

/** A Place read shows before its re-check only to the home's owner, renter or household member. */
export function showsPlaceCopy(intelligence: { viewer?: { role?: string | null } | null } | null | undefined): boolean {
  return PLACE_HOUSEHOLD.has(intelligence?.viewer?.role ?? '');
}

/** A home's own pages (Property Details) follow its row on your kept homes list. */
export function showsHouseholdHomeCopy(client: QueryClient, homeId: string): boolean {
  const home = client.getQueryData<{ homes?: MyHome[] }>(queryKeys.placeMyHomes())?.homes?.find((h) => h.id === homeId);
  return !!home && showsHomeCopy(home);
}

/** A query's fresh window under a gate: a copy that may not show is always due, so each visit asks again. */
export function gatedStaleTime<T>(freshMs: number, shows: (data: T) => boolean) {
  return (query: { state: { data: T | undefined } }) =>
    (query.state.data === undefined || shows(query.state.data) ? freshMs : 0);
}

/**
 * What a screen may show of a query's data: a copy that may show, or an answer read since the screen
 * opened. `waiting` is true while a copy that may not show is being checked again.
 */
export function useAfterRecheck<T>(
  query: { data: T | undefined; dataUpdatedAt: number; isFetching: boolean },
  shows: (data: T) => boolean,
): { data: T | undefined; waiting: boolean } {
  const [openedAt] = useState(() => Date.now());
  const { data, dataUpdatedAt, isFetching } = query;
  const shown = data !== undefined && (shows(data) || dataUpdatedAt >= openedAt) ? data : undefined;
  return { data: shown, waiting: data !== undefined && shown === undefined && isFetching };
}

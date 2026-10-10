'use client';

// Founder decision 3 (Instant Screens contract §5, Household tier): owners and
// household members see the last copy of a Home screen while their access is
// checked again; guests, service providers and anyone whose access ends see
// the screen blank until the server answers. The copy stays in this tab's
// memory either way; these gates decide whether it may show before the
// re-check, and make every visit re-check one that may not. Same rules as iOS
// (MyHome.showsCopyBeforeRecheck, PlaceStoreReads.showsBeforeRecheck). The Home
// dashboard applies its own (components/home/homeDashboardCopy.ts).

import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { MyHome } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

/** The Place reads' fresh window (a home's facts for the viewer's role). */
export const PLACE_FRESH_MS = 60_000;

const HOUSEHOLD = new Set(['owner', 'admin', 'manager', 'lease_resident', 'member', 'restricted_member']);
const PLACE_HOUSEHOLD = new Set(['owner', 'renter', 'member']);

type HomeCopyContext = Pick<MyHome, 'occupancy' | 'access_kind' | 'has_home_access' | 'role_base' | 'can_delete_home'>;

/** One of your homes is an owner's or household member's, with no end date. */
export function showsHomeCopy(home: HomeCopyContext): boolean {
  if (home.occupancy?.end_at != null || home.occupancy?.access_end_at != null
    || typeof home.can_delete_home !== 'boolean') return false;
  if (home.access_kind === 'private_setup') return home.has_home_access === false && home.role_base == null;
  return home.access_kind === 'shared' && home.has_home_access === true && HOUSEHOLD.has(home.role_base ?? '');
}

/** Your homes list shows before its re-check only when every home on it may. */
export function showsMyHomesCopy(reply: { homes?: MyHome[] } | null | undefined): boolean {
  return !!reply && (reply.homes ?? []).every(showsHomeCopy);
}

/** A Place read shows before its re-check only to the home's owner, renter or household member. */
export function placeCopyGate(home: MyHome | undefined) {
  return (intelligence: { viewer?: { role?: string | null } | null } | null | undefined): boolean =>
    !!home && showsHomeCopy(home) && PLACE_HOUSEHOLD.has(intelligence?.viewer?.role ?? '');
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
  query: { data: T | undefined; dataUpdatedAt: number; isFetching: boolean; refetch?: () => Promise<unknown> },
  shows: (data: T) => boolean,
): { data: T | undefined; waiting: boolean } {
  const [visit, setVisit] = useState(() => ({ openedAt: Date.now(), hidden: false }));
  const latest = useRef({ query, shows });
  latest.current = { query, shows };
  const needsRecheck = useRef(false);
  useEffect(() => {
    const leave = () => {
      const { query: current, shows: allows } = latest.current;
      if (needsRecheck.current || (current.data !== undefined && allows(current.data))) return;
      needsRecheck.current = true;
      setVisit({ openedAt: Date.now(), hidden: true });
    };
    const resume = () => {
      if (!needsRecheck.current || document.visibilityState === 'hidden') return;
      needsRecheck.current = false;
      setVisit({ openedAt: Date.now(), hidden: false });
      void latest.current.query.refetch?.();
    };
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); else resume(); };
    window.addEventListener('blur', leave);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const { data, dataUpdatedAt, isFetching } = query;
  const shown = !visit.hidden && data !== undefined
    && (shows(data) || dataUpdatedAt >= visit.openedAt) ? data : undefined;
  return { data: shown, waiting: data !== undefined && shown === undefined && isFetching };
}

'use client';

// Founder decision 3 (Instant Screens contract §5, Household tier): owners and
// household members see the last copy of a Home screen while their access is
// checked again; guests, service providers and anyone whose access ends see
// the screen blank until the server answers. The copy stays in this tab's
// memory either way; these gates decide whether it may show before the
// re-check, and make every visit re-check one that may not. Same rules as iOS
// (MyHome.showsCopyBeforeRecheck, PlaceStoreReads.showsBeforeRecheck). The Home
// dashboard applies its own (components/home/homeDashboardCopy.ts).
// Founder, 2026-10-27: a Home you have asked to claim or join (still in
// verification) is your own request, so your homes list shows it like your
// homes (iOS MyHome.showsInListBeforeRecheck). A Home's own screens don't change.

import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { MyHome } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { showsHomeCopy } from '@/lib/householdCopyRules';

// The rules themselves are plain functions the server's first content applies too.
export { placeCopyGate, showsHomeCopy, showsMyHomesCopy, showsPrimaryCopy } from '@/lib/householdCopyRules';

/** The Place reads' fresh window (a home's facts for the viewer's role). */
export const PLACE_FRESH_MS = 60_000;

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
  query: { data: T | undefined; dataUpdatedAt: number; isFetching: boolean; isEnabled?: boolean; refetch?: () => Promise<unknown> },
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
      // refetch() runs even a disabled query. One that holds nothing has nothing to check again, and its
      // key may be a placeholder (Place with no home would ask for /api/homes/null/intelligence).
      const { query: current } = latest.current;
      if (current.isEnabled !== false || current.data !== undefined) void current.refetch?.();
    };
    // Leaving means the page is hidden. A window that only loses focus (another app beside it, the
    // address bar, DevTools) still shows the screen, so what it shows stays.
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); else resume(); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const { data, dataUpdatedAt, isFetching } = query;
  const shown = !visit.hidden && data !== undefined
    && (shows(data) || dataUpdatedAt >= visit.openedAt) ? data : undefined;
  return { data: shown, waiting: data !== undefined && shown === undefined && isFetching };
}

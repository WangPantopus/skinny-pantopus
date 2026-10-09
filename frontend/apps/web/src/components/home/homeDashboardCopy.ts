'use client';

// A Home's dashboard as you last saw it, kept in this session's query cache
// (memory only), so coming back shows it at once while your access is checked
// again behind it (Instant Screens decision 3, contract §5).
//
// Only owners and household roles whose access has no end date get a copy.
// Guests, service providers and any access that ends load blank and re-check,
// as before. The sensitive parts (access codes and Wi-Fi, emergency info,
// documents, bills) are never in a copy: they are always read again first.
// The copy holds the access it was shown with, so the permissions provider and
// the dashboard start from the same answer; a changed or refused access on the
// re-check reloads the page in full.

import type { QueryClient } from '@tanstack/react-query';
import type * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

type HomeAccess = api.homeIam.HomeAccess;

const HOUSEHOLD_ROLES = new Set(['owner', 'admin', 'manager', 'lease_resident', 'member', 'restricted_member']);

/** Whether this access may see its Home from a copy before the re-check. */
export function keepsHomeCopy(access: HomeAccess | null | undefined): access is HomeAccess {
  return !!access && access.hasAccess === true && access.verification_status === 'verified'
    && access.verification_required !== true && access.access_expires_at == null && access.occupancy?.end_at == null
    && HOUSEHOLD_ROLES.has(access.effective_role_base ?? access.role_base ?? '');
}

export interface HomeDashboardCopy<State> {
  /** The access read with the records, as the server returned it. */
  access: HomeAccess;
  /** What the dashboard showed, without the sensitive parts. */
  state: State;
}

export function readHomeDashboardCopy<State>(client: QueryClient, homeId: string): HomeDashboardCopy<State> | null {
  const copy = client.getQueryData<HomeDashboardCopy<State>>(queryKeys.homeDashboard(homeId));
  return copy && keepsHomeCopy(copy.access) ? copy : null;
}

export function keepHomeDashboardCopy<State>(client: QueryClient, homeId: string, copy: HomeDashboardCopy<State>): void {
  client.setQueryData(queryKeys.homeDashboard(homeId), copy);
}

/** Drops the copy and the summary cards kept with it. */
export function dropHomeDashboardCopy(client: QueryClient, homeId: string): void {
  client.removeQueries({ queryKey: queryKeys.homeDashboard(homeId) });
}

// The dashboard's summary cards (health, checklist, property, activity) are kept beside the copy and
// go with it. Bill trends are never kept (contract §5: bills are sensitive).
export type HomeSummaryName = 'health' | 'checklist' | 'property' | 'timeline';

/** A summary card as last shown and when it was read, only while the dashboard's copy is kept. */
export function readHomeSummaryCopy<T>(client: QueryClient, homeId: string, name: HomeSummaryName): { data: T; at: number } | null {
  if (!readHomeDashboardCopy(client, homeId)) return null;
  const key = queryKeys.homeSummary(homeId, name);
  const data = client.getQueryData<T>(key);
  return data == null ? null : { data, at: client.getQueryState(key)?.dataUpdatedAt ?? 0 };
}

export function keepHomeSummaryCopy<T>(client: QueryClient, homeId: string, name: HomeSummaryName, data: T): void {
  client.setQueryData(queryKeys.homeSummary(homeId, name), data);
}

export function dropHomeSummaryCopy(client: QueryClient, homeId: string, name: HomeSummaryName): void {
  client.removeQueries({ queryKey: queryKeys.homeSummary(homeId, name), exact: true });
}

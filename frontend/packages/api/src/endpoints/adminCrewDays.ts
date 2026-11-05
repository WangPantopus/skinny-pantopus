// ============================================================
// CREW DAY OPERATOR ENDPOINTS (launch cut #13)
// docs/product/crew-day-build/02-contract.md §4 "Operator": admins only (403
// NOT_OPERATOR otherwise), and 403 CREW_DAY_UNAVAILABLE while `crew_day` is off.
// ============================================================

import { get, post } from '../client';
import type {
  AdminCrewDayBooking,
  AdminCrewDayDetail,
  AdminCrewDayList,
  AdminCrewDayRequest,
  AdminCrewDayTab,
  CrewDayCrewView,
} from '@pantopus/types';

const BASE = '/api/admin/crew-days';

/** Screens 20, 22, 23: one tab's items and every tab's count. */
export function list(tab: AdminCrewDayTab) {
  return get<AdminCrewDayList>(BASE, { tab });
}

/** Screen 21: the day with every booking and event (records the operator's visit), or a street request. */
export function getDay(crewDayId: string) {
  return get<AdminCrewDayDetail>(`${BASE}/${encodeURIComponent(crewDayId)}`);
}

export function approve(crewDayId: string, note?: string) {
  return post<{ crew_day: CrewDayCrewView }>(`${BASE}/${encodeURIComponent(crewDayId)}/approve`, note ? { note } : {});
}

/** The note is required and goes to the crew. */
export function decline(crewDayId: string, note: string) {
  return post<{ crew_day: CrewDayCrewView }>(`${BASE}/${encodeURIComponent(crewDayId)}/decline`, { note });
}

/** Cancels the whole day for its crew; homes not yet worked on end free. */
export function cancel(crewDayId: string, reason: string) {
  return post<{ crew_day: CrewDayCrewView }>(`${BASE}/${encodeURIComponent(crewDayId)}/cancel`, { reason });
}

/** A problem: a note to the household, release the charge, refund (all or, before the charge, part), or resolve. */
export function problemAction(
  bookingId: string,
  data: { action: 'note' | 'release' | 'refund' | 'resolve'; amount_cents?: number; note?: string },
) {
  return post<{ booking: AdminCrewDayBooking }>(`${BASE}/bookings/${encodeURIComponent(bookingId)}/problem`, data);
}

/** A street request: an open Crew Day reaches it ("Offer ready"), or "No crew yet" with a note. */
export function answerRequest(
  requestId: string,
  data: { action: 'offer_ready'; crew_day_id: string; note?: string } | { action: 'no_crew'; note: string },
) {
  return post<{ request: AdminCrewDayRequest }>(`${BASE}/requests/${encodeURIComponent(requestId)}`, data);
}

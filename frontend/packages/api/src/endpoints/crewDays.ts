// ============================================================
// CREW DAY ENDPOINTS (launch cut #13)
// docs/product/crew-day-build/02-contract.md §4. Every route answers 403
// CREW_DAY_UNAVAILABLE while the server's `crew_day` key is off. Reads answer
// the object itself; writes that change one booking answer `{ booking }`.
// ============================================================

import { get, post } from '../client';
import type {
  CreateCrewDayBookingRequest,
  CrewDayBookingPage,
  CrewDayQuote,
  CrewDayQuoteRequest,
  PublicCrewDay,
} from '@pantopus/types';

const BASE = '/api/crew-days';

// ─── Public (no account) ─────────────────────────────────────────────────

/** The invitation: counts only; `viewer` when signed in. */
export function getPublicCrewDay(code: string) {
  return get<PublicCrewDay>(`${BASE}/public/${encodeURIComponent(code)}`);
}

/** One home's price, and whether the day reaches it. */
export function quote(code: string, data: CrewDayQuoteRequest) {
  return post<CrewDayQuote>(`${BASE}/public/${encodeURIComponent(code)}/quote`, data);
}

// ─── Household ───────────────────────────────────────────────────────────

/** Books a home (`booked`, or `price_pending` for an option the crew confirms after a look). */
export function createBooking(crewDayId: string, data: CreateCrewDayBookingRequest) {
  return post<{ booking: CrewDayBookingPage }>(`${BASE}/${encodeURIComponent(crewDayId)}/bookings`, data);
}

/** The household's booking page (screen 5). */
export function getBooking(bookingId: string) {
  return get<CrewDayBookingPage>(`${BASE}/bookings/${encodeURIComponent(bookingId)}`);
}

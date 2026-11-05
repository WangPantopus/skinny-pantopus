// ============================================================
// CREW DAY ENDPOINTS (launch cut #13)
// docs/product/crew-day-build/02-contract.md §4. Every route answers 403
// CREW_DAY_UNAVAILABLE while the server's `crew_day` key is off. Reads answer
// the object itself; writes that change one booking answer `{ booking }`.
// ============================================================

import { get, patch, post } from '../client';
import type {
  CreateCrewDayBookingRequest,
  CreateCrewDayRequestRequest,
  CrewDayBookingPage,
  CrewDayBusiness,
  CrewDayCrewView,
  CrewDayForm,
  CrewDayHome,
  CrewDayMine,
  CrewDayQuote,
  CrewDayQuoteRequest,
  CrewDayRequestCard,
  CrewDayRoute,
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

type BookingReply = Promise<{ booking: CrewDayBookingPage }>;
const booking = (bookingId: string) => `${BASE}/bookings/${encodeURIComponent(bookingId)}`;

/** Your Crew Days (screen 10): coming up, asked for, done. */
export function getMine() {
  return get<CrewDayMine>(`${BASE}/mine`);
}

/** The note for the crew, the option and add-ons (before the cutoff; re-priced), or "Remind me next fall". */
export function updateBooking(
  bookingId: string,
  data: { access_note?: string; option_id?: string; add_on_ids?: string[]; remind_next_season?: boolean },
): BookingReply {
  return patch(booking(bookingId), data);
}

/** Free until the cutoff; after it the server answers 409 ASK_THE_CREW. */
export function cancelBooking(bookingId: string): BookingReply {
  return post(`${booking(bookingId)}/cancel`, {});
}

/** After the cutoff: asks the crew to release the home at no charge. */
export function askRelease(bookingId: string): BookingReply {
  return post(`${booking(bookingId)}/ask-release`, {});
}

/** Approve or decline the crew's price after its look. */
export function answerPrice(bookingId: string, approve: boolean): BookingReply {
  return post(`${booking(bookingId)}/price-answer`, { approve });
}

/** "Gate is ready" on the day. */
export function gateReady(bookingId: string): BookingReply {
  return post(`${booking(bookingId)}/gate-ready`, {});
}

/** "Everything looks good": charges now. */
export function confirmDone(bookingId: string): BookingReply {
  return post(`${booking(bookingId)}/confirm`, {});
}

/** Picks one of the crew's new dates, or cancels at no charge. */
export function answerNewDate(bookingId: string, proposalId: string, choice: string): BookingReply {
  return post(`${booking(bookingId)}/new-date`, { proposal_id: proposalId, choice });
}

/** "Something needs attention": opens the case (the charge pauses); a second call adds a note or photos. */
export function reportProblem(
  bookingId: string,
  data: { kind?: 'missed' | 'damage' | 'no_show' | 'charge' | 'other'; note: string; photo_paths: string[] },
): BookingReply {
  return post(`${booking(bookingId)}/problem`, data);
}

/** "Ask for a Crew Day on my street": a service for the street of one of my homes (default: the first). */
export function createRequest(data: CreateCrewDayRequestRequest) {
  return post<{ request: CrewDayRequestCard }>(`${BASE}/requests`, data);
}

/** A photo for a problem (household) or a finished home (crew): JPEG, PNG or HEIC up to 10 MB → its stored path. */
export function uploadPhoto(bookingId: string, purpose: 'problem' | 'done', photo: File) {
  const form = new FormData();
  form.append('photo', photo);
  form.append('booking_id', bookingId);
  form.append('purpose', purpose);
  // Without the multipart type the client's JSON default turns the form into JSON and drops the file.
  return post<{ path: string }>(`${BASE}/uploads`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Up to 10 MB going up on a phone's connection.
    timeout: 60000,
  });
}

// ─── Crew (any member reads; owners and editors change) ─────────────────

type DayReply = Promise<{ crew_day: CrewDayCrewView }>;
const day = (crewDayId: string) => `${BASE}/${encodeURIComponent(crewDayId)}`;

/** The dashboard's Crew Days tab (screen 13): readiness, the fee, the services, and the days by section. */
export function getBusinessCrewDays(businessId: string) {
  return get<CrewDayBusiness>(`${BASE}/business/${encodeURIComponent(businessId)}`);
}

/** New Crew Day (screen 14): a draft, or sent for the operator's approval with `submit: true`. */
export function createCrewDay(data: CrewDayForm & { business_id: string }): DayReply {
  return post(BASE, data);
}

/** Edits what `editable_fields` allows (every field until the day opens). */
export function updateCrewDay(crewDayId: string, data: Partial<CrewDayForm>): DayReply {
  return patch(day(crewDayId), data);
}

/** A draft or declined day → waiting for the operator. */
export function submitCrewDay(crewDayId: string): DayReply {
  return post(`${day(crewDayId)}/submit`, {});
}

/** The crew's day (screens 15, 18, 19): the form, money, homes, what needs the crew, the timeline. */
export function getCrewDay(crewDayId: string) {
  return get<CrewDayCrewView>(`${day(crewDayId)}/crew`);
}

/** A look-first home: its price, or "Can't take it" with a note. */
export function priceHome(crewDayId: string, bookingId: string, data: { price_cents: number } | { decline: true; note: string }) {
  return post<{ booking: CrewDayHome }>(`${day(crewDayId)}/bookings/${encodeURIComponent(bookingId)}/price`, data);
}

/** Releases a home not yet started at no charge (a household's ask, or the crew's own call). */
export function releaseHome(crewDayId: string, bookingId: string) {
  return post<{ booking: CrewDayHome }>(`${day(crewDayId)}/bookings/${encodeURIComponent(bookingId)}/release`, {});
}

/** Invites households this business served nearby, once each. */
export function invitePastCustomers(crewDayId: string) {
  return post<{ invited: number }>(`${day(crewDayId)}/invite-past`, {});
}

/** Rain: 2–3 new dates; every booked home picks one or cancels free. */
export function proposeDates(crewDayId: string, data: { dates: Array<{ date: string; window_start: string; window_end: string }>; note?: string }): DayReply {
  return post(`${day(crewDayId)}/propose-dates`, data);
}

/** Cancels the whole day; homes not yet worked on end free. */
export function cancelCrewDay(crewDayId: string, reason: string): DayReply {
  return post(`${day(crewDayId)}/cancel`, { reason });
}

/** The route for one of the day's dates (the first from today without `date`). */
export function getRoute(crewDayId: string, date?: string) {
  return get<CrewDayRoute>(`${day(crewDayId)}/route`, date ? { date } : undefined);
}

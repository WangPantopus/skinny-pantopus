// ============================================================
// CALENDARLY PUBLIC BOOKING ENDPOINTS (unauthed / optionalAuth)
// Mounted at /api/public — the invitee-facing booking flow.
//
// slug      = the booking PAGE slug (NOT a booking id)
// :token    = manage token (returned ONCE on create — persist it) or
//             one-off link token
//
// 409 conflicts ({ error, message, alternatives }) are rejected by the
// shared axios interceptor; the thrown error carries the raw body on
// `.data`. Use the W0 `decodeError` helper to extract a typed SlotConflict.
//
// See reference/calendarly-backend-api.md for exact request/response shapes.
// ============================================================

import { get, post } from "../client";
import type {
  PublicBookingPage,
  PublicSlotsResponse,
  PublicOneOff,
  PublicBookingInput,
  PublicBookingSummary,
  CreatePublicBookingResult,
  BookingManageView,
  BookingSlot,
  Booking,
  PublicWaitlistInput,
  PollDetail,
  PollVoteInput,
} from "@pantopus/types";

const PUBLIC = "/api/public";

// ─── Booking page (public read) ─────────────────────────────

/** GET /public/book/:slug — the page shell + public event types. */
export function getPublicPage(slug: string, tz?: string) {
  return get<PublicBookingPage>(
    `${PUBLIC}/book/${encodeURIComponent(slug)}`,
    tz ? { tz } : undefined,
  );
}

/** GET /public/book/:slug/:eventTypeSlug/slots — availability (fetch client-side, no-store). */
export function getPublicSlots(
  slug: string,
  eventTypeSlug: string,
  params: { from: string; to: string; tz?: string },
) {
  return get<PublicSlotsResponse>(
    `${PUBLIC}/book/${encodeURIComponent(slug)}/${encodeURIComponent(eventTypeSlug)}/slots`,
    params,
  );
}

/** POST /public/book/:slug/:eventTypeSlug — create. Persist the returned manageToken. */
export function createPublicBooking(
  slug: string,
  eventTypeSlug: string,
  body: PublicBookingInput,
) {
  return post<CreatePublicBookingResult>(
    `${PUBLIC}/book/${encodeURIComponent(slug)}/${encodeURIComponent(eventTypeSlug)}`,
    body,
  );
}

// ─── One-off links ──────────────────────────────────────────

/** GET /public/book/o/:token — one-off landing (offered slots or computed availability). */
export function getOneOff(
  token: string,
  params?: { tz?: string; from?: string; to?: string },
) {
  return get<PublicOneOff>(
    `${PUBLIC}/book/o/${encodeURIComponent(token)}`,
    params,
  );
}

/** POST /public/book/o/:token — create from a one-off link. Persist the returned manageToken. */
export function createOneOffBooking(token: string, body: PublicBookingInput) {
  return post<CreatePublicBookingResult>(
    `${PUBLIC}/book/o/${encodeURIComponent(token)}`,
    body,
  );
}

// ─── Manage (token-scoped) ──────────────────────────────────

/** GET /public/booking/:token — manage view (status, actions, payment, policy). */
export function getBookingByToken(token: string) {
  return get<BookingManageView>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}`,
  );
}

/** GET /public/booking/:token/available-slots — reschedule slots (excludes current booking). */
export function getManageSlots(
  token: string,
  params: { from: string; to: string; tz?: string },
) {
  return get<{ slots: BookingSlot[] }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/available-slots`,
    params,
  );
}

/** URL for the .ics download (GET /public/booking/:token/ics — text/calendar). */
export function getIcsUrl(token: string): string {
  return `${PUBLIC}/booking/${encodeURIComponent(token)}/ics`;
}

/** Returns the trimmed {id, status, start_at, end_at} — never the full row. */
export function rescheduleByToken(token: string, body: { start_at: string }) {
  return post<{ booking: PublicBookingSummary }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/reschedule`,
    body,
  );
}

/** Returns only {id, status} — the cancel payload carries no times. */
export function cancelByToken(
  token: string,
  body?: { reason?: string | null },
) {
  return post<{ booking: Pick<Booking, "id" | "status"> }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/cancel`,
    body || {},
  );
}

/** One-click unsubscribe from reminder emails (transactional confirmations still sent). */
export function unsubscribeByToken(token: string) {
  return post<{ ok: true }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/unsubscribe`,
    {},
  );
}

/** Returns the trimmed {id, status, start_at, end_at} — never the full row. */
export function acceptReschedule(token: string) {
  return post<{ booking: PublicBookingSummary }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/accept-reschedule`,
    {},
  );
}

/** Returns only {id, status} — the decline payload carries no times. */
export function declineReschedule(token: string) {
  return post<{ booking: Pick<Booking, "id" | "status"> }>(
    `${PUBLIC}/booking/${encodeURIComponent(token)}/decline-reschedule`,
    {},
  );
}

// ─── Waitlist (public) ──────────────────────────────────────

export function joinWaitlistPublic(
  slug: string,
  eventTypeSlug: string,
  body: PublicWaitlistInput,
) {
  return post<{ waitlist: { id: string; status: string } }>(
    `${PUBLIC}/book/${encodeURIComponent(slug)}/${encodeURIComponent(eventTypeSlug)}/waitlist`,
    body,
  );
}

// ─── Polls (public) ─────────────────────────────────────────

export function getPoll(id: string) {
  return get<PollDetail>(`${PUBLIC}/poll/${encodeURIComponent(id)}`);
}

export function votePoll(id: string, body: PollVoteInput) {
  return post<{ ok: true }>(
    `${PUBLIC}/poll/${encodeURIComponent(id)}/vote`,
    body,
  );
}

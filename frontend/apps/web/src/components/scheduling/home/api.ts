// W10-local typed wrappers for the Home Calendar event endpoints
// (`/api/homes/:id/events*`). These live on the home catch-all router — NOT the
// `:homeId/scheduling` mount — so they aren't part of the @pantopus/api
// `scheduling` namespace. homeProfile only ships getHomeEvents/createHomeEvent,
// so the detail/update/delete/rsvp calls are wrapped here using the exported
// low-level client (no shared-seam edit). The UNION read is reused from
// homeProfile.getHomeEvents.

import { get, post, put, del } from "@pantopus/api";
import type { HomeCalendarUnionEvent, RsvpStatus } from "@pantopus/types";

/** Single-event attendee row (GET /events/:eventId). */
export interface HomeEventAttendee {
  user_id: string;
  rsvp_status: RsvpStatus;
  updated_at?: string;
}

export interface HomeEventDetail {
  event: HomeCalendarUnionEvent;
  attendees: HomeEventAttendee[];
}

/** Create/update payload — mirrors the home.js whitelist. */
export interface HomeEventInput {
  event_type: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  location_notes?: string | null;
  recurrence_rule?: string | null;
  assigned_to?: string[] | null;
  alerts_enabled?: boolean;
  request_rsvp?: boolean;
  reminders?: unknown[];
}

const base = (homeId: string) =>
  `/api/homes/${encodeURIComponent(homeId)}/events`;

/** UNION read — HomeCalendarEvent rows + live booking rows (source:'booking'). */
export function listHomeEvents(
  homeId: string,
  range?: { start_after?: string; start_before?: string },
) {
  return get<{ events: HomeCalendarUnionEvent[] }>(base(homeId), range);
}

export function getHomeEventDetail(homeId: string, eventId: string) {
  return get<HomeEventDetail>(`${base(homeId)}/${encodeURIComponent(eventId)}`);
}

export function createHomeEvent(homeId: string, input: HomeEventInput) {
  return post<{ event: HomeCalendarUnionEvent }>(base(homeId), input);
}

export function updateHomeEvent(
  homeId: string,
  eventId: string,
  input: Partial<HomeEventInput>,
) {
  return put<{ event: HomeCalendarUnionEvent }>(
    `${base(homeId)}/${encodeURIComponent(eventId)}`,
    input,
  );
}

export function deleteHomeEvent(homeId: string, eventId: string) {
  return del<{ message: string }>(
    `${base(homeId)}/${encodeURIComponent(eventId)}`,
  );
}

export function rsvpHomeEvent(
  homeId: string,
  eventId: string,
  status: RsvpStatus,
) {
  return post<{ attendee: { user_id: string; rsvp_status: RsvpStatus } }>(
    `${base(homeId)}/${encodeURIComponent(eventId)}/rsvp`,
    { status },
  );
}

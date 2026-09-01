// E6 — Mark no-show: the client-side gate mirroring the backend's
// 409 NOT_APPLICABLE_YET (a no-show can only be marked once the booking's end
// time has passed). Pure so it's unit-testable and so the sheet can disable its
// primary action before the event has ended rather than round-trip a 409.

import type { Booking, BookingDetail } from "@pantopus/types";

type NoShowable = Pick<Booking, "status" | "start_at" | "end_at">;

/** True once the booking has ended and is in a state that can be no-showed. */
export function canMarkNoShow(
  booking: NoShowable,
  now: number = Date.now(),
): boolean {
  if (booking.status !== "confirmed") return false;
  const end = new Date(booking.end_at).getTime();
  if (!Number.isFinite(end)) return false;
  return end <= now;
}

/** Human reason the action is blocked, or null when it's allowed. */
export function noShowBlockedReason(
  booking: NoShowable,
  now: number = Date.now(),
): string | null {
  if (booking.status === "no_show") return "Already marked as a no-show.";
  if (booking.status === "cancelled" || booking.status === "declined")
    return "This booking isn't active.";
  if (booking.status === "pending")
    return "Approve or decline this request first.";
  if (canMarkNoShow(booking, now)) return null;
  return "You can mark a no-show after the booking's end time.";
}

/** A 1:1 booking has a single invitee; group events expose multiple attendees. */
export function isGroupBooking(detail: BookingDetail): boolean {
  return (detail.attendees?.length ?? 0) > 1;
}

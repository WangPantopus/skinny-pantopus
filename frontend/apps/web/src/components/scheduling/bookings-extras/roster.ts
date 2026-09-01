// E8 — Group roster & seats: capacity math derived from a booking's attendees
// and the event type's seat cap. Pure + unit-testable. RSVP status drives the
// seat counts (a declined RSVP frees its seat); the waitlist count comes from
// the event-type waitlist read.

import type { BookingAttendee } from "@pantopus/types";

export interface Capacity {
  /** Configured seats (>= 1). */
  total: number;
  /** Seats currently held (going + maybe + pending — everything but declined). */
  filled: number;
  /** Attendees who said yes. */
  confirmed: number;
  /** Attendees still to respond / tentative. */
  pending: number;
  /** Attendees who declined (seat freed). */
  declined: number;
  /** Free seats. */
  open: number;
  /** Whether every seat is taken. */
  full: boolean;
  /** Fill percentage, clamped 0–100, for the capacity bar. */
  pct: number;
  /** People waiting (from the event-type waitlist). */
  waiting: number;
}

export function computeCapacity(
  attendees: BookingAttendee[],
  seatCap: number,
  waitingCount = 0,
): Capacity {
  const total = Math.max(1, Math.floor(seatCap) || 1);
  let confirmed = 0;
  let pending = 0;
  let declined = 0;
  for (const a of attendees) {
    switch (a.rsvp_status) {
      case "going":
        confirmed++;
        break;
      case "maybe":
      case "pending":
        pending++;
        break;
      case "declined":
        declined++;
        break;
      default:
        pending++;
    }
  }
  const filled = confirmed + pending;
  const open = Math.max(0, total - filled);
  const full = filled >= total;
  const pct = Math.min(100, Math.max(0, Math.round((filled / total) * 100)));
  return {
    total,
    filled,
    confirmed,
    pending,
    declined,
    open,
    full,
    pct,
    waiting: Math.max(0, waitingCount),
  };
}

/** A waitlist entry can be promoted only while a seat is open. */
export function canPromote(capacity: Pick<Capacity, "open">): boolean {
  return capacity.open > 0;
}

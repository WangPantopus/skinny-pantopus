// W8 — Booking lifecycle action state-machine (pure, unit-testable). Drives the
// detail dock + overflow and the inbox quick actions: which actions are valid
// for a given status, and the optimistic status to apply before refetch.

import type { Booking, BookingStatus } from "@pantopus/types";

export type BookingAction =
  | "approve"
  | "decline"
  | "cancel"
  | "reschedule"
  | "reassign"
  | "no_show"
  | "nudge"
  | "message";

/** Status to apply optimistically before the refetch; null = no status change. */
export function optimisticStatus(action: BookingAction): BookingStatus | null {
  switch (action) {
    case "approve":
      return "confirmed";
    case "decline":
      return "declined";
    case "cancel":
      return "cancelled";
    case "no_show":
      return "no_show";
    default:
      return null; // reschedule / reassign / nudge / message → refetch only
  }
}

/** Terminal statuses have no further lifecycle actions. */
export function isTerminal(status: BookingStatus): boolean {
  return (
    status === "cancelled" || status === "declined" || status === "no_show"
  );
}

export function isPast(
  booking: Pick<Booking, "end_at">,
  now = new Date(),
): boolean {
  const end = new Date(booking.end_at).getTime();
  return !Number.isNaN(end) && end < now.getTime();
}

export interface ActionContext {
  /** Team-backed owner (home/business) → reassign is allowed. */
  canReassign: boolean;
  now?: Date;
}

/**
 * Actions available for a booking, in dock/menu order. The first element is the
 * natural primary for the dock; presentation decides ghost vs. solid.
 */
export function availableActions(
  booking: Pick<Booking, "status" | "end_at">,
  ctx: ActionContext,
): BookingAction[] {
  const now = ctx.now ?? new Date();
  const past = isPast(booking, now);

  switch (booking.status) {
    case "pending":
      return ["approve", "decline", "message"];
    case "confirmed":
      if (past) {
        // Elapsed but never closed out → let the host mark no-show or follow up.
        return ["message", "no_show", "nudge"];
      }
      return [
        "reschedule",
        "message",
        ...(ctx.canReassign ? (["reassign"] as BookingAction[]) : []),
        "cancel",
        "nudge",
      ];
    case "completed":
      return ["message", "nudge"];
    default:
      return []; // cancelled / declined / no_show
  }
}

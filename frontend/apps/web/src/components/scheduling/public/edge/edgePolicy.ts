// D10 policy state-machines — pure, dependency-free (no React/lucide) so the
// reschedule/cancel gating logic is trivially unit-testable. Derived entirely
// from the backend's computed `actions` (+ whether a payment exists). The copy
// + PolicyCard rendering live in CutoffPolicyBlocked.tsx.

import type { BookingManageActions } from "@pantopus/types";

export type ReschedulePolicy =
  | { kind: "open"; deadline?: string | null }
  | { kind: "closed"; deadline?: string | null; canCancel: boolean }
  | { kind: "not_online" };

export function deriveReschedulePolicy(
  actions: BookingManageActions,
): ReschedulePolicy {
  if (!actions.invitee_reschedule_allowed) return { kind: "not_online" };
  if (!actions.can_reschedule)
    return {
      kind: "closed",
      deadline: actions.reschedule_deadline,
      canCancel: actions.can_cancel,
    };
  return { kind: "open", deadline: actions.reschedule_deadline };
}

export type CancelPolicy =
  | { kind: "open_free"; deadline?: string | null; refundCents?: number | null }
  | { kind: "open_partial"; refundCents: number }
  | { kind: "open_no_refund" }
  | { kind: "closed" }
  | { kind: "not_online" };

export function deriveCancelPolicy(
  actions: BookingManageActions,
  hasPayment: boolean,
  now: number = Date.now(),
): CancelPolicy {
  if (!actions.invitee_cancel_allowed) return { kind: "not_online" };
  if (!actions.can_cancel) return { kind: "closed" };

  const freeUntil = actions.free_cancel_until
    ? new Date(actions.free_cancel_until).getTime()
    : null;
  const withinFree = freeUntil != null && now < freeUntil;
  const refund = actions.refund_estimate_cents ?? null;

  if (withinFree)
    return {
      kind: "open_free",
      deadline: actions.free_cancel_until,
      refundCents: refund,
    };
  if (hasPayment && refund != null && refund > 0)
    return { kind: "open_partial", refundCents: refund };
  return { kind: "open_no_refund" };
}

// W7 — targeted tests for the D10 reschedule/cancel policy state-machines.
// Pure logic only (no network, no React); mirrors the W0 param-builder test.

import type { BookingManageActions } from "@pantopus/types";
import {
  deriveReschedulePolicy,
  deriveCancelPolicy,
} from "@/components/scheduling/public/edge/edgePolicy";

const base: BookingManageActions = {
  can_cancel: true,
  can_reschedule: true,
  invitee_cancel_allowed: true,
  invitee_reschedule_allowed: true,
};

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0); // 2026-06-15T12:00:00Z

describe("deriveReschedulePolicy (D10 reschedule gating)", () => {
  it("blocks when the invitee can't reschedule online", () => {
    expect(
      deriveReschedulePolicy({ ...base, invitee_reschedule_allowed: false }),
    ).toEqual({ kind: "not_online" });
  });

  it("marks the window closed when reschedule is no longer possible", () => {
    const p = deriveReschedulePolicy({
      ...base,
      can_reschedule: false,
      reschedule_deadline: "2026-06-14T12:00:00Z",
      can_cancel: true,
    });
    expect(p).toEqual({
      kind: "closed",
      deadline: "2026-06-14T12:00:00Z",
      canCancel: true,
    });
  });

  it("is open when reschedule is allowed and possible", () => {
    expect(
      deriveReschedulePolicy({
        ...base,
        reschedule_deadline: "2026-06-20T12:00:00Z",
      }),
    ).toEqual({ kind: "open", deadline: "2026-06-20T12:00:00Z" });
  });
});

describe("deriveCancelPolicy (D10 cancel gating + refund framing)", () => {
  it("blocks when cancelling online isn't allowed", () => {
    expect(
      deriveCancelPolicy(
        { ...base, invitee_cancel_allowed: false },
        false,
        NOW,
      ),
    ).toEqual({ kind: "not_online" });
  });

  it("marks closed when cancel is no longer possible", () => {
    expect(
      deriveCancelPolicy({ ...base, can_cancel: false }, true, NOW),
    ).toEqual({ kind: "closed" });
  });

  it("offers a full refund within the free window", () => {
    const p = deriveCancelPolicy(
      {
        ...base,
        free_cancel_until: new Date(NOW + 24 * HOUR).toISOString(),
        refund_estimate_cents: 4800,
      },
      true,
      NOW,
    );
    expect(p.kind).toBe("open_free");
    if (p.kind === "open_free") expect(p.refundCents).toBe(4800);
  });

  it("offers a partial refund past the free window when a payment exists", () => {
    const p = deriveCancelPolicy(
      {
        ...base,
        free_cancel_until: new Date(NOW - 1 * HOUR).toISOString(),
        refund_estimate_cents: 2400,
      },
      true,
      NOW,
    );
    expect(p).toEqual({ kind: "open_partial", refundCents: 2400 });
  });

  it("is no-refund past the free window for a free booking", () => {
    const p = deriveCancelPolicy(
      { ...base, free_cancel_until: new Date(NOW - 1 * HOUR).toISOString() },
      false,
      NOW,
    );
    expect(p).toEqual({ kind: "open_no_refund" });
  });

  it("is no-refund past the free window when a paid booking owes nothing back", () => {
    const p = deriveCancelPolicy(
      {
        ...base,
        free_cancel_until: new Date(NOW - 1 * HOUR).toISOString(),
        refund_estimate_cents: 0,
      },
      true,
      NOW,
    );
    expect(p).toEqual({ kind: "open_no_refund" });
  });
});

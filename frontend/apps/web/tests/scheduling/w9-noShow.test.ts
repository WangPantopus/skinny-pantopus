// W9 · E6 — Mark no-show gate (mirrors the backend's NOT_APPLICABLE_YET).

import {
  canMarkNoShow,
  noShowBlockedReason,
} from "@/components/scheduling/bookings-extras/noShow";
import type { Booking } from "@pantopus/types";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-06-15T12:00:00Z");

function booking(
  status: Booking["status"],
  startOffsetH: number,
  durH = 1,
): Pick<Booking, "status" | "start_at" | "end_at"> {
  const start = NOW + startOffsetH * HOUR;
  return {
    status,
    start_at: new Date(start).toISOString(),
    end_at: new Date(start + durH * HOUR).toISOString(),
  };
}

describe("canMarkNoShow", () => {
  it("allows a confirmed booking once it has ended", () => {
    // started 2h ago, 1h long → ended 1h ago
    expect(canMarkNoShow(booking("confirmed", -2), NOW)).toBe(true);
  });

  it("blocks a confirmed booking that hasn't ended yet", () => {
    expect(canMarkNoShow(booking("confirmed", -0.5), NOW)).toBe(false); // still running
    expect(canMarkNoShow(booking("confirmed", 2), NOW)).toBe(false); // future
  });

  it("blocks non-confirmed statuses regardless of time", () => {
    expect(canMarkNoShow(booking("pending", -2), NOW)).toBe(false);
    expect(canMarkNoShow(booking("cancelled", -2), NOW)).toBe(false);
    expect(canMarkNoShow(booking("no_show", -2), NOW)).toBe(false);
  });

  it("is false for an unparseable end time", () => {
    expect(
      canMarkNoShow(
        { status: "confirmed", start_at: "x", end_at: "nope" },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("noShowBlockedReason", () => {
  it("is null when allowed", () => {
    expect(noShowBlockedReason(booking("confirmed", -2), NOW)).toBeNull();
  });

  it("explains the end-time gate for a future booking", () => {
    expect(noShowBlockedReason(booking("confirmed", 3), NOW)).toMatch(
      /after the booking's end time/i,
    );
  });

  it("explains pending requests need a decision first", () => {
    expect(noShowBlockedReason(booking("pending", -2), NOW)).toMatch(
      /approve or decline/i,
    );
  });

  it("notes an already-no_show booking", () => {
    expect(noShowBlockedReason(booking("no_show", -2), NOW)).toMatch(
      /already/i,
    );
  });
});

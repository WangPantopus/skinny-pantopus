// W9 · E8 — Group roster capacity math.

import {
  canPromote,
  computeCapacity,
} from "@/components/scheduling/bookings-extras/roster";
import type { BookingAttendee } from "@pantopus/types";

function att(rsvp: BookingAttendee["rsvp_status"]): BookingAttendee {
  return { rsvp_status: rsvp } as BookingAttendee;
}

describe("computeCapacity", () => {
  it("counts going/maybe/pending as filled and frees declined seats", () => {
    const attendees = [
      att("going"),
      att("going"),
      att("pending"),
      att("maybe"),
      att("declined"),
    ];
    const cap = computeCapacity(attendees, 16, 3);
    expect(cap.confirmed).toBe(2);
    expect(cap.pending).toBe(2); // maybe + pending
    expect(cap.declined).toBe(1);
    expect(cap.filled).toBe(4); // declined freed
    expect(cap.total).toBe(16);
    expect(cap.open).toBe(12);
    expect(cap.full).toBe(false);
    expect(cap.waiting).toBe(3);
    expect(cap.pct).toBe(25);
  });

  it("marks full and clamps pct at 100 when over-filled", () => {
    const attendees = [att("going"), att("going"), att("going")];
    const cap = computeCapacity(attendees, 2);
    expect(cap.filled).toBe(3);
    expect(cap.full).toBe(true);
    expect(cap.open).toBe(0);
    expect(cap.pct).toBe(100);
  });

  it("treats a non-positive seat cap as at least one seat", () => {
    expect(computeCapacity([], 0).total).toBe(1);
    expect(computeCapacity([], -5).total).toBe(1);
  });

  it("is empty-safe", () => {
    const cap = computeCapacity([], 10);
    expect(cap.filled).toBe(0);
    expect(cap.open).toBe(10);
    expect(cap.pct).toBe(0);
    expect(cap.full).toBe(false);
  });
});

describe("canPromote", () => {
  it("is true only while a seat is open", () => {
    expect(canPromote({ open: 1 })).toBe(true);
    expect(canPromote({ open: 0 })).toBe(false);
  });
});

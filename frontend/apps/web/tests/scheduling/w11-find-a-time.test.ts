// W11 — Find-a-time & who's-free. Targeted unit tests for this stream's pure
// logic: the who's-free slot→cell intersection (gridState), slot/date formatting,
// and household member normalization. No network, no React.

import type { BookingSlot } from "@pantopus/types";
import {
  toSpans,
  dayCellState,
  weekCellState,
  bucketLabelFull,
  BUCKETS,
} from "@/components/scheduling/home/find-a-time/gridState";
import {
  parseLocal,
  slotLabel,
  addDaysKey,
  rangeLabel,
  weekdayOf,
  instantLabel,
} from "@/components/scheduling/home/find-a-time/format";
import {
  readMembers,
  initials,
  shortName,
} from "@/components/scheduling/home/find-a-time/members";

function slot(startLocal: string, start: string, end: string): BookingSlot {
  return { startLocal, start, end };
}

describe("gridState — who's-free slot intersection", () => {
  // A 2pm–4pm free slot on Jun 22 (4 UTC hours apart for the duration calc).
  const twoToFour = slot(
    "2025-06-22T14:00:00",
    "2025-06-22T21:00:00Z",
    "2025-06-22T23:00:00Z",
  );

  it("derives a local-day span from startLocal + UTC duration", () => {
    const [span] = toSpans([twoToFour]);
    expect(span).toEqual({ dateKey: "2025-06-22", startHour: 14, endHour: 16 });
  });

  it("lights only the buckets a slot overlaps (half-open intervals)", () => {
    const spans = toSpans([twoToFour]);
    const states = BUCKETS.map((b) =>
      dayCellState(spans, true, "2025-06-22", b),
    );
    // Buckets: 8a,10a,12p,2p,4p,6p → only 2p (index 3) is free.
    expect(states).toEqual(["busy", "busy", "busy", "free", "busy", "busy"]);
  });

  it("lights every bucket a long slot spans", () => {
    const morning = toSpans([
      slot("2025-06-22T09:00:00", "2025-06-22T16:00:00Z", "2025-06-22T20:00:00Z"),
    ]);
    expect(dayCellState(morning, true, "2025-06-22", 8)).toBe("free");
    expect(dayCellState(morning, true, "2025-06-22", 10)).toBe("free");
    expect(dayCellState(morning, true, "2025-06-22", 12)).toBe("free");
    expect(dayCellState(morning, true, "2025-06-22", 14)).toBe("busy");
  });

  it("ignores slots on other days", () => {
    const spans = toSpans([twoToFour]);
    expect(dayCellState(spans, true, "2025-06-23", 14)).toBe("busy");
  });

  it("returns unknown when the member is not in the response", () => {
    expect(dayCellState([], false, "2025-06-22", 14)).toBe("unknown");
    expect(weekCellState([], false, "2025-06-22")).toBe("unknown");
  });

  it("week view marks any day with a free slot", () => {
    const spans = toSpans([twoToFour]);
    expect(weekCellState(spans, true, "2025-06-22")).toBe("free");
    expect(weekCellState(spans, true, "2025-06-25")).toBe("busy");
  });

  it("treats a zero/invalid duration as a short free sliver", () => {
    const [span] = toSpans([
      slot("2025-06-22T14:00:00", "bad", "also-bad"),
    ]);
    expect(span.endHour).toBeCloseTo(14.5);
  });

  it("labels a bucket as a 2-hour window", () => {
    expect(bucketLabelFull(14)).toBe("2 PM–4 PM");
    expect(bucketLabelFull(8)).toBe("8 AM–10 AM");
  });
});

describe("format — slot & date helpers", () => {
  it("parses a local ISO without timezone drift", () => {
    expect(parseLocal("2025-06-22T14:30:00")).toEqual({
      year: 2025,
      month: 5,
      day: 22,
      hour: 14,
      minute: 30,
    });
  });

  it("builds a slot label from startLocal", () => {
    expect(slotLabel("2025-06-22T14:00:00")).toEqual({
      weekday: "Sun",
      monthDay: "Jun 22",
      time: "2:00 PM",
      dateKey: "2025-06-22",
      hour: 14,
    });
  });

  it("adds days across month boundaries", () => {
    expect(addDaysKey("2025-06-22", 6)).toBe("2025-06-28");
    expect(addDaysKey("2025-06-28", 7)).toBe("2025-07-05");
  });

  it("renders a human range label", () => {
    expect(rangeLabel("2025-06-22", "2025-06-28")).toBe(
      "Sun Jun 22 — Sat Jun 28",
    );
    expect(rangeLabel("", "2025-06-28")).toBe("Pick a date range");
  });

  it("knows the weekday for a date key", () => {
    expect(weekdayOf("2025-06-22")).toBe("Sun");
    expect(weekdayOf("2025-06-23")).toBe("Mon");
  });

  it("renders a UTC instant in an explicit timezone", () => {
    // 21:00Z = 2:00 PM Pacific (PDT) on Jun 22.
    const l = instantLabel("2025-06-22T21:00:00Z", "America/Los_Angeles");
    expect(l.time).toBe("2:00 PM");
    expect(l.date).toContain("Jun 22");
  });
});

describe("members — household normalization", () => {
  it("normalizes occupants, dedupes by userId, and resolves names", () => {
    const list = readMembers([
      { user_id: "u1", name: "Mom", role_base: "family", profile_picture_url: "/a.jpg" },
      { user: { id: "u2", name: "Dad" } },
      { user_id: "u1", name: "Duplicate" },
      { name: "No id — dropped" },
    ]);
    expect(list.map((m) => m.userId)).toEqual(["u1", "u2"]);
    expect(list[0].name).toBe("Mom");
    expect(list[0].avatarUrl).toMatch(/\/a\.jpg$/);
    expect(list[1].name).toBe("Dad");
    expect(list[1].avatarUrl).toBeNull();
  });

  it("falls back to a generic name when none is present", () => {
    const [m] = readMembers([{ user_id: "u9" }]);
    expect(m.name).toBe("Member");
  });

  it("derives initials and short names", () => {
    expect(initials("Jane Doe")).toBe("JD");
    expect(initials("Mom")).toBe("M");
    expect(initials("")).toBe("?");
    expect(shortName("Jane Doe")).toBe("Jane");
  });
});

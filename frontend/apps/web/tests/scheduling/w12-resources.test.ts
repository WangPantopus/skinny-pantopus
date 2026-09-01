// W12 · F9–F12 — resource helpers: available-hours parsing, rules labels,
// live free/booked status, and the client-side slot generator.

import {
  durationLabel,
  generateResourceSlots,
  parseAvailableHours,
  resourceLiveStatus,
  rulesSummary,
  whoCanBookLabel,
  type AvailableHours,
} from "@/components/scheduling/home/resources/resourceMeta";

describe("parseAvailableHours", () => {
  it("parses a valid weekly window and sorts days", () => {
    const h = parseAvailableHours({
      days: [5, 1, 3],
      start: "09:00",
      end: "17:00",
    });
    expect(h).toEqual({ days: [1, 3, 5], start: "09:00", end: "17:00" });
  });

  it("returns null for empty / missing / malformed windows", () => {
    expect(parseAvailableHours({})).toBeNull();
    expect(parseAvailableHours(null)).toBeNull();
    expect(
      parseAvailableHours({ days: [1], start: "9", end: "17:00" }),
    ).toBeNull();
    // start >= end is not a usable window
    expect(
      parseAvailableHours({ days: [1], start: "18:00", end: "09:00" }),
    ).toBeNull();
  });
});

describe("durationLabel", () => {
  it("formats hours, minutes, mixed and no-limit", () => {
    expect(durationLabel(240)).toBe("4 hr max");
    expect(durationLabel(30)).toBe("30 min max");
    expect(durationLabel(90)).toBe("1 hr 30 min max");
    expect(durationLabel(null)).toBe("No limit");
    expect(durationLabel(0)).toBe("No limit");
  });
});

describe("rulesSummary / whoCanBookLabel", () => {
  it("builds the three rule chips", () => {
    expect(
      rulesSummary({
        max_duration_min: 240,
        requires_approval: false,
        who_can_book: "members",
      }),
    ).toEqual(["4 hr max", "No approval", "All members"]);
    expect(
      rulesSummary({
        max_duration_min: 60,
        requires_approval: true,
        who_can_book: "guests",
      }),
    ).toEqual(["1 hr max", "Needs approval", "Guests with link"]);
  });

  it("maps who_can_book values", () => {
    expect(whoCanBookLabel("members")).toBe("All members");
    expect(whoCanBookLabel("specific")).toBe("Specific members");
    expect(whoCanBookLabel("guests")).toBe("Guests with link");
  });
});

describe("resourceLiveStatus", () => {
  const now = new Date("2026-06-15T10:30:00");

  it("reports booked-until when a booking spans now", () => {
    const s = resourceLiveStatus(
      [
        {
          start_at: new Date("2026-06-15T10:00:00").toISOString(),
          end_at: new Date("2026-06-15T11:00:00").toISOString(),
          status: "confirmed",
        },
      ],
      now,
    );
    expect(s.state).toBe("booked");
    expect(s.label).toContain("Booked until");
  });

  it("reports free now when nothing overlaps", () => {
    const s = resourceLiveStatus(
      [
        {
          start_at: new Date("2026-06-15T14:00:00").toISOString(),
          end_at: new Date("2026-06-15T15:00:00").toISOString(),
          status: "confirmed",
        },
      ],
      now,
    );
    expect(s).toEqual({ state: "free", label: "Free now" });
  });

  it("ignores cancelled/declined bookings", () => {
    const s = resourceLiveStatus(
      [
        {
          start_at: new Date("2026-06-15T10:00:00").toISOString(),
          end_at: new Date("2026-06-15T11:00:00").toISOString(),
          status: "cancelled",
        },
      ],
      now,
    );
    expect(s.state).toBe("free");
  });
});

describe("generateResourceSlots", () => {
  // 2026-06-15 is a Monday (weekday 1).
  const window: AvailableHours = { days: [1], start: "09:00", end: "12:00" };
  const past = new Date("2020-01-01T00:00:00");

  it("generates hourly slots inside the window", () => {
    const slots = generateResourceSlots({
      availableHours: window,
      durationMin: 60,
      bufferMin: 0,
      existingBookings: [],
      fromDate: "2026-06-15",
      toDate: "2026-06-15",
      intervalMin: 60,
      minStart: past,
    });
    expect(slots.map((s) => s.startLocal.slice(11, 16))).toEqual([
      "09:00",
      "10:00",
      "11:00",
    ]);
  });

  it("excludes slots overlapping an existing booking (with buffer)", () => {
    const slots = generateResourceSlots({
      availableHours: window,
      durationMin: 60,
      bufferMin: 0,
      existingBookings: [
        {
          start_at: new Date("2026-06-15T10:00:00").toISOString(),
          end_at: new Date("2026-06-15T11:00:00").toISOString(),
        },
      ],
      fromDate: "2026-06-15",
      toDate: "2026-06-15",
      intervalMin: 60,
      minStart: past,
    });
    expect(slots.map((s) => s.startLocal.slice(11, 16))).toEqual([
      "09:00",
      "11:00",
    ]);
  });

  it("skips days not in the window and produces none for a Sunday", () => {
    const slots = generateResourceSlots({
      availableHours: window,
      durationMin: 60,
      bufferMin: 0,
      existingBookings: [],
      fromDate: "2026-06-14", // Sunday
      toDate: "2026-06-14",
      intervalMin: 60,
      minStart: past,
    });
    expect(slots).toHaveLength(0);
  });

  it("respects duration so a 2h booking can't start at 11:00 (would run to 13:00)", () => {
    const slots = generateResourceSlots({
      availableHours: window,
      durationMin: 120,
      bufferMin: 0,
      existingBookings: [],
      fromDate: "2026-06-15",
      toDate: "2026-06-15",
      intervalMin: 60,
      minStart: past,
    });
    expect(slots.map((s) => s.startLocal.slice(11, 16))).toEqual([
      "09:00",
      "10:00",
    ]);
  });

  it("drops slots before minStart (past hours)", () => {
    const slots = generateResourceSlots({
      availableHours: window,
      durationMin: 60,
      bufferMin: 0,
      existingBookings: [],
      fromDate: "2026-06-15",
      toDate: "2026-06-15",
      intervalMin: 60,
      minStart: new Date("2026-06-15T10:30:00"),
    });
    expect(slots.map((s) => s.startLocal.slice(11, 16))).toEqual(["11:00"]);
  });
});

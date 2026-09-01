import {
  rulesToDays,
  daysToRules,
  seedDefaultDays,
  hasAnyHours,
  compactWeekdays,
  summarizeSchedule,
  usFederalHolidays,
  rowsForSchedule,
} from "@/components/scheduling/availability/serialize";
import {
  to12h,
  rangeLabel,
  normalizeTime,
  formatDateLabel,
  toISODate,
} from "@/components/scheduling/availability/format";
import type { AvailabilityRule } from "@pantopus/types";

describe("format helpers", () => {
  it("normalizes HH:MM:SS to HH:MM", () => {
    expect(normalizeTime("09:00:00")).toBe("09:00");
    expect(normalizeTime("9:0")).toBe("09:00");
    expect(normalizeTime("")).toBe("");
  });

  it("renders 24h time as 12h with meridiem", () => {
    expect(to12h("09:00")).toBe("9:00 AM");
    expect(to12h("17:00:00")).toBe("5:00 PM");
    expect(to12h("00:30")).toBe("12:30 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
  });

  it("builds a labelled range", () => {
    expect(rangeLabel("09:00", "17:00")).toBe("9:00 AM – 5:00 PM");
  });

  it("formats an ISO date without tz drift", () => {
    // Jul 4 2026 is a Saturday.
    expect(formatDateLabel("2026-07-04")).toBe("Sat, Jul 4");
    expect(toISODate(new Date(2026, 6, 4))).toBe("2026-07-04");
  });
});

describe("rules ↔ day model", () => {
  const rules: AvailabilityRule[] = [
    { weekday: 1, start_time: "09:00:00", end_time: "17:00:00" },
    { weekday: 3, start_time: "13:00", end_time: "17:00" },
    { weekday: 3, start_time: "09:00", end_time: "12:00" },
  ];

  it("groups rules into a Monday-first 7-day model", () => {
    const days = rulesToDays(rules);
    expect(days).toHaveLength(7);
    expect(days[0].weekday).toBe(1); // Monday first
    expect(days[6].weekday).toBe(0); // Sunday last
    expect(days[0].on).toBe(true);
    expect(days[0].blocks).toEqual([{ start: "09:00", end: "17:00" }]);
    // Wednesday's two blocks are sorted by start time.
    const wed = days[2];
    expect(wed.weekday).toBe(3);
    expect(wed.blocks).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    // Tuesday is off.
    expect(days[1].on).toBe(false);
  });

  it("round-trips through daysToRules (only enabled days emit)", () => {
    const out = daysToRules(rulesToDays(rules));
    expect(out).toHaveLength(3);
    expect(out).toContainEqual({
      weekday: 1,
      start_time: "09:00",
      end_time: "17:00",
    });
    // Drops empty/blank blocks.
    const withBlank = daysToRules([
      { weekday: 2, on: true, blocks: [{ start: "", end: "10:00" }] },
    ]);
    expect(withBlank).toHaveLength(0);
  });

  it("seeds 9–5 Mon–Fri", () => {
    const days = seedDefaultDays();
    expect(hasAnyHours(days)).toBe(true);
    const onDays = days.filter((d) => d.on).map((d) => d.weekday);
    expect(onDays).toEqual([1, 2, 3, 4, 5]);
    expect(days[0].blocks[0]).toEqual({ start: "09:00", end: "17:00" });
    expect(
      hasAnyHours(seedDefaultDays().map((d) => ({ ...d, on: false }))),
    ).toBe(false);
  });
});

describe("compactWeekdays", () => {
  it("collapses contiguous weekday runs (Mon-first)", () => {
    expect(compactWeekdays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(compactWeekdays([6, 0])).toBe("Sat–Sun");
    expect(compactWeekdays([1, 2, 3, 4])).toBe("Mon–Thu");
  });

  it("lists isolated days and multiple runs", () => {
    expect(compactWeekdays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(compactWeekdays([1, 2, 4, 5])).toBe("Mon–Tue, Thu–Fri");
  });
});

describe("summarizeSchedule", () => {
  it("summarizes a uniform week", () => {
    const rules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      start_time: "09:00",
      end_time: "17:00",
    }));
    expect(summarizeSchedule(rules)).toBe("Mon–Fri, 9:00 AM – 5:00 PM");
  });

  it("falls back to '+ more' when hours differ", () => {
    const rules: AvailabilityRule[] = [
      { weekday: 1, start_time: "09:00", end_time: "17:00" },
      { weekday: 2, start_time: "09:00", end_time: "17:00" },
      { weekday: 6, start_time: "10:00", end_time: "14:00" },
    ];
    const s = summarizeSchedule(rules);
    expect(s.startsWith("Mon–Tue, 9:00 AM – 5:00 PM")).toBe(true);
    expect(s).toContain("+ more");
  });

  it("reports empty schedules", () => {
    expect(summarizeSchedule([])).toBe("No hours set");
  });
});

describe("usFederalHolidays", () => {
  const h2026 = usFederalHolidays(2026);

  it("returns all 11 federal holidays", () => {
    expect(h2026).toHaveLength(11);
  });

  it("computes fixed and floating dates correctly for 2026", () => {
    const byName = Object.fromEntries(h2026.map((h) => [h.name, h.date]));
    expect(byName["New Year's Day"]).toBe("2026-01-01");
    expect(byName["Independence Day"]).toBe("2026-07-04");
    expect(byName["Christmas Day"]).toBe("2026-12-25");
    expect(byName["Juneteenth"]).toBe("2026-06-19");
    // 3rd Monday of January 2026 = Jan 19.
    expect(byName["Martin Luther King Jr. Day"]).toBe("2026-01-19");
    // Last Monday of May 2026 = May 25.
    expect(byName["Memorial Day"]).toBe("2026-05-25");
    // 4th Thursday of November 2026 = Nov 26.
    expect(byName["Thanksgiving"]).toBe("2026-11-26");
    // 1st Monday of September 2026 = Sep 7.
    expect(byName["Labor Day"]).toBe("2026-09-07");
  });
});

describe("rowsForSchedule", () => {
  it("keeps matching and untagged rows, drops other schedules", () => {
    const rows = [
      { schedule_id: "a", weekday: 1 },
      { schedule_id: "b", weekday: 2 },
      { weekday: 3 },
    ];
    expect(rowsForSchedule(rows, "a")).toEqual([
      { schedule_id: "a", weekday: 1 },
      { weekday: 3 },
    ]);
  });
});

// W17 — Insights & reports: targeted tests for the pure logic only (the H13
// period/filter param builder, formatters, range aggregation, and the
// business-only gate). No network, no rendering.

import type { Booking, EventType } from "@pantopus/types";
import {
  DEFAULT_PRESET,
  bookingListParams,
  bookingRange,
  countActiveFilters,
  defaultFilters,
  insightsDays,
  insightsParams,
  isCustomIncomplete,
  parseFilters,
  serializeFilters,
  type InsightsFilters,
} from "@/components/scheduling/insights/filters";
import {
  formatCount,
  formatDurationMin,
  formatMoneyCents,
  formatRangeLabel,
  formatRate,
  rateOf,
} from "@/components/scheduling/insights/format";
import {
  aggregateByEventType,
  summarizeRange,
  volumeSeries,
} from "@/components/scheduling/insights/aggregate";
import {
  isBusinessOnly,
  isBusinessOwner,
} from "@/components/scheduling/insights/gating";

const NOW = new Date(2026, 5, 15, 12, 0, 0); // 2026-06-15 12:00 local

function f(over: Partial<InsightsFilters> = {}): InsightsFilters {
  return { ...defaultFilters("UTC"), ...over };
}

// ─── filters: param builders ────────────────────────────────

describe("insightsDays", () => {
  it("maps presets to day windows", () => {
    expect(insightsDays(f({ preset: "7d" }))).toBe(7);
    expect(insightsDays(f({ preset: "30d" }))).toBe(30);
    expect(insightsDays(f({ preset: "90d" }))).toBe(90);
    expect(insightsDays(f({ preset: "12m" }))).toBe(365);
  });

  it("computes an inclusive span for a custom range", () => {
    expect(
      insightsDays(
        f({ preset: "custom", from: "2026-06-01", to: "2026-06-30" }),
      ),
    ).toBe(30);
  });

  it("tolerates reversed custom bounds", () => {
    expect(
      insightsDays(
        f({ preset: "custom", from: "2026-06-30", to: "2026-06-01" }),
      ),
    ).toBe(30);
  });

  it("clamps a custom span to the backend max of 365", () => {
    expect(
      insightsDays(
        f({ preset: "custom", from: "2024-01-01", to: "2026-12-31" }),
      ),
    ).toBe(365);
  });

  it("falls back to 90 when a custom range is incomplete", () => {
    expect(
      insightsDays(f({ preset: "custom", from: "2026-06-01", to: null })),
    ).toBe(90);
  });
});

describe("bookingRange", () => {
  it("builds an inclusive window ending today for presets", () => {
    expect(bookingRange(f({ preset: "30d" }), NOW)).toEqual({
      from: "2026-05-17",
      to: "2026-06-15",
    });
    expect(bookingRange(f({ preset: "7d" }), NOW)).toEqual({
      from: "2026-06-09",
      to: "2026-06-15",
    });
  });

  it("passes through a custom range", () => {
    expect(
      bookingRange(
        f({ preset: "custom", from: "2026-01-01", to: "2026-03-31" }),
        NOW,
      ),
    ).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });
});

describe("insightsParams / bookingListParams", () => {
  it("insightsParams yields a days window", () => {
    expect(insightsParams(f({ preset: "30d" }))).toEqual({ days: 30 });
  });

  it("bookingListParams includes from/to and the event-type facet", () => {
    const params = bookingListParams(
      f({ preset: "7d", eventTypeId: "evt_1" }),
      NOW,
    );
    expect(params.from).toBe("2026-06-09");
    expect(params.to).toBe("2026-06-15");
    expect(params.event_type_id).toBe("evt_1");
  });

  it("omits the event-type facet when unset", () => {
    expect(
      bookingListParams(f({ preset: "7d" }), NOW).event_type_id,
    ).toBeUndefined();
  });
});

describe("active-filter accounting", () => {
  it("counts non-default preset + event type", () => {
    expect(countActiveFilters(f())).toBe(0);
    expect(countActiveFilters(f({ preset: "7d" }))).toBe(1);
    expect(countActiveFilters(f({ preset: "7d", eventTypeId: "x" }))).toBe(2);
  });

  it("flags an incomplete custom range", () => {
    expect(isCustomIncomplete(f({ preset: "custom" }))).toBe(true);
    expect(
      isCustomIncomplete(
        f({ preset: "custom", from: "2026-06-01", to: "2026-06-30" }),
      ),
    ).toBe(false);
    expect(isCustomIncomplete(f({ preset: "30d" }))).toBe(false);
  });
});

describe("serialize / parse round-trip", () => {
  it("omits the default preset but keeps tz", () => {
    const sp = new URLSearchParams(
      serializeFilters(f({ tz: "America/New_York" })),
    );
    expect(sp.get("period")).toBeNull();
    expect(sp.get("tz")).toBe("America/New_York");
  });

  it("round-trips a custom range + facet", () => {
    const orig = f({
      preset: "custom",
      from: "2026-06-01",
      to: "2026-06-30",
      eventTypeId: "evt_9",
      tz: "Europe/Berlin",
    });
    const back = parseFilters(serializeFilters(orig), "UTC");
    expect(back).toEqual(orig);
  });

  it("defaults unknown periods to the default preset", () => {
    expect(parseFilters("period=bogus", "UTC").preset).toBe(DEFAULT_PRESET);
  });
});

// ─── formatters ─────────────────────────────────────────────

describe("formatRate", () => {
  it("treats fractions as 0–1", () => {
    expect(formatRate(0.05)).toBe("5%");
    expect(formatRate(0.125, 1)).toBe("12.5%");
    expect(formatRate(0.2)).toBe("20%");
  });

  it("treats values >1 as already a percent", () => {
    expect(formatRate(20)).toBe("20%");
    expect(formatRate(12.5, 1)).toBe("12.5%");
  });

  it("degrades to a dash for missing values", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
    expect(formatRate(Number.NaN)).toBe("—");
  });
});

describe("money / count / duration / range labels", () => {
  it("formats integer cents, dropping whole cents", () => {
    expect(formatMoneyCents(12345)).toBe("$123.45");
    expect(formatMoneyCents(10000)).toBe("$100");
    expect(formatMoneyCents(null)).toBe("—");
  });

  it("groups counts", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe("—");
  });

  it("formats durations", () => {
    expect(formatDurationMin(30)).toBe("30 min");
    expect(formatDurationMin(60)).toBe("1 hr");
    expect(formatDurationMin(90)).toBe("1 hr 30 min");
    expect(formatDurationMin(0)).toBe("—");
  });

  it("formats a date range label", () => {
    const out = formatRangeLabel("2026-06-01", "2026-06-30");
    expect(out).toContain("Jun 1");
    expect(out).toContain("Jun 30, 2026");
  });

  it("rateOf returns a fraction", () => {
    expect(rateOf(1, 4)).toBe(0.25);
    expect(rateOf(1, 0)).toBe(0);
  });
});

// ─── aggregation ────────────────────────────────────────────

function mk(over: Partial<Booking> & { status: Booking["status"] }): Booking {
  return {
    id: Math.random().toString(36).slice(2),
    event_type_id: "evt_1",
    start_at: "2026-06-10T15:00:00Z",
    end_at: "2026-06-10T15:30:00Z",
    ...over,
  } as Booking;
}

describe("summarizeRange", () => {
  it("tallies outcomes and rates", () => {
    const s = summarizeRange([
      mk({ status: "completed" }),
      mk({ status: "completed" }),
      mk({ status: "completed" }),
      mk({ status: "no_show" }),
      mk({ status: "cancelled" }),
      mk({ status: "declined" }),
      mk({ status: "pending" }),
      mk({ status: "confirmed" }),
    ]);
    expect(s.total).toBe(8);
    expect(s.completed).toBe(3);
    expect(s.noShow).toBe(1);
    expect(s.cancelled).toBe(2); // cancelled + declined
    expect(s.pending).toBe(1);
    expect(s.confirmed).toBe(1);
    // no-show rate = 1 / (3 completed + 1 no-show) = 0.25
    expect(s.noShowRate).toBeCloseTo(0.25, 5);
    // cancellation rate = 2 / 8 = 0.25
    expect(s.cancellationRate).toBeCloseTo(0.25, 5);
  });

  it("is safe on an empty range", () => {
    const s = summarizeRange([]);
    expect(s.total).toBe(0);
    expect(s.noShowRate).toBe(0);
  });
});

describe("aggregateByEventType", () => {
  const eventTypes = [
    { id: "evt_1", name: "Intro call", color: "#0284c7" },
    { id: "evt_2", name: "Deep dive", color: null },
  ] as unknown as EventType[];

  it("groups, joins metadata, and sorts by volume", () => {
    const rows = aggregateByEventType(
      [
        mk({ event_type_id: "evt_1", status: "completed" }),
        mk({ event_type_id: "evt_1", status: "no_show" }),
        mk({ event_type_id: "evt_2", status: "completed" }),
        mk({ event_type_id: "evt_2", status: "completed" }),
        mk({ event_type_id: "evt_2", status: "completed" }),
        mk({ event_type_id: null, status: "confirmed" }),
      ],
      eventTypes,
    );
    // evt_2 (3) before evt_1 (2) before Other (1)
    expect(rows.map((r) => r.eventTypeId)).toEqual([
      "evt_2",
      "evt_1",
      "__none__",
    ]);
    expect(rows[0].name).toBe("Deep dive");
    const intro = rows.find((r) => r.eventTypeId === "evt_1")!;
    expect(intro.name).toBe("Intro call");
    expect(intro.color).toBe("#0284c7");
    expect(intro.noShowRate).toBeCloseTo(0.5, 5); // 1 no-show of 2 settled
    expect(intro.avgDurationMin).toBe(30);
    const other = rows.find((r) => r.eventTypeId === "__none__")!;
    expect(other.name).toBe("Other");
  });
});

describe("volumeSeries", () => {
  it("buckets daily for a short range", () => {
    const series = volumeSeries(
      [
        mk({ status: "confirmed", start_at: "2026-06-09T15:00:00Z" }),
        mk({ status: "confirmed", start_at: "2026-06-09T18:00:00Z" }),
        mk({ status: "confirmed", start_at: "2026-06-15T09:00:00Z" }),
      ],
      "2026-06-09",
      "2026-06-15",
      "UTC",
    );
    expect(series.bucketDays).toBe(1);
    expect(series.buckets).toHaveLength(7);
    expect(series.buckets[0].count).toBe(2); // Jun 9
    expect(series.buckets[6].count).toBe(1); // Jun 15
    expect(series.max).toBe(2);
  });

  it("widens the bucket for long ranges to stay under maxBars", () => {
    const series = volumeSeries([], "2025-06-16", "2026-06-15", "UTC", 30);
    expect(series.bucketDays).toBe(13); // ceil(365 / 30)
    expect(series.buckets.length).toBeLessThanOrEqual(30);
  });
});

// ─── gating ─────────────────────────────────────────────────

describe("business-only gating", () => {
  it("detects a business owner", () => {
    expect(isBusinessOwner({ ownerType: "business", ownerId: "biz_1" })).toBe(
      true,
    );
    expect(isBusinessOwner({ ownerType: "user" })).toBe(false);
    expect(isBusinessOwner(null)).toBe(false);
  });

  it("detects the BUSINESS_ONLY error gate", () => {
    expect(
      isBusinessOnly({ kind: "error", code: "BUSINESS_ONLY", message: "x" }),
    ).toBe(true);
    expect(isBusinessOnly({ kind: "error", code: "NOPE", message: "x" })).toBe(
      false,
    );
    expect(isBusinessOnly({ kind: "not_found", message: "x" })).toBe(false);
  });
});

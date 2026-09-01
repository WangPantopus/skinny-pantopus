// W9 · E9 — Booking search & filter param builder + URL (de)serialization.

import {
  DEFAULT_FILTERS,
  buildBookingListParams,
  countActiveFilters,
  dateRange,
  parseFilters,
  refineBookings,
  serializeFilters,
  type BookingFilters,
} from "@/components/scheduling/bookings-extras/filters";
import type { Booking } from "@pantopus/types";

const NOW = new Date("2026-06-15T12:00:00"); // local; a Monday

function f(over: Partial<BookingFilters> = {}): BookingFilters {
  return { ...DEFAULT_FILTERS, ...over };
}

describe("buildBookingListParams", () => {
  it("omits status when 'all'", () => {
    expect(buildBookingListParams(f(), NOW).status).toBeUndefined();
  });

  it("passes through real backend statuses", () => {
    expect(buildBookingListParams(f({ status: "pending" }), NOW).status).toBe(
      "pending",
    );
    expect(buildBookingListParams(f({ status: "cancelled" }), NOW).status).toBe(
      "cancelled",
    );
  });

  it("maps the no_show facet onto the 'past' bucket (refined client-side)", () => {
    expect(buildBookingListParams(f({ status: "no_show" }), NOW).status).toBe(
      "past",
    );
  });

  it("trims and forwards the query + event type", () => {
    const p = buildBookingListParams(
      f({ q: "  mara ", eventTypeId: "et-1" }),
      NOW,
    );
    expect(p.q).toBe("mara");
    expect(p.event_type_id).toBe("et-1");
  });

  it("drops an empty/whitespace query", () => {
    expect(buildBookingListParams(f({ q: "   " }), NOW).q).toBeUndefined();
  });

  it("derives a from/to range for the 'today' facet", () => {
    const p = buildBookingListParams(f({ date: "today" }), NOW);
    expect(p.from).toBe("2026-06-15");
    expect(p.to).toBe("2026-06-15");
  });

  it("derives the whole month for the 'month' facet", () => {
    const { from, to } = dateRange(
      { date: "month", from: null, to: null },
      NOW,
    );
    expect(from).toBe("2026-06-01");
    expect(to).toBe("2026-06-30");
  });

  it("honors a custom range", () => {
    const p = buildBookingListParams(
      f({ date: "custom", from: "2026-07-01", to: "2026-07-09" }),
      NOW,
    );
    expect(p.from).toBe("2026-07-01");
    expect(p.to).toBe("2026-07-09");
  });
});

describe("countActiveFilters", () => {
  it("is 0 for defaults", () => {
    expect(countActiveFilters(f())).toBe(0);
  });
  it("counts each non-default facet once", () => {
    expect(
      countActiveFilters(
        f({ q: "x", status: "pending", eventTypeId: "et", date: "week" }),
      ),
    ).toBe(4);
  });
});

describe("refineBookings", () => {
  const mk = (status: Booking["status"]): Booking =>
    ({ id: status, status }) as Booking;

  it("keeps only no_show rows for the no_show facet", () => {
    const list = [mk("no_show"), mk("confirmed"), mk("completed")];
    const out = refineBookings(list, f({ status: "no_show" }));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("no_show");
  });

  it("passes everything through for other facets", () => {
    const list = [mk("confirmed"), mk("pending")];
    expect(refineBookings(list, f({ status: "pending" }))).toHaveLength(2);
  });
});

describe("serialize ⇄ parse roundtrip", () => {
  it("survives a full roundtrip", () => {
    const original = f({
      q: "mara",
      status: "pending",
      eventTypeId: "et-9",
      date: "custom",
      from: "2026-07-01",
      to: "2026-07-09",
    });
    const parsed = parseFilters(serializeFilters(original));
    expect(parsed).toEqual(original);
  });

  it("defaults unknown values safely", () => {
    const parsed = parseFilters("status=bogus&date=whenever");
    expect(parsed.status).toBe("all");
    expect(parsed.date).toBe("all");
  });

  it("returns defaults for an empty query", () => {
    expect(parseFilters("")).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(null)).toEqual(DEFAULT_FILTERS);
  });
});

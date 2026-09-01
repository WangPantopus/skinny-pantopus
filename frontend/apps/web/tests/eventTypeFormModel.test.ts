// W2 — Event Types. Targeted unit tests for the pure editor logic: slug
// derivation, EventType ⇄ form mapping, serialization (incl. the schedulingPaid
// pricing gate), money conversion, and validation field mapping.

import type { EventType } from "@pantopus/types";
import {
  centsToDollars,
  defaultFormValues,
  dollarsToCents,
  eventTypeToForm,
  formToInput,
  slugify,
  suffixSlug,
  validateForm,
  type EventTypeFormValues,
} from "../src/components/scheduling/event-types/eventTypeFormModel";

function makeEventType(overrides: Partial<EventType> = {}): EventType {
  return {
    id: "et_1",
    page_id: "page_1",
    owner_type: "user",
    owner_id: "u_1",
    name: "Intro call",
    slug: "intro-call",
    description: "A quick chat",
    color: "#0284c7",
    durations: [30],
    default_duration: 30,
    location_mode: "video",
    location_detail: "meet.pantopus.com/me",
    assignment_mode: "one_on_one",
    requires_approval: false,
    visibility: "public",
    buffer_before_min: 0,
    buffer_after_min: 0,
    min_notice_min: 0,
    max_horizon_days: 60,
    slot_interval_min: 15,
    daily_cap: null,
    per_booker_cap: null,
    seat_cap: 1,
    price_cents: 0,
    currency: "USD",
    deposit_cents: 0,
    deposit_refundable: true,
    no_show_fee_cents: 0,
    refund_policy: "full",
    cancellation_window_min: null,
    reschedule_cutoff_min: null,
    allow_invitee_cancel: true,
    allow_invitee_reschedule: true,
    schedule_id: "sched_1",
    is_active: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Intro Call")).toBe("intro-call");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("  Strategy! Session?? ")).toBe("strategy-session");
  });
  it("falls back to 'event' for empty/symbol-only input", () => {
    expect(slugify("")).toBe("event");
    expect(slugify("***")).toBe("event");
  });
  it("respects the 61-char ceiling and trims trailing hyphens", () => {
    const s = slugify("a".repeat(80));
    expect(s.length).toBeLessThanOrEqual(61);
    expect(s.endsWith("-")).toBe(false);
  });
  it("produces a backend-valid slug shape", () => {
    expect(slugify("Café déjà vu")).toMatch(/^[a-z0-9][a-z0-9-]{0,60}$/);
  });
});

describe("suffixSlug", () => {
  it("appends a numeric suffix", () => {
    expect(suffixSlug("intro-call", 2)).toBe("intro-call-2");
  });
  it("replaces an existing numeric suffix instead of stacking", () => {
    expect(suffixSlug("intro-call-2", 3)).toBe("intro-call-3");
  });
});

describe("defaultFormValues", () => {
  it("uses 30 minutes by default", () => {
    const v = defaultFormValues();
    expect(v.durations).toEqual([30]);
    expect(v.default_duration).toBe(30);
    expect(v.location_mode).toBe("video");
    expect(v.visibility).toBe("public");
    expect(v.is_active).toBe(true);
    expect(v.charge).toBe(false);
  });
  it("honors a valid preset duration", () => {
    const v = defaultFormValues(15);
    expect(v.durations).toEqual([15]);
    expect(v.default_duration).toBe(15);
  });
  it("ignores an out-of-range preset", () => {
    expect(defaultFormValues(2).default_duration).toBe(30);
  });
});

describe("eventTypeToForm", () => {
  it("maps core fields and derives charge from price", () => {
    const form = eventTypeToForm(
      makeEventType({ price_cents: 12000, deposit_cents: 5000 }),
    );
    expect(form.name).toBe("Intro call");
    expect(form.charge).toBe(true);
    expect(form.collect_deposit).toBe(true);
    expect(form.assignment_mode).toBe("one_on_one");
  });
  it("falls back to default_duration when durations is empty", () => {
    const form = eventTypeToForm(
      makeEventType({ durations: [], default_duration: 45 }),
    );
    expect(form.durations).toEqual([45]);
  });
});

describe("formToInput pricing gate", () => {
  const base = (
    over: Partial<EventTypeFormValues> = {},
  ): EventTypeFormValues => ({
    ...defaultFormValues(),
    name: "Intro call",
    slug: "intro-call",
    ...over,
  });

  it("OMITS every priced field when includePricing is false", () => {
    const input = formToInput(base({ charge: true, price_cents: 12000 }), {
      includePricing: false,
    });
    expect(input).not.toHaveProperty("price_cents");
    expect(input).not.toHaveProperty("currency");
    expect(input).not.toHaveProperty("deposit_cents");
    expect(input).not.toHaveProperty("refund_policy");
    expect(input).not.toHaveProperty("deposit_refundable");
  });

  it("includes priced fields when charging and flag on", () => {
    const input = formToInput(
      base({
        charge: true,
        price_cents: 12000,
        currency: "eur",
        collect_deposit: true,
        deposit_cents: 5000,
        refund_policy: "partial",
      }),
      { includePricing: true },
    );
    expect(input.price_cents).toBe(12000);
    expect(input.currency).toBe("EUR");
    expect(input.deposit_cents).toBe(5000);
    expect(input.refund_policy).toBe("partial");
  });

  it("zeroes price/deposit when not charging (flag on)", () => {
    const input = formToInput(
      base({ charge: false, price_cents: 12000, deposit_cents: 5000 }),
      { includePricing: true },
    );
    expect(input.price_cents).toBe(0);
    expect(input.deposit_cents).toBe(0);
  });
});

describe("formToInput normalization", () => {
  const base = (over: Partial<EventTypeFormValues>): EventTypeFormValues => ({
    ...defaultFormValues(),
    name: "  Spaced  ",
    slug: "spaced",
    ...over,
  });

  it("sorts, de-dupes durations and coerces default into the set", () => {
    const input = formToInput(
      base({ durations: [60, 15, 15, 30], default_duration: 90 }),
      { includePricing: false },
    );
    expect(input.durations).toEqual([15, 30, 60]);
    expect(input.default_duration).toBe(15);
  });

  it("trims the name and maps daily_cap<=0 to null", () => {
    const input = formToInput(base({ daily_cap: 0 }), {
      includePricing: false,
    });
    expect(input.name).toBe("Spaced");
    expect(input.daily_cap).toBeNull();
  });

  it("clamps buffers into the allowed range", () => {
    const input = formToInput(
      base({ buffer_before_min: 9999, buffer_after_min: -5 }),
      { includePricing: false },
    );
    expect(input.buffer_before_min).toBe(720);
    expect(input.buffer_after_min).toBe(0);
  });
});

describe("money conversion", () => {
  it("dollars → cents", () => {
    expect(dollarsToCents("120")).toBe(12000);
    expect(dollarsToCents("12.50")).toBe(1250);
    expect(dollarsToCents("")).toBe(0);
    expect(dollarsToCents("-3")).toBe(0);
  });
  it("cents → dollars (blank for zero)", () => {
    expect(centsToDollars(12000)).toBe("120");
    expect(centsToDollars(1250)).toBe("12.50");
    expect(centsToDollars(0)).toBe("");
  });
});

describe("validateForm", () => {
  const base = (
    over: Partial<EventTypeFormValues> = {},
  ): EventTypeFormValues => ({
    ...defaultFormValues(),
    name: "Intro call",
    slug: "intro-call",
    ...over,
  });

  it("passes a sane default form", () => {
    expect(validateForm(base(), { paid: false })).toEqual({});
  });
  it("requires a name", () => {
    expect(validateForm(base({ name: "   " }), { paid: false })).toHaveProperty(
      "name",
    );
  });
  it("flags an over-long name", () => {
    expect(
      validateForm(base({ name: "x".repeat(201) }), { paid: false }),
    ).toHaveProperty("name");
  });
  it("flags empty / out-of-range durations", () => {
    expect(
      validateForm(base({ durations: [] }), { paid: false }),
    ).toHaveProperty("durations");
    expect(
      validateForm(base({ durations: [2] }), { paid: false }),
    ).toHaveProperty("durations");
  });
  it("validates price only when paid + charging", () => {
    expect(
      validateForm(base({ charge: true, price_cents: 0 }), { paid: false }),
    ).not.toHaveProperty("price_cents");
    expect(
      validateForm(base({ charge: true, price_cents: 0 }), { paid: true }),
    ).toHaveProperty("price_cents");
  });
  it("validates deposit bounds when collecting a deposit", () => {
    const errs = validateForm(
      base({
        charge: true,
        price_cents: 10000,
        collect_deposit: true,
        deposit_cents: 20000,
      }),
      { paid: true },
    );
    expect(errs).toHaveProperty("deposit_cents");
  });
});

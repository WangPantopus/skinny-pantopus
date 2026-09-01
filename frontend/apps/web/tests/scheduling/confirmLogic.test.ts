/**
 * W6 — Invitee confirm & manage stream logic.
 *
 * Targeted unit tests for the pure helpers behind D1 (intake validation +
 * booking-input builder) and D2 (pricing math + slot/tz formatting). No React /
 * network — confirmUtils has zero runtime imports (types only), so this stays a
 * fast pure-logic suite.
 */

import type { PublicEventType } from "@pantopus/types";
import {
  buildBookingInput,
  balanceCents,
  durationLabelFromMinutes,
  dueNowCents,
  emptyIntake,
  formatCents,
  formatSlotRange,
  isIntakeValid,
  isPastBooking,
  isValidEmail,
  priceMode,
  type PublicIntakeQuestion,
  readQuestions,
  reviewCtaLabel,
  validateIntake,
} from "@/components/scheduling/public/confirm/confirmUtils";

const pricing = {
  price_cents: 0,
  currency: "usd",
  deposit_cents: 0,
};

function et(overrides: Partial<PublicEventType> = {}): PublicEventType {
  return {
    id: "et1",
    name: "Intro call",
    slug: "intro-call",
    description: null,
    color: null,
    durations: [30],
    default_duration: 30,
    location_mode: "video",
    location_detail: null,
    price_cents: 0,
    currency: "usd",
    deposit_cents: 0,
    deposit_refundable: false,
    refund_policy: "full",
    cancellation_window_min: null,
    reschedule_cutoff_min: null,
    requires_approval: false,
    ...overrides,
  };
}

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("maya.chen@gmail.com")).toBe(true);
  });
  it("rejects malformed addresses", () => {
    expect(isValidEmail("maya.chen@")).toBe(false);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateIntake", () => {
  it("requires first/last name + a valid email", () => {
    const errors = validateIntake(emptyIntake(), []);
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("flags an invalid email even when present", () => {
    const errors = validateIntake(
      {
        ...emptyIntake(),
        firstName: "Maya",
        lastName: "Chen",
        email: "maya.chen@",
      },
      [],
    );
    expect(errors.email).toBe("Enter a valid email address");
  });

  it("passes a complete base form", () => {
    const ok = isIntakeValid(
      {
        ...emptyIntake(),
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@x.com",
        // Phone is required — design intake-booking-frames.jsx:274 marks the field
        // `required`. This test predates that rule and omitted it, so "complete" was
        // asserting an incomplete form.
        phone: "(415) 555-0142",
      },
      [],
    );
    expect(ok).toBe(true);
  });

  it("rejects a form with no phone number", () => {
    const errors = validateIntake(
      {
        ...emptyIntake(),
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@x.com",
      },
      [],
    );
    expect(errors.phone).toBe("Enter your phone number");
  });

  it("enforces required questions and validates guest emails", () => {
    const questions: PublicIntakeQuestion[] = [
      {
        id: "q-cover",
        label: "What to cover?",
        field_type: "textarea",
        required: true,
      },
    ];
    const errors = validateIntake(
      {
        ...emptyIntake(),
        firstName: "Maya",
        lastName: "Chen",
        email: "maya@x.com",
        guests: ["bad-email"],
      },
      questions,
    );
    expect(errors["q-cover"]).toBe("This question is required");
    expect(errors.guest0).toBeDefined();
  });
});

describe("buildBookingInput", () => {
  it("composes name, nulls empty phone, keys answers by label, folds in guests", () => {
    const questions: PublicIntakeQuestion[] = [
      {
        id: "q1",
        label: "What to cover?",
        field_type: "textarea",
        required: true,
      },
    ];
    const body = buildBookingInput(
      {
        firstName: "Maya",
        lastName: "Chen",
        email: " maya@x.com ",
        phone: "",
        answers: { q1: "Q3 rollout" },
        guests: ["sam@x.com", ""],
      },
      {
        startAt: "2026-06-17T16:30:00Z",
        durationMin: 30,
        timezone: "UTC",
        questions,
      },
    );
    expect(body.name).toBe("Maya Chen");
    expect(body.email).toBe("maya@x.com");
    expect(body.phone).toBeNull();
    expect(body.timezone).toBe("UTC");
    expect(body.duration_min).toBe(30);
    expect(body.answers).toEqual({
      "What to cover?": "Q3 rollout",
      guest_emails: ["sam@x.com"],
    });
  });
});

describe("pricing math", () => {
  it("derives the price mode", () => {
    expect(priceMode(pricing)).toBe("free");
    expect(priceMode({ ...pricing, price_cents: 4800 })).toBe("full");
    expect(priceMode({ price_cents: 6000, deposit_cents: 2000 })).toBe(
      "deposit",
    );
  });

  it("computes due-now and balance for a deposit", () => {
    const dep = { price_cents: 6000, deposit_cents: 2000 };
    expect(dueNowCents(dep)).toBe(2000);
    expect(balanceCents(dep)).toBe(4000);
  });

  it("formats cents as currency", () => {
    expect(formatCents(4800, "usd")).toBe("$48.00");
    expect(formatCents(2000)).toBe("$20.00");
  });

  it("labels the review CTA by mode + flag", () => {
    expect(reviewCtaLabel(et(), true)).toBe("Confirm booking");
    expect(reviewCtaLabel(et({ price_cents: 4800 }), true)).toBe(
      "Pay $48.00 & book",
    );
    // flag off → never asks for money
    expect(reviewCtaLabel(et({ price_cents: 4800 }), false)).toBe(
      "Confirm booking",
    );
  });
});

describe("formatting helpers", () => {
  it("labels durations", () => {
    expect(durationLabelFromMinutes(30)).toBe("30 min");
    expect(durationLabelFromMinutes(60)).toBe("1 hr");
    expect(durationLabelFromMinutes(90)).toBe("1 hr 30 min");
    expect(durationLabelFromMinutes(0)).toBe("");
  });

  it("formats a slot range in a fixed zone, collapsing the meridiem", () => {
    const label = formatSlotRange(
      "2026-06-17T16:30:00Z",
      "2026-06-17T17:00:00Z",
      "UTC",
    );
    expect(label).toContain("Jun 17");
    expect(label).toContain("4:30");
    expect(label).toContain("5:00");
    expect(label).toMatch(/PM/);
  });
});

describe("readQuestions", () => {
  it("returns [] when the public payload has no questions", () => {
    expect(readQuestions(et())).toEqual([]);
  });
  it("sorts by sort_order when present", () => {
    const withQ = {
      ...et(),
      questions: [
        { label: "B", field_type: "text", sort_order: 2 },
        { label: "A", field_type: "text", sort_order: 1 },
      ],
    };
    expect(readQuestions(withQ).map((q) => q.label)).toEqual(["A", "B"]);
  });
});

describe("isPastBooking", () => {
  it("treats completed / no_show as past", () => {
    expect(isPastBooking("completed")).toBe(true);
    expect(isPastBooking("no_show")).toBe(true);
  });
  it("treats a confirmed booking whose end has passed as past", () => {
    expect(isPastBooking("confirmed", "2000-01-01T00:00:00Z")).toBe(true);
    expect(isPastBooking("confirmed", "2999-01-01T00:00:00Z")).toBe(false);
  });
  it("never treats cancelled as past", () => {
    expect(isPastBooking("cancelled", "2000-01-01T00:00:00Z")).toBe(false);
  });
});

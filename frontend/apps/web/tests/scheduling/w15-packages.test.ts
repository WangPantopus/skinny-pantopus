// W15 · G8–G13 — Packages & invoices pure logic: money math, the package form
// (mapping + validation), credit display, and the defensive invoice helpers.

import type { Invoice, MyPackageCredit, Package } from "@pantopus/types";
import {
  dollarsToCents,
  formatCents,
  packageSubLine,
  perSessionCents,
  perSessionLabel,
} from "@/components/scheduling/packages/money";
import {
  centsToDollars,
  clampSessions,
  defaultPackageForm,
  formToInput,
  packageToForm,
  validatePackageForm,
  type PackageFormValues,
} from "@/components/scheduling/packages/packageForm";
import {
  creditCountLabel,
  creditName,
  creditProgress,
  sortCredits,
} from "@/components/scheduling/packages/credits";
import {
  dayLabel,
  filterInvoices,
  groupByDay,
  invoiceNumber,
  invoiceStatus,
  lineItemsSubtotalCents,
  matchesQuery,
  recipientLabel,
  summarizeInvoices,
  timelineEvents,
} from "@/components/scheduling/packages/invoiceHelpers";

const pkg = (over: Partial<Package> = {}): Package =>
  ({
    id: "pkg-1",
    owner_type: "business",
    owner_id: "biz-1",
    name: "5-session cleaning",
    sessions_count: 5,
    price_cents: 22000,
    currency: "USD",
    event_type_id: null,
    is_active: true,
    created_at: "2026-06-01T00:00:00Z",
    ...over,
  }) as Package;

// ─── money ──────────────────────────────────────────────────────

describe("money helpers", () => {
  it("converts dollar strings to integer cents", () => {
    expect(dollarsToCents("240")).toBe(24000);
    expect(dollarsToCents("240.50")).toBe(24050);
    expect(dollarsToCents("")).toBe(0);
    expect(dollarsToCents("-5")).toBe(0);
  });

  it("formats cents as currency without trailing zeros for round amounts", () => {
    expect(formatCents(22000, "USD")).toBe("$220");
    expect(formatCents(4450, "USD")).toBe("$44.50");
    expect(formatCents(0, "USD")).toBe("$0");
  });

  it("splits the price across sessions", () => {
    expect(perSessionCents(22000, 5)).toBe(4400);
    expect(perSessionCents(18000, 10)).toBe(1800);
    expect(perSessionCents(100, 0)).toBe(0);
  });

  it("labels per-session cost only when priced", () => {
    expect(perSessionLabel(22000, 5, "USD")).toBe("$44 each");
    expect(perSessionLabel(0, 5, "USD")).toBeNull();
  });

  it("builds the owner-list sub line with per-session math", () => {
    expect(packageSubLine(pkg())).toBe("5 sessions · $220 · $44 each");
    expect(packageSubLine(pkg({ sessions_count: 1, price_cents: 5000 }))).toBe(
      "1 session · $50 · $50 each",
    );
  });
});

// ─── package form ───────────────────────────────────────────────

describe("package form", () => {
  it("round-trips Package → form → input", () => {
    const form = packageToForm(
      pkg({ event_type_id: "et-9", price_cents: 24000 }),
    );
    expect(form.name).toBe("5-session cleaning");
    expect(form.eventTypeId).toBe("et-9");
    expect(form.priceDollars).toBe("240");
    const input = formToInput(form);
    expect(input).toMatchObject({
      name: "5-session cleaning",
      sessions_count: 5,
      price_cents: 24000,
      currency: "USD",
      event_type_id: "et-9",
      is_active: true,
    });
  });

  it("maps an empty event type to null (redeems against anything)", () => {
    const form: PackageFormValues = {
      ...defaultPackageForm(),
      eventTypeId: "",
    };
    expect(formToInput(form).event_type_id).toBeNull();
  });

  it("renders cents to a clean dollars string", () => {
    expect(centsToDollars(24000)).toBe("240");
    expect(centsToDollars(24050)).toBe("240.50");
    expect(centsToDollars(0)).toBe("");
  });

  it("clamps sessions to the backend bounds", () => {
    expect(clampSessions(0)).toBe(1);
    expect(clampSessions(5000)).toBe(1000);
    expect(clampSessions(7)).toBe(7);
  });

  it("flags a missing name, zero price, and zero sessions", () => {
    const errs = validatePackageForm({
      ...defaultPackageForm(),
      name: "  ",
      priceDollars: "0",
      sessionsCount: 0,
    });
    expect(errs.name).toBeTruthy();
    expect(errs.price_cents).toBeTruthy();
    expect(errs.sessions_count).toBeTruthy();
  });

  it("accepts a valid package", () => {
    const errs = validatePackageForm({
      ...defaultPackageForm(),
      name: "Trial pack",
      priceDollars: "120",
      sessionsCount: 3,
    });
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

// ─── credits (my-packages) ──────────────────────────────────────

const credit = (over: Partial<MyPackageCredit> = {}): MyPackageCredit =>
  ({
    id: "cr-1",
    buyer_user_id: "u-1",
    package_id: "pkg-1",
    remaining_sessions: 3,
    purchased_at: "2026-06-10T00:00:00Z",
    BookingPackage: {
      name: "5-session cleaning",
      sessions_count: 5,
      owner_type: "business",
      owner_id: "biz-1",
      event_type_id: null,
    },
    ...over,
  }) as MyPackageCredit;

describe("credit display", () => {
  it("computes remaining progress + active state", () => {
    const p = creditProgress(credit());
    expect(p).toMatchObject({ left: 3, total: 5, pct: 60, state: "active" });
  });

  it("marks a depleted credit as used", () => {
    const p = creditProgress(credit({ remaining_sessions: 0 }));
    expect(p.state).toBe("used");
    // The count keeps the "N of M left" shape when depleted — design
    // mypackages-frames.jsx:52 renders "0 of 5 left" for state==='used'. The words
    // "All used" belong to the separate uppercase pill beside it (frames line 54,
    // rendered at MyPackages.tsx:188), not to this label.
    expect(creditCountLabel(p)).toBe("0 of 5 left");
  });

  it("labels remaining sessions", () => {
    expect(creditCountLabel(creditProgress(credit()))).toBe("3 of 5 left");
  });

  it("falls back to a generic name when metadata is missing", () => {
    expect(creditName(credit({ BookingPackage: undefined }))).toBe(
      "Session package",
    );
  });

  it("sorts active credits ahead of spent ones", () => {
    const out = sortCredits([
      credit({ id: "spent", remaining_sessions: 0 }),
      credit({ id: "active", remaining_sessions: 2 }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["active", "spent"]);
  });
});

// ─── invoice helpers ────────────────────────────────────────────

const inv = (over: Record<string, unknown> = {}): Invoice =>
  ({
    id: "11111111-2222-3333-4444-555555555555",
    business_user_id: "biz-1",
    recipient_user_id: "u-2",
    total_cents: 64285,
    currency: "USD",
    created_at: "2026-06-12T10:00:00Z",
    ...over,
  }) as Invoice;

describe("invoice status + identity", () => {
  it("prefers an explicit status", () => {
    expect(invoiceStatus(inv({ status: "paid" }))).toBe("paid");
    expect(invoiceStatus(inv({ status: "overdue" }))).toBe("overdue");
  });

  it("infers from lifecycle timestamps, else falls back to sent", () => {
    expect(invoiceStatus(inv({ paid_at: "2026-06-12T11:00:00Z" }))).toBe(
      "paid",
    );
    expect(invoiceStatus(inv({ refunded_at: "x" }))).toBe("refunded");
    expect(invoiceStatus(inv())).toBe("sent");
  });

  it("derives a stable invoice number from the id when absent", () => {
    expect(invoiceNumber(inv())).toBe("INV-555555");
    expect(invoiceNumber(inv({ number: "inv-00318" }))).toBe("INV-00318");
  });

  it("degrades the recipient label gracefully", () => {
    expect(recipientLabel(inv({ recipient_name: "Marcus Chen" }))).toBe(
      "Marcus Chen",
    );
    expect(recipientLabel(inv())).toBe("Customer");
  });
});

describe("invoice totals + filtering", () => {
  it("sums line items by quantity", () => {
    const total = lineItemsSubtotalCents([
      { description: "Haircut", amount_cents: 4800 },
      { description: "Sessions", amount_cents: 2000, quantity: 2 },
    ]);
    expect(total).toBe(8800);
  });

  it("splits outstanding vs collected-this-month", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const sum = summarizeInvoices(
      [
        inv({ status: "overdue", total_cents: 10000 }),
        inv({ status: "sent", total_cents: 5000 }),
        inv({
          status: "paid",
          total_cents: 8000,
          created_at: now.toISOString(),
        }),
        inv({
          status: "paid",
          total_cents: 9000,
          created_at: "2026-05-02T00:00:00Z",
        }),
      ],
      now,
    );
    expect(sum.outstandingCents).toBe(15000);
    expect(sum.collectedCents).toBe(8000);
  });

  it("filters by status and free-text query", () => {
    const list = [
      inv({ status: "paid", recipient_name: "Dana Reyes" }),
      inv({ status: "overdue", recipient_name: "Marcus Chen" }),
    ];
    expect(filterInvoices(list, "overdue")).toHaveLength(1);
    expect(filterInvoices(list, "all")).toHaveLength(2);
    expect(matchesQuery(list[0], "dana")).toBe(true);
    expect(matchesQuery(list[0], "marcus")).toBe(false);
  });
});

describe("invoice day grouping + timeline", () => {
  const now = new Date("2026-06-12T20:00:00Z");

  it("labels created dates relative to now", () => {
    expect(dayLabel("2026-06-12T09:00:00Z", now)).toBe("Today");
    expect(dayLabel("2026-06-11T09:00:00Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-06-09T09:00:00Z", now)).toBe("Jun 9");
  });

  it("groups invoices into ordered day buckets", () => {
    const groups = groupByDay(
      [
        inv({ id: "a", created_at: "2026-06-12T09:00:00Z" }),
        inv({ id: "b", created_at: "2026-06-09T09:00:00Z" }),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Jun 9"]);
    expect(groups[0].items).toHaveLength(1);
  });

  it("builds a timeline only from present timestamps", () => {
    const events = timelineEvents(
      inv({ sent_at: "2026-06-12T11:00:00Z", paid_at: "2026-06-13T11:00:00Z" }),
    );
    expect(events.map((e) => e.key)).toEqual(["created", "sent", "paid"]);
  });
});

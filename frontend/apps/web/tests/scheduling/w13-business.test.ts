// W13 · Business config & team — pure-logic coverage for the param/owner
// injection, weekly-hours serialization, assignee builders and settings model.
// These modules carry no React/api, so they're tested directly.

import type {
  AvailabilityRule,
  BookingPage,
  BookingSlot,
  BusinessMembership,
  EventTypeAssignee,
  SeatListItem,
} from "@pantopus/types";

import {
  businessOwnerRef,
  businessOptions,
} from "@/components/scheduling/business/owner";
import {
  rosterFromSeats,
  coverageFromFreeByMember,
  intersectFreeWindows,
  freeWeekdaysLabel,
  gapLabel,
  weekdaysInRange,
} from "@/components/scheduling/business/members";
import {
  rulesToWeek,
  weekToRules,
  addRange,
  removeRange,
  copyToWeekdays,
  setDayRanges,
  formatTime,
  formatRange,
  hasInvalidRanges,
  normTime,
} from "@/components/scheduling/business/weeklyHours";
import {
  buildRoundRobinAssignees,
  buildCollectiveAssignees,
  canSaveRoundRobin,
  rotationActive,
  clampWeight,
  selectionFromAssignees,
  inferRule,
  type RoundRobinSelection,
} from "@/components/scheduling/business/assignees";
import {
  readDefaults,
  brandingPatch,
  durationLabel,
  minNoticeLabel,
  horizonLabel,
  bufferLabel,
  cancellationLabel,
  readBookableOff,
  notifyOwner,
  notifyMember,
  prefsWith,
} from "@/components/scheduling/business/settings";

// ─── owner (owner_id injection per the wiring contract) ─────────────────────

describe("businessOwnerRef / businessOptions", () => {
  const m = (over: Partial<BusinessMembership>): BusinessMembership =>
    ({
      id: "mem",
      role_base: "owner",
      joined_at: "",
      business_user_id: "biz-1",
      ...over,
    }) as BusinessMembership;

  it("maps a membership → business owner ref with owner_id = business_user_id", () => {
    expect(businessOwnerRef(m({ business_user_id: "biz-9" }))).toEqual({
      ownerType: "business",
      ownerId: "biz-9",
    });
  });

  it("returns null when there is no business id", () => {
    expect(businessOwnerRef(null)).toBeNull();
    expect(
      businessOwnerRef({ business_user_id: "" } as BusinessMembership),
    ).toBeNull();
  });

  it("dedupes options and prefers the business name", () => {
    const opts = businessOptions([
      m({ business_user_id: "a", business: { name: "Acme" } as never }),
      m({ business_user_id: "a", business: { name: "Acme" } as never }),
      m({ business_user_id: "b", title: "Side Biz", business: undefined }),
    ]);
    expect(opts.map((o) => o.id)).toEqual(["a", "b"]);
    expect(opts[0].name).toBe("Acme");
    expect(opts[1].name).toBe("Side Biz");
  });
});

// ─── members / roster / coverage ────────────────────────────────────────────

const seat = (over: Partial<SeatListItem>): SeatListItem =>
  ({
    id: "seat",
    business_user_id: "u",
    display_name: "Member",
    role_base: "member",
    is_active: true,
    invite_status: "accepted",
    created_at: "",
    updated_at: "",
    ...over,
  }) as SeatListItem;

describe("rosterFromSeats", () => {
  it("normalises, dedupes, and floats active + you to the top", () => {
    const roster = rosterFromSeats([
      seat({ business_user_id: "1", display_name: "Zoe", is_active: false }),
      seat({ business_user_id: "2", display_name: "Ann", is_you: true }),
      seat({ business_user_id: "2", display_name: "Ann dup" }), // deduped
      seat({ business_user_id: "3", display_name: "Bob", title: "Stylist" }),
    ]);
    expect(roster.map((m) => m.id)).toEqual(["2", "3", "1"]);
    expect(roster[0].isYou).toBe(true);
    expect(roster.find((m) => m.id === "3")?.role).toBe("Stylist");
    expect(roster.find((m) => m.id === "1")?.isActive).toBe(false);
  });
});

const slot = (startLocal: string): BookingSlot =>
  ({ start: startLocal, end: startLocal, startLocal }) as BookingSlot;

describe("coverage", () => {
  it("flags weekday gaps and weekend-only gaps differently", () => {
    // Window Mon Jun 15 → Sun Jun 21, 2026. Cover Mon–Wed only.
    const free = {
      a: [slot("2026-06-15T09:00:00"), slot("2026-06-16T09:00:00")],
      b: [slot("2026-06-17T09:00:00")],
    };
    const cov = coverageFromFreeByMember(
      free,
      ["a", "b"],
      "2026-06-15",
      "2026-06-21",
    );
    expect(cov.covered).toEqual([1, 2, 3]); // Mon Tue Wed
    expect(cov.hasWeekdayGap).toBe(true); // Thu/Fri uncovered
    expect(cov.gaps).toContain(4);
  });

  it("ignores members who aren't in the bookable set", () => {
    const free = { a: [slot("2026-06-21T10:00:00")] }; // Sunday
    const cov = coverageFromFreeByMember(free, [], "2026-06-21", "2026-06-21");
    expect(cov.covered).toEqual([]);
    expect(cov.gaps).toEqual([0]);
    expect(cov.hasWeekdayGap).toBe(false);
  });

  it("weekdaysInRange spans inclusive dates capped at 7", () => {
    expect(weekdaysInRange("2026-06-15", "2026-06-16")).toEqual([1, 2]);
    expect(weekdaysInRange("2026-06-15", "2026-07-30").length).toBe(7);
  });

  it("gapLabel renders friendly weekday names", () => {
    expect(gapLabel([4])).toBe("Thursdays");
    expect(gapLabel([0])).toBe("Sundays");
    expect(gapLabel([1, 4])).toBe("Monday and Thursday");
  });
});

describe("intersectFreeWindows", () => {
  it("returns the overlapping window when members share time", () => {
    const out = intersectFreeWindows(
      {
        a: [{ start: "2026-06-15T09:00:00Z", end: "2026-06-15T12:00:00Z" }],
        b: [{ start: "2026-06-15T10:00:00Z", end: "2026-06-15T14:00:00Z" }],
      },
      ["a", "b"],
    );
    expect(out).toEqual([
      { start: "2026-06-15T10:00:00Z", end: "2026-06-15T12:00:00Z" },
    ]);
  });

  it("is empty when a member has no free slots", () => {
    expect(
      intersectFreeWindows(
        {
          a: [{ start: "2026-06-15T09:00:00Z", end: "2026-06-15T12:00:00Z" }],
          b: [],
        },
        ["a", "b"],
      ),
    ).toEqual([]);
  });
});

describe("freeWeekdaysLabel", () => {
  it("collapses consecutive runs into a range", () => {
    const slots = [
      slot("2026-06-15T09:00:00"),
      slot("2026-06-16T09:00:00"),
      slot("2026-06-17T09:00:00"),
      slot("2026-06-18T09:00:00"),
      slot("2026-06-19T09:00:00"),
    ];
    expect(freeWeekdaysLabel(slots)).toBe("Mon–Fri");
  });
  it("lists sparse days and handles empty", () => {
    expect(
      freeWeekdaysLabel([
        slot("2026-06-16T09:00:00"),
        slot("2026-06-20T09:00:00"),
      ]),
    ).toBe("Tue, Sat");
    expect(freeWeekdaysLabel([])).toMatch(/no bookable hours/i);
  });
});

// ─── weekly hours serialization ─────────────────────────────────────────────

describe("weekly-hours (de)serialization", () => {
  const rules: AvailabilityRule[] = [
    { weekday: 1, start_time: "09:00", end_time: "17:00" },
    { weekday: 3, start_time: "13:00:00", end_time: "17:00:00" },
    { weekday: 3, start_time: "09:00", end_time: "12:00" },
  ];

  it("groups rules Monday-first with ranges sorted, normalising HH:MM:SS", () => {
    const week = rulesToWeek(rules);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    const wed = week.find((d) => d.weekday === 3)!;
    expect(wed.ranges).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
  });

  it("round-trips rules → week → rules (order-insensitive)", () => {
    const back = weekToRules(rulesToWeek(rules));
    expect(back).toHaveLength(3);
    expect(back).toContainEqual({
      weekday: 1,
      start_time: "09:00",
      end_time: "17:00",
    });
    expect(back).toContainEqual({
      weekday: 3,
      start_time: "09:00",
      end_time: "12:00",
    });
  });

  it("add / remove / copy-to-weekdays mutate immutably", () => {
    let week = rulesToWeek([]);
    week = addRange(week, 1); // Monday → default 9–5
    expect(week.find((d) => d.weekday === 1)!.ranges).toEqual([
      { start: "09:00", end: "17:00" },
    ]);
    week = copyToWeekdays(week, 1);
    for (const wd of [1, 2, 3, 4, 5]) {
      expect(week.find((d) => d.weekday === wd)!.ranges).toEqual([
        { start: "09:00", end: "17:00" },
      ]);
    }
    expect(week.find((d) => d.weekday === 0)!.ranges).toEqual([]); // Sunday untouched
    week = removeRange(week, 1, 0);
    expect(week.find((d) => d.weekday === 1)!.ranges).toEqual([]);
  });

  it("detects invalid + overlapping ranges", () => {
    let week = setDayRanges(rulesToWeek([]), 1, [
      { start: "17:00", end: "09:00" },
    ]);
    expect(hasInvalidRanges(week)).toBe(true);
    week = setDayRanges(rulesToWeek([]), 1, [
      { start: "09:00", end: "12:00" },
      { start: "11:00", end: "14:00" },
    ]);
    expect(hasInvalidRanges(week)).toBe(true);
    week = setDayRanges(rulesToWeek([]), 1, [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
    expect(hasInvalidRanges(week)).toBe(false);
  });

  it("formats 24h times to am/pm", () => {
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("13:30")).toBe("1:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatRange({ start: "09:00", end: "17:00" })).toBe(
      "9:00 AM–5:00 PM",
    );
    expect(normTime("9:5")).toBe("9:5"); // malformed passthrough
    expect(normTime("9:05:00")).toBe("09:05");
  });
});

// ─── assignee builders (the /assignees REPLACE payload) ─────────────────────

describe("round-robin assignees", () => {
  const base = (over: Partial<RoundRobinSelection>): RoundRobinSelection => ({
    rule: "balanced",
    order: ["a", "b", "c"],
    selected: new Set(["a", "b"]),
    weights: { a: 2, b: 1, c: 1 },
    ...over,
  });

  it("balanced carries weight, flat priority", () => {
    const out = buildRoundRobinAssignees(base({}));
    expect(out).toEqual([
      {
        subject_id: "a",
        subject_type: "business_team",
        weight: 2,
        priority: 0,
        is_active: true,
      },
      {
        subject_id: "b",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
    ]);
  });

  it("priority encodes list order, weight flat", () => {
    const out = buildRoundRobinAssignees(
      base({ rule: "priority", selected: new Set(["a", "b", "c"]) }),
    );
    expect(out.map((a) => [a.subject_id, a.weight, a.priority])).toEqual([
      ["a", 1, 0],
      ["b", 1, 1],
      ["c", 1, 2],
    ]);
  });

  it("strict is flat weight + priority", () => {
    const out = buildRoundRobinAssignees(base({ rule: "strict" }));
    expect(out.every((a) => a.weight === 1 && a.priority === 0)).toBe(true);
  });

  it("clamps weights and gates save / rotation on member count", () => {
    expect(clampWeight(0)).toBe(1);
    expect(clampWeight(99)).toBe(9);
    expect(canSaveRoundRobin(base({ selected: new Set() }))).toBe(false);
    expect(canSaveRoundRobin(base({ selected: new Set(["a"]) }))).toBe(true);
    expect(rotationActive(base({ selected: new Set(["a"]) }))).toBe(false);
    expect(rotationActive(base({ selected: new Set(["a", "b"]) }))).toBe(true);
  });

  it("hydrates selection from existing assignees and infers the rule", () => {
    const existing: EventTypeAssignee[] = [
      {
        subject_id: "b",
        subject_type: "business_team",
        weight: 1,
        priority: 1,
        is_active: true,
      },
      {
        subject_id: "a",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
    ];
    const sel = selectionFromAssignees(existing, ["a", "b", "c"]);
    expect(sel.order).toEqual(["a", "b", "c"]); // priority order, then remaining roster
    expect([...sel.selected].sort()).toEqual(["a", "b"]);
    expect(sel.rule).toBe("priority");
    expect(
      inferRule([
        {
          subject_id: "a",
          subject_type: "business_team",
          weight: 3,
          priority: 0,
          is_active: true,
        },
      ]),
    ).toBe("balanced");
  });
});

describe("collective assignees", () => {
  it("builds a flat, all-required set", () => {
    expect(buildCollectiveAssignees(["a", "b"])).toEqual([
      {
        subject_id: "a",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
      {
        subject_id: "b",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
    ]);
  });
});

// ─── settings model ─────────────────────────────────────────────────────────

const pageWith = (branding: Record<string, unknown>): BookingPage =>
  ({
    id: "p",
    owner_type: "business",
    owner_id: "biz",
    slug: "acme",
    is_live: true,
    is_paused: false,
    title: null,
    tagline: null,
    avatar_url: null,
    intro: null,
    confirmation_message: null,
    timezone: "America/Los_Angeles",
    reminder_minutes: [],
    cancellation_policy: null,
    visibility: "listed",
    branding,
    created_at: "",
    updated_at: "",
  }) as BookingPage;

describe("scheduling defaults (branding-backed)", () => {
  it("reads defaults and falls back when keys are absent", () => {
    const d = readDefaults(
      pageWith({
        default_requires_approval: true,
        default_min_notice_min: 120,
      }),
    );
    expect(d.confirmation).toBe("approve");
    expect(d.minNoticeMin).toBe(120);
    expect(d.maxHorizonDays).toBe(60); // default
  });

  it("brandingPatch preserves unknown keys and round-trips", () => {
    const page = pageWith({ keep: "me", default_requires_approval: false });
    const patched = brandingPatch(page, {
      confirmation: "approve",
      minNoticeMin: 240,
    });
    expect(patched.keep).toBe("me");
    expect(patched.default_requires_approval).toBe(true);
    const reread = readDefaults(pageWith(patched));
    expect(reread.confirmation).toBe("approve");
    expect(reread.minNoticeMin).toBe(240);
  });

  it("bookable opt-outs round-trip through branding", () => {
    const page = pageWith({});
    const patched = brandingPatch(page, { bookableOff: ["u1", "u2"] });
    expect(readBookableOff(pageWith(patched))).toEqual(["u1", "u2"]);
  });

  it("labels are human and sensible", () => {
    expect(durationLabel(240)).toBe("4 hours");
    expect(durationLabel(60)).toBe("1 hour");
    expect(durationLabel(2880)).toBe("2 days");
    expect(minNoticeLabel(30)).toBe("30 min");
    expect(horizonLabel(60)).toBe("60 days out");
    expect(bufferLabel(0, 0)).toBe("None");
    expect(bufferLabel(10, 10)).toBe("10 min before · 10 after");
    expect(cancellationLabel({ cutoff_min: 1440, refund_policy: "full" })).toBe(
      "Flexible · 1 day",
    );
    expect(cancellationLabel(null)).toBeNull();
  });

  it("notify toggles default sensibly and round-trip", () => {
    expect(notifyOwner({})).toBe(true); // default on
    expect(notifyMember({})).toBe(false); // default off
    const next = prefsWith({}, { notifyOwner: false, notifyMember: true });
    expect(notifyOwner(next)).toBe(false);
    expect(notifyMember(next)).toBe(true);
  });
});

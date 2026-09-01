// W8 — targeted tests for the bookings inbox/detail pure logic: date/day
// bucketing + formatting, owner scope/query builders, and the lifecycle
// action state-machine. (UI is verified in the browser against the live API.)

import {
  bucketFor,
  durationLabel,
  durationMin,
  formatRange,
  groupBookings,
  initials,
  inviteeDisplay,
  dayDiff,
} from "@/components/scheduling/bookings/format";
import {
  availablePillars,
  canReassign,
  ownerFromQuery,
  ownersForScope,
  ownerQueryString,
  ownerToQuery,
  pillarOfOwner,
  type ScopeOwners,
} from "@/components/scheduling/bookings/owners";
import {
  availableActions,
  isPast,
  isTerminal,
  optimisticStatus,
} from "@/components/scheduling/bookings/bookingActions";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("format", () => {
  it("formatRange collapses a shared meridiem and shows the range", () => {
    const out = formatRange(
      "2026-06-18T14:00:00Z",
      "2026-06-18T14:30:00Z",
      "UTC",
    );
    expect(out).toContain("Jun 18");
    expect(out).toContain("2:00–2:30 PM");
  });

  it("durationMin / durationLabel", () => {
    expect(durationMin("2026-06-18T14:00:00Z", "2026-06-18T14:30:00Z")).toBe(
      30,
    );
    expect(durationLabel("2026-06-18T14:00:00Z", "2026-06-18T14:30:00Z")).toBe(
      "30 min",
    );
    expect(durationLabel("2026-06-18T14:00:00Z", "2026-06-18T15:00:00Z")).toBe(
      "1 hr",
    );
    expect(durationLabel("2026-06-18T14:00:00Z", "2026-06-18T15:30:00Z")).toBe(
      "1 hr 30 min",
    );
  });

  it("initials + invitee display", () => {
    expect(initials("Dana Whitfield")).toBe("DW");
    expect(initials("Madonna")).toBe("MA");
    expect(initials("")).toBe("?");
    expect(inviteeDisplay(null)).toBe("Guest");
    expect(inviteeDisplay("Theo")).toBe("Theo");
  });

  it("dayDiff is calendar-day based", () => {
    expect(dayDiff("2026-06-16", "2026-06-15")).toBe(1);
    expect(dayDiff("2026-06-15", "2026-06-15")).toBe(0);
    expect(dayDiff("2026-06-10", "2026-06-15")).toBe(-5);
  });

  it("bucketFor future direction", () => {
    expect(bucketFor("2026-06-15T18:00:00Z", "UTC", false, NOW).key).toBe(
      "today",
    );
    expect(bucketFor("2026-06-16T09:00:00Z", "UTC", false, NOW).key).toBe(
      "tomorrow",
    );
    expect(bucketFor("2026-06-20T09:00:00Z", "UTC", false, NOW).key).toBe(
      "week",
    );
    expect(bucketFor("2026-06-30T09:00:00Z", "UTC", false, NOW).key).toBe(
      "later",
    );
  });

  it("bucketFor past direction", () => {
    expect(bucketFor("2026-06-14T09:00:00Z", "UTC", true, NOW).key).toBe(
      "yesterday",
    );
    expect(bucketFor("2026-06-10T09:00:00Z", "UTC", true, NOW).key).toBe(
      "earlier_week",
    );
    expect(bucketFor("2026-05-01T09:00:00Z", "UTC", true, NOW).key).toBe(
      "earlier",
    );
  });

  it("groupBookings preserves input order and buckets by day", () => {
    const items = [
      { start_at: "2026-06-15T18:00:00Z" },
      { start_at: "2026-06-16T09:00:00Z" },
      { start_at: "2026-06-16T11:00:00Z" },
    ];
    const groups = groupBookings(items, (i) => i.start_at, "UTC", false, NOW);
    expect(groups.map((g) => g.key)).toEqual(["today", "tomorrow"]);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].items).toHaveLength(2);
    expect(groups[1].label).toBe("Tomorrow");
  });
});

describe("owners", () => {
  it("ownerToQuery / ownerQueryString per pillar", () => {
    expect(ownerToQuery({ ownerType: "user" })).toEqual({});
    expect(ownerToQuery({ ownerType: "business", ownerId: "b1" })).toEqual({
      ot: "business",
      oid: "b1",
    });
    expect(ownerToQuery({ ownerType: "home", homeId: "h1" })).toEqual({
      ot: "home",
      oid: "h1",
    });
    expect(ownerQueryString({ ownerType: "user" })).toBe("");
    expect(ownerQueryString({ ownerType: "business", ownerId: "b1" })).toBe(
      "?ot=business&oid=b1",
    );
  });

  it("ownerFromQuery is the inverse of ownerToQuery", () => {
    const ref = { ownerType: "business", ownerId: "b1" } as const;
    const q = ownerToQuery(ref);
    expect(ownerFromQuery((k) => q[k] ?? null)).toEqual(ref);
    expect(ownerFromQuery(() => null)).toEqual({ ownerType: "user" });
  });

  it("pillarOfOwner + canReassign", () => {
    expect(pillarOfOwner({ ownerType: "home", homeId: "h" })).toBe("home");
    expect(pillarOfOwner({ ownerType: "business", ownerId: "b" })).toBe(
      "business",
    );
    expect(pillarOfOwner({ ownerType: "user" })).toBe("personal");
    expect(canReassign({ ownerType: "user" })).toBe(false);
    expect(canReassign({ ownerType: "business", ownerId: "b" })).toBe(true);
    expect(canReassign({ ownerType: "home", homeId: "h" })).toBe(true);
  });

  it("availablePillars + ownersForScope", () => {
    const onlyPersonal: ScopeOwners = {
      personal: { owner: { ownerType: "user" }, name: "Personal" },
      home: { owner: null, name: "Home" },
      business: { owner: null, name: "Business" },
    };
    expect(availablePillars(onlyPersonal)).toEqual(["personal"]);
    expect(ownersForScope("all", onlyPersonal)).toHaveLength(1);
    expect(ownersForScope("home", onlyPersonal)).toHaveLength(0);

    const full: ScopeOwners = {
      personal: { owner: { ownerType: "user" }, name: "Personal" },
      home: { owner: { ownerType: "home", homeId: "h1" }, name: "Riverside" },
      business: {
        owner: { ownerType: "business", ownerId: "b1" },
        name: "Acme",
      },
    };
    expect(availablePillars(full)).toEqual(["personal", "home", "business"]);
    expect(ownersForScope("all", full)).toHaveLength(3);
    expect(ownersForScope("business", full)[0].name).toBe("Acme");
  });
});

describe("bookingActions", () => {
  it("optimisticStatus mapping", () => {
    expect(optimisticStatus("approve")).toBe("confirmed");
    expect(optimisticStatus("decline")).toBe("declined");
    expect(optimisticStatus("cancel")).toBe("cancelled");
    expect(optimisticStatus("no_show")).toBe("no_show");
    expect(optimisticStatus("reschedule")).toBeNull();
    expect(optimisticStatus("nudge")).toBeNull();
  });

  it("isTerminal + isPast", () => {
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("declined")).toBe(true);
    expect(isTerminal("no_show")).toBe(true);
    expect(isTerminal("confirmed")).toBe(false);
    expect(isPast({ end_at: "2026-06-10T00:00:00Z" }, NOW)).toBe(true);
    expect(isPast({ end_at: "2026-06-20T00:00:00Z" }, NOW)).toBe(false);
  });

  it("availableActions by status", () => {
    expect(
      availableActions(
        { status: "pending", end_at: "2026-06-20T00:00:00Z" },
        {
          canReassign: true,
          now: NOW,
        },
      ),
    ).toEqual(["approve", "decline", "message"]);

    const confirmedFuture = availableActions(
      { status: "confirmed", end_at: "2026-06-20T00:00:00Z" },
      { canReassign: true, now: NOW },
    );
    expect(confirmedFuture).toContain("reschedule");
    expect(confirmedFuture).toContain("reassign");
    expect(confirmedFuture).toContain("cancel");

    const confirmedPersonal = availableActions(
      { status: "confirmed", end_at: "2026-06-20T00:00:00Z" },
      { canReassign: false, now: NOW },
    );
    expect(confirmedPersonal).not.toContain("reassign");

    expect(
      availableActions(
        { status: "confirmed", end_at: "2026-06-10T00:00:00Z" },
        { canReassign: false, now: NOW },
      ),
    ).toEqual(["message", "no_show", "nudge"]);

    expect(
      availableActions(
        { status: "cancelled", end_at: "2026-06-10T00:00:00Z" },
        {
          canReassign: true,
          now: NOW,
        },
      ),
    ).toEqual([]);
  });
});

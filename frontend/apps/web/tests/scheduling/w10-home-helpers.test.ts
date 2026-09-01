// W10 — Home calendar & RSVP. Targeted unit tests for this stream's pure
// logic: category mapping, recurrence round-trip, reminder normalisation,
// day-grouping of the union, datetime-local conversion, and member resolution.

import {
  categoryFor,
  EVENT_CATEGORIES,
  PICKABLE_CATEGORIES,
  repeatToRule,
  ruleToRepeat,
  recurrenceLabel,
  remindersToMinutes,
  minutesLabel,
  groupByDay,
  initialsFor,
  resolveMembers,
  isoToLocalInput,
  localInputToIso,
  type HomeMember,
} from "@/components/scheduling/home/helpers";
import type { HomeCalendarUnionEvent } from "@pantopus/types";

function ev(
  partial: Partial<HomeCalendarUnionEvent> & { id: string; start_at: string },
): HomeCalendarUnionEvent {
  return {
    home_id: "h1",
    event_type: "other",
    title: "Event",
    description: null,
    end_at: null,
    location_notes: null,
    recurrence_rule: null,
    assigned_to: null,
    alerts_enabled: true,
    created_by: "u1",
    created_at: partial.start_at,
    updated_at: partial.start_at,
    visibility: "members",
    source: "event",
    ...partial,
  };
}

describe("event categories", () => {
  it("maps known event_type to a category, unknown to 'other'", () => {
    expect(categoryFor("chore").label).toBe("Chore");
    expect(categoryFor("appointment").color).toBe(
      EVENT_CATEGORIES.appointment.color,
    );
    expect(categoryFor("does-not-exist").value).toBe("other");
    expect(categoryFor(null).value).toBe("other");
  });

  it("only offers persistable enum values in the picker", () => {
    for (const c of PICKABLE_CATEGORIES) {
      expect(EVENT_CATEGORIES[c.value]).toBeDefined();
    }
  });
});

describe("recurrence round-trip", () => {
  it("converts repeat option <-> RRULE", () => {
    expect(repeatToRule("No")).toBeNull();
    expect(repeatToRule("Weekly")).toBe("FREQ=WEEKLY");
    expect(ruleToRepeat("FREQ=WEEKLY")).toBe("Weekly");
    expect(ruleToRepeat("FREQ=MONTHLY;INTERVAL=1")).toBe("Monthly");
    expect(ruleToRepeat(null)).toBe("No");
  });

  it("labels recurrence for the detail grid", () => {
    expect(recurrenceLabel(null)).toBe("Does not repeat");
    expect(recurrenceLabel("FREQ=DAILY")).toBe("Every day");
  });
});

describe("reminders", () => {
  it("normalises mixed jsonb shapes into sorted unique minutes", () => {
    expect(remindersToMinutes([10, { minutes: 60 }, 10, 0])).toEqual([
      0, 10, 60,
    ]);
    expect(remindersToMinutes(undefined)).toEqual([]);
    expect(remindersToMinutes(["bad", null])).toEqual([]);
  });

  it("labels minute offsets", () => {
    expect(minutesLabel(0)).toBe("At time");
    expect(minutesLabel(10)).toBe("10 min before");
    expect(minutesLabel(60)).toBe("1 hour before");
    expect(minutesLabel(1440)).toBe("1 day before");
  });
});

describe("groupByDay (union agenda)", () => {
  it("groups events by local day and sorts within/between days", () => {
    const today = new Date(2026, 5, 16); // Jun 16 2026 local
    const d = (h: number, day = 16) =>
      new Date(2026, 5, day, h, 0, 0).toISOString();
    const events = [
      ev({ id: "b", start_at: d(18) }),
      ev({ id: "a", start_at: d(8) }),
      ev({ id: "c", start_at: d(9, 17) }),
    ];
    const groups = groupByDay(events, today);
    expect(groups).toHaveLength(2);
    // first day sorted ascending by time
    expect(groups[0].events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(groups[0].heading.startsWith("Today")).toBe(true);
    expect(groups[1].heading.startsWith("Tomorrow")).toBe(true);
  });
});

describe("datetime-local conversion", () => {
  it("round-trips an ISO instant through the local input value", () => {
    const iso = new Date(2026, 5, 16, 18, 30).toISOString();
    const local = isoToLocalInput(iso);
    expect(local).toMatch(/^2026-06-16T18:30$/);
    expect(localInputToIso(local)).toBe(iso);
  });

  it("handles empty / invalid input", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(localInputToIso("")).toBeNull();
  });
});

describe("member resolution", () => {
  const byId = new Map<string, HomeMember>([
    [
      "u1",
      {
        id: "u1",
        name: "Maria K",
        initials: "MK",
        avatarUrl: null,
        gradient: "g",
      },
    ],
  ]);

  it("derives initials from a display name", () => {
    expect(initialsFor("Maria Kowalski")).toBe("MK");
    expect(initialsFor("Ava")).toBe("AV");
    expect(initialsFor("")).toBe("?");
  });

  it("resolves known ids and stubs unknown ones", () => {
    const resolved = resolveMembers(["u1", "u404"], byId);
    expect(resolved[0].name).toBe("Maria K");
    expect(resolved[1].name).toBe("Member");
    expect(resolveMembers(null, byId)).toEqual([]);
  });
});

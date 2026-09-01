// W1 Setup & Hub — targeted unit tests for this stream's pure logic:
// slug validation (A2/A6), weekly-hours serialization (A2 param builder),
// notification-prefs read/write round-trip incl. unknown-key preservation (A4),
// and the hub formatters (A1/A5).

import { isValidSlug, sanitizeSlug } from "@/components/scheduling/hub/slug";
import {
  DEFAULT_WEEK,
  weekToRules,
} from "@/components/scheduling/hub/weeklyHours";
import {
  DEFAULT_REMINDERS,
  readChannels,
  readReminders,
  writeChannels,
  writeReminders,
  type Prefs,
} from "@/components/scheduling/hub/notificationPrefs";
import {
  durationLabel,
  initials,
  reminderLabel,
} from "@/components/scheduling/hub/format";

describe("slug helpers", () => {
  it("sanitizes to lowercase, strips invalid chars and collapses hyphens", () => {
    expect(sanitizeSlug("Maria Kowalski!")).toBe("mariakowalski");
    expect(sanitizeSlug("Acme  Co")).toBe("acmeco");
    expect(sanitizeSlug("a--b__c")).toBe("a-bc");
    expect(sanitizeSlug("UPPER-Case-123")).toBe("upper-case-123");
  });

  it("caps length at 50 characters", () => {
    expect(sanitizeSlug("a".repeat(80))).toHaveLength(50);
  });

  it("validates against the backend slug rule", () => {
    expect(isValidSlug("maria-k")).toBe(true);
    expect(isValidSlug("acme-co")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    // too short (min 3), edge hyphens, uppercase, and bad chars are rejected
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
    expect(isValidSlug("a b")).toBe(false);
    expect(isValidSlug("a".repeat(51))).toBe(false);
  });
});

describe("weekToRules (availability serialization)", () => {
  it("emits one rule per enabled weekday, Monday-first", () => {
    const rules = weekToRules(DEFAULT_WEEK);
    expect(rules).toEqual([
      { weekday: 1, start_time: "09:00", end_time: "17:00" },
      { weekday: 2, start_time: "09:00", end_time: "17:00" },
      { weekday: 3, start_time: "09:00", end_time: "17:00" },
      { weekday: 4, start_time: "09:00", end_time: "17:00" },
      { weekday: 5, start_time: "09:00", end_time: "17:00" },
    ]);
  });

  it("drops disabled days and invalid ranges", () => {
    const week = DEFAULT_WEEK.map((d) =>
      d.weekday === 1
        ? { ...d, enabled: false }
        : d.weekday === 2
          ? { ...d, start: "17:00", end: "09:00" } // start >= end → dropped
          : d,
    );
    const weekdays = weekToRules(week).map((r) => r.weekday);
    expect(weekdays).toEqual([3, 4, 5]);
  });
});

describe("notification preferences round-trip", () => {
  it("returns the default channels when nothing is stored", () => {
    expect(
      readChannels({}, "host", "new_booking", { push: true, email: true }),
    ).toEqual({
      push: true,
      email: true,
    });
  });

  it("round-trips a written channel toggle", () => {
    let prefs: Prefs = {};
    prefs = writeChannels(prefs, "host", "new_booking", {
      push: false,
      email: true,
    });
    expect(
      readChannels(prefs, "host", "new_booking", { push: true, email: true }),
    ).toEqual({
      push: false,
      email: true,
    });
  });

  it("preserves unknown keys when writing (flexible object contract)", () => {
    const prefs: Prefs = {
      backend_managed: { quiet_hours: "22:00" },
      scheduling: { legacy_flag: true },
    };
    const next = writeChannels(prefs, "attendee", "reminder", {
      push: false,
      email: false,
    });
    expect(next.backend_managed).toEqual({ quiet_hours: "22:00" });
    expect((next.scheduling as Record<string, unknown>).legacy_flag).toBe(true);
  });

  it("defaults, sorts (desc), and round-trips reminder lead-times", () => {
    expect(readReminders({})).toEqual(DEFAULT_REMINDERS);
    const next = writeReminders({ scheduling: { keep: 1 } }, [15, 1440, 60]);
    expect(readReminders(next)).toEqual([1440, 60, 15]);
    expect((next.scheduling as Record<string, unknown>).keep).toBe(1);
  });
});

describe("hub formatters", () => {
  it("formats reminder lead-times", () => {
    expect(reminderLabel(10080)).toBe("7 days");
    expect(reminderLabel(1440)).toBe("1 day");
    expect(reminderLabel(120)).toBe("2 hrs");
    expect(reminderLabel(60)).toBe("1 hr");
    expect(reminderLabel(15)).toBe("15 min");
  });

  it("derives initials safely", () => {
    expect(initials("Daniel Reyes")).toBe("DR");
    expect(initials("Maria Kowalski Jr")).toBe("MK");
    expect(initials(null)).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("labels booking durations", () => {
    const base = "2026-06-15T14:00:00.000Z";
    expect(durationLabel(base, "2026-06-15T14:30:00.000Z")).toBe("30 min");
    expect(durationLabel(base, "2026-06-15T15:00:00.000Z")).toBe("1 hr");
    expect(durationLabel(base, "2026-06-15T15:30:00.000Z")).toBe("1 hr 30 min");
  });
});

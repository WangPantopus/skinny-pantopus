// W16 · H1 — Default-reminders pure logic (no React, unit-testable).
//
// Lead-times persist inside the flexible /notification-preferences object at
// `prefs.scheduling.reminder_minutes` — the SAME location W1's A4 prefs screen
// reads/writes — so H1 (this stream's dedicated reminders route) and A4 stay in
// sync. Every unknown key in the prefs object is round-tripped untouched.

export type Prefs = Record<string, unknown>;

/** The preset rows shown in the H1 quick-setup card (minutes before start). */
export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 10080, label: "1 week before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 0, label: "At start" },
];

/** Smart default — the two reminders most people keep (1 day + 1 hour). */
export const DEFAULT_REMINDERS = [1440, 60];

/** Units offered by the "Add custom time" affordance. */
export const CUSTOM_UNITS: { id: CustomUnit; label: string; per: number }[] = [
  { id: "minutes", label: "minutes", per: 1 },
  { id: "hours", label: "hours", per: 60 },
  { id: "days", label: "days", per: 1440 },
  { id: "weeks", label: "weeks", per: 10080 },
];

export type CustomUnit = "minutes" | "hours" | "days" | "weeks";

/** Read `scheduling` sub-object, tolerating any non-object value. */
function readScheduling(prefs: Prefs): Record<string, unknown> {
  const v = prefs.scheduling;
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/**
 * Current reminder lead-times. An explicit empty array means "no reminders"
 * (and is preserved); only an absent key falls back to the smart default.
 */
export function readReminders(prefs: Prefs): number[] {
  const r = readScheduling(prefs).reminder_minutes;
  if (Array.isArray(r))
    return r.filter((n): n is number => typeof n === "number");
  return [...DEFAULT_REMINDERS];
}

/** Write lead-times back, deduped + sorted descending, preserving other keys. */
export function writeReminders(prefs: Prefs, minutes: number[]): Prefs {
  const sched = readScheduling(prefs);
  const cleaned = Array.from(new Set(minutes.filter((n) => n >= 0))).sort(
    (a, b) => b - a,
  );
  return {
    ...prefs,
    scheduling: { ...sched, reminder_minutes: cleaned },
  };
}

/** Convert a custom value + unit to minutes (NaN/negative → null). */
export function customToMinutes(
  value: number,
  unit: CustomUnit,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const per = CUSTOM_UNITS.find((u) => u.id === unit)?.per ?? 1;
  return Math.round(value * per);
}

/** Compact label: "1 week" · "1 day" · "1 hour" · "15 min" · "at start". */
export function reminderShort(min: number): string {
  if (min <= 0) return "at start";
  if (min % 10080 === 0) {
    const n = min / 10080;
    return `${n} week${n > 1 ? "s" : ""}`;
  }
  if (min % 1440 === 0) {
    const n = min / 1440;
    return `${n} day${n > 1 ? "s" : ""}`;
  }
  if (min % 60 === 0) {
    const n = min / 60;
    return `${n} hour${n > 1 ? "s" : ""}`;
  }
  return `${min} min`;
}

/** Row label for the H1 card: "1 day before" · "At start". */
export function reminderRowLabel(min: number): string {
  if (min <= 0) return "At start";
  return `${reminderShort(min)} before`;
}

/** One-line summary for the pinned card / hub: "1 day + 1 hour before". */
export function summarizeReminders(minutes: number[]): string {
  if (minutes.length === 0) return "No reminders";
  const sorted = [...new Set(minutes)].sort((a, b) => b - a);
  const body = sorted.map(reminderShort).join(" + ");
  return sorted.every((m) => m > 0) ? `${body} before` : body;
}

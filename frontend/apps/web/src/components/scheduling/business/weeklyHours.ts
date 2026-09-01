// Weekly-hours grid model + (de)serialization for the Member working-hours
// editor (G4). Mirrors the Support Trains weekday + time-range grid: each day
// holds zero or more time ranges; the backend stores them as flat
// AvailabilityRule rows ({ weekday 0–6, start_time 'HH:MM', end_time 'HH:MM' }).
// Pure (no React) so the serialization round-trip is unit-testable.

import type { AvailabilityRule } from "@pantopus/types";

export interface HourRange {
  /** 24-hour 'HH:MM'. */
  start: string;
  end: string;
}

export interface DayHours {
  /** Backend weekday: 0=Sunday … 6=Saturday. */
  weekday: number;
  /** Short label ('Mon'). */
  label: string;
  ranges: HourRange[];
}

// Display order is Monday-first (matches the design), but weekday numbers stay
// ISO (0=Sunday) so they round-trip with the backend unchanged.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekdayShort(weekday: number): string {
  return SHORT[weekday] ?? "";
}
export function weekdayLong(weekday: number): string {
  return LONG[weekday] ?? "";
}

/** Normalise an 'HH:MM' / 'HH:MM:SS' time to 'HH:MM'. */
export function normTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return t;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Group flat rules into the Monday-first day model, ranges sorted by start. */
export function rulesToWeek(rules: AvailabilityRule[] | undefined): DayHours[] {
  const byDay = new Map<number, HourRange[]>();
  for (const r of rules ?? []) {
    const wd = r.weekday;
    if (wd < 0 || wd > 6) continue;
    const list = byDay.get(wd) ?? [];
    list.push({ start: normTime(r.start_time), end: normTime(r.end_time) });
    byDay.set(wd, list);
  }
  return DISPLAY_ORDER.map((weekday) => ({
    weekday,
    label: SHORT[weekday],
    ranges: (byDay.get(weekday) ?? []).sort((a, b) =>
      a.start.localeCompare(b.start),
    ),
  }));
}

/** Flatten the day model back to the rule rows the backend PUT expects. */
export function weekToRules(week: DayHours[]): AvailabilityRule[] {
  const out: AvailabilityRule[] = [];
  for (const day of week) {
    for (const r of day.ranges) {
      out.push({
        weekday: day.weekday,
        start_time: normTime(r.start),
        end_time: normTime(r.end),
      });
    }
  }
  return out;
}

/** A range is valid when start strictly precedes end. */
export function isValidRange(r: HourRange): boolean {
  return normTime(r.start) < normTime(r.end);
}

/** True if any day holds an invalid or overlapping range. */
export function hasInvalidRanges(week: DayHours[]): boolean {
  for (const day of week) {
    const sorted = [...day.ranges].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    for (let i = 0; i < sorted.length; i++) {
      if (!isValidRange(sorted[i])) return true;
      if (i > 0 && normTime(sorted[i].start) < normTime(sorted[i - 1].end))
        return true; // overlap
    }
  }
  return false;
}

const DEFAULT_RANGE: HourRange = { start: "09:00", end: "17:00" };

/** Immutably set a day's ranges. */
export function setDayRanges(
  week: DayHours[],
  weekday: number,
  ranges: HourRange[],
): DayHours[] {
  return week.map((d) => (d.weekday === weekday ? { ...d, ranges } : d));
}

/** Add a sensible new range to a day (after the last one, else 9–5). */
export function addRange(week: DayHours[], weekday: number): DayHours[] {
  return week.map((d) => {
    if (d.weekday !== weekday) return d;
    const last = d.ranges[d.ranges.length - 1];
    const next: HourRange = last
      ? { start: last.end, end: bump(last.end, 60) }
      : DEFAULT_RANGE;
    return { ...d, ranges: [...d.ranges, next] };
  });
}

export function removeRange(
  week: DayHours[],
  weekday: number,
  index: number,
): DayHours[] {
  return week.map((d) =>
    d.weekday === weekday
      ? { ...d, ranges: d.ranges.filter((_, i) => i !== index) }
      : d,
  );
}

/** Copy one day's ranges onto the five weekdays (Mon–Fri), matching the design's
 *  "Copy Monday to weekdays" affordance. */
export function copyToWeekdays(
  week: DayHours[],
  fromWeekday: number,
): DayHours[] {
  const source = week.find((d) => d.weekday === fromWeekday)?.ranges ?? [];
  const WEEKDAYS = new Set([1, 2, 3, 4, 5]);
  return week.map((d) =>
    WEEKDAYS.has(d.weekday)
      ? { ...d, ranges: source.map((r) => ({ ...r })) }
      : d,
  );
}

/** Total bookable minutes across the week (used for an empty/coverage hint). */
export function totalWeeklyMinutes(week: DayHours[]): number {
  let mins = 0;
  for (const d of week) {
    for (const r of d.ranges)
      mins += Math.max(0, toMin(r.end) - toMin(r.start));
  }
  return mins;
}

// ─── time formatting ─────────────────────────────────────────────────────────

function toMin(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function bump(t: string, mins: number): string {
  const total = Math.min(24 * 60, toMin(t) + mins);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** '09:00' → '9:00 AM', '13:30' → '1:30 PM', '24:00' → '12:00 AM'. */
export function formatTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  const ap = h < 12 || h === 24 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
}

/** '9:00 AM–5:00 PM' (en-dash). */
export function formatRange(r: HourRange): string {
  return `${formatTime(r.start)}–${formatTime(r.end)}`;
}

/** Generates 'HH:MM' option values on a 30-min grid for the time selects. */
export function timeOptions(stepMin = 30): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += stepMin) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    out.push({ value, label: formatTime(value) });
  }
  return out;
}

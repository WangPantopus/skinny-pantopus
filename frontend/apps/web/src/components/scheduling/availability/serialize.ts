// W3 Availability — pure serialization between the backend rule/override shape
// and the editor's day model, plus the list summary and US-holiday helpers.
// No React, no API — unit-tested in tests/scheduling/availabilitySerialize.test.ts.

import type { AvailabilityRule } from "@pantopus/types";
import {
  WEEK_ORDER_MON_FIRST,
  dayName,
  normalizeTime,
  rangeLabel,
} from "./format";

export interface DayBlock {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
}

export interface DayModel {
  weekday: number; // 0=Sun … 6=Sat
  on: boolean;
  blocks: DayBlock[];
}

export const DEFAULT_BLOCK: DayBlock = { start: "09:00", end: "17:00" };

/** Filter a bundle's rows down to one schedule (rows without schedule_id pass). */
export function rowsForSchedule<T extends { schedule_id?: string }>(
  rows: T[],
  scheduleId: string,
): T[] {
  return rows.filter((r) => !r.schedule_id || r.schedule_id === scheduleId);
}

/** Group the flat rule rows into the 7-day Monday-first editor model. */
export function rulesToDays(rules: AvailabilityRule[]): DayModel[] {
  const byWeekday = new Map<number, DayBlock[]>();
  for (const r of rules) {
    const wd = ((r.weekday % 7) + 7) % 7;
    const block: DayBlock = {
      start: normalizeTime(r.start_time),
      end: normalizeTime(r.end_time),
    };
    const list = byWeekday.get(wd) ?? [];
    list.push(block);
    byWeekday.set(wd, list);
  }
  return WEEK_ORDER_MON_FIRST.map((wd) => {
    const blocks = (byWeekday.get(wd) ?? [])
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
    return { weekday: wd, on: blocks.length > 0, blocks };
  });
}

/** Flatten the editor model back to rule rows (only enabled days with blocks). */
export function daysToRules(days: DayModel[]): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  for (const day of days) {
    if (!day.on) continue;
    for (const b of day.blocks) {
      if (!b.start || !b.end) continue;
      rules.push({
        weekday: day.weekday,
        start_time: b.start,
        end_time: b.end,
      });
    }
  }
  return rules;
}

/** The 9–5 Mon–Fri seed used by the empty state and "Use 9–5" quick action. */
export function seedDefaultDays(): DayModel[] {
  return WEEK_ORDER_MON_FIRST.map((wd) => {
    const isWeekday = wd >= 1 && wd <= 5;
    return {
      weekday: wd,
      on: isWeekday,
      blocks: isWeekday ? [{ ...DEFAULT_BLOCK }] : [],
    };
  });
}

/** True when no enabled day carries a block (drives the "No hours set" warning). */
export function hasAnyHours(days: DayModel[]): boolean {
  return days.some((d) => d.on && d.blocks.length > 0);
}

/** Compact a set of weekdays into '"Mon–Fri"' / '"Sat–Sun"' / '"Mon, Wed"'. */
export function compactWeekdays(weekdays: number[]): string {
  const positions = weekdays
    .map((wd) => WEEK_ORDER_MON_FIRST.indexOf(((wd % 7) + 7) % 7))
    .filter((p) => p >= 0)
    .sort((a, b) => a - b);
  if (positions.length === 0) return "";

  const runs: Array<[number, number]> = [];
  let start = positions[0];
  let prev = positions[0];
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === prev + 1) {
      prev = positions[i];
    } else {
      runs.push([start, prev]);
      start = positions[i];
      prev = positions[i];
    }
  }
  runs.push([start, prev]);

  const wdAt = (pos: number) => dayName(WEEK_ORDER_MON_FIRST[pos], true);
  return runs
    .map(([a, b]) => (a === b ? wdAt(a) : `${wdAt(a)}–${wdAt(b)}`))
    .join(", ");
}

/**
 * A one-line human summary of a schedule's weekly hours, e.g.
 * 'Mon–Fri, 9:00 AM – 5:00 PM'. Groups days by identical hours; if days differ,
 * summarises the largest group and appends '+ more'.
 */
export function summarizeSchedule(rules: AvailabilityRule[]): string {
  const days = rulesToDays(rules).filter((d) => d.on && d.blocks.length > 0);
  if (days.length === 0) return "No hours set";

  const signature = (d: DayModel) =>
    d.blocks.map((b) => `${b.start}-${b.end}`).join("|");

  // Bucket the enabled days by identical-hours signature, in first-seen order.
  const order: string[] = [];
  const bySig = new Map<string, number[]>();
  for (const d of days) {
    const sig = signature(d);
    if (!bySig.has(sig)) {
      bySig.set(sig, []);
      order.push(sig);
    }
    bySig.get(sig)!.push(d.weekday);
  }

  // Largest group wins as the primary; ties broken by week order.
  let primarySig = order[0];
  let primaryCount = bySig.get(primarySig)!.length;
  for (const sig of order) {
    const count = bySig.get(sig)!.length;
    if (count > primaryCount) {
      primarySig = sig;
      primaryCount = count;
    }
  }

  const primaryDays = bySig.get(primarySig)!;
  const primaryModel = days.find((d) => signature(d) === primarySig)!;
  const firstBlock = primaryModel.blocks[0];
  const dayRange = compactWeekdays(primaryDays);
  const hours = rangeLabel(firstBlock.start, firstBlock.end);
  const base = `${dayRange}, ${hours}`;
  return order.length > 1 ? `${base} · + more` : base;
}

// ─── US federal holidays (for the B6 holiday-set import) ────────

function nthWeekdayOfMonth(
  year: number,
  month: number, // 1-12
  weekday: number, // 0=Sun … 6=Sat
  n: number,
): string {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return iso(year, month, day);
}

function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
): string {
  const last = new Date(year, month, 0); // day 0 of next month = last day
  const offset = (last.getDay() - weekday + 7) % 7;
  return iso(year, month, last.getDate() - offset);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface HolidayEntry {
  date: string; // 'YYYY-MM-DD'
  name: string;
}

/** The 11 US federal holidays for a given year. */
export function usFederalHolidays(year: number): HolidayEntry[] {
  return [
    { date: iso(year, 1, 1), name: "New Year's Day" },
    {
      date: nthWeekdayOfMonth(year, 1, 1, 3),
      name: "Martin Luther King Jr. Day",
    },
    { date: nthWeekdayOfMonth(year, 2, 1, 3), name: "Presidents' Day" },
    { date: lastWeekdayOfMonth(year, 5, 1), name: "Memorial Day" },
    { date: iso(year, 6, 19), name: "Juneteenth" },
    { date: iso(year, 7, 4), name: "Independence Day" },
    { date: nthWeekdayOfMonth(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekdayOfMonth(year, 10, 1, 2), name: "Columbus Day" },
    { date: iso(year, 11, 11), name: "Veterans Day" },
    { date: nthWeekdayOfMonth(year, 11, 4, 4), name: "Thanksgiving" },
    { date: iso(year, 12, 25), name: "Christmas Day" },
  ];
}

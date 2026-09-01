// Slot / date formatting for W11. Backend slots carry `start`/`end` (UTC) and
// `startLocal` (already in the requested tz, no trailing Z). We render from
// `startLocal` so the wall-clock label matches the chosen timezone, and keep the
// UTC `start`/`end` for storing and de-duping.

import type { BookingSlot } from "@pantopus/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface LocalParts {
  year: number;
  month: number; // 0-indexed
  day: number;
  hour: number;
  minute: number;
}

/** Parse a local ISO string ("2025-06-22T14:00:00") without timezone drift. */
export function parseLocal(iso: string): LocalParts | null {
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    year: +m[1],
    month: +m[2] - 1,
    day: +m[3],
    hour: +m[4],
    minute: +m[5],
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${ampm}`;
}

export interface SlotLabel {
  weekday: string; // "Sun"
  monthDay: string; // "Jun 22"
  time: string; // "2:00 PM"
  dateKey: string; // "2025-06-22"
  hour: number; // 14
}

export function slotLabel(local: string): SlotLabel {
  const p = parseLocal(local);
  if (!p) {
    return {
      weekday: "",
      monthDay: local,
      time: "",
      dateKey: local.slice(0, 10),
      hour: 0,
    };
  }
  const d = new Date(p.year, p.month, p.day);
  return {
    weekday: WEEKDAYS[d.getDay()],
    monthDay: `${MONTHS[p.month]} ${p.day}`,
    time: formatTime(p.hour, p.minute),
    dateKey: `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`,
    hour: p.hour,
  };
}

export function slotLabelFor(slot: BookingSlot): SlotLabel {
  return slotLabel(slot.startLocal || slot.start);
}

/** Today's YYYY-MM-DD in the given IANA tz (for date-window defaults). */
export function todayKey(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Add `days` to a YYYY-MM-DD key, returning a YYYY-MM-DD key. */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Human range label, e.g. "Sun Jun 15 — Sat Jun 21". */
export function rangeLabel(fromKey: string, toKey: string): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${WEEKDAYS[dt.getDay()]} ${MONTHS[m - 1]} ${d}`;
  };
  if (!fromKey || !toKey) return "Pick a date range";
  return `${fmt(fromKey)} — ${fmt(toKey)}`;
}

/** Inclusive day-of-week label for a YYYY-MM-DD key ("Mon"). */
export function weekdayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/**
 * Format a UTC instant (poll options carry `start_at` in UTC) into the viewer's
 * local wall-clock parts. Used by the public poll response where slots have no
 * pre-computed startLocal.
 */
export function instantLabel(
  iso: string,
  tz?: string,
): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  const opts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
  const date = new Intl.DateTimeFormat("en-US", {
    ...opts,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    ...opts,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return { date, time };
}

export { WEEKDAYS, MONTHS };

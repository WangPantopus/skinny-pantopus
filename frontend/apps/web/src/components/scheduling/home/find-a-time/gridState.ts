// Pure who's-free grid logic (no React) so the slot→cell intersection is
// unit-testable. GET /whos-free only returns FREE windows, so a cell is:
//   free      — a free slot overlaps the bucket/day
//   busy      — the member is known but has no free slot there
//   tentative — member has a tentative/maybe event there (reserved for future API)
//   off       — outside the member's working hours (reserved for future API)
//   unknown   — the member isn't in the response (hasn't shared free/busy)

import type { BookingSlot } from "@pantopus/types";
import { parseLocal } from "./format";

export type CellState = "free" | "busy" | "tentative" | "off" | "unknown";

// Day-view time buckets: 8a–8p in 2-hour columns.
export const BUCKETS = [8, 10, 12, 14, 16, 18];
export const BUCKET_LABELS = ["8a", "10a", "12p", "2p", "4p", "6p"];
export const BUCKET_HOURS = 2;

export function bucketLabelFull(startHour: number): string {
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${ampm}`;
  };
  return `${fmt(startHour)}–${fmt(startHour + BUCKET_HOURS)}`;
}

export interface SlotSpan {
  dateKey: string;
  startHour: number;
  endHour: number;
}

/** Convert free slots into local-day spans (uses startLocal so labels match tz). */
export function toSpans(slots: BookingSlot[] | undefined): SlotSpan[] {
  if (!slots) return [];
  const out: SlotSpan[] = [];
  for (const s of slots) {
    const p = parseLocal(s.startLocal || s.start);
    if (!p) continue;
    const startHour = p.hour + p.minute / 60;
    const durH =
      (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000;
    out.push({
      dateKey: `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(
        p.day,
      ).padStart(2, "0")}`,
      startHour,
      // Fall back to a 30-min sliver if end is missing/invalid so the cell still lights.
      endHour: durH > 0 ? startHour + durH : startHour + 0.5,
    });
  }
  return out;
}

/** Day view: does a free span overlap [bucket, bucket+2) on this date? */
export function dayCellState(
  spans: SlotSpan[],
  known: boolean,
  dateKey: string,
  bucket: number,
): CellState {
  if (!known) return "unknown";
  const hit = spans.some(
    (s) =>
      s.dateKey === dateKey &&
      s.startHour < bucket + BUCKET_HOURS &&
      s.endHour > bucket,
  );
  return hit ? "free" : "busy";
}

/** Week view: is there any free span on this date? */
export function weekCellState(
  spans: SlotSpan[],
  known: boolean,
  dateKey: string,
): CellState {
  if (!known) return "unknown";
  return spans.some((s) => s.dateKey === dateKey) ? "free" : "busy";
}

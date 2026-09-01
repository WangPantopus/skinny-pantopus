// W17 — Insights aggregation. Pure (no React) so the math is unit-testable.
// The dashboard (H9), per-event-type report (H10) and the cancellation half of
// the no-show report (H11) all derive from GET /bookings rows over the selected
// range; the no-show + team halves come straight from the insights endpoints.
// Rates are returned as FRACTIONS (0–1) to match the app convention (see
// format.ts formatRate).

import type { Booking, EventType } from "@pantopus/types";
import { rateOf } from "./format";

const NONE_KEY = "__none__";

export interface RangeSummary {
  total: number;
  /** Future confirmed bookings. */
  confirmed: number;
  pending: number;
  completed: number;
  /** cancelled + declined. */
  cancelled: number;
  noShow: number;
  /** no-shows ÷ settled (completed + no-show), as a fraction. */
  noShowRate: number;
  /** cancellations ÷ total, as a fraction. */
  cancellationRate: number;
  /** completed ÷ settled, as a fraction. */
  completionRate: number;
}

function settledOf(completed: number, noShow: number): number {
  return completed + noShow;
}

export function summarizeRange(bookings: Booking[]): RangeSummary {
  let confirmed = 0;
  let pending = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const b of bookings) {
    switch (b.status) {
      case "confirmed":
        confirmed++;
        break;
      case "pending":
        pending++;
        break;
      case "completed":
        completed++;
        break;
      case "no_show":
        noShow++;
        break;
      case "cancelled":
      case "declined":
        cancelled++;
        break;
      default:
        break;
    }
  }
  const total = bookings.length;
  const settled = settledOf(completed, noShow);
  return {
    total,
    confirmed,
    pending,
    completed,
    cancelled,
    noShow,
    noShowRate: rateOf(noShow, settled),
    cancellationRate: rateOf(cancelled, total),
    completionRate: rateOf(completed, settled),
  };
}

export interface EventTypeAgg {
  eventTypeId: string;
  name: string;
  color: string | null;
  total: number;
  confirmed: number;
  pending: number;
  completed: number;
  cancelled: number;
  noShow: number;
  /** no-shows ÷ settled, as a fraction. */
  noShowRate: number;
  avgDurationMin: number;
}

function durationMin(b: Booking): number {
  const a = new Date(b.start_at).getTime();
  const z = new Date(b.end_at).getTime();
  if (Number.isNaN(a) || Number.isNaN(z) || z <= a) return 0;
  return Math.round((z - a) / 60000);
}

/**
 * Aggregate bookings by event type, joined with the event-type metadata for
 * name + color. Resource bookings (event_type_id === null) bucket under
 * "Other". Sorted by total volume descending.
 */
export function aggregateByEventType(
  bookings: Booking[],
  eventTypes: EventType[],
): EventTypeAgg[] {
  const meta = new Map<string, EventType>();
  for (const e of eventTypes) meta.set(e.id, e);

  interface Acc extends Omit<EventTypeAgg, "noShowRate" | "avgDurationMin"> {
    durTotal: number;
    durCount: number;
  }
  const acc = new Map<string, Acc>();

  for (const b of bookings) {
    const key = b.event_type_id ?? NONE_KEY;
    let row = acc.get(key);
    if (!row) {
      const m = b.event_type_id ? meta.get(b.event_type_id) : undefined;
      row = {
        eventTypeId: key,
        name: m?.name ?? (b.event_type_id ? "Untitled event" : "Other"),
        color: m?.color ?? null,
        total: 0,
        confirmed: 0,
        pending: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        durTotal: 0,
        durCount: 0,
      };
      acc.set(key, row);
    }
    row.total++;
    switch (b.status) {
      case "confirmed":
        row.confirmed++;
        break;
      case "pending":
        row.pending++;
        break;
      case "completed":
        row.completed++;
        break;
      case "no_show":
        row.noShow++;
        break;
      case "cancelled":
      case "declined":
        row.cancelled++;
        break;
      default:
        break;
    }
    const d = durationMin(b);
    if (d > 0) {
      row.durTotal += d;
      row.durCount++;
    }
  }

  return Array.from(acc.values())
    .map((r) => ({
      eventTypeId: r.eventTypeId,
      name: r.name,
      color: r.color,
      total: r.total,
      confirmed: r.confirmed,
      pending: r.pending,
      completed: r.completed,
      cancelled: r.cancelled,
      noShow: r.noShow,
      noShowRate: rateOf(r.noShow, settledOf(r.completed, r.noShow)),
      avgDurationMin: r.durCount ? Math.round(r.durTotal / r.durCount) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

// ─── Volume trend (booking counts over the range) ───────────

function dayKey(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

export interface VolumeBucket {
  /** Start day key (YYYY-MM-DD) of the bucket. */
  key: string;
  count: number;
}

export interface VolumeSeries {
  buckets: VolumeBucket[];
  /** Days per bucket (1 = daily, 7 = weekly, …). */
  bucketDays: number;
  max: number;
}

/**
 * Bucket booking counts across [fromKey, toKey] into at most `maxBars` bars,
 * widening the bucket size for long ranges so the sparkline stays legible.
 */
export function volumeSeries(
  bookings: Booking[],
  fromKey: string,
  toKey: string,
  tz: string,
  maxBars = 30,
): VolumeSeries {
  const from = keyToUtc(fromKey);
  const to = keyToUtc(toKey);
  const spanDays =
    from && to ? Math.max(1, Math.round((to - from) / 86400000) + 1) : 1;
  const bucketDays = Math.max(1, Math.ceil(spanDays / maxBars));
  const nBuckets = Math.max(1, Math.ceil(spanDays / bucketDays));

  const buckets: VolumeBucket[] = [];
  for (let i = 0; i < nBuckets; i++) {
    const start = from + i * bucketDays * 86400000;
    const d = new Date(start);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
    buckets.push({ key, count: 0 });
  }

  for (const b of bookings) {
    const k = dayKey(b.start_at, tz);
    if (!k) continue;
    const idx = Math.floor((keyToUtc(k) - from) / 86400000 / bucketDays);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++;
  }

  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  return { buckets, bucketDays, max };
}

// W12 — Home resources & visits: pure helpers (no React) shared by the resource
// screens (F9–F12). Resource-type metadata, smart defaults, the rules-summary
// line, the `available_hours` schema (the backend stores it as opaque jsonb, so
// the shape is defined here and round-trips through the editor / book flow), the
// client-side slot generator (there is no resource-availability endpoint — slots
// are derived from the resource's hours minus its existing bookings), and the
// at-a-glance free/booked status used by the list.

import {
  BedDouble,
  Car,
  Package,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BookingSlot, ResourceType } from "@pantopus/types";

// ─── Resource types ───────────────────────────────────────────
export interface ResourceTypeMeta {
  value: ResourceType;
  label: string;
  Icon: LucideIcon;
}

export const RESOURCE_TYPES: ResourceTypeMeta[] = [
  { value: "room", label: "Room", Icon: BedDouble },
  { value: "vehicle", label: "Vehicle", Icon: Car },
  { value: "tool", label: "Tool", Icon: Wrench },
  { value: "charger", label: "Charger", Icon: Zap },
  { value: "other", label: "Other", Icon: Package },
];

const TYPE_BY_VALUE = new Map(RESOURCE_TYPES.map((t) => [t.value, t]));

export function resourceTypeMeta(
  type: ResourceType | string,
): ResourceTypeMeta {
  return TYPE_BY_VALUE.get(type as ResourceType) ?? RESOURCE_TYPES[4];
}

/** Smart defaults the editor applies when a type is picked (design: charger → 4h max). */
export function typeDefaults(type: ResourceType): {
  max_duration_min: number | null;
  buffer_min: number;
  requires_approval: boolean;
} {
  switch (type) {
    case "charger":
      return { max_duration_min: 240, buffer_min: 0, requires_approval: false };
    case "room":
      return { max_duration_min: 480, buffer_min: 0, requires_approval: false };
    case "vehicle":
      return {
        max_duration_min: 480,
        buffer_min: 30,
        requires_approval: false,
      };
    case "tool":
      return { max_duration_min: 240, buffer_min: 0, requires_approval: false };
    default:
      return {
        max_duration_min: null,
        buffer_min: 0,
        requires_approval: false,
      };
  }
}

// ─── Rules summary ────────────────────────────────────────────
export function durationLabel(min: number | null | undefined): string {
  if (!min) return "No limit";
  if (min % 60 === 0) return `${min / 60} hr max`;
  if (min < 60) return `${min} min max`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} hr ${m} min max`;
}

export function whoCanBookLabel(who: string): string {
  switch (who) {
    case "specific":
      return "Specific members";
    case "guests":
      return "Guests with link";
    default:
      return "All members";
  }
}

/** "4 hr max · No approval · All members" */
export function rulesSummary(r: {
  max_duration_min: number | null;
  requires_approval: boolean;
  who_can_book: string;
}): string[] {
  return [
    durationLabel(r.max_duration_min),
    r.requires_approval ? "Needs approval" : "No approval",
    whoCanBookLabel(r.who_can_book),
  ];
}

// ─── available_hours schema (defined here; stored as opaque jsonb) ─
/** A single weekly window: bookable on `days` (0=Sun..6=Sat) between start/end. */
export interface AvailableHours {
  days: number[];
  /** "HH:MM" 24h, local wall-clock. */
  start: string;
  /** "HH:MM" 24h, local wall-clock. */
  end: string;
}

export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_AVAILABLE_HOURS: AvailableHours = {
  days: [1, 2, 3, 4, 5, 6, 0],
  start: "08:00",
  end: "22:00",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Parse the opaque `available_hours` object. Returns null when there's no usable
 * window (treated as "any time" by the booking flow).
 */
export function parseAvailableHours(
  raw: Record<string, unknown> | null | undefined,
): AvailableHours | null {
  if (!raw || typeof raw !== "object") return null;
  const days = Array.isArray((raw as { days?: unknown }).days)
    ? ((raw as { days: unknown[] }).days.filter(
        (d) => typeof d === "number" && d >= 0 && d <= 6,
      ) as number[])
    : [];
  const start = (raw as { start?: unknown }).start;
  const end = (raw as { end?: unknown }).end;
  if (
    days.length === 0 ||
    typeof start !== "string" ||
    typeof end !== "string" ||
    !TIME_RE.test(start) ||
    !TIME_RE.test(end) ||
    start >= end
  ) {
    return null;
  }
  return { days: [...new Set(days)].sort(), start, end };
}

export function availableHoursLabel(
  raw: Record<string, unknown> | null | undefined,
): string {
  const h = parseAvailableHours(raw);
  if (!h) return "Any time";
  const dayLabel =
    h.days.length === 7
      ? "Every day"
      : h.days
          .slice()
          .sort()
          .map((d) => WEEKDAY_SHORT[d])
          .join(", ");
  return `${dayLabel} · ${formatHm(h.start)}–${formatHm(h.end)}`;
}

/** "09:00" → "9 AM", "13:30" → "1:30 PM" */
export function formatHm(hm: string): string {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12} ${ampm}`
    : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Status (free now / booked until) for the list ────────────
export interface ResourceLiveStatus {
  state: "free" | "booked";
  label: string;
}

export function resourceLiveStatus(
  bookings: { start_at: string; end_at: string; status?: string }[],
  now: Date = new Date(),
): ResourceLiveStatus {
  const active = bookings.find((b) => {
    if (b.status && b.status !== "confirmed" && b.status !== "pending")
      return false;
    const s = new Date(b.start_at).getTime();
    const e = new Date(b.end_at).getTime();
    return s <= now.getTime() && now.getTime() < e;
  });
  if (active) {
    return {
      state: "booked",
      label: `Booked until ${formatClock(active.end_at)}`,
    };
  }
  return { state: "free", label: "Free now" };
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h} ${ampm}`
    : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Client-side slot generation (F12) ────────────────────────
export interface GenerateSlotsOpts {
  availableHours: AvailableHours | null;
  durationMin: number;
  bufferMin: number;
  /** This resource's existing bookings (confirmed/pending) for overlap exclusion. */
  existingBookings: { start_at: string; end_at: string }[];
  /** Inclusive local-day range, YYYY-MM-DD. */
  fromDate: string;
  toDate: string;
  intervalMin?: number;
  /** Earliest allowed start (defaults to now). */
  minStart?: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Generate bookable start slots in the browser's local timezone. `start` is the
 * UTC ISO (what we book); `startLocal` is the wall-clock ISO the SlotPicker /
 * SlotRow grid renders. Slots overlapping an existing booking (expanded by the
 * resource buffer) are dropped; a slot whose window would run past close is
 * dropped too.
 */
export function generateResourceSlots(opts: GenerateSlotsOpts): BookingSlot[] {
  const {
    availableHours,
    durationMin,
    bufferMin,
    existingBookings,
    fromDate,
    toDate,
    intervalMin = 30,
    minStart = new Date(),
  } = opts;

  const window = availableHours ?? {
    days: [0, 1, 2, 3, 4, 5, 6],
    start: "00:00",
    end: "23:59",
  };
  const [winStartH, winStartM] = window.start.split(":").map(Number);
  const [winEndH, winEndM] = window.end.split(":").map(Number);
  const winStartMin = winStartH * 60 + winStartM;
  const winEndMin = winEndH * 60 + winEndM;

  const blocks = existingBookings
    .map((b) => ({
      s: new Date(b.start_at).getTime() - bufferMin * 60_000,
      e: new Date(b.end_at).getTime() + bufferMin * 60_000,
    }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e));

  const out: BookingSlot[] = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (cursor.getTime() <= end.getTime()) {
    const weekday = cursor.getDay();
    if (window.days.includes(weekday)) {
      for (
        let minOfDay = winStartMin;
        minOfDay + durationMin <= winEndMin;
        minOfDay += intervalMin
      ) {
        const start = new Date(cursor);
        start.setHours(Math.floor(minOfDay / 60), minOfDay % 60, 0, 0);
        const startMs = start.getTime();
        if (startMs < minStart.getTime()) continue;
        const endMs = startMs + durationMin * 60_000;
        const overlaps = blocks.some((b) => startMs < b.e && endMs > b.s);
        if (overlaps) continue;
        const localY = start.getFullYear();
        const localMo = pad(start.getMonth() + 1);
        const localD = pad(start.getDate());
        const localH = pad(start.getHours());
        const localMin = pad(start.getMinutes());
        out.push({
          start: start.toISOString(),
          end: new Date(endMs).toISOString(),
          startLocal: `${localY}-${localMo}-${localD}T${localH}:${localMin}:00`,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

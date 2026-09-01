// W8 — Bookings inbox & core. Date/time formatting + day-bucketing for the
// host bookings inbox and detail. Host surfaces render in the viewer's local
// timezone (browser); slot reads pass `tz` per the wiring contract. All inputs
// are ISO UTC strings; output is render-only (we never store these).
//
// Pure (no React) so the grouping + formatting logic is unit-testable.

export function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function fmt(
  iso: string,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(
      d,
    );
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  }
}

/** "Thu, Jun 18" */
export function formatDayDate(iso: string, tz: string = viewerTz()): string {
  return fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });
}

/** "2:00 PM" */
export function formatTime(iso: string, tz: string = viewerTz()): string {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/** Short timezone label, e.g. "PDT" / "GMT+2". */
export function tzAbbrev(iso: string, tz: string = viewerTz()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
      hour: "numeric",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** "YYYY-MM-DD" for the given instant in `tz` (calendar-day key). */
export function dayKey(iso: string, tz: string = viewerTz()): string {
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

/** Whole-day difference between two day keys (a − b), in days. */
export function dayDiff(aKey: string, bKey: string): number {
  if (!aKey || !bKey) return 0;
  return Math.round((keyToUtc(aKey) - keyToUtc(bKey)) / 86400000);
}

/** "Today" / "Tomorrow" / "Yesterday" / "Thu, Jun 18". */
export function relativeDayLabel(
  iso: string,
  tz: string = viewerTz(),
  now: Date = new Date(),
): string {
  const diff = dayDiff(dayKey(iso, tz), dayKey(now.toISOString(), tz));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDayDate(iso, tz);
}

/** Compact row line: "Today · 2:00 PM · PDT" / "Sat, Jun 14 · 10:00 AM · PDT". */
export function formatWhen(
  iso: string,
  tz: string = viewerTz(),
  now: Date = new Date(),
): string {
  return [
    relativeDayLabel(iso, tz, now),
    formatTime(iso, tz),
    tzAbbrev(iso, tz),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Detail header range: "Thu, Jun 18 · 2:00–2:30 PM · PDT". */
export function formatRange(
  start: string,
  end: string,
  tz: string = viewerTz(),
): string {
  const date = formatDayDate(start, tz);
  const sT = formatTime(start, tz);
  const eT = formatTime(end, tz);
  const sMer = sT.slice(-2);
  const eMer = eT.slice(-2);
  // Drop the meridiem on the start when it matches the end ("2:00–2:30 PM").
  const sShort =
    sMer === eMer && /[AP]M$/.test(eMer) ? sT.replace(/\s?[AP]M$/, "") : sT;
  const z = tzAbbrev(start, tz);
  const range = end ? `${sShort}–${eT}` : sT;
  return [date, range, z].filter(Boolean).join(" · ");
}

/** Whole-minute duration of a booking. */
export function durationMin(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

export function durationLabel(start: string, end: string): string {
  const m = durationMin(start, end);
  if (m === 0) return "";
  if (m % 60 === 0) return `${m / 60} hr`;
  if (m > 60) return `${Math.floor(m / 60)} hr ${m % 60} min`;
  return `${m} min`;
}

// ─── Initials / invitee display ─────────────────────────────

export function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function inviteeDisplay(name?: string | null): string {
  return (name || "").trim() || "Guest";
}

// ─── Day bucketing for grouped lists ────────────────────────

export interface BookingGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Bucket an instant into a list section. `past` flips the direction. */
export function bucketFor(
  iso: string,
  tz: string,
  past: boolean,
  now: Date = new Date(),
): { key: string; label: string } {
  const diff = dayDiff(dayKey(iso, tz), dayKey(now.toISOString(), tz));
  if (!past) {
    if (diff <= 0) return { key: "today", label: "Today" };
    if (diff === 1) return { key: "tomorrow", label: "Tomorrow" };
    if (diff <= 6) return { key: "week", label: "Later this week" };
    return { key: "later", label: "Later" };
  }
  if (diff >= 0) return { key: "today", label: "Today" };
  if (diff === -1) return { key: "yesterday", label: "Yesterday" };
  if (diff >= -6) return { key: "earlier_week", label: "Earlier this week" };
  return { key: "earlier", label: "Earlier" };
}

/**
 * Group already-sorted items into day buckets, preserving the input order
 * (the API returns upcoming/pending ascending, past/cancelled descending).
 */
export function groupBookings<T>(
  items: T[],
  getStart: (item: T) => string,
  tz: string,
  past: boolean,
  now: Date = new Date(),
): BookingGroup<T>[] {
  const groups: BookingGroup<T>[] = [];
  const index = new Map<string, BookingGroup<T>>();
  for (const item of items) {
    const b = bucketFor(getStart(item), tz, past, now);
    let g = index.get(b.key);
    if (!g) {
      g = { key: b.key, label: b.label, items: [] };
      index.set(b.key, g);
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

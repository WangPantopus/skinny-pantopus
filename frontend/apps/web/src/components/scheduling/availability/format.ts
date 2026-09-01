// W3 Availability — pure display formatters. No React, no API: trivially
// unit-testable and reused by both the schedule list and the editor.

/** Weekday names. Index = backend weekday (0=Sunday … 6=Saturday, JS getDay). */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** Week order with Monday first (matches the design's weekday grid). */
export const WEEK_ORDER_MON_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

export function dayName(weekday: number, short = false): string {
  const i = ((weekday % 7) + 7) % 7;
  return (short ? WEEKDAY_SHORT : WEEKDAY_NAMES)[i];
}

/** Normalise a backend time ('HH:MM' or 'HH:MM:SS') to 'HH:MM'. */
export function normalizeTime(t: string | null | undefined): string {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

/** 'HH:MM[:SS]' (24h) → '9:00 AM'. */
export function to12h(t: string | null | undefined): string {
  const norm = normalizeTime(t);
  if (!norm) return "";
  const [hRaw, m] = norm.split(":");
  const h = parseInt(hRaw, 10);
  if (Number.isNaN(h)) return norm;
  const meridiem = h < 12 ? "AM" : "PM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m} ${meridiem}`;
}

/** A labelled time range, e.g. '9:00 AM – 5:00 PM'. */
export function rangeLabel(start: string, end: string): string {
  return `${to12h(start)} – ${to12h(end)}`;
}

/** Parse a 'YYYY-MM-DD' as a *local* date (no tz drift from new Date(str)). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 'YYYY-MM-DD' → 'Thu, Jul 4'. */
export function formatDateLabel(iso: string): string {
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** 'YYYY-MM-DD' → 'July 2026' for the calendar header. */
export function formatMonthLabel(iso: string): string {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Today's date as 'YYYY-MM-DD' in the local zone. */
export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

/** Short timezone abbreviation for a row badge, e.g. 'PST' (falls back to the city). */
export function tzShort(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    if (abbr && !/^GMT/.test(abbr)) return abbr;
  } catch {
    /* fall through */
  }
  const tail = tz.split("/").pop() || tz;
  return tail.replace(/_/g, " ");
}

/** A Date → 'YYYY-MM-DD' (local components, no UTC drift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

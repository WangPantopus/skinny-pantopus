// Date/time + label helpers for the scheduling hub. Booking start/end are UTC
// ISO; everything renders in a viewer timezone (the booking-page tz, falling
// back to the browser zone).

export function fmtTime(iso: string, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** YYYY-MM-DD in the viewer timezone, for grouping bookings by day. */
export function dayKey(iso: string, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz || undefined,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** "Today / Tomorrow / Weekday" + a "Sun, Oct 12" sub-label. */
export function dayLabel(
  iso: string,
  tz?: string | null,
): { label: string; sub: string } {
  const now = new Date();
  const todayKey = dayKey(now.toISOString(), tz);
  const tomorrowKey = dayKey(
    new Date(now.getTime() + 86_400_000).toISOString(),
    tz,
  );
  const k = dayKey(iso, tz);
  const sub = safeFmt(
    iso,
    { weekday: "short", month: "short", day: "numeric" },
    tz,
  );
  let label: string;
  if (k === todayKey) label = "Today";
  else if (k === tomorrowKey) label = "Tomorrow";
  else label = safeFmt(iso, { weekday: "long" }, tz);
  return { label, sub };
}

function safeFmt(
  iso: string,
  opts: Intl.DateTimeFormatOptions,
  tz?: string | null,
): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      ...opts,
      timeZone: tz || undefined,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function durationLabel(startIso: string, endIso: string): string {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Minutes → a friendly reminder label ("1 day", "1 hr", "15 min"). */
export function reminderLabel(min: number): string {
  if (min % 1440 === 0) {
    const d = min / 1440;
    return `${d} day${d > 1 ? "s" : ""}`;
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} hr${h > 1 ? "s" : ""}`;
  }
  return `${min} min`;
}

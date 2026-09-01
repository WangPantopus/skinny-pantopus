// Local date/label helpers for W9 (Bookings extras). Pure + self-contained so
// the stream stays disjoint from other folders and the helpers are trivially
// unit-testable. Booking start/end are UTC ISO; everything renders in a viewer
// timezone (defaults to the browser zone).

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

/** "9:30 AM" in the viewer timezone. */
export function fmtTime(iso: string, tz?: string | null): string {
  return safeFmt(iso, { hour: "numeric", minute: "2-digit" }, tz);
}

/** "Sun, Jun 14" in the viewer timezone. */
export function fmtDate(iso: string, tz?: string | null): string {
  return safeFmt(iso, { weekday: "short", month: "short", day: "numeric" }, tz);
}

/** "Sun, Jun 14 · 9:30 AM" combined line. */
export function fmtDateTime(iso: string, tz?: string | null): string {
  const d = fmtDate(iso, tz);
  const t = fmtTime(iso, tz);
  return d && t ? `${d} · ${t}` : d || t;
}

/** YYYY-MM-DD in the viewer timezone (for grouping). */
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

/** Up-to-two-letter initials from a name, "?" when empty. */
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

/** "30 min" / "1 hr" / "1 hr 30 min" from a start/end ISO pair. */
export function durationLabel(startIso: string, endIso: string): string {
  const mins = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
  if (!Number.isFinite(mins) || mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// W7 Invitee edge & customer — shared formatting helpers. Owned by W7; small,
// pure, and local so the edge surfaces don't couple to another stream's utils.
// All times render in the viewer's tz (render-local, store/compare UTC).

import { Video, Phone, MapPin, CalendarClock, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  EventTypeLocationMode,
  PublicEventType,
  Booking,
} from "@pantopus/types";

/** Browser default IANA zone (matches W0 detectTimezone fallback). */
export function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Wed, Jun 17" in the given tz. */
export function formatDay(iso?: string | null, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** "2:00 PM" in the given tz. */
export function formatTime(iso?: string | null, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/** "Wed, Jun 17 · 9:30 – 10:00 AM" in the given tz. */
export function formatRange(
  startIso?: string | null,
  endIso?: string | null,
  tz?: string,
): string {
  const start = safeDate(startIso);
  if (!start) return "";
  const day = formatDay(startIso, tz);
  const startT = formatTime(startIso, tz);
  const endT = endIso ? formatTime(endIso, tz) : "";
  const time = endT ? `${startT} – ${endT}` : startT;
  return [day, time].filter(Boolean).join(" · ");
}

/** Short zone label, e.g. "PDT". Falls back to the IANA city. */
export function tzAbbrev(tz?: string): string {
  if (!tz) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz.split("/").pop()?.replace(/_/g, " ") || tz;
  }
}

/** "30 min" / "1 hr" / "1 hr 30 min". */
export function durationLabel(min?: number | null): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "$48" / "$23.50" from integer cents. */
export function money(cents?: number | null, currency = "USD"): string {
  if (cents == null) return "";
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function locationIcon(mode?: EventTypeLocationMode | null): LucideIcon {
  switch (mode) {
    case "video":
      return Video;
    case "phone":
      return Phone;
    case "in_person":
      return MapPin;
    case "ask":
      return HelpCircle;
    default:
      return CalendarClock;
  }
}

/** A friendly host/page name with a graceful fallback. */
export function hostName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "your host";
}

/** A short event-type summary line: "30 min · $48". */
export function eventTypeSummary(et?: PublicEventType | null): string {
  if (!et) return "";
  const parts = [durationLabel(et.default_duration)];
  if (et.price_cents && et.price_cents > 0) {
    parts.push(money(et.price_cents, et.currency));
  }
  return parts.filter(Boolean).join(" · ");
}

export type BookingTimeGroup =
  | "Today"
  | "This week"
  | "Next week"
  | "Later"
  | "This month"
  | "Earlier";

/**
 * Relative grouping overline for a list row. `past` lists group by recency
 * (This month / Earlier); upcoming lists group by horizon.
 */
export function timeGroup(iso: string, past = false): BookingTimeGroup {
  const d = safeDate(iso);
  if (!d) return past ? "Earlier" : "Later";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((d.getTime() - startOfToday.getTime()) / dayMs);

  if (past) {
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    )
      return "This month";
    return "Earlier";
  }
  if (diffDays <= 0) return "Today";
  if (diffDays < 7) return "This week";
  if (diffDays < 14) return "Next week";
  return "Later";
}

/** True when the booking's slot is in the past. */
export function isPastBooking(
  b: Pick<Booking, "start_at" | "status">,
): boolean {
  const d = safeDate(b.start_at);
  if (!d) return false;
  const terminal =
    b.status === "cancelled" ||
    b.status === "declined" ||
    b.status === "completed" ||
    b.status === "no_show";
  return d.getTime() < Date.now() || terminal;
}

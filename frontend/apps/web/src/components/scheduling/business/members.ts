// Business team-member helpers for the W13 Business-config surfaces (G1–G4).
// The roster comes from the opaque business *seats* (GET /businesses/:id/seats),
// keyed by `business_user_id`; the team-availability read (GET /team-availability)
// keys its free grids off the same `business_user_id`. We normalise everything to
// a flat `TeamMemberView` so the round-robin, collective, team-availability and
// member-hours screens all render the same way. Pure (no React / no api) so the
// roster + coverage logic is unit-testable.

import type { SeatListItem, BookingSlot } from "@pantopus/types";

export interface TeamMemberView {
  /** Stable team-member id (seat.business_user_id) — used as the assignee
   *  subject_id, the team-availability key, and the member-hours route param. */
  id: string;
  /** Seat id (for seat-scoped reads), when known. */
  seatId: string | null;
  name: string;
  /** Role / title sub-label. */
  role: string;
  /** True if this seat belongs to the signed-in viewer (their own hours are
   *  editable; everyone else's are read-only — availability is per-user). */
  isYou: boolean;
  /** Active seat (a deactivated seat can't take bookings). */
  isActive: boolean;
}

function str(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  staff: "Staff",
};

function roleLabel(seat: SeatListItem): string {
  return (
    str(seat.title) ||
    ROLE_LABEL[seat.role_base as string] ||
    str(seat.role_base) ||
    "Member"
  );
}

/** Normalise the business seat list → team members (active seats first, deduped). */
export function rosterFromSeats(
  seats: SeatListItem[] | undefined,
): TeamMemberView[] {
  const seen = new Set<string>();
  const out: TeamMemberView[] = [];
  for (const s of seats ?? []) {
    const id = str(s.business_user_id, s.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      seatId: str(s.id) || null,
      name: str(s.display_name) || "Member",
      role: roleLabel(s),
      isYou: s.is_you === true,
      isActive: s.is_active !== false,
    });
  }
  // Active first, then the viewer floats up within each group, then by name.
  return out.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Two-letter initials for the avatar fallback (matches the W11 roster). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Deterministic avatar tint from the id so a member always renders the same
// gradient across the roster, round-robin seats and coverage rows.
const AVATAR_TINTS = [
  "from-violet-400 to-violet-700",
  "from-sky-400 to-sky-700",
  "from-emerald-400 to-emerald-700",
  "from-amber-400 to-amber-700",
  "from-rose-400 to-rose-700",
  "from-teal-400 to-teal-700",
  "from-indigo-400 to-indigo-700",
  "from-pink-400 to-pink-700",
];

export function tintForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

// ─── Coverage (which weekdays the team can be booked) ────────────────────────

const WEEKDAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** Weekday (0=Sun … 6=Sat) of a local ISO timestamp's date, tz-safe. */
export function weekdayOfLocal(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return dt.getUTCDay();
}

export interface Coverage {
  /** Weekdays (0–6) at least one bookable member is free on. */
  covered: number[];
  /** Weekdays in the window with zero coverage. */
  gaps: number[];
  /** A gap on a Mon–Fri is treated as a warning; weekend-only gaps are a note. */
  hasWeekdayGap: boolean;
}

/**
 * Derive coverage from the team-availability free grids. We only know FREE
 * windows per member, so a weekday is "covered" if any bookable member has a
 * free slot whose local date falls on it. Weekdays present in the window but
 * with no coverage are gaps.
 */
export function coverageFromFreeByMember(
  freeByMember: Record<string, BookingSlot[]> | undefined,
  bookableIds: string[],
  windowFrom: string,
  windowTo: string,
): Coverage {
  const covered = new Set<number>();
  const allow = new Set(bookableIds);
  for (const [memberId, slots] of Object.entries(freeByMember ?? {})) {
    if (!allow.has(memberId)) continue;
    for (const s of slots ?? []) {
      const wd = weekdayOfLocal(s.startLocal || s.start);
      if (wd != null) covered.add(wd);
    }
  }
  const inWindow = weekdaysInRange(windowFrom, windowTo);
  const gaps = inWindow.filter((wd) => !covered.has(wd));
  return {
    covered: [...covered].sort((a, b) => a - b),
    gaps,
    hasWeekdayGap: gaps.some((wd) => wd >= 1 && wd <= 5),
  };
}

/** The distinct weekdays spanned by a [from,to] date window (inclusive, capped at 7). */
export function weekdaysInRange(from: string, to: string): number[] {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b || b < a) return [0, 1, 2, 3, 4, 5, 6];
  const days = new Set<number>();
  const cursor = new Date(a);
  for (let i = 0; i < 7 && cursor <= b; i++) {
    days.add(cursor.getUTCDay());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...days].sort((x, y) => x - y);
}

function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Intersect the free windows of several members (collective booking needs a
 * window where everyone is free at once). Returns the common open windows; an
 * empty result means there is no shared opening. Pure interval intersection.
 */
export function intersectFreeWindows(
  freeByMember:
    | Record<string, ReadonlyArray<{ start: string; end: string }>>
    | undefined,
  memberIds: string[],
): { start: string; end: string }[] {
  if (memberIds.length === 0) return [];
  const grids = memberIds.map((id) =>
    [...((freeByMember ?? {})[id] ?? [])]
      .map((s) => ({ start: s.start, end: s.end }))
      .sort((a, b) => a.start.localeCompare(b.start)),
  );
  if (grids.some((g) => g.length === 0)) return [];
  let acc = grids[0];
  for (let i = 1; i < grids.length; i++) {
    acc = intersectTwo(acc, grids[i]);
    if (acc.length === 0) return [];
  }
  return acc;
}

function intersectTwo(
  a: { start: string; end: string }[],
  b: { start: string; end: string }[],
): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = a[i].start > b[j].start ? a[i].start : b[j].start;
    const end = a[i].end < b[j].end ? a[i].end : b[j].end;
    if (start < end) out.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Summarise the weekdays a member has any free slot, e.g. "Mon–Fri", "Tue, Sat". */
export function freeWeekdaysLabel(slots: BookingSlot[] | undefined): string {
  const days = new Set<number>();
  for (const s of slots ?? []) {
    const wd = weekdayOfLocal(s.startLocal || s.start);
    if (wd != null) days.add(wd);
  }
  if (days.size === 0) return "No bookable hours yet";
  // Render Monday-first.
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.has(d));
  // Collapse a run of consecutive weekdays into a range (Mon–Fri).
  if (order.length >= 3 && isConsecutiveMonFirst(order)) {
    return `${WEEKDAY_ABBR[order[0]]}–${WEEKDAY_ABBR[order[order.length - 1]]}`;
  }
  return order.map((d) => WEEKDAY_ABBR[d]).join(", ");
}

function isConsecutiveMonFirst(monFirst: number[]): boolean {
  const seq = [1, 2, 3, 4, 5, 6, 0];
  const idx = monFirst.map((d) => seq.indexOf(d));
  for (let i = 1; i < idx.length; i++)
    if (idx[i] !== idx[i - 1] + 1) return false;
  return true;
}

/** Human label for a coverage gap, e.g. [4] → "Thursdays", [0] → "Sundays". */
export function gapLabel(gaps: number[]): string {
  if (gaps.length === 0) return "";
  if (gaps.length === 1) return WEEKDAY_NAMES[gaps[0]];
  const names = gaps.map((d) => WEEKDAY_NAMES[d].replace(/s$/, ""));
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

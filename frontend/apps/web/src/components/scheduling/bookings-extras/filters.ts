// E9 — Booking search & filter: the param builder + URL (de)serialization, kept
// pure so it's unit-testable. The host bookings list reads GET /bookings with
// { status, event_type_id, from, to, q }. The backend status enum is
// upcoming|pending|past|cancelled — "no_show" is a client-side refinement over
// `past` (no-show bookings live in the past bucket), so we map it accordingly.

import type { Booking } from "@pantopus/types";
import type { BookingListParams } from "@pantopus/api";

export type StatusFacet =
  | "all"
  | "upcoming"
  | "pending"
  | "past"
  | "cancelled"
  | "no_show";

export type DateFacet = "all" | "today" | "week" | "month" | "custom";

export type OwnerScopeFacet = "all" | "personal" | "home" | "business";

export interface BookingFilters {
  q: string;
  status: StatusFacet;
  /** Owner context (pillar scope) facet — maps to owner_type query param. */
  scope: OwnerScopeFacet;
  eventTypeId: string | null;
  date: DateFacet;
  /** Custom range (YYYY-MM-DD), only used when date === "custom". */
  from: string | null;
  to: string | null;
}

export const DEFAULT_FILTERS: BookingFilters = {
  q: "",
  status: "all",
  scope: "all",
  eventTypeId: null,
  date: "all",
  from: null,
  to: null,
};

export const STATUS_FACETS: ReadonlyArray<{
  id: StatusFacet;
  label: string;
  /** Semantic tint token suffix (success/warning/error/info/neutral). */
  tone: "neutral" | "success" | "warning" | "error" | "info";
}> = [
  { id: "upcoming", label: "Upcoming", tone: "success" },
  { id: "pending", label: "Pending", tone: "warning" },
  { id: "past", label: "Past", tone: "info" },
  { id: "cancelled", label: "Cancelled", tone: "error" },
  { id: "no_show", label: "No-show", tone: "error" },
];

export const DATE_FACETS: ReadonlyArray<{ id: DateFacet; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resolve a date facet to an inclusive {from,to} YYYY-MM-DD range (local). */
export function dateRange(
  filters: Pick<BookingFilters, "date" | "from" | "to">,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filters.date) {
    case "today":
      return { from: ymd(start), to: ymd(start) };
    case "week": {
      // Week starts Sunday, matching the SlotPicker calendar.
      const sun = new Date(start);
      sun.setDate(start.getDate() - start.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      return { from: ymd(sun), to: ymd(sat) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: ymd(first), to: ymd(last) };
    }
    case "custom":
      return {
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
    default:
      return {};
  }
}

/** Map UI filters to the GET /bookings query the backend understands. */
export function buildBookingListParams(
  filters: BookingFilters,
  now: Date = new Date(),
): BookingListParams {
  const params: BookingListParams = {};
  // no_show is surfaced via the `past` bucket and refined client-side.
  if (filters.status === "no_show") params.status = "past";
  else if (filters.status !== "all") params.status = filters.status;
  if (filters.eventTypeId) params.event_type_id = filters.eventTypeId;
  const q = filters.q.trim();
  if (q) params.q = q;
  const { from, to } = dateRange(filters, now);
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

/** Client-side refinement the backend status enum can't express (no_show). */
export function refineBookings(
  bookings: Booking[],
  filters: BookingFilters,
): Booking[] {
  if (filters.status === "no_show") {
    return bookings.filter((b) => b.status === "no_show");
  }
  return bookings;
}

/** Count of non-default facets, for the "Show N" CTA + active-chip summary. */
export function countActiveFilters(filters: BookingFilters): number {
  let n = 0;
  if (filters.q.trim()) n++;
  if (filters.status !== "all") n++;
  if (filters.scope !== "all") n++;
  if (filters.eventTypeId) n++;
  if (filters.date !== "all") n++;
  return n;
}

export function hasActiveFilters(filters: BookingFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/** Serialize to a shareable/bookmarkable query string. */
export function serializeFilters(filters: BookingFilters): string {
  const sp = new URLSearchParams();
  if (filters.q.trim()) sp.set("q", filters.q.trim());
  if (filters.status !== "all") sp.set("status", filters.status);
  if (filters.scope !== "all") sp.set("scope", filters.scope);
  if (filters.eventTypeId) sp.set("event_type", filters.eventTypeId);
  if (filters.date !== "all") sp.set("date", filters.date);
  if (filters.date === "custom") {
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
  }
  return sp.toString();
}

const STATUS_SET: ReadonlySet<string> = new Set([
  "all",
  "upcoming",
  "pending",
  "past",
  "cancelled",
  "no_show",
]);
const SCOPE_SET: ReadonlySet<string> = new Set([
  "all",
  "personal",
  "home",
  "business",
]);
const DATE_SET: ReadonlySet<string> = new Set([
  "all",
  "today",
  "week",
  "month",
  "custom",
]);

/** Parse a query string back into filters, tolerating unknown values. */
export function parseFilters(
  query: string | URLSearchParams | null | undefined,
): BookingFilters {
  const sp =
    query instanceof URLSearchParams ? query : new URLSearchParams(query ?? "");
  const status = sp.get("status");
  const scope = sp.get("scope");
  const date = sp.get("date");
  return {
    q: sp.get("q") ?? "",
    status: (status && STATUS_SET.has(status) ? status : "all") as StatusFacet,
    scope: (scope && SCOPE_SET.has(scope) ? scope : "all") as OwnerScopeFacet,
    eventTypeId: sp.get("event_type") || null,
    date: (date && DATE_SET.has(date) ? date : "all") as DateFacet,
    from: sp.get("from") || null,
    to: sp.get("to") || null,
  };
}

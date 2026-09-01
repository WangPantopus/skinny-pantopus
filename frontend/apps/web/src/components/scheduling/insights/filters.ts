// W17 — Insights & reports: the period/filter state + param builders, kept pure
// (no React) so they are trivially unit-testable. Every report reads through
// these so the H13 period/filter sheet drives all four screens consistently:
//   • GET /bookings/insights/no-shows · /team  → take a `days` window
//     (backend default 90, max 365).
//   • GET /bookings (cancellation + per-type aggregation) → take an inclusive
//     {from,to} YYYY-MM-DD range.
// Per the wiring contract every read also carries `tz` (IANA), stored here.

export type InsightsPreset = "7d" | "30d" | "90d" | "12m" | "custom";

export interface InsightsFilters {
  preset: InsightsPreset;
  /** Custom range bounds (YYYY-MM-DD); only used when preset === "custom". */
  from: string | null;
  to: string | null;
  /** IANA timezone the viewer reads the reports in. */
  tz: string;
  /** Optional event-type facet (drill-down on the dashboard / per-type report). */
  eventTypeId: string | null;
}

export const MIN_DAYS = 1;
export const MAX_DAYS = 365;
export const DEFAULT_PRESET: InsightsPreset = "90d";

export const PRESET_DAYS: Record<Exclude<InsightsPreset, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

export const PRESETS: ReadonlyArray<{
  id: InsightsPreset;
  label: string;
  short: string;
}> = [
  { id: "7d", label: "Last 7 days", short: "7d" },
  { id: "30d", label: "Last 30 days", short: "30d" },
  { id: "90d", label: "Last 90 days", short: "90d" },
  { id: "12m", label: "Last 12 months", short: "12m" },
  { id: "custom", label: "Custom range", short: "Custom" },
];

/** Browser timezone, falling back to UTC where unavailable. */
export function defaultTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function defaultFilters(tz: string = defaultTz()): InsightsFilters {
  return {
    preset: DEFAULT_PRESET,
    from: null,
    to: null,
    tz,
    eventTypeId: null,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return PRESET_DAYS[DEFAULT_PRESET as "90d"];
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
}

/** Inclusive whole-day count between two YYYY-MM-DD keys (a..b). */
function inclusiveSpan(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy || 1970, (fm || 1) - 1, fd || 1);
  const b = Date.UTC(ty || 1970, (tm || 1) - 1, td || 1);
  return Math.round((b - a) / 86400000) + 1;
}

/** Resolve a custom range, tolerating reversed bounds. */
function customRange(filters: InsightsFilters): {
  from: string | null;
  to: string | null;
} {
  let { from, to } = filters;
  if (from && to && from > to) [from, to] = [to, from];
  return { from: from || null, to: to || null };
}

/** Window in days for GET /bookings/insights/* (clamped to the backend bounds). */
export function insightsDays(filters: InsightsFilters): number {
  if (filters.preset !== "custom") return PRESET_DAYS[filters.preset];
  const { from, to } = customRange(filters);
  if (!from || !to) return PRESET_DAYS[DEFAULT_PRESET as "90d"];
  return clampDays(inclusiveSpan(from, to));
}

/** Inclusive {from,to} (YYYY-MM-DD, local) for GET /bookings list reports. */
export function bookingRange(
  filters: InsightsFilters,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filters.preset === "custom") {
    const { from, to } = customRange(filters);
    return { from: from ?? ymd(today), to: to ?? ymd(today) };
  }
  const days = PRESET_DAYS[filters.preset];
  const start = new Date(today);
  // Inclusive window ending today: a 7d window spans today and the 6 days prior.
  start.setDate(today.getDate() - (days - 1));
  return { from: ymd(start), to: ymd(today) };
}

/** Params for the insights endpoints (no-shows / team). */
export function insightsParams(filters: InsightsFilters): { days: number } {
  return { days: insightsDays(filters) };
}

/** Params for GET /bookings list reports (cancellations, per-type aggregation). */
export function bookingListParams(
  filters: InsightsFilters,
  now: Date = new Date(),
): { from: string; to: string; event_type_id?: string } {
  const { from, to } = bookingRange(filters, now);
  const out: { from: string; to: string; event_type_id?: string } = {
    from,
    to,
  };
  if (filters.eventTypeId) out.event_type_id = filters.eventTypeId;
  return out;
}

export function presetLabel(preset: InsightsPreset): string {
  return PRESETS.find((p) => p.id === preset)?.label ?? "Last 90 days";
}

/** A custom preset with one or both bounds missing — the sheet can't apply yet. */
export function isCustomIncomplete(filters: InsightsFilters): boolean {
  return filters.preset === "custom" && (!filters.from || !filters.to);
}

/** Count of non-default facets, for the H13 sheet summary + "filtered" chip. */
export function countActiveFilters(filters: InsightsFilters): number {
  let n = 0;
  if (filters.preset !== DEFAULT_PRESET) n++;
  if (filters.eventTypeId) n++;
  return n;
}

export function hasActiveFilters(filters: InsightsFilters): boolean {
  return countActiveFilters(filters) > 0;
}

const PRESET_SET: ReadonlySet<string> = new Set([
  "7d",
  "30d",
  "90d",
  "12m",
  "custom",
]);

/** The query-param keys this filter owns (others, e.g. `owner`, are preserved). */
export const FILTER_PARAM_KEYS = [
  "period",
  "from",
  "to",
  "event_type",
  "tz",
] as const;

/**
 * Serialize to a shareable query string. `tz` is included so the chosen
 * timezone survives navigation between the report tabs; it is not counted as an
 * active "filter" facet.
 */
export function serializeFilters(filters: InsightsFilters): string {
  const sp = new URLSearchParams();
  if (filters.preset !== DEFAULT_PRESET) sp.set("period", filters.preset);
  if (filters.preset === "custom") {
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
  }
  if (filters.eventTypeId) sp.set("event_type", filters.eventTypeId);
  if (filters.tz) sp.set("tz", filters.tz);
  return sp.toString();
}

/** Parse a query string back into filters, tolerating unknown values. */
export function parseFilters(
  query: string | URLSearchParams | null | undefined,
  fallbackTz: string = defaultTz(),
): InsightsFilters {
  const sp =
    query instanceof URLSearchParams ? query : new URLSearchParams(query ?? "");
  const period = sp.get("period");
  return {
    preset: (period && PRESET_SET.has(period)
      ? period
      : DEFAULT_PRESET) as InsightsPreset,
    from: sp.get("from") || null,
    to: sp.get("to") || null,
    tz: sp.get("tz") || fallbackTz,
    eventTypeId: sp.get("event_type") || null,
  };
}

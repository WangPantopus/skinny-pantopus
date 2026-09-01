// W2 — Event Types. Pure form logic for the Event Type / Service editor (B2):
// default values, EventType ⇄ form mapping, serialization to the backend
// EventTypeInput, slug derivation, and validation. Framework-free so it is
// trivially unit-testable (see eventTypeForm.test.ts) and reusable by the
// editor without a React dependency.

import type {
  AssignmentMode,
  EventType,
  EventTypeInput,
  EventTypeLocationMode,
  EventTypeVisibility,
  RefundPolicy,
} from "@pantopus/types";

// Per-event-type accent dots (DS category accents from the design).
export const EVENT_TYPE_COLORS = [
  "#2980b9",
  "#0284c7",
  "#16a34a",
  "#0d9488",
  "#7c3aed",
  "#d97706",
  "#f97316",
  "#e11d48",
] as const;

// Location modes surfaced in the editor (the design shows these four).
export const LOCATION_MODES: ReadonlyArray<{
  mode: EventTypeLocationMode;
  label: string;
  detailLabel: string;
  placeholder: string;
  mono: boolean;
}> = [
  {
    mode: "in_person",
    label: "In person",
    detailLabel: "Address",
    placeholder: "e.g. 412 Elm St, Suite 3",
    mono: false,
  },
  {
    mode: "phone",
    label: "Phone",
    detailLabel: "Number",
    placeholder: "e.g. +1 (415) 555-0142",
    mono: true,
  },
  {
    mode: "video",
    label: "Video",
    detailLabel: "Meeting link",
    placeholder: "e.g. meet.pantopus.com/you",
    mono: true,
  },
  {
    mode: "custom",
    label: "Custom",
    detailLabel: "Instructions",
    placeholder: "Sent after booking",
    mono: false,
  },
];

export const DURATION_PRESETS = [15, 30, 45, 60] as const;

export const REFUND_POLICIES: ReadonlyArray<{
  value: RefundPolicy;
  label: string;
}> = [
  { value: "full", label: "Full refund" },
  { value: "partial", label: "Partial" },
  { value: "deposit_only", label: "Keep deposit" },
  { value: "none", label: "No refund" },
];

// Bounds mirror the backend eventTypeSchema.
export const MIN_DURATION = 5;
export const MAX_DURATION = 1440;

export interface EventTypeFormValues {
  name: string;
  slug: string;
  description: string;
  color: string;
  durations: number[];
  default_duration: number;
  location_mode: EventTypeLocationMode;
  location_detail: string;
  /** Display-only here — assignee/assignment config is owned by W13 (link out). */
  assignment_mode: AssignmentMode;
  requires_approval: boolean;
  visibility: EventTypeVisibility;
  is_active: boolean;
  buffer_before_min: number;
  buffer_after_min: number;
  min_notice_min: number;
  max_horizon_days: number;
  daily_cap: number | null;
  // Pricing — only persisted when the schedulingPaid flag is on.
  charge: boolean;
  price_cents: number;
  currency: string;
  collect_deposit: boolean;
  deposit_cents: number;
  refund_policy: RefundPolicy;
}

export function defaultFormValues(
  presetDuration?: number,
): EventTypeFormValues {
  const d =
    presetDuration && presetDuration >= MIN_DURATION ? presetDuration : 30;
  return {
    name: "",
    slug: "",
    description: "",
    color: EVENT_TYPE_COLORS[0],
    durations: [d],
    default_duration: d,
    location_mode: "video",
    location_detail: "",
    assignment_mode: "one_on_one",
    requires_approval: false,
    visibility: "public",
    is_active: true,
    buffer_before_min: 0,
    buffer_after_min: 0,
    min_notice_min: 0,
    max_horizon_days: 60,
    daily_cap: null,
    charge: false,
    price_cents: 0,
    currency: "USD",
    collect_deposit: false,
    deposit_cents: 0,
    refund_policy: "full",
  };
}

export function eventTypeToForm(et: EventType): EventTypeFormValues {
  const durations =
    Array.isArray(et.durations) && et.durations.length
      ? [...et.durations]
      : [et.default_duration];
  return {
    name: et.name ?? "",
    slug: et.slug ?? "",
    description: et.description ?? "",
    color: et.color ?? EVENT_TYPE_COLORS[0],
    durations,
    default_duration: et.default_duration ?? durations[0],
    location_mode: et.location_mode ?? "video",
    location_detail: et.location_detail ?? "",
    assignment_mode: et.assignment_mode ?? "one_on_one",
    requires_approval: Boolean(et.requires_approval),
    visibility: et.visibility ?? "public",
    is_active: et.is_active !== false,
    buffer_before_min: et.buffer_before_min ?? 0,
    buffer_after_min: et.buffer_after_min ?? 0,
    min_notice_min: et.min_notice_min ?? 0,
    max_horizon_days: et.max_horizon_days ?? 60,
    daily_cap: et.daily_cap ?? null,
    charge: (et.price_cents ?? 0) > 0,
    price_cents: et.price_cents ?? 0,
    currency: et.currency || "USD",
    collect_deposit: (et.deposit_cents ?? 0) > 0,
    deposit_cents: et.deposit_cents ?? 0,
    refund_policy: et.refund_policy || "full",
  };
}

/** Derive a backend-valid slug (/^[a-z0-9][a-z0-9-]{0,60}$/) from a name. */
export function slugify(name: string): string {
  const base = (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 61)
    .replace(/-+$/g, "");
  return base || "event";
}

/** Append/replace a numeric suffix for retrying a taken slug (event → event-2). */
export function suffixSlug(slug: string, n: number): string {
  const stripped = slug.replace(/-\d+$/, "");
  return `${stripped}-${n}`.slice(0, 61).replace(/-+$/g, "");
}

/** Sorted, de-duplicated, in-range durations. */
function normalizeDurations(durations: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of durations) {
    const d = Math.round(Number(raw));
    if (!Number.isFinite(d) || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Serialize form → EventTypeInput. `includePricing` mirrors the schedulingPaid
 * flag: when off, every priced field is OMITTED so a PUT never clobbers a value
 * set elsewhere (W14). `slug` is included for create; on edit it is preserved.
 */
export function formToInput(
  values: EventTypeFormValues,
  opts: { includePricing: boolean },
): EventTypeInput {
  const durations = normalizeDurations(values.durations);
  // default_duration must be in durations (backend enforces this too).
  const defaultDuration = durations.includes(values.default_duration)
    ? values.default_duration
    : durations[0];

  const input: EventTypeInput = {
    name: values.name.trim(),
    slug: values.slug,
    description: values.description.trim(),
    color: values.color,
    durations,
    default_duration: defaultDuration,
    location_mode: values.location_mode,
    location_detail: values.location_detail.trim(),
    requires_approval: values.requires_approval,
    visibility: values.visibility,
    is_active: values.is_active,
    buffer_before_min: clampInt(values.buffer_before_min, 0, 720),
    buffer_after_min: clampInt(values.buffer_after_min, 0, 720),
    min_notice_min: Math.max(0, Math.round(values.min_notice_min)),
    max_horizon_days: clampInt(values.max_horizon_days, 1, 730),
    daily_cap:
      values.daily_cap == null || values.daily_cap <= 0
        ? null
        : Math.round(values.daily_cap),
  };

  if (opts.includePricing) {
    const charging = values.charge;
    input.price_cents = charging
      ? Math.max(0, Math.round(values.price_cents))
      : 0;
    input.currency = (values.currency || "USD").toUpperCase().slice(0, 3);
    input.deposit_cents =
      charging && values.collect_deposit
        ? Math.max(0, Math.round(values.deposit_cents))
        : 0;
    input.deposit_refundable = values.refund_policy !== "none";
    input.refund_policy = values.refund_policy;
  }

  return input;
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Dollars (string or number) → integer cents. */
export function dollarsToCents(dollars: string | number): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Integer cents → a plain dollars string for an input ("12000" → "120"). */
export function centsToDollars(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

/**
 * Client-side validation. Keys match the backend `details[].field` names so a
 * 400 response maps onto the same fields. `paid` mirrors the flag so priced
 * fields are only validated when surfaced.
 */
export function validateForm(
  values: EventTypeFormValues,
  opts: { paid: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Give this event type a name.";
  } else if (name.length > 200) {
    errors.name = "Keep the name under 200 characters.";
  }

  const durations = normalizeDurations(values.durations);
  if (durations.length === 0) {
    errors.durations = "Add at least one length.";
  } else if (durations.some((d) => d < MIN_DURATION || d > MAX_DURATION)) {
    errors.durations = "Lengths must be between 5 minutes and 24 hours.";
  }

  if (opts.paid && values.charge) {
    if (!(values.price_cents > 0)) {
      errors.price_cents = "Enter a price, or turn off charging.";
    }
    if (values.collect_deposit) {
      if (!(values.deposit_cents > 0)) {
        errors.deposit_cents = "Enter a deposit amount.";
      } else if (
        values.price_cents > 0 &&
        values.deposit_cents > values.price_cents
      ) {
        errors.deposit_cents = "The deposit can't be more than the price.";
      }
    }
  }

  return errors;
}

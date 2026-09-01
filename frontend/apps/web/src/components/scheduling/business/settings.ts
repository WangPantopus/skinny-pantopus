// Business Scheduling Settings (G5) defaults model. The backend booking page is
// the persistence target (PUT /booking-page): `timezone` and `cancellation_policy`
// are first-class columns; everything else (confirmation mode, approval window,
// notice/horizon/buffer defaults) rides in the flexible `branding` JSON so it
// "flows into each service" without new columns. The confirmation flag reuses
// W1's `default_requires_approval` key for cross-surface consistency. Notify
// toggles live in the flexible notification-preferences object. Pure helpers
// (no React) so the (de)serialization is unit-testable.

import type {
  BookingPage,
  CancellationPolicyValue,
  NotificationPreferences,
} from "@pantopus/types";
import { resolvePolicyValue } from "@/components/scheduling/policyValue";

export type ConfirmationMode = "auto" | "approve";

export interface SchedulingDefaults {
  confirmation: ConfirmationMode;
  approvalWindowHours: number;
  minNoticeMin: number;
  maxHorizonDays: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
}

export const DEFAULTS: SchedulingDefaults = {
  confirmation: "auto",
  approvalWindowHours: 24,
  minNoticeMin: 240,
  maxHorizonDays: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Read the business scheduling defaults out of the page (branding + columns). */
export function readDefaults(page: BookingPage | null): SchedulingDefaults {
  const b = (page?.branding ?? {}) as Record<string, unknown>;
  return {
    confirmation: b["default_requires_approval"] === true ? "approve" : "auto",
    approvalWindowHours: num(
      b["approval_window_hours"],
      DEFAULTS.approvalWindowHours,
    ),
    minNoticeMin: num(b["default_min_notice_min"], DEFAULTS.minNoticeMin),
    maxHorizonDays: num(b["default_max_horizon_days"], DEFAULTS.maxHorizonDays),
    bufferBeforeMin: num(
      b["default_buffer_before_min"],
      DEFAULTS.bufferBeforeMin,
    ),
    bufferAfterMin: num(b["default_buffer_after_min"], DEFAULTS.bufferAfterMin),
  };
}

/** Build the `branding` object for a PUT, preserving unknown keys. */
export function brandingPatch(
  page: BookingPage | null,
  patch: Partial<{
    confirmation: ConfirmationMode;
    approvalWindowHours: number;
    minNoticeMin: number;
    maxHorizonDays: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
    /** Per-member "not bookable" overrides keyed by member id (G3). */
    bookableOff: string[];
  }>,
): Record<string, unknown> {
  const b: Record<string, unknown> = { ...((page?.branding ?? {}) as object) };
  if (patch.confirmation !== undefined)
    b["default_requires_approval"] = patch.confirmation === "approve";
  if (patch.approvalWindowHours !== undefined)
    b["approval_window_hours"] = patch.approvalWindowHours;
  if (patch.minNoticeMin !== undefined)
    b["default_min_notice_min"] = patch.minNoticeMin;
  if (patch.maxHorizonDays !== undefined)
    b["default_max_horizon_days"] = patch.maxHorizonDays;
  if (patch.bufferBeforeMin !== undefined)
    b["default_buffer_before_min"] = patch.bufferBeforeMin;
  if (patch.bufferAfterMin !== undefined)
    b["default_buffer_after_min"] = patch.bufferAfterMin;
  if (patch.bookableOff !== undefined) b["bookable_off"] = patch.bookableOff;
  return b;
}

/** Per-member opt-out list for the team-availability "bookable" toggle (G3). */
export function readBookableOff(page: BookingPage | null): string[] {
  const v = (page?.branding as Record<string, unknown> | undefined)?.[
    "bookable_off"
  ];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** Minutes → friendly duration: '4 hours', '30 min', '2 days', '1 hour'. */
export function durationLabel(min: number): string {
  if (min <= 0) return "None";
  if (min % 1440 === 0) {
    const d = min / 1440;
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${min} min`;
}

export function minNoticeLabel(min: number): string {
  return durationLabel(min);
}

export function horizonLabel(days: number): string {
  if (days <= 0) return "No limit";
  return `${days} day${days === 1 ? "" : "s"} out`;
}

export function bufferLabel(before: number, after: number): string {
  if (before === 0 && after === 0) return "None";
  return `${before} min before · ${after} after`;
}

export function approvalWindowLabel(hours: number): string {
  return `${hours}h to respond`;
}

export function confirmationNote(mode: ConfirmationMode): string {
  return mode === "approve"
    ? "You approve each request before it lands on your calendar."
    : "Auto-confirm sends the booking straight to your calendar.";
}

/**
 * Summarise the cancellation policy for the Policy chevron row. Tolerates the
 * string wire shape (iOS preset name or free text) via resolvePolicyValue.
 */
export function cancellationLabel(
  value: CancellationPolicyValue | null | undefined,
): string | null {
  const p = resolvePolicyValue(value);
  if (!p) return null;
  const cutoff = typeof p.cutoff_min === "number" ? p.cutoff_min : null;
  const refund =
    p.refund_policy === "full"
      ? "Flexible"
      : p.refund_policy === "partial"
        ? "Moderate"
        : p.refund_policy === "none"
          ? "Strict"
          : null;
  if (cutoff == null) return p.notes ? "Custom policy" : refund;
  const window = durationLabel(cutoff);
  return refund ? `${refund} · ${window}` : window;
}

// ─── Notification toggles (flexible prefs object) ────────────────────────────

export function notifyOwner(prefs: NotificationPreferences | null): boolean {
  // Default ON — the owner expects to hear about new bookings.
  return prefs?.["notify_owner"] !== false;
}

export function notifyMember(prefs: NotificationPreferences | null): boolean {
  return prefs?.["notify_member"] === true;
}

export function prefsWith(
  prefs: NotificationPreferences | null,
  patch: Partial<{ notifyOwner: boolean; notifyMember: boolean }>,
): NotificationPreferences {
  const next: NotificationPreferences = { ...(prefs ?? {}) };
  if (patch.notifyOwner !== undefined) next["notify_owner"] = patch.notifyOwner;
  if (patch.notifyMember !== undefined)
    next["notify_member"] = patch.notifyMember;
  return next;
}

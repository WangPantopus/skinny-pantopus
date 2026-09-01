// W14 · G14 policy model. Maps the four invitee-facing presets (Flexible /
// Moderate / Strict / Custom) to the backend `CancellationPolicy` object stored
// on the booking page, and back (so a saved policy re-selects its preset on
// load). The live preview is rendered by the W0 `CancellationPolicy` component
// (the exact sentence shown to invitees at checkout) — this file only builds
// the policy object it consumes.

import type {
  CancellationPolicy,
  CancellationPolicyValue,
  RefundPolicy,
} from "@pantopus/types";

export type PresetKey = "flexible" | "moderate" | "strict" | "custom";

export interface PresetMeta {
  key: PresetKey;
  name: string;
  summary: string;
}

export const PRESETS: PresetMeta[] = [
  {
    key: "flexible",
    name: "Flexible",
    summary: "Full refund up to 24h before",
  },
  {
    key: "moderate",
    name: "Moderate",
    summary: "50% refund up to 48h before",
  },
  { key: "strict", name: "Strict", summary: "No refund after booking" },
  { key: "custom", name: "Custom", summary: "Set your own rules" },
];

export type NoShowHandling = "charge_full" | "no_charge";

/** Editable fields revealed when "Custom" is chosen. */
export interface CustomPolicy {
  /** Free-cancellation cutoff, in hours before start. */
  cutoffHours: number;
  /** Refund percentage granted after the cutoff (0–100). */
  refundPctAfter: number;
  /** Keep the deposit on cancellation. */
  depositNonRefundable: boolean;
  /** What happens on a no-show. */
  noShow: NoShowHandling;
}

export const DEFAULT_CUSTOM: CustomPolicy = {
  cutoffHours: 24,
  refundPctAfter: 50,
  depositNonRefundable: true,
  noShow: "charge_full",
};

/** Allowed cutoff steps (hours) for the custom stepper. */
export const CUTOFF_STEPS = [0, 1, 2, 6, 12, 24, 48, 72, 168];
/** Allowed refund-after-cutoff steps (percent). 5 % granularity matching native (iOS/Android). */
export const REFUND_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export function cutoffLabel(hours: number): string {
  if (hours <= 0) return "Anytime";
  if (hours % 168 === 0) {
    const w = hours / 168;
    return `${w}wk`;
  }
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `${d}d`;
  }
  return `${hours}h`;
}

const PRESET_POLICY: Record<
  Exclude<PresetKey, "custom">,
  CancellationPolicy
> = {
  flexible: {
    cutoff_min: 1440,
    reschedule_cutoff_min: 1440,
    refund_policy: "full",
    notes: null,
  },
  moderate: {
    cutoff_min: 2880,
    reschedule_cutoff_min: 2880,
    refund_policy: "partial",
    notes: null,
  },
  strict: {
    cutoff_min: 0,
    reschedule_cutoff_min: 0,
    refund_policy: "none",
    notes: null,
  },
};

/** Derive the refund_policy enum from custom fields (for W0's renderer). */
function customRefundPolicy(c: CustomPolicy): RefundPolicy {
  if (c.refundPctAfter >= 100) return "full";
  if (c.refundPctAfter > 0) return "partial";
  if (c.depositNonRefundable) return "deposit_only";
  return "none";
}

/** Build the stored CancellationPolicy for the chosen preset (+ custom fields). */
export function toCancellationPolicy(
  selected: PresetKey,
  custom: CustomPolicy,
): CancellationPolicy {
  if (selected !== "custom") {
    return { ...PRESET_POLICY[selected], preset: selected };
  }
  const cutoffMin = Math.max(0, Math.round(custom.cutoffHours * 60));
  return {
    cutoff_min: cutoffMin,
    reschedule_cutoff_min: cutoffMin,
    refund_policy: customRefundPolicy(custom),
    notes: null,
    preset: "custom",
    refund_percent_after: custom.refundPctAfter,
    deposit_non_refundable: custom.depositNonRefundable,
    no_show_handling: custom.noShow,
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function matchesPreset(
  policy: CancellationPolicy,
  key: Exclude<PresetKey, "custom">,
): boolean {
  const p = PRESET_POLICY[key];
  return (
    (num(policy.cutoff_min) ?? 0) === p.cutoff_min &&
    (policy.refund_policy ?? "full") === p.refund_policy
  );
}

/**
 * Re-derive the selected preset + custom fields from a stored policy. The wire
 * value may be a plain string (iOS preset name or free text) — tolerate both.
 */
export function fromCancellationPolicy(
  value: CancellationPolicyValue | null | undefined,
): { selected: PresetKey; custom: CustomPolicy } {
  if (!value) return { selected: "flexible", custom: DEFAULT_CUSTOM };

  let policy: CancellationPolicy;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "flexible" || key === "moderate" || key === "strict") {
      policy = { ...PRESET_POLICY[key], preset: key };
    } else if (key) {
      // Free text → surface as custom so nothing is silently dropped.
      policy = { preset: "custom", notes: value };
    } else {
      return { selected: "flexible", custom: DEFAULT_CUSTOM };
    }
  } else {
    policy = value;
  }

  // Explicit marker wins (set by toCancellationPolicy).
  const marker = policy.preset;
  const hasCustomFields =
    policy.refund_percent_after != null ||
    policy.deposit_non_refundable != null ||
    policy.no_show_handling != null;

  if (marker === "custom" || (marker == null && hasCustomFields)) {
    return {
      selected: "custom",
      custom: readCustom(policy),
    };
  }
  if (marker === "flexible" || marker === "moderate" || marker === "strict") {
    return { selected: marker, custom: readCustom(policy) };
  }
  for (const key of ["flexible", "moderate", "strict"] as const) {
    if (matchesPreset(policy, key)) {
      return { selected: key, custom: readCustom(policy) };
    }
  }
  // Anything else → represent as custom so nothing is silently dropped.
  return { selected: "custom", custom: readCustom(policy) };
}

function readCustom(policy: CancellationPolicy): CustomPolicy {
  const cutoffMin = num(policy.cutoff_min);
  const pct = num(policy.refund_percent_after);
  return {
    cutoffHours:
      cutoffMin != null
        ? Math.round(cutoffMin / 60)
        : DEFAULT_CUSTOM.cutoffHours,
    refundPctAfter:
      pct != null
        ? pct
        : policy.refund_policy === "full"
          ? 100
          : policy.refund_policy === "partial"
            ? 50
            : 0,
    depositNonRefundable:
      typeof policy.deposit_non_refundable === "boolean"
        ? policy.deposit_non_refundable
        : policy.refund_policy === "deposit_only",
    noShow:
      policy.no_show_handling === "no_charge" ? "no_charge" : "charge_full",
  };
}

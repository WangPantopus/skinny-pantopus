// Wire-shape tolerance for `cancellation_policy` (jsonb since migration 166).
// The stored value is EITHER the structured CancellationPolicy object or a
// plain string — an app preset name ('flexible' | 'moderate' | 'strict', in
// any case) or a free-text blurb. The iOS and Android custom editors save their
// own keys, as an object (iOS) or its JSON text (Android). Every web consumer
// normalizes through resolvePolicyValue so all shapes render. Pure helpers (no
// React) so they stay unit-testable.

import type {
  CancellationPolicy,
  CancellationPolicyValue,
} from "@pantopus/types";

/** iOS writes bare preset strings; map them to the objects those presets mean. */
const PRESET_STRING_POLICY: Record<string, CancellationPolicy> = {
  flexible: {
    preset: "flexible",
    cutoff_min: 1440,
    reschedule_cutoff_min: 1440,
    refund_policy: "full",
    notes: null,
  },
  moderate: {
    preset: "moderate",
    cutoff_min: 2880,
    reschedule_cutoff_min: 2880,
    refund_policy: "partial",
    notes: null,
  },
  strict: {
    preset: "strict",
    cutoff_min: 0,
    reschedule_cutoff_min: 0,
    refund_policy: "none",
    notes: null,
  },
};

/**
 * Normalize the wire `cancellation_policy` value to a structured object.
 * Preset strings map to their canonical objects; a custom policy saved by the
 * apps (an object, or its JSON text from Android) maps to this shape; any
 * other non-empty string becomes a notes-only policy (rendered verbatim);
 * empty/null → null.
 */
export function resolvePolicyValue(
  value: CancellationPolicyValue | null | undefined,
): CancellationPolicy | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const preset = PRESET_STRING_POLICY[trimmed.toLowerCase()];
    if (preset) return preset;
    const encoded = parseObjectText(trimmed);
    if (encoded) return fromAppKeys(encoded);
    return { preset: "custom", notes: trimmed };
  }
  return fromAppKeys(value);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Android saves its custom policy as JSON text; read the object it encodes. */
function parseObjectText(text: string): CancellationPolicy | null {
  if (!text.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as CancellationPolicy)
      : null;
  } catch {
    return null;
  }
}

/**
 * The apps' custom policy uses its own keys (`free_cancel_window_min`,
 * `refund_after_pct`, `no_show`). Map them onto this shape so every consumer
 * states the host's terms; web's own objects pass through unchanged.
 */
function fromAppKeys(policy: CancellationPolicy): CancellationPolicy {
  const cutoff = num(policy.free_cancel_window_min);
  const pctAfter = num(policy.refund_after_pct);
  if (cutoff == null && pctAfter == null) return policy;
  const pct = num(policy.refund_percent_after) ?? pctAfter ?? 0;
  const deposit = policy.deposit_non_refundable === true;
  return {
    ...policy,
    preset: policy.preset ?? "custom",
    cutoff_min: policy.cutoff_min ?? cutoff,
    reschedule_cutoff_min: policy.reschedule_cutoff_min ?? cutoff,
    refund_percent_after: pct,
    // As policyPresets' customRefundPolicy derives it for web's own custom policies.
    refund_policy:
      policy.refund_policy ??
      (pct >= 100 ? "full" : pct > 0 ? "partial" : deposit ? "deposit_only" : "none"),
    no_show_handling: policy.no_show_handling ?? policy.no_show ?? null,
  };
}

/** True when the policy carries only free text (render the notes verbatim). */
export function isNotesOnlyPolicy(policy: CancellationPolicy): boolean {
  return (
    !!policy.notes &&
    policy.cutoff_min == null &&
    policy.reschedule_cutoff_min == null &&
    policy.refund_policy == null
  );
}

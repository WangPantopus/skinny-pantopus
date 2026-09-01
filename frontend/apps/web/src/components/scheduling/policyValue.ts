// Wire-shape tolerance for `cancellation_policy` (jsonb since migration 166).
// The stored value is EITHER the structured CancellationPolicy object or a
// plain string — an iOS preset name ('flexible' | 'moderate' | 'strict') or a
// free-text blurb. Every web consumer normalizes through resolvePolicyValue so
// both shapes render. Pure helpers (no React) so they stay unit-testable.

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
 * Preset strings map to their canonical objects; any other non-empty string
 * becomes a notes-only policy (rendered verbatim); empty/null → null.
 */
export function resolvePolicyValue(
  value: CancellationPolicyValue | null | undefined,
): CancellationPolicy | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return (
      PRESET_STRING_POLICY[trimmed.toLowerCase()] ?? {
        preset: "custom",
        notes: trimmed,
      }
    );
  }
  return value;
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

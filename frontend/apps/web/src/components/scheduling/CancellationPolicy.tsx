// Read-only renderer for a cancellation/refund policy. Used in the invitee
// confirm + manage surfaces (the "what the invitee sees" sentence). The owner
// EDITOR (presets / custom fields) is a separate stream (W14).
//
// The wire value (`cancellation_policy`, jsonb) is EITHER the structured
// object or a plain string — an iOS preset ('flexible'|'moderate'|'strict')
// or a free-text blurb. `resolvePolicyValue` normalizes all shapes so every
// consumer tolerates both.

import clsx from "clsx";
import { Clock, RefreshCcw, Wallet } from "lucide-react";
import type {
  CancellationPolicy as CancellationPolicyData,
  CancellationPolicyValue,
  RefundPolicy,
} from "@pantopus/types";
import {
  isNotesOnlyPolicy,
  resolvePolicyValue,
} from "@/components/scheduling/policyValue";

const REFUND_LABEL: Record<RefundPolicy, string> = {
  full: "Full refund",
  partial: "Partial refund",
  none: "No refund",
  deposit_only: "Deposit kept",
};

function formatWindow(min?: number | null): string | null {
  if (min == null) return null;
  if (min <= 0) return "anytime";
  if (min % 1440 === 0) {
    const d = min / 1440;
    return `${d} day${d > 1 ? "s" : ""} before`;
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} hour${h > 1 ? "s" : ""} before`;
  }
  return `${min} min before`;
}

function plainSentence(policy: CancellationPolicyData): string {
  const cutoff = formatWindow(policy.cutoff_min);
  const refund = policy.refund_policy;
  if (refund === "none") {
    return cutoff
      ? `Cancellations are accepted up to ${cutoff} the start; this booking is non-refundable.`
      : "This booking is non-refundable.";
  }
  if (refund === "full" || refund == null) {
    return cutoff
      ? `Cancel up to ${cutoff} the start for a full refund.`
      : "You can cancel anytime for a full refund.";
  }
  if (refund === "partial") {
    return cutoff
      ? `Cancel up to ${cutoff} the start for a full refund; partial after that.`
      : "Partial refunds may apply on cancellation.";
  }
  return cutoff
    ? `Cancel up to ${cutoff} the start; the deposit is kept.`
    : "The deposit is non-refundable.";
}

export default function CancellationPolicy({
  policy: value,
  className,
}: {
  policy?: CancellationPolicyValue | null;
  className?: string;
}) {
  const policy = resolvePolicyValue(value);
  if (!policy) return null;

  // Free-text policy → render the host's own words, nothing derived.
  if (isNotesOnlyPolicy(policy)) {
    return (
      <div
        className={clsx(
          "rounded-xl border border-app-border bg-app-surface p-4",
          className,
        )}
      >
        <p className="text-sm text-app-text">{policy.notes}</p>
      </div>
    );
  }

  const cutoff = formatWindow(policy.cutoff_min);
  const reschedule = formatWindow(policy.reschedule_cutoff_min);
  const refund = policy.refund_policy
    ? REFUND_LABEL[policy.refund_policy]
    : null;

  return (
    <div
      className={clsx(
        "rounded-xl border border-app-border bg-app-surface p-4",
        className,
      )}
    >
      <p className="text-sm text-app-text">{plainSentence(policy)}</p>
      {(cutoff || reschedule || refund) && (
        <dl className="mt-3 space-y-2 border-t border-app-border-subtle pt-3">
          {cutoff && (
            <div className="flex items-center gap-2 text-xs text-app-text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span>Free cancellation {cutoff}</span>
            </div>
          )}
          {reschedule && (
            <div className="flex items-center gap-2 text-xs text-app-text-muted">
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              <span>Reschedule {reschedule}</span>
            </div>
          )}
          {refund && (
            <div className="flex items-center gap-2 text-xs text-app-text-muted">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              <span>{refund}</span>
            </div>
          )}
        </dl>
      )}
      {policy.notes && (
        <p className="mt-3 text-xs text-app-text-muted">{policy.notes}</p>
      )}
    </div>
  );
}

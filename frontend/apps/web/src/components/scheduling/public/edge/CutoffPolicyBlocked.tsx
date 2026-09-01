"use client";

// D10 — Reschedule / Cancel cutoff & policy-blocked. The note-card + the logic
// that decides, from the backend's computed `actions`, whether the invitee can
// still reschedule/cancel and what refund applies. Honest copy that names the
// rule and always leaves a fallback (never a dead end — that's D7).

import clsx from "clsx";
import {
  FileWarning,
  Clock,
  ShieldCheck,
  Info,
  type LucideIcon,
} from "lucide-react";
import { formatRange, money } from "./edgeUtils";
import type { ReschedulePolicy, CancelPolicy } from "./edgePolicy";

// Re-export the pure policy state-machines so consumers can keep importing them
// from this module while the logic lives in the dependency-free edgePolicy.ts.
export { deriveReschedulePolicy, deriveCancelPolicy } from "./edgePolicy";
export type { ReschedulePolicy, CancelPolicy } from "./edgePolicy";

type Tone = "warn" | "success" | "error";

const TONES: Record<
  Tone,
  { card: string; iconWrap: string; icon: string; title: string; body: string }
> = {
  warn: {
    card: "bg-app-warning-bg border-app-warning-light",
    iconWrap: "bg-app-surface border-app-warning-light",
    icon: "text-app-warning",
    // Design: title color = t.dk = WARN_DK = #92400E
    title: "text-[#92400E]",
    body: "text-app-warning",
  },
  success: {
    card: "bg-app-success-bg border-app-success-light",
    iconWrap: "bg-app-surface border-app-success-light",
    icon: "text-app-success",
    // Design: title color = t.dk = SUCCESS_DK = #047857
    title: "text-[#047857]",
    body: "text-app-success",
  },
  error: {
    card: "bg-app-error-bg border-app-error-light",
    iconWrap: "bg-app-surface border-app-error-light",
    icon: "text-app-error",
    // Design: title color = t.dk = ERR_DK = #991B1B
    title: "text-[#991B1B]",
    body: "text-app-error",
  },
};

/** The amber/green note card naming the rule + what's still possible. */
export function PolicyCard({
  tone = "warn",
  icon: Icon = FileWarning,
  title,
  body,
  still,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title: string;
  body: string;
  /** A divider sub-note: what the invitee can still do. */
  still?: string;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={clsx("flex gap-3 rounded-xl border p-3", t.card, className)}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          t.iconWrap,
        )}
      >
        <Icon className={clsx("h-4 w-4", t.icon)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-[13px] font-bold leading-snug", t.title)}>
          {title}
        </p>
        <p className={clsx("mt-1 text-xs leading-snug", t.body)}>{body}</p>
        {still && (
          <p
            className={clsx(
              "mt-2 flex items-start gap-1.5 border-t pt-2 text-xs font-semibold leading-snug",
              tone === "warn"
                ? "border-app-warning-light text-app-text-secondary"
                : tone === "error"
                  ? "border-app-error-light text-app-text-secondary"
                  : "border-app-success-light text-app-text-secondary",
            )}
          >
            <Info
              className={clsx("mt-0.5 h-3 w-3 shrink-0", t.icon)}
              aria-hidden
            />
            {still}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Copy builders (tz-aware, honest, names the rule) ───────────────────────

export function reschedulePolicyCopy(
  policy: ReschedulePolicy,
  tz?: string,
): {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  body: string;
  still?: string;
} | null {
  switch (policy.kind) {
    case "closed":
      return {
        tone: "warn",
        icon: Clock,
        title: "Reschedule window has closed",
        body: policy.deadline
          ? `Free reschedules ended ${formatRange(policy.deadline, null, tz)}.`
          : "The window to reschedule this booking has passed.",
        still: policy.canCancel ? "Cancelling is still open." : undefined,
      };
    case "not_online":
      return {
        tone: "warn",
        icon: FileWarning,
        title: "This booking can’t be changed online",
        body: "Your host handles reschedules directly for this event type.",
        still:
          "Reach out to the host and they’ll sort out any change with you.",
      };
    case "open":
    default:
      return null;
  }
}

export function cancelPolicyCopy(
  policy: CancelPolicy,
  currency: string,
  tz?: string,
): {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  body: string;
  still?: string;
} {
  switch (policy.kind) {
    case "open_free":
      return {
        tone: "success",
        icon: ShieldCheck,
        title: "You can cancel for a full refund",
        body: policy.deadline
          ? `Free cancellation is open until ${formatRange(policy.deadline, null, tz)}.`
          : "You can cancel this booking at no charge.",
      };
    case "open_partial":
      return {
        tone: "warn",
        icon: FileWarning,
        title: `You’ll get a ${money(policy.refundCents, currency)} refund`,
        body: `Cancelling now, within the cutoff, refunds part of what you paid — ${money(policy.refundCents, currency)}.`,
        still: "Keeping your booking is always free.",
      };
    case "open_no_refund":
      return {
        tone: "warn",
        icon: FileWarning,
        title: "It’s too late to cancel for a refund",
        body: "Free cancellation has ended for this booking.",
        still: "You can still cancel without a refund, or keep your booking.",
      };
    case "closed":
      return {
        tone: "warn",
        icon: Clock,
        title: "Cancelling online has closed",
        body: "The window to cancel this booking has passed.",
        still: "Reach out to the host if you need to make a change.",
      };
    case "not_online":
    default:
      return {
        tone: "warn",
        icon: FileWarning,
        title: "This booking can’t be changed online",
        body: "Your host handles cancellations directly for this event type.",
        still:
          "Reach out to the host and they’ll sort out any change with you.",
      };
  }
}

export default PolicyCard;

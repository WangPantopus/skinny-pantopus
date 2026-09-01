// Canonical booking / page-state status pill. A leading-icon + tinted-fill
// semantic pill (NOT text-only). Screens must replace ad-hoc chips with this so
// status reads consistently everywhere (host inbox, manage, detail, public).
//
// Color semantics (design source of truth):
//   confirmed → success green   pending  → info BLUE (not amber)
//   completed → neutral/info     cancelled/no_show/declined → error red
//   paused/secret/expired/unavailable → neutral
// (Reschedules stay 'confirmed' — previous_start_at marks them, not a status.)
// Pending is INFO blue by design — it is an awaiting-action state, not a
// warning. Amber is reserved for true warnings elsewhere.

import clsx from "clsx";
import {
  AlertTriangle,
  Ban,
  Check,
  CircleSlash,
  Clock,
  EyeOff,
  Hourglass,
  Lock,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type { BookingStatus } from "@pantopus/types";

export type StatusPillValue =
  | BookingStatus
  | "paused"
  | "secret"
  | "expired"
  | "unavailable";

interface PillConfig {
  label: string;
  /** bg + text tint classes (semantic, never the pillar accent). */
  cls: string;
  icon: LucideIcon;
}

const CONFIG: Record<StatusPillValue, PillConfig> = {
  confirmed: {
    label: "Confirmed",
    cls: "bg-app-success-bg text-app-success",
    icon: Check,
  },
  // Pending is an awaiting-action state → INFO blue, NOT amber.
  pending: {
    label: "Pending",
    cls: "bg-app-info-bg text-app-info",
    icon: Hourglass,
  },
  completed: {
    label: "Completed",
    cls: "bg-app-surface-sunken text-app-text-secondary",
    icon: Check,
  },
  declined: {
    label: "Declined",
    cls: "bg-app-error-bg text-app-error",
    icon: Ban,
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-app-error-bg text-app-error",
    icon: XCircle,
  },
  no_show: {
    label: "No-show",
    cls: "bg-app-error-bg text-app-error",
    icon: CircleSlash,
  },
  paused: {
    label: "Paused",
    cls: "bg-app-surface-muted text-app-text-secondary",
    icon: Clock,
  },
  secret: {
    label: "Private",
    cls: "bg-app-surface-muted text-app-text-secondary",
    icon: Lock,
  },
  expired: {
    label: "Expired",
    cls: "bg-app-surface-muted text-app-text-muted",
    icon: AlertTriangle,
  },
  unavailable: {
    label: "Unavailable",
    cls: "bg-app-surface-muted text-app-text-muted",
    icon: EyeOff,
  },
};

const FALLBACK: PillConfig = {
  label: "",
  cls: "bg-app-surface-muted text-app-text-muted",
  icon: Clock,
};

export default function BookingStatusPill({
  status,
  className,
}: {
  status: StatusPillValue | string;
  className?: string;
}) {
  const cfg = CONFIG[status as StatusPillValue] ?? {
    ...FALLBACK,
    label: String(status),
  };
  const Icon = cfg.icon;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        cfg.cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
      {cfg.label}
    </span>
  );
}

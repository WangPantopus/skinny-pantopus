"use client";

// W14 · shared atoms for the scheduling Payments surfaces (G6 / G7 / G14).
// Web translation of the biz-kit design vocabulary (A14.6 settings rows, A18
// status framing) using design-system theme tokens only — violet (business)
// pillar accent, no hardcoded product colors. These atoms are local to the W14
// stream; the canonical invitee-facing policy renderer stays W0
// `CancellationPolicy` (reused read-only).

import type { ReactNode } from "react";
import clsx from "clsx";
import { Check, Minus, Clock, type LucideIcon } from "lucide-react";

/** Cents → "$1,234.56". */
export function formatUsd(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100;
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

/** Uppercase section overline (violet accent variant available). */
export function SectionLabel({
  children,
  accent,
  action,
}: {
  children: ReactNode;
  accent?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 mt-1 flex items-baseline justify-between">
      <p
        className={clsx(
          "text-[11px] font-bold uppercase tracking-wider",
          accent ? "text-app-business" : "text-app-text-muted",
        )}
      >
        {children}
      </p>
      {action}
    </div>
  );
}

/** White surface card with 1px border + soft shadow (matches design Card). */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type ChipTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "business"
  | "neutral";

const CHIP_TONES: Record<ChipTone, string> = {
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  info: "bg-primary-50 text-primary-700",
  business: "bg-app-business-bg text-app-business",
  neutral: "bg-app-surface-sunken text-app-text-strong",
};

export function StatusChip({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        CHIP_TONES[tone],
      )}
    >
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={2.8} aria-hidden />}
      {children}
    </span>
  );
}

/** Readiness pill (charges / payouts / details) — on | off | warn. */
export function ReadyPill({
  label,
  state,
}: {
  label: string;
  state: "on" | "off" | "warn";
}) {
  const map = {
    on: { wrap: "bg-green-50 text-green-700", Icon: Check },
    warn: { wrap: "bg-amber-50 text-amber-700", Icon: Clock },
    off: { wrap: "bg-app-surface-sunken text-app-text-muted", Icon: Minus },
  } as const;
  const { wrap, Icon } = map[state];
  return (
    <div
      className={clsx(
        "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2",
        wrap,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
      <span className="text-[9.5px] font-bold uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

/** Settings chevron/toggle row (A14.6 vocabulary): icon disc · label · sub · trailing. */
export function SettingRow({
  icon: Icon,
  iconClassName,
  label,
  sub,
  trailing,
  last,
  onClick,
  disabled,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  label: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  last?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={clsx(
        "flex items-center gap-3 px-4 py-3",
        !last && "border-b border-app-border-subtle",
        interactive &&
          "cursor-pointer rounded-lg transition-colors hover:bg-app-hover",
        disabled && "opacity-55",
      )}
    >
      {Icon && (
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            iconClassName ?? "bg-app-surface-sunken text-app-text-strong",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-app-text">
          {label}
        </div>
        {sub != null && (
          <div className="mt-0.5 truncate text-xs text-app-text-secondary">
            {sub}
          </div>
        )}
      </div>
      {trailing}
    </div>
  );
}

/** Em-dash used to signal a gated/blocked row. */
export function Dash() {
  return <span className="text-sm text-app-text-muted">—</span>;
}

/** Semantic inline note. */
export function InlineNote({
  tone = "info",
  icon: Icon,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const map = {
    info: "bg-app-business-bg text-app-text-strong",
    warning: "border border-amber-200 bg-amber-50 text-amber-700",
    error: "border border-red-200 bg-red-50 text-red-700",
    success: "border border-green-200 bg-green-50 text-green-700",
  } as const;
  const iconColor = {
    info: "text-app-business",
    warning: "text-amber-600",
    error: "text-red-600",
    success: "text-green-600",
  } as const;
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
        map[tone],
      )}
    >
      {Icon && (
        <Icon
          className={clsx("mt-0.5 h-4 w-4 shrink-0", iconColor[tone])}
          aria-hidden
        />
      )}
      <span className="text-xs font-medium leading-snug">{children}</span>
    </div>
  );
}

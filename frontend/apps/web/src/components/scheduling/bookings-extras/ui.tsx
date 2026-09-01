"use client";

// Small shared primitives for W9 (Bookings extras). Kept local to the stream's
// folder so it stays disjoint from other streams, and built entirely on design
// tokens + the pillar token map — no hardcoded colors/spacing.

import type { ReactNode } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { initials as toInitials } from "./format";

const PILLAR_LABEL: Record<Pillar, string> = {
  personal: "Personal",
  home: "Home",
  business: "Business",
};

/** A small identity pill marking which pillar a surface belongs to. */
export function PillarBadge({
  pillar,
  className,
}: {
  pillar: Pillar;
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tk.bgSoft,
        tk.text,
        className,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", tk.bg)} aria-hidden />
      {PILLAR_LABEL[pillar]}
    </span>
  );
}

/** Uppercase section overline. */
export function SectionOverline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "text-[11px] font-semibold uppercase tracking-wide text-app-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

export type ChipTone = "neutral" | "success" | "warning" | "error" | "info";

const CHIP_ACTIVE: Record<ChipTone, string> = {
  neutral: "bg-app-info-bg text-app-info",
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  error: "bg-app-error-bg text-app-error",
  info: "bg-app-info-bg text-app-info",
};

/** A selectable filter/audience pill. Active state tints by tone (or pillar). */
export function FilterChip({
  label,
  active = false,
  tone = "neutral",
  count,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  tone?: ChipTone;
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        active
          ? CHIP_ACTIVE[tone]
          : "border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
      )}
    >
      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
          aria-hidden
        />
      )}
      {label}
      {typeof count === "number" && (
        <span className="tabular-nums opacity-70">· {count}</span>
      )}
    </button>
  );
}

/** Initials avatar tinted by pillar, with an optional verified check badge. */
export function Avatar({
  name,
  pillar,
  verified = false,
  size = 38,
}: {
  name?: string | null;
  pillar: Pillar;
  verified?: boolean;
  size?: number;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full font-bold",
          tk.bg,
          tk.textOn,
        )}
        style={{ width: size, height: size, fontSize: Math.round(size / 2.9) }}
      >
        {toInitials(name)}
      </span>
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-app-surface"
          aria-label="Verified"
        >
          <span className={clsx("h-3 w-3 rounded-full", tk.bg)} />
        </span>
      )}
    </span>
  );
}

/** Capacity progress bar (seats filled). Greys out when full. */
export function CapacityBar({
  pct,
  full = false,
  pillar,
}: {
  pct: number;
  full?: boolean;
  pillar: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-app-surface-sunken">
      <div
        className={clsx(
          "h-full rounded-full transition-all",
          full ? "bg-app-text-muted" : tk.bg,
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const STAT_TONE: Record<ChipTone, string> = {
  neutral: "text-app-text",
  success: "text-app-success",
  warning: "text-app-warning",
  error: "text-app-error",
  info: "text-app-info",
};

/** A small stat block (number over an uppercase label) for the capacity header. */
export function Stat({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: ChipTone;
}) {
  return (
    <div className="flex-1 rounded-xl bg-app-surface-sunken px-2 py-2 text-center">
      <div
        className={clsx("text-lg font-extrabold tabular-nums", STAT_TONE[tone])}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
        {label}
      </div>
    </div>
  );
}

/** Labeled form field wrapper. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-app-text-muted">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-app-error">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-app-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border bg-app-surface-sunken px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40";

export function TextInput({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={clsx(
        inputBase,
        invalid ? "border-app-error" : "border-app-border",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({
  invalid,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={clsx(
        inputBase,
        "min-h-[88px] resize-y leading-relaxed",
        invalid ? "border-app-error" : "border-app-border",
        className,
      )}
      {...props}
    />
  );
}

/** Switch row (label + optional sub-label + toggle). */
export function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  icon: Icon,
  pillar = "personal",
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon?: LucideIcon;
  pillar?: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-left"
    >
      {Icon && (
        <Icon
          className="h-4 w-4 shrink-0 text-app-text-secondary"
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-app-text">{label}</span>
        {sub && (
          <span className="block text-xs text-app-text-muted">{sub}</span>
        )}
      </span>
      <span
        className={clsx(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? tk.bg : "bg-app-border-strong",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            checked ? "right-0.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

const DISC_TONE: Record<ChipTone, string> = {
  neutral: "bg-app-surface-sunken text-app-text-muted",
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  error: "bg-app-error-bg text-app-error",
  info: "bg-app-info-bg text-app-info",
};

/** Circular icon badge used at the top of confirm modals. */
export function IconDisc({
  icon: Icon,
  tone = "neutral",
  size = 44,
}: {
  icon: LucideIcon;
  tone?: ChipTone;
  size?: number;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full",
        DISC_TONE[tone],
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

/** Inline error banner used inside sheets/modals. */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-app-error/40 bg-app-error-bg px-3 py-2.5">
      <span className="text-xs font-semibold text-app-error">{message}</span>
    </div>
  );
}

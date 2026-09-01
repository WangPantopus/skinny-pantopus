"use client";

// Shared violet-pillar UI kit for the W13 Business-config screens (G1–G5).
// Web translation of the design's biz-kit.jsx: grouped chevron-row cards,
// segmented controls, semantic notes, steppers, selectable rule tiles and the
// member avatar. Convention (per the designs): Business violet (app-business)
// carries pillar accent — overlines, active segmented, selected tiles, toggles;
// functional CTAs stay product sky (primary-600). Theme tokens only.

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { initials, tintForId } from "./members";

// ─── Member avatar ───────────────────────────────────────────────────────────

const AVATAR_SIZE: Record<string, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function MemberAvatar({
  id,
  name,
  size = "md",
  dim = false,
}: {
  id: string;
  name: string;
  size?: keyof typeof AVATAR_SIZE;
  dim?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white",
        AVATAR_SIZE[size],
        dim
          ? "from-app-text-muted to-app-text-muted opacity-50"
          : tintForId(id),
      )}
    >
      {initials(name)}
    </span>
  );
}

// ─── Overline + cards ────────────────────────────────────────────────────────

export function AccentOverline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "px-1 text-[11px] font-bold uppercase tracking-wider text-app-business",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Card({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "danger";
}) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border bg-app-surface shadow-sm",
        tone === "danger" ? "border-app-error-light" : "border-app-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Group({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <AccentOverline className="pb-2 pt-4">{title}</AccentOverline>
      <Card>{children}</Card>
    </section>
  );
}

// ─── Icon disc ───────────────────────────────────────────────────────────────

export function IconDisc({
  icon: Icon,
  tone = "neutral",
}: {
  icon: LucideIcon;
  tone?: "neutral" | "business" | "stripe";
}) {
  return (
    <span
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        tone === "business"
          ? "bg-app-business-bg text-app-business"
          : tone === "stripe"
            ? "bg-[#f5f4ff] text-[#635bff]"
            : "bg-app-surface-sunken text-app-text-secondary",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

// ─── Settings / list row ─────────────────────────────────────────────────────

export function Chevron() {
  return (
    <ChevronRight
      className="h-4 w-4 shrink-0 text-app-text-muted"
      aria-hidden
    />
  );
}

interface RowProps {
  icon?: LucideIcon;
  iconTone?: "neutral" | "business" | "stripe";
  label: string;
  sub?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  last?: boolean;
  dim?: boolean;
  destructive?: boolean;
}

export function SettingRow({
  icon,
  iconTone,
  label,
  sub,
  trailing,
  href,
  onClick,
  last,
  dim,
  destructive,
}: RowProps) {
  const interactive = !!href || !!onClick;
  const inner = (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3",
        !last && "border-b border-app-border",
        dim && "opacity-55",
        interactive && "transition-colors hover:bg-app-hover",
      )}
    >
      {icon && <IconDisc icon={icon} tone={iconTone} />}
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-[15px] font-medium",
            destructive ? "text-app-error" : "text-app-text",
          )}
        >
          {label}
        </p>
        {sub != null && sub !== "" && (
          <p className="mt-0.5 truncate text-xs text-app-text-secondary">
            {sub}
          </p>
        )}
      </div>
      {trailing !== undefined ? trailing : interactive ? <Chevron /> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

// ─── Toggle (violet) ─────────────────────────────────────────────────────────

export function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={clsx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        on ? "bg-app-business" : "bg-app-border-strong",
        disabled && "opacity-50",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

type ChipTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "business"
  | "neutral";

const CHIP_TONE: Record<ChipTone, string> = {
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  error: "bg-app-error-bg text-app-error",
  info: "bg-app-info-bg text-app-info",
  business: "bg-app-business-bg text-app-business",
  neutral: "bg-app-surface-sunken text-app-text-secondary",
};

export function Chip({
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
        CHIP_TONE[tone],
      )}
    >
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={2.8} aria-hidden />}
      {children}
    </span>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange?: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        "flex gap-1 rounded-lg bg-app-surface-sunken p-1",
        disabled && "opacity-60",
      )}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange?.(o.id)}
            className={clsx(
              "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
              on
                ? "bg-app-surface text-app-business shadow-sm"
                : "text-app-text-secondary hover:text-app-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Semantic note ───────────────────────────────────────────────────────────

type NoteTone = "info" | "warning" | "error" | "success";

const NOTE_TONE: Record<NoteTone, string> = {
  info: "bg-app-business-bg text-app-text-strong",
  warning: "border border-app-warning-light bg-app-warning-bg text-app-warning",
  error: "border border-app-error-light bg-app-error-bg text-app-error",
  success: "border border-app-success-light bg-app-success-bg text-app-success",
};

const NOTE_ICON_COLOR: Record<NoteTone, string> = {
  info: "text-app-business",
  warning: "text-app-warning",
  error: "text-app-error",
  success: "text-app-success",
};

export function Note({
  tone = "info",
  icon: Icon,
  children,
}: {
  tone?: NoteTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium leading-snug",
        NOTE_TONE[tone],
      )}
    >
      {Icon && (
        <Icon
          className={clsx("mt-0.5 h-4 w-4 shrink-0", NOTE_ICON_COLOR[tone])}
          aria-hidden
        />
      )}
      <span>{children}</span>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  accent,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange?: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  accent?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const dec = () => onChange?.(Math.max(min, value - step));
  const inc = () => onChange?.(Math.min(max, value + step));
  return (
    <div
      className={clsx(
        "inline-flex shrink-0 items-center gap-2",
        disabled && "opacity-50",
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={dec}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-secondary disabled:opacity-40"
      >
        <span className="text-base leading-none">−</span>
      </button>
      <span
        className={clsx(
          "min-w-[2.25rem] text-center text-sm font-bold tabular-nums",
          accent ? "text-app-business" : "text-app-text",
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-0.5 text-xs text-app-text-secondary">
            {suffix}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={inc}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-app-border bg-app-surface text-primary-600 disabled:opacity-40"
      >
        <span className="text-base leading-none">+</span>
      </button>
    </div>
  );
}

// ─── Selectable rule / option tile ───────────────────────────────────────────

export function RuleTile({
  icon: Icon,
  name,
  desc,
  selected,
  onClick,
  radio = true,
}: {
  icon: LucideIcon;
  name: string;
  desc?: string;
  selected: boolean;
  onClick?: () => void;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? selected : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
        selected
          ? "border-app-business bg-app-business-bg"
          : "border-app-border bg-app-surface hover:bg-app-hover",
      )}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-app-surface text-app-business"
            : "bg-app-surface-sunken text-app-text-secondary",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-app-text">
          {name}
        </span>
        {desc && (
          <span className="mt-0.5 block text-[11px] leading-tight text-app-text-secondary">
            {desc}
          </span>
        )}
      </span>
      <span
        className={clsx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-transparent bg-app-business"
            : "border-app-border-strong",
        )}
      >
        {selected && (
          <Check className="h-3 w-3 text-white" strokeWidth={3.2} aria-hidden />
        )}
      </span>
    </button>
  );
}

// ─── Checkbox (violet) ───────────────────────────────────────────────────────

export function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      className={clsx(
        "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border",
        on ? "border-transparent bg-app-business" : "border-app-border-strong",
      )}
    >
      {on && (
        <Check
          className="h-3.5 w-3.5 text-white"
          strokeWidth={3.2}
          aria-hidden
        />
      )}
    </span>
  );
}

// ─── Primary (sky) CTA ───────────────────────────────────────────────────────

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
  icon: Icon,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {!loading && Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}

// ─── Skeleton shimmer ────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "animate-pulse rounded-md bg-app-surface-sunken",
        className,
      )}
    />
  );
}

// ─── Business switcher (only when the user owns multiple) ────────────────────

export function BusinessSwitcher({
  options,
  activeId,
  onChange,
}: {
  options: { id: string; name: string }[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Active business</span>
      <select
        value={activeId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-app-business/30 bg-app-business-bg py-1.5 pl-3 pr-8 text-xs font-bold text-app-business focus:outline-none focus:ring-2 focus:ring-app-business"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-app-business"
        aria-hidden
      />
    </label>
  );
}

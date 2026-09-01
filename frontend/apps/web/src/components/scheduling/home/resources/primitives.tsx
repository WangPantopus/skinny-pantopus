"use client";

// W12 — shared form/card primitives for the resource & visit screens, matching
// the design-system recipe (white card · 1px border · 16px radius · shadow-sm ·
// NO left accents; home-green chips/overlines). Mirrors the W10 AddEditEventForm
// primitives so the two areas read identically.

import { ArrowLeft, Lock, Minus, Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { WEEKDAY_INITIALS } from "./resourceMeta";

export function RestrictedView({
  message = "Ask a household admin to share the calendar with you.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-7 py-20 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken">
        <Lock className="h-7 w-7 text-app-text-muted" />
      </div>
      <div className="text-base font-bold text-app-text">
        You don&apos;t have access
      </div>
      <p className="mt-1.5 max-w-[240px] text-[12.5px] text-app-text-secondary">
        {message}
      </p>
    </div>
  );
}

export function ScreenHeader({
  title,
  kicker = "Household",
  onBack,
  right,
}: {
  title: string;
  kicker?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg p-1.5 transition hover:bg-app-surface-sunken"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-app-text" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-home">
          {kicker}
        </div>
        <h1 className="truncate text-xl font-bold text-app-text">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base =
    "rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} w-full p-3.5 text-left transition hover:border-app-border-strong ${className}`}
      >
        {children}
      </button>
    );
  }
  return <div className={`${base} p-3.5 ${className}`}>{children}</div>;
}

export function Overline({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-app-home">
      {children}
    </div>
  );
}

export function Section({
  overline,
  action,
  children,
  className = "",
}: {
  overline?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      {(overline || action) && (
        <div className="mb-2.5 flex items-center justify-between">
          {overline ? <Overline>{overline}</Overline> : <span />}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold text-app-text-secondary">
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  helper,
  type = "text",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  helper?: string;
  type?: string;
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-app-surface px-3 py-2.5 text-[13px] text-app-text outline-none placeholder:text-app-text-muted focus:ring-2 focus:ring-app-home/40 ${
          error
            ? "border-app-error ring-2 ring-app-error-bg"
            : "border-app-border"
        }`}
      />
      {helper && (
        <p
          className={`mt-1.5 text-[10.5px] ${error ? "text-app-error" : "text-app-text-secondary"}`}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[13px] text-app-text outline-none placeholder:text-app-text-muted focus:ring-2 focus:ring-app-home/40"
    />
  );
}

export function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        on ? "bg-app-home" : "bg-app-border-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function ValueRow({
  label,
  children,
  last,
  error,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2.5 py-2.5 ${
        last ? "" : "border-b border-app-border"
      }`}
    >
      <span
        className={`text-[12.5px] font-semibold ${
          error ? "text-app-error" : "text-app-text-secondary"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-app-surface-sunken p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`h-8 flex-1 rounded-md px-2 text-[12px] font-semibold transition ${
              on
                ? "bg-app-home text-white shadow-sm"
                : "text-app-text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; Icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition ${
              on
                ? "border-transparent bg-app-home-bg font-bold text-app-home"
                : "border-app-border bg-app-surface font-semibold text-app-text-secondary"
            }`}
          >
            {o.Icon && <o.Icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  error,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  error?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-1 py-0.5 ${
        error
          ? "border-app-error bg-app-error-bg"
          : "border-app-border bg-app-surface"
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-secondary transition hover:bg-app-surface-sunken disabled:opacity-40"
        aria-label="Decrease"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        className={`min-w-[44px] text-center text-[12.5px] font-bold tabular-nums ${
          error ? "text-app-error" : "text-app-text"
        }`}
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-secondary transition hover:bg-app-surface-sunken disabled:opacity-40"
        aria-label="Increase"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

const BANNER_TONES = {
  home: "border-app-home/30 bg-app-home-bg text-app-home",
  amber: "border-app-warning/30 bg-app-warning-bg text-app-warning",
  error: "border-app-error/30 bg-app-error-bg text-app-error",
  info: "border-app-info/30 bg-app-info-bg text-app-info",
} as const;

export function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof BANNER_TONES;
  icon: LucideIcon;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${BANNER_TONES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-[12px] leading-[17px]">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const toggle = (d: number) =>
    onChange(
      value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort(),
    );
  // Render Sun..Sat (index 0..6).
  return (
    <div className="flex gap-1.5">
      {WEEKDAY_INITIALS.map((d, i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`flex h-[30px] flex-1 items-center justify-center rounded-lg text-[11px] font-bold transition ${
              on
                ? "bg-app-home text-white"
                : "bg-app-surface-sunken text-app-text-muted"
            }`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  icon: Icon,
  loading,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-app-home text-[13.5px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        Icon && <Icon className="h-4 w-4" strokeWidth={2.4} />
      )}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface text-[13.5px] font-bold text-app-text-secondary transition hover:bg-app-surface-sunken"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
  tone = "default",
  icon: Icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger" | "home";
  icon?: LucideIcon;
}) {
  const cls =
    tone === "danger"
      ? "text-app-error"
      : tone === "home"
        ? "text-app-home"
        : "text-app-text-secondary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold transition hover:opacity-80 ${cls}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

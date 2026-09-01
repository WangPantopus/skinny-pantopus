"use client";

// W2 — Event Types. Local form/UI primitives for the event-type editor and
// intake editor. They mirror the design's card + field grammar using design
// tokens only (no hardcoded colors): product-blue functional chrome maps to the
// `primary-*` palette (= #0284c7), pillar accent (pill + overline) maps to the
// app-personal/home/business tokens via pillarTokens. Scoped to this stream's
// folder; not part of the shared W0 kit.

import { type ReactNode, useId } from "react";
import clsx from "clsx";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  House,
  Minus,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

// ─── Identity pill + section overline (the only pillar-accented chrome) ──

export function PillarPill({ pillar }: { pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  const Icon =
    pillar === "business" ? Briefcase : pillar === "home" ? House : User;
  const label =
    pillar === "business"
      ? "Business"
      : pillar === "home"
        ? "Home"
        : "Personal";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        tk.bgSoft,
        tk.text,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  );
}

export function SectionOverline({
  pillar,
  children,
}: {
  pillar: Pillar;
  children: ReactNode;
}) {
  const tk = pillarTokens(pillar);
  return (
    <p
      className={clsx(
        "text-[11px] font-bold uppercase tracking-[0.08em]",
        tk.text,
      )}
    >
      {children}
    </p>
  );
}

// ─── Card with an optional pillar-colored overline (and collapse) ───────

export function EditorCard({
  overline,
  pillar = "personal",
  action,
  collapsible,
  open,
  onToggle,
  children,
  className,
}: {
  overline?: string;
  pillar?: Pillar;
  action?: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <section
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm",
        className,
      )}
    >
      {(overline || action || collapsible) && (
        <div
          className={clsx(
            "flex items-center justify-between",
            collapsible && "cursor-pointer select-none",
          )}
          onClick={collapsible ? onToggle : undefined}
        >
          {overline ? (
            <p
              className={clsx(
                "text-[11px] font-bold uppercase tracking-[0.08em]",
                tk.text,
              )}
            >
              {overline}
            </p>
          ) : (
            <span />
          )}
          {collapsible ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="text-app-text-muted"
            >
              {open ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : (
            (action ?? null)
          )}
        </div>
      )}
      {(!collapsible || open) && (
        <div className={clsx("flex flex-col gap-3", overline && "mt-3")}>
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Field label + error ────────────────────────────────────────────────

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold text-app-text-strong"
    >
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1 text-xs leading-tight text-app-error">
      <CircleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

// ─── Text + textarea inputs ─────────────────────────────────────────────

const inputBase =
  "w-full rounded-lg border-[1.5px] bg-app-surface px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted shadow-sm outline-none transition focus:ring-2 disabled:bg-app-surface-raised disabled:opacity-70";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  disabled,
  error,
  type = "text",
  inputMode,
  prefix,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  error?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric" | "tel";
  prefix?: string;
}) {
  const id = useId();
  return (
    <div>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-app-text-muted">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            inputBase,
            prefix && "pl-7",
            mono && "font-mono",
            error
              ? "border-app-error focus:border-app-error focus:ring-app-error/15"
              : "border-app-border focus:border-primary-600 focus:ring-primary-600/15",
          )}
        />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <textarea
        id={id}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          inputBase,
          "resize-y",
          error
            ? "border-app-error focus:border-app-error focus:ring-app-error/15"
            : "border-app-border focus:border-primary-600 focus:ring-primary-600/15",
        )}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

// ─── Segmented control ──────────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "flex gap-1 rounded-[10px] bg-app-surface-sunken p-1",
        disabled && "opacity-60",
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={clsx(
              "h-8 flex-1 whitespace-nowrap rounded-md px-1 text-xs transition disabled:cursor-not-allowed",
              on
                ? "bg-app-surface font-bold text-primary-700 shadow-sm"
                : "font-semibold text-app-text-secondary hover:text-app-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Toggle + toggle row ────────────────────────────────────────────────

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
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60",
        on ? "bg-primary-600" : "bg-app-border-strong",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function ToggleRow({
  icon: Icon,
  label,
  sub,
  on,
  onChange,
  disabled,
  last,
}: {
  icon?: LucideIcon;
  label: string;
  sub?: string;
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 py-2.5",
        !last && "border-b border-app-border",
        disabled && "opacity-70",
      )}
    >
      {Icon && (
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            on
              ? "bg-primary-50 text-primary-600"
              : "bg-app-surface-sunken text-app-text-secondary",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-app-text">{label}</p>
        {sub && (
          <p className="mt-0.5 text-[11px] leading-tight text-app-text-secondary">
            {sub}
          </p>
        )}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

// ─── Link-out row ───────────────────────────────────────────────────────

export function LinkRow({
  icon: Icon,
  label,
  value,
  onClick,
  href,
  last,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  last?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-semibold text-app-text">
          {label}
        </span>
        {value && (
          <span className="mt-0.5 block truncate text-[11px] text-app-text-secondary">
            {value}
          </span>
        )}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-app-text-muted"
        aria-hidden
      />
    </>
  );
  const cls = clsx(
    "flex w-full items-center gap-3 py-2.5 text-left",
    !last && "border-b border-app-border",
    disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-80",
  );
  if (href && !disabled) {
    // next/link is unnecessary here; a plain anchor keeps this primitive simple.
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────

export function Stepper({
  value,
  onChange,
  unit,
  step = 5,
  min = 0,
  max = 9999,
  disabled,
  error,
}: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  error?: boolean;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div
      className={clsx(
        "inline-flex items-center overflow-hidden rounded-lg border-[1.5px] bg-app-surface",
        disabled && "opacity-70",
        error ? "border-app-error" : "border-app-border",
      )}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
        className="flex h-9 w-8 items-center justify-center border-r border-app-border text-app-text-secondary disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="flex h-9 min-w-[3rem] items-center justify-center px-2 text-[13px] font-bold tabular-nums text-app-text">
        {value}
        {unit && (
          <span className="ml-1 text-[11px] font-semibold text-app-text-muted">
            {unit}
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
        className="flex h-9 w-8 items-center justify-center border-l border-app-border text-primary-600 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

// ─── Quick chip (adds a value) ──────────────────────────────────────────

export function QuickChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-app-border bg-app-surface text-app-text-secondary hover:border-app-border-strong",
      )}
    >
      {icon && <Plus className="h-3 w-3 text-primary-600" aria-hidden />}
      {label}
    </button>
  );
}

// ─── Color swatches ─────────────────────────────────────────────────────

export function ColorSwatches({
  colors,
  value,
  onChange,
}: {
  colors: ReadonlyArray<string>;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <FieldLabel>Color</FieldLabel>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => {
          const on = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={on}
              onClick={() => onChange(c)}
              className={clsx(
                "flex h-6 w-6 items-center justify-center rounded-full transition",
                on && "ring-2 ring-offset-2 ring-offset-app-surface",
              )}
              style={{
                backgroundColor: c,
                ...(on
                  ? ({ ["--tw-ring-color" as string]: c } as Record<
                      string,
                      string
                    >)
                  : {}),
              }}
            >
              {on && (
                <Check
                  className="h-3.5 w-3.5 text-white"
                  strokeWidth={3}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

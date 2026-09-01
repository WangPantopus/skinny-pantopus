"use client";

// W15 — Packages & invoices. Local form/UI primitives for this stream's screens.
// They mirror the design's card + field grammar using design tokens only (no
// hardcoded colors): product-sky functional chrome maps to `primary-*`
// (= #0284c7); the pillar accent (pill, overlines, selected tiles) maps to the
// app-personal/home/business tokens via pillarTokens. Scoped to this stream's
// folder — not part of the shared W0 kit, and W2 owns its own copy.

import { type ReactNode, useId } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Briefcase,
  Check,
  CircleAlert,
  ExternalLink,
  House,
  Lock,
  Minus,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  INVOICE_STATUS_META,
  type InvoiceStatus,
} from "@/components/scheduling/packages/invoiceHelpers";

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

// ─── Card with an optional pillar-colored overline ──────────────────────

export function Card({
  overline,
  pillar = "personal",
  action,
  children,
  className,
}: {
  overline?: string;
  pillar?: Pillar;
  action?: ReactNode;
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
      {(overline || action) && (
        <div className="flex items-center justify-between">
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
          {action ?? null}
        </div>
      )}
      {children && (
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

const inputBase =
  "w-full rounded-lg border-[1.5px] bg-app-surface px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted shadow-sm outline-none transition focus:ring-2 disabled:bg-app-surface-raised disabled:opacity-70";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  inputMode,
  prefix,
  ariaLabel,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  inputMode?: "text" | "decimal" | "numeric";
  prefix?: string;
  ariaLabel?: string;
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
          type="text"
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            inputBase,
            prefix && "pl-7",
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

// ─── Multiline text field ────────────────────────────────────────────────

export function TextArea({
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
          "resize-none",
          error
            ? "border-app-error focus:border-app-error focus:ring-app-error/15"
            : "border-app-border focus:border-primary-600 focus:ring-primary-600/15",
        )}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────

export function SegmentedControl({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReadonlyArray<string>;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 rounded-[10px] bg-app-surface-sunken p-1">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(o)}
            className={clsx(
              "h-8 flex-1 rounded-md text-xs transition",
              on
                ? "bg-app-surface font-bold text-app-text shadow-sm"
                : "font-semibold text-app-text-secondary hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div
      className={clsx(
        "inline-flex items-center overflow-hidden rounded-lg border-[1.5px] border-app-border bg-app-surface",
        disabled && "opacity-70",
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className="flex h-9 w-8 items-center justify-center border-r border-app-border text-app-text-secondary disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="flex h-9 min-w-[3rem] items-center justify-center px-2 text-[13px] font-bold tabular-nums text-app-text">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        className="flex h-9 w-8 items-center justify-center border-l border-app-border text-primary-600 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────

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
}: {
  icon?: LucideIcon;
  label: string;
  sub?: string;
  on: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-3", disabled && "opacity-70")}>
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

// ─── Inline note (semantic-tinted) ──────────────────────────────────────

export function Note({
  tone = "info",
  icon: Icon,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const map = {
    info: "border-app-info-light bg-app-info-bg text-app-text-secondary",
    warning: "border-app-warning-light bg-app-warning-bg text-app-warning",
    error: "border-app-error-light bg-app-error-bg text-app-error",
    success: "border-app-success-light bg-app-success-bg text-app-success",
  } as const;
  const iconColor = {
    info: "text-app-info",
    warning: "text-app-warning",
    error: "text-app-error",
    success: "text-app-success",
  } as const;
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
        map[tone],
      )}
    >
      {Icon && (
        <Icon
          className={clsx("mt-0.5 h-4 w-4 shrink-0", iconColor[tone])}
          aria-hidden
        />
      )}
      <span className="text-[11.5px] font-medium leading-4">{children}</span>
    </div>
  );
}

// ─── Empty-state hero ───────────────────────────────────────────────────

export function EmptyHero({
  icon: Icon,
  pillar = "personal",
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  pillar?: Pillar;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span
        className={clsx(
          "mb-4 flex h-20 w-20 items-center justify-center rounded-full",
          tk.bgSoft,
          tk.text,
        )}
      >
        <Icon className="h-9 w-9" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">{title}</h2>
      {body && (
        <p className="mb-5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
          {body}
        </p>
      )}
      {action}
    </div>
  );
}

// ─── Stripe payouts gate (A14.6 idiom) ──────────────────────────────────
// Connecting payments lives in W14's payments setup — we only link out.

export function StripeGate({
  title,
  body,
  compact,
}: {
  title: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-warning-light bg-app-warning-bg",
        compact ? "p-3.5" : "flex flex-col items-center p-5 text-center",
      )}
    >
      {!compact && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-app-surface text-app-warning">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className={compact ? "flex items-start gap-2.5" : ""}>
        {compact && (
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-app-warning"
            aria-hidden
          />
        )}
        <div className={compact ? "min-w-0" : ""}>
          <p className="text-[13.5px] font-bold text-app-warning">{title}</p>
          {body && (
            <p className="mt-1 text-[11.5px] leading-4 text-app-warning opacity-90">
              {body}
            </p>
          )}
        </div>
      </div>
      <Link
        href="/app/scheduling/payments"
        className={clsx(
          "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700",
          compact ? "mt-3 h-10 w-full" : "mt-3.5 h-10",
        )}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        Connect payments
      </Link>
    </div>
  );
}

// ─── Selectable event-type tiles ("Redeems against") ────────────────────

export function EventTypeTiles({
  options,
  value,
  onChange,
  pillar,
  disabled,
}: {
  options: ReadonlyArray<{ id: string; name: string; sub?: string }>;
  /** "" = any event type. */
  value: string;
  onChange: (id: string) => void;
  pillar: Pillar;
  disabled?: boolean;
}) {
  const tk = pillarTokens(pillar);
  const all = [
    { id: "", name: "Any event type", sub: "All bookings" },
    ...options,
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {all.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id || "any"}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={clsx(
              "flex min-w-0 flex-col gap-1 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
              on
                ? clsx(tk.border, tk.bgSoft, "border-[1.5px]")
                : "border-app-border bg-app-surface hover:border-app-border-strong",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="sr-only">{o.name}</span>
              {on && (
                <Check
                  className={clsx("ml-auto h-4 w-4", tk.text)}
                  strokeWidth={3}
                  aria-hidden
                />
              )}
            </span>
            <span className="truncate text-[12px] font-bold text-app-text">
              {o.name}
            </span>
            {o.sub && (
              <span className="truncate text-[10px] text-app-text-muted">
                {o.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Invoice status pill ────────────────────────────────────────────────

export function InvoiceStatusPill({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const meta = INVOICE_STATUS_META[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        meta.cls,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

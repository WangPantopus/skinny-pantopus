"use client";

// W4-local form primitives for the booking-page management surfaces (C1/C3/C4).
// They reproduce the design system's card / overline / toggle / chip idiom using
// only app design tokens (no hardcoded colors). The PILLAR accent appears only
// on overlines + dots; all functional chrome (toggles, chips, CTAs) stays sky
// (primary), per the design non-negotiables. These are private to this stream —
// the shared kit lives in components/scheduling/** (W0) and is consumed read-only.

import type { ReactNode } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export function Card({
  overline,
  pillar = "personal",
  children,
  className,
}: {
  overline?: string;
  pillar?: Pillar;
  children: ReactNode;
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
      {overline && (
        <p
          className={clsx(
            "mb-3 text-[11px] font-bold uppercase tracking-wider",
            tk.text,
          )}
        >
          {overline}
        </p>
      )}
      {children}
    </section>
  );
}

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
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors",
        on ? "bg-primary-600" : "bg-app-border-strong",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={clsx(
          "inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[18px]" : "translate-x-[2px]",
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
      )}
    >
      {Icon && (
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            on
              ? "bg-primary-50 text-primary-600"
              : "bg-app-surface-sunken text-app-text-muted",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app-text-strong">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-app-text-secondary">
            {sub}
          </p>
        )}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-app-text-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-app-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-app-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 disabled:opacity-60";

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        inputBase,
        invalid && "border-app-error ring-app-error/20",
      )}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(inputBase, "resize-none")}
    />
  );
}

export function Chips({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
              on
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-app-border bg-app-surface text-app-text hover:bg-app-hover",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-app-border bg-app-surface-sunken p-1"
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
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60",
              on
                ? "bg-app-surface text-app-text-strong shadow-sm"
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

export type StatusTone = "live" | "paused" | "draft";

export function StatusChip({ tone }: { tone: StatusTone }) {
  const map: Record<StatusTone, { label: string; cls: string; dot: string }> = {
    live: {
      label: "Live",
      cls: "bg-app-success-bg text-app-success",
      dot: "bg-app-success",
    },
    paused: {
      label: "Paused",
      cls: "bg-app-surface-sunken text-app-text-secondary",
      dot: "bg-app-text-muted",
    },
    draft: {
      label: "Draft",
      cls: "bg-app-warning-bg text-app-warning",
      dot: "bg-app-warning",
    },
  };
  const m = map[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        m.cls,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-app-warning/40 bg-app-warning-bg px-3 py-2.5 text-xs font-medium leading-snug text-app-warning">
      {children}
    </div>
  );
}

/** Initials from a display name (avatar fallback). */
export function initialsOf(name?: string | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

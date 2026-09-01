"use client";

// W3-owned presentational primitives for the availability surfaces. They mirror
// the design's card / overline / toggle / segmented idiom using app design
// tokens only (no hardcoded colors). Personal is the only pillar availability
// serves, so the accent resolves to app-personal (sky) — but pillarTokens keeps
// it consistent if ever embedded under another pillar.

import type { ReactNode } from "react";
import clsx from "clsx";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export function Card({
  overline,
  pillar = "personal",
  action,
  children,
  className = "",
}: {
  overline?: string;
  pillar?: Pillar;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm",
        className,
      )}
    >
      {overline && (
        <div className="mb-3 flex items-center justify-between">
          <span
            className={clsx(
              "text-[11px] font-bold uppercase tracking-wider",
              tk.text,
            )}
          >
            {overline}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-app-text-strong">
      {children}
    </label>
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
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        on ? "bg-app-personal" : "bg-app-border-strong",
        disabled && "opacity-60",
        !disabled && "cursor-pointer",
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
  icon,
  label,
  sub,
  on,
  onChange,
  disabled,
  last,
}: {
  icon?: ReactNode;
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
      {icon && (
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            on
              ? "bg-app-personal-bg text-app-personal"
              : "bg-app-surface-sunken text-app-text-secondary",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-app-text">{label}</div>
        {sub && (
          <div className="mt-0.5 text-[11px] text-app-text-secondary">
            {sub}
          </div>
        )}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange?: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex gap-1 rounded-lg bg-app-surface-sunken p-1",
        disabled && "opacity-60",
      )}
      role="tablist"
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
            onClick={() => onChange?.(o.value)}
            className={clsx(
              "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-colors",
              on
                ? "bg-app-surface text-primary-700 shadow-sm"
                : "text-app-text-secondary hover:text-app-text",
              !disabled && "cursor-pointer",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A read-only definition row: label · value · caption (used by the thin B7 surface). */
export function ValueRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-app-text">
          {label}
        </span>
        <span className="rounded-md bg-app-surface-sunken px-2.5 py-1 text-[13px] font-bold tabular-nums text-app-text">
          {value}
        </span>
      </div>
      {caption && (
        <div className="mt-1.5 text-[11px] text-app-text-secondary">
          {caption}
        </div>
      )}
    </div>
  );
}

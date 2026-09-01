"use client";

// W16 — local presentational primitives for the automations screens. Mirrors
// the Calendarly settings-list look (cards, rows, chips, toggles, fields) using
// design-system tokens only. Self-contained so this stream stays file-disjoint
// from W1's hub/ui kit while sharing the same visual language.

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export function Overline({
  children,
  pillar,
  className,
}: {
  children: ReactNode;
  pillar?: Pillar;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "text-[11px] font-bold uppercase tracking-[0.08em]",
        pillar ? pillarTokens(pillar).text : "text-app-text-secondary",
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "divide-y divide-app-border-subtle overflow-hidden rounded-xl border border-app-border bg-app-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconTile({
  icon: Icon,
  pillar = "personal",
  muted,
  className,
}: {
  icon: LucideIcon;
  pillar?: Pillar;
  muted?: boolean;
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]",
        muted
          ? "bg-app-surface-sunken text-app-text-secondary"
          : clsx(tk.bgSoft, tk.text),
        className,
      )}
    >
      <Icon className="h-[17px] w-[17px]" aria-hidden />
    </span>
  );
}

export interface RowProps {
  leading?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}

export function Row({
  leading,
  label,
  sub,
  right,
  href,
  onClick,
  chevron,
  className,
}: RowProps) {
  const interactive = Boolean(href || onClick);
  const inner = (
    <div
      className={clsx(
        "flex min-h-[52px] items-center gap-3 px-3.5 py-3",
        interactive && "transition-colors hover:bg-app-hover",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-5 text-app-text">
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 truncate text-[12px] leading-4 text-app-text-secondary">
            {sub}
          </div>
        )}
      </div>
      {right}
      {chevron && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-app-text-muted"
          aria-hidden
        />
      )}
    </div>
  );

  if (href)
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {inner}
      </button>
    );
  return inner;
}

export type ChipTone = "success" | "warning" | "info" | "neutral" | Pillar;

const CHIP_TONES: Record<ChipTone, string> = {
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  info: "bg-app-info-bg text-app-info",
  neutral: "bg-app-surface-sunken text-app-text-secondary",
  personal: "bg-app-personal-bg text-app-personal",
  home: "bg-app-home-bg text-app-home",
  business: "bg-app-business-bg text-app-business",
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
        CHIP_TONES[tone],
      )}
    >
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
      {children}
    </span>
  );
}

/** iOS-style switch, accent = pillar. */
export function Toggle({
  on,
  onChange,
  pillar = "personal",
  disabled,
  label,
}: {
  on: boolean;
  onChange?: (next: boolean) => void;
  pillar?: Pillar;
  disabled?: boolean;
  label?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={clsx(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors",
        on ? tk.bg : "bg-app-border-strong",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span
        className={clsx(
          "inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/** Underline tab strip (A08 TabStrip) used for the H2 scope selector. */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  pillar = "personal",
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  pillar?: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex border-b border-app-border">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "-mb-px flex-1 border-b-2 px-2 py-2.5 text-[12.5px] transition-colors",
              on
                ? clsx(tk.border, "font-bold text-app-text")
                : "border-transparent font-semibold text-app-text-secondary hover:text-app-text",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-segmented control (selected = solid pillar). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  pillar = "personal",
}: {
  options: { id: T; label: string; icon?: LucideIcon; locked?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  pillar?: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-app-surface-sunken p-1">
      {options.map((o) => {
        const active = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            disabled={o.locked}
            onClick={() => !o.locked && onChange(o.id)}
            className={clsx(
              "flex h-9 min-w-[84px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors",
              active
                ? clsx("bg-app-surface shadow-sm", tk.text)
                : o.locked
                  ? "cursor-not-allowed text-app-text-muted"
                  : "text-app-text-secondary hover:text-app-text",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {o.label}
            {o.locked && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-app-text-muted">
                soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-semibold text-app-text-strong"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-app-error">{error}</p>
      ) : (
        hint && <p className="text-[12px] text-app-text-secondary">{hint}</p>
      )}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-lg border bg-app-surface px-3 py-2 text-[14px] text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-offset-0";

export function TextInput({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={clsx(
        INPUT_BASE,
        invalid
          ? "border-app-error focus:ring-app-error/40"
          : "border-app-border focus:border-app-personal focus:ring-app-personal/30",
        className,
      )}
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
      {...props}
      className={clsx(
        INPUT_BASE,
        "min-h-[120px] resize-y leading-6",
        invalid
          ? "border-app-error focus:ring-app-error/40"
          : "border-app-border focus:border-app-personal focus:ring-app-personal/30",
        className,
      )}
    />
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-4 py-2 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Inline retry card matching the H2 error frame (cloud-off + Try again). */
export function PageHeading({
  pillar,
  kicker,
  title,
  subtitle,
  action,
}: {
  pillar: Pillar;
  kicker: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Overline pillar={pillar} className="mb-1.5">
          {kicker}
        </Overline>
        <h1 className="text-xl font-bold text-app-text">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-app-text-secondary">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

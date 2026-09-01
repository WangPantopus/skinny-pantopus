"use client";

// Shared Calendarly settings-list + chip/toggle primitives, ported from the
// A14 settings archetype to the web app's design tokens. Used by the Hub (A1),
// Booking settings (A3), and Notification preferences (A4). Token classes only.

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
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-secondary",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function AccentOverline({
  pillar,
  children,
  className,
}: {
  pillar: Pillar;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "text-[11px] font-bold uppercase tracking-[0.08em]",
        pillarTokens(pillar).text,
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Card({
  children,
  helper,
  className,
  tone = "default",
}: {
  children: ReactNode;
  helper?: ReactNode;
  className?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className={className}>
      <div
        className={clsx(
          "divide-y overflow-hidden rounded-xl border",
          tone === "danger"
            ? "divide-app-error-light border-app-error-light bg-app-error-bg"
            : "divide-app-border-subtle border-app-border bg-app-surface",
        )}
      >
        {children}
      </div>
      {helper && (
        <p className="px-1 pt-2 text-xs leading-4 text-app-text-secondary">
          {helper}
        </p>
      )}
    </div>
  );
}

export interface RowProps {
  icon?: LucideIcon;
  label: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
}

export function Row({
  icon: Icon,
  label,
  sub,
  right,
  leading,
  href,
  onClick,
  destructive,
}: RowProps) {
  const interactive = Boolean(href || onClick);
  const inner = (
    <div
      className={clsx(
        "flex min-h-[52px] items-center gap-3 px-4 py-3.5",
        interactive && "transition-colors hover:bg-app-hover",
      )}
    >
      {Icon && (
        <Icon
          className={clsx(
            "h-[18px] w-[18px] shrink-0",
            destructive ? "text-app-error" : "text-app-text-strong",
          )}
          aria-hidden
        />
      )}
      {leading}
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-[15px] font-medium leading-5 tracking-[-0.01em]",
            destructive ? "text-app-error" : "text-app-text",
          )}
        >
          {label}
        </p>
        {sub && (
          <p className="mt-0.5 text-xs leading-4 text-app-text-secondary">
            {sub}
          </p>
        )}
      </div>
      {right}
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

export function Chevron() {
  return (
    <ChevronRight
      className="h-4 w-4 shrink-0 text-app-text-secondary"
      aria-hidden
    />
  );
}

export type ChipTone = "success" | "warning" | "info" | "neutral" | Pillar;

const CHIP_TONES: Record<ChipTone, string> = {
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  info: "bg-app-info-bg text-app-info",
  neutral: "bg-app-surface-sunken text-app-text-strong",
  personal: "bg-app-personal-bg text-app-personal",
  home: "bg-app-home-bg text-app-home",
  business: "bg-app-business-bg text-app-business",
};

export function Chip({
  tone = "success",
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

export function ChipChevron({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <Chevron />
    </div>
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

export function Segmented({
  options,
  value,
  onChange,
  pillar = "personal",
}: {
  options: { id: string; label: string; icon?: LucideIcon }[];
  value: string;
  onChange?: (id: string) => void;
  pillar?: Pillar;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex gap-1 rounded-xl bg-app-surface-sunken p-1">
      {options.map((o) => {
        const active = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange?.(o.id)}
            className={clsx(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-colors",
              active
                ? clsx("bg-app-surface shadow-sm", tk.text)
                : "text-app-text-secondary hover:text-app-text",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MonoFooter({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-4 text-center font-mono text-[11px] text-app-text-muted">
      {children}
    </p>
  );
}

/**
 * ConnectPill — inline accent-filled CTA for the Payments row (fresh/unconnected state).
 * Renders a "Connect" button tinted with the active pillar accent.
 */
export function ConnectPill({
  pillar = "personal",
  onClick,
}: {
  pillar?: Pillar;
  onClick?: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "whitespace-nowrap rounded-full px-3.5 py-[7px] text-[12.5px] font-bold text-white shadow-sm",
        tk.bg,
      )}
    >
      Connect
    </button>
  );
}

/** Small rounded icon tile (accent-tinted), used for card leading glyphs. */
export function IconTile({
  icon: Icon,
  pillar = "personal",
  tone,
  className,
}: {
  icon: LucideIcon;
  pillar?: Pillar;
  tone?: "warning";
  className?: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div
      className={clsx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        tone === "warning"
          ? "bg-app-warning-bg text-app-warning"
          : clsx(tk.bgSoft, tk.text),
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </div>
  );
}

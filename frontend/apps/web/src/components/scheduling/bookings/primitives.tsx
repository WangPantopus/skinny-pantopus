"use client";

// W8 — small presentational primitives for the bookings inbox, detail, and
// action sheets. Themed strictly with design-system tokens + pillar tokens
// (no hardcoded colors). Shared so the inbox / detail / sheets stay consistent.

import type { ReactNode } from "react";
import clsx from "clsx";
import { BadgeCheck, Check, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { initials } from "./format";

// ─── Avatar with verified disc ──────────────────────────────

export function Avatar({
  pillar,
  name,
  size = "md",
}: {
  pillar: Pillar;
  name?: string | null;
  size?: "sm" | "md";
}) {
  const tk = pillarTokens(pillar);
  const dims = size === "sm" ? "h-9 w-9 text-[11px]" : "h-10 w-10 text-[13px]";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full font-bold",
          dims,
          tk.bg,
          tk.textOn,
        )}
        aria-hidden
      >
        {initials(name)}
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-app-surface">
        <BadgeCheck className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
      </span>
    </span>
  );
}

// ─── Owner glyph + assigned-member chip ─────────────────────

export function OwnerGlyph({
  pillar,
  label,
}: {
  pillar: Pillar;
  label: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold",
        tk.text,
      )}
    >
      <span
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", tk.bg)}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function AssignedChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-app-business-bg px-2 py-0.5 text-[11px] font-semibold text-app-business">
      <UserRound className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

// ─── Identity strip (detail header) ─────────────────────────

export function IdentityStrip({
  pillar,
  label,
}: {
  pillar: Pillar;
  label: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        tk.bgSoft,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", tk.bg)} aria-hidden />
      <span className={clsx("text-[11px] font-bold", tk.text)}>{label}</span>
    </span>
  );
}

// ─── Banner ─────────────────────────────────────────────────

type BannerTone = "info" | "warning" | "error" | "success" | "neutral";

const BANNER_TONE: Record<BannerTone, string> = {
  info: "border-app-info-light bg-app-info-bg text-app-info",
  warning: "border-app-warning-light bg-app-warning-bg text-app-warning",
  error: "border-app-error-light bg-app-error-bg text-app-error",
  success: "border-app-success-light bg-app-success-bg text-app-success",
  neutral: "border-app-border bg-app-surface-sunken text-app-text-secondary",
};

export function Banner({
  tone = "info",
  icon: Icon,
  children,
  action,
}: {
  tone?: BannerTone;
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
        BANNER_TONE[tone],
      )}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1 text-xs font-medium leading-snug">
        {children}
      </div>
      {action}
    </div>
  );
}

// ─── Section card + info row ────────────────────────────────

export function SectionCard({
  overline,
  icon: Icon,
  accentClass,
  children,
  className,
}: {
  overline?: string;
  icon?: LucideIcon;
  accentClass?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm",
        className,
      )}
    >
      {overline && (
        <div className="mb-3 flex items-center gap-1.5">
          {Icon && (
            <Icon
              className={clsx(
                "h-3.5 w-3.5",
                accentClass || "text-app-text-muted",
              )}
              aria-hidden
            />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
            {overline}
          </span>
        </div>
      )}
      {children}
    </section>
  );
}

export function InfoRow({
  icon: Icon,
  label,
  value,
  accentClass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken">
        <Icon
          className={clsx("h-4 w-4", accentClass || "text-app-text-secondary")}
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-app-text">
          {value}
        </div>
        <div className="text-xs text-app-text-muted">{label}</div>
      </div>
    </div>
  );
}

// ─── Lifecycle timeline ─────────────────────────────────────

export interface TimelineStep {
  label: string;
  time?: string;
  done?: boolean;
  tone?: "success" | "error";
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={`${s.label}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={clsx(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full border-2",
                  s.done
                    ? s.tone === "error"
                      ? "border-transparent bg-app-error"
                      : "border-transparent bg-app-success"
                    : "border-dashed border-app-border-strong bg-app-surface",
                )}
              >
                {s.done && (
                  <Check
                    className="h-2.5 w-2.5 text-white"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </span>
              {!last && (
                <span
                  className={clsx(
                    "my-0.5 min-h-[18px] w-0.5 flex-1 rounded",
                    s.done ? "bg-app-success-light" : "bg-app-border",
                  )}
                />
              )}
            </div>
            <div className={clsx(last ? "pb-0" : "pb-3")}>
              <div
                className={clsx(
                  "text-[13px] font-semibold",
                  s.done ? "text-app-text" : "text-app-text-muted",
                )}
              >
                {s.label}
              </div>
              {s.time && (
                <div className="text-[11px] text-app-text-muted">{s.time}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Reason chips (decline / cancel) ────────────────────────

export function ReasonChips({
  options,
  value,
  onChange,
  tone = "neutral",
}: {
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
  tone?: "neutral" | "error";
}) {
  const onCls =
    tone === "error"
      ? "border-transparent bg-app-error-bg text-app-error"
      : "border-transparent bg-app-info-bg text-app-info";
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? null : o)}
            aria-pressed={on}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              on
                ? onCls
                : "border-app-border bg-app-surface text-app-text-secondary hover:border-app-border-strong",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ─── Money row (refund) ─────────────────────────────────────

export function MoneyRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span
        className={clsx(
          "text-[13px]",
          strong ? "font-semibold text-app-text" : "text-app-text-secondary",
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          "font-bold tabular-nums",
          strong ? "text-[15px]" : "text-[13px]",
          tone === "success" ? "text-app-success" : "text-app-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Segmented tabs ─────────────────────────────────────────

export interface TabOption {
  key: string;
  label: string;
  badge?: number;
}

export function SegmentedTabs({
  options,
  value,
  onChange,
  accentText,
}: {
  options: TabOption[];
  value: string;
  onChange: (key: string) => void;
  accentText?: string;
}) {
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-app-surface-sunken p-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            className={clsx(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition",
              on
                ? clsx(
                    "bg-app-surface shadow-sm",
                    accentText || "text-app-text-strong",
                  )
                : "text-app-text-secondary hover:text-app-text",
            )}
          >
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-app-warning px-1 text-[10px] font-bold text-white">
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

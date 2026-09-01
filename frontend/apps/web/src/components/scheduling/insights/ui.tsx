"use client";

// W17 — Insights presentational primitives. Kept local to the stream's folder
// (disjoint from other streams) and built strictly on design-system tokens +
// the pillar token map — no hardcoded colors. Charts are lightweight inline
// SVG/CSS (the codebase ships no chart library): bars use the pillar accent or
// a semantic tone, the donut uses currentColor so the tone token drives it.

import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, House, RotateCcw, Store, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { formatRate, toFraction } from "./format";
import { initials } from "./format";

// ─── Pillar (identity) switcher ─────────────────────────────

const PILLAR_ICON: Record<Pillar, LucideIcon> = {
  personal: User,
  home: House,
  business: Store,
};

export interface PillarOption {
  pillar: Pillar;
  label: string;
  available: boolean;
}

export function PillarSwitch({
  options,
  active,
  onSelect,
}: {
  options: PillarOption[];
  active: Pillar;
  onSelect: (pillar: Pillar) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-app-border bg-app-surface p-1">
      {options.map((o) => {
        const on = o.pillar === active;
        const Icon = PILLAR_ICON[o.pillar];
        const tk = pillarTokens(o.pillar);
        return (
          <button
            key={o.pillar}
            type="button"
            onClick={() => o.available && onSelect(o.pillar)}
            disabled={!o.available}
            aria-pressed={on}
            title={o.available ? o.label : `${o.label} (not set up)`}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              !o.available && "cursor-not-allowed opacity-40",
              on
                ? clsx(tk.bg, tk.textOn)
                : "text-app-text-strong hover:bg-app-hover",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type Tone = "neutral" | "success" | "warning" | "error" | "info";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-app-text",
  success: "text-app-success",
  warning: "text-app-warning",
  error: "text-app-error",
  info: "text-app-info",
};

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-app-text-muted",
  success: "bg-app-success",
  warning: "bg-app-warning",
  error: "bg-app-error",
  info: "bg-app-info",
};

const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-app-surface-sunken text-app-text-secondary",
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  error: "bg-app-error-bg text-app-error",
  info: "bg-app-info-bg text-app-info",
};

// ─── Section card + overline ────────────────────────────────

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
        "text-[11px] font-bold uppercase tracking-wider text-app-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Card({
  title,
  icon: Icon,
  accentClass,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  accentClass?: string;
  action?: ReactNode;
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
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {Icon && (
              <Icon
                className={clsx(
                  "h-3.5 w-3.5 shrink-0",
                  accentClass || "text-app-text-muted",
                )}
                aria-hidden
              />
            )}
            {title && <Overline className="truncate">{title}</Overline>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── KPI tiles ──────────────────────────────────────────────

/** Delta chip: signed percent change vs prior period (e.g. +12% / -3%). */
export function DeltaChip({
  delta,
}: {
  delta: number | null | undefined;
}) {
  if (delta == null || Number.isNaN(delta)) return null;
  const pct = Math.abs(delta) <= 1 ? delta * 100 : delta;
  const up = pct >= 0;
  const label = `${up ? "+" : ""}${Math.round(pct)}%`;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        up
          ? "bg-app-success-bg text-app-success"
          : "bg-app-error-bg text-app-error",
      )}
    >
      {up ? "↑" : "↓"} {label}
    </span>
  );
}

export function KpiTile({
  value,
  label,
  hint,
  delta,
  tone = "neutral",
}: {
  value: string;
  label: string;
  hint?: string;
  /** Signed rate delta vs prior period (fraction 0–1 or percent). */
  delta?: number | null;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <p
          className={clsx(
            "text-[26px] font-bold leading-8 tracking-[-0.02em] tabular-nums",
            TONE_TEXT[tone],
          )}
        >
          {value}
        </p>
        <DeltaChip delta={delta} />
      </div>
      <p className="mt-1 text-[12.5px] font-semibold text-app-text-secondary">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-app-text-muted">{hint}</p>}
    </div>
  );
}

export function KpiGrid({
  children,
  cols = 4,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={clsx(
        "grid gap-3",
        cols === 2
          ? "grid-cols-2"
          : cols === 3
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

// ─── Horizontal bar list ────────────────────────────────────

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Right-aligned formatted value (defaults to the count). */
  display?: string;
  /** Secondary muted caption under the label. */
  caption?: string;
  /** A data-identity dot color (e.g. an event type's own color). */
  dotColor?: string | null;
  tone?: Tone;
}

export function BarRow({
  datum,
  max,
  pillar,
}: {
  datum: BarDatum;
  max: number;
  pillar: Pillar;
}) {
  const tk = pillarTokens(pillar);
  const pct = max > 0 ? Math.round((datum.value / max) * 100) : 0;
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {datum.dotColor && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: datum.dotColor }}
              aria-hidden
            />
          )}
          <span className="truncate text-[13.5px] font-semibold text-app-text">
            {datum.label}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-app-text">
          {datum.display ?? datum.value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-app-surface-sunken">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            datum.tone ? TONE_BG[datum.tone] : tk.bg,
          )}
          style={{ width: `${Math.max(pct, datum.value > 0 ? 4 : 0)}%` }}
        />
      </div>
      {datum.caption && (
        <p className="mt-1 text-[11px] text-app-text-muted">{datum.caption}</p>
      )}
    </div>
  );
}

export function BarList({
  data,
  pillar,
}: {
  data: BarDatum[];
  pillar: Pillar;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  return (
    <div className="divide-y divide-app-border-subtle">
      {data.map((d) => (
        <BarRow key={d.key} datum={d} max={max} pillar={pillar} />
      ))}
    </div>
  );
}

// ─── Volume sparkline (column chart) ────────────────────────

export function ColumnSpark({
  values,
  pillar,
  height = 56,
}: {
  values: number[];
  pillar: Pillar;
  height?: number;
}) {
  const tk = pillarTokens(pillar);
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className={clsx(
            "flex-1 rounded-sm",
            v > 0 ? tk.bg : "bg-app-surface-sunken",
          )}
          style={{
            height:
              max > 0 ? `${Math.max((v / max) * 100, v > 0 ? 8 : 4)}%` : "4%",
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}

// ─── Donut gauge (single rate) ──────────────────────────────

export function DonutGauge({
  rate,
  tone = "error",
  size = 132,
  caption,
}: {
  rate: number;
  tone?: Tone;
  size?: number;
  caption?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = toFraction(rate);
  const dash = c * frac;
  const center = size / 2;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="text-app-surface-sunken"
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
          />
          <circle
            className={TONE_TEXT[tone]}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx(
              "text-[26px] font-bold tabular-nums",
              TONE_TEXT[tone],
            )}
          >
            {formatRate(rate)}
          </span>
        </div>
      </div>
      {caption && (
        <p className="mt-2 text-center text-[12.5px] text-app-text-secondary">
          {caption}
        </p>
      )}
    </div>
  );
}

// ─── Rank row (member / host) ───────────────────────────────

export function Avatar({
  name,
  pillar,
  size = 34,
}: {
  name?: string | null;
  pillar: Pillar;
  size?: number;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tk.bg,
        tk.textOn,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

// ─── States: empty / business-only / loading / error ────────

export function EmptyReport({
  icon: Icon,
  title,
  body,
  pillar,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  pillar: Pillar;
  children?: ReactNode;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-app-border bg-app-surface px-6 py-14 text-center">
      <span
        className={clsx(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
          tk.bgSoft,
          tk.text,
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-app-text-secondary">
        {body}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function NoticeCard({
  icon: Icon,
  title,
  body,
  tone = "info",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: Tone;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-2xl border border-app-border px-6 py-14 text-center",
        "bg-app-surface",
      )}
    >
      <span
        className={clsx(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
          TONE_SOFT[tone],
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-app-text-secondary">
        {body}
      </p>
    </div>
  );
}

export function ReportSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm"
          >
            <div className="h-7 w-1/2 animate-pulse rounded bg-app-surface-sunken" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-app-surface-sunken" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
        <div className="mb-4 h-3 w-24 animate-pulse rounded bg-app-surface-sunken" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="py-2.5">
            <div className="mb-2 flex justify-between">
              <div className="h-3 w-1/3 animate-pulse rounded bg-app-surface-sunken" />
              <div className="h-3 w-8 animate-pulse rounded bg-app-surface-sunken" />
            </div>
            <div className="h-2 w-full animate-pulse rounded-full bg-app-surface-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InlineRetry({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-app-border bg-app-surface px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-error-bg text-app-error">
        <AlertTriangle className="h-7 w-7" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">
        Couldn’t load this report
      </h2>
      <p className="mb-5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-4 py-2 text-sm font-semibold text-app-text-strong hover:bg-app-hover"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}

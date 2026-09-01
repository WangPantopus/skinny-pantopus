"use client";

// A5 — Scheduling Summary Card. An at-a-glance "this month" pulse, powered by
// GET /bookings/summary. Self-contained (fetches its own data) and reusable.
// States: loading · error+retry · empty (share CTA) · loaded.
// Wire shape: { bookingsThisMonth, bookingsLastMonth, deltaPct, upcomingCount,
// noShowCount, sparkline:[{date,count}], byEventType:[{event_type_id,count}] }.
// Loaded state shows: period pill · 4 stat cells (Bookings / delta / Upcoming /
// No-shows) · 30-day sparkline · event-type breakdown chips · See insights.

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  CloudOff,
  RotateCcw,
  Share2,
} from "lucide-react";
import Link from "next/link";
import * as api from "@pantopus/api";
import type {
  BookingsSummary,
  EventType,
  SchedulingOwnerRef,
} from "@pantopus/types";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

interface SummaryCardProps {
  owner: SchedulingOwnerRef;
  pillar: Pillar;
  /** Called when the empty-state "Share booking link" CTA is pressed. */
  onShare?: () => void;
  /** Resolves byEventType ids to names for the breakdown chips. */
  eventTypes?: EventType[];
  insightsHref?: string;
  className?: string;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

type DeltaDir = "up" | "down" | null;

function StatCell({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta?: DeltaDir;
}) {
  const colorCls =
    delta === "up"
      ? "text-app-success"
      : delta === "down"
        ? "text-app-error"
        : "text-app-text";
  return (
    <div className="min-w-0 flex-1 px-1">
      <p
        className={clsx(
          "flex items-center gap-0.5 text-[22px] font-bold leading-[26px] tracking-[-0.02em] tabular-nums",
          colorCls,
        )}
      >
        {delta === "up" && (
          <ArrowUp className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        )}
        {delta === "down" && (
          <ArrowDown className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        )}
        {value}
      </p>
      <p className="mt-0.5 text-[10.5px] font-semibold leading-tight text-app-text-secondary">
        {label}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-app-border-subtle" />;
}

/** Flat sparkline SVG matching design (pillar accent polyline + faint fill). */
function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  const W = 296;
  const H = 40;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (d - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1];
  const [lx, ly] = last.split(",");
  const areaPts = `${pad},${H} ${pts.join(" ")} ${W - pad},${H}`;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", height: 40 }}
      aria-hidden
    >
      <line
        x1="0"
        y1={H - 1}
        x2={W}
        y2={H - 1}
        stroke="var(--app-border-subtle, #e5e7eb)"
        strokeWidth="1"
      />
      <polygon points={areaPts} fill={accent} fillOpacity="0.08" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="3" fill={accent} />
    </svg>
  );
}

function Shell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function SchedulingSummaryCard({
  owner,
  pillar,
  onShare,
  eventTypes,
  insightsHref = "/app/scheduling/insights",
  className,
}: SummaryCardProps) {
  const tk = pillarTokens(pillar);
  const [data, setData] = useState<BookingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const summary = await api.scheduling.getBookingsSummary(owner);
      setData(summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell className={className}>
        <div className="mb-3.5 h-3 w-24 animate-pulse rounded bg-app-surface-sunken" />
        <div className="flex items-stretch gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-1.5">
              <div className="h-6 w-2/3 animate-pulse rounded bg-app-surface-sunken" />
              <div className="h-2.5 w-full animate-pulse rounded bg-app-surface-sunken" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-app-surface-sunken" />
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell className={className}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
            <CloudOff className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-app-text">
              Couldn’t load your numbers
            </p>
            <p className="mt-0.5 text-xs text-app-text-secondary">
              Check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3.5 py-2 text-xs font-semibold text-app-text-strong hover:bg-app-hover"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  // Wire shape reads — narrowed defensively so partial payloads degrade to 0/[].
  const raw = data as BookingsSummary & Record<string, unknown>;
  const bookingsThisMonth = num(raw.bookingsThisMonth);
  const upcoming = num(raw.upcomingCount);
  const noShowCount = num(raw.noShowCount);
  const deltaPct = typeof raw.deltaPct === "number" ? raw.deltaPct : null;
  const sparkline: number[] = Array.isArray(raw.sparkline)
    ? (raw.sparkline as Array<{ date?: string; count?: unknown }>).map((p) =>
        num(p?.count),
      )
    : [];
  const nameById = new Map((eventTypes ?? []).map((e) => [e.id, e.name]));
  const byEventType = (
    Array.isArray(raw.byEventType)
      ? (raw.byEventType as Array<{ event_type_id?: string; count?: unknown }>)
      : []
  )
    .map((b) => ({
      name: b?.event_type_id ? nameById.get(b.event_type_id) : undefined,
      count: num(b?.count),
    }))
    .filter((b): b is { name: string; count: number } => !!b.name)
    .slice(0, 3);

  const isEmpty = bookingsThisMonth === 0 && upcoming === 0;

  if (isEmpty) {
    return (
      <Shell className={className}>
        <p
          className={clsx(
            "mb-3.5 text-[11px] font-bold uppercase tracking-[0.08em]",
            tk.text,
          )}
        >
          This month
        </p>
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              tk.bgSoft,
              tk.text,
            )}
          >
            <CalendarClock className="h-[22px] w-[22px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-app-text">
              No bookings yet
            </p>
            <p className="mt-0.5 text-[12.5px] text-app-text-secondary">
              Share your link to get your first one.
            </p>
          </div>
        </div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className={clsx(
              "mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold shadow-sm",
              tk.bg,
              tk.textOn,
            )}
          >
            <Share2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Share booking link
          </button>
        )}
      </Shell>
    );
  }

  // Delta direction — deltaPct is vs last month, from the wire.
  const deltaDir: DeltaDir =
    deltaPct == null ? null : deltaPct >= 0 ? "up" : "down";
  const deltaLabel =
    deltaPct == null ? "—" : `${deltaPct >= 0 ? "+" : ""}${deltaPct}%`;

  return (
    <Shell className={className}>
      {/* Card header: accent overline + period pill (This month, static per mobile parity) */}
      <div className="mb-3.5 flex items-center justify-between">
        <p
          className={clsx(
            "text-[11px] font-bold uppercase tracking-[0.08em]",
            tk.text,
          )}
        >
          This month
        </p>
        <div className="flex gap-[3px] rounded-full bg-app-surface-sunken p-[3px]">
          <span className="whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-semibold text-app-text-secondary">
            This week
          </span>
          <span
            className={clsx(
              "whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-bold text-white",
              tk.bg,
            )}
          >
            This month
          </span>
        </div>
      </div>

      {/* 4 stat cells: Bookings | delta vs last month | Upcoming | No-shows */}
      <div className="flex items-stretch gap-2.5">
        <StatCell value={String(bookingsThisMonth)} label="Bookings" />
        <Divider />
        <StatCell
          value={deltaLabel}
          label="vs last month"
          delta={deltaDir ?? undefined}
        />
        <Divider />
        <StatCell value={String(upcoming)} label="Upcoming" />
        <Divider />
        <StatCell value={String(noShowCount)} label="No-shows" />
      </div>

      {/* 30-day sparkline — placeholder baseline when the wire has too few points */}
      <div className="mt-4">
        {sparkline.length >= 2 ? (
          <Sparkline data={sparkline} accent={tk.hex} />
        ) : (
          <div
            className="h-10 w-full rounded bg-app-surface-sunken opacity-40"
            aria-hidden
          />
        )}
      </div>

      {/* Event-type breakdown chips */}
      {byEventType.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {byEventType.map(({ name, count }) => (
            <span
              key={name}
              className="inline-flex items-center gap-[5px] rounded-full bg-app-surface-sunken px-[9px] py-1 text-[11px] font-semibold text-app-text-strong"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: tk.hex }}
                aria-hidden
              />
              {name}
              <span className="font-bold text-app-text-muted">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* See insights link */}
      <div className="mt-3 flex justify-end">
        <Link
          href={insightsHref}
          className={clsx(
            "inline-flex items-center gap-0.5 text-[12.5px] font-semibold",
            tk.text,
          )}
        >
          See insights
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Shell>
  );
}

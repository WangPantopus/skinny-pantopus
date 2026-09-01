'use client';

import { Home, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import type { PropertyValueData } from '@pantopus/types';

interface PropertyValueCardProps {
  data: PropertyValueData | null;
  loading: boolean;
}

// ── Formatting helpers ──────────────────────────────────────────

function fmtValue(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function fmtCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return fmtValue(value);
}

function fmtSqft(sqft: number): string {
  return `${sqft.toLocaleString()} sqft`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Trend config ────────────────────────────────────────────────

function trendMeta(trend: 'up' | 'down' | 'flat' | null) {
  switch (trend) {
    case 'up':
      return {
        icon: TrendingUp,
        colorClass: 'text-green-600 dark:text-green-400',
        label: 'Trending up in your ZIP',
      };
    case 'down':
      return {
        icon: TrendingDown,
        colorClass: 'text-red-600 dark:text-red-400',
        label: 'Trending down in your ZIP',
      };
    case 'flat':
      return {
        icon: ArrowRight,
        colorClass: 'text-app-text-secondary',
        label: 'Flat trend in your ZIP',
      };
    default:
      return null;
  }
}

// ── Component ───────────────────────────────────────────────────

export default function PropertyValueCard({ data, loading }: PropertyValueCardProps) {
  // ── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5 animate-pulse">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-[55%] rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-2.5 h-7 w-[40%] rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-2.5 w-[35%] rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-2.5 w-[50%] rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // ── Null / unavailable state ────────────────────────────────
  if (!data || data.estimated_value == null) {
    if (!data) return null;

    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
        <div className="flex flex-col items-center gap-1 py-4">
          <TrendingUp className="h-7 w-7 text-primary" />
          <p className="mt-1 text-sm font-medium text-app-text-primary">
            Property insights coming soon
          </p>
          <p className="text-xs text-app-text-secondary text-center">
            We&apos;ll show your home&apos;s estimated value once your address is fully verified.
          </p>
        </div>
      </div>
    );
  }

  const trend = trendMeta(data.zip_median_sale_price_trend);

  // Property details chips
  const details: string[] = [];
  if (data.year_built) details.push(`Built ${data.year_built}`);
  if (data.sqft) details.push(fmtSqft(data.sqft));

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
      {/* Title */}
      <div className="flex items-center gap-1.5">
        <Home className="h-4 w-4 text-app-primary" />
        <span className="text-[13px] font-semibold text-app-text-secondary">
          Estimated Home Value
        </span>
      </div>

      {/* Main value */}
      <p className="mt-2 text-[28px] font-bold leading-tight text-app-text-primary">
        {fmtValue(data.estimated_value)}
      </p>

      {/* Value range */}
      {data.value_range_low != null && data.value_range_high != null && (
        <p className="mt-0.5 text-[13px] text-app-text-secondary">
          {fmtCompact(data.value_range_low)} &ndash; {fmtCompact(data.value_range_high)}
        </p>
      )}

      {/* Trend indicator */}
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <trend.icon className={`h-3.5 w-3.5 ${trend.colorClass}`} />
          <span className={`text-xs font-medium ${trend.colorClass}`}>{trend.label}</span>
        </div>
      )}

      {/* Property details */}
      {details.length > 0 && (
        <p className="mt-2 text-xs text-app-text-secondary">
          {details.join(' \u2022 ')}
        </p>
      )}

      {/* Last updated */}
      {data.last_updated && (
        <p className="mt-1.5 text-[11px] text-app-text-muted">
          Updated {fmtDate(data.last_updated)}
        </p>
      )}
    </div>
  );
}

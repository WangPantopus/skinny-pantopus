'use client';

import type { BillTrendData, BillBenchmarkInsufficient } from '@pantopus/types';
import { Receipt, ArrowRight, Users } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────

interface BillTrendChartProps {
  data: BillTrendData | null;
  selectedType: string | null;
  onTypeChange: (type: string) => void;
  loading: boolean;
  /** Called when user clicks "Add a bill" in the empty state. */
  onAddBill?: () => void;
  /** Called when the user toggles the benchmark opt-in switch. */
  onOptInChange?: (optedIn: boolean) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function isInsufficient(b: unknown): b is BillBenchmarkInsufficient {
  return !!b && typeof b === 'object' && (b as Record<string, any>).insufficient_data === true;
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return MONTH_SHORT[d.getMonth()] ?? iso.slice(5, 7);
}

function fmtAmount(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const BAR_MAX_HEIGHT = 120;

// ── Component ──────────────────────────────────────────────────

export default function BillTrendChart({
  data,
  selectedType,
  onTypeChange,
  loading,
  onAddBill,
  onOptInChange,
}: BillTrendChartProps) {
  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {[80, 60, 70].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>
        <div className="flex items-end gap-1 h-[140px]">
          {[50, 70, 40, 80, 55, 65].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
              style={{ height: h }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────
  const types = data ? Object.keys(data.bills_by_type) : [];
  if (!data || types.length === 0) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
        <div className="flex flex-col items-center gap-1 py-6">
          <Receipt className="h-8 w-8 text-primary" />
          <p className="mt-1 text-sm font-medium text-app-text">
            Track your household bills
          </p>
          <p className="text-xs text-app-text-secondary text-center">
            Bills from your mailbox will appear here automatically. You can also add bills manually.
          </p>
          {onAddBill && (
            <button
              type="button"
              onClick={onAddBill}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Add a bill
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Resolve active type ────────────────────────────────────
  const activeType =
    selectedType && types.includes(selectedType) ? selectedType : types[0];
  const typeData = data.bills_by_type[activeType];
  const rawBenchmark = data.benchmarks[activeType];
  const benchmarkInsufficient = isInsufficient(rawBenchmark);
  const benchmark = !benchmarkInsufficient ? rawBenchmark : null;
  const showBenchmark = !!(benchmark && benchmark.household_count >= 10);

  // ── Compute max value for bar scaling ──────────────────────
  const allAmounts = [
    ...typeData.amounts,
    ...(showBenchmark ? benchmark.avg_amounts : []),
  ];
  const maxAmount = Math.max(...allAmounts, 1);

  // ── User average ───────────────────────────────────────────
  const userTotal = typeData.amounts.reduce((a, b) => a + b, 0);
  const userAvg =
    typeData.amounts.length > 0 ? userTotal / typeData.amounts.length : 0;

  // ── Benchmark average & comparison ─────────────────────────
  let benchAvg = 0;
  let pctDiff = 0;
  let diffDir: 'above' | 'below' | 'same' = 'same';

  if (showBenchmark) {
    const bTotal = benchmark.avg_amounts.reduce(
      (a: number, b: number) => a + b,
      0,
    );
    benchAvg =
      benchmark.avg_amounts.length > 0
        ? bTotal / benchmark.avg_amounts.length
        : 0;
    if (benchAvg > 0) {
      pctDiff = Math.round(
        (Math.abs(userAvg - benchAvg) / benchAvg) * 100,
      );
      diffDir =
        userAvg > benchAvg ? 'above' : userAvg < benchAvg ? 'below' : 'same';
    }
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
      {/* Type selector pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={
              t === activeType
                ? 'rounded-full px-3 py-1.5 text-xs font-semibold bg-primary text-white transition-colors'
                : 'rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
            }
          >
            {capitalize(t)}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1" style={{ height: BAR_MAX_HEIGHT + 20 }}>
        {typeData.months.map((month, i) => {
          const userH = (typeData.amounts[i] / maxAmount) * BAR_MAX_HEIGHT;
          const benchH = showBenchmark
            ? (benchmark.avg_amounts[i] / maxAmount) * BAR_MAX_HEIGHT
            : 0;

          return (
            <div key={month} className="flex-1 flex flex-col items-center">
              <div
                className="flex items-end justify-center gap-px w-full"
                style={{ height: BAR_MAX_HEIGHT }}
              >
                {/* User bar */}
                <div
                  className="flex-1 max-w-[20px] rounded-sm bg-primary"
                  style={{ height: Math.max(userH, 2) }}
                />
                {/* Benchmark bar */}
                {showBenchmark && (
                  <div
                    className="flex-1 max-w-[20px] rounded-sm bg-gray-300 dark:bg-gray-600"
                    style={{ height: Math.max(benchH, 2) }}
                  />
                )}
              </div>
              <span className="text-[9px] text-secondary mt-1 leading-none">
                {monthLabel(month)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {showBenchmark && (
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] text-secondary">You</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-[10px] text-secondary">Neighborhood</span>
          </div>
        </div>
      )}

      {/* Summary + comparison */}
      {showBenchmark && (
        <div className="mt-3 pt-3 border-t border-app-border">
          <p className="text-xs text-secondary leading-snug">
            Your {activeType} bill: {fmtAmount(userAvg)}/mo avg. Neighborhood:{' '}
            {fmtAmount(benchAvg)}/mo avg.
          </p>
          {diffDir !== 'same' && pctDiff > 0 && (
            <span
              className={`inline-block mt-1 text-xs font-semibold ${
                diffDir === 'above'
                  ? 'text-amber-600'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {pctDiff}% {diffDir} neighborhood average
            </span>
          )}
        </div>
      )}

      {/* Insufficient data message (3-9 households) */}
      {!showBenchmark && benchmarkInsufficient && rawBenchmark && (
        <div className="mt-3 pt-3 border-t border-app-border flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-app-text-secondary flex-shrink-0" />
          <p className="text-xs text-app-text-secondary leading-snug">
            Almost there &mdash; {(rawBenchmark as BillBenchmarkInsufficient).needed} more neighbor{(rawBenchmark as BillBenchmarkInsufficient).needed === 1 ? '' : 's'} needed for comparison
          </p>
        </div>
      )}

      {/* Opt-in toggle */}
      {onOptInChange && (
        <div className="mt-3 pt-3 border-t border-app-border flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-app-text">Share bill data anonymously</p>
            <p className="text-[11px] text-app-text-secondary leading-snug mt-0.5">
              Help neighbors compare costs. Only averages are shared &mdash; never individual amounts.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={data.bill_benchmark_opt_in}
              onChange={(e) => onOptInChange(e.target.checked)}
            />
            <div className="h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-gray-600" />
          </label>
        </div>
      )}
    </div>
  );
}

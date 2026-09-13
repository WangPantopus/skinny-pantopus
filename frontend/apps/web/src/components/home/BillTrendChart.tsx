'use client';

import type { BillTrendData, BillBenchmarkInsufficient } from '@pantopus/types';
import { Receipt, ArrowRight, Users } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────

interface BillTrendChartProps {
  data: BillTrendData | null;
  selectedType: string | null;
  onTypeChange: (type: string) => void;
  loading: boolean;
  savingPreference?: boolean;
  onCurrencyChange?: (currency: string) => void;
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
  return `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(2, 4)}`;
}

function fmtAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
  savingPreference = false,
  onCurrencyChange,
  onAddBill,
  onOptInChange,
}: BillTrendChartProps) {
  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-w-0 rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
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

  const currency = data?.currency || 'USD';
  const currencies = [...new Set(['USD', currency, ...(data?.available_currencies || [])])];
  const currencyControl = <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-app-text-secondary">
    <span>Paid bills by period-start month</span>
    {onCurrencyChange ? <label className="flex items-center gap-2">Currency
      <select aria-label="Bill comparison currency" value={currency} disabled={savingPreference} onChange={e => onCurrencyChange(e.target.value)} className="rounded border border-app-border bg-app-surface p-1 text-app-text">
        {currencies.map(code => <option key={code} value={code}>{code}</option>)}
      </select>
    </label> : <span>{currency}</span>}
  </div>;
  const sharingControl = data ? <>
      {savingPreference && <p role="status" className="mt-2 text-sm text-app-text-secondary">Saving sharing preference…</p>}
      {onOptInChange ? (
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
              aria-label="Share bill data anonymously"
              className="peer sr-only"
              disabled={savingPreference}
              checked={data?.bill_benchmark_opt_in === true}
              onChange={(e) => onOptInChange(e.target.checked)}
            />
            <div className="peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600 peer-focus-visible:ring-offset-2 h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-primary-600 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-gray-600" />
          </label>
        </div>
      ) : <p className="mt-3 text-xs text-app-text-secondary">Bill sharing is {data?.bill_benchmark_opt_in ? 'on' : 'off'}.</p>}
  </> : null;

  // ── Empty state ─────────────────────────────────────────────
  const types = data ? Object.keys(data.bills_by_type) : [];
  if (!data || types.length === 0) {
    return (
      <div className="min-w-0 rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
        {currencyControl}
        <div className="flex flex-col items-center gap-1 py-6">
          <Receipt className="h-8 w-8 text-primary" />
          <p className="mt-1 text-sm font-medium text-app-text">
            No paid {currency} bill history yet
          </p>
          <p className="text-xs text-app-text-secondary text-center">
            Paid bills with a period start in the last 24 months appear here. You can also add a bill.
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
        {sharingControl}
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

  // Match actual calendar months; array positions are not comparison periods.
  const peerByMonth = new Map(showBenchmark ? benchmark.months.map((month, i) => [month, benchmark.avg_amounts[i]]) : []);
  const matches = typeData.months.flatMap((month, i) => peerByMonth.has(month) ? [{ own: typeData.amounts[i], peer: peerByMonth.get(month)! }] : []);
  const maxAmount = Math.max(...typeData.amounts, ...matches.map(row => row.peer), 1);
  const userAvg = matches.length ? matches.reduce((sum, row) => sum + row.own, 0) / matches.length : 0;
  const benchAvg = matches.length ? matches.reduce((sum, row) => sum + row.peer, 0) / matches.length : 0;
  const pctDiff = benchAvg > 0 ? Math.round(Math.abs(userAvg-benchAvg) / benchAvg * 100) : 0;
  const diffDir = userAvg > benchAvg ? 'above' : userAvg < benchAvg ? 'below' : 'same';
  const recordedAvg = typeData.amounts.reduce((sum, amount) => sum + amount, 0) / typeData.amounts.length;

  return (
    <div className="min-w-0 rounded-xl border border-app-border bg-app-surface shadow-sm p-5">
      {currencyControl}
      {/* Type selector pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={
              t === activeType
                ? 'rounded-full px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white transition-colors'
                : 'rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
            }
          >
            {capitalize(t)}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: BAR_MAX_HEIGHT + 38 }} tabIndex={0} aria-label="Monthly bill chart">
        {typeData.months.map((month, i) => {
          const userH = (typeData.amounts[i] / maxAmount) * BAR_MAX_HEIGHT;
          const peerAmount = peerByMonth.get(month);
          const benchH = peerAmount == null ? 0 : (peerAmount / maxAmount) * BAR_MAX_HEIGHT;
          const label = `${month}: your total ${fmtAmount(typeData.amounts[i], currency)}${peerAmount == null ? ' · No comparison for this month' : ` · Comparison ${fmtAmount(peerAmount, currency)}`}`;

          return (
            <div key={month} role="img" aria-label={label} title={label} className="min-w-12 flex-1 flex flex-col items-center">
              <div
                className="flex items-end justify-center gap-px w-full"
                style={{ height: BAR_MAX_HEIGHT }}
              >
                {/* User bar */}
                <div
                  className="flex-1 max-w-[20px] rounded-sm bg-primary-600"
                  style={{ height: Math.max(userH, 2) }}
                />
                {/* Benchmark bar */}
                {peerAmount != null && (
                  <div
                    className="flex-1 max-w-[20px] rounded-sm bg-gray-300 dark:bg-gray-600"
                    style={{ height: Math.max(benchH, 2) }}
                  />
                )}
              </div>
              <span className="whitespace-nowrap text-[10px] text-secondary mt-1 leading-none">
                {monthLabel(month)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-app-text-secondary">
        Your recorded average: {fmtAmount(recordedAvg, currency)}/month across {typeData.months.length} month{typeData.months.length === 1 ? '' : 's'}.
      </p>
      <details className="mt-2 text-xs text-app-text-secondary">
        <summary className="cursor-pointer rounded py-1 font-medium text-app-text focus-visible:outline-primary-600">View monthly amounts</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">{capitalize(activeType)} monthly totals in {currency}</caption>
            <thead><tr><th className="py-1 pr-2">Month</th><th className="py-1 pr-2">Your total</th><th className="py-1">Comparison</th></tr></thead>
            <tbody>{typeData.months.map((month, i) => <tr key={month} className="border-t border-app-border">
              <th scope="row" className="whitespace-nowrap py-2 pr-2 font-normal">{monthLabel(month)}</th>
              <td className="whitespace-nowrap py-2 pr-2">{fmtAmount(typeData.amounts[i], currency)}</td>
              <td className="whitespace-nowrap py-2">{peerByMonth.has(month) ? fmtAmount(peerByMonth.get(month)!, currency) : 'Unavailable'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>

      {/* Legend */}
      {showBenchmark && (
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-primary-600" />
            <span className="text-[10px] text-secondary">You</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-[10px] text-secondary">Neighborhood</span>
          </div>
        </div>
      )}

      {/* Summary + comparison */}
      {matches.length > 0 && (
        <div className="mt-3 pt-3 border-t border-app-border">
          <p className="text-xs text-secondary leading-snug">
            Across {matches.length} matching month{matches.length === 1 ? '' : 's'}: your {activeType} bill: {fmtAmount(userAvg, currency)}/mo avg. Neighborhood:{' '}
            {fmtAmount(benchAvg, currency)}/mo avg.
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

      {showBenchmark && matches.length === 0 && <p className="mt-3 text-xs text-app-text-secondary">No comparison covers the same months as these bills.</p>}

      {/* Insufficient data message (3-9 households) */}
      {!showBenchmark && benchmarkInsufficient && rawBenchmark && (
        <div className="mt-3 pt-3 border-t border-app-border flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-app-text-secondary flex-shrink-0" />
          <p className="text-xs text-app-text-secondary leading-snug">
            Almost there &mdash; {(rawBenchmark as BillBenchmarkInsufficient).needed} more neighbor{(rawBenchmark as BillBenchmarkInsufficient).needed === 1 ? '' : 's'} needed for comparison
          </p>
        </div>
      )}

      {sharingControl}
    </div>
  );
}

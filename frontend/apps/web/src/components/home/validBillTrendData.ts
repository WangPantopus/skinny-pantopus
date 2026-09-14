import type { BillTrendData } from '@pantopus/types';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && Number.isSafeInteger(Math.round(value * 100));
const months = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.length <= 24
  && value.every((month, i) => typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    && (i === 0 || value[i - 1] < month));
const series = (periods: unknown, amounts: unknown) => months(periods) && Array.isArray(amounts)
  && periods.length === amounts.length && amounts.every(money);

/** Reject malformed or wrong-currency success before any financial UI renders. */
export function validBillTrendData(value: unknown, currency: string): value is BillTrendData {
  if (!record(value) || value.currency !== currency || value.calculation_version !== 2 || value.format_version !== 2
    || typeof value.bill_benchmark_opt_in !== 'boolean'
    || !Array.isArray(value.available_currencies)
    || !value.available_currencies.every(code => typeof code === 'string' && /^[A-Z]{3}$/.test(code))
    || !record(value.bills_by_type) || !record(value.benchmarks)) return false;
  if (!Object.entries(value.bills_by_type).every(([type, row]) => /^[a-z][a-z_]*$/.test(type)
    && record(row) && series(row.months, row.amounts))) return false;
  return Object.entries(value.benchmarks).every(([type, row]) => {
    if (!/^[a-z][a-z_]*$/.test(type) || !record(row)) return false;
    if (row.insufficient_data === true) return Number.isInteger(row.needed)
      && Number(row.needed) >= 1 && Number(row.needed) <= 7
      && !('avg_amounts' in row) && !('months' in row);
    return Number.isInteger(row.household_count) && Number(row.household_count) >= 10
      && series(row.months, row.avg_amounts);
  });
}

/** HomeBill.amount is a major-unit amount in its own currency. */
export function formatHomeBillAmount(amount: unknown, currency: unknown): string {
  if ((typeof amount !== 'number' && (typeof amount !== 'string' || !/^-?\d+(\.\d+)?$/.test(amount)))
    || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return 'Amount unavailable';
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Amount unavailable';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code',
    minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** A bill's due_date is a calendar date, not a UTC instant. */
export function parseHomeBillDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function formatHomeBillDate(value: unknown): string {
  return parseHomeBillDate(value)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) ?? 'Date unavailable';
}

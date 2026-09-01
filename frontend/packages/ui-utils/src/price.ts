// ============================================================
// PRICE / CURRENCY FORMATTING UTILITIES
// Single source of truth — replaces inline toPriceLabel, getGigPrice, etc.
// ============================================================

export interface FormatPriceOptions {
  /** When true, display 0 as "Free" instead of "$0". Default: false */
  showFree?: boolean;
}

/**
 * Format a cent-less dollar amount for display.
 *
 * - 0        → "Free" (if showFree) or "$0"
 * - 15       → "$15"
 * - 15.50    → "$15.50"
 * - NaN / ∞  → "$0"
 */
export function formatPrice(amount: number, options?: FormatPriceOptions): string {
  const n = Number.isFinite(amount) ? amount : 0;
  if (n === 0 && options?.showFree) return 'Free';
  // Whole-dollar amounts omit the decimal
  if (n === Math.floor(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Build a short price label for a gig / listing with optional range.
 *
 * - Fixed price:  "$50"
 * - Range:        "$50 – $100"
 * - No price:     "Open"
 */
export function toPriceLabel(item: {
  price?: number | null;
  price_max?: number | null;
  budget?: number | null;
}): string {
  const low = Number(item.price ?? item.budget ?? 0);
  const high = Number(item.price_max ?? 0);

  if (!Number.isFinite(low) || low <= 0) return 'Open';

  const lowStr = formatPrice(low);
  if (Number.isFinite(high) && high > low) {
    return `${lowStr} – ${formatPrice(high)}`;
  }
  return lowStr;
}

/**
 * Extract the effective numeric price from a gig object.
 *
 * Looks at `price`, then `budget`, then `bid_amount`.
 * Returns 0 for missing / non-numeric values.
 */
export function getGigPrice(gig: {
  price?: number | null;
  budget?: number | null;
  bid_amount?: number | null;
}): number {
  const price = Number(gig?.price ?? gig?.budget ?? gig?.bid_amount ?? 0);
  return Number.isFinite(price) ? price : 0;
}

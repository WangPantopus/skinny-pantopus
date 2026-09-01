// W15 — Packages & invoices. Framework-free money helpers shared across the
// owner packages list, the editor's live per-session math, the customer buy
// summary, and the invoice surfaces. Cents in, formatted strings out. Reuses
// the app's `formatCurrency` (dollars) so currency rendering stays consistent.

/** Dollars (string or number) → integer cents ("240.00" → 24000). */
export function dollarsToCents(dollars: string | number): number {
  const n = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/**
 * Integer cents → a localized currency string. Whole amounts drop the decimals
 * ("22000" → "$220"); fractional amounts keep two ("4450" → "$44.50").
 */
export function formatCents(
  cents: number | null | undefined,
  currency = "USD",
): string {
  const n = Number(cents);
  const value = Number.isFinite(n) ? n / 100 : 0;
  const whole = Math.round(value * 100) % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase().slice(0, 3),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Exact per-session cost in cents (price split across sessions). */
export function perSessionCents(priceCents: number, sessions: number): number {
  const p = Number(priceCents);
  const s = Math.round(Number(sessions));
  if (!Number.isFinite(p) || !Number.isFinite(s) || s <= 0) return 0;
  return Math.round(p / s);
}

/** "$44 each" style per-session label, or null when not yet priced. */
export function perSessionLabel(
  priceCents: number,
  sessions: number,
  currency = "USD",
): string | null {
  if (!(priceCents > 0) || !(sessions > 0)) return null;
  return `${formatCents(perSessionCents(priceCents, sessions), currency)} each`;
}

/**
 * The owner-list sub line: "5 sessions · $220 · $44 each". The per-session
 * clause is dropped for an un-priced (free) package.
 */
export function packageSubLine(pkg: {
  sessions_count: number;
  price_cents: number;
  currency: string;
}): string {
  const sessions = `${pkg.sessions_count} session${pkg.sessions_count === 1 ? "" : "s"}`;
  const price = formatCents(pkg.price_cents, pkg.currency);
  const each = perSessionLabel(
    pkg.price_cents,
    pkg.sessions_count,
    pkg.currency,
  );
  return each ? `${sessions} · ${price} · ${each}` : `${sessions} · ${price}`;
}

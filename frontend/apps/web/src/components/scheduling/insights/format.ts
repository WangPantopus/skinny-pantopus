// W17 — Insights formatters. Pure render helpers (no React). Money is integer
// cents. Rates are normalized: the app's own scheduling code treats backend
// rates (e.g. summary.noShowRate) as FRACTIONS (0–1, multiplied by 100 for
// display), but the insights endpoints' doc describes them as percents — so
// `formatRate` accepts either: values in [0,1] are read as fractions, values
// >1 as already-percent. All inputs may be null/NaN (sparse reports), so every
// helper degrades to an em-dash placeholder rather than "NaN".

const DASH = "—";

/** Fraction (0–1) from a part/whole pair (0 when the whole is 0). */
export function rateOf(part: number, whole: number): number {
  if (!whole) return 0;
  return part / whole;
}

/**
 * Normalize a rate to a 0–1 fraction (for chart geometry). |value| ≤ 1 is read
 * as a fraction, |value| > 1 as a percent. Clamped to [0,1].
 */
export function toFraction(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  const frac = Math.abs(value) <= 1 ? value : value / 100;
  return Math.min(1, Math.max(0, frac));
}

/**
 * Render a rate as a percent string. Normalizes fraction-vs-percent inputs:
 * |value| ≤ 1 → fraction (×100); |value| > 1 → already a percent.
 */
export function formatRate(
  value: number | null | undefined,
  digits = 0,
): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  const f = 10 ** digits;
  const v = Math.round(pct * f) / f;
  return `${v}%`;
}

export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return DASH;
  return new Intl.NumberFormat("en-US").format(n);
}

/** Integer cents → display currency (drops the cents when whole). */
export function formatMoneyCents(
  cents: number | null | undefined,
  currency = "USD",
): string {
  if (cents == null || Number.isNaN(cents)) return DASH;
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(cents % 100 === 0 ? 0 : 2)}`;
  }
}

/** "30 min" / "1 hr" / "1 hr 30 min". */
export function formatDurationMin(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min) || min <= 0) return DASH;
  const m = Math.round(min);
  if (m % 60 === 0) return `${m / 60} hr`;
  if (m > 60) return `${Math.floor(m / 60)} hr ${m % 60} min`;
  return `${m} min`;
}

function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Range label from two YYYY-MM-DD keys, e.g. "Jun 1 – Jun 30, 2026" (same year)
 * or "Dec 1, 2025 – Jan 5, 2026" (cross-year). Parsed as UTC date-only so the
 * label never drifts by the viewer's offset.
 */
export function formatRangeLabel(from: string, to: string): string {
  const a = parseKey(from);
  const b = parseKey(to);
  if (!a || !b) return "";
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const fmtA = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const fmtB = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmtA.format(a)} – ${fmtB.format(b)}`;
}

/** "Thu, Jun 18 · 2:00 PM" in the given tz (for next-booking / recent rows). */
export function formatDateTimeShort(
  iso: string | null | undefined,
  tz: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(
      d,
    );
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  }
}

/** Initials for a member/host avatar fallback. */
export function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Display name for a member/host, never empty. */
export function memberDisplay(name?: string | null): string {
  return (name || "").trim() || "Unknown";
}

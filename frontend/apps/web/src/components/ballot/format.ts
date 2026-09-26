// ============================================================
// Ballot P0 — small formatting helpers shared by the web surfaces.
// Every sentence the cards show is composed on the server; these only
// format numbers and dates the server already chose.
// ============================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-24" → "Sep 24" (calendar date; no timezone shift). */
export function monthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

/** "32 days left." / "1 day left." / "Last day." */
export function daysLeft(n: number): string {
  if (n <= 0) return 'Last day.';
  return `${n} ${n === 1 ? 'day' : 'days'} left.`;
}

/**
 * The source line's "as of": a clock time when the data is from today,
 * else the date ("Sep 24") — reference data checked on a date never
 * pretends to be a live fetch.
 */
export function asOfLabel(asOf: string | null | undefined, now: Date = new Date()): string | null {
  if (!asOf) return null;
  const at = new Date(asOf);
  if (!Number.isFinite(at.getTime())) return null;
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay && !/T00:00:00(\.000)?Z$/.test(asOf)) {
    return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return monthDay(asOf.slice(0, 10));
}

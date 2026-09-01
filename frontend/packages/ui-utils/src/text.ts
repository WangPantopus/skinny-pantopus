// ============================================================
// TEXT UTILITIES
// Single source of truth — replaces 10+ inline implementations
// ============================================================

/**
 * Extract initials from a display name.
 *
 * "John Doe"  → "JD"
 * "Alice"     → "A"
 * ""          → "?"
 * null        → "?"
 */
export function getInitials(name: string | null | undefined, max: number = 2): string {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, max)
    .join('')
    .toUpperCase();
}

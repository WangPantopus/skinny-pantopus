// ============================================================
// BORDER RADIUS TOKENS — Consistent radius scale
// ============================================================

export const radii = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 9999,
  full: 9999,
} as const;

export type Radii = typeof radii;

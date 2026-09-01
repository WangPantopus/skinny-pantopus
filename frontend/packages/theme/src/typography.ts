// ============================================================
// TYPOGRAPHY TOKENS — Font sizes, weights, line heights
// ============================================================

export const typography = {
  heading1: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
  },
  heading2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
  },
  heading3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
} as const;

export type Typography = typeof typography;

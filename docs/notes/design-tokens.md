# Pantopus design tokens (real, from the repo) — for the Claude Design prompt pack

Shared source of truth: `frontend/packages/theme/src/` (colors, typography, spacing, radii, shadows, css-variables).
Mirrored natively in iOS `Pantopus/Core/Design/` (Colors, Typography, Spacing, Radii, Shadows, Motion, Icons, Theme)
and Android `ui/theme/` (Color.kt, Shadows.kt, MotionTokens.kt), with token tests
(`ColorTokenTest.kt`, `TypographyTest.kt`, `SpacingRadiiTest.kt`, `TokenGallerySnapshotTest.kt`).

**Stated design direction (colors.ts header): "Clean, trustworthy, warm."**

**House rule, enforced by convention (SpeciesPalette.swift header): no hex literal ever appears in `Features/**`.**
Everything is a semantic token. Any new screen must be expressible in these tokens.

## Palette
```
export const colors = {
  // ─── Primary (Sky-blue, slightly warm) ───────────────────
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    DEFAULT: '#0284c7',
  },

  // ─── Surfaces ────────────────────────────────────────────
  surface: {
    base: '#FFFFFF',
    raised: '#F9FAFB',
    sunken: '#F3F4F6',
    app: '#F6F7F9',
    muted: '#F8FAFC',
  },

  // ─── Text ────────────────────────────────────────────────
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    muted: '#9CA3AF',
    inverse: '#FFFFFF',
    strong: '#374151',
  },

  // ─── Borders ─────────────────────────────────────────────
  border: {
    default: '#E5E7EB',
    strong: '#D1D5DB',
    focus: '#0284c7',
    subtle: '#F3F4F6',
  },

  // ─── Semantic ────────────────────────────────────────────
  semantic: {
    success: '#059669',
    successLight: '#D1FAE5',
    successBg: '#F0FDF4',
    warning: '#D97706',
    warningLight: '#FDE68A',
    warningBg: '#FFFBEB',
    error: '#DC2626',
    errorLight: '#FECACA',
    errorBg: '#FEF2F2',
    info: '#0284c7',
    infoLight: '#BAE6FD',
    infoBg: '#F0F9FF',
  },

  // ─── Identity (Pillars) ──────────────────────────────────
  identity: {
    personal: { color: '#0284C7', bg: '#DBEAFE', light: '#EFF6FF' },
    home: { color: '#16A34A', bg: '#DCFCE7', light: '#F0FDF4' },
    business: { color: '#7C3AED', bg: '#F3E8FF', light: '#FAF5FF' },
    professional: { color: '#D97706', bg: '#FEF3C7', light: '#FFFBEB' },
  },

  // ─── Accent palette ──────────────────────────────────────
  accent: {
    blue: '#3B82F6',
    emerald: '#10B981',
    violet: '#8B5CF6',
    amber: '#F59E0B',
    orange: '#F97316',
    red: '#EF4444',
    teal: '#0D9488',
    pink: '#EC4899',
    indigo: '#6366F1',
    green: '#22C55E',
    purple: '#A855F7',
    cyan: '#0891B2',
    // Live Photo badge yellow (iOS systemYellow) — semantic rather than a
    // hue name: the 7px dot on Live Photo tiles and the LIVE replay pill
    // in the media viewer. Identical in dark mode; it sits on photo
    // content, never on a themed surface. Mirrored natively as
    // `Theme.Color.liveBadge` (iOS Core/Design/Colors.swift:145) and
    // `PantopusColors.liveBadge` (Android ui/theme/Color.kt:309).
    liveBadge: '#FFD60A',
  },

  // ─── Dark mode ───────────────────────────────────────────
  dark: {
    surface: {
      base: '#0F172A',
      raised: '#1E293B',
      sunken: '#0F172A',
      app: '#020617',
      muted: '#111827',
    },
    text: {
      primary: '#E5E7EB',
      secondary: '#94A3B8',
      muted: '#64748B',
      inverse: '#111827',
      strong: '#F1F5F9',
    },
    border: {
      default: '#1F2937',
      strong: '#374151',
      focus: '#38BDF8',
      subtle: '#1E293B',
    },
    hover: '#1F2937',
  },
} as const;

```

## Dark mode
```
  // ─── Dark mode ───────────────────────────────────────────
  dark: {
    surface: {
      base: '#0F172A',
      raised: '#1E293B',
      sunken: '#0F172A',
      app: '#020617',
      muted: '#111827',
    },
    text: {
      primary: '#E5E7EB',
      secondary: '#94A3B8',
      muted: '#64748B',
      inverse: '#111827',
      strong: '#F1F5F9',
    },
    border: {
      default: '#1F2937',
      strong: '#374151',
      focus: '#38BDF8',
      subtle: '#1E293B',
    },
    hover: '#1F2937',
  },
} as const;

```

## Typography scale
```
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
```

## Spacing
```
// ============================================================
// SPACING TOKENS — Consistent spacing scale (base: 4px)
// ============================================================

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type Spacing = typeof spacing;
```

## Radii
```
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
```

## Shadows
```
// ============================================================
// SHADOW TOKENS — Elevation system for both platforms
// ============================================================

// React Native compatible shadow definitions
export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

// CSS box-shadow equivalents for web
export const cssShadows = {
  none: 'none',
  sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
  md: '0 2px 6px rgba(0, 0, 0, 0.06)',
  lg: '0 4px 12px rgba(0, 0, 0, 0.08)',
  xl: '0 8px 24px rgba(0, 0, 0, 0.1)',
} as const;

export type Shadows = typeof shadows;
export type CssShadows = typeof cssShadows;
```

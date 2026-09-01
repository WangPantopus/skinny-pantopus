// ============================================================
// COLOR TOKENS — Shared design tokens for Pantopus
// Design direction: Clean, trustworthy, warm.
// ============================================================

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

export type Colors = typeof colors;

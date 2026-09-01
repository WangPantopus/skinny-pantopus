// ============================================================
// Tailwind-compatible CommonJS export of @pantopus/theme tokens.
// This file mirrors src/colors.ts, src/radii.ts, etc. as plain JS
// so that tailwind.config.js (which runs in Node without TS) can
// consume it via require('@pantopus/theme/tailwind.cjs').
//
// SOURCE OF TRUTH: src/*.ts — keep this file in sync.
// ============================================================

/** @type {Record<string, string>} */
const primary = {
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
};

const semantic = {
  success:      '#059669',
  successLight: '#D1FAE5',
  successBg:    '#F0FDF4',
  warning:      '#D97706',
  warningLight: '#FDE68A',
  warningBg:    '#FFFBEB',
  error:        '#DC2626',
  errorLight:   '#FECACA',
  errorBg:      '#FEF2F2',
  info:         '#0284c7',
  infoLight:    '#BAE6FD',
  infoBg:       '#F0F9FF',
};

const accent = {
  blue:    '#3B82F6',
  emerald: '#10B981',
  violet:  '#8B5CF6',
  amber:   '#F59E0B',
  orange:  '#F97316',
  red:     '#EF4444',
  teal:    '#0D9488',
  pink:    '#EC4899',
  indigo:  '#6366F1',
  green:   '#22C55E',
  purple:  '#A855F7',
  cyan:    '#0891B2',
};

const radii = {
  none: '0px',
  xs:   '4px',
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl': '20px',
  '3xl': '24px',
  pill: '9999px',
  full: '9999px',
};

module.exports = { primary, semantic, accent, radii };

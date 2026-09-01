const theme = require('@pantopus/theme/tailwind');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary palette (from @pantopus/theme) ──────────────
        primary: theme.primary,

        // ── Overlay / glass utility ─────────────────────────────
        // Semi-transparent white for overlays on colored / dark
        // surfaces.  Usage: bg-glass/20, hover:bg-glass/30
        'glass':               'rgb(255 255 255 / <alpha-value>)',

        // ── Semantic CSS-variable colors (auto light/dark) ──────
        // Usage: bg-app-surface, text-app-text, border-app-border
        // Supports opacity modifiers: bg-app-surface/90
        'app-bg':              'rgb(var(--app-bg) / <alpha-value>)',
        'app-surface':         'rgb(var(--app-surface) / <alpha-value>)',
        'app-surface-raised':  'rgb(var(--app-surface-raised) / <alpha-value>)',
        'app-surface-sunken':  'rgb(var(--app-surface-sunken) / <alpha-value>)',
        'app-surface-muted':   'rgb(var(--app-surface-muted) / <alpha-value>)',
        'app-text':            'rgb(var(--app-text) / <alpha-value>)',
        'app-text-secondary':  'rgb(var(--app-text-secondary) / <alpha-value>)',
        'app-text-muted':      'rgb(var(--app-text-muted) / <alpha-value>)',
        'app-text-strong':     'rgb(var(--app-text-strong) / <alpha-value>)',
        'app-text-inverse':    'rgb(var(--app-text-inverse) / <alpha-value>)',
        'app-border':          'rgb(var(--app-border) / <alpha-value>)',
        'app-border-strong':   'rgb(var(--app-border-strong) / <alpha-value>)',
        'app-border-subtle':   'rgb(var(--app-border-subtle) / <alpha-value>)',
        'app-hover':           'rgb(var(--app-hover) / <alpha-value>)',

        // ── Semantic status colors ──────────────────────────────
        'app-success':         'var(--color-success)',
        'app-success-light':   'var(--color-success-light)',
        'app-success-bg':      'var(--color-success-bg)',
        'app-warning':         'var(--color-warning)',
        'app-warning-light':   'var(--color-warning-light)',
        'app-warning-bg':      'var(--color-warning-bg)',
        'app-error':           'var(--color-error)',
        'app-error-light':     'var(--color-error-light)',
        'app-error-bg':        'var(--color-error-bg)',
        'app-info':            'var(--color-info)',
        'app-info-light':      'var(--color-info-light)',
        'app-info-bg':         'var(--color-info-bg)',

        // ── Identity / pillar colors ────────────────────────────
        'app-personal':        'var(--color-identity-personal)',
        'app-personal-bg':     'var(--color-identity-personal-bg)',
        'app-home':            'var(--color-identity-home)',
        'app-home-bg':         'var(--color-identity-home-bg)',
        'app-business':        'var(--color-identity-business)',
        'app-business-bg':     'var(--color-identity-business-bg)',
      },
      borderRadius: theme.radii,
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%':   { boxShadow: '0 0 0 0 rgba(99,102,241,0.5)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(99,102,241,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideOut: {
          '0%': { opacity: '1', maxHeight: '100px', transform: 'translateX(0)' },
          '100%': { opacity: '0', maxHeight: '0px', transform: 'translateX(-20px)' },
        },
        highlightFlash: {
          '0%': { backgroundColor: 'transparent' },
          '15%': { backgroundColor: 'rgb(var(--app-hover))' },
          '85%': { backgroundColor: 'rgb(var(--app-hover))' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'slide-out': 'slideOut 0.3s ease-in forwards',
        'section-in': 'fadeInUp 0.3s ease-out forwards',
        'highlight-flash': 'highlightFlash 1.5s ease-in-out',
      },
    },
  },
  plugins: [],
};

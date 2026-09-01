// ============================================================
// STATIONERY THEME & INK CONFIGURATION
// Visual config for the Write It canvas — PNW-inspired seasons,
// ink palettes, and stamp artwork names.
// ============================================================

import type { StationeryTheme, InkSelection } from '@pantopus/types';

// ─── Season Detection ───────────────────────────────────────

/**
 * Returns the current PNW stationery season based on the current month.
 * Dec–Feb = winter, Mar–May = spring, Jun–Aug = summer, Sep–Nov = fall.
 */
export function getCurrentSeason(): StationeryTheme {
  const month = new Date().getMonth(); // 0-indexed
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'fall';
}

// ─── Ink Configuration ──────────────────────────────────────

export interface InkConfig {
  displayName: string;
  dotColor: string;
  description: string;
}

/** Ink palette configuration for the compose canvas bottom row */
export const INK_CONFIGS: Record<InkSelection, InkConfig> = {
  ivory: {
    displayName: 'Ivory',
    dotColor: '#F5F0E8',
    description: 'Warm and approachable',
  },
  slate: {
    displayName: 'Slate',
    dotColor: '#6B7B8D',
    description: 'Formal and measured',
  },
  forest: {
    displayName: 'Forest',
    dotColor: '#2D5A3D',
    description: 'Grounded and steady',
  },
  rose: {
    displayName: 'Rose',
    dotColor: '#C47C8A',
    description: 'Tender and heartfelt',
  },
  midnight: {
    displayName: 'Midnight',
    dotColor: '#1E293B',
    description: 'Bold and dramatic',
  },
};

// ─── Stationery Configuration ───────────────────────────────

export interface StationeryConfig {
  canvasBackground: string;
  canvasGrain: number;
  ruledLineColor: string;
  cursorColor: string;
  accentColor: string;
  stampName: string;
  fontFamily: string;
}

// Canvas background tints per ink — subtle shift from the base parchment
const INK_BACKGROUNDS: Record<InkSelection, string> = {
  ivory: '#FAF7F2',
  slate: '#F4F5F7',
  forest: '#F3F7F4',
  rose: '#FBF4F6',
  midnight: '#F0F1F5',
};

// Ruled-line colors per ink — faint underlines on the canvas
const INK_RULED_LINES: Record<InkSelection, string> = {
  ivory: '#E8E0D4',
  slate: '#D4D8DE',
  forest: '#C8D9CC',
  rose: '#E8CDD4',
  midnight: '#C8CCDA',
};

// Accent colors per ink — stamps, badges, UI highlights
const INK_ACCENTS: Record<InkSelection, string> = {
  ivory: '#B8860B',
  slate: '#4A6274',
  forest: '#2D6A4F',
  rose: '#A4546E',
  midnight: '#3B4F7A',
};

// Cursor colors per ink — the blinking caret on the canvas
const INK_CURSORS: Record<InkSelection, string> = {
  ivory: '#8B2500',
  slate: '#3D4F5F',
  forest: '#1B4332',
  rose: '#8B3A52',
  midnight: '#1A1F3D',
};

// PNW-themed stamp names per season
const SEASON_STAMPS: Record<StationeryTheme, string> = {
  winter: 'Evergreen',
  spring: 'Wildflower',
  summer: 'Mountain & River',
  fall: 'Vine Maple',
};

/**
 * Returns the full visual configuration for a given stationery theme and ink.
 * Used by the Write It canvas to render the letter-writing surface.
 */
export function getStationeryConfig(
  theme: StationeryTheme,
  ink: InkSelection,
): StationeryConfig {
  return {
    canvasBackground: INK_BACKGROUNDS[ink],
    canvasGrain: 0.04,
    ruledLineColor: INK_RULED_LINES[ink],
    cursorColor: INK_CURSORS[ink],
    accentColor: INK_ACCENTS[ink],
    stampName: SEASON_STAMPS[theme],
    fontFamily: 'Lora',
  };
}

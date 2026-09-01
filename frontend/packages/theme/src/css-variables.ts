// ============================================================
// CSS VARIABLE GENERATOR — Produces :root CSS from tokens
// For web consumption via globals.css or style injection
// ============================================================

import { colors } from './colors';
import { spacing } from './spacing';
import { radii } from './radii';

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = '',
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') {
      result[varName] = value;
    } else if (typeof value === 'number') {
      result[varName] = `${value}px`;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, varName));
    }
  }
  return result;
}

/** Generate CSS custom property declarations for light mode */
export function generateLightCssVariables(): string {
  const vars: string[] = [];

  // App shell variables (matching existing globals.css)
  vars.push(`  --app-bg: ${colors.surface.app};`);
  vars.push(`  --app-surface: ${colors.surface.base};`);
  vars.push(`  --app-surface-muted: ${colors.surface.muted};`);
  vars.push(`  --app-border: ${colors.border.default};`);
  vars.push(`  --app-text: ${colors.text.primary};`);
  vars.push(`  --app-text-muted: ${colors.text.secondary};`);
  vars.push(`  --app-hover: ${colors.surface.sunken};`);

  // Primary palette
  for (const [shade, value] of Object.entries(colors.primary)) {
    if (shade !== 'DEFAULT') {
      vars.push(`  --color-primary-${shade}: ${value};`);
    }
  }
  vars.push(`  --color-primary: ${colors.primary.DEFAULT};`);

  // Semantic colors
  vars.push(`  --color-success: ${colors.semantic.success};`);
  vars.push(`  --color-warning: ${colors.semantic.warning};`);
  vars.push(`  --color-error: ${colors.semantic.error};`);
  vars.push(`  --color-info: ${colors.semantic.info};`);

  // Spacing
  for (const [key, value] of Object.entries(spacing)) {
    vars.push(`  --spacing-${key}: ${value}px;`);
  }

  // Radii
  for (const [key, value] of Object.entries(radii)) {
    vars.push(`  --radius-${key}: ${value === 9999 ? '9999px' : `${value}px`};`);
  }

  return vars.join('\n');
}

/** Generate CSS custom property declarations for dark mode */
export function generateDarkCssVariables(): string {
  const vars: string[] = [];

  vars.push(`  --app-bg: ${colors.dark.surface.app};`);
  vars.push(`  --app-surface: ${colors.dark.surface.base};`);
  vars.push(`  --app-surface-muted: ${colors.dark.surface.muted};`);
  vars.push(`  --app-border: ${colors.dark.border.default};`);
  vars.push(`  --app-text: ${colors.dark.text.primary};`);
  vars.push(`  --app-text-muted: ${colors.dark.text.secondary};`);
  vars.push(`  --app-hover: ${colors.dark.hover};`);

  return vars.join('\n');
}

/** Full CSS string with both light and dark modes */
export function generateCssVariables(): string {
  return [
    ':root {',
    '  color-scheme: light dark;',
    generateLightCssVariables(),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    generateDarkCssVariables(),
    '  }',
    '}',
  ].join('\n');
}
